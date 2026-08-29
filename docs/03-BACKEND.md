# 03 — Backend

> Express 5 on Node ≥22.5. ~92K lines of code (Backend/src is 35K;
> the rest is tests, scripts, and config). About 340 HTTP endpoints
> under `/api` spread across ~30 router files, and ~50 service
> modules in `Backend/src/services/`. This doc walks the directory
> tree, then drills into each module.

For data flow and the request lifecycle, see
**[02 — Architecture](./02-ARCHITECTURE.md)**. For every endpoint,
see **[07 — API Reference](./07-API-REFERENCE.md)**. For env vars and
feature flags, see **[08 — Configuration](./08-CONFIGURATION.md)**.

## 3.1 Directory layout

```
Backend/src/
├── app.js          # Express app factory (the entire pipeline)
├── server.js       # Bootstrap: instantiate stores, wire DI, start jobs
├── config/         # env.js, scrapeTargets, erp-page-policy, payload contracts
├── routes/         # HTTP endpoints (~340 total)
│   ├── authRoutes.js
│   ├── eventsRoutes.js
│   ├── helpdeskRoutes.js
│   ├── careerRoutes.js
│   ├── competitionRoutes.js
│   ├── persistentTeamRoutes.js
│   ├── scoresRoutes.js
│   ├── contentRoutes.js
│   ├── resourceRoutes.js
│   ├── feedbackRoutes.js
│   ├── campusFeedbackRoutes.js
│   ├── externalRoutes.js
│   ├── lmsRoutes.js
│   ├── lmsRoutes/  # sub-router with the LMS endpoints
│   ├── erpV2Routes.js
│   ├── scrapeRoutes.js   # the catchall /api/scrape/:pageKey
│   ├── attendanceRoutes.js
│   ├── academicCalendarRoutes.js
│   ├── facultyCabinRoutes.js
│   ├── vacantRoomRoutes.js
│   ├── hostelBuddyRoutes.js
│   ├── profileRoutes.js
│   ├── recommendationRoutes.js
│   ├── companionAnalyticsRoutes.js
│   ├── healthRoutes.js
│   ├── metricsRoutes.js
│   ├── telemetryRoutes.js
│   ├── debugRoutes.js
│   └── adminRoutes.js
├── services/       # Business logic (~50 modules)
│   ├── core/         # sessions, unified profile
│   ├── erp/          # aggregation, live client, extractors, action executor
│   ├── events/       # events, competitions, persistent teams, scores
│   ├── lms/          # LMS store + services + tracker + migrations
│   ├── career/       # career store + services + scraper supervisor
│   ├── campus/       # helpdesk, campus feedback, content, hostel buddy
│   └── htmlParser.js
├── middleware/     # Cross-cutting middleware
│   ├── requestContext.js
│   ├── adminContext.js
│   ├── rateLimit.js
│   └── fileServing.js
└── utils/          # Generic helpers
    ├── logger.js
    ├── cookies.js
    ├── apiResponse.js
    ├── eventsAuth.js
    ├── asyncUtils.js
    ├── adminAccess.js
    ├── careerAccess.js
    └── text.js
```

## 3.2 Bootstrap (`server.js`)

`server.js` is the process entry point. It:

1. Imports every config flag from `config/env.js`
2. Initializes the shared Redis client (with in-memory fallback)
3. Instantiates every store: `contentStore`, `eventsStore`,
   `campusFeedbackStore`, `helpdeskStore`, `careerStore`,
   `careerScraperSupervisor`, `lmsStore`, `lmsTrackerStore`,
   `unifiedProfileStore`, `companionAnalyticsStore`,
   `attendanceSnapshotStore`, `vacantRoomStore`,
   `persistentTeamStore`, `hostelBuddyStore`, plus the
   `erpAggregationService`, `erpLiveService`, `uiMapStore`,
   `actionExecutor`, `dataSink`
4. Calls `createApp({ ... })` to build the Express app
5. Starts `http.createServer(app).listen(PORT)`
6. Schedules the background `setInterval` jobs (competition
   reminders 5min, career notifications 15min, cache sweep 5min,
   LMS interaction queue flush 300ms)
