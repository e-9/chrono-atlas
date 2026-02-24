# Chrono Atlas — Final Implementation Plan

> **Methodology**: This plan follows [Spec-Driven Development (SDD)](https://github.com/github/spec-kit) — specs drive code, not the other way around. We'll use spec-kit to bootstrap the project with `specify init`, then use `/speckit.specify`, `/speckit.plan`, and `/speckit.tasks` to manage features as executable specifications.
>
> **Sources**: This plan synthesizes the best ideas from independent analyses by **Claude Opus 4.5** and **GPT-5.1-Codex**, combined with the spec-kit SDD methodology.

---

## Problem Statement

Build a public website that visualizes historical events on an artistic D3.js map. Each day, the system fetches "on this day" historical events from Wikipedia, geocodes them, and displays them as pins on a stylized world map. The site should feel like a beautiful, interactive atlas — clean, artistic, and delightful to explore.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (SPA)                                  │
│  React 18 + TypeScript + Vite + D3.js (Winkel Tripel artistic projection)   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Map Canvas  │  │  Date Picker │  │  Event Cards │  │  Search/     │     │
│  │  (D3 + SVG)  │  │  + Timeline  │  │  (Details)   │  │  Filters     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                     React Query (stale-while-revalidate)                     │
│                              Hosted: Azure Static Web Apps                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                        API GATEWAY + CDN                                     │
│                    Azure Front Door + WAF                                    │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────────┐
│                              BACKEND (FastAPI)                               │
│                         Azure Container Apps                                 │
│                                                                              │
│  Routes:                                                                     │
│    GET  /api/v1/events?date=MM-DD&category=&source=                         │
│    GET  /api/v1/events/:id                                                  │
│    POST /api/v1/ingest/run?date=  (admin, triggers Event Grid)              │
│                                                                              │
│  Services:                                                                   │
│    ┌─────────────┐  ┌─────────────┐                                          │
│    │ Wikipedia   │  │ Geocoding   │                                          │
│    │ Fetcher     │  │ Pipeline    │                                          │
│    │             │  │ (spaCy NER  │                                          │
│    │             │  │  → Curated  │                                          │
│    │             │  │  → Nominatim│                                          │
│    └─────────────┘  └─────────────┘                                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     
┌──────────────────┐  ┌──────────────────┐  
│  Azure Cosmos DB │  │  Azure Cache     │  
│  (MongoDB API)   │  │  for Redis       │  
│                  │  │  (hot cache)     │  
│  • events        │  │  • daily digest  │  
│  • dailyDigest   │  │  • geocode cache │  
│  • locationCache │  │                  │  
└──────────────────┘  └──────────────────┘  
         │
         ▼
┌──────────────────┐  ┌──────────────────┐
│  Azure Event Grid│  │  Azure Blob +    │
│  (daily trigger) │  │  CDN (TopoJSON,  │
│                  │  │  textures, tiles) │
└──────────────────┘  └──────────────────┘
```

### Key Architecture Decisions (Best of Opus + Codex)

| Decision | Choice | Source | Rationale |
|----------|--------|--------|-----------|
| **Database API** | Cosmos DB **MongoDB API** | Opus | GeoJSON `2dsphere` indexes for `$geoNear` queries on historical event locations |
| **Daily ingest** | Azure Event Grid + Durable Functions | Codex | Better retry/observability than cron; separates time-triggered work from request path |
| **Geocoding NLP** | spaCy NER first | Codex | Cheaper than LLM for routine extraction |
| **Geocoding pipeline** | Multi-stage: cache → curated CSV → spaCy+Nominatim → Azure Maps | Opus | Historical place names need curated mappings ("Constantinople"→"Istanbul") |
| **Caching** | Redis (hot) + Cosmos (warm) + CDN (static assets) | Both | DailyDigest denormalized doc (Codex) for ultrafast reads |
| **Map projection** | Winkel Tripel primary + projection switching | Opus | National Geographic projection; switch to azimuthal for polar events |
| **Pin clustering** | Supercluster (d3-compatible) | Opus | Efficient at any zoom level; better than raw quadtree |
| **IaC** | Terraform (Bicep as alternative) | Both | Reproducible infrastructure |
| **Auth for admin** | Azure AD + Managed Identity (OIDC, no plaintext secrets) | Codex | Zero-secret architecture |
| **Static assets** | Azure Blob + CDN for TopoJSON/textures | Codex | Don't bundle map data in app responses |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Methodology** | Spec-Kit (SDD) | Spec-driven development; specs generate code, not the reverse |
| **Frontend** | React 18 + TypeScript + Vite | Modern DX, fast builds, strong typing |
| **Map** | D3.js + d3-geo-projection + TopoJSON | Artistic Winkel Tripel projection, vintage aesthetic |
| **State** | React Query (TanStack) | Stale-while-revalidate, prefetch next/prev day |
| **Backend** | Python 3.12 + FastAPI + uvicorn | Async support for geocoding/AI calls, great for data tasks |
| **NLP** | spaCy (en_core_web_sm) | GPE/LOC entity extraction for geocoding |
| **Database** | Azure Cosmos DB (MongoDB API, serverless) | Geo-spatial queries, flexible schema, cheap at low scale |
| **Cache** | Azure Cache for Redis | Hot cache for daily digests, geocode results |
| **Geocoding** | Nominatim (self-hosted Docker) + Azure Maps fallback | Historical coverage + commercial SLA fallback |
| **Ingestion** | Azure Event Grid + Durable Functions | Daily scheduled fetch with retry/observability |
| **CDN** | Azure Front Door + Blob Storage | TopoJSON, textures, static assets |
| **Hosting FE** | Azure Static Web Apps | Integrated CI/CD, global CDN |
| **Hosting BE** | Azure Container Apps | Serverless scaling, 0-to-N replicas |
| **IaC** | Terraform | Reproducible Azure infrastructure |
| **CI/CD** | GitHub Actions | Lint → test → build → deploy pipeline |
| **Secrets** | Azure Key Vault + Managed Identity | Zero plaintext secrets |
| **Monitoring** | Azure Application Insights + OpenTelemetry | Traces, metrics, logs |
| **Testing** | pytest + Vitest + Playwright + k6 | Unit/integration/E2E/load |

---

## Data Models

### Event Document (Cosmos `events` container, partition key: `isoDate`)

```typescript
interface HistoricalEvent {
  id: string;                    // UUID v7 (time-sortable)
  isoDate: string;               // "MM-DD" partition key
  source: "wikipedia";
  title: string;
  description: string;
  year: number;
  categories: EventCategory[];
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat] GeoJSON
    confidence: "high" | "medium" | "low" | "estimated";
    geocoder: "nominatim" | "azure_maps" | "curated";
    placeName: string;
    modernEquivalent?: string;     // "Constantinople" → "Istanbul"
  };
  media?: { imageUrl?: string; attribution?: string };
  provenance: {
    sourceUrl?: string;
  };
  createdAt: string;
}

