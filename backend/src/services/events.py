from __future__ import annotations

import datetime
import uuid

import structlog

from src.models.event import EventSource, GeoLocation, HistoricalEvent
from src.services.geocoding import extract_place_name, geocode_event, lookup_curated, geocode_nominatim
from src.services.wikipedia import WikipediaEvent, fetch_on_this_day

logger = structlog.get_logger(__name__)

# In-memory cache: "MM-DD" -> list of events
_events_cache: dict[str, list[HistoricalEvent]] = {}
# Nominatim results cache: place_name -> GeoLocation (persists across date requests)
_nominatim_cache: dict[str, GeoLocation] = {}


async def get_events_for_date(month: int, day: int) -> list[HistoricalEvent]:
    """Fetch, geocode, and return historical events for a given month/day."""
    cache_key = f"{month:02d}-{day:02d}"

    if cache_key in _events_cache:
        logger.info("events_cache_hit", date=cache_key, count=len(_events_cache[cache_key]))
        return _events_cache[cache_key]

    logger.info("events_fetching", date=cache_key)

    # 1. Fetch from Wikipedia
    wiki_events = await fetch_on_this_day(month, day)
    logger.info("wikipedia_fetched", date=cache_key, count=len(wiki_events))

    if not wiki_events:
        _events_cache[cache_key] = []
        return []

    # 2. Extract place names and deduplicate before geocoding
    place_map: dict[int, str | None] = {}  # index -> place_name
    unique_places: set[str] = set()

    for i, we in enumerate(wiki_events):
        combined = f"{we.title}. {we.text}"
        place = extract_place_name(combined)
        place_map[i] = place
        if place:
            unique_places.add(place)

    logger.info("places_extracted", total=len(wiki_events), unique=len(unique_places))

    # 3. Geocode unique place names (curated first, then Nominatim for the rest)
    geo_results: dict[str, GeoLocation | None] = {}
    nominatim_queue: list[str] = []

    for place in unique_places:
        # Check module-level Nominatim cache first (persists across requests)
        if place in _nominatim_cache:
            geo_results[place] = _nominatim_cache[place]
            continue
        result = lookup_curated(place)
        if result is not None:
            geo_results[place] = result
        else:
            nominatim_queue.append(place)

    logger.info("geocode_plan", curated_hits=len(geo_results), nominatim_needed=len(nominatim_queue))

    # Geocode via Nominatim sequentially (respects rate limit) but only unique places
    for place in nominatim_queue:
        result = await geocode_nominatim(place)
        geo_results[place] = result
        if result is not None:
            _nominatim_cache[place] = result

    # 4. Build HistoricalEvent objects
    events: list[HistoricalEvent] = []
    for i, we in enumerate(wiki_events):
        place = place_map[i]
        if place is None:
            continue
        location = geo_results.get(place)
        if location is None:
            continue

        event = HistoricalEvent(
            id=str(uuid.uuid4()),
            iso_date=cache_key,
            source=EventSource(
                type="wikipedia",
                source_url=we.wikipedia_url,
            ),
            title=we.title,
            description=we.extract or we.text,
            year=we.year,
            categories=_infer_categories(we.text),
            location=location,
            media={"imageUrl": we.thumbnail_url} if we.thumbnail_url else None,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        events.append(event)

    logger.info("events_geocoded", date=cache_key, total=len(wiki_events), geocoded=len(events))

    # 5. Cache results
    _events_cache[cache_key] = events
    return events


def _infer_categories(text: str) -> list[str]:
    """Simple keyword-based category inference."""
    text_lower = text.lower()
    categories: list[str] = []

    keyword_map = {
        "political": ["president", "election", "treaty", "constitution", "parliament", "government", "republic", "independence", "colony"],
        "military": ["war", "battle", "army", "siege", "invasion", "military", "troops", "naval", "surrender"],
        "scientific": ["discover", "invent", "patent", "scientist", "theory", "experiment", "laboratory", "research"],
        "cultural": ["art", "music", "film", "book", "theater", "museum", "festival", "olympic"],
        "exploration": ["explore", "expedition", "voyage", "discover", "landing", "sail"],
        "economic": ["trade", "company", "bank", "stock", "market", "industry"],
        "religious": ["church", "pope", "cathedral", "religion", "monastery", "crusade"],
        "natural_disaster": ["earthquake", "flood", "hurricane", "volcano", "tsunami", "famine"],
    }

    for category, keywords in keyword_map.items():
        if any(kw in text_lower for kw in keywords):
            categories.append(category)

    return categories or ["historical"]


def clear_cache() -> None:
    """Clear the in-memory events cache."""
    _events_cache.clear()
    # Don't clear _nominatim_cache — it's expensive to rebuild
