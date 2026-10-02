"""Integration tests against a real Postgres + PostGIS.

Set TEST_DATABASE_URL to a disposable database; every table is dropped first.
"""

import json
import os
from pathlib import Path

import pytest

from trigo_supply import db
from trigo_supply.config import load_yaml
from trigo_supply.connectors import csv_import, osm
from trigo_supply.records import RawRecord
from trigo_supply.taxonomy import load_taxonomy

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")
FIXTURES = Path(__file__).parent / "fixtures"
TABLES = ("contact_consent competitor_listing media experience pipeline_event audit licence "
          "provider_source provider raw_record destination category source").split()


@pytest.fixture
def conn():
    with db.connect(DSN) as c:
        c.execute("drop view if exists destination_density")
        for t in TABLES:
            c.execute(f"drop table if exists {t} cascade")
        c.commit()
        db.migrate(c)
        db.seed(c)
        yield c


def ingest_fixtures(conn):
    tax = load_taxonomy()
    data = json.loads((FIXTURES / "overpass_havelock.json").read_text())
    db.upsert_raw(conn, osm.parse(data, tax, state="IN-AN"))
    db.upsert_raw(conn, csv_import.load(str(FIXTURES / "field_form.csv"),
                                        load_yaml("mappings/field_form.yaml"), tax))


def provider_by_name(conn, name):
    return conn.execute("select * from provider where name = %s", (name,)).fetchone()


def test_seed_is_idempotent(conn):
    db.seed(conn)
    n_dest = conn.execute("select count(*) as n from destination").fetchone()["n"]
    assert n_dest == len(load_yaml("destinations.yaml")["destinations"])
    groups = conn.execute("select count(*) as n from category where parent_id is null").fetchone()["n"]
    assert groups == len(load_taxonomy().groups)


def test_resolve_merges_osm_and_field_records(conn):
    ingest_fixtures(conn)
    result = db.resolve_providers(conn)
    assert result["raw_records"] == 5
    assert result["providers"] == 4      # Coral Garden OSM + field row merge

    coral = provider_by_name(conn, "Coral Garden Divers Pvt Ltd")   # field name wins (trust 95)
    assert coral["source_count"] == 2
    assert coral["destination_id"] == "havelock"
    assert coral["email"] == "hello@coralgardendivers.example"
    assert coral["website"] == "coralgardendivers.example"
    assert coral["categories"] == ["scuba_diving", "snorkelling"]

    density = conn.execute("""select providers from destination_density
                              where destination_id = 'havelock' and category = 'scuba_diving'""").fetchone()
    assert density["providers"] == 1


def test_reresolve_keeps_ids_status_and_locked_fields(conn):
    ingest_fixtures(conn)
    db.resolve_providers(conn)
    coral = provider_by_name(conn, "Coral Garden Divers Pvt Ltd")
    camp = provider_by_name(conn, "Beach Nest Camp")
    conn.execute("update provider set status = 'signed' where id = %s", (coral["id"],))
    conn.execute("update provider set locked = true, name = 'Beach Nest Glamping' where id = %s",
                 (camp["id"],))
    conn.commit()

    # A new source corroborates Coral Garden by phone; re-resolve.
    db.upsert_raw(conn, [RawRecord(source_id="padi", external_id="S-1", name="Coral Garden Divers",
                                   phone="+919434211111", state="IN-AN", categories=["scuba_diving"])])
    result = db.resolve_providers(conn)
    assert result["created"] == 0

    again = conn.execute("select * from provider where id = %s", (coral["id"],)).fetchone()
    assert again["status"] == "signed"
    assert again["source_count"] == 3
    assert conn.execute("select name from provider where id = %s",
                        (camp["id"],)).fetchone()["name"] == "Beach Nest Glamping"


def test_orphaned_leads_are_deleted_but_progressed_providers_kept(conn):
    db.upsert_raw(conn, [
        RawRecord(source_id="osm", external_id="n/1", name="Gone Lead", lat=12.0, lng=92.98),
        RawRecord(source_id="osm", external_id="n/2", name="Gone Signed", lat=12.01, lng=92.97),
    ])
    db.resolve_providers(conn)
    conn.execute("update provider set status = 'met' where name = 'Gone Signed'")
    conn.execute("delete from raw_record")
    conn.commit()
    result = db.resolve_providers(conn)
    assert result["deleted"] == 1 and result["orphaned_kept"] == 1
    assert provider_by_name(conn, "Gone Signed") is not None


def test_purge_expired_strips_cached_content(conn):
    from datetime import datetime, timedelta, timezone
    past = datetime.now(timezone.utc) - timedelta(days=1)
    db.upsert_raw(conn, [RawRecord(source_id="google_places", external_id="ChIJx", name="Cached",
                                   lat=12.0, lng=92.98, phone="+919876543210", expires_at=past)])
    assert db.purge_expired(conn) == 1
    row = conn.execute("select name, phone, geom from raw_record where external_id = 'ChIJx'").fetchone()
    assert row == {"name": None, "phone": None, "geom": None}
    assert db.load_raw(conn) == []


def test_export_filters(conn):
    ingest_fixtures(conn)
    db.resolve_providers(conn)
    rows = db.export_rows(conn, destination="havelock", category="scuba_diving")
    assert [r["name"] for r in rows] == ["Coral Garden Divers Pvt Ltd"]
    assert rows[0]["lat"] == pytest.approx(12.0331)
    assert len(db.export_rows(conn)) == 4
