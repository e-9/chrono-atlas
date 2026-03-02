from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timedelta, timezone

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from src.api.routes.events import router as events_router

limiter = Limiter(key_func=get_remote_address)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
        if os.getenv("LOG_LEVEL", "info").lower() != "debug"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
)

log = structlog.get_logger()

_CACHE_WARM_INTERVAL = 50 * 60  # 50 minutes (< 1hr event cache TTL)


def _dates_for_all_timezones() -> list[date]:
    """Return the set of calendar dates that are 'today' across all timezones.

    Timezones span UTC-12 to UTC+14, so at any moment there are up to 3
    distinct calendar dates worldwide.  We return yesterday, today, and
    tomorrow (UTC) to ensure every user sees a warm cache regardless of
    their local timezone.
    """
    utc_today = date.today()
    return [
        utc_today - timedelta(days=1),
        utc_today,
        utc_today + timedelta(days=1),
    ]


async def _prime_dates(dates: list[date]) -> None:
    """Fetch and cache events for each date, logging successes/failures."""
    from src.services.events import get_events_for_date

    for d in dates:
        key = f"{d.month:02d}-{d.day:02d}"
        try:
            await get_events_for_date(d.month, d.day)
            log.info("cache_primed", date=key)
        except Exception:
            log.exception("cache_prime_failed", date=key)


async def _prime_and_warm_loop() -> None:
    """Prime event caches then re-fetch periodically."""
    # Initial prime for all active timezone dates
    await _prime_dates(_dates_for_all_timezones())

    # Periodic refresh
    while True:
        await asyncio.sleep(_CACHE_WARM_INTERVAL)
        try:
            await _prime_dates(_dates_for_all_timezones())
        except Exception:
            log.exception("cache_refresh_failed")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("chrono_atlas_starting", version="0.1.0")
    # Load spaCy synchronously (fast ~1-2s), but prime cache in background
    # so the app starts serving requests immediately
    from src.services.geocoding import _load_spacy
    _load_spacy()
    log.info("spacy_pre_warmed")
    prime_task = asyncio.create_task(_prime_and_warm_loop())
    yield
    prime_task.cancel()
    log.info("chrono_atlas_shutting_down")


app = FastAPI(
    title="Chrono Atlas API",
    version="0.1.0",
    description="Historical events exploration API",
    lifespan=lifespan,
)
app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


# Mount v1 API routes
api_v1 = FastAPI(title="Chrono Atlas API v1")
api_v1.include_router(events_router)
app.mount("/api/v1", api_v1)
