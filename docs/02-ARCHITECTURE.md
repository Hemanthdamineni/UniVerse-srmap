# 02 — Architecture

> This doc is the **shape** of the system. For per-module implementation
> details, see **[03 — Backend](./03-BACKEND.md)** and
> **[04 — Frontend](./04-FRONTEND.md)**. For data flow specifics, see
> **[06 — ERP Integration](./06-ERP-INTEGRATION.md)**.

## 2.1 System overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Browser (React 19)                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  React Router 7 routes                                              │  │
│   │  ├─ /dashboard, /academic/*, /finance/*, /exams/*  → ERP pages    │  │
│   │  ├─ /events/*, /lms/*, /career-portal/*, /helpdesk/*             │  │
│   │  ├─ /login, /forgot-password                                        │  │
│   │  └─ /admin/*  (admin elevation required)                            │  │
│   │                                                                     │  │
│   │  State: TanStack React Query (server cache) + React local state   │  │
│   │  API client: src/lib/{campus,erp,events,lms,career,helpdesk,...} │  │
│   │  Auth: httpOnly erp_session cookie; same-origin (Vite proxy)      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────────────────────────────────┘
                 │  fetch("/api/*") with credentials: "include"
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       nginx (in-container, compose.ingress.yml)            │
│   - TLS termination                                                        │
│   - /api/*    → proxy to backend:5000                                      │
│   - /files/*  → static alias of /app/data (uploads/certificates/etc)       │
│   - /*        → static alias of /usr/share/nginx/html (Frontend dist)     │
└────────────────┬─────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  Backend: Express 5 on Node 22, port 5000                   │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Middleware chain (app.js, in order):                              │  │
│   │  1. CORS (same-origin lockdown)                                     │  │
│   │  2. helmet()  (security headers)                                    │  │
│   │  3. cookieParser()                                                  │  │
│   │  4. compression()                                                   │  │
│   │  5. requestContext  (request ID, timing, log line)                 │  │
│   │  6. adminContext  (admin elevation flag)                          │  │
│   │  7. /files/submissions + /files/certificates  (static, 7d cache) │  │
│   │  8. /uploads  (gated by session auth, 1h cache)                   │  │
│   │  9. globalRateLimit  (400/min/IP)                                  │  │
│   │ 10. loginRateLimit  (20/min/IP, /api/captcha + /api/login)        │  │
│   │ 11. express.json({ limit: "2mb" })                                 │  │
│   │ 12. /api/*  → 30+ routers                                           │  │
│   │ 13. (final) error handler → sendApiError                            │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Routers mounted at /api (app.js):                                 │  │
│   │  - health, metrics, telemetry (observability)                       │  │
│   │  - debug, auth, admin (privileged)                                 │  │
│   │  - erpV2, external, content, resource, feedback                     │  │
│   │  - events, helpdesk, campusFeedback                                 │  │
│   │  - career, competition, persistentTeam, scores                     │  │
│   │  - profile, recommendation, unifiedInsights                         │  │
│   │  - lms (sub-router with ~80 LMS endpoints)                          │  │
│   │  - attendance, academicCalendar, facultyCabin, vacantRoom          │  │
│   │  - scrape (catch-all /api/scrape/:pageKey)                         │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Services layer (~50 modules in src/services/):                     │  │
│   │  - ERP aggregation (cache + circuit breaker + distributed lock)    │  │
│   │  - 21 ERP extractors (Cheerio-based, one per page)                 │  │
│   │  - 14 SQLite stores (WAL mode, content/events_lms_career_etc)      │  │
│   │  - Session services (Redis-backed, in-memory fallback)              │  │
│   │  - Career scraper supervisor (Python subprocess)                   │  │
│   │  - Background jobs: competition reminders, career notifs,         │  │
│   │    cache sweep, LMS interaction queue flush (300ms)                 │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└────────┬───────────────────────────────────┬──────────────────────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────┐                ┌──────────────────────────┐
│  Redis 7         │                │  14 SQLite databases      │
│  - sessions      │                │  Backend/data/*.sqlite   │
│  - erp cache     │                │  - content.sqlite         │
│  - rate limits   │                │  - events.sqlite          │
│  - circuit state │                │  - lms.sqlite             │
│  - locks         │                │  - career.sqlite          │
│  (in-mem fallback│                │  - helpdesk.sqlite        │
│   if REDIS_URL   │                │  - campus-feedback.sqlite │
│   is empty)      │                │  - external-pages.sqlite  │
└──────────────────┘                │  - lms-tracker.sqlite     │
                                   │  - unified-profile.sqlite │
                                   │  - companion-analytics... │
                                   │  - erp-attendance-snaps.. │
                                   │  - vacant-rooms.sqlite    │
                                   │  - persistent-teams.sqlite│
                                   │  - hostel-buddy.sqlite    │
                                   └──────────────────────────┘
```

## 2.2 Request lifecycle — read path

The most common path: a user opens the dashboard and the SPA fetches
`/api/erp/batch?keys=...` (or the legacy `/api/scrape/:pageKey`).

```
Browser                          Backend                                ERP (live)
  │                                  │                                      │
  │  GET /api/scrape/dashboard       │                                      │
  │  Cookie: erp_session=...         │                                      │
  │ ─────────────────────────────►   │                                      │
  │                                  │  1. Express: CORS, helmet, json     │
  │                                  │  2. requestContext: gen requestId   │
  │                                  │  3. adminContext: read session      │
  │                                  │     → req.userContext.userId         │
  │                                  │  4. rateLimit: 400/min/IP check     │
  │                                  │  5. Router (createScrapeRoutes)     │
  │                                  │  6. handlerScrapeRequest:           │
  │                                  │     ├── erpLiveService OR           │
  │                                  │     │   erpAggregationService       │
  │                                  │     │                               │
  │                                  │     ├── Redis GET erp:<userId>:<key>│
  │                                  │     │   └── fresh? return immediately
  │                                  │     │   └── stale? return + bg refresh
  │                                  │     │   └── miss? lock + upstream    │
  │                                  │     │                                │
  │                                  │     ├── Circuit breaker check ──────│
  │                                  │     │   (5 fails → 30s open)        │
  │                                  │     │                                │
  │                                  │     └── Playwright: scrape ERP ────│
  │                                  │         POST /StudentLoginPage      │
  │                                  │         GET /Dashboard              │
  │                                  │         ◄───── HTML                  │
  │                                  │     Cheerio extract (extractDashboard)
  │                                  │     Transform + validate             │
  │                                  │     Redis SET (with TTL)             │
  │                                  │                                      │
  │  ◄───────────────────────────    │  200 OK + JSON payload              │
  │  { success, data, source,        │                                      │
  │    fetchedAt, staleAt }          │                                      │
  │                                  │                                      │
  │  React Query caches (60s stale)   │                                      │
  │  Component renders                │                                      │
```

Two key design points:

- **Same-origin**: the frontend never makes a cross-origin fetch. The
  vite dev server proxies `/api/*` to the backend in development; the
  in-container nginx does the same in production. CORS is locked to
  same-origin by default (`CORS_ALLOWED_ORIGINS` empty).
- **Two-step**: the SPA always sees `success: true` + a payload. Cache
  hits and live scrapes return the same shape. The `source` field
  (`"cache-fresh" | "cache-stale" | "cache-miss" | "live-direct" | "dump"`)
  tells the SPA which path was taken so it can decide whether to show
  the "stale" badge.

## 2.3 Request lifecycle — write path

Most write paths (events, helpdesk, LMS, etc.) follow the same shape:

```
Browser                          Backend                                 Storage
  │                                  │                                      │
  │  POST /api/events                 │                                      │
  │  Cookie: erp_session=...         │                                      │
  │  body: { title, startsAt, ... }   │                                      │
  │ ─────────────────────────────►   │                                      │
  │                                  │  1. globalRateLimit                 │
  │                                  │  2. router (createEventsRoutes)     │
  │                                  │  3. userContextMiddleware (per-router)
  │                                  │     → req.userContext                │
  │                                  │  4. ensureAuthenticated             │
  │                                  │  5. handler: eventsStore.createEvent│
  │                                  │     ├── validate body                │
  │                                  │     ├── SQLite INSERT ───────────────│
  │                                  │     │                                │
  │                                  │     └── 200 OK + { id, status }     │
  │  ◄───────────────────────────    │                                      │
  │  { success, data: { id } }       │                                      │
  │                                  │                                      │
  │  React Query invalidates          │                                      │
  │  ['events', 'my-events']         │                                      │
  │  Refetch on next render          │                                      │
```

For file uploads (LMS resources, event posters, etc.) the path is
similar but uses `multer` for multipart parsing and writes the file
to `/uploads` (or `/files/submissions`, `/files/certificates` for
event-specific dirs). The `/uploads` path requires a valid session;
the `/files/*` paths are deliberately public-by-URL — see
**[03 — Backend §3.8 File serving](./03-BACKEND.md#38-file-serving)**.

## 2.4 The ERP scrape pipeline

The `ErpAggregationService` is the most important backend module.
It owns:

- **Cache lookup** (Redis `erp:<userId>:<pageKey>`)
- **Cache policy** (`cached-first` vs `live-first` per `pageKey`)
- **Distributed lock** (Redis `SETNX erp:<userId>:<pageKey>:live:lock`)
  so only one backend scrapes the same page per user at a time
- **Circuit breaker** (Redis `erp:circuit:<pageKey>`) — 5 fails in a
  window opens the circuit for 30s, no live scrapes during cooldown
- **Semaphore** (in-process, 30 concurrent) to bound the in-process
  upstream load
- **Upstream fetch** via Playwright (or `request` API for non-JS
  pages) with a 6s cached-mode / 15s live-mode timeout
- **Extract** — `extractors/extract<PageName>.js` parses the raw HTML
  with Cheerio into a typed shape
- **Validate** — `validateExtractedTargetSections` checks the
  payload against `erpPayloadContracts` (per-pageKey min tables,
  suspicious-text rejection, text-fallback allowed)
- **Cache write** with TTL (60s fresh, 600s stale)
- **Response builder** — wraps in `{ success, pageKey, source,
  fetchedAt, staleAt, policyMode, data, meta, warnings }`

The full sequence diagram:

```
                ┌────────────┐
                │ caller     │ (Express handler)
                └─────┬──────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │  erpAggregationService.       │
        │    getPage({ pageKey,         │
        │             sessionId })      │
        └─────┬────────────────────────┘
              │
              ├──► 1. resolve user key (sessionId or "anon")
              │
              ├──► 2. read PagePolicy for pageKey
              │       → { mode: "cached-first" | "live-first" }
              │
              ├──► 3. circuitBreaker.check(pageKey)
              │       → throw CircuitOpenError if open
              │
              ├──► 4. acquireDistributedLock(userId, pageKey)
              │       → 12s TTL, returns existing holder if held
              │
              ├──► 5. look up cache (Redis GET)
              │       ├── fresh (within ERP_CACHE_FRESH_TTL_MS)
              │       │   → return immediately
              │       ├── stale (within ERP_CACHE_STALE_TTL_MS)
              │       │   → return + fire background refresh
              │       └── miss
              │           → continue
              │
              ├──► 6. acquire semaphore slot (max 30 in-process)
              │
              ├──► 7. check ErpDumpService (offline snapshot)
              │       if exists and fresh → return
              │
              ├──► 8. live scrape via erpLiveService
              │       ├── Playwright session (cached JSESSIONID)
              │       ├── erpClient.getPage(pageKey)
              │       ├── extractor.extract(html)
              │       └── validateExtractedTargetSections
              │
              ├──► 9. write cache (Redis SET with TTL)
              │
              ├──► 10. release lock + semaphore
              │
              └──► 11. return { success, source, data, ... }
```

The catchall route at `/api/scrape/:pageKey` and `/api/scrape/:category/:page`
forwards to this same pipeline. The V2 routes at `/api/v2/erp/page/:pageKey`
add a `dataSink` (typed output) and a `pageKey` validation step.

## 2.5 Caching strategy

Two layers:

1. **Per-user ERP cache** — `Redis erp:<userId>:<pageKey>` → JSON blob.
   TTL: 60s "fresh" (returned immediately), 600s "stale" (returned
   with `source: "cache-stale"` + a background refresh is fired).
2. **Per-pageKey circuit state** — `Redis erp:circuit:<pageKey>` →
   `{ failures, openedAt }`. 5 failures in a sliding window opens
   the circuit for 30s; live scrapes return `503 UPSTREAM_UNAVAILABLE`
   during cooldown.

Per-pageKey policy (`Backend/src/config/erp-page-policy.json`):

- **Cached-first** (default): dashboard, attendance, timetable, results,
  exam marks, fee dues. These change rarely per user.
- **Live-first**: fee paid, payment acknowledgments, exam registration,
  course registration. These change immediately when the user takes
  an action.

The full list lives in
**[08 — Configuration §8.2 Page Policy Configuration](./08-CONFIGURATION.md#82-page-policy-configuration)**.

## 2.6 Session & auth

- **Cookie**: `erp_session` (httpOnly, SameSite=lax, Secure auto-detected
  from `x-forwarded-proto`). Sliding 30-min TTL.
- **Session store**: Redis primary, in-memory fallback (used by the
  e2e stack and any single-process setup).
- **Legacy header**: `x-session-id` accepted only before
  `LEGACY_SESSION_ID_CUTOFF_DATE` (2026-05-15, already past).
- **Pre-auth captcha**: 25-min TTL on the captcha session, aligned to
  the upstream ERP's JSESSIONID TTL.
- **Admin elevation**: a register-number allowlist + `ADMIN_CONTENT_PASSWORD`
  (or an allowlisted reg-no + session flag). The admin flag is set in
  the session, scoped to the session lifetime.
- **Login rotation**: on successful login, the session ID is rotated
  (prevents session-fixation attacks).

The auth surface lives in `Backend/src/routes/authRoutes.js` and
`Backend/src/services/core/sessionServices.js`.

## 2.7 Frontend state model

- **Server state** — TanStack React Query 5 (`@tanstack/react-query`).
  Default stale time: 60s. Mutation invalidation: each mutation calls
  `queryClient.invalidateQueries({ queryKey: [...] })` to refresh the
  related list/detail queries.
- **Local state** — React `useState` / `useReducer` for component-local
  things (form state, tab state, drawer open/closed). No Zustand, no
  Redux, no Jotai.
- **Static prototype mode** — `VITE_STATIC_PROTOTYPE=true` switches the
  campus API client to return fixture data instead of fetching. This
  is what powers the fixture-only Playwright prototypes in
  `Frontend/e2e/*.spec.ts` (not the real-stack ones).
- **Auth state** — `req.userContext` lives server-side; the SPA reads
  it via `/api/auth/me` (a 401 there is the SPA's "session expired"
  signal).

## 2.8 Deployment topology

```
Internet
  │
  ▼
┌─────────────────────────────────┐
│  Docker host                    │
│                                 │
│  docker compose up -d --build   │
│   ├─ backend (port 5000)        │
│   ├─ redis (port 6379)          │
│   │                             │
│  docker compose -f infra/...    │
│   - compose.ingress.yml         │
│     └─ nginx (ports 80/443)     │
│   - compose.monitoring.yml      │
│     ├─ prometheus                │
│     ├─ grafana                   │
│     ├─ loki + promtail          │
│     ├─ alertmanager             │
│     └─ node-exporter, cAdvisor  │
│                                 │
│  Backend/data/ (bind-mounted)   │
│  Backend/logs/  (bind-mounted)  │
└─────────────────────────────────┘
```

For a free-tier single-VM deployment with a full walkthrough of every
command and decision, see
**[17 — Deployment Guide](./17-DEPLOYMENT-GUIDE.md)**.

## 2.9 Real-time jobs (setInterval)

Started by `Backend/src/server.js` at boot:

| Job | Interval | Module |
|---|---|---|
| Competition reminders | 5 min | `events/competitionStore.js` |
| Career notifications | 15 min | `career/careerStore.js` |
| Cache sweep | 5 min | `erp/erpAggregationService.js` |
| LMS interaction queue flush | 300 ms | `lms/lmsTrackerService.js` |

Plus the supervised Python career-scraper daemon
(`Backend/src/services/career/careerScraperSupervisor.js`) with
restart backoff 30s → 15min.

## 2.10 What the platform is NOT

- **Not a real-time ERP.** All ERP data is polled (cached + on-demand),
  not pushed. WebSockets are not used.
- **Not a write-back to the ERP.** The platform does not push any
  data back to the upstream ERP. The only writes go to the platform's
  own SQLite stores.
- **Not multi-tenant.** There's exactly one ERP instance per deployment
  (the university's own). Each deployment is single-tenant.
- **Not OAuth/SSO.** Sessions are cookie-based. The captcha flow is
  the only public surface that doesn't need auth.
- **Not a SPA API gateway for the ERP.** The frontend talks to the
  backend, never to the ERP directly.
