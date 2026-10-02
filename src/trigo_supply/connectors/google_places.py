"""Optional: Google Places API (New) Text Search, for discovery and enrichment.

Google Maps Platform terms allow keeping the place ID indefinitely but limit
caching of other content. Every record from here carries expires_at
(CACHE_DAYS ahead); `trigo-supply purge-expired` strips everything but the
place ID once it passes. Check the current terms before relying on this.
Needs GOOGLE_MAPS_API_KEY; billed per request.
"""

import os
from datetime import datetime, timedelta, timezone

import requests

from .. import normalize
from ..records import RawRecord
from ..taxonomy import Taxonomy

SOURCE_ID = "google_places"
ENDPOINT = "https://places.googleapis.com/v1/places:searchText"
CACHE_DAYS = 30
FIELD_MASK = ",".join([
    "places.id", "places.displayName", "places.location", "places.formattedAddress",
    "places.internationalPhoneNumber", "places.websiteUri", "places.types", "nextPageToken",
])


def search(query: str, bbox: list[float], taxonomy: Taxonomy, *,
           category: str | None = None, max_pages: int = 3,
           api_key: str | None = None) -> list[RawRecord]:
    api_key = api_key or os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not set")
    s, w, n, e = bbox
    body = {
        "textQuery": query,
        "locationRestriction": {"rectangle": {
            "low": {"latitude": s, "longitude": w},
            "high": {"latitude": n, "longitude": e},
        }},
        "pageSize": 20,
    }
    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}
    expires = datetime.now(timezone.utc) + timedelta(days=CACHE_DAYS)

    records = []
    for _ in range(max_pages):
        resp = requests.post(ENDPOINT, json=body, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        for place in data.get("places", []):
            name = place.get("displayName", {}).get("text")
            categories = taxonomy.classify(name=name)
            if category and category not in categories:
                categories.insert(0, category)
            loc = place.get("location", {})
            records.append(RawRecord(
                source_id=SOURCE_ID,
                external_id=place["id"],
                name=name,
                lat=loc.get("latitude"),
                lng=loc.get("longitude"),
                phone=normalize.phone(place.get("internationalPhoneNumber")),
                website=normalize.website(place.get("websiteUri")),
                address=place.get("formattedAddress"),
                categories=categories,
                payload={"types": place.get("types", []), "query": query},
                expires_at=expires,
            ))
        token = data.get("nextPageToken")
        if not token:
            break
        body["pageToken"] = token
    return records
