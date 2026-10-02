from trigo_supply.records import RawRecord
from trigo_supply.resolve import Destination, assign_destination, cluster, merge

HAVELOCK = (12.0331, 92.9857)


def rec(ext, name, lat=None, lng=None, source="osm", trust=50, **kw):
    return RawRecord(source_id=source, external_id=ext, name=name, lat=lat, lng=lng, trust=trust, **kw)


def groups(records):
    return sorted(sorted(r.external_id for r in c) for c in cluster(records))


def test_shared_phone_merges_across_sources():
    rs = [rec("a", "Coral Garden Divers", *HAVELOCK, phone="+919434211111"),
          rec("b", "CGD Scuba", 12.04, 92.99, source="field", phone="+919434211111")]
    assert groups(rs) == [["a", "b"]]


def test_shared_phone_far_apart_is_not_merged():
    rs = [rec("a", "Branch One", *HAVELOCK, phone="+919434211111"),
          rec("b", "Branch Two", 15.5, 73.8, phone="+919434211111")]   # Goa
    assert groups(rs) == [["a"], ["b"]]


def test_call_centre_numbers_are_ignored():
    rs = [rec(str(i), f"Agency {i}", None, None, phone="+918000000000") for i in range(60)]
    assert len(cluster(rs)) == 60


def test_near_identical_names_nearby_merge():
    rs = [rec("a", "Coral Garden Divers", *HAVELOCK),
          rec("b", "Coral Garden Divers Pvt Ltd", 12.0335, 92.9860)]
    assert groups(rs) == [["a", "b"]]


def test_different_names_nearby_stay_apart():
    rs = [rec("a", "Coral Garden Divers", *HAVELOCK),
          rec("b", "Blue Lagoon Scuba", 12.0332, 92.9858)]
    assert groups(rs) == [["a"], ["b"]]


def test_same_name_in_different_towns_stays_apart():
    rs = [rec("a", "Dolphin Divers", *HAVELOCK),
          rec("b", "Dolphin Divers", 11.83, 93.03)]     # Neil
    assert groups(rs) == [["a"], ["b"]]


def test_unlocated_registry_row_joins_by_exact_name_in_state():
    rs = [rec("a", "Coral Garden Divers", *HAVELOCK, state="IN-AN"),
          rec("b", "Coral Garden Divers Pvt Ltd", source="tourism_registry", trust=90, state="IN-AN"),
          rec("c", "Coral Garden Divers", source="tourism_registry", trust=90, state="IN-GA")]
    assert groups(rs) == [["a", "b"], ["c"]]


def test_ambiguous_namesakes_are_left_for_review():
    rs = [rec("a", "Dolphin Divers", *HAVELOCK, state="IN-AN"),
          rec("b", "Dolphin Divers", 11.83, 93.03, state="IN-AN"),
          rec("c", "Dolphin Divers", state="IN-AN")]
    assert groups(rs) == [["a"], ["b"], ["c"]]


DESTS = [Destination("andaman", [10.5, 92.2, 13.7, 93.1]),
         Destination("havelock", [11.93, 92.93, 12.08, 93.07])]


def test_smallest_containing_destination_wins():
    assert assign_destination(*HAVELOCK, DESTS) == "havelock"
    assert assign_destination(11.65, 92.72, DESTS) == "andaman"
    assert assign_destination(15.5, 73.8, DESTS) is None
    assert assign_destination(None, None, DESTS) is None


def test_merge_prefers_trusted_sources_and_unions_categories():
    rs = [rec("a", "Coral Garden Dvrs", *HAVELOCK, categories=["scuba_diving"], website="cgd.example"),
          rec("b", "Coral Garden Divers", source="field", trust=95, phone="+919434211111",
              categories=["snorkelling", "scuba_diving"], state="IN-AN")]
    p = merge(rs, ["scuba_diving", "snorkelling"], DESTS, {"osm": "map", "field": "field"})
    assert p["name"] == "Coral Garden Divers"
    assert p["phone"] == "+919434211111"
    assert p["website"] == "cgd.example"
    assert (p["lat"], p["lng"]) == HAVELOCK
    assert p["categories"] == ["scuba_diving", "snorkelling"]
    assert p["destination_id"] == "havelock"
    assert p["source_count"] == 2
    # phone 20 + website 10 + location 10 + 2nd source 10 + field-verified 20
    assert p["quality_score"] == 70