type EventCategory =
  | "political" | "military" | "scientific" | "cultural"
  | "exploration" | "economic" | "religious" | "natural_disaster";
```

### DailyDigest Document (Cosmos `dailyDigests` container, partition key: `isoDate`)

```typescript
// Denormalized for ultrafast "render today's pins" reads
interface DailyDigest {
  isoDate: string;               // "MM-DD"
  events: string[];              // Event IDs
  summaryStats: {
    total: number;
    missingGeo: number;
  };
  generatedAt: string;
  ttl: number;                   // 86400 (24h auto-expire)
}
```

### API Contracts

```
GET  /api/v1/events?date=MM-DD&category=&source=
     → { data: HistoricalEvent[], meta: { total, cacheHit } }

GET  /api/v1/events/:id
     → HistoricalEvent

POST /api/v1/ingest/run?date=MM-DD   (admin, Azure AD protected)
     → 202 Accepted (triggers Event Grid)
```

---

## Geocoding Pipeline (Multi-Stage)

```
Event text → spaCy NER (GPE/LOC) → Curated historical CSV
                                        ↓ (miss)
                                    Nominatim (self-hosted)
                                        ↓ (miss)
                                    Azure Maps (paid fallback)
```

A curated `historical_places.csv` maps ~200 common historical names:
```
Constantinople → Istanbul (41.01, 28.98)
Prussia → Berlin (52.52, 13.41)
Gaul → Paris (48.86, 2.35)
Ceylon → Colombo (6.93, 79.86)
...
```

All geocode results cached in Redis (30-day TTL) + Cosmos `locationCache`.

---

## Spec-Kit Integration (SDD Workflow)

The project follows Spec-Driven Development using [github/spec-kit](https://github.com/github/spec-kit):

### 1. Bootstrap with `specify init`
```bash
pip install specify-cli
specify init --ai copilot   # Creates .github/agents/, memory/constitution.md, specs/, templates/
```

### 2. Constitution (`memory/constitution.md`)
Defines immutable architectural principles for Chrono Atlas:
- **I. Simplicity**: Max 3 projects (frontend, backend, infra). No speculative features.
- **II. Test-First**: Tests written before implementation. Contract tests for all APIs.
- **III. Integration-First**: Use real Cosmos/Redis in tests, not mocks (except external APIs).
- **IV. Observability**: All services log structured JSON. OpenTelemetry traces on every request.
- **V. Spec-as-Source**: Specs are the source of truth. Code is regenerated from specs.

### 3. Feature Development Workflow
Each feature follows the SDD cycle:
```bash
# Step 1: Create feature specification (what + why, no how)
/speckit.specify Historical event map with daily Wikipedia fetch and geocoded pins

