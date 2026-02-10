from __future__ import annotations

import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.models.event import GeoLocation, EventSource, HistoricalEvent

router = APIRouter(prefix="/events", tags=["events"])


class EventsMeta(BaseModel):
    total: int
    fictional: int
    cacheHit: bool


class EventsResponse(BaseModel):
    data: list[HistoricalEvent]
    meta: EventsMeta


def _get_today_mm_dd() -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    return f"{now.month:02d}-{now.day:02d}"


MOCK_EVENTS: list[HistoricalEvent] = [
    HistoricalEvent(
        id="evt_001",
        iso_date="02-10",
        source=EventSource(type="wikipedia", source_url="https://en.wikipedia.org/wiki/Treaty_of_Paris_(1763)"),
        title="Treaty of Paris signed",
        description="The Treaty of Paris was signed, ending the Seven Years' War between France and Great Britain. France ceded New France (Canada) to Britain.",
        year=1763,
        categories=["political", "military"],
        location=GeoLocation(
            type="Point",
            coordinates=(2.3522, 48.8566),
            confidence="high",
            geocoder="curated",
            place_name="Paris, France",
        ),
        created_at="2026-01-01T00:00:00Z",
    ),
    HistoricalEvent(
        id="evt_002",
        iso_date="02-10",
        source=EventSource(type="wikipedia", source_url="https://en.wikipedia.org/wiki/IBM_Deep_Blue"),
        title="Deep Blue defeats Kasparov",
        description="IBM's Deep Blue chess computer defeated world champion Garry Kasparov for the first time in a regulation game, marking a milestone in artificial intelligence.",
        year=1996,
        categories=["scientific", "cultural"],
        location=GeoLocation(
            type="Point",
            coordinates=(-73.9857, 40.7484),
            confidence="high",
            geocoder="curated",
            place_name="Philadelphia, Pennsylvania",
        ),
        created_at="2026-01-01T00:00:00Z",
    ),
    HistoricalEvent(
        id="evt_003",
        iso_date="02-10",
        source=EventSource(type="ai_generated", generated_at="2026-02-10T00:00:00Z", model_version="gpt-4o", plausibility_score=0.85),
        title="First orbital ice cream parlor opens",
        description="In a celebration of zero-gravity gastronomy, the world's first orbital ice cream parlor 'Scoops in Space' opened aboard the Lunar Gateway station, serving 3-meter tall swirl cones that float elegantly in microgravity.",
        year=2087,
        categories=["fictional_future", "cultural"],
        location=GeoLocation(
            type="Point",
            coordinates=(-95.3698, 29.7604),
            confidence="medium",
            geocoder="ai_inferred",
            place_name="Houston, Texas (Mission Control)",
        ),
        created_at="2026-02-10T00:00:00Z",
    ),
    HistoricalEvent(
        id="evt_004",
        iso_date="07-04",
        source=EventSource(type="wikipedia", source_url="https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"),
        title="Declaration of Independence adopted",
        description="The Continental Congress adopted the Declaration of Independence, announcing the separation of the thirteen American colonies from British rule.",
        year=1776,
        categories=["political"],
        location=GeoLocation(
            type="Point",
            coordinates=(-75.1498, 39.9496),
            confidence="high",
            geocoder="curated",
            place_name="Independence Hall, Philadelphia",
            modern_equivalent="Philadelphia, PA, USA",
        ),
        created_at="2025-01-01T00:00:00Z",
    ),
]


@router.get("", response_model=EventsResponse)
async def list_events(date: Annotated[str | None, Query(pattern=r"^\d{2}-\d{2}$")] = None) -> EventsResponse:
    """List historical events, optionally filtered by date (MM-DD format)."""
    target_date = date or _get_today_mm_dd()
    events = [e for e in MOCK_EVENTS if e.iso_date == target_date]
    fictional_count = sum(1 for e in events if e.source.type == "ai_generated")
    return EventsResponse(
        data=events,
        meta=EventsMeta(total=len(events), fictional=fictional_count, cacheHit=False),
    )


@router.get("/{event_id}", response_model=HistoricalEvent)
async def get_event(event_id: str) -> HistoricalEvent:
    """Get a single historical event by ID."""
    for event in MOCK_EVENTS:
        if event.id == event_id:
            return event
    return MOCK_EVENTS[0]
