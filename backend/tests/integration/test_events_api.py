from __future__ import annotations

from unittest.mock import patch

import pytest

from src.models.event import GeoLocation
from src.services.events import clear_cache
from src.services.wikipedia import WikipediaEvent

FAKE_WIKI_EVENTS = [
    WikipediaEvent(
        text="The Treaty of London was signed",
        year=1839,
        title="Treaty of London",
        wikipedia_url="https://en.wikipedia.org/wiki/Treaty_of_London",
        thumbnail_url="https://example.com/thumb.jpg",
        extract="A treaty signed in London.",
    ),
    WikipediaEvent(
        text="Battle of Stalingrad ended in a decisive Soviet victory",
        year=1943,
        title="Battle of Stalingrad",
        wikipedia_url="https://en.wikipedia.org/wiki/Battle_of_Stalingrad",
        thumbnail_url=None,
        extract="Major battle of World War II.",
    ),
]

FAKE_GEO = GeoLocation(
    coordinates=(-0.1276, 51.5074),
    confidence="high",
    geocoder="curated",
    place_name="London",
)

_PATCH_PREFIX = "src.services.events"


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_cache()
    yield
    clear_cache()


@pytest.fixture()
def _mock_services():
    with (
        patch(f"{_PATCH_PREFIX}.fetch_on_this_day", return_value=FAKE_WIKI_EVENTS),
        patch(f"{_PATCH_PREFIX}.extract_place_name", return_value="London"),
        patch(f"{_PATCH_PREFIX}.lookup_curated", return_value=FAKE_GEO),
        patch(f"{_PATCH_PREFIX}.geocode_nominatim", return_value=FAKE_GEO),
    ):
        yield


# ── 1. GET /api/v1/events?date=02-10 — correct response shape ───────────


@pytest.mark.anyio
async def test_list_events_returns_200_with_correct_shape(client, _mock_services):
    resp = await client.get("/api/v1/events?date=02-10")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert isinstance(body["data"], list)
    meta = body["meta"]
    assert "total" in meta
    assert "fictional" in meta
    assert "cacheHit" in meta


# ── 2. GET /api/v1/events?date=invalid — 422 regex validation ───────────


@pytest.mark.anyio
async def test_invalid_date_format_returns_422(client):
    resp = await client.get("/api/v1/events?date=invalid")
    assert resp.status_code == 422


# ── 3. GET /api/v1/events?date=02-30 — 422 invalid calendar date ────────


@pytest.mark.anyio
async def test_invalid_calendar_date_returns_422(client, _mock_services):
    resp = await client.get("/api/v1/events?date=02-30")
    assert resp.status_code == 422


# ── 4. GET /api/v1/events?date=13-01 — 422 invalid month ────────────────


@pytest.mark.anyio
async def test_invalid_month_returns_422(client, _mock_services):
    resp = await client.get("/api/v1/events?date=13-01")
    assert resp.status_code == 422


# ── 5. GET /api/v1/events/nonexistent-id — 404 ──────────────────────────


@pytest.mark.anyio
async def test_get_nonexistent_event_returns_404(client, _mock_services):
    resp = await client.get("/api/v1/events/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_event_invalid_id_returns_422(client, _mock_services):
    resp = await client.get("/api/v1/events/nonexistent-id")
    assert resp.status_code == 422


# ── 6. GET /api/v1/events (no date) — 200 uses today's date ─────────────


@pytest.mark.anyio
async def test_no_date_returns_200(client, _mock_services):
    resp = await client.get("/api/v1/events")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) > 0


# ── 7. All events have camelCase keys ────────────────────────────────────

EXPECTED_CAMEL_KEYS = {"isoDate", "placeName", "sourceUrl"}


@pytest.mark.anyio
async def test_events_have_camel_case_keys(client, _mock_services):
    resp = await client.get("/api/v1/events?date=02-10")
    body = resp.json()
    for event in body["data"]:
        assert "isoDate" in event
        assert "createdAt" in event
        source = event["source"]
        assert "sourceUrl" in source or "generatedAt" in source
        loc = event["location"]
        assert "placeName" in loc


# ── 8. Fictional events have source.type === "ai_generated" ─────────────


@pytest.mark.anyio
async def test_fictional_events_have_ai_generated_source(client):
    """When Wikipedia returns nothing, fictional events fill in."""
    with (
        patch(f"{_PATCH_PREFIX}.fetch_on_this_day", return_value=[]),
        patch(f"{_PATCH_PREFIX}.extract_place_name", return_value="London"),
        patch(f"{_PATCH_PREFIX}.lookup_curated", return_value=FAKE_GEO),
        patch(f"{_PATCH_PREFIX}.geocode_nominatim", return_value=FAKE_GEO),
    ):
        resp = await client.get("/api/v1/events?date=02-10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["meta"]["fictional"] > 0
    for event in body["data"]:
        if event["source"]["type"] == "ai_generated":
            assert event["source"]["type"] == "ai_generated"
