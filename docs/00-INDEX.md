# University ERP Companion Platform — Documentation

> **Last Updated:** 2026-08-29
> **Status:** Active. Each doc below is the canonical reference for its topic.

## What Is This?

A **middleware platform** that wraps the SRM AP University ERP system. It scrapes, parses, caches, and presents ERP data through a modern React frontend while also hosting independent application modules (events, content, resources) that the ERP does not provide.

## Documentation Map

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Project Overview](./01-OVERVIEW.md) | Vision, stakeholders, feature summary, tech stack |
| 08 | [Configuration Reference](./08-CONFIGURATION.md) | Environment variables, feature flags, page policies, cache TTLs |
| 09 | [Infrastructure & Deployment](./09-INFRASTRUCTURE.md) | Docker, Nginx, Redis, monitoring, runbooks |
| 14 | [Production Readiness Checklist](./14-PROD-READINESS-CHECKLIST.md) | Verified go-live checklist: security, backups, alerting, CI, testing gaps |
| 15 | [Debugging Notes](./15-DEBUGGING-NOTES.md) | Real failures I hit and the 30-second checks that would have caught them |
| 16 | [Contributor Cleanup](./16-CONTRIBUTOR-CLEANUP.md) | How the contributor-rewriting rewrite was done and how to re-run it |
| 17 | [Deployment Guide](./17-DEPLOYMENT-GUIDE.md) | Free-tier, single-VM deployment walkthrough |

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

## Repository Layout

```
University-ERP/
├── Backend/
│   ├── src/
│   │   ├── app.js                 # Express app factory
│   │   ├── server.js              # Bootstrap, DI wiring, graceful shutdown
│   │   ├── config/                # env.js, scrapeTargets.js, policies
│   │   ├── routes/                # All route handlers
│   │   ├── services/              # Core business logic
│   │   ├── middleware/            # Rate limiting, request context
│   │   └── utils/                 # Logger, cookies, API response, text
│   ├── data/                      # SQLite DBs, endpoint discovery, ERP dumps
│   ├── scripts/                   # Offline discovery & maintenance scripts
│   └── test/                      # Test suites
├── Frontend/
│   ├── src/
│   │   ├── main.tsx               # Entry point, router setup
│   │   ├── config/erpBlueprints.ts# All page blueprints, nav config
│   │   ├── lib/                   # erpApi, session, erpTransformers
│   │   ├── components/            # Shared UI + ERP renderer
│   │   ├── pages/                 # Page directories
│   │   ├── hooks/                 # Custom React hooks
│   │   └── styles.css             # Global styles
│   └── vite.config.ts
├── Scraper/                       # Python career scraper
├── infra/                         # Docker, Nginx, monitoring, runbooks
└── docs/                          # ← YOU ARE HERE
```

## Build & Test Commands

```bash
# Backend
cd Backend
node --test test/                       # 245 tests
npm run dev                              # dev server on :5500

# Frontend
cd Frontend
npx tsc --noEmit -p tsconfig.json        # type check
npm run build                            # production build
npm test -- --run                        # 1188 vitest tests

# Real-stack e2e (boots real backend + frontend, runs Playwright)
bash Backend/scripts/e2e-stack/start.sh up
cd Frontend
E2E_BACKEND_URL=http://127.0.0.1:5500 \
E2E_FRONTEND_URL=http://127.0.0.1:5500 \
  npx playwright test --config=playwright.config.realstack.ts
bash Backend/scripts/e2e-stack/start.sh down
```

## AI Assistant Configs

`AGENTS.md` and `CLAUDE.md` at the repo root contain the same product design context
(brand personality, visual direction, design principles, brand colors). Both are
intentionally kept as separate files because some agents look for one or the other.
