from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.models.event import GeoLocation, EventSource, HistoricalEvent

router = APIRouter(prefix="/events", tags=["events"])


class EventListResponse(BaseModel):
    date: str
    count: int
    events: list[HistoricalEvent]


MOCK_EVENT = HistoricalEvent(
    id="evt_001",
    iso_date="07-04",
    source=EventSource(type="wikipedia", source_url="https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"),
    title="Declaration of Independence adopted",
    description="The Continental Congress adopted the Declaration of Independence, announcing the separation of the thirteen American colonies from British rule.",
    year=1776,
    categories=["politics", "revolution"],
    location=GeoLocation(
        type="Point",
        coordinates=(-75.1498, 39.9496),
        confidence="high",
        geocoder="curated",
        place_name="Independence Hall, Philadelphia",
        modern_equivalent="Philadelphia, PA, USA",
    ),
    created_at="2025-01-01T00:00:00Z",
)


@router.get("/", response_model=EventListResponse)
async def list_events(date: Annotated[str | None, Query(pattern=r"^\d{2}-\d{2}$")] = None) -> EventListResponse:
    """List historical events, optionally filtered by date (MM-DD format)."""
    events = [MOCK_EVENT] if date is None or date == MOCK_EVENT.iso_date else []
    return EventListResponse(date=date or "all", count=len(events), events=events)


@router.get("/{event_id}", response_model=HistoricalEvent)
async def get_event(event_id: str) -> HistoricalEvent:
    """Get a single historical event by ID."""
    return MOCK_EVENT