# Step 2: Generate implementation plan (how, from spec)
/speckit.plan FastAPI backend, D3.js Winkel Tripel map, Cosmos MongoDB, Redis cache

# Step 3: Generate executable task list (from plan + data-model + contracts)
/speckit.tasks
```

This produces the following in `specs/001-historical-map/`:
```
specs/001-historical-map/
├── spec.md            # User stories, acceptance criteria, edge cases
├── plan.md            # Technical plan, architecture, project structure
├── research.md        # Library comparisons, API evaluations
├── data-model.md      # Event, DailyDigest, LocationCache schemas
├── contracts/         # OpenAPI specs, AI agent schemas
├── quickstart.md      # Key validation scenarios
└── tasks.md           # Executable task list with parallelization markers
```

### 4. Repo Structure (after spec-kit init)
```
chrono-atlas/
├── .github/
│   ├── agents/                  # Copilot agent commands (spec-kit)
│   ├── workflows/               # CI/CD pipelines
│   └── copilot-instructions.md
├── memory/
│   └── constitution.md          # Architectural principles (spec-kit)
├── specs/                       # Feature specifications (spec-kit)
│   └── 001-historical-map/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/             # D3.js map, projections, layers, pins
│   │   │   ├── EventDetail/     # Sidebar/modal for event info
│   │   │   └── DatePicker/      # Navigate dates
│   │   ├── hooks/               # useEvents, useMap, useClusters
│   │   ├── services/            # API client
│   │   └── types/               # Shared TypeScript types
│   ├── public/
│   │   └── data/                # TopoJSON (or served via CDN)
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── models/              # Pydantic models
│   │   ├── services/            # Wikipedia, geocoding, AI, cache
│   │   ├── agents/              # AI agent prompts + orchestrator
│   │   ├── api/                 # FastAPI routes
│   │   └── tasks/               # Cache pre-warming, daily ingest
│   ├── data/
│   │   └── historical_places.csv
│   ├── tests/
│   │   ├── contract/
│   │   ├── integration/
│   │   └── unit/
│   ├── pyproject.toml
│   └── Dockerfile
├── infra/
│   ├── main.tf                  # Terraform: Cosmos, Redis, Container Apps, etc.
│   ├── variables.tf
│   └── outputs.tf
├── docker-compose.yml           # Local dev: backend + Redis + Nominatim
├── README.md
└── .gitignore
```

---

## Workplan

### Phase 0-1: Project Bootstrap & Setup ✅
- [x] Create GitHub repo, spec-kit, constitution, backend, frontend, CI, local dev

### Phase 2: Backend Core — Data Ingestion & API ✅
- [x] Wikipedia "On This Day" fetcher + geocoding pipeline + events orchestration
- [x] Performance: 184 curated places, dedup, Nominatim cache
- [x] Fix event text: use Wikipedia `text` field, not article `extract`

### Phase 3: AI "See the Future" Mode (opt-in)
The default experience is a pure historical atlas. A **"See the Future 🔮"** toggle in the header lets users opt into fictional future events. When enabled:
- Fictional events appear alongside real ones, clearly marked with a distinct visual (blue pulsing pins, "Fictional" badge)
- A banner/disclaimer reminds users these are AI-generated positive visions of the future
- All fictional events must be **positive, uplifting, and fun** — no dystopia, conflict, or controversy
- 3-agent pipeline (Azure AI Foundry GPT-4o):
  - **Extractor Agent** (temp=0.1): Extracts/normalizes location names from event text
  - **Generator Agent** (temp=0.8): Creates fictional future events (2030-2200) with specific geocodable locations, grounded in real trends (space, climate, culture, food, sports)
  - **Validator Agent**: Scores plausibility (0-1), rejects negative/insensitive content, enforces positivity
- Fallback: curated pool of 60+ pre-written positive fictional events when AI is unavailable
- [ ] Add "See the Future 🔮" toggle to header UI
- [ ] Toggle controls `?includeFictional=true` query param to backend
- [ ] Backend only generates/returns fictional events when param is true
- [ ] Set up Azure AI Foundry project with GPT-4o deployment
- [ ] Implement 3-agent pipeline (Extractor → Generator → Validator)
- [ ] Add positivity guardrails to Validator agent prompt
- [ ] Wire into events service behind the toggle
- [ ] Disclaimer banner when fiction mode is active

### Phase 4: Frontend — Artistic Map & UI ✅
- [x] Fix camelCase API serialization (placeName, sourceUrl, isoDate)
- [x] Zoom/pan with d3-zoom (1x-8x), +/- controls
- [x] Pin hover tooltips (year + title)
- [x] EventDetail: inline card below map with slide-up animation
- [x] DatePicker: prev/next arrows, formatted date
- [x] App: flexbox layout, spinner, footer
- [x] Counter-scale pins on zoom (stay same visual size)
- [x] Use Wikipedia `extract` for description, `text` for title

### Phase 4b: Map Animations & Interactions
- [x] **Pin click → auto zoom-in**: When user clicks a pin, smoothly animate the map to center on that pin at ~3x zoom (close enough to focus, not too close to lose context). Use `d3.zoom.transform` with a transition (~750ms ease-in-out).
- [x] **Card close → auto zoom-out**: When user closes the detail card, smoothly animate the map back to the default view (1x zoom, centered). Same transition style.
- [x] Ensure pin counter-scaling works correctly during animated zoom transitions
- [x] **Selected pin visual differentiation**: The selected pin must be clearly distinguishable from all other pins. Use a combination of: gold/amber fill color (#e6a817), larger radius, a glowing ring animation, and dim/fade all non-selected pins to ~40% opacity. On deselect, restore all pins to normal.
- [x] **Restore previous zoom on card close**: Before zooming to a pin, save the current zoom transform. On card close, restore to that saved transform instead of always resetting to 1x world view. This preserves the user's zoom/pan context.

### Phase 4c: Dark Cosmic Theme
- [x] Dark radial gradient background (deep space blues)
- [x] Update all component colors: header, footer, DatePicker, EventDetail, ChronoMap controls
- [x] Frosted glass event detail card (backdrop-filter blur)
- [x] Canvas-based animated star field (280 stars, varied sizes/tints/twinkle speeds)
- [x] Shooting star animations (random interval 4–12s, gradient trail + head glow)
- [x] Respect `prefers-reduced-motion` (static stars, no shooting stars)

### Phase 5: Testing, Quality & DevEx
- [x] Backend integration tests (43 tests passing)
- [x] Frontend component tests (9 tests passing)
- [x] Edge cases: Feb 30/month 13 → 422, missing event ID → 404
- [x] E2E flow testing (9 Playwright tests: load, navigate, pin click, detail card, zoom, keyboard)
- [x] Performance optimization (code splitting: React/D3/CosmicCanvas chunks, lazy-loaded decorative canvas)

### Phase 5b: Python Environment — uv Setup
- [x] Install `uv` and create virtual environment
- [x] Generate `uv.lock` lockfile for reproducible builds
- [x] Update `pyproject.toml` for uv compatibility (hatchling build backend)
- [x] Update README/docs with `uv` dev setup instructions
- [x] Update CI pipeline to use `uv` for installs

### Phase 6-7: Azure Deployment & Launch

---

## Notes & Considerations

- **Spec-Kit SDD**: Every feature starts as a spec (`/speckit.specify`), gets a plan (`/speckit.plan`), and produces tasks (`/speckit.tasks`). Specs are versioned in feature branches and merged via PR. This keeps the project disciplined as it grows.
- **Wikipedia API** is free, no auth needed, ~200 req/s rate limit — more than enough.
- **Geocoding is the hardest part**: The multi-stage pipeline (spaCy → curated CSV → Nominatim → Azure Maps → AI) handles historical names, modern names, and ambiguous references. Events without a resolvable location get a "general" pin at the country center with a dashed outline.
- **DailyDigest pattern** (from Codex): Pre-compute a denormalized digest document per day for instant reads. The ingest pipeline writes both individual events and the digest.
- **Event Grid** (from Codex): Decouples the daily fetch from the request path. Better retry logic and observability than a cron job inside the container.
- **Redis + Cosmos double cache**: Redis for hot data (today's digest, recent geocodes), Cosmos for warm data (all events, historical). Redis TTL 24h for digests, 30d for geocodes.
- **Costs at low traffic**: Cosmos DB serverless ~$0.25/million RUs, Redis Basic ~$16/mo, Container Apps ~$0 at low scale, Static Web Apps free tier. Total estimated: **< $20/month**.
- **D3.js artistic projection**: Winkel Tripel (National Geographic standard) with a vintage paper texture, warm earth tones, and subtle graticules. We'll prototype Robinson as well and pick the most beautiful.

---

## Comparison: What Came from Each Model

| Aspect | Opus Contribution | Codex Contribution |
|--------|-------------------|---------------------|
| Geocoding pipeline (4 stages) | ✅ Historical CSV | spaCy NER first (cheaper) ✅ |
| DailyDigest denormalized doc | — | ✅ Ultrafast reads |
| Event Grid for daily ingest | — | ✅ Better than cron |
| Supercluster for pin clustering | ✅ | quadtree (simpler) |
| Projection switching | ✅ | Single projection |
| Redis + Cosmos double cache | Mentioned | ✅ Detailed strategy |
| OIDC + Managed Identity | — | ✅ Zero-secret arch |
| k6 load testing | — | ✅ |
| Detailed code examples | ✅ Extensive | Concise |
| Security middleware | ✅ Comprehensive | Key points |
| CDN for TopoJSON/textures | — | ✅ |
