from __future__ import annotations

import datetime
import uuid

import structlog

from src.models.event import EventSource, GeoLocation, HistoricalEvent
from src.services.geocoding import geocode_event
from src.services.wikipedia import WikipediaEvent, fetch_on_this_day

logger = structlog.get_logger(__name__)

# In-memory cache: "MM-DD" -> list of events
_events_cache: dict[str, list[HistoricalEvent]] = {}


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

    # 2. Geocode each event and build HistoricalEvent objects
    events: list[HistoricalEvent] = []
    for we in wiki_events:
        location = await _geocode_wiki_event(we)
        if location is None:
            continue  # Skip events we can't place on the map

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

    # 3. Cache results
    _events_cache[cache_key] = events
    return events


async def _geocode_wiki_event(we: WikipediaEvent) -> GeoLocation | None:
    """Try to geocode a Wikipedia event using text + title."""
    # Use title + text together for better NER extraction
    search_text = f"{we.title}. {we.text}"
    return await geocode_event(text=search_text, title=we.title)


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
