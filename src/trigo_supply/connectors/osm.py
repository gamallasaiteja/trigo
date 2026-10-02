"""OpenStreetMap via the Overpass API.

OSM data is ODbL: storing and reusing it is allowed with attribution
("© OpenStreetMap contributors"), and a published derived database must stay
under ODbL. Respect the public Overpass usage policy (one query at a time,
identify yourself); for repeated India-wide runs, host Overpass or load a
Geofabrik India extract instead.
"""

import os
import re
import time

import requests

from .. import normalize
from ..records import RawRecord
from ..taxonomy import Taxonomy

SOURCE_ID = "osm"
DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter"
USER_AGENT = "yuvoy-supply/0.1 (+https://yuvoy.in)"

# Keys a named business POI carries; name-keyword search is limited to these
# so a road called "Scuba Street" is not picked up.
POI_KEYS = ("shop", "office", "tourism", "amenity", "leisure", "craft", "sport", "club")


def _ere_escape(text: str) -> str:
    """Escape POSIX ERE metacharacters for an Overpass regex inside a QL string."""
    return re.sub(r'([.^$*+?()\[\]{}|\\"])', r"\\\\\1", text)


def _area_filter(state_codes: list[str] | None, bbox: list[float] | None) -> tuple[str, str]:
    """(prelude, filter) for an ISO 3166-2 area or a [s, w, n, e] box."""
    if state_codes:
        codes = "|".join(_ere_escape(c) for c in state_codes)
        return f'area["ISO3166-2"~"^({codes})$"]->.a;\n', "(area.a)"
    if bbox:
        s, w, n, e = bbox
        return "", f"({s},{w},{n},{e})"
    raise ValueError("need state_codes or bbox")


def build_query(taxonomy: Taxonomy, *, state_codes=None, bbox=None,
                include_names: bool = True, timeout: int = 600) -> str:
    prelude, area = _area_filter(state_codes, bbox)
    lines = []
    for key, value in taxonomy.osm_matchers():
        selector = f'["{key}"]' if value == "*" else f'["{key}"="{value}"]'
        lines.append(f"  nwr{selector}{area};")
    if include_names:
        words = sorted({kw for leaf in taxonomy.leaves for kw in leaf.keywords})
        regex = "|".join(_ere_escape(w) for w in words)
        for key in POI_KEYS:
            lines.append(f'  nwr["{key}"]["name"~"{regex}",i]{area};')
    body = "\n".join(lines)
    return f"[out:json][timeout:{timeout}];\n{prelude}(\n{body}\n);\nout center tags;"


def fetch(query: str, endpoint: str | None = None, retries: int = 4) -> dict:
    endpoint = endpoint or os.environ.get("OVERPASS_URL", DEFAULT_ENDPOINT)
    delay = 30
    for attempt in range(retries + 1):
        resp = requests.post(endpoint, data={"data": query},
                             headers={"User-Agent": USER_AGENT}, timeout=900)
        if resp.status_code in (429, 504) and attempt < retries:
            time.sleep(delay)
            delay *= 2
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("unreachable")


def _first(tags: dict, *keys: str) -> str | None:
    for k in keys:
        if tags.get(k):
            return tags[k]
    return None


def _address(tags: dict) -> str | None:
    if tags.get("addr:full"):
        return tags["addr:full"]
    parts = [tags.get(k) for k in ("addr:housenumber", "addr:street", "addr:suburb",
                                    "addr:city", "addr:postcode")]
    parts = [p for p in parts if p]
    return ", ".join(parts) or None


def parse(data: dict, taxonomy: Taxonomy, state: str | None = None) -> list[RawRecord]:
    records = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = _first(tags, "name:en", "name")
        if not name:
            continue  # unnamed POIs can't be contacted or matched
        categories = taxonomy.classify(tags, name)
        if not categories:
            continue
        lat = el.get("lat", el.get("center", {}).get("lat"))
        lng = el.get("lon", el.get("center", {}).get("lon"))
        records.append(RawRecord(
            source_id=SOURCE_ID,
            external_id=f"{el['type']}/{el['id']}",
            name=name,
            lat=lat,
            lng=lng,
            phone=normalize.phone(_first(tags, "contact:phone", "phone", "contact:mobile", "mobile")),
            email=normalize.email(_first(tags, "contact:email", "email")),
            website=normalize.website(_first(tags, "contact:website", "website", "url")),
            instagram=normalize.instagram(tags.get("contact:instagram")),
            address=_address(tags),
            state=state,
            categories=categories,
            payload={"tags": tags},
        ))
    return records
