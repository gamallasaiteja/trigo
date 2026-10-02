import json
import os
import psycopg
from psycopg.rows import dict_row

from . import resolve
from .config import MIGRATIONS_DIR, load_yaml
from .connectors import SOURCES
from .records import RawRecord
from .taxonomy import load_taxonomy

STATUS_RANK = {"lead": 0, "contacted": 1, "met": 2, "audited": 3, "signed": 4,
               "filmed": 5, "live": 6, "dormant": 1, "rejected": 1}


def connect(dsn: str | None = None) -> psycopg.Connection:
    dsn = dsn or os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(dsn, row_factory=dict_row)


def migrate(conn):
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        conn.execute(path.read_text())
    conn.commit()


def seed(conn):
    """Upsert sources, categories and destinations from code/config."""
    with conn.cursor() as cur:
        for sid, s in SOURCES.items():
            cur.execute(
                """insert into source (id, name, kind, licence, trust) values (%s, %s, %s, %s, %s)
                   on conflict (id) do update set name = excluded.name, kind = excluded.kind,
                       licence = excluded.licence""",
                (sid, s["name"], s["kind"], s["licence"], s["trust"]))
        tax = load_taxonomy()
        for c in tax.groups + tax.leaves:
            cur.execute(
                """insert into category (id, parent_id, name, mode, kind) values (%s, %s, %s, %s, %s)
                   on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name,
                       mode = excluded.mode, kind = excluded.kind""",
                (c.id, c.parent_id, c.name, c.mode, "operator" if c.kind == "group" else c.kind))
        for d in load_yaml("destinations.yaml")["destinations"]:
            s, w, n, e = d["bbox"]
            cur.execute(
                """insert into destination (id, name, state, kind, mode, bbox)
                   values (%s, %s, %s, %s, %s, ST_MakeEnvelope(%s, %s, %s, %s, 4326))
                   on conflict (id) do update set name = excluded.name, state = excluded.state,
                       kind = excluded.kind, mode = excluded.mode, bbox = excluded.bbox""",
                (d["id"], d["name"], d["state"], d["kind"], d["mode"], w, s, e, n))
    conn.commit()


def upsert_raw(conn, records: list[RawRecord]) -> int:
    sql = """
        insert into raw_record (source_id, external_id, name, phone, email, website, instagram,
                                address, state, categories, geom, payload, expires_at, fetched_at)
        values (%(source_id)s, %(external_id)s, %(name)s, %(phone)s, %(email)s, %(website)s,
                %(instagram)s, %(address)s, %(state)s, %(categories)s,
                case when %(lat)s::float8 is null or %(lng)s::float8 is null then null
                     else ST_SetSRID(ST_MakePoint(%(lng)s::float8, %(lat)s::float8), 4326)::geography end,
                %(payload)s::jsonb, %(expires_at)s, now())
        on conflict (source_id, external_id) do update set
            name = excluded.name, phone = excluded.phone, email = excluded.email,
            website = excluded.website, instagram = excluded.instagram, address = excluded.address,
            state = coalesce(excluded.state, raw_record.state), categories = excluded.categories,
            geom = excluded.geom, payload = excluded.payload, expires_at = excluded.expires_at,
            fetched_at = now()
    """
    rows = [{
        "source_id": r.source_id, "external_id": r.external_id, "name": r.name,
        "phone": r.phone, "email": r.email, "website": r.website, "instagram": r.instagram,
        "address": r.address, "state": r.state, "categories": r.categories,
        "lat": r.lat, "lng": r.lng, "payload": json.dumps(r.payload, ensure_ascii=False),
        "expires_at": r.expires_at,
    } for r in records]
    with conn.cursor() as cur:
        cur.executemany(sql, rows)
    conn.commit()
    return len(rows)


def load_raw(conn) -> list[RawRecord]:
    rows = conn.execute("""
        select r.id, r.source_id, r.external_id, r.name, r.phone, r.email, r.website,
               r.instagram, r.address, r.state, r.categories, s.trust,
               ST_Y(r.geom::geometry) as lat, ST_X(r.geom::geometry) as lng
        from raw_record r join source s on s.id = r.source_id
        where r.name is not null
        order by r.id
    """).fetchall()
    return [RawRecord(**row) for row in rows]


