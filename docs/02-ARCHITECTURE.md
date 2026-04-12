# 02 — System Architecture

## 2.1 High-Level Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│                     BROWSER                         │
│                  React SPA (Vite)                    │
│  ┌─────────┐ ┌───────────┐ ┌──────────────────────┐ │
│  │Blueprint│→│erpApi.ts  │→│erpTransformers.ts    │ │
│  │ Router  │ │(fetch)    │ │(pipeline + schema)   │ │
│  └─────────┘ └─────┬─────┘ └──────────────────────┘ │
└─────────────────────┼───────────────────────────────┘
                      │ HTTP (fetch, credentials: include)
                      ▼
┌─────────────────────────────────────────────────────┐
│                   NGINX (optional)                   │
│          Reverse proxy • TLS • Compression           │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              EXPRESS BACKEND (:5000)                  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │                   ROUTES                         │ │
│  │  auth • erpV2 • scrape • events • content •     │ │
│  │  health • metrics • telemetry • external •      │ │
│  │  attendance                                     │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                              │
│  ┌────────────────────▼────────────────────────────┐ │
│  │              SERVICE LAYER                       │ │
│  │                                                  │ │
│  │  ErpAggregationService ←─── PagePolicyStore      │ │
│  │       │                                          │ │
│  │       ├── ErpLiveService ←── DiscoveryRepository │ │
│  │       │       │                                  │ │
│  │       │       └── erpClient (Playwright Request) │ │
│  │       │              │                           │ │
│  │       │              └── htmlParser (Cheerio)    │ │
│  │       │                     │                    │ │
│  │       │                     └── erpDocumentBuilder│ │
│  │       │                                          │ │
│  │       ├── ErpCacheStore ←─── Redis / In-Memory   │ │
│  │       └── SessionStore  ←─── Redis / In-Memory   │ │
│  │                                                  │ │
│  │  ErpActionExecutor ←── ErpUiMapStore             │ │
│  │  EventsStore (SQLite)                            │ │
│  │  ContentStore (SQLite)                           │ │
│  │  ExternalDataStore (SQLite)                      │ │
│  │  MetricsService (prom-client)                    │ │
│  └──────────────────────────────────────────────────┘ │
└──────────┬────────────────────────┬─────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐    ┌───────────────────────────┐
│   REDIS 7        │    │   UNIVERSITY ERP          │
│                  │    │   student.srmap.edu.in     │
│ • Sessions       │    │                           │
│ • ERP Cache      │    │   JSP/HTML Application    │
│ • Rate Limits    │    │   Cookie-based sessions   │
│ • Circuit State  │    │   36 discovered endpoints │
│ • Dist. Locks    │    │                           │
└──────────────────┘    └───────────────────────────┘
```

---

## 2.2 Request Lifecycle — ERP Page

This is the most common flow. A user navigates to an ERP-backed page (e.g., `/academic/attendance-details`).

```
1. User clicks "Attendance" in the sidebar
   │
2. React Router renders <AttendanceDetailsPage>
   │
3. Component calls getErpBatch(["academic/attendance-details", "academic/od-ml-details", ...])
   │         via Frontend/src/lib/erpApi.ts
   │
4. fetch("POST /api/v2/erp/batch", { pageKeys: [...] })
   │         credentials: "include" (sends erp_session cookie)
   │
5. Express receives at erpV2Routes → erpAggregationService.getBatch()
   │
