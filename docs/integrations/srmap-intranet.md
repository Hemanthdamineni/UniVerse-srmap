# SRMAP Intranet Integration

> **Status:** Implemented and verified.
> **Scope:** Automatically ingests official SRM University–AP intranet
> (`intranet.srmap.edu.in`) content into the UniVerse ERP platform and exposes
> it to students through the existing dashboard/API surfaces.
> **Last verified:** Backend 444 · Frontend 1,268 · Python 88 tests green.

---

## 1. Overview

The platform previously only scraped the legacy academic ERP
(`student.srmap.edu.in`). This integration adds the **official SRMAP
intranet** as a second, independently scheduled data source so that
institutional announcements, news, events, academic circulars, and documents
are available inside the UniVerse app without students logging into the
intranet separately.

Design goals, per the integration spec:

- **Reuse existing infrastructure** — one shared scraper venv, the existing
  Express router/user-context/auth middleware, `node:sqlite` persistence, and
  the Dashboard feed surfaces. No new databases or schedulers were invented.
- **Never hardcode credentials** — all credentials come from environment
  variables.
- **Preserve source attribution** — every item keeps its canonical intranet
  URL and the frontend links back to the original.
- **Handle personalized content safely** — only `shared`-audience items are
  surfaced through the public API/UI; cohort and student-specific content is
  stored but never exposed through the platform API.
- **Avoid duplicates and stale data** — content-hash change detection plus
  reconciliation expiry.

---

## 2. Architecture and Data Flow

```
                         ┌──────────────────────────────────────────────┐
   intranet.srmap.edu.in │  Playwright session (authenticated)          │
                         │  session.py → IntranetSession                │
                         └──────────────┬───────────────────────────────┘
                                        │ HTTP / rendered DOM
                         ┌──────────────▼───────────────────────────────┐
                         │  Scraper sources (Scraper/intranet/)          │
                         │  announcements · events · news · academic     │
                         │  · documents                                   │
                         │  Each: discover → extract → normalize → upsert│
                         └──────────────┬───────────────────────────────┘
                                        │ normalizer.normalize_item()
                                        │ (audience classify, dedupe hash)
                         ┌──────────────▼───────────────────────────────┐
                         │  SQLite  Backend/data/intranet.sqlite        │
                         │  intranet_items (+FTS5)                      │
                         │  intranet_scraper_runs                       │
                         │  intranet_source_health                      │
                         │  intranet_auth_log                           │
                         └──────────────┬───────────────────────────────┘
                                        │ IntranetStore (read) + supervisor
                         ┌──────────────▼───────────────────────────────┐
                         │  Express  /api/intranet/*  (intranetRoutes)  │
                         └──────────────┬───────────────────────────────┘
                                        │ fetch() via intranetApi.ts
                         ┌──────────────▼───────────────────────────────┐
                         │  Frontend                                    │
                         │  Dashboard IntranetFeedWidget                │
                         │  /intranet + /intranet/:id  (IntranetPage)   │
                         └──────────────────────────────────────────────┘
```

The **Python scraper writes** to the SQLite database; the **Node backend
reads** from it. The Node supervisor owns process lifecycle; the Python
scheduler owns the crawl cadence and per-source resilience.

### Process ownership

- **Node supervisor** (`Backend/src/services/intranet/intranetScraperSupervisor.js`)
  spawns and supervises `Scraper/intranet/main.py` as a child process, applies
  exponential backoff on crash, and supports an admin "trigger now" one-shot.
- **Python scheduler** (`Scraper/intranet/scheduler.py`) runs an immediate job
  on startup, then every `INTRANET_SCRAPER_RUN_INTERVAL_HOURS` (default 24h),
  and honors a `.intranet-run-now` trigger file dropped by the supervisor for
  immediate runs.

---

## 3. Ingestion Pipeline

The pipeline lives in `Scraper/intranet/`:

