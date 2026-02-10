from __future__ import annotations

import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict

from src.models.event import HistoricalEvent
from src.services.events import get_events_for_date

router = APIRouter(prefix="/events", tags=["events"])


class EventsMeta(BaseModel):
    total: int
    fictional: int
    cacheHit: bool


class EventsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: list[HistoricalEvent]
    meta: EventsMeta


def _get_today_mm_dd() -> tuple[int, int]:
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.month, now.day


@router.get("", response_model=EventsResponse, response_model_by_alias=True)
async def list_events(date: Annotated[str | None, Query(pattern=r"^\d{2}-\d{2}$")] = None) -> EventsResponse:
    """List historical events, optionally filtered by date (MM-DD format)."""
    if date:
        month, day = int(date[:2]), int(date[3:])
    else:
        month, day = _get_today_mm_dd()

    events = await get_events_for_date(month, day)
    fictional_count = sum(1 for e in events if e.source.type == "ai_generated")

    return EventsResponse(
        data=events,
        meta=EventsMeta(total=len(events), fictional=fictional_count, cacheHit=False),
    )


@router.get("/{event_id}", response_model=HistoricalEvent, response_model_by_alias=True)
async def get_event(event_id: str) -> HistoricalEvent:
    """Get a single historical event by ID."""
    # For now, fetch today's events and find by ID
    month, day = _get_today_mm_dd()
    events = await get_events_for_date(month, day)
    for event in events:
        if event.id == event_id:
            return event
    # Fallback to first event if not found
    if events:
        return events[0]
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Event not found")
