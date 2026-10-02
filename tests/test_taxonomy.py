from trigo_supply.taxonomy import load_taxonomy

tax = load_taxonomy()


def test_osm_tags_map_to_leaves():
    assert tax.classify({"shop": "scuba_diving"}) == ["scuba_diving"]
    assert tax.classify({"tourism": "camp_site"}) == ["camping"]


def test_multi_valued_osm_tags():
    assert set(tax.classify({"sport": "snorkelling;canoe"})) == {"snorkelling", "water_sports"}


def test_wildcard_matcher():
    assert tax.classify({"whitewater": "put_in"}) == ["rafting"]


def test_name_keywords_are_whole_words():
    assert tax.classify(name="Himalayan Trekking Co") == ["trekking"]
    assert tax.classify(name="Island Super Market") == []   # 'sup' must not match 'Super'


def test_leaf_ids_unique():
    ids = [c.id for c in tax.leaves]
    assert len(ids) == len(set(ids))
