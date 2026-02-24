from __future__ import annotations

import asyncio
import csv
from pathlib import Path
from typing import TYPE_CHECKING

import httpx
import structlog
from cachetools import TTLCache

if TYPE_CHECKING:
    import spacy.language

from src.models.event import GeoLocation

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Module-level caches
# ---------------------------------------------------------------------------
_nlp: spacy.language.Language | None = None
_nlp_load_attempted: bool = False
_curated: dict[str, GeoLocation] | None = None
_geocode_cache: TTLCache[str, GeoLocation] = TTLCache(maxsize=2000, ttl=86400)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "ChronoAtlas/0.1 (https://github.com/e-9/chrono-atlas)"
_CURATED_CSV = Path(__file__).resolve().parents[2] / "data" / "historical_places.csv"

_last_nominatim_call: float = 0.0


# ---------------------------------------------------------------------------
# Stage 1 – NER-based place extraction
# ---------------------------------------------------------------------------
def _load_spacy() -> spacy.language.Language | None:
    global _nlp, _nlp_load_attempted  # noqa: PLW0603
    if _nlp_load_attempted:
        return _nlp
    _nlp_load_attempted = True
    try:
        import spacy

        _nlp = spacy.load("en_core_web_sm")
        logger.info("spacy_model_loaded", model="en_core_web_sm")
    except (ImportError, OSError) as exc:
        logger.warning("spacy_model_unavailable", error=str(exc))
        _nlp = None
    return _nlp


def extract_place_name(text: str) -> str | None:
    """Extract the most relevant place name from *text* using spaCy NER with regex fallback."""
    import re

    nlp = _load_spacy()
    if nlp is None:
        return None

    doc = nlp(text)
    gpe_entities: list[str] = []
    loc_entities: list[str] = []
    for ent in doc.ents:
        if ent.label_ == "GPE":
            gpe_entities.append(ent.text)
        elif ent.label_ == "LOC":
            loc_entities.append(ent.text)

    if gpe_entities:
        return gpe_entities[0]
    if loc_entities:
        return loc_entities[0]

    # Regex fallback for common patterns spaCy misses
    _KNOWN_PLACES = [
        "United States", "United Kingdom", "Soviet Union", "South Africa",
        "East Timor", "North Korea", "South Korea", "New Zealand",
        "Saudi Arabia", "Sri Lanka", "Hong Kong", "Puerto Rico",
        "Costa Rica", "Dominican Republic", "El Salvador",
    ]
    for place in _KNOWN_PLACES:
        if place.lower() in text.lower():
            return place

    return None


# ---------------------------------------------------------------------------
# Stage 2 – Curated historical mappings
# ---------------------------------------------------------------------------
def _load_curated() -> dict[str, GeoLocation]:
    global _curated  # noqa: PLW0603
    if _curated is not None:
        return _curated

    _curated = {}
    if not _CURATED_CSV.exists():
        logger.warning("curated_csv_missing", path=str(_CURATED_CSV))
        return _curated

    with _CURATED_CSV.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            key = row["historical_name"].strip().lower()
            _curated[key] = GeoLocation(
                coordinates=(float(row["lng"]), float(row["lat"])),
                confidence="high",
                geocoder="curated",
                place_name=row["historical_name"].strip(),
                modern_equivalent=row["modern_name"].strip(),
            )
    logger.info("curated_places_loaded", count=len(_curated))
    return _curated


def lookup_curated(place_name: str) -> GeoLocation | None:
    """Case-insensitive lookup in the curated historical-places CSV."""
    curated = _load_curated()
    return curated.get(place_name.strip().lower())


# ---------------------------------------------------------------------------
# Stage 3 – Nominatim geocoding
# ---------------------------------------------------------------------------
async def geocode_nominatim(place_name: str) -> GeoLocation | None:
    """Geocode *place_name* via the Nominatim (OpenStreetMap) API.

    Respects a 1-request-per-second rate limit.
    """
    global _last_nominatim_call  # noqa: PLW0603

    place_name = place_name[:200].strip()
    if not place_name:
        return None

    now = asyncio.get_event_loop().time()
    elapsed = now - _last_nominatim_call
    if elapsed < 1.0:
        await asyncio.sleep(1.0 - elapsed)

    params = {"q": place_name, "format": "json", "limit": 1}
    headers = {"User-Agent": _USER_AGENT}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(_NOMINATIM_URL, params=params, headers=headers, timeout=10.0)
            _last_nominatim_call = asyncio.get_event_loop().time()
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("nominatim_request_failed", error=str(exc))
        return None

    if not data:
        logger.info("nominatim_no_results", place_name=place_name)
        return None

    hit = data[0]
    return GeoLocation(
        coordinates=(float(hit["lon"]), float(hit["lat"])),
        confidence="medium",
        geocoder="nominatim",
        place_name=place_name,
        modern_equivalent=hit.get("display_name", ""),
    )


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
async def geocode_event(text: str, title: str = "") -> GeoLocation | None:
    """Multi-stage geocoding pipeline for a historical event.

    1. Extract a place name from *text* (and *title*) via spaCy NER.
    2. Check the curated historical-places CSV.
    3. Fall back to Nominatim.

    Returns ``None`` when all stages fail.
    """
    combined = f"{title} {text}".strip() if title else text

    # Check cache
    cache_key = combined
    if cache_key in _geocode_cache:
        logger.debug("geocode_cache_hit", key=cache_key[:80])
        return _geocode_cache[cache_key]

    # Stage 1: extract place name
    place = extract_place_name(combined)
    logger.info("geocode_stage1_ner", place=place)

    if place is None:
        return None

    # Stage 2: curated lookup
    result = lookup_curated(place)
    if result is not None:
        logger.info("geocode_stage2_curated_hit", place=place)
        _geocode_cache[cache_key] = result
        return result

    # Stage 3: Nominatim
    result = await geocode_nominatim(place)
    if result is not None:
        logger.info("geocode_stage3_nominatim_hit", place=place)
        _geocode_cache[cache_key] = result
        return result

    logger.warning("geocode_all_stages_failed", place=place)
    return None
