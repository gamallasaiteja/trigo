import re
from dataclasses import dataclass, field
from functools import lru_cache

from .config import load_yaml


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    parent_id: str | None
    mode: str | None
    kind: str = "operator"
    osm: tuple[str, ...] = ()
    keywords: tuple[str, ...] = ()


@dataclass
class Taxonomy:
    groups: list[Category]
    leaves: list[Category]
    _keyword_patterns: list[tuple[re.Pattern, str]] = field(default_factory=list)

    def __post_init__(self):
        for leaf in self.leaves:
            for kw in leaf.keywords:
                pattern = re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE)
                self._keyword_patterns.append((pattern, leaf.id))

    @property
    def leaf_ids(self) -> set[str]:
        return {c.id for c in self.leaves}

    def osm_matchers(self) -> list[tuple[str, str]]:
        """Distinct (key, value) pairs across all leaves; value '*' means any."""
        seen = []
        for leaf in self.leaves:
            for m in leaf.osm:
                pair = tuple(m.split("=", 1))
                if pair not in seen:
                    seen.append(pair)
        return seen

    def classify(self, tags: dict | None = None, name: str | None = None) -> list[str]:
        """Leaf categories implied by OSM tags and/or a business name, in taxonomy order."""
        tags = tags or {}
        hits = set()
        for leaf in self.leaves:
            for m in leaf.osm:
                key, value = m.split("=", 1)
                tag_value = tags.get(key)
                if tag_value is None:
                    continue
                # OSM multi-values are ';'-separated, e.g. sport=scuba_diving;snorkelling
                if value == "*" or value in tag_value.split(";"):
                    hits.add(leaf.id)
        if name:
            for pattern, leaf_id in self._keyword_patterns:
                if pattern.search(name):
                    hits.add(leaf_id)
        return [c.id for c in self.leaves if c.id in hits]


@lru_cache(maxsize=1)
def load_taxonomy() -> Taxonomy:
    data = load_yaml("taxonomy.yaml")
    groups, leaves = [], []
    for g in data["groups"]:
        groups.append(Category(id=g["id"], name=g["name"], parent_id=None, mode=None, kind="group"))
        for c in g["children"]:
            leaves.append(Category(
                id=c["id"],
                name=c["name"],
                parent_id=g["id"],
                mode=c.get("mode"),
                kind=c.get("kind", "operator"),
                osm=tuple(c.get("osm", [])),
                keywords=tuple(c.get("keywords", [])),
            ))
    return Taxonomy(groups=groups, leaves=leaves)
