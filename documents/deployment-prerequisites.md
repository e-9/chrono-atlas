# Phase 6-7: Deployment Prerequisites & Resources

> **Scope**: Historical events only (no AI Foundry / fictional events)
> **Reviewed by**: GPT-5.1-Codex + Claude Opus 4.5

---

## Key Finding

The backend is currently **stateless** — Wikipedia + Nominatim are called at runtime, results cached in-memory. No database or Redis are wired up despite being declared as dependencies. Both reviewers agreed: **don't over-engineer for low traffic**.

---

## Final Azure Resources

### 1. Azure Static Web Apps (Free tier) ✅
- **Purpose**: Host the React SPA (frontend)
- **Justification**: Built-in CI/CD from GitHub Actions, global CDN, custom domain support, HTTPS by default. Free tier is more than sufficient.
- **Cost**: $0/mo

### 2. Azure Container Apps (Consumption plan, `minReplicas: 1`) ✅
- **Purpose**: Host the FastAPI backend
- **Justification**: Serverless Docker-native hosting, no cluster management. Setting `minReplicas: 1` keeps the in-memory cache warm and avoids cold-start latency (~3-5s) that would degrade user experience. The app is stateless so scaling out is trivial if needed later.
- **Cost**: ~$5-7/mo

### 3. Azure Key Vault ✅
- **Purpose**: Store any future secrets (API keys, connection strings)
- **Justification**: Free at low usage. Establishes zero-plaintext-secret practice from day one with Managed Identity integration. Even without a database today, it's the right place for any config that shouldn't be in code.
- **Cost**: $0/mo

### 4. Azure Application Insights ✅
- **Purpose**: Monitoring, logging, error tracking
- **Justification**: Essential for debugging production issues (geocoding failures, Wikipedia API changes, Nominatim rate limits). OpenTelemetry dependencies are already declared. 5GB/mo free ingestion is plenty.
- **Cost**: $0/mo (free tier)

---

## Resources Deferred (add when needed)

| Resource | When to Add | Trigger |
|----------|-------------|---------|
| **Azure Cosmos DB** (or Table Storage) | When persistence is needed | User accounts, saved views, or if cache rebuilds become too slow |
| **Azure Cache for Redis** | When multi-instance caching is needed | Scaling beyond 1 replica where in-memory cache diverges |
| **Azure Front Door + WAF** | When traffic grows | Need for DDoS protection, geo-routing, or WAF rules |
| **Azure Event Grid** | When scheduled ingest is needed | Pre-warming caches overnight instead of on-demand |

### Why Redis was removed
Both reviewers agreed: Redis accounts for **~64% of the budget** ($16/mo) for marginal benefit. The cache data is tiny (~10MB for all 366 days of events + geocodes). With `minReplicas: 1`, the in-memory cache survives normal operation. Occasional container restarts just trigger a warm-up — annoying but not catastrophic.

### Why Cosmos DB was deferred
Wikipedia events are fetched on-demand (free, idempotent). Nominatim results rebuild in <20 minutes. Curated places are bundled in the Docker image. There's nothing that truly *requires* persistence today. If persistence becomes needed, **Azure Table Storage** (~$0.05/mo) is far cheaper than Cosmos DB for simple key-value caching.

---

## Resources Removed (not needed)

| Original Resource | Why Removed |
|---|---|
| Azure AI Foundry (GPT-4o) | No fictional events — historical only |
| Azure Front Door + WAF | Overkill — Static Web Apps has built-in CDN; Container Apps has built-in HTTPS ingress |
| Azure Event Grid + Durable Functions | No scheduled ingest — events fetched on-demand |
| Azure Blob Storage + CDN | TopoJSON bundled with frontend build (77KB) |
| Azure Maps | Nominatim + curated CSV handles 95%+ of historical places |

---

## Tools & CLI Prerequisites

| Tool | Purpose |
|---|---|
| **Azure subscription** | Active account with billing enabled |
| **Azure CLI** (`az`) | Terraform provider authentication + manual operations |
| **Terraform CLI** | Infrastructure as Code for all resources |
| **GitHub repo secrets** | `AZURE_CREDENTIALS` for CI/CD deployment pipeline |

---

## Pre-deployment Checklist (code changes needed)

| Item | Priority | Details |
|------|----------|---------|
| Health check endpoint | High | Container Apps needs `GET /health` for liveness/readiness probes (already exists) |
| CORS configuration | High | Can be relaxed since API is internal-only — only SWA proxy calls it |
| Nominatim rate limiting | Medium | Add backoff/retry for Nominatim's 1 req/sec limit to avoid bans in production |
| Container Apps ingress | High | Set to **internal only** — not exposed to public internet |
| SWA API routing | High | Configure Static Web Apps `staticwebapp.config.json` to proxy `/api/*` → Container Apps internal URL |

---

## Cost Summary

| Resource | Monthly Cost |
|----------|-------------|
| Static Web Apps (Free) | $0 |
| Container Apps (min 1 replica) | ~$5-7 |
| Key Vault | $0 |
| Application Insights | $0 |
| **Total** | **~$5-7/mo** |

> Down from the original ~$20/mo estimate. Add Cosmos DB (~$1-2/mo) or Table Storage (~$0.05/mo) only when persistence is actually needed.
