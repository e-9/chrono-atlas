from __future__ import annotations

import httpx
import respx

from src.services.wikipedia import WikipediaEvent, fetch_on_this_day

API_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/04"

FIXTURE_RESPONSE = {
    "selected": [
        {
            "text": "The United States Declaration of Independence is ratified by the Second Continental Congress.",
            "year": 1776,
            "pages": [
                {
                    "title": "United States Declaration of Independence",
                    "extract": "The Declaration of Independence is the founding document of the United States.",
                    "thumbnail": {
                        "source": "https://upload.wikimedia.org/thumb/declaration.jpg",
                        "width": 320,
                        "height": 213,
                    },
                    "content_urls": {
                        "desktop": {
                            "page": "https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"
                        }
                    },
                }
            ],
        }
    ],
    "births": [],
    "deaths": [],
    "events": [
        {
            "text": "The United States Declaration of Independence is ratified by the Second Continental Congress.",
            "year": 1776,
            "pages": [
                {
                    "title": "United States Declaration of Independence",
                    "extract": "The Declaration of Independence is the founding document of the United States.",
                    "thumbnail": {
                        "source": "https://upload.wikimedia.org/thumb/declaration.jpg",
                        "width": 320,
                        "height": 213,
                    },
                    "content_urls": {
                        "desktop": {
                            "page": "https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"
                        }
                    },
                }
            ],
        },
        {
            "text": "Nathaniel Hawthorne is born in Salem, Massachusetts.",
            "year": 1804,
            "pages": [
                {
                    "title": "Nathaniel Hawthorne",
                    "extract": "Nathaniel Hawthorne was an American novelist and short story writer.",
                    "thumbnail": None,
                    "content_urls": {
                        "desktop": {"page": "https://en.wikipedia.org/wiki/Nathaniel_Hawthorne"}
                    },
                }
            ],
        },
    ],
    "holidays": [],
}


@respx.mock
async def test_fetch_on_this_day_success() -> None:
    respx.get(API_URL).mock(return_value=httpx.Response(200, json=FIXTURE_RESPONSE))

    results = await fetch_on_this_day(7, 4)

    assert len(results) == 2

    first = results[0]
    assert isinstance(first, WikipediaEvent)
    assert first.year == 1776
    assert first.title == "United States Declaration of Independence"
    assert first.wikipedia_url == "https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"
    assert first.thumbnail_url == "https://upload.wikimedia.org/thumb/declaration.jpg"
    assert first.extract is not None

    second = results[1]
    assert second.year == 1804
    assert second.thumbnail_url is None


@respx.mock
async def test_fetch_on_this_day_sorted_by_year() -> None:
    respx.get(API_URL).mock(return_value=httpx.Response(200, json=FIXTURE_RESPONSE))

    results = await fetch_on_this_day(7, 4)

    years = [e.year for e in results]
    assert years == sorted(years)


@respx.mock
async def test_fetch_on_this_day_deduplicates() -> None:
    """The 1776 event appears in both selected and events; should appear once."""
    respx.get(API_URL).mock(return_value=httpx.Response(200, json=FIXTURE_RESPONSE))

    results = await fetch_on_this_day(7, 4)
    year_text_pairs = [(e.year, e.text) for e in results]
    assert len(year_text_pairs) == len(set(year_text_pairs))


@respx.mock
async def test_fetch_on_this_day_empty_response() -> None:
    empty = {"selected": [], "births": [], "deaths": [], "events": [], "holidays": []}
    respx.get(API_URL).mock(return_value=httpx.Response(200, json=empty))

    results = await fetch_on_this_day(7, 4)

    assert results == []


@respx.mock
async def test_fetch_on_this_day_timeout() -> None:
    respx.get(API_URL).mock(side_effect=httpx.ConnectTimeout("timed out"))

    results = await fetch_on_this_day(7, 4)

    assert results == []


@respx.mock
async def test_fetch_on_this_day_http_error() -> None:
    respx.get(API_URL).mock(return_value=httpx.Response(429))

    results = await fetch_on_this_day(7, 4)

    assert results == []


@respx.mock
async def test_fetch_on_this_day_missing_pages() -> None:
    data = {
        "selected": [],
        "events": [{"text": "Something happened", "year": 1900, "pages": []}],
    }
    respx.get(API_URL).mock(return_value=httpx.Response(200, json=data))

    results = await fetch_on_this_day(7, 4)

    assert len(results) == 1
    assert results[0].title == "Something happened"[:80]
    assert results[0].wikipedia_url is None
    assert results[0].thumbnail_url is None
