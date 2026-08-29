# University ERP Companion Platform — Documentation

> **Last Updated:** 2026-08-30
> **Status:** Open-source-ready. Every doc on this index describes the code as it
> exists in the repo. If you find a discrepancy, the **code is right**;
> open a PR to fix the doc.

## What is this project?

A student-facing middleware that wraps the legacy SRM AP University ERP
(`student.srmap.edu.in`). The platform scrapes, parses, caches, and
presents ERP data through a modern React frontend, and also hosts
platform-native features (events, content, career portal, helpdesk,
LMS) that the ERP itself does not provide.

- **Backend:** Node.js ≥22.5, Express 5, `node:sqlite` (built-in), Playwright
  for the live ERP scraper, Redis for sessions/cache/rate-limits, ~340
  HTTP endpoints under `/api`.
- **Frontend:** React 19, Vite 7, TypeScript, Tailwind 4, React Router 7,
  TanStack React Query 5, Radix UI, ~80 pages across 14 page directories.
- **Storage:** 14 SQLite DBs (WAL mode), Redis namespaces, and a directory
  tree for uploads / certificates / submissions / events / ERP dumps.
- **Infra:** Single-VM Compose deploy, in-container nginx for TLS, optional
  Prometheus + Grafana + Loki + Promtail + Alertmanager observability
  override.

## How to read this doc set

If you're new to the project, read in this order:

1. **[01 — Overview](./01-OVERVIEW.md)** — vision, users, feature list,
   tech stack, design principles.
2. **[02 — Architecture](./02-ARCHITECTURE.md)** — system shape, data
   flow, sequence diagrams (request lifecycle, ERP scrape, cache
   invalidation, write paths), deployment topology.
3. **[03 — Backend](./03-BACKEND.md)** — per-module deep-dive.
4. **[04 — Frontend](./04-FRONTEND.md)** — per-page reference.
5. **[05 — Data](./05-DATA.md)** — every SQLite schema, Redis namespace,
   file layout, backup strategy.
6. **[06 — ERP Integration](./06-ERP-INTEGRATION.md)** — Playwright
   pipeline, scraping, cache strategy, transformers.

If you're contributing, also read:

7. **[07 — API Reference](./07-API-REFERENCE.md)** — every endpoint
   (auto-generated from `Backend/src/routes/`).
8. **[10 — Development](./10-DEVELOPMENT.md)** — local setup, debugging,
   adding features.
9. **[11 — Testing](./11-TESTING.md)** — test strategy, layers, how to
   write tests.
10. **[12 — Contributing](./12-CONTRIBUTING.md)** — PR flow, code style,
    commit hygiene.

If you're deploying or operating, the reference set is:

- **[08 — Configuration](./08-CONFIGURATION.md)** — every env var, feature
  flag, page policy.
- **[09 — Infrastructure](./09-INFRASTRUCTURE.md)** — Compose layout,
  Dockerfile, Nginx, Redis, monitoring.
- **[14 — Production Readiness Checklist](./14-PROD-READINESS-CHECKLIST.md)**
  — the go-live sign-off.
- **[17 — Deployment Guide](./17-DEPLOYMENT-GUIDE.md)** — free-tier,
  single-VM deployment walkthrough.

The remaining docs are operational / historical:

- **[15 — Debugging Notes](./15-DEBUGGING-NOTES.md)** — recurring failure
  modes and the 30-second checks that would have caught them.
- **[16 — Contributor Cleanup](./16-CONTRIBUTOR-CLEANUP.md)** — the
  `git filter-repo` rewrite that consolidated the contributor list.

## Quick start (local dev)

```bash
# 1. Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 2. Start Backend
cd Backend && npm install && npm run dev
# backend on http://localhost:5000

# 3. Start Frontend (separate terminal)
cd Frontend && npm install && npm run dev
# frontend on http://localhost:5173

# 4. Open http://localhost:5173
```

The backend has a built-in e2e launcher (`Backend/scripts/e2e-stack/start.sh`)
that boots a fixture-seeded backend on port 5500 (avoids clash with the
port-5000 dev backend) for the Playwright real-stack suite. See
**[10 — Development](./10-DEVELOPMENT.md)** for the full local setup.

## Repository layout

```
University-ERP/
├── Backend/                # Node 22 + Express 5 + node:sqlite
│   ├── src/
│   │   ├── app.js          # Express app factory (DI'd services → routers)
│   │   ├── server.js       # Bootstrap, graceful shutdown, real-time jobs
│   │   ├── config/         # env.js + scrapeTargets + page policies
│   │   ├── routes/         # ~340 HTTP endpoints under /api
│   │   ├── services/       # ~50 modules: stores, ERP, events, LMS, career
│   │   ├── middleware/     # requestContext, adminContext, rateLimit, fileServing
│   │   └── utils/          # logger, cookies, apiResponse, etc.
│   ├── data/               # SQLite DBs + endpoint discovery + ERP dumps
│   ├── scripts/            # Maintenance, fixture seeding, discovery
│   ├── test/               # node:test (245 tests)
│   └── load-tests/         # k6 scripts
├── Frontend/               # React 19 + Vite 7 + TS
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/         # React Router 7 config
│   │   ├── pages/          # 14 page directories
│   │   ├── components/     # Design system + feature components
│   │   ├── lib/            # API clients, transformers, identity
│   │   ├── styles/         # Design tokens (CSS variables)
│   │   └── hooks/
│   ├── vite.config.ts
│   └── tsconfig.json
├── Scraper/                # Python career scraper (3.10+ venv)
├── infra/                  # docker-compose overrides + runbooks + cron
├── docs/                   # ← YOU ARE HERE
├── .github/workflows/ci.yml # 6-job CI
├── docker-compose.yml       # Root compose: backend + Redis
├── AGENTS.md / CLAUDE.md / PRODUCT.md  # AI assistant design context
└── README.md
```

## Test counts (last verified 2026-08-30)

- **Backend:** 245 tests pass (54 test files, `node --test`)
- **Frontend:** 1188 tests pass (99 test files, Vitest)
- **Real-stack e2e (Playwright):** 50 of 51 specs pass in CI; 1 requires a
  Playwright browser binary locally and is skipped

## Versioning

This is a self-published student project — no formal semver yet. The
`@Hemanthdamineni` GitHub account is the only contributor; every commit
hash is signed and the Contributors list is clean (see
**[16 — Contributor Cleanup](./16-CONTRIBUTOR-CLEANUP.md)** for the
history of that).

## License

UNLICENSED. The codebase is open source for reading and self-hosting;
see `LICENSE` (TBD) for the full terms.