7. Starts the Python career-scraper supervisor (if enabled)
8. Registers the SIGTERM/SIGINT handler with the **8s shutdown
   budget** (see `utils/asyncUtils.js#withTimeout`) — keep-alive
   sockets are force-closed so the process exits within 10s

## 3.3 Express pipeline (`app.js`)

`createApp(deps)` is the Express app factory. The full middleware
chain, in order:

| # | Middleware | What it does |
|---|-----------|--------------|
| 1 | `cors({...})` | **Same-origin lockdown.** By default `CORS_ALLOWED_ORIGINS` is empty, so cross-origin is rejected. Only same-origin requests (no `Origin` header, or `Origin` in the allowlist) are allowed. `credentials: true` for cookie mode. |
| 2 | `helmet()` | Standard security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.) |
| 3 | `cookieParser()` | Parse the `erp_session` cookie |
| 4 | `compression()` | gzip on the response when the client sends `Accept-Encoding: gzip` |
| 5 | `createRequestContextMiddleware()` | Generate `x-request-id` (or trust the inbound one), set up `res.on('finish')` logging + Prometheus timing, attach `req.requestId` |
| 6 | `createAdminContextMiddleware({ sessionStore })` | If the request has a session, attach the admin elevation flag to `req.userContext` |
| 7 | `express.static('/files/submissions')` | Static mount, 7d cache |
| 7 | `express.static('/files/certificates')` | Static mount, 7d cache |
| 8 | `ensureAuthenticatedForUploads` + `express.static('/uploads')` | `/uploads` requires a valid session; 1h cache |
| 9 | `createGlobalRateLimitMiddleware({ redisClient })` | 400 requests/min/IP (configurable) — applies to all `/api/*` |
| 10 | `createLoginRateLimitMiddleware({ redisClient })` | 20 requests/min/IP — applies only to the auth allowlist (`/api/captcha`, `/api/login`, `/api/forgot` and `/api/auth/*` variants) |
| 11 | `express.json({ limit: "2mb" })` | JSON body parser |
| 12 | routers (30+) | Each `app.use('/api', createXxxRoutes({...}))` |
| 13 | error handler | Converts thrown `Error.status` / `Error.code` into a structured `sendApiError` response |

### 3.3.1 Why this order matters

- **CORS before helmet** — same-origin lockdown needs to fire before
  any header is set, otherwise preflight responses would include
  security headers on a blocked request.
- **`requestContext` before `adminContext`** — the request-id
  generated by requestContext is the one logged by adminContext.
