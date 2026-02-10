from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class GeoLocation(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]  # [lng, lat]
    confidence: Literal["high", "medium", "low", "estimated"]
    geocoder: Literal["nominatim", "azure_maps", "ai_inferred", "curated"]
    place_name: str
    modern_equivalent: str | None = None


class EventSource(BaseModel):
    type: Literal["wikipedia", "ai_generated"]
    source_url: str | None = None
    generated_at: str | None = None
    model_version: str | None = None
    plausibility_score: float | None = None


class HistoricalEvent(BaseModel):
    id: str
    iso_date: str  # "MM-DD"
    source: EventSource
    title: str
    description: str
    year: int
    categories: list[str]
    location: GeoLocation
    media: dict | None = None  # type: ignore[type-arg]
    created_at: str
