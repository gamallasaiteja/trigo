import json
from pathlib import Path

from trigo_supply.config import load_yaml
from trigo_supply.connectors import csv_import, osm
from trigo_supply.taxonomy import load_taxonomy

FIXTURES = Path(__file__).parent / "fixtures"
tax = load_taxonomy()


def test_build_query_by_state_and_bbox():
    q = osm.build_query(tax, state_codes=["IN-UK", "IN-UT"])
    assert 'area["ISO3166-2"~"^(IN-UK|IN-UT)$"]->.a;' in q
    assert 'nwr["shop"="scuba_diving"](area.a);' in q
    assert 'nwr["whitewater"](area.a);' in q
    assert q.rstrip().endswith("out center tags;")

    q = osm.build_query(tax, bbox=[11.93, 92.93, 12.08, 93.07], include_names=False)
    assert 'nwr["shop"="scuba_diving"](11.93,92.93,12.08,93.07);' in q
    assert '"name"~' not in q


def test_ere_escape():
    assert osm._ere_escape("IN-AN") == "IN-AN"
    assert osm._ere_escape("tours and travels") == "tours and travels"
    assert osm._ere_escape("a.b(c)") == "a\\\\.b\\\\(c\\\\)"


def test_parse_overpass_fixture():
    data = json.loads((FIXTURES / "overpass_havelock.json").read_text())
    records = {r.external_id: r for r in osm.parse(data, tax, state="IN-AN")}
    # supermarket (no category) and unnamed dive shop are dropped
    assert set(records) == {"node/101", "way/202", "node/303"}
    dive = records["node/101"]
    assert dive.phone == "+919434211111"
    assert dive.website == "coralgardendivers.example"
    assert dive.categories == ["scuba_diving"]
    assert dive.state == "IN-AN"
    camp = records["way/202"]
    assert (camp.lat, camp.lng) == (12.0102, 92.9701)          # way centre
    kayak = records["node/303"]
    assert kayak.instagram == "lagoonkayak"
    assert set(kayak.categories) >= {"snorkelling", "water_sports", "boat_tours"}


def test_csv_import_with_mapping():
    mapping = load_yaml("mappings/field_form.yaml")
    records = csv_import.load(str(FIXTURES / "field_form.csv"), mapping, tax)
    assert [r.external_id for r in records] == ["f-1", "f-2"]
    first = records[0]
    assert first.source_id == "field"
    assert first.phone == "+919434211111"
    assert first.instagram == "coralgardendivers"
    assert first.lat is None
    assert first.categories[:2] == ["scuba_diving", "snorkelling"]
    assert records[1].categories == ["boat_tours"]
