# Chrono Atlas

> Explore history, one day at a time.

A beautiful interactive map that visualizes historical events that happened "on this day" across the centuries. Built with D3.js, React, FastAPI, and Azure AI.

## Features

- 🗺️ Artistic Winkel Tripel world map with vintage styling
- 📍 Historical events pinned to their real-world locations
- 🤖 AI-generated fictional future events when history is sparse
- 📅 Browse any day of the year
- ⚡ Fast, cached, and beautiful

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + D3.js |
| Backend | Python 3.12 + FastAPI |
| Database | Azure Cosmos DB (MongoDB API) |
| AI | Azure AI Foundry (GPT-4o) |
| Hosting | Azure Static Web Apps + Container Apps |

## Development

```bash
# Prerequisites: Node.js 20+, Python 3.12+, Docker

# Clone and install
git clone https://github.com/e-9/chrono-atlas.git
cd chrono-atlas

# Backend
cd backend && pip install -e '.[dev]' && cd ..

# Frontend
cd frontend && npm install && cd ..

# Run locally
docker compose up
```

## Methodology

This project follows [Spec-Driven Development (SDD)](https://github.com/github/spec-kit). Specifications are the source of truth — code is generated from specs.

## License

MIT