| Module | Responsibility |
|---|---|
| `config.py` | All env-var reading, DB path, logging, timeouts, source enable flags, audience constants. |
| `session.py` | Playwright-based authenticated session; login form heuristics, session-expiry detection + re-auth. |
| `scheduler.py` | Orchestrates the pipeline run, retries with exponential backoff, per-source circuit breaker, run-now flag, signal handling. |
| `scrapers/base.py` | Shared HTML helpers: `get_text`, `get_attr`, `extract_links`, `paginate`, `extract_document_links`, `parse_meta_date`. |
| `scrapers/announcements_scraper.py` | Discover + extract announcements/notices. |
| `scrapers/events_scraper.py` | Discover + extract events (start/end dates, venue, department). |
| `scrapers/news_scraper.py` | Discover + extract news items. |
| `scrapers/academic_scraper.py` | Discover + extract academic circulars/notices. |
| `scrapers/documents_scraper.py` | Discover + classify documents/notices/circulars by title/URL. |
| `normalizer.py` | `normalize_item()` → canonical schema; date/URL/text normalization; audience validation; document-link normalization. |
| `db.py` | `IntranetDB` — upsert with content-hash change detection, expiry reconciliation, run log, source health, auth log. |
| `main.py` | Entry point. `--once` one-shot, `--auth-check` credential test, or `start_scheduler()` daemon. |

### Per-run flow

1. **Authenticate** once (`IntranetSession`), reuse the session across all
   enabled sources.
2. **For each enabled source** (order: announcements → events → news →
   academic → documents):
   - consult the circuit breaker (`intranet_source_health`);
   - `_discover_*_url()` locates the section, then `paginate()` walks list
     pages (max `MAX_PAGINATION_PAGES`, default 20);
   - extract list items, optionally fetch detail pages;
   - `normalize_item()` produces a canonical record;
   - `db.upsert_item()` → returns `new` | `updated` | `unchanged`.
3. **Reconcile expiry** — only when the crawl was complete
   (`was_complete=True`), items for a source that were not seen are marked
   `is_active=0`.
4. **Record** run summary, per-source health, and auth outcome.

### Audience classification

- **shared** — general announcements/news/events visible to all students.
  Surfaced via `/api/intranet/*`.
- **cohort** — department-specific notices. Stored, tagged with `department`,
  but **not** exposed via the public API.
- **student_specific / restricted** — personalized content. Stored only; the
  API explicitly returns `403` if such an item id is requested.

---

## 4. SQLite Data Store

**Path:** `Backend/data/intranet.sqlite` (overridable via `INTRANET_DB_PATH`).
WAL mode, `synchronous=NORMAL`, `busy_timeout=5000`.

### `intranet_items`

Canonical content table. Key columns:

| Column | Meaning |
|---|---|
| `id` | UUID primary key. |
| `source_key` | Scraper source (`announcements`, `events`, `news`, `academic`, `documents`). |
| `content_type` | `announcement`, `event`, `news`, `notice`, `document`, `circular`, `academic`, … |
| `audience` | `shared`, `cohort`, `student_specific`, `restricted`. |
| `title`, `summary`, `body` | Content text. |
| `published_at`, `effective_at`, `expires_at` | Lifecycle dates. |
| `event_start`, `event_end`, `deadline` | Event/deadline semantics. |
| `department`, `programme`, `semester` | Cohort metadata. |
| `tags` | JSON array. |
| `source_url` (NOT NULL), `canonical_url` | Source attribution. |
| `document_links`, `attachments` | JSON. |
| `content_hash` | `sha256` over title+summary+body+url+date — drives change detection. |
| `is_active` | Soft-delete / expiry flag. |
| `first_seen_at`, `last_seen_at`, `last_verified_at`, `last_modified_at` | Provenance. |
| `extraction_status`, `metadata` | Extraction/operational detail. |

