# 03 — Backend Deep-Dive

## 3.1 Entry Points

### `Backend/server.js`
A 1-line entry: `require("./src/server")`. The real bootstrap is in `src/server.js`.

### `Backend/src/server.js` — Bootstrap & Dependency Injection
Orchestrates the entire backend startup:

1. **Redis connection** — `getRedisClient()` with reconnect strategy (max 20 retries, exponential backoff)
2. **Driver selection** — Auto-selects Redis vs in-memory for sessions and ERP cache based on `SESSION_STORE_DRIVER` and `ERP_CACHE_DRIVER` env vars
3. **Service instantiation** — All services are created here with explicit dependency injection (no singletons, no globals)
4. **Data seeding** — External pages and events are seeded into the ContentStore on startup
5. **Graceful shutdown** — Handles `SIGTERM`, `SIGINT`, `uncaughtException` with 10-second forced shutdown timeout

**Key DI graph:**
```javascript
createApp({
  sessionStore,            // InMemory or Redis
  discoveryRepository,     // Reads endpoint-discovery.json
  externalDataStore,       // SQLite
  contentStore,            // SQLite (unified content)
  eventsStore,             // SQLite (events system)
  erpAggregationService,   // Core ERP orchestrator
  erpLiveService,          // Direct ERP fetcher
  uiMapStore,              // ERP UI schema mapping
  actionExecutor,          // ERP form action executor
  pagePolicyStore,         // cached-first / live-first policy
  redisClient,             // Raw Redis client (for rate limiting)
  integrityService,        // System health evaluation
})
```

### `Backend/src/app.js` — Express App Factory
Creates the Express application and mounts middleware + routes:

```
Middleware stack (in order):
  1. cors()
  2. helmet()
  3. cookieParser()
  4. compression()
  5. requestContextMiddleware  (assigns req.requestId UUID)
  6. express.json({ limit: "2mb" })
  7. globalRateLimit           (Redis or in-memory, on /api prefix)

Route mounting order:
  /api → health, metrics, telemetry, auth
  /api → erpV2   (conditionally, if FEATURE_ERP_V2_API enabled)
  /api → external, content (if contentStore available), events, attendance, scrape

  Global error handler (catch-all)
```

---

## 3.2 Routes

### `authRoutes.js` — Authentication
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/captcha` | Fetch captcha image + create pre-auth session |
| `GET` | `/api/auth/captcha` | Alias |
| `POST` | `/api/login` | Submit credentials + captcha → authenticate |
| `POST` | `/api/auth/login` | Alias |
| `POST` | `/api/logout` | Clear session cookie |
| `POST` | `/api/auth/logout` | Alias |
| `GET` | `/api/profile` | Fetch/refresh user profile from ERP |
| `GET` | `/api/auth/profile` | Alias |

**Session lifecycle:**
- `GET /captcha` → creates session with storageState, sets `erp_session` cookie
- `POST /login` → validates credentials against ERP, marks session as `loggedIn`
- Profile is fetched eagerly during login or lazily on first `/profile` request
- All subsequent requests use the `erp_session` cookie to look up the session

### `erpV2Routes.js` — ERP Data API (V2)
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v2/erp/page/:category/:page` | Fetch single ERP page data |
| `GET` | `/api/v2/erp/page/:pageKey` | Fetch single ERP page data (flat key) |
| `POST` | `/api/v2/erp/batch` | Fetch multiple ERP pages in one request |
| `GET` | `/api/v2/erp/ui/:category/:page` | Get UI hints (forms, actions) for a page |
| `GET` | `/api/v2/erp/schema/:category/:page` | Get render schema blocks for a page |
| `POST` | `/api/v2/erp/action/execute` | Execute an ERP form action (submit, register) |

**The batch endpoint** is the primary data-fetching mechanism used by the frontend. The frontend sends an array of `pageKeys` and receives a keyed response object.

