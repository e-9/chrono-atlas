from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timezone

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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


async def _warm_cache_once() -> None:
    """Pre-warm spaCy model and prime today's event cache."""
    from src.services.geocoding import _load_spacy
    from src.services.events import get_events_for_date

    _load_spacy()
    log.info("spacy_pre_warmed")

    today = date.today()
    try:
        await get_events_for_date(today.month, today.day)
        log.info("cache_primed", date=f"{today.month:02d}-{today.day:02d}")
    except Exception:
        log.exception("cache_prime_failed")


async def _cache_warm_loop() -> None:
    """Periodically re-fetch today's events to keep cache warm."""
    from src.services.events import get_events_for_date

    while True:
        await asyncio.sleep(_CACHE_WARM_INTERVAL)
        today = date.today()
        try:
            await get_events_for_date(today.month, today.day)
            log.info("cache_refreshed", date=f"{today.month:02d}-{today.day:02d}")
        except Exception:
            log.exception("cache_refresh_failed")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("chrono_atlas_starting", version="0.1.0")
    # Pre-warm spaCy + prime today's cache in background
    await _warm_cache_once()
    warm_task = asyncio.create_task(_cache_warm_loop())
    yield
    warm_task.cancel()
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