def resolve_providers(conn) -> dict:
    """Re-cluster every raw record and sync providers, keeping provider ids stable.

    A cluster keeps the provider already linked to it that is furthest along the
    pipeline (then oldest). Locked providers keep their fields. Providers left
    with no records are deleted only if they are untouched leads.
    """
    tax = load_taxonomy()
    category_order = [c.id for c in tax.leaves]
    destinations = [resolve.Destination(d["id"], d["bbox"])
                    for d in load_yaml("destinations.yaml")["destinations"]]
    source_kinds = {r["id"]: r["kind"] for r in conn.execute("select id, kind from source")}

    records = load_raw(conn)
    clusters = resolve.cluster(records)

    links = {r["raw_record_id"]: r["provider_id"] for r in
             conn.execute("select raw_record_id, provider_id from provider_source")}
    providers = {r["id"]: r for r in
                 conn.execute("select id, status, locked, created_at from provider")}

    stats = {"created": 0, "updated": 0}
    keep = set()
    with conn.cursor() as cur:
        cur.execute("delete from provider_source")
        for members in clusters:
            fields = resolve.merge(members, category_order, destinations, source_kinds)
            candidates = {links[r.id] for r in members if r.id in links} & providers.keys() - keep
            pid = None
            if candidates:
                pid = max(candidates, key=lambda p: (
                    providers[p]["locked"], STATUS_RANK[providers[p]["status"]],
                    -providers[p]["created_at"].timestamp()))
                if not providers[pid]["locked"]:
                    cur.execute("""
                        update provider set name = %(name)s, phone = %(phone)s, email = %(email)s,
                            website = %(website)s, instagram = %(instagram)s, address = %(address)s,
                            state = %(state)s, categories = %(categories)s,
                            destination_id = %(destination_id)s, source_count = %(source_count)s,
                            quality_score = %(quality_score)s, updated_at = now(),
                            geom = case when %(lat)s::float8 is null then null else
                                ST_SetSRID(ST_MakePoint(%(lng)s::float8, %(lat)s::float8), 4326)::geography end
                        where id = %(id)s""", {**fields, "id": pid})
                stats["updated"] += 1
            else:
                pid = cur.execute("""
                    insert into provider (name, phone, email, website, instagram, address, state,
                        categories, destination_id, source_count, quality_score, geom)
                    values (%(name)s, %(phone)s, %(email)s, %(website)s, %(instagram)s, %(address)s,
                        %(state)s, %(categories)s, %(destination_id)s, %(source_count)s,
                        %(quality_score)s,
                        case when %(lat)s::float8 is null then null else
                            ST_SetSRID(ST_MakePoint(%(lng)s::float8, %(lat)s::float8), 4326)::geography end)
                    returning id""", fields).fetchone()["id"]
                stats["created"] += 1
            keep.add(pid)
            cur.executemany("insert into provider_source (raw_record_id, provider_id) values (%s, %s)",
                            [(r.id, pid) for r in members])

        orphans = [p for p in providers if p not in keep]
        deletable = [p for p in orphans
                     if providers[p]["status"] == "lead" and not providers[p]["locked"]]
        if deletable:
            cur.execute("delete from provider where id = any(%s)", (deletable,))
        stats["deleted"] = len(deletable)
        stats["orphaned_kept"] = len(orphans) - len(deletable)
    conn.commit()
    stats["raw_records"] = len(records)
    stats["providers"] = len(clusters) + stats["orphaned_kept"]
    return dict(stats)


def purge_expired(conn) -> int:
    """Strip cached content past its expiry, keeping only the external id."""
    n = conn.execute("""
        update raw_record set name = null, phone = null, email = null, website = null,
            instagram = null, address = null, geom = null, payload = '{}'
        where expires_at is not null and expires_at < now() and name is not null
    """).rowcount
    conn.commit()
    return n


def stats(conn) -> dict:
    return {
        "by_source": conn.execute("""
            select source_id, count(*) as records from raw_record group by 1 order by 2 desc""").fetchall(),
        "by_status": conn.execute("""
            select status, count(*) as providers from provider group by 1 order by 2 desc""").fetchall(),
        "by_destination": conn.execute("""
            select coalesce(d.name, '(no location / outside clusters)') as destination, count(*) as providers,
                   count(*) filter (where p.phone is not null) as with_phone,
                   round(avg(p.quality_score)) as avg_quality
            from provider p left join destination d on d.id = p.destination_id
            group by 1 order by 2 desc""").fetchall(),
        "top_categories": conn.execute("""
            select c as category, count(*) as providers
            from provider, unnest(categories) c group by 1 order by 2 desc limit 15""").fetchall(),
    }


EXPORT_COLUMNS = ["id", "name", "status", "quality_score", "destination_id", "state", "categories",
                  "phone", "email", "website", "instagram", "address", "lat", "lng", "source_count"]


def export_rows(conn, destination: str | None = None, category: str | None = None) -> list[dict]:
    return conn.execute("""
        select p.id, p.name, p.status, p.quality_score, p.destination_id, p.state,
               array_to_string(p.categories, ';') as categories, p.phone, p.email, p.website,
               p.instagram, p.address, ST_Y(p.geom::geometry) as lat, ST_X(p.geom::geometry) as lng,
               p.source_count
        from provider p
        where (%(dest)s::text is null or p.destination_id = %(dest)s)
          and (%(cat)s::text is null or %(cat)s = any(p.categories))
        order by p.quality_score desc nulls last, p.name
    """, {"dest": destination, "cat": category}).fetchall()
