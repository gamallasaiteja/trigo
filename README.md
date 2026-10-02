# trigo: Yuvoy supply database

An India-wide database of experience providers (dive shops, trek operators,
cooking classes, pottery studios, everything in `config/taxonomy.yaml`), built
from many sources and merged into one record per real business.

It holds two layers on purpose:

| Layer | Table | What it is |
|---|---|---|
| Lead universe | `raw_record` → `provider` | Every operator any source knows about. Broad, automated, national. |
| Verified supply | `provider` with status `audited` → `live`, plus `audit`, `licence`, `experience`, `media` | Operators who passed the audit, signed and filmed. One destination at a time. |

## Setup

Requires Python 3.11+ and Postgres with PostGIS (Supabase works; enable the
`postgis` extension).

```bash
pip install -e ".[dev]"
cp .env.example .env            # set DATABASE_URL
export $(cat .env | xargs)
trigo-supply init               # tables + sources, categories, destinations
```

## Building the database

```bash
# 1. Bulk base layer from OpenStreetMap: one destination, a state, or all of India
trigo-supply ingest osm --destination havelock
trigo-supply ingest osm --state IN-AN IN-GA
trigo-supply ingest osm --all-states            # 36 queries, ~10 s apart

# 2. Authoritative lists through a column mapping (config/mappings/*.yaml)
trigo-supply ingest csv an_water_sports_permits.csv --mapping tourism_registry
trigo-supply ingest csv padi_india.csv --mapping padi
trigo-supply ingest csv field_responses.csv --mapping field_form

# 3. Optional, billed: Google Places for coverage gaps
trigo-supply ingest google --destination havelock --query "scuba diving" --category scuba_diving

# 4. Merge everything into providers (safe to re-run any time)
trigo-supply resolve

# 5. Look at it
trigo-supply stats
trigo-supply export --destination havelock --category scuba_diving -o exports/havelock_dive.csv
```

Moving a provider through the pipeline (logged in `pipeline_event`):

```bash
trigo-supply set-status <provider-id> contacted --by rahul --note "WhatsApp intro"
```

The statuses are `lead → contacted → met → audited → signed → filmed → live`,
plus `rejected` and `dormant`.

## How merging works

`resolve` re-clusters every raw record each time it runs (`src/trigo_supply/resolve.py`):

- **Same strong key:** records sharing a phone, email, website or Instagram handle
  within 25 km are one business. A number shared by more than 50 records is
  treated as a call centre and ignored.
- **Same name, same place:** near-identical names within 300 m merge (looser
  within 75 m).
- **Registry rows without coordinates:** these join a located record with an
  identical name in the same state, but only when the match is unambiguous.

Each field comes from the most trusted source that has it: field team 95,
registries 90, PADI 85, ATOAI 80, Google 60, OSM 50, Instagram 40, marketplaces 30.
Provider ids are stable across runs. The provider furthest along the pipeline
keeps its id. Set `locked = true` on a provider to stop re-resolution from
overwriting fields the team has corrected by hand.

Each provider gets the smallest destination box that contains it, so Havelock
wins over Andaman. The `destination_density` view gives the destination ×
category heatmap used to choose the next destination.

## Sources and their rules

| Source | How to get it | Terms |
|---|---|---|
| OpenStreetMap | `ingest osm` | ODbL. Attribute "© OpenStreetMap contributors"; a published derived DB stays ODbL. For repeated national runs, self-host Overpass (`OVERPASS_URL`) or use a Geofabrik India extract. |
| Tourism registries | Ministry of Tourism approved operators, NIDHI, state adventure-tourism registrations, A&N water-sports permits → CSV | Government publications |
| PADI / SSI, ATOAI | Public directories → CSV | Facts only (name, contact, location) |
| Google Places | `ingest google` (`GOOGLE_MAPS_API_KEY`) | Cached content expires after 30 days; run `purge-expired` on a schedule. Only the place id is kept. |
| Instagram, marketplaces | Manual research sheets → CSV | Leads, prices and review counts as observations. Never copy listing content. |
| Field team | Google Form → CSV (`field_form` mapping) | Own collection |

Personal data: provider contact details fall under India's DPDP Act 2023.
Record the basis for holding them in `contact_consent` and honour opt-outs.

## Tests

```bash
pytest                                                   # unit tests
TEST_DATABASE_URL=postgresql://.../trigo_test pytest     # + Postgres/PostGIS integration (drops tables!)
```

## Layout

```
config/taxonomy.yaml        9 groups, 36 categories, OSM tags + name keywords
config/destinations.yaml    38 destination clusters + 36 states/UTs
config/mappings/            CSV column mappings per source
db/migrations/              Postgres + PostGIS schema
src/trigo_supply/           connectors, normalisation, resolution, CLI
```