Indexes on `source_key`, `content_type`, `audience`, `is_active`,
`published_at DESC`, `source_url`, `event_start`.

**FTS5:** `intranet_items_fts` virtual table over `title, summary, body,
department, tags` with keep-in-sync triggers, enabling the `query=` full-text
search on the list endpoints.

### `intranet_scraper_runs`

One row per per-source run: `id`, `source`, `started_at`, `completed_at`,
`status`, `items_new`, `items_updated`, `items_unchanged`, `items_expired`,
`error_message`, `duration_ms`, `was_complete`.

### `intranet_source_health`

Per-source circuit breaker: `last_success`, `last_attempt`,
`consecutive_fails`, `is_blocked`, `notes`. Blocked after 5 consecutive
failures; reset via the admin API.

### `intranet_auth_log`

One row per login attempt: `attempted_at`, `success`, `failure_reason`.

---

## 5. Scraper Supervisor Lifecycle

`createIntranetScraperSupervisor()` returns `{ start, stop, triggerOnce,
getStatus }` and manages the child `main.py` process.

### States

`idle → running | disabled | unavailable`; on crash `running → backoff` with
exponential restart delay; `stop → stopping → stopped`; clean fast exit
`→ exited` (no respawn, treated as "another instance holds the lock").

| State | Meaning |
|---|---|
| `idle` | Not yet started. |
| `running` | Child process alive. |
| `backoff` | Crashed; restart scheduled with exponential delay. |
| `stopping` / `stopped` | Graceful shutdown in progress / complete. |
| `exited` | Clean exit within the lock-contention window — do not respawn. |
| `unavailable` | venv python missing, or credentials not configured. |
| `disabled` | `INTRANET_SCRAPER_ENABLED=0`. |

### Behavioural notes

- **Restart delay:** `baseDelay * 2^(failures-1)` capped at `maxDelay`
  (defaults 30s base, 15 min max). Stable uptime ≥ 10 min resets the counter.
- **Stop:** `SIGTERM`, then `SIGKILL` after an 8s grace.
- **triggerOnce:** if the daemon is running, it drops `.intranet-run-now`;
  otherwise it spawns `main.py --once`.
- The supervisor does **not** run without both
  `INTRANET_STUDENT_ID` and `INTRANET_PASSWORD` configured.

Wired into `server.js`: started in the listen callback, stopped on graceful
shutdown, and its `getStatus` / `triggerOnce` are passed to `createApp`.

---

## 6. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `INTRANET_STUDENT_ID` | *(required)* | Student id used to authenticate against the intranet. |
| `INTRANET_PASSWORD` | *(required)* | Password. **Never hardcoded.** |
| `INTRANET_BASE_URL` | `https://intranet.srmap.edu.in` | Intranet origin. |
| `INTRANET_DB_PATH` | `Backend/data/intranet.sqlite` | SQLite path shared by scraper + backend. |
| `INTRANET_SCRAPER_ENABLED` | `1` | `0` disables the supervisor. |
| `INTRANET_SCRAPER_RUN_INTERVAL_HOURS` | `24` | Scheduler interval. |
| `INTRANET_SCRAPER_TIMEZONE` | `Asia/Kolkata` | Scheduling timezone. |
| `INTRANET_SCRAPER_LOG_LEVEL` | `INFO` | Scraper logging level. |
| `INTRANET_SCRAPER_TIMEOUT_SECONDS` | `30` | HTTP request timeout. |
| `INTRANET_SCRAPER_SOURCE_TIMEOUT_SECONDS` | `120` | Per-source hard timeout. |
| `INTRANET_SCRAPER_INTER_REQUEST_DELAY` | `0.5` | Delay between requests (politeness). |
| `INTRANET_SCRAPER_MAX_PAGINATION_PAGES` | `20` | Max list pages per source. |
| `INTRANET_SCRAPER_RESTART_DELAY_MS` | `30000` | Supervisor backoff base. |
| `INTRANET_SCRAPER_RESTART_DELAY_MAX_MS` | `900000` | Supervisor backoff cap. |
| `INTRANET_ENABLE_ANNOUNCEMENTS` | `1` | Toggle source (same pattern for `_EVENTS`, `_NEWS`, `_NOTICES`, `_DOCUMENTS`, `_ACADEMIC`, `_FACILITIES`, `_DIRECTORY`, `_LINKS`). |
| `ADMIN_REGISTER_NUMBERS` | *(existing)* | Allowlist that the intranet admin routes reuse for admin-role resolution. |

