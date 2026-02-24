# Chrono Atlas — System Architecture

> Historical events only (no AI Foundry). Based on final deployment prerequisites.

## Architecture Diagram

```mermaid
graph TB
    subgraph User["🌍 User (Browser)"]
        Browser["React SPA + D3.js Globe"]
    end

    subgraph Azure["☁️ Azure Cloud"]
        subgraph Frontend["Azure Static Web Apps (Free)"]
            SWA["React SPA<br/>Vite build output<br/>Built-in CDN + HTTPS"]
            Proxy["API Proxy<br/>/api/* → Container Apps<br/>(staticwebapp.config.json)"]
        end

        subgraph Backend["Azure Container Apps (Internal Ingress Only 🔒)"]
            subgraph Container["FastAPI Container (minReplicas: 1)"]
                API["FastAPI<br/>GET /api/v1/events?date=MM-DD<br/>GET /api/v1/events/:id<br/>GET /health"]
                
                subgraph Services["Services"]
                    WikiSvc["Wikipedia<br/>Fetcher"]
                    GeoSvc["Geocoding<br/>Pipeline"]
                    SpaCy["spaCy NER<br/>(en_core_web_sm)"]
                end
                
                subgraph Cache["In-Memory Cache"]
                    EventsCache["Events Cache<br/>366 keys × ~50 events<br/>~9MB"]
                    GeoCache["Geocode Cache<br/>~1000 places<br/>~200KB"]
                end
                
                CSV["historical_places.csv<br/>203 curated mappings<br/>(bundled in image)"]
            end
        end

        KV["🔑 Azure Key Vault<br/>Secrets + Managed Identity"]
        AI["📊 Application Insights<br/>OpenTelemetry traces<br/>Logs + metrics"]
    end

    subgraph External["🌐 External APIs"]
        Wiki["Wikipedia API<br/>wikimedia.org/feed/v1<br/>On This Day events"]
        Nom["Nominatim API<br/>openstreetmap.org<br/>Geocoding (1 req/sec)"]
    end

    %% User interactions
    Browser -->|"HTTPS"| SWA
    SWA -->|"Serves static files<br/>(JS, CSS, TopoJSON)"| Browser
    Browser -->|"/api/* requests"| Proxy
    Proxy -->|"Internal network only 🔒<br/>Not exposed to internet"| API

    %% Backend → External
    WikiSvc -->|"GET onthisday/all/{month}/{day}<br/>httpx async"| Wiki
    GeoSvc -->|"GET /search?q={place}<br/>httpx async"| Nom
    GeoSvc --> SpaCy
    GeoSvc -->|"Lookup first"| CSV

    %% Internal flow
    API --> WikiSvc
    API --> GeoSvc
    WikiSvc -->|"Store results"| EventsCache
    GeoSvc -->|"Store results"| GeoCache

    %% Azure services
    Container -.->|"Managed Identity"| KV
    Container -.->|"Telemetry"| AI

    %% Styling
    classDef azure fill:#0078d4,stroke:#005a9e,color:#fff
    classDef external fill:#2d6a4f,stroke:#1b4332,color:#fff
    classDef cache fill:#e6a817,stroke:#b8860b,color:#000
    classDef user fill:#7b2cbf,stroke:#5a189a,color:#fff

    class SWA,Proxy,API,KV,AI azure
    class Wiki,Nom external
    class EventsCache,GeoCache cache
    class Browser user
```

## Request Flow

```mermaid
sequenceDiagram
    participant U as 🌍 User
    participant S as Static Web Apps
    participant A as Container Apps (FastAPI)
    participant C as In-Memory Cache
    participant W as Wikipedia API
    participant G as Nominatim
    participant CSV as Curated CSV

    U->>S: Load page
    S-->>U: React SPA + TopoJSON (77KB)
    
    U->>A: GET /api/v1/events?date=02-17
    A->>C: Check events cache
    
    alt Cache HIT
        C-->>A: Cached events
        A-->>U: { data: [...], meta: { cacheHit: true } }
    else Cache MISS
        A->>W: GET onthisday/all/2/17
        W-->>A: Raw Wikipedia events
        
        loop For each event
            A->>C: Check geocode cache
            alt Geocode cached
                C-->>A: Cached coordinates
            else Not cached
                A->>CSV: Lookup curated places
                alt Found in CSV
                    CSV-->>A: Coordinates (e.g., Constantinople → Istanbul)
                else Not in CSV
                    A->>A: spaCy NER → extract place name
                    A->>G: GET /search?q={place}
                    G-->>A: Coordinates
                end
                A->>C: Store in geocode cache
            end
        end
        
        A->>C: Store in events cache
        A-->>U: { data: [...], meta: { cacheHit: false } }
    end
```

## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    AZURE CLOUD (~$5-7/mo)                     │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │ Static Web Apps     │    │ Container Apps          🔒   │ │
│  │ (Free tier)         │    │ (Internal ingress only)      │ │
│  │                     │    │                              │ │
│  │ • React SPA         │    │ • FastAPI + uvicorn          │ │
│  │ • D3.js + TopoJSON  │    │ • spaCy NER model           │ │
│  │ • Built-in CDN      │───►│ • In-memory cache (~10MB)   │ │
│  │ • HTTPS             │proxy│ • Curated places CSV        │ │
│  │ • CI/CD from GitHub │/api│ • Health check endpoint      │ │
│  │                     │    │                              │ │
│  │ staticwebapp.config │    │ NOT exposed to internet      │ │
│  │ routes /api/* ──────┼───►│ Only accessible via SWA      │ │
│  └─────────────────────┘    └──────┬───────────┬───────────┘ │
│                                    │           │              │
│  ┌─────────────────────┐     ┌─────┘     ┌─────┘             │
│  │ Key Vault ($0)      │     │           │                   │
│  │ • Secrets           │     │           │                   │
│  │ • Managed Identity  │     │           │                   │
│  └─────────────────────┘     │           │                   │
│                              │           │                   │
│  ┌─────────────────────┐     │           │                   │
│  │ App Insights ($0)   │     │           │                   │
│  │ • OpenTelemetry     │     │           │                   │
│  │ • Logs + Metrics    │     │           │                   │
│  └─────────────────────┘     │           │                   │
└──────────────────────────────┼───────────┼───────────────────┘
                               │           │
                    ┌──────────▼──┐  ┌─────▼──────────┐
                    │ Wikipedia   │  │ Nominatim      │
                    │ API (free)  │  │ API (free)     │
                    │ • On This   │  │ • Geocoding    │
                    │   Day feed  │  │ • 1 req/sec    │
                    └─────────────┘  └────────────────┘
```
