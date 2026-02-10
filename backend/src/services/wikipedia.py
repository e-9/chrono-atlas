from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

_API_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/{month}/{day}"
_USER_AGENT = "ChronoAtlas/0.1 (https://github.com/e-9/chrono-atlas)"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_MAX_RETRIES = 3


@dataclass(frozen=True, slots=True)
class WikipediaEvent:
    text: str
    year: int
    title: str
    wikipedia_url: str | None = None
    thumbnail_url: str | None = None
    extract: str | None = None


def _parse_event(raw: dict[str, Any]) -> WikipediaEvent | None:
    text: str | None = raw.get("text")
    year: int | None = raw.get("year")
    if text is None or year is None:
        return None

    pages: list[dict[str, Any]] = raw.get("pages") or []
    first_page = pages[0] if pages else {}

    title: str = first_page.get("title", text[:80])
    wikipedia_url: str | None = None
    thumbnail_url: str | None = None
    extract: str | None = first_page.get("extract")

    content_urls = first_page.get("content_urls") or {}
    desktop = content_urls.get("desktop") or {}
    wikipedia_url = desktop.get("page")

    thumbnail = first_page.get("thumbnail") or {}
    thumbnail_url = thumbnail.get("source")

    return WikipediaEvent(
        text=text,
        year=year,
        title=title,
        wikipedia_url=wikipedia_url,
        thumbnail_url=thumbnail_url,
        extract=extract,
    )


async def fetch_on_this_day(month: int, day: int) -> list[WikipediaEvent]:
    """Fetch historical events from Wikipedia's 'On This Day' API."""
    url = _API_URL.format(month=f"{month:02d}", day=f"{day:02d}")
    log = logger.bind(month=month, day=day)
    log.info("wikipedia.fetch_start")

    transport = httpx.AsyncHTTPTransport(retries=_MAX_RETRIES)
    async with httpx.AsyncClient(transport=transport, timeout=_TIMEOUT) as client:
        try:
            resp = await client.get(url, headers={"User-Agent": _USER_AGENT})
            resp.raise_for_status()
        except httpx.TimeoutException:
            log.warning("wikipedia.timeout")
            return []
        except httpx.HTTPStatusError as exc:
            log.warning("wikipedia.http_error", status=exc.response.status_code)
            return []
        except httpx.HTTPError as exc:
            log.warning("wikipedia.request_error", error=str(exc))
            return []

    data: dict[str, Any] = resp.json()

    selected: list[dict[str, Any]] = data.get("selected") or []
    events: list[dict[str, Any]] = data.get("events") or []

    seen: set[tuple[int, str]] = set()
    results: list[WikipediaEvent] = []

    for raw in selected + events:
        parsed = _parse_event(raw)
        if parsed is None:
            continue
        key = (parsed.year, parsed.text)
        if key in seen:
            continue
        seen.add(key)
        results.append(parsed)

    results.sort(key=lambda e: e.year)
    log.info("wikipedia.fetch_done", count=len(results))
    return results


async def fetch_today() -> list[WikipediaEvent]:
    """Fetch historical events for today's date."""
    now = datetime.now(tz=UTC)
    return await fetch_on_this_day(now.month, now.day)
