# University ERP Companion Platform — Documentation

> **Last Updated:** 2026-04-06  
> **Version:** 2.0.0

---

## What Is This?

A **middleware platform** that wraps the SRM AP University ERP system. It scrapes, parses, caches, and presents ERP data through a modern React frontend while also hosting independent application modules (events, content, resources) that the ERP does not provide.

---

## Documentation Map

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Project Overview](./01-OVERVIEW.md) | Vision, stakeholders, feature summary, tech stack |
| 02 | [System Architecture](./02-ARCHITECTURE.md) | Layered architecture, data flow diagrams, component map |
| 03 | [Backend Deep-Dive](./03-BACKEND-DEEP-DIVE.md) | Express app, server bootstrap, services, middleware, utilities |
| 04 | [Frontend Deep-Dive](./04-FRONTEND-DEEP-DIVE.md) | React SPA, routing, components, pages, state management |
| 05 | [ERP Integration](./05-ERP-INTEGRATION.md) | Playwright requests, HTML parsing, session handling, document builder |
| 06 | [Data Pipeline & Transformers](./06-DATA-PIPELINE.md) | Blueprint system, transformer registry, schema validation, pipeline |
| 07 | [API Reference](./07-API-REFERENCE.md) | Every HTTP endpoint, request/response shapes, error codes |
| 08 | [Configuration Reference](./08-CONFIGURATION.md) | Environment variables, feature flags, page policies, cache TTLs |
| 09 | [Infrastructure & Deployment](./09-INFRASTRUCTURE.md) | Docker, Nginx, Redis, monitoring, runbooks |
| 10 | [Development Guide](./10-DEVELOPMENT-GUIDE.md) | Local setup, running, testing, debugging, common pitfalls |
| 11 | [Extending the System](./11-EXTENDING-THE-SYSTEM.md) | Adding new ERP pages, new modules, new renderers, new services |

---

## Quick-Start

```bash
# 1. Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 2. Start Backend
cd Backend && npm install && npm run dev

# 3. Start Frontend (separate terminal)
cd Frontend && npm install && npm run dev

# 4. Open http://localhost:5173
```

---

## Key Concepts at a Glance

| Concept | Brief |
|---------|-------|
| **PageBlueprint** | Central config object mapping a frontend route to its ERP fetch keys, renderer type, and source mode |
| **scrapeTargets** | Maps a `pageKey` to an array of `{ dropdown, subitem }` selectors used to resolve ERP endpoints |
| **ErpAggregationService** | Orchestrates cache-first/live-first data resolution with circuit breakers, distributed locks, and request deduplication |
| **ErpDocumentBuilder** | Converts raw Cheerio-parsed HTML into a typed AST (`ErpDocument → ErpNode` tree) consumed by the frontend renderer |
| **erpTransformers** | Frontend-side pure functions that transform raw ERP batch responses into typed domain models (attendance, timetable, marks, etc.) |
| **executePipeline** | Entry point that runs a transformer and validates its output against an explicit schema |
| **PagePolicyStore** | Decides per-pageKey whether to use `cached-first` or `live-first` strategy |

---

## Repository Layout

```
University-ERP/
├── Backend/
│   ├── src/
│   │   ├── app.js                 # Express app factory
│   │   ├── server.js              # Bootstrap, DI wiring, graceful shutdown
│   │   ├── config/                # env.js, scrapeTargets.js, policies
│   │   ├── routes/                # All route handlers
│   │   ├── services/              # Core business logic (19 service files)
│   │   ├── middleware/            # Rate limiting, request context
│   │   └── utils/                 # Logger, cookies, API response, text
│   ├── data/                      # SQLite DBs, endpoint discovery, ERP dumps
│   ├── scripts/                   # Offline discovery & maintenance scripts
│   ├── test/                      # Test suites
│   └── load-tests/               # k6 performance tests
├── Frontend/
│   ├── src/
│   │   ├── main.tsx               # Entry point, router setup
│   │   ├── config/erpBlueprints.ts# All page blueprints, nav config
│   │   ├── lib/                   # erpApi, session, erpTransformers
│   │   ├── components/            # Shared UI + ERP renderer
│   │   ├── pages/                 # 19 page directories
│   │   ├── hooks/                 # Custom React hooks
│   │   └── styles.css             # Global styles
│   └── vite.config.ts
├── infra/                         # Docker, Nginx, monitoring, runbooks
├── Architecture.md                # High-level arch overview
├── docker-compose.yml             # Simple local dev compose
└── docs/                          # ← YOU ARE HERE
```
