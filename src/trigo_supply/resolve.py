"""Entity resolution: many raw records -> one provider per real business.

Two records are the same business when either
  * they share a strong key (phone, email, website host, Instagram handle) and
    are within STRONG_KEY_MAX_KM of each other (or one has no location), or
  * they are within NAME_MAX_KM and their names are near-identical, or
  * one has no location, they are in the same state, and their folded names
    are identical and at least two words long (registry rows rarely carry
    coordinates).
Clusters are the transitive closure (union-find).
"""

import math
from collections import defaultdict
from dataclasses import dataclass

from rapidfuzz import fuzz

from . import normalize
from .records import RawRecord

STRONG_KEY_MAX_KM = 25.0
STRONG_KEY_MAX_GROUP = 50      # a number shared by more records than this is a call centre
NAME_MAX_KM = 0.3
NAME_CLOSE_KM = 0.075
NAME_RATIO = 90
NAME_RATIO_CLOSE = 80
GRID = 0.01                    # ~1.1 km cells for neighbour search


def haversine_km(a: RawRecord, b: RawRecord) -> float:
    lat1, lng1, lat2, lng2 = map(math.radians, (a.lat, a.lng, b.lat, b.lng))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2)
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _has_geo(r: RawRecord) -> bool:
    return r.lat is not None and r.lng is not None


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, i: int, j: int):
        ri, rj = self.find(i), self.find(j)
        if ri != rj:
            self.parent[max(ri, rj)] = min(ri, rj)


def cluster(records: list[RawRecord]) -> list[list[RawRecord]]:
    uf = _UnionFind(len(records))

    # 1. Strong keys.
    for attr in ("phone", "email", "website", "instagram"):
        groups = defaultdict(list)
        for i, r in enumerate(records):
            value = getattr(r, attr)
            if value:
                groups[value].append(i)
        for members in groups.values():
            if len(members) < 2 or len(members) > STRONG_KEY_MAX_GROUP:
                continue
            for x in range(len(members)):
                for y in range(x + 1, len(members)):
                    a, b = records[members[x]], records[members[y]]
                    if not (_has_geo(a) and _has_geo(b)) or haversine_km(a, b) <= STRONG_KEY_MAX_KM:
                        uf.union(members[x], members[y])

    keys = [normalize.name_key(r.name) for r in records]

    # 2. Fuzzy names among nearby records.
    grid = defaultdict(list)
    for i, r in enumerate(records):
        if _has_geo(r) and keys[i]:
            grid[(math.floor(r.lat / GRID), math.floor(r.lng / GRID))].append(i)
    for (gx, gy), members in grid.items():
        neighbours = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in grid.get((gx + dx, gy + dy), [])]
        for i in members:
            for j in neighbours:
                if j <= i or uf.find(i) == uf.find(j):
                    continue
                d = haversine_km(records[i], records[j])
                if d > NAME_MAX_KM:
                    continue
                ratio = fuzz.token_sort_ratio(keys[i], keys[j])
                if ratio >= NAME_RATIO or (ratio >= NAME_RATIO_CLOSE and d <= NAME_CLOSE_KM):
                    uf.union(i, j)

    # 3. Exact names within a state when a side has no location.
    by_name = defaultdict(list)
    for i, r in enumerate(records):
        if r.state and len(keys[i].split()) >= 2:
            by_name[(r.state, keys[i])].append(i)
    for members in by_name.values():
        located = [i for i in members if _has_geo(records[i])]
        unlocated = [i for i in members if not _has_geo(records[i])]
        if not unlocated or len(located) > 1:
            continue  # several located namesakes: ambiguous, leave for review
        anchor = located[0] if located else unlocated[0]
        for i in unlocated:
            uf.union(anchor, i)

    clusters = defaultdict(list)
    for i, r in enumerate(records):
        clusters[uf.find(i)].append(r)
    return list(clusters.values())


@dataclass
class Destination:
    id: str
    bbox: list[float]   # [s, w, n, e]

    @property
    def area(self) -> float:
        s, w, n, e = self.bbox
        return (n - s) * (e - w)

    def contains(self, lat: float, lng: float) -> bool:
        s, w, n, e = self.bbox
        return s <= lat <= n and w <= lng <= e


def assign_destination(lat, lng, destinations: list[Destination]) -> str | None:
    if lat is None or lng is None:
        return None
    hits = [d for d in destinations if d.contains(lat, lng)]
    return min(hits, key=lambda d: d.area).id if hits else None


AUTHORITATIVE_KINDS = {"registry", "association", "field"}


def merge(cluster_records: list[RawRecord], category_order: list[str],
          destinations: list[Destination], source_kinds: dict[str, str]) -> dict:
    """Provider fields from a cluster: each field from the most trusted source that has it."""
    ranked = sorted(cluster_records, key=lambda r: -r.trust)

    def pick(attr):
        return next((getattr(r, attr) for r in ranked if getattr(r, attr)), None)

    located = next((r for r in ranked if _has_geo(r)), None)
    cats = {c for r in ranked for c in r.categories}
    sources = {r.source_id for r in ranked}
    provider = {
        "name": pick("name"),
        "phone": pick("phone"),
        "email": pick("email"),
        "website": pick("website"),
        "instagram": pick("instagram"),
        "address": pick("address"),
        "state": pick("state"),
        "lat": located.lat if located else None,
        "lng": located.lng if located else None,
        "categories": [c for c in category_order if c in cats],
        "source_count": len(sources),
    }
    provider["destination_id"] = assign_destination(provider["lat"], provider["lng"], destinations)
    provider["quality_score"] = quality_score(provider, sources, source_kinds)
    return provider


def quality_score(provider: dict, sources: set[str], source_kinds: dict[str, str]) -> int:
    """0-100 completeness/corroboration score for prioritising outreach."""
    score = 0
    score += 20 if provider["phone"] else 0
    score += 10 if provider["email"] else 0
    score += 10 if provider["website"] else 0
    score += 10 if provider["instagram"] else 0
    score += 10 if provider["lat"] is not None else 0
    score += min(20, 10 * (len(sources) - 1))
    score += 20 if any(source_kinds.get(s) in AUTHORITATIVE_KINDS for s in sources) else 0
    return min(score, 100)