### `scrapeRoutes.js` — Legacy/Fallback ERP Routes
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/scrape/:pageKey` | Single page fetch (V1 compat) |
| `GET` | `/api/scrape/:category/:page` | Single page fetch |
| `GET` | `/api/scrape/examination/earlier-internal-marks/semester/:semester` | Fetch marks for a specific past semester |
| `GET` | `/api/:category/:page` | Backward compat catch-all |
| `GET` | `/api/:pageKey` | Backward compat catch-all |

### `eventsRoutes.js` — Events System
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/events` | List events with filters (query, category, status, date range) |
| `GET` | `/api/events/calendar` | Calendar-formatted event list |
| `GET` | `/api/events/my-registrations` | User's registered events |
| `GET` | `/api/events/my-created` | User's created events |
| `GET` | `/api/events/analytics` | Event analytics |
| `GET` | `/api/events/notifications` | User's event notifications |
| `POST` | `/api/events` | Create event |
| `GET` | `/api/events/:eventId` | Get event details |
| `PUT` | `/api/events/:eventId` | Update event |
| `DELETE` | `/api/events/:eventId` | Delete event |
| `POST` | `/api/events/:eventId/duplicate` | Duplicate event |
| `PATCH` | `/api/events/:eventId/status` | Transition event status |
| `PATCH` | `/api/events/:eventId/approval` | Approve/reject event |
| `POST` | `/api/events/:eventId/register` | Register for event |
| `POST` | `/api/events/:eventId/cancel-registration` | Cancel registration |
| `POST` | `/api/events/:eventId/check-in` | Check in to event |
| `GET` | `/api/events/:eventId/attendees.csv` | Export attendees CSV |
| `POST` | `/api/events/:eventId/messages` | Bulk message attendees |
| `POST` | `/api/events/:eventId/feedback` | Submit feedback |
| `POST` | `/api/events/:eventId/gallery` | Add gallery photo |
| `GET` | `/api/events/:eventId/ical` | Download iCal file |

### `contentRoutes.js` — Content Management
| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/content/admin/verify` | Verify admin password |
| `GET` | `/api/content` | List content (filterable by type, category) |
| `POST` | `/api/content` | Create content (admin) |
| `GET` | `/api/content/:id` | Get content by ID |
| `PUT` | `/api/content/:id` | Update content (admin) |
| `DELETE` | `/api/content/:id` | Delete content (admin) |
| `GET` | `/api/content/:id/resources` | List resources for content |
| `POST` | `/api/content/:id/resources` | Add resource to content (admin) |

### `healthRoutes.js` — Health & Readiness
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Full health check (sessions, discovery, policy, Redis, integrity) |
| `GET` | `/api/live` | Simple liveness probe |
| `GET` | `/api/ready` | Readiness probe (checks all dependencies) |

---

## 3.3 Services

### `erpClient.js` (49KB — largest service)
The core ERP integration client. Uses **Playwright's request API** (not browser automation) for reliable cookie-based session handling.

**Key exports:**
- `fetchCaptcha()` — Bootstrap a login session, fetch captcha image
- `loginWithCaptcha()` — Submit credentials to ERP
- `createApiContext(storageState)` — Create authenticated request context from saved cookies
- `fetchProfileViaApi(api)` — Fetch student profile page
- `callEndpointViaApi(api, endpoint, target, variables)` — Make an authenticated ERP request to any discovered endpoint
- `isUsableProfileData(data)` — Validate profile response
- `buildFallbackProfileData(username)` — Generate minimal profile if real one fails

### `erpAggregationService.js` (24KB — core orchestrator)
The backbone of the data pipeline. Implements:

- **Cache-first / Live-first strategy** — Determined per-page by `PagePolicyStore`
- **Two-tier cache** — "Fresh" (1 min, returns immediately) and "stale" (10 min, returned with background refresh)
- **Circuit breaker** — Per-page, threshold of 5 failures, 30-second cooldown
- **Semaphore** — Max 30 concurrent upstream ERP requests (prevents flooding)
- **Distributed lock** — Redis NX lock prevents duplicate live fetches across multiple backend instances
- **In-flight deduplication** — Same-process requests coalesced via `inflightByKey` Map
- **Payload validation** — `validateLivePayload()` rejects login-page leakage, checks table count, suspicious text patterns

**Policy Resolution:**
```
1. Check explicit override in PagePolicyStore
2. Check liveFirstPrefixes / cachedFirstPrefixes lists
3. Fall back to defaultMode (cached-first)
4. If FEATURE_ERP_CACHED_FIRST is disabled → always live-first
```

### `erpDocumentBuilder.js` (21KB)
Converts raw Cheerio-parsed HTML into a **typed document AST** (`ErpDocument`):
```
ErpDocument {
  title: string
  root: ErpNode {
    id: string
    type: "container" | "text" | "table" | "form" | "field" | "button"
    props: Record<string, unknown>
    children: ErpNode[]
  }
}
```
This structured document is sent alongside raw `tables`/`text` data and is used by the frontend's `ErpDocumentRenderer` for rich, schema-driven rendering.

### `htmlParser.js`
Light wrapper around Cheerio that:
1. Loads HTML, finds `#divContent` container
2. Extracts heading text from `<h1>/<h2>/<h3>`
3. Extracts all `<table>` elements into arrays of `{ header: value }` objects
4. Handles duplicate column headers via `uniqueHeaders()`
5. Extracts profile-style `key : value` rows from first table
6. Delegates to `erpDocumentBuilder` for AST generation

