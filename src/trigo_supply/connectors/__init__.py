"""Source connectors. Each returns RawRecords; none writes to the database."""

# Default trust per source (0-100): higher wins when merged fields conflict.
SOURCES = {
    "field":           {"name": "Yuvoy field team", "kind": "field", "trust": 95,
                        "licence": "own collection"},
    "tourism_registry": {"name": "State/central tourism registries", "kind": "registry", "trust": 90,
                        "licence": "government publication"},
    "padi":            {"name": "PADI dive centre locator", "kind": "association", "trust": 85,
                        "licence": "public directory; facts only"},
    "atoai":           {"name": "ATOAI member directory", "kind": "association", "trust": 80,
                        "licence": "public directory; facts only"},
    "google_places":   {"name": "Google Places API", "kind": "map", "trust": 60,
                        "licence": "Google Maps Platform terms; cached content expires"},
    "osm":             {"name": "OpenStreetMap", "kind": "map", "trust": 50,
                        "licence": "ODbL, (c) OpenStreetMap contributors"},
    "instagram":       {"name": "Instagram research", "kind": "social", "trust": 40,
                        "licence": "manual research; public profile facts only"},
    "marketplace":     {"name": "Marketplace observations", "kind": "marketplace", "trust": 30,
                        "licence": "observations only; no listing content"},
}