- **`/files/*` before rate limits** — the static file mounts are
  not subject to the API rate limit (a 1KB file would otherwise
  count against a user's 400/min budget).
- **`/uploads` after the global rate limit** — `/uploads` IS
  subject to the rate limit, but auth is checked inline
  (`ensureAuthenticatedForUploads`) before the static mount serves
  the file.
- **JSON body parser after rate limits** — even a rejected request
  counts against the rate limit (you can't blast past the limit by
  sending huge bodies).
- **Routers last** — they only run if the request passed everything
  before them.

## 3.4 Routers

Each `Backend/src/routes/<name>.js` exports a `createXxxRoutes({ ... })`
function that takes its dependencies as named arguments and returns an
`express.Router`. The mount pattern is `app.use('/api', createXxxRoutes(...))`.

**Total**: 341 HTTP endpoints across 30 router files (including the
LMS sub-router with 80+ endpoints).

### 3.4.1 Auth & session — `authRoutes.js`

The most-called router. Endpoints:

| Method | Path (canonical) | Path (alias) | Purpose |
|--------|------------------|--------------|---------|
| GET | `/auth/heartbeat` | `/heartbeat` | Liveness (no auth) |
| GET | `/auth/captcha` | `/captcha` | Generate captcha challenge (25-min TTL, auth-bypass for the captcha bootstrap) |
| POST | `/auth/login` | `/login` | Submit captcha + creds, rotate session |
| POST | `/auth/dev-login` | `/dev/login` | **Dev-only** auto-login (gated by `NODE_ENV !== 'production'`) |
| POST | `/auth/forgot` | `/forgot` | Forgot-password flow (writes a captcha + email hook) |
| POST | `/auth/logout` | `/logout` | Delete session, clear cookie |
| GET | `/auth/profile` | `/profile` | Current user profile |
| GET | `/auth/profile/photo` | `/profile/photo` | Profile photo (proxied from ERP) |
| GET | `/auth/profile/photo/debug` | `/profile/photo/debug` | Photo debug page (dev only) |

Plus the `/me` endpoint (in `profileRoutes.js`):
`GET /api/me` returns `{ id, name, email, role, hasAdminAccess }` —
the SPA's "who am I" probe on every page load.

### 3.4.2 Events — `eventsRoutes.js`

27 endpoints. The full event lifecycle:
- `GET /api/events` — list (with filters: registered, mine, search)
- `GET /api/events/calendar` — calendar view (month/week)
- `GET /api/events/my-registrations`, `my-registered`, `my-created`
- `GET /api/events/analytics` — admin analytics
- `GET /api/events/notifications` — list notifications
- `POST /api/events/notifications/reminders` — trigger reminder job
- `POST /api/events` — create (admin/organizer only)
- `POST /api/events/bulk-action` — bulk update (admin)
- `GET /api/events/:eventId` — detail
- `PUT /api/events/:eventId` — update
- `PUT /api/events/:eventId/co-organizers` — manage co-organizers
- `DELETE /api/events/:eventId` — delete
- `POST /api/events/:eventId/duplicate` — clone
- `PATCH /api/events/:eventId/status`, `/:eventId/approval`
- `POST /api/events/:eventId/register`, `cancel-registration`,
  `check-in`
- `DELETE /api/events/:eventId/register`
- `GET /api/events/:eventId/attendees.csv` — CSV export
- `POST /api/events/:eventId/messages`, `feedback`, `gallery`
- `GET /api/events/:eventId/ical` — iCal export

### 3.4.3 Competitions — `competitionRoutes.js`

38 endpoints. The competition sub-system manages rounds, teams,
submissions, evaluations, certificates, and recruitment. Lives on
top of an event (a `competitionConfig` on the parent event). Key
endpoints:

- `GET/POST/PUT/DELETE /api/competitions/:eventId/{config,roles,certificate-template}`
- `GET /api/competitions/:eventId/rounds/:roundId/{submissions,leaderboard,my-submission,my-result,certificates/me,certificates/me/download}`
- `PUT /api/competitions/:eventId/rounds/:roundId/submissions/:id/{evaluate,flag}`
- `POST /api/competitions/:eventId/rounds/:roundId/{shortlist,publish,certificates/generate}`
- `GET/POST/PUT/DELETE /api/competitions/:eventId/teams*` — team
  management, recruitment, membership
- `POST /api/competitions/:eventId/invitations/:id/{accept,decline}`
- `POST /api/competitions/reminders/run` — manual reminder trigger
- `POST /api/competitions/:eventId/announce` — publish results

### 3.4.4 Career — `careerRoutes.js`

The largest router at 52 endpoints. Full career portal surface:
opportunity CRUD, applications, bookmarks, views, dismissals, flags,
fit analysis, resume versions, skill gaps, profile management,
interview slots + bookings, alumni directory, submission flow.

The `/career/health` endpoint returns the supervisor state
(`"unavailable"`, `"running"`, `"idle"`, `"backoff"`, etc.) — the
SPA's "is the scraper alive" probe.

### 3.4.5 ERP scrape (catchall) — `scrapeRoutes.js`

The smallest router but the most-called. Endpoints:

- `GET /api/scrape/:pageKey` — single page
- `GET /api/scrape/:category/:page` — categorical (e.g. `/api/scrape/examination/current-semester-results`)
- `GET /api/scrape/examination/earlier-internal-marks/semester/:semester` — specialised
- `GET /api/:category/:page` and `GET /api/:pageKey` — legacy
  shims for older frontend code

All five go through the same `handleScrapeRequest` → `erpAggregationService.getPage`
pipeline. The handler in `erpServices.js` does the policy lookup
(cached-first vs live-first), session resolution, cache
read-through, and dispatch to either the live scraper or the offline
dump.

### 3.4.6 V2 — `erpV2Routes.js`

Feature-gated by `FEATURE_ERP_V2_API`. Adds typed output (`dataSink`),
schema validation, and a different request shape (one batch call
instead of N page calls). The frontend uses V2 for newer features
and V1 for legacy.

### 3.4.7 LMS — `lmsRoutes.js` + `lmsRoutes/`

`lmsRoutes.js` is a thin dispatch that wires the four sub-routers in
`lmsRoutes/`:

- `resourceRoutes.js` (35 endpoints) — resources, collections,
  upload, ratings, downloads
- `learningAdminRoutes.js` (27) — admin queue, taxonomy, bulk ops
- `guideRoadmapRoutes.js` (24) — guides, roadmaps, editor actions
- `trackerRoutes.js` + search + request board (~30)

The LMS module owns the largest store (`lmsStore.js`, 3000 LOC) and
has a real migration runner (`lmsMigrations.js`).

### 3.4.8 Other routers (one-line summaries)

| Router | What it does |
|--------|--------------|
| `helpdeskRoutes.js` | Ticket CRUD, FAQ, escalation, SLA, audit |
| `campusFeedbackRoutes.js` | Form definition + submissions + admin moderation |
| `externalRoutes.js` | Static-ish pages with a redirect target + SEO template |
| `contentRoutes.js` | Content + resources + admin workflow |
| `resourceRoutes.js` | File-backed resources (LMS-aware) |
| `feedbackRoutes.js` | Course feedback via the upstream ERP |
| `eventsRoutes.js` | See above |
| `competitionRoutes.js` | See above |
| `careerRoutes.js` | See above |
| `persistentTeamRoutes.js` | Cross-event teams (roster + invitations) |
| `scoresRoutes.js` | Per-user competition + team scores (computed) |
| `profileRoutes.js` | `/me`, privacy settings, public profile, photo |
| `recommendationRoutes.js` | Resource + opportunity recommendations |
| `companionAnalyticsRoutes.js` | Aggregated engagement events |
| `attendanceRoutes.js` | Live attendance mark + history read |
| `academicCalendarRoutes.js` | Read-only academic calendar |
| `facultyCabinRoutes.js` | Read-only faculty-cabin map |
| `vacantRoomRoutes.js` | Vacant-room cache (per day + slot) |
| `hostelBuddyRoutes.js` | Hostel buddy finder (CRUD on the user's entry + matches) |
| `healthRoutes.js` | `/live`, `/ready`, `/captcha`-not-needed (auth-gated) |
| `metricsRoutes.js` | Prometheus exposition (`/api/metrics`) |
| `telemetryRoutes.js` | Frontend performance telemetry ingest |
| `debugRoutes.js` | Dev-only dump access (gated by erpDumpService) |
| `adminRoutes.js` | Admin elevation (`/api/admin/access/{status,unlock,disable}`) |

## 3.5 Services

Each service is a class or factory. The pattern is:

- **Stores** (15 total, see **[05 — Data](./05-DATA.md)**) own the
  SQLite DB and expose CRUD methods.
- **Aggregator services** orchestrate stores + caches + external
  services. `erpAggregationService` is the big one; the others
  are thinner (e.g. `competitionStore` aggregates event data +
  submission data + scoring math).

### 3.5.1 ERP aggregation — `services/erp/erpAggregationService.js`

The most important module. 500+ LOC, owns:

- **Cache lookup** (`getPage({ pageKey, sessionId })`):
  Redis `erp:<userKey>:<pageKey>` → JSON
- **Cache policy** per pageKey (from `Backend/src/config/erp-page-policy.json`)
- **Distributed lock** (`SETNX erp:<userKey>:<pageKey>:live:lock`,
  12s TTL) so only one backend scrapes the same page per user at
  a time
- **Circuit breaker** (Redis `erp:circuit:<pageKey>`, 5 fails in
  window → open 30s)
- **Semaphore** (in-process, 30 concurrent) to bound upstream load
- **Live fetch** via `erpLiveService` → `erpClient` → Playwright (or
  `request` API for non-JS pages), 6s cached-mode / 15s live-mode
  timeout
- **Extract** via `extractors/extract<PageName>.js` (one per page)
- **Validate** via `validateExtractedTargetSections` (per-pageKey
  min tables, suspicious-text rejection)
- **Cache write** with TTL (60s fresh, 600s stale)
- **Response builder** wraps in `{ success, pageKey, source,
  fetchedAt, staleAt, policyMode, data, meta, warnings }`

The full lifecycle is in **[02 — Architecture §2.4](./02-ARCHITECTURE.md#24-the-erp-scrape-pipeline)**.

### 3.5.2 ERP live service — `services/erp/erpLiveService.js`

Thin wrapper around the aggregation service for the "live first"
path — used by write-side flows (registration, payment) where
the cached value is too stale to trust. Bypasses the cache and
goes straight to the upstream.

### 3.5.3 ERP client — `services/erp/erpClient.js`

The Playwright-based HTTP client. Two modes:
- `request` (lightweight, no browser) for non-JS pages (most of the
  ERP)
- `browser` (Chromium) for pages that need JS rendering

The client maintains a per-user session (cached JSESSIONID) and
exposes `getPage(pageKey)` and `postAction(action, payload)`.

### 3.5.4 ERP extractors — `services/erp/extractors/`

20 Cheerio-based extractors, one per page. Each exports a single
`extract(html, context) → typed payload` function. The list:

| Extractor | Page |
|-----------|------|
| `extractDashboard.js` | `/dashboard` |
| `extractAttendance.js` | `/academic/attendance-details` |
| `extractTimetable.js` | `/academic/timetable` |
| `extractCurrentResults.js` | `/exams/current-semester-results` |
| `extractInternalMarks.js`, `extractExamMarkDetails.js`, `extractEarlierInternalMarks.js`, `extractEarlierInternalMarksSemester.js` | exam marks variants |
| `extractFeeDues.js`, `extractFeePaid.js`, `extractPaymentAcknowledgment.js`, `extractBankDetails.js` | financial |
| `extractSubjects.js`, `extractProfile.js` | profile + curriculum |
| `extractOdMlDetails.js` | OD/ML detail (a sub-page of attendance) |
| `extractAnnouncements.js` | `/notifications` |
| `extractHostel.js` | `/transport-hostel/room-details` |
| `extractTransport.js`, `extractTransportRegistrationForm.js`, `extractTransportRegistrationAck.js` | transport (legacy) |
| `extractGenericTable.js` | fallback for any page with a `<table>` |

### 3.5.5 ERP services — `services/erp/erpServices.js`

The "what data do we have" surface. The big functions are
`resolveLatest()` (offline-dump fallback) and a handful of
fin-fee-paid integrity stats for the Prometheus exporter. Also where
the Cheerio helpers (`romanToNumber`, `extractCgpaValue`, etc.) live.

### 3.5.6 ERP action executor — `services/erp/erpActionExecutor.js`

For write-side actions (form submissions on the upstream ERP — fee
payment, exam registration, course registration). Wraps the
Playwright `page.click` / `page.fill` / `page.submit` flow with the
ERP session. Used by the `erpV2Routes.js` `/action/execute`
endpoint.

### 3.5.7 Event stores — `services/events/`

- `eventsStore.js` (1500 LOC) — events + registrations + notifications
- `competitionStore.js` (2000 LOC) — rounds, teams, invitations, evaluations, certificates
- `persistentTeamStore.js` (smaller) — cross-event teams
- `scoresService.js` — per-user competition + team scores
  (computed from the stores; no separate table)

### 3.5.8 LMS — `services/lms/`

- `lmsStore.js` (3000 LOC) — the largest module. Resources, guides,
  roadmaps, quizzes, PYQs, request board, full-text search (FTS5).
  Has a real migration runner (`lmsMigrations.js`).
- `lmsServices.js` (800 LOC) — orchestration layer (quiz grading,
  roadmap progression, recommendation hooks)
- `lmsTrackerService.js` (1400 LOC) — every resource view gets a
  row; recommendation events get logged
- `lmsTrackerStore.js` — the two tracker tables
- `lmsUtils.js` — helpers (slug generation, content sanitization)

### 3.5.9 Career — `services/career/`

- `careerStore.js` (2500 LOC) — opportunities, applications,
  bookmarks, views, dismissals, flags, source health
- `careerServices.js` (550 LOC) — business logic, skill-gap
  computation, fit scoring, recommendation
- `careerScraperSupervisor.js` — the Python subprocess wrapper
  (see [17 — Deployment Guide](./17-DEPLOYMENT-GUIDE.md) for how
  to wire it)

### 3.5.10 Campus — `services/campus/`

- `helpdeskStore.js` — ticket JSON-blob storage
- `campusFeedbackStore.js` — campus feedback forms + entries
- `feedbackServices.js` — `external_pages` store + parsers for
  external pages
- `contentStore.js` — content + resources
- `hostelBuddyStore.js` — hostel buddy finder CRUD

### 3.5.11 Core — `services/core/`

- `sessionServices.js` — Redis-backed session store + in-memory
  fallback. Also defines `createUserContextMiddleware` (used by
  per-router `userContext` mounting).
- `unifiedProfileStore.js` — the unified profile signal ledger
  + recommendations

### 3.5.12 `htmlParser.js`

Cheerio helpers shared by the extractors. Don't add anything here
that's specific to one page; per-page logic goes in the extractor
files.

## 3.6 Middleware

| File | What it does |
|------|--------------|
| `middleware/requestContext.js` | `req.requestId`, `res.on('finish')` logging + Prometheus timing |
| `middleware/adminContext.js` | If the request has a session, set `req.userContext.hasAdminAccess` |
| `middleware/rateLimit.js` | `createGlobalRateLimitMiddleware` (400/min/IP) and `createLoginRateLimitMiddleware` (20/min/IP, auth-only). Uses Redis when available, in-memory when not. |
| `middleware/fileServing.js` | `ensureAuthenticatedForUploads` — the auth gate for `/uploads`. The gate fires before the static mount serves the file. |

## 3.7 Utils

| File | Exports |
|------|---------|
| `utils/logger.js` | `log({ level, msg, ... })` — JSON-line logger with `requestId` correlation |
| `utils/cookies.js` | `parseCookies`, `serializeCookie` (the `erp_session` cookie helpers) |
| `utils/apiResponse.js` | `sendApiSuccess`, `sendApiError` (the standard envelope) |
| `utils/eventsAuth.js` | `createUserContextMiddleware` + `ensureAuthenticated` (used by individual routers) |
| `utils/asyncUtils.js` | `Semaphore`, `withTimeout` (used by the aggregation service and the SIGTERM shutdown) |
| `utils/adminAccess.js` | `isAdminContext`, `requireAdmin` (role check helpers) |
| `utils/careerAccess.js` | `canApplyForOpportunity`, `canEditOpportunity` (career-specific authz) |
| `utils/text.js` | `cleanText`, `toTitleCase` (HTML-cleanup helpers used by extractors) |

## 3.8 File serving

Three URL prefixes expose files (see **[05 — Data §5.3.1](./05-DATA.md#531-file-serving-policy)**):

| URL prefix | Source | Cache | Auth |
|-----------|-------|-------|------|
| `/uploads` | `Backend/data/uploads/` | 1h | Required (session cookie) |
| `/files/submissions` | `Backend/data/events/../submissions/` | 7d | None (public) |
| `/files/certificates` | `Backend/data/events/../certificates/` | 7d | None (public) |

The auth gate for `/uploads` is `ensureAuthenticatedForUploads`
(`middleware/fileServing.js`), which checks `req.userContext.isAuthenticated`
(a flag the per-router `userContext` middleware sets from the session).
The other two prefixes are deliberately public — they expose
certificate-style downloads meant to be link-shared.

## 3.9 Background jobs (setInterval)

Started by `server.js`:

| Job | Interval | Where |
|-----|----------|-------|
| Competition reminders | 5 min | `services/events/competitionStore.js` (sends notifications to users with upcoming submission deadlines) |
| Career notifications | 15 min | `services/career/careerStore.js` (sends "new opportunity" emails) |
| Cache sweep | 5 min | `services/erp/erpAggregationService.js` (clears in-memory circuit-breaker state) |
| LMS interaction queue flush | 300 ms | `services/lms/lmsTrackerService.js` (batches tracker writes) |

Plus the supervised Python career-scraper daemon
(`services/career/careerScraperSupervisor.js`) which is a child
process with restart backoff 30s → 15min. The supervisor's
`/api/career/health` endpoint exposes its state.

## 3.10 Graceful shutdown

The SIGTERM/SIGINT handler in `server.js` enforces an **8-second
shutdown budget**:

1. Stop accepting new connections
2. Drain in-flight requests (up to 8s)
3. Force-close keep-alive sockets (so the process can actually exit
   even if a slow client is holding one open)
4. `process.exit(0)`

The 8s budget is enforced by `utils/asyncUtils.js#withTimeout` and is
what makes the platform safe for in-place rollouts (a 502 storm
would be visible if the shutdown took longer than the load-balancer
health check window).

## 3.11 Env vars

Every env var lives in `Backend/src/config/env.js` with a sensible
default. The full list is in
**[08 — Configuration](./08-CONFIGURATION.md)**. The most
frequently tuned:

- `PORT` (default 5000)
- `NODE_ENV` (development | production)
- `REDIS_URL` (empty → in-memory fallback; populated → Redis)
- `REDIS_PASSWORD`
- `ERP_CACHE_FRESH_TTL_MS` (60000)
- `ERP_CACHE_STALE_TTL_MS` (600000)
- `ERP_CIRCUIT_FAILURE_THRESHOLD` (5)
- `ERP_CIRCUIT_COOLDOWN_MS` (30000)
- `ERP_UPSTREAM_MAX_CONCURRENCY` (30)
- `RATE_LIMIT_MAX` (400)
- `LOGIN_RATE_LIMIT_MAX` (20)
- `LOGIN_PREAUTH_TTL_MS` (1500000 = 25 min, NOT 15 sec — the doc
  used to say 15 sec, which was wrong; see the prod-readiness
  ledger D7)
- `FEATURE_ERP_V2_API`, `FEATURE_ERP_CACHED_FIRST`,
  `FEATURE_AUTH_COOKIE_MODE`, etc.

## 3.12 Logging

JSON-line format, one line per HTTP request, with `requestId`
correlation. The `log()` function in `utils/logger.js` is the
canonical interface. The log directory is `Backend/logs/` with a
default rotating `backend.log`. Login-attempt artifacts (truncated
HTML, redacted) are written to `Backend/logs/login-attempts/` and
capped at `LOGIN_DIAGNOSTICS_MAX_ARTIFACTS` (default 20).

## 3.13 Metrics

Prometheus metrics exposed at `/api/metrics` (`prom-client`):
- HTTP request count + latency histogram by route
- ERP cache hit/miss ratio
- ERP upstream failure count + latency
- Circuit-breaker open/close events
- Concurrent-upstream gauge
- Finance-paid source row counts (for monitoring ERP data drift)

## 3.14 Common patterns

- **Every router uses `wrap(handler)`** (from `utils/eventsAuth.js`) —
  turns thrown `error.status` / `error.code` into a structured
  `sendApiError` response. So a handler that throws
  `Object.assign(new Error('rate limited'), { status: 429, code: 'RATE_LIMITED' })`
  gets a 429 with the right error envelope for free.
- **Every authenticated router uses `createUserContextMiddleware({ sessionStore, adminPassword })`** — sets
  `req.userContext = { userId, name, role, hasAdminAccess, isAuthenticated }`.
  Then `ensureAuthenticated(req)` (also from `utils/eventsAuth.js`)
  is called at the top of each protected handler.
- **Every store applies the same pragma block** on construction:
  `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
- **Every service module has a unit test** in `Backend/test/`. The
  tests use `node:test` (no external test framework) and are
  deterministic (each test uses a temp dir for SQLite DBs).