6. For each pageKey:
   │
   ├─ 6a. resolveUserKey(sessionId) → e.g., "AP12345678"
   │
   ├─ 6b. Build cacheKey: "erp:ap12345678:academic/attendance-details"
   │
   ├─ 6c. pagePolicyStore.resolveMode("academic/attendance-details")
   │       → "cached-first" (from erp-page-policy.json)
   │
   ├─ 6d. Check Redis cache:
   │       ├─ FRESH HIT  → Return cached data immediately
   │       ├─ STALE HIT  → Return stale data + trigger background refresh
   │       └─ MISS       → Proceed to live fetch
   │
   ├─ 6e. Live ERP fetch (on cache miss):
   │       │
   │       ├─ Check circuit breaker (is ERP healthy?)
   │       ├─ Acquire semaphore slot (max 30 concurrent upstream calls)
   │       ├─ Acquire distributed lock (Redis NX, prevents duplicate fetches)
   │       │
   │       ├─ erpLiveService.scrapeByKey(sessionId, pageKey)
   │       │   │
   │       │   ├─ discoveryRepository.resolveEndpoint("Academic", "Attendance Details")
   │       │   │   → { method: "POST", url: "students/report/studentreportresources.jsp", params: { ids: 3 } }
   │       │   │
   │       │   ├─ createApiContext(storageState)  [Playwright request context w/ user cookies]
   │       │   │
   │       │   ├─ callEndpointViaApi(api, endpoint, target, variables)
   │       │   │   → POST to ERP JSP endpoint
   │       │   │   → receives raw HTML
   │       │   │
   │       │   └─ htmlParser.parseHtmlContent(html)
   │       │       ├─ cheerio.load(html)
   │       │       ├─ extract title from <h1/h2/h3>
   │       │       ├─ extract all <table> elements → row arrays
   │       │       ├─ extract profile TableContent (key:value pairs)
   │       │       └─ buildDocument(contentRoot, $, title) → ErpDocument AST
   │       │
   │       ├─ validateLivePayload(pageKey, data)
   │       │   ├─ Check payload contract (min table count, suspicious text, etc.)
   │       │   └─ Reject login-page leakage
   │       │
   │       └─ writeCache(cacheKey, pageKey, data)
   │           → Redis SET with TTL (default: 10min stale, 1min fresh)
   │
   └─ 6f. Return JSON response with { success, pageKey, source, data, fetchedAt, staleAt }
   │
7. Frontend receives batch response
   │
8. Page component calls executePipeline(blueprint, rawData)
   │         via Frontend/src/lib/erpTransformers.ts
   │
   ├─ 8a. deriveTransformerKey(blueprint) → "attendance"
   ├─ 8b. transformAttendance(rawData) → typed AttendanceModel
   ├─ 8c. enforceSchema(result, attendanceSchema)
   │       ├─ Validate each record against field types
   │       ├─ Drop invalid rows (graceful degradation)
   │       └─ Return { validData, errors, warnings }
   └─ 8d. Return TransformerOutput { type, data, isValid, errors, warnings }
   │
9. Component renders validated, typed data
```

---

## 2.3 Authentication Flow

```
1. User opens /login
   │
2. Frontend: GET /api/auth/captcha
   │   Backend:
   │   ├─ erpClient.fetchCaptcha()
   │   │   ├─ Create Playwright BrowserContext
   │   │   ├─ GET StudentLoginPage (bootstraps cookies)
   │   │   ├─ GET /captchas (image)
   │   │   ├─ Convert captcha to base64
   │   │   └─ Export storageState (cookies + origins)
   │   │
   │   ├─ sessionStore.create(storageState)  → sessionId (UUID)
   │   ├─ Set erp_session cookie (httpOnly, secure, sameSite=lax)
   │   └─ Return { sessionId, captchaBase64, expiresInMs }
   │
3. User enters username, password, captcha text
   │
4. Frontend: POST /api/auth/login { username, password, captcha }
   │   Backend:
   │   ├─ sessionStore.getOrThrow(sessionId)
   │   ├─ erpClient.loginWithCaptcha({ storageState, username, password, captcha })
   │   │   ├─ Restore Playwright context from storageState
   │   │   ├─ POST StudentLoginToPortal (form-encoded: txtUserName, txtAuthKey, ccode)
   │   │   ├─ Check for failure indicators in response HTML
   │   │   ├─ On success: optionally fetch profile data
   │   │   └─ Export updated storageState
   │   │
   │   ├─ sessionStore.update(sessionId, { storageState, loggedIn: true, profileData })
   │   ├─ Set erp_session cookie (refreshed TTL)
   │   └─ Return { success, sessionId, profileData }
   │