`INTRANET_STUDENT_ID` and `INTRANET_PASSWORD` are documented (as placeholders)
in `.env.staging.example`; the runtime reads them from the process environment
(`Backend/.env` or the deploy environment).

---

## 7. Express API Endpoints

Router: `Backend/src/routes/intranetRoutes.js`, mounted in `app.js` behind
`createApp` when an `intranetStore` is supplied, under `/api`. All routes use
the shared user-context middleware; non-admin routes require
`req.userContext.isAuthenticated`; admin routes require
`req.userContext.hasAdminAccess`.

| Method & Path | Auth | Description |
|---|---|---|
| `GET /api/intranet/feed?limit=` | any signed-in | Combined recent shared feed (announcements, news, events, circulars, notices). Default 15, max 50. |
| `GET /api/intranet/announcements?limit&page&department&query` | any signed-in | Paginated shared announcements. |
| `GET /api/intranet/events?limit&page&department&query&upcoming` | any signed-in | Shared events; `upcoming=true` uses `getUpcomingEvents`. |
| `GET /api/intranet/news?limit&page&query` | any signed-in | Shared news. |
| `GET /api/intranet/academic?limit&page&query` | any signed-in | Shared academic content. |
| `GET /api/intranet/documents?limit&page&query&contentType` | any signed-in | Documents/notices/circulars. |
| `GET /api/intranet/items?limit&page&contentType&department&sourceKey&query&orderBy` | any signed-in | Generic shared-content list + FTS search. |
| `GET /api/intranet/items/:id` | any signed-in | Single item; `403` if audience ≠ `shared`, `404` if missing. |
| `GET /api/intranet/status` | admin | DB operational status + supervisor status. |
| `POST /api/intranet/scraper/trigger` | admin | Trigger an immediate scrape run. `503` if unavailable. |
| `POST /api/intranet/scraper/reset/:source` | admin | Reset a source's circuit breaker. |

All responses use the standard `{ success: true, data }` envelope (or the
error envelope for failures) and carry no-store cache headers via the shared
`/api` middleware.

---

## 8. Frontend Integration

- **API client:** `Frontend/src/lib/intranet/intranetApi.ts` — typed
  `getIntranetFeed`, `listIntranetItems`, `getIntranetItem`.
- **Dashboard widget:** `IntranetFeedWidget` (in
  `Frontend/src/pages/Dashboard/IntranetFeedWidget.tsx`) renders the most
  recent shared items with content-type badges, published date, and links to
  `/intranet/:id`. Mounted on the Dashboard rail. It renders loading, error
  (with retry), empty, and data states.
- **Page:** `Frontend/src/pages/Intranet/IntranetPage.tsx` handles both
  `/intranet` (feed list) and `/intranet/:id` (item detail with summary, body,
  attachments, and a link back to the original intranet page for source
  attribution).
- **Routes:** `/intranet` and `/intranet/:id` are protected and registered in
  `Frontend/src/routes/baseRoutes.tsx`.

---

## 9. Offline Test Methodology (Mocked HTML Fixtures)

The integration is fully testable **without network access or real
credentials**. Two complementary strategies are used.

### Backend (Node `node:test`)

