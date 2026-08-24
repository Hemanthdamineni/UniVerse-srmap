# University ERP Companion Platform

A modern, full-featured companion platform for university students at SRM AP University — providing fast, reliable access to legacy ERP data (attendance, marks, timetable, fees) alongside platform-native features like events, LMS, career portal, and helpdesk.

---

## Architecture Overview

```
                          +--------------------+
                          |   Frontend (Vite)   |
                          | React + TypeScript   |
                          | Tailwind + shadcn/ui  |
                          +---------+----------+
                                    |
                            HTTP / API (proxy)
                                    |
                          +---------v----------+
                          |   Backend (Express) |
                          | Node.js + Playwright |
                          +---------+----------+
                                    |
               +--------------------+--------------------+
               |                    |                    |
      +--------v--------+  +-------v--------+  +--------v--------+
      |   SQLite (x12)  |  |   Redis Cache   |  |  Legacy ERP     |
      |  (events, lms,  |  |  (sessions,     |  |  (SRM AP)       |
      |   career, etc)  |  |   erp cache)    |  |  scraped live   |
      +-----------------+  +----------------+  +-----------------+
```

The frontend is a React SPA served by Vite. The backend is an Express API that acts as both a BFF (Backend For Frontend) and a scraping proxy to the legacy university ERP. SQLite stores all platform-native data. Redis provides distributed session storage, ERP response caching, rate-limiting, and distributed locks.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| **Routing** | React Router v7 |
| **State / Data** | TanStack React Query v5 |
| **Charts** | Recharts |
| **Backend Runtime** | Node.js 20+ |
| **HTTP Framework** | Express 5 |
| **ERP Scraping** | Playwright 1.55 + Cheerio |
| **Databases** | SQLite (via better-sqlite3 / custom stores) |
| **Cache / Session** | Redis 7 (optional, falls back to in-memory) |
| **Rate Limiting** | express-rate-limit |
| **Metrics** | prom-client (Prometheus) |
| **Testing (FE)** | Vitest + Testing Library |
| **Testing (BE)** | Node built-in test runner |
| **E2E** | Playwright |
| **Load Testing** | k6 |
| **Containerization** | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **Redis** 7+ (optional — backend falls back to in-memory stores)
- **npm** (ships with Node)

### Clone and Install

```bash
git clone <repo-url>
cd University-ERP

# Install backend dependencies
cd Backend && npm install

# Install frontend dependencies
cd ../Frontend && npm install
```

### Configure Environment

```bash
# Backend — copy and edit as needed
cp Backend/.env.example Backend/.env

# Frontend — copy and edit as needed
cp Frontend/.env.example Frontend/.env
```

### Run in Development

```bash
# Terminal 1 — Backend (port 5000)
cd Backend && npm run dev

# Terminal 2 — Frontend (port 5173, proxies /api to 5000)
cd Frontend && npm run dev
```

Open http://localhost:5173 in your browser.

### Run with Docker

```bash
docker compose up --build
```

This starts the backend (port 5000), Redis (port 6379), and mounts `Backend/data` for persistence.

---

## Project Structure

```
University-ERP/
  Backend/
    src/
      config/           # Env, page policy, payload contracts, admin users, scrape targets
      data/             # Seed data files
      middleware/        # Rate limiting, request context, admin context
      routes/           # Express route handlers (auth, erp, events, lms, career, etc.)
      services/         # Business logic
        campus/         # Campus feedback, helpdesk
        career/         # Career portal store & services
        core/           # Session services, unified profile
        erp/            # ERP client, aggregation, action executor, UI map
          extractors/   # Page-specific data extractors (attendance, marks, fees, etc.)
        events/         # Events & competitions
        lms/            # LMS store, tracker, services, migrations
      utils/            # Logger, cookies, API response helpers, auth
    scripts/            # CLI tools (dump, seed, load-test, audit, etc.)
    test/               # Backend tests
    data/               # SQLite databases, uploaded files (gitignored)
  Frontend/
    src/
      assets/           # Static images, icons, brand assets
      components/       # Reusable UI components (shadcn/ui, layout, erp, lms, etc.)
      config/           # ERP blueprints, navigation registry, navigation extensions
      contexts/         # React context providers (AdminMode, Event)
      hooks/            # Custom React hooks
      lib/              # API clients, utility functions
      pages/            # Route-level page components
      routes/           # Route definitions
      styles/           # CSS files organized by feature
      test/             # Test setup
    e2e/                # Playwright end-to-end tests
  docs/                 # Detailed documentation (architecture, API ref, guides, etc.)
  infra/                # Infrastructure configs
  Scraper/              # Career scraper pipeline (auto-spawned by the backend; see below)
  StaticHost/           # Output dir for static prototype builds
  docker-compose.yml    # Backend + Redis service definition
```

---

## Key npm Scripts

### Backend (`cd Backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the backend server (port 5000) |
| `npm run dev:debug` | Start with verbose logging |
| `npm test` | Run backend tests (Node test runner) |
| `npm run seed:demo` | Seed demo data into databases |
| `npm run seed:demo:clean` | Clean and re-seed demo data |
| `npm run dump:erp` | Create an ERP data dump |
| `npm run discover:endpoints` | Run ERP endpoint discovery |
| `npm run load:cached` | k6 load test — cached page |
| `npm run load:live` | k6 load test — live page |
| `npm run load:mixed` | k6 load test — mixed workload |
| `npm run smoke:companion` | Run companion platform smoke tests |

### Frontend (`cd Frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run dev:debug` | Start with `VITE_DEBUG_MODE=true` |
| `npm run build` | TypeScript check + production build |
| `npm run build:static` | Build as static prototype (no API backend needed) |
| `npm run preview` | Preview production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | Lint with ESLint |
| `npm run audit:api-contracts` | Audit frontend API usage against backend contracts |

---

## Documentation

Detailed documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [00-INDEX.md](docs/00-INDEX.md) | Full documentation index |
| [01-OVERVIEW.md](docs/01-OVERVIEW.md) | Project overview |
| [02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | System architecture deep dive |
| [03-BACKEND-DEEP-DIVE.md](docs/03-BACKEND-DEEP-DIVE.md) | Backend internals |
| [04-FRONTEND-DEEP-DIVE.md](docs/04-FRONTEND-DEEP-DIVE.md) | Frontend architecture |
| [05-ERP-INTEGRATION.md](docs/05-ERP-INTEGRATION.md) | ERP scraping & aggregation |
| [06-DATA-PIPELINE.md](docs/06-DATA-PIPELINE.md) | Data flow and pipeline |
| [07-API-REFERENCE.md](docs/07-API-REFERENCE.md) | Complete API reference |
| [08-CONFIGURATION.md](docs/08-CONFIGURATION.md) | Environment and page policy config |
| [09-INFRASTRUCTURE.md](docs/09-INFRASTRUCTURE.md) | Deployment and infrastructure |
| [10-DEVELOPMENT-GUIDE.md](docs/10-DEVELOPMENT-GUIDE.md) | Development workflow |
| [11-EXTENDING-THE-SYSTEM.md](docs/11-EXTENDING-THE-SYSTEM.md) | How to add features |
| [12-SYSTEM-AUDIT-REPORT.md](docs/12-SYSTEM-AUDIT-REPORT.md) | System audit findings |
| [13-DATABASE-SCHEMAS.md](docs/13-DATABASE-SCHEMAS.md) | SQLite schema reference |
