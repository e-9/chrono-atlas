from __future__ import annotations

import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Request
from pydantic import BaseModel, ConfigDict
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.models.event import HistoricalEvent
from src.services.events import get_events_for_date

router = APIRouter(prefix="/events", tags=["events"])
limiter = Limiter(key_func=get_remote_address)


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


def _validate_date(month: int, day: int) -> None:
    """Raise 422 if month/day is not a valid calendar date."""
    try:
        datetime.date(2000, month, day)  # leap year to allow Feb 29
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid date: month={month}, day={day}")


_UUID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"


@router.get("", response_model=EventsResponse, response_model_by_alias=True)
@limiter.limit("30/minute")
async def list_events(request: Request, date: Annotated[str | None, Query(pattern=r"^\d{2}-\d{2}$")] = None) -> EventsResponse:
    """List historical events, optionally filtered by date (MM-DD format)."""
    if date:
        month, day = int(date[:2]), int(date[3:])
    else:
        month, day = _get_today_mm_dd()

    _validate_date(month, day)

    events = await get_events_for_date(month, day)
    fictional_count = sum(1 for e in events if e.source.type == "ai_generated")

    return EventsResponse(
        data=events,
        meta=EventsMeta(total=len(events), fictional=fictional_count, cacheHit=False),
    )


@router.get("/{event_id}", response_model=HistoricalEvent, response_model_by_alias=True)
@limiter.limit("60/minute")
async def get_event(request: Request, event_id: Annotated[str, Path(pattern=_UUID_PATTERN)]) -> HistoricalEvent:
    """Get a single historical event by ID."""
    month, day = _get_today_mm_dd()
    events = await get_events_for_date(month, day)
    for event in events:
        if event.id == event_id:
            return event
    raise HTTPException(status_code=404, detail="Event not found")
