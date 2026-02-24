# Security Review — Chrono Atlas Deployment

> **Reviewed by**: GPT-5.1-Codex + Claude Opus 4.5 (security perspective)
> **Scope**: Historical events only, Azure deployment with internal-only backend

---

## Consolidated Findings

### 🔴 Critical

| # | Finding | Source | Action |
|---|---------|--------|--------|
| 1 | **No security headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | Both | Create `staticwebapp.config.json` with `globalHeaders` |

### 🟠 High

| # | Finding | Source | Action |
|---|---------|--------|--------|
| 2 | **No API rate limiting** — each cache-miss triggers Wikipedia + Nominatim + spaCy NER (CPU-intensive). Attacker could exhaust resources or get Nominatim IP banned | Both | Add `slowapi` rate limiter (e.g., 10 req/min per IP) |
| 3 | **Unpinned Python dependencies** — `pyproject.toml` has no version pins. Malicious package update could compromise builds | Both | Pin major.minor versions (e.g., `fastapi>=0.115,<0.116`) |
| 4 | **No dependency vulnerability scanning** — no Dependabot, Snyk, or pip-audit in CI | Both | Enable Dependabot for `pip` + `npm` ecosystems |
| 5 | **No container image scanning** — Docker images not scanned for CVEs | Opus | Add Trivy or similar to CI pipeline |

### 🟡 Medium

| # | Finding | Source | Action |
|---|---------|--------|--------|
| 6 | **CORS overly permissive** — `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]` in `main.py`. Unnecessary for read-only API | Both | Tighten to `allow_credentials=False`, `allow_methods=["GET", "OPTIONS"]` |
| 7 | **Event ID not validated** — `GET /events/:id` accepts any string, could cause log injection | Both | Add UUID validation via Pydantic |
| 8 | **Docker base image not pinned** — `FROM python:3.12-slim` could change between builds | Both | Pin to specific digest: `python:3.12-slim@sha256:<digest>` |
| 9 | **docker-compose.yml contains plaintext Cosmos emulator connection string** | Opus | Move to `.env` file (already gitignored) |
| 10 | **Structlog uses ConsoleRenderer** — dev-style logs in production could leak info to App Insights | Opus | Switch to `JSONRenderer()` when not in debug mode |
| 11 | **Unbounded in-memory cache** — no max size on `_events_cache` or `_nominatim_cache` | Opus | Use `cachetools.TTLCache(maxsize=500, ttl=3600)` |
| 12 | **spaCy model downloaded at CI runtime** — integrity not verified | Both | Cache model in Docker layer, verify checksum |
| 13 | **CI/CD uses service principal secrets** — long-lived `AZURE_CREDENTIALS` | Both | Migrate to OIDC federated identity for GitHub Actions |
| 14 | **No SWA→Container Apps request signing** — traffic within Azure is unverified | Codex | Consider signed headers or Mutual TLS between SWA and backend |

### 🟢 Low

| # | Finding | Source | Action |
|---|---------|--------|--------|
| 15 | **Wikipedia data could contain XSS payloads** | Both | React's default escaping handles this; verify no `dangerouslySetInnerHTML` |
| 16 | **Place name passed to Nominatim unsanitized** | Opus | Add length limit (`place_name[:200].strip()`) for defense-in-depth |
| 17 | **SWA proxy wildcard** — ensure no path traversal in `/api/*` routing | Codex | Verify `staticwebapp.config.json` denies unknown paths |

---

## Priority Action Plan (before production)

### Batch 1 — Quick wins (low effort, high impact)
1. ✏️ Create `frontend/staticwebapp.config.json` with security headers
2. ✏️ Tighten CORS in `backend/src/api/main.py`
3. ✏️ Pin Python dependency versions in `pyproject.toml`
4. ✏️ Add `.github/dependabot.yml` for automated vulnerability alerts
5. ✏️ Move docker-compose secrets to `.env` file

### Batch 2 — Code changes (medium effort)
6. 🔧 Add `slowapi` rate limiting to FastAPI routes
7. 🔧 Add UUID validation on `event_id` parameter
8. 🔧 Switch structlog to JSON renderer in production
9. 🔧 Bound in-memory caches with `cachetools.TTLCache`
10. 🔧 Add Nominatim place name length limit

### Batch 3 — CI/DevOps (medium effort)
11. 🔧 Pin Docker base image digest
12. 🔧 Add Trivy container scanning to CI
13. 🔧 Cache spaCy model in Docker layer
14. 🔧 Migrate from `AZURE_CREDENTIALS` to OIDC federated identity

---

## What Both Reviewers Agreed On

- ✅ **Internal-only ingress is solid** — the SWA proxy pattern is the right approach
- ✅ **Key Vault + Managed Identity is correct** — no plaintext secrets at runtime
- ✅ **No auth needed** for read-only public content
- ✅ **Removing Front Door/WAF is fine** — SWA free tier has basic DDoS protection
- ⚠️ **Rate limiting is the biggest gap** — without it, an attacker can burn through Nominatim rate limits and spike Container Apps costs
- ⚠️ **Security headers are a must** — trivial to add, significant protection

---

## Model-Specific Insights

### Codex highlighted:
- Mutual TLS / signed headers between SWA and Container Apps for zero-trust internal networking
- Health endpoint should be IP-restricted to prevent reconnaissance
- SAST/DAST tooling (CodeQL, OWASP ZAP) for automated security testing

### Opus highlighted:
- Specific code locations for each finding (file + line numbers)
- Unbounded in-memory cache as a memory exhaustion vector
- Console log renderer leaking debug info to App Insights
- docker-compose containing emulator connection string in plaintext
