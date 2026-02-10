"""Tests for the fictional future-event generator."""
from __future__ import annotations

import pytest

from src.models.event import HistoricalEvent
from src.services.fiction import FICTIONAL_POOL, generate_fictional_events, generate_with_ai


class TestGenerateFictionalEvents:
    def test_returns_requested_count(self) -> None:
        events = generate_fictional_events(month=1, day=1, count=3)
        assert len(events) == 3

    def test_returns_five_when_requested(self) -> None:
        events = generate_fictional_events(month=6, day=15, count=5)
        assert len(events) == 5

    def test_all_events_have_valid_coordinates(self) -> None:
        events = generate_fictional_events(month=3, day=3, count=5)
        for event in events:
            lng, lat = event.location.coordinates
            assert -180 <= lng <= 180, f"Invalid longitude: {lng}"
            assert -90 <= lat <= 90, f"Invalid latitude: {lat}"

    def test_events_marked_as_ai_generated(self) -> None:
        events = generate_fictional_events(month=7, day=4, count=2)
        for event in events:
            assert event.source.type == "ai_generated"
            assert event.source.generated_at is not None
            assert event.source.model_version == "curated-pool-v1"

    def test_events_are_historical_event_instances(self) -> None:
        events = generate_fictional_events(month=12, day=25, count=1)
        assert all(isinstance(e, HistoricalEvent) for e in events)

    def test_iso_date_matches_input(self) -> None:
        events = generate_fictional_events(month=2, day=14, count=2)
        for event in events:
            assert event.iso_date == "02-14"

    def test_fallback_when_no_exact_date_matches(self) -> None:
        # Pick a date unlikely to have an exact match in the pool
        events = generate_fictional_events(month=6, day=30, count=4)
        assert len(events) == 4
        # All should still be valid events
        for event in events:
            assert event.source.type == "ai_generated"
            assert event.location.coordinates is not None

    def test_years_within_range(self) -> None:
        events = generate_fictional_events(month=9, day=5, count=5)
        for event in events:
            assert 2030 <= event.year <= 2200

    def test_categories_are_non_empty(self) -> None:
        events = generate_fictional_events(month=11, day=3, count=3)
        for event in events:
            assert len(event.categories) > 0

    def test_pool_has_at_least_60_entries(self) -> None:
        assert len(FICTIONAL_POOL) >= 60


class TestGenerateWithAi:
    async def test_stub_returns_none(self) -> None:
        result = await generate_with_ai(month=1, day=1, count=3)
        assert result is None
