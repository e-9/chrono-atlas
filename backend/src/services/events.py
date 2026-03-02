from __future__ import annotations

import asyncio
import datetime
import uuid

import structlog
from cachetools import TTLCache

from src.models.event import EventSource, GeoLocation, HistoricalEvent
from src.services.fiction import generate_fictional_events
from src.services.geocoding import extract_place_name, geocode_event, lookup_curated, geocode_nominatim, _persist_to_curated
from src.services.wikipedia import WikipediaEvent, fetch_on_this_day

logger = structlog.get_logger(__name__)

# Bounded in-memory caches with TTL
_events_cache: TTLCache[str, list[HistoricalEvent]] = TTLCache(maxsize=400, ttl=3600)
_nominatim_cache: TTLCache[str, GeoLocation] = TTLCache(maxsize=2000, ttl=86400)


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
        logger.info("wikipedia_empty_fallback", date=cache_key)
        fictional = generate_fictional_events(month, day, count=5)
        # Don't cache fictional-only results — retry Wikipedia on next request
        return fictional

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

    # Geocode via Nominatim sequentially (respects rate limit).
    # Cap at 5 calls (~5s) to keep response time reasonable.
    # Remaining places are geocoded in the background.
    _MAX_NOMINATIM_PER_REQUEST = 5
    geocoded_count = 0
    for place in nominatim_queue:
        if geocoded_count >= _MAX_NOMINATIM_PER_REQUEST:
            logger.info("nominatim_cap_reached", skipped=len(nominatim_queue) - geocoded_count)
            break
        result = await geocode_nominatim(place)
        geo_results[place] = result
        if result is not None:
            _nominatim_cache[place] = result
            await _persist_to_curated(place, result)
        geocoded_count += 1

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
            title=we.text[:120] if len(we.text) > 120 else we.text,
            description=we.extract or we.text,
            year=we.year,
            categories=_infer_categories(we.text),
            location=location,
            media={"imageUrl": we.thumbnail_url} if we.thumbnail_url else None,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        events.append(event)

    logger.info("events_geocoded", date=cache_key, total=len(wiki_events), geocoded=len(events))

    # 5. Fill sparse days with fictional future events
    min_events = 5
    if len(events) < min_events:
        needed = min_events - len(events)
        fictional = generate_fictional_events(month, day, count=needed)
        events.extend(fictional)
        logger.info("fictional_fill", date=cache_key, added=len(fictional))

    # 6. Cache results
    _events_cache[cache_key] = events

    # 7. If we capped Nominatim, schedule background geocoding for full results.
    #    Next request to this date will get the complete set from cache.
    remaining = nominatim_queue[geocoded_count:]
    if remaining:
        asyncio.create_task(
            _background_geocode(month, day, wiki_events, place_map, remaining)
        )

    return events


async def _background_geocode(
    month: int,
    day: int,
    wiki_events: list[WikipediaEvent],
    place_map: dict[int, str | None],
    remaining_places: list[str],
) -> None:
    """Geocode remaining places in the background and update the cache."""
    cache_key = f"{month:02d}-{day:02d}"
    logger.info("background_geocode_start", date=cache_key, places=len(remaining_places))

    new_geo: dict[str, GeoLocation | None] = {}
    for place in remaining_places:
        result = await geocode_nominatim(place)
        new_geo[place] = result
        if result is not None:
            _nominatim_cache[place] = result
            await _persist_to_curated(place, result)

    # Rebuild the full event list with all geocoded data
    all_geo = {}
    # Gather curated + cached results for all unique places
    for i, we in enumerate(wiki_events):
        p = place_map.get(i)
        if p and p in _nominatim_cache:
            all_geo[p] = _nominatim_cache[p]
        elif p:
            curated = lookup_curated(p)
            if curated:
                all_geo[p] = curated

    all_geo.update(new_geo)

    events: list[HistoricalEvent] = []
    for i, we in enumerate(wiki_events):
        place = place_map.get(i)
        if place is None:
            continue
        location = all_geo.get(place)
        if location is None:
            continue
        events.append(HistoricalEvent(
            id=str(uuid.uuid4()),
            iso_date=cache_key,
            source=EventSource(type="wikipedia", source_url=we.wikipedia_url),
            title=we.text[:120] if len(we.text) > 120 else we.text,
            description=we.extract or we.text,
            year=we.year,
            categories=_infer_categories(we.text),
            location=location,
            media={"imageUrl": we.thumbnail_url} if we.thumbnail_url else None,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ))

    if len(events) < 5:
        events.extend(generate_fictional_events(month, day, count=5 - len(events)))

    _events_cache[cache_key] = events
    logger.info("background_geocode_done", date=cache_key, total_events=len(events))


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
