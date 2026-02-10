# Chrono Atlas Constitution

## Core Principles

### I. Simplicity
- Maximum 3 top-level projects: `frontend/`, `backend/`, `infra/`
- No speculative or "might need" features — every feature traces to a user story
- Start simple, add complexity only when proven necessary (YAGNI)
- No future-proofing abstractions

### II. Test-First (NON-NEGOTIABLE)
- All implementation MUST follow Test-Driven Development
- Contract tests for all API endpoints before implementation
- Tests must be written, validated, and confirmed to FAIL before writing implementation code
- Red → Green → Refactor cycle strictly enforced

### III. Integration-First Testing
- Prefer real databases over mocks for integration tests
- Use actual Redis/Cosmos instances in test environments
- Mock only external APIs (Wikipedia, Azure Maps, AI Foundry) with recorded fixtures
- Contract tests mandatory before implementation

### IV. Observability
- All services log structured JSON via Python `structlog` / frontend console
- OpenTelemetry traces on every API request
- Text I/O ensures debuggability — all services must be inspectable
- Health check endpoints on every service

### V. Spec-as-Source
- Specifications (in `specs/`) are the source of truth
- Code is generated from specs, not the other way around
- Maintaining software means evolving specifications first
- Every technical choice links back to a specific requirement in the spec

### VI. Security by Default
- Zero plaintext secrets — use Azure Managed Identity + Key Vault
- All user input validated and sanitized (Pydantic models)
- CORS restricted to known origins only
- Rate limiting on all public endpoints
- AI-generated content audit logged

## Technology Constraints

- **Frontend**: React 18 + TypeScript + Vite + D3.js — no other UI frameworks
- **Backend**: Python 3.12 + FastAPI — no Django, Flask, or other frameworks
- **Database**: Azure Cosmos DB (MongoDB API) — partition by `isoDate`
- **Cache**: Azure Cache for Redis — TTL-based expiry
- **AI**: Azure AI Foundry (GPT-4o) with function calling — structured JSON output
- **IaC**: Terraform — no ARM templates or manual provisioning

## Development Workflow

1. Every feature starts as a spec (`/speckit.specify`)
2. Spec produces a plan (`/speckit.plan`)
3. Plan produces tasks (`/speckit.tasks`)
4. Tasks are implemented following TDD (test first, then code)
5. All changes go through PR with CI passing

## Governance

- Constitution supersedes all other practices
- Amendments require documented rationale and PR approval
- Complexity must be justified in the plan's "Complexity Tracking" section

**Version**: 1.0.0 | **Ratified**: 2026-02-10