5. Frontend: storeSessionAuth({ sessionId, profileData })
   │   → localStorage: token, sessionId, profileData
   │
6. Navigate to /dashboard
```

---

## 2.4 Component Dependency Map

```
server.js (bootstrap)
 ├── createApp(deps)                     → app.js
 │    ├── createAuthRoutes               → authRoutes.js
 │    ├── createErpV2Routes              → erpV2Routes.js
 │    ├── createScrapeRoutes             → scrapeRoutes.js
 │    ├── createEventsRoutes             → eventsRoutes.js
 │    ├── createContentRoutes            → contentRoutes.js
 │    ├── createExternalRoutes           → externalRoutes.js
 │    ├── createHealthRoutes             → healthRoutes.js
 │    ├── createMetricsRoutes            → metricsRoutes.js
 │    ├── createTelemetryRoutes          → telemetryRoutes.js
 │    └── createAttendanceRoutes         → attendanceRoutes.js
 │
 ├── ErpAggregationService
 │    ├── ErpLiveService
 │    │    ├── erpClient (Playwright)
 │    │    │    └── htmlParser (Cheerio)
 │    │    │         └── erpDocumentBuilder
 │    │    └── DiscoveryRepository
 │    ├── ErpCacheStore (InMemory | Redis)
 │    ├── PagePolicyStore
 │    └── SessionStore (InMemory | Redis)
 │
 ├── ErpActionExecutor
 │    └── ErpUiMapStore
 │
 ├── EventsStore (SQLite)
 ├── ContentStore (SQLite)
 ├── ExternalDataStore (SQLite)
 └── ErpIntegrityService
```

---

## 2.5 Data Storage Matrix

| Store | Technology | Purpose | Persistence | TTL |
|-------|-----------|---------|-------------|-----|
| **Session Store** | Redis (or in-memory Map) | Playwright storageState, login state, profile | Volatile | 30 min |
| **ERP Cache** | Redis (or in-memory Map) | Parsed ERP responses per user+page | Volatile | 1 min fresh / 10 min stale |
| **Content DB** | SQLite (`content.sqlite`) | Unified content entries (external pages, events metadata, resources) | Persistent | — |
| **Events DB** | SQLite (`events.sqlite`) | Events, registrations, notifications, feedback, gallery | Persistent | — |
| **External Pages DB** | SQLite (`external-pages.sqlite`) | External page metadata & links | Persistent | — |
| **Discovery Map** | JSON file (`endpoint-discovery.json`) | ERP menu → endpoint mappings | Persistent (file) | — |
| **ERP Page Policy** | JSON file (`erp-page-policy.json`) | Per-page cache strategy overrides | Persistent (file, hot-reloaded) | — |
| **Filesystem** | Disk (`Backend/data/events/`, etc.) | Event poster images, uploaded files | Persistent | — |

---

## 2.6 Security Model

```
┌────────────────────┐
│   BROWSER          │
│                    │
│ localStorage:      │
│  • token (dummy)   │   ← Only used to track "logged in" state in UI
│  • sessionId       │   ← Legacy fallback, being phased out
│  • profileData     │   ← Cached profile for UI display
│                    │
│ httpOnly cookie:   │
│  • erp_session     │   ← PRIMARY session identifier (secure, httpOnly)
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│   BACKEND          │
│                    │
│ Session contains:  │
│  • storageState    │   ← Playwright browser cookies for ERP
│  • loggedIn        │   ← Boolean flag
│  • profileData     │   ← Cached profile from ERP
│  • username        │   ← Student registration number
│                    │
│ NEVER stored:      │
│  • Password        │   ← Only used during login POST, never persisted
│  • ERP cookies     │   ← Only in ephemeral storageState
└────────────────────┘
```

**Security controls:**
- `helmet` for security headers
- `httpOnly` + `secure` + `sameSite` cookies
- Rate limiting (Redis-backed or in-memory)
- Input validation on all routes
- Admin content endpoints require `x-admin-password` header
- Session TTL with automatic cleanup
- Circuit breaker prevents ERP flooding on failures
