"""Import any tabular list through a column mapping.

One mapping file per source: state tourism registries, Ministry of Tourism
approved operators, ATOAI members, PADI/SSI centre lists, field-team Google
Form exports, Instagram research sheets. See config/mappings/.
"""

import csv
import hashlib

from .. import normalize
from ..records import RawRecord
from ..taxonomy import Taxonomy

FIELDS = ("external_id", "name", "lat", "lng", "phone", "email", "website",
          "instagram", "address", "state", "categories")


def _float(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def load(path: str, mapping: dict, taxonomy: Taxonomy) -> list[RawRecord]:
    """mapping: {source_id, columns: {field: csv column}, defaults: {field: value}}."""
    columns = mapping.get("columns", {})
    defaults = mapping.get("defaults", {})
    unknown = set(columns) - set(FIELDS)
    if unknown:
        raise ValueError(f"unknown mapped fields: {sorted(unknown)}")

    records = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            get = lambda field: (row.get(columns[field]) if field in columns else None) or defaults.get(field)
            name = (get("name") or "").strip()
            if not name:
                continue
            external_id = get("external_id") or hashlib.sha1(
                f"{name}|{get('phone') or ''}|{get('address') or ''}".encode()).hexdigest()[:16]
            declared = get("categories")
            declared = [c.strip() for c in str(declared).split(";")] if declared else []
            categories = [c for c in declared if c in taxonomy.leaf_ids]
            categories += [c for c in taxonomy.classify(name=name) if c not in categories]
            records.append(RawRecord(
                source_id=mapping["source_id"],
                external_id=str(external_id),
                name=name,
                lat=_float(get("lat")),
                lng=_float(get("lng")),
                phone=normalize.phone(get("phone")),
                email=normalize.email(get("email")),
                website=normalize.website(get("website")),
                instagram=normalize.instagram(get("instagram")),
                address=get("address"),
                state=get("state"),
                categories=categories,
                payload={"row": row},
            ))
    return records