- **`intranetStore.test.js`** — seeds rows directly through a second
  `node:sqlite` connection to a temp DB (the JS store is read-only over items;
  the Python scraper owns writes) and asserts filtering, pagination, FTS
  search, upcoming-events ordering, feed composition, operational status, and
  circuit-breaker reset.
- **`intranetRoutes.test.js`** — a fake `sessionStore` (with
  `ADMIN_REGISTER_NUMBERS` set) drives the user-context/admin resolution; a
  fake `intranetStore` captures filter args; an `invokeRouter` helper drives
  the Express router directly with no listener.
- **`intranetScraperSupervisor.test.js`** — a fake `spawnFn`/timers harness
  replaces `child_process` and `setTimeout`, injecting a fake child whose
  `exit`/`kill` events are driven manually. Tests cover states, backoff,
  one-shot runs, and credential gating.

### Python (unittest, no Playwright)

`Scraper/intranet/tests/`:

- **`test_normalizer.py`** — pure-function tests for date/URL/text
  normalization, audience classification, content-type fallback, and
  document-link normalization.
- **`test_db.py`** — a temporary SQLite file; tests upsert new/updated/
  unchanged semantics, content-hash stability, expiry reconciliation,
  run logging, and the circuit breaker.
- **`test_scrapers.py`** — a **mocked HTML fixture**
  (`tests/fixtures/announcements_list.html`) is parsed by a minimal fake DOM
  (an `HTMLParser` → `FakeEl` tree implementing the small Playwright
  `ElementHandle` subset the scrapers use: `query_selector`,
  `query_selector_all`, `inner_text`, `get_attribute`, `is_visible`). The real
  `_extract_item_from_element` / `_extract_news_item` functions run against
  the fixture and assert extracted title/URL/date/department/audience and PDF
  document-link extraction.

### Running the suites

```bash
# Backend (from Backend/)
node --test

# Frontend (from Frontend/)
npx vitest run

# Python (from Scraper/)
venv/bin/python3 -m unittest discover -s intranet/tests -v
venv/bin/python3 -m unittest discover -s tests -v   # existing career suite
```

---

## 10. Verification Results

| Suite | Count | Result |
|---|---|---|
| Frontend (`vitest run`, 114 files) | 1,268 | pass |
| Python intranet (normalizer/db/scrapers) | 34 | pass |
| Python career (existing) | 54 | pass (2 skipped) |
| Backend (`node --test`) | 444 | **443 pass; 1 pre-existing flaky test** |

Also clean: `tsc -b` (frontend typecheck), `eslint`, and `vite build`.

> **Note on the backend suite:** every test authored for this integration
> passes. The only intermittent failure is `loginArtifactRetention.test.js`,
> a **pre-existing** timing-sensitive test (committed at `7abb795`) that
> asserts the login-diagnostics rotation evicts the oldest artifacts. Its
> rotation sorts by `mtimeMs`; when 25 artifacts are written within the same
> millisecond the sort ties are unstable, so "oldest preserved ≥ 4" can
> assert falsely. It is unrelated to the intranet integration and is not
> one of the owner files; it passes when the filesystem mtime resolution is
> fine enough, and on earlier full-suite runs the backend reported 444/444.
> It is left untouched per the scope guard.

---

## 11. Operational Notes & Operational Visibility

- **Logs:** `Scraper/intranet/logs/intranet_scraper.log` (rotating), plus
  `[intranet-scraper]`-prefixed lines in the backend log via the supervisor.
- **Health:** `GET /api/intranet/status` (admin) shows last run, last success,
  per-source health, item counts, and supervisor state.
- **Admin actions:** trigger a run and reset a source circuit breaker via the
  admin endpoints above.
- **Credentials:** set `INTRANET_STUDENT_ID` / `INTRANET_PASSWORD` in the
  deploy environment. The supervisor will report `unavailable` (not crash)
  until they are present.
- **Scope guard:** this integration touches only intranet-specific files and
  surfaces; elective-course features and their owner files are intentionally
  left untouched and paused.