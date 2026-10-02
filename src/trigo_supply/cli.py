"""trigo-supply: build and query the India experience-supply database.

  trigo-supply init                                  create tables, seed sources/taxonomy/destinations
  trigo-supply ingest osm --destination havelock     pull OpenStreetMap for one destination box
  trigo-supply ingest osm --state IN-AN              pull a whole state/UT
  trigo-supply ingest osm --all-states               pull India, one state at a time
  trigo-supply ingest csv FILE --mapping NAME        import a registry/directory/field sheet
  trigo-supply ingest google --destination goa_north --query "scuba diving"
  trigo-supply resolve                               dedupe + merge raw records into providers
  trigo-supply stats                                 counts by source, status, destination, category
  trigo-supply export --destination havelock -o havelock.csv
  trigo-supply set-status PROVIDER_ID contacted --by rahul --note "WhatsApp intro"
  trigo-supply purge-expired                         drop cached Google content past its expiry
"""

import argparse
import csv
import sys
import time

from . import db
from .config import CONFIG_DIR, load_yaml
from .connectors import csv_import, google_places, osm
from .taxonomy import load_taxonomy


def _destination(dest_id: str) -> dict:
    for d in load_yaml("destinations.yaml")["destinations"]:
        if d["id"] == dest_id:
            return d
    sys.exit(f"unknown destination {dest_id!r}; see config/destinations.yaml")


def _states(selected: list[str] | None) -> list[dict]:
    states = load_yaml("destinations.yaml")["states"]
    if not selected:
        return states
    chosen = [s for s in states if s["code"] in selected]
    missing = set(selected) - {s["code"] for s in chosen}
    if missing:
        sys.exit(f"unknown state code(s): {sorted(missing)}")
    return chosen


def cmd_init(args):
    with db.connect() as conn:
        db.migrate(conn)
        db.seed(conn)
    print("schema migrated; sources, categories and destinations seeded")


def cmd_ingest_osm(args):
    tax = load_taxonomy()
    targets = []
    if args.destination:
        d = _destination(args.destination)
        targets.append((d["id"], {"bbox": d["bbox"]}, d["state"]))
    else:
        for s in _states(None if args.all_states else args.state):
            targets.append((s["code"], {"state_codes": [s["code"], *s.get("alt", [])]}, s["code"]))

    queries = [(label, osm.build_query(tax, include_names=not args.no_names, **area), state)
               for label, area, state in targets]
    if args.print_query:
        for label, query, _ in queries:
            print(f"// {label}\n{query}\n")
        return

    with db.connect() as conn:
        for i, (label, query, state) in enumerate(queries):
            if i:
                time.sleep(args.pause)  # be polite to the public Overpass instance
            records = osm.parse(osm.fetch(query), tax, state=state)
            n = db.upsert_raw(conn, records)
            print(f"{label}: {n} records")


def cmd_ingest_csv(args):
    mapping = load_yaml(f"mappings/{args.mapping}.yaml")
    records = csv_import.load(args.file, mapping, load_taxonomy())
    with db.connect() as conn:
        n = db.upsert_raw(conn, records)
    print(f"{args.file}: {n} records as source {mapping['source_id']!r}")


def cmd_ingest_google(args):
    d = _destination(args.destination)
    records = google_places.search(args.query, d["bbox"], load_taxonomy(), category=args.category)
    for r in records:
        r.state = d["state"]
    with db.connect() as conn:
        n = db.upsert_raw(conn, records)
    print(f"{d['id']} / {args.query!r}: {n} records")


def cmd_resolve(args):
    with db.connect() as conn:
        result = db.resolve_providers(conn)
    for k, v in result.items():
        print(f"{k:>15}: {v}")


def _table(rows: list[dict]):
    if not rows:
        print("  (none)")
        return
    cols = list(rows[0])
    widths = [max(len(str(c)), *(len(str(r[c])) for r in rows)) for c in cols]
    print("  " + "  ".join(str(c).ljust(w) for c, w in zip(cols, widths)))
    for r in rows:
        print("  " + "  ".join(str(r[c]).ljust(w) for c, w in zip(cols, widths)))


def cmd_stats(args):
    with db.connect() as conn:
        for title, rows in db.stats(conn).items():
            print(f"\n{title.replace('_', ' ')}")
            _table(rows)


def cmd_export(args):
    with db.connect() as conn:
        rows = db.export_rows(conn, args.destination, args.category)
    out = open(args.output, "w", newline="", encoding="utf-8") if args.output else sys.stdout
    writer = csv.DictWriter(out, fieldnames=db.EXPORT_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    if args.output:
        out.close()
        print(f"{len(rows)} providers -> {args.output}")


def cmd_set_status(args):
    with db.connect() as conn:
        row = conn.execute("select status from provider where id = %s", (args.provider_id,)).fetchone()
        if not row:
            sys.exit(f"no provider {args.provider_id}")
        conn.execute("update provider set status = %s, updated_at = now() where id = %s",
                     (args.status, args.provider_id))
        conn.execute("""insert into pipeline_event (provider_id, from_status, to_status, by, note)
                        values (%s, %s, %s, %s, %s)""",
                     (args.provider_id, row["status"], args.status, args.by, args.note))
        conn.commit()
    print(f"{args.provider_id}: {row['status']} -> {args.status}")


def cmd_purge_expired(args):
    with db.connect() as conn:
        n = db.purge_expired(conn)
    print(f"purged {n} expired cached records; run `resolve` to refresh providers")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="trigo-supply", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=cmd_init)

    ingest = sub.add_parser("ingest").add_subparsers(dest="source", required=True)

    o = ingest.add_parser("osm")
    where = o.add_mutually_exclusive_group(required=True)
    where.add_argument("--destination")
    where.add_argument("--state", nargs="+", metavar="CODE")
    where.add_argument("--all-states", action="store_true")
    o.add_argument("--no-names", action="store_true", help="tag matches only, skip name keywords")
    o.add_argument("--pause", type=float, default=10.0, help="seconds between state queries")
    o.add_argument("--print-query", action="store_true", help="print Overpass QL and exit")
    o.set_defaults(func=cmd_ingest_osm)

    c = ingest.add_parser("csv")
    c.add_argument("file")
    c.add_argument("--mapping", required=True,
                   help=f"name of a mapping in {CONFIG_DIR / 'mappings'} (without .yaml)")
    c.set_defaults(func=cmd_ingest_csv)

    g = ingest.add_parser("google")
    g.add_argument("--destination", required=True)
    g.add_argument("--query", required=True)
    g.add_argument("--category", help="leaf category to tag results with")
    g.set_defaults(func=cmd_ingest_google)

    sub.add_parser("resolve").set_defaults(func=cmd_resolve)
    sub.add_parser("stats").set_defaults(func=cmd_stats)

    e = sub.add_parser("export")
    e.add_argument("--destination")
    e.add_argument("--category")
    e.add_argument("-o", "--output")
    e.set_defaults(func=cmd_export)

    s = sub.add_parser("set-status")
    s.add_argument("provider_id")
    s.add_argument("status", choices=list(db.STATUS_RANK))
    s.add_argument("--by")
    s.add_argument("--note")
    s.set_defaults(func=cmd_set_status)

    sub.add_parser("purge-expired").set_defaults(func=cmd_purge_expired)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
