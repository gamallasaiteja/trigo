"""Canonical forms for the fields used to match records across sources."""

import re
import unicodedata
from urllib.parse import urlparse

import phonenumbers

# Domains that identify a platform, not a business: never a match key.
PLATFORM_DOMAINS = {
    "facebook.com", "fb.com", "instagram.com", "google.com", "goo.gl", "g.page",
    "maps.app.goo.gl", "wa.me", "whatsapp.com", "youtube.com", "linktr.ee",
    "tripadvisor.com", "tripadvisor.in", "thrillophilia.com", "traveltriangle.com",
    "klook.com", "airbnb.com", "airbnb.co.in", "justdial.com", "booking.com",
    "makemytrip.com", "goibibo.com", "x.com", "twitter.com", "linkedin.com",
    "blogspot.com", "wordpress.com", "wixsite.com", "business.site",
}

LEGAL_SUFFIXES = re.compile(
    r"\b(pvt|private|ltd|limited|llp|inc|co|company|opc|the)\b\.?", re.IGNORECASE
)


def phone(raw: str | None, region: str = "IN") -> str | None:
    """E.164 for the first valid number in the string, else None."""
    if not raw:
        return None
    for chunk in re.split(r"[;,/|]", raw):
        try:
            num = phonenumbers.parse(chunk.strip(), region)
        except phonenumbers.NumberParseException:
            continue
        if phonenumbers.is_valid_number(num):
            return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
    return None


def email(raw: str | None) -> str | None:
    if not raw:
        return None
    match = re.search(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", raw)
    return match.group(0).lower() if match else None


def website(raw: str | None) -> str | None:
    """Registrable host without 'www.', or None for platform links."""
    if not raw:
        return None
    raw = raw.strip()
    if "://" not in raw:
        raw = "http://" + raw
    host = (urlparse(raw).hostname or "").lower()
    host = host.removeprefix("www.")
    if not host or "." not in host:
        return None
    if host in PLATFORM_DOMAINS or any(host.endswith("." + d) for d in PLATFORM_DOMAINS):
        return None
    return host


def instagram(raw: str | None) -> str | None:
    """Lowercase handle from '@handle', a bare handle, or an instagram.com URL."""
    if not raw:
        return None
    raw = raw.strip()
    match = re.search(r"instagram\.com/([A-Za-z0-9_.]+)", raw)
    handle = match.group(1) if match else raw.lstrip("@")
    handle = handle.strip("/").lower()
    if not re.fullmatch(r"[a-z0-9_.]{1,30}", handle) or handle in {"p", "reel", "explore"}:
        return None
    return handle


def name_key(raw: str | None) -> str:
    """Name folded for fuzzy comparison: ASCII, lowercase, no legal suffixes or punctuation."""
    if not raw:
        return ""
    text = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ")
    text = LEGAL_SUFFIXES.sub(" ", text)
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()
