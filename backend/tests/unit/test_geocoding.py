from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
import respx

from src.models.event import GeoLocation
from src.services.geocoding import (
    _geocode_cache,
    extract_place_name,
    geocode_event,
    geocode_nominatim,
    lookup_curated,
)


# ---------------------------------------------------------------------------
# Stage 1 – extract_place_name
# ---------------------------------------------------------------------------
class TestExtractPlaceName:
    def test_returns_gpe_from_sentence(self) -> None:
        result = extract_place_name("The revolution began in France in 1789.")
        assert result is not None

    def test_prefers_gpe_over_loc(self) -> None:
        result = extract_place_name("France is west of the Rhine river.")
        assert result == "France"

    def test_returns_none_for_no_entities(self) -> None:
        result = extract_place_name("Nothing relevant here at all.")
        assert result is None

    def test_handles_empty_string(self) -> None:
        result = extract_place_name("")
        assert result is None

    def test_returns_none_when_spacy_unavailable(self) -> None:
        with patch("src.services.geocoding._load_spacy", return_value=None):
            assert extract_place_name("Paris is lovely") is None


# ---------------------------------------------------------------------------
# Stage 2 – curated lookup
# ---------------------------------------------------------------------------
class TestLookupCurated:
    def test_exact_match(self) -> None:
        geo = lookup_curated("Constantinople")
        assert geo is not None
        assert geo.place_name == "Constantinople"
        assert geo.modern_equivalent == "Istanbul"
        assert geo.geocoder == "curated"

    def test_case_insensitive(self) -> None:
        geo = lookup_curated("CONSTANTINOPLE")
        assert geo is not None
        assert geo.place_name == "Constantinople"

    def test_unknown_place_returns_none(self) -> None:
        assert lookup_curated("Atlantis") is None

    def test_coordinates_are_lng_lat(self) -> None:
        geo = lookup_curated("Persia")
        assert geo is not None
        lng, lat = geo.coordinates
        # Tehran ~51 lng, ~35 lat
        assert 50 < lng < 53
        assert 34 < lat < 37


# ---------------------------------------------------------------------------
# Stage 3 – Nominatim geocoding (mocked)
# ---------------------------------------------------------------------------
class TestGeocodeNominatim:
    @respx.mock
    async def test_successful_geocode(self) -> None:
        respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(
                200,
                json=[{"lat": "48.8566", "lon": "2.3522", "display_name": "Paris, France"}],
            )
        )
        geo = await geocode_nominatim("Paris")
        assert geo is not None
        assert geo.geocoder == "nominatim"
        assert geo.coordinates == (2.3522, 48.8566)

    @respx.mock
    async def test_no_results(self) -> None:
        respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(200, json=[])
        )
        assert await geocode_nominatim("Xyzzyplugh") is None

    @respx.mock
    async def test_http_error(self) -> None:
        respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(500)
        )
        assert await geocode_nominatim("Paris") is None


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------
class TestGeocodeEvent:
    @pytest.fixture(autouse=True)
    def _clear_cache(self) -> None:
        _geocode_cache.clear()

    async def test_curated_hit_skips_nominatim(self) -> None:
        with patch("src.services.geocoding.extract_place_name", return_value="Constantinople"):
            result = await geocode_event("The fall of Constantinople")
            assert result is not None
            assert result.geocoder == "curated"

    @respx.mock
    async def test_nominatim_fallback(self) -> None:
        respx.get("https://nominatim.openstreetmap.org/search").mock(
            return_value=httpx.Response(
                200,
                json=[{"lat": "51.5074", "lon": "-0.1278", "display_name": "London, UK"}],
            )
        )
        with patch("src.services.geocoding.extract_place_name", return_value="London"):
            result = await geocode_event("The Great Fire of London in 1666")
            assert result is not None
            assert result.geocoder == "nominatim"

    async def test_returns_none_when_no_place_extracted(self) -> None:
        with patch("src.services.geocoding.extract_place_name", return_value=None):
            assert await geocode_event("Something happened somewhere") is None

    async def test_cache_hit_on_second_call(self) -> None:
        sentinel = GeoLocation(
            coordinates=(0.0, 0.0),
            confidence="high",
            geocoder="curated",
            place_name="Cached",
        )
        text = "cached event text"
        _geocode_cache[text] = sentinel

        result = await geocode_event(text)
        assert result is sentinel