### `eventsStore.js` (43KB — largest by file size)
Full-featured event management system backed by SQLite:
- Event CRUD with status lifecycle (`draft → published → cancelled → completed`)
- Registration with capacity limits, waitlists, and cancellation
- Check-in with generated codes
- Feedback collection (ratings, comments, custom answers)
- Notification system (event reminders, registration confirmations)
- CSV export, iCal generation, bulk messaging
- Gallery photo management
- Analytics (per-event and aggregate)

### `contentStore.js` (18KB)
Unified content management with SQLite:
- Content entries with type, category, metadata
- Resource attachments per content entry
- Seeding from external pages and events data
- Search by type/category

### `sessionStore.js` / `redisSessionStore.js`
**In-memory SessionStore:**
- Simple `Map<sessionId, sessionData>` with TTL-based cleanup
- Methods: `create(storageState)`, `getOrThrow(sessionId)`, `update(sessionId, updates)`, `size()`

**RedisSessionStore:**
- Same interface, backed by Redis `SET`/`GET` with `EX` TTL
- JSON serialization of session data

### `erpCacheStore.js`
Two implementations:
- `InMemoryErpCacheStore` — `Map` with expiration check on read
- `RedisErpCacheStore` — Redis `SET` with JSON serialization and `EX` TTL

### `pagePolicyStore.js`
Hot-reloading JSON-based policy configuration:
- Reads `erp-page-policy.json`
- Hot-reloads on file change (checks mtime, max once per second)
- Resolves per-pageKey: `cached-first` or `live-first`
- Supports prefix-based rules and explicit overrides

### `redisClient.js`
Redis connection manager:
- Supports direct URL or Sentinel-based master discovery
- Exponential reconnect strategy (max 20 retries)
- Graceful degradation — returns `null` if Redis unavailable (system falls back to in-memory stores)

### `metricsService.js`
Prometheus metrics:
- `erp_cache_result_total` — cache hit/miss/stale/expired counters
- `erp_fetch_source_total` — source breakdown (cache-fresh, cache-stale, live)
- `erp_upstream_failures_total` — failure reason breakdown
- `erp_source_latency` — histogram by source/policy/pageKey
- Circuit breaker state gauge
- Upstream concurrency load gauge
- Cache hit ratio gauge

---

## 3.4 Middleware

### `requestContext.js`
Assigns `req.requestId` (UUID) to every request for distributed tracing. Returned in `x-request-id` response header.

### `rateLimit.js`
Two implementations:
- **Redis-backed:** `INCR` + `EXPIRE` per IP, returns standard rate limit headers
- **Memory-backed:** Sliding window array per IP
- Configurable: 400 requests per 60-second window (default)
- Returns `429` with `retry-after` and structured error envelope

---

## 3.5 Utilities

### `apiResponse.js`
Standardized API response formatting:
- `sendApiSuccess(res, req, body, meta)` — Sets standard headers, returns JSON
- `sendApiError(res, req, error, options)` — Structured error envelope with `{ success: false, error: { code, message, retryable } }`
- Error codes auto-derived from HTTP status (400→BAD_REQUEST, 401→UNAUTHORIZED, etc.)
- Logs at appropriate level (warn for 4xx, error for 5xx)

### `cookies.js`
Session cookie management:
- `resolveSessionId(req)` — Resolves session from cookie, header, query param, or body (in priority order)
- `setSessionCookie(res, req, sessionId)` — Sets `httpOnly`, `secure`, `sameSite=lax` cookie
- Auto-detects secure mode from `x-forwarded-proto` or `NODE_ENV`
- Legacy session ID support with configurable cutoff date

### `logger.js`
Structured JSON logger:
- Writes to stdout + rotating log file (`Backend/logs/backend.log`)
- Log levels: debug, info, warn, error
- Includes timestamps, request IDs, error stacks
- Graceful shutdown with log flush

### `text.js`
Text cleaning utilities:
- `cleanText(value)` — Normalize whitespace, trim
- `toSafeHeaderKey(text, idx)` — Convert table header text to safe key format

### `asyncUtils.js`
Concurrency primitives:
- `Semaphore(maxConcurrency)` — Counting semaphore with `.acquire(timeoutMs)` and release function
- `withTimeout(promise, ms, message)` — Promise timeout wrapper
