from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawRecord:
    """One source's view of one business, before resolution."""

    source_id: str
    external_id: str
    name: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    instagram: str | None = None
    address: str | None = None
    state: str | None = None
    categories: list[str] = field(default_factory=list)
    payload: dict = field(default_factory=dict)
    expires_at: datetime | None = None
    # Set when loaded back from the database.
    id: int | None = None
    trust: int = 50
