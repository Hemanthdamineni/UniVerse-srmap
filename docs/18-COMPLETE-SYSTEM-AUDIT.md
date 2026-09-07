# 18 — Complete System Audit

**Audit date:** 2026-08-31  
**Scope:** Entire tracked repository plus runtime/deployment configuration, generated build output, ignored runtime artifacts, and current documentation  
**Method:** Static forensic review, route and dependency tracing, graph-assisted cross-layer analysis, automated checks, and a second evidence pass  
**Change policy:** Audit only. No production code or configuration was changed.
## Executive verdict

**Overall grade: C- (5.0/10). Production readiness: NO-GO.**

The application is much more substantial than a prototype: it has 87 registered page blueprints, 341 Express endpoints, persistent SQLite stores, a real ERP browser/client layer, Redis-backed sessions and caching, 1,488 passing unit/integration tests across the three workspaces, and a blocking real-stack Playwright job in CI. The core student ERP, event, LMS, career, feedback, and helpdesk domains are broadly implemented.

That breadth is undermined by three release-blocking facts:

1. The documented ingress deployment cannot start or reach the backend as composed. It has wrong relative bind mounts, an isolated network, no published 443 port, and no certificate mount even though the loaded nginx configuration requires certificates.
2. If that ingress is made reachable without changing `/files/`, it maps the entire `Backend/data` directory to a public URL namespace. That directory holds predictable SQLite database names, WAL/SHM files, ERP artifacts, uploads, submissions, and certificates.
3. The backend has two competing definitions of admin: the intended elevated-session flag and a companion-domain role derived only from an allowlisted register number. The latter bypasses the password elevation step across multiple privileged stores and routes.

The repository is therefore a strong development-stage system with good test volume, but not a safe or reproducible production deployment.

### Severity summary

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 2 | Release/deployment blocker or broad data disclosure when ingress is active |
| High | 7 | Privilege, availability, isolation, or unbounded resource risk |
| Medium | 12 | Material correctness, operability, performance, or completeness defect |
| Low | 7 | Maintainability, documentation, or defensive-hardening issue |

## Scorecard

| Area | Score | Assessment |
|---|---:|---|
| Code quality | 6.0/10 | Clear domain boundaries in many places, but files up to 3,042 LOC, 146 unused exports, unsafe casts, and several duplicated authorization idioms |
| Architecture | 6.0/10 | Sensible frontend/backend/scraper split; stores and route factories are modular, but deployment topology and authorization models are inconsistent |
| Security | 2.5/10 | Good cookie defaults, CORS allowlist, Helmet, and scoped user cache keys; defeated by public data mount, admin bypass, pre-auth uploads, and spoofable rate-limit identity |
| Performance | 5.0/10 | Lazy page routes, compression, Redis cache, and concurrency controls exist; oversized bundles/assets, high-cardinality metrics, sync request-path I/O, and JSON-blob stores remain |
| Scalability | 4.0/10 | Redis assists sessions/cache/locks, but SQLite + whole-array persistence, process-local state, non-renewed locks, and single-backend assumptions constrain scale-out |
| Test coverage | 8.0/10 | 1,488 automated tests passed locally; real-stack CI exists. Browser execution was unavailable locally, scraper is absent from CI, and key security invariants are untested |
| CI/CD | 6.5/10 | Unit, lint, build, metadata, responsive, and real-stack jobs exist; vulnerability and dead-code failures are explicitly non-blocking |
| Documentation | 4.5/10 | Extensive and unusually detailed, but it describes stale/incorrect ingress, admin, route-count, file-sharing, and test facts |
| Developer experience | 6.0/10 | Straightforward npm workspaces and strong scripts, but no unified test command, missing scraper test dependency/script, and tests leave hundreds of DB files |
| Feature completeness | 6.5/10 | Most major domains are real; six placeholders are honestly marked, but several admin/academic screens are static, dead, or unreachable |
| Observability | 5.0/10 | Prometheus, logs, request IDs, alerts, and runbooks exist; health does not represent readiness, public telemetry can poison cardinality, and data sinks swallow failures |
| Data integrity | 4.5/10 | WAL and transactions are used in key stores; public DB exposure, array-blob persistence, non-atomic locks, and silent ingestion failures are substantial risks |
| Error handling/resilience | 5.0/10 | Common error envelopes and upstream policies exist; rate limiting fails open, Redis failure becomes permanent process fallback, and readiness omits major dependencies |

## Audit basis and limitations

- Repository inventory: 922 tracked files; 450 frontend TS/TSX files, 103 backend JS files, and 20 first-party scraper Python files.
- Graph-assisted inventory: 6,400 entities, 15,166 relationships, and 318 communities after deterministic AST extraction plus semantic documentation extraction. Generated graph artifacts are ignored under `graphify-out/` and are not part of the product change.
- The audit did not use live university credentials and did not mutate the upstream ERP.
- Browser-based responsive and end-to-end suites could not be run locally because the Playwright Chromium executable is not installed. CI is configured to install it.
- Current npm advisory data could not be fetched because the advisory request was blocked by the execution environment. Lockfiles and CI policy were inspected, but this report does not claim a fresh CVE result.
- Static reasoning about nginx follows the checked-in configuration and Compose resolution. Containers were not started because the configuration requires external network/certificate state and the task did not authorize deployment mutation.

## Release-blocking findings

### C-01 — The canonical ingress deployment is internally inconsistent and non-startable

**Severity:** Critical  
**Confidence:** Confirmed by `docker compose ... config` and source inspection  
**Evidence:** `infra/docker/compose.ingress.yml:5-15`, `infra/nginx/conf.d/university-erp.conf:33-40`, `infra/nginx/conf.d/university-erp.conf:97-101`, `docker-compose.yml:17-69`, `infra/README.md:51-73`, `docs/09-INFRASTRUCTURE.md:47-62`

The exact documented command combines the root Compose file with `infra/docker/compose.ingress.yml`. Under Compose's path-resolution rules, the override's `../nginx`, `../../Frontend/dist`, and `../../Backend/data` binds resolve relative to the root Compose project directory, not the override file. The resolved sources point outside this repository. The root backend is attached to the merged default network, while ingress is attached only to an undeclared-by-root external `erp_app` network, so `backend:5000` is not reachable from ingress. The service publishes only port 80, nginx redirects every non-ACME HTTP request to HTTPS, port 443 is not published, and no `/etc/letsencrypt` certificate volume is mounted even though nginx loads required certificate paths at startup.

**Impact:** The documented deployment path cannot reliably start nginx or serve the application. Fixing only one symptom reveals the next.

**Remediation:** Make one Compose project authoritative. Use paths correct relative to the first Compose file, attach backend and ingress to the same explicitly declared network, mount/provision certificates, publish 443, and add `nginx -t` plus an actual ingress smoke test to CI. Remove the obsolete comment that references a deleted TLS script.

### C-02 — The ingress publishes the whole application data directory

**Severity:** Critical when ingress is reachable  
**Confidence:** Confirmed configuration  
**Evidence:** `infra/nginx/conf.d/university-erp.conf:97-101`, `infra/docker/compose.ingress.yml:8-12`, `Backend/src/config/env.js:84-129`, `docs/09-INFRASTRUCTURE.md:19-23`

`/files/` aliases `/srv/university-erp-data/`, and that path is a read-only bind of the entire `Backend/data` directory. Predictable files in that directory include `content.sqlite`, `external-pages.sqlite`, `lms.sqlite`, `lms-tracker.sqlite`, `events.sqlite`, `helpdesk.sqlite`, `career.sqlite`, `companion-analytics.sqlite`, WAL/SHM companions, ERP dumps, login diagnostics, and user-upload directories. This bypasses the narrower Express mounts, which expose only submissions and certificates.

**Impact:** A request such as `/files/<predictable-database-name>` may disclose the full application's student, event, content, feedback, career, and analytics data. WAL files can contain recent or deleted records. ERP dumps and diagnostics can contain upstream page contents.

**Remediation:** Never mount the database root into nginx. Mount only an intentionally public, opaque-ID artifact directory. Prefer authenticated download endpoints with authorization checks, `Content-Disposition`, and short-lived signed tokens. Deny dotfiles, database extensions, WAL/SHM, dumps, logs, and directory traversal at both the filesystem and proxy layers. Add an automated negative test for every sensitive default filename.

## High-severity findings

### H-01 — Companion-domain admin authorization bypasses elevation

**Evidence:** `Backend/src/config/adminUsers.js:4-15`, `Backend/src/middleware/adminContext.js:18-25`, `Backend/src/routes/adminRoutes.js:21-38`, `Backend/src/utils/eventsAuth.js:58-75`, `Backend/src/utils/eventsAuth.js:93-106`, `Backend/src/routes/companionAnalyticsRoutes.js:10-15`

The intended flow distinguishes an allowlisted **potential** admin from a password-elevated session. `eventsAuth.resolveRoleAsync`, however, returns `admin` solely from allowlist membership and sets `hasAdminAccess` without checking `session.adminElevated`. Its `adminPassword` parameter and imported password helper are unused. Events, competitions, helpdesk, campus feedback, career, LMS, profile, recommendations, and companion analytics all consume this companion user context or role-based store checks. The fallback allowlist also contains a hardcoded student identifier; it is deliberately redacted here.

**Impact:** An allowlisted student account receives companion admin capabilities immediately after normal ERP login, even after calling the admin-disable endpoint.

**Remediation:** Derive all privileged access from one server-side authorization object. Require `req.adminContext.isElevated` for administrative operations; keep organizer/judge/faculty roles separate. Remove the hardcoded production fallback and fail closed when no allowlist is configured. Add cross-router tests asserting that a potential-but-not-elevated admin receives 403.

### H-02 — Upload middleware writes attacker data before authentication and authorization

**Evidence:** `Backend/src/routes/competitionRoutes.js:14-44`, `Backend/src/routes/competitionRoutes.js:108-120`, `Backend/src/routes/competitionRoutes.js:127-164`

Both Multer handlers run before `ensureAuthenticated`. An unauthenticated request can therefore create directories and write a 10 MiB template file or 25 MiB submission file before receiving 401. Template uploads have no MIME allowlist and no organizer permission check. Submission MIME is checked only after disk write, and rejected files are not deleted. Template files are returned under the public certificate URL.

**Impact:** Disk exhaustion, arbitrary content hosting, orphaned files, and unauthorized template replacement/creation attempts. The spoofable rate limiter amplifies this.

**Remediation:** Put authentication and event-role authorization before Multer. Use `fileFilter`, magic-byte validation, randomized server extensions, quarantine, post-write cleanup on every error, per-user quotas, and a private storage root.

### H-03 — Rate limiting and request attribution trust attacker-controlled X-Forwarded-For

**Evidence:** `Backend/src/middleware/rateLimit.js:10-15`, `Backend/src/middleware/rateLimit.js:112-114`, `Backend/src/middleware/rateLimit.js:162-164`, `Backend/src/middleware/requestContext.js:5-12`, `infra/nginx/conf.d/university-erp.conf:76-94`

The backend uses the first `X-Forwarded-For` value as the client key. Nginx appends the real address to any incoming header, leaving an attacker-controlled first value. An attacker can rotate that value to bypass both global and login budgets and can falsify logged client IPs. Redis errors also make both limiters fail open rather than using the in-memory fallback.

**Impact:** Credential stuffing, telemetry/analytics spam, upload amplification, and unreliable incident attribution.

**Remediation:** Configure Express `trust proxy` for the exact proxy hop count and use `req.ip`; overwrite rather than append untrusted forwarding headers at the edge. Fall back to the local limiter on Redis errors and emit an alert/metric.

### H-04 — ERP circuit-breaker failures are global by page and include user authentication errors

**Evidence:** `Backend/src/services/erp/erpAggregationService.js:495-497`, `Backend/src/services/erp/erpAggregationService.js:650-671`, `Backend/src/services/erp/erpAggregationService.js:805-867`

Cache keys are correctly user-scoped, but circuit keys are only page-scoped. Every exception from a live scrape increments the shared circuit, including session-expired/401-style user failures. Five bad sessions for one page can open the page circuit for every user.

**Impact:** Cross-user denial of service and noisy-neighbor coupling.

**Remediation:** Count only upstream availability/time-out/5xx failures, never caller authentication or validation errors. Document whether the circuit represents an upstream endpoint or a user session and test multi-user isolation.

### H-05 — Public telemetry creates unbounded Prometheus label cardinality

**Evidence:** `Backend/src/routes/telemetryRoutes.js:9-24`, `Backend/src/services/campus/feedbackServices.js:691-709`, `Backend/src/config/env.js:69-70`

The feature is enabled by default, the endpoint is anonymous, and its payload is accepted as any object. Attacker-controlled route, kind, and name values become metric labels. Prometheus client registries retain label series, so arbitrary values grow process memory and make metrics expensive.

**Impact:** Remote memory exhaustion and corrupted performance telemetry.

**Remediation:** Validate a strict schema, map routes to registered templates, enum event kinds/names, cap lengths, drop unknown labels, require a session, and apply a separate hard limiter.

### H-06 — Anonymous analytics writes have no retention policy

**Evidence:** `Backend/src/routes/companionAnalyticsRoutes.js:18-29`, `Backend/src/services/career/careerServices.js:208-223`, `Backend/src/services/career/careerServices.js:264-328`, `Backend/src/services/career/careerServices.js:345-424`

`POST /api/analytics/events` accepts anonymous events and inserts every accepted row into SQLite. Field-size limits exist, but no pruning, retention, sampling, aggregation, or per-actor quota was found. The spoofable global limiter is the only broad control.

**Impact:** Persistent disk growth and intentionally poisoned product analytics.

**Remediation:** Require a session or signed ingest token, restrict event names to a registry, add per-session/IP quotas, and enforce scheduled retention/aggregation.

### H-07 — Health checks declare success without checking critical dependencies

**Evidence:** `docker-compose.yml:50-53`, `Backend/src/routes/healthRoutes.js:17-37`, `Backend/src/routes/healthRoutes.js:48-83`, `Backend/src/services/core/sessionServices.js:60-133`

Docker probes `/api/health`, which always responds success. The separate readiness route omits most SQLite stores and considers Redis ready when no client exists. A Redis initialization failure sets a process-level `initFailed` flag and returns `null` forever, so the process silently remains on in-memory session/cache behavior until restart.

**Impact:** Orchestrators route traffic to degraded instances; sessions and cached state become process-local; dependency outages are hidden.

**Remediation:** Probe `/api/ready`; require all configured mandatory dependencies; distinguish "Redis intentionally disabled" from "configured but unavailable"; add reconnection/backoff; include store read/write checks or a migration/version check.

## Medium- and low-severity findings

| ID | Sev. | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| M-01 | Medium | Nginx caps bodies at 10 MiB while LMS and competition APIs/UI advertise 20–25 MiB. Production rejects valid-looking uploads before Express. | `infra/nginx/nginx.conf:26`, `infra/nginx/conf.d/university-erp.conf:66-67`, `Backend/src/config/env.js:152-158`, `Backend/src/routes/competitionRoutes.js:31`, `Frontend/src/pages/LMS/AddResourcePage.tsx:477` | Define one upload-size token and propagate it to edge, API, and UI. |
| M-02 | Medium | Redis lock TTL defaults to 12s while live ERP timeout is 15s; valid calls can outlive their lock. Release is a non-atomic GET then DEL and can delete a successor's lock. | `Backend/src/config/env.js:48-52`, `Backend/src/services/erp/erpAggregationService.js:674-711` | Use compare-and-delete Lua, renewal, and a TTL greater than the complete operation budget. |
| M-03 | Medium | `/api/metrics`, health, liveness, and readiness are public; health exposes discovery/integrity/runtime details. | `Backend/src/middleware/rateLimit.js:18-23`, `Backend/src/routes/healthRoutes.js:17-83`, `Backend/src/routes/metricsRoutes.js:7-12` | Expose a minimal public liveness response; restrict metrics and detailed readiness to an internal network/token. |
| M-04 | Medium | `GET /hostel-buddy/governance` performs synchronous, unbounded `appendFileSync` to `/tmp/route-hits.log` on each request, outside its error handler. | `Backend/src/routes/hostelBuddyRoutes.js:63` | Delete the debug write; use structured asynchronous logging and sampling. |
| M-05 | Medium | Live ERP attendance/timetable sink failures are swallowed. Cached data may be served while academic snapshots and vacant-room data silently stop updating. | `Backend/src/server.js:296-320`, `Backend/src/services/erp/erpAggregationService.js:872-877` | Record failure metrics/logs with page and request correlation; expose freshness in readiness/admin UI. |
| M-06 | Medium | Events and helpdesk persist whole arrays as JSON blobs. Helpdesk rewrites all tickets/replies/FAQs per mutation; multi-instance writers can overwrite each other's stale in-memory state. | `Backend/src/services/events/eventsStore.js:1312-1460`, `Backend/src/services/campus/helpdeskStore.js:109-176` | Normalize hot records, use transactions/version checks, and define a single-writer or migration plan. |
| M-07 | Medium | Tests leave ignored SQLite databases in `Backend/data`. This audit observed 429 randomized DB files and 133 MiB total data after test execution; helpdesk tests intentionally prefer the repo data directory and never clean up. | `Backend/test/helpdeskStore.test.js:9-27`, `Backend/test/vacantRoomStore.test.js:18-34`, `.gitignore` runtime DB rules | Use `node:test` cleanup hooks and `mkdtemp` under OS temp; close and delete DB/WAL/SHM files. |
| M-08 | Medium | Admin Audit Logs and Certificate Templates are static fabricated datasets presented as internal API data; controls have no handlers. No audit-log backend endpoint exists. | `Frontend/src/pages/Admin/AdminAuditLogsPage.tsx:1-45`, `Frontend/src/pages/Admin/AdminCertTemplatesPage.tsx:26-35`, `Frontend/src/pages/Admin/AdminCertTemplatesPage.tsx:52-60`, `Frontend/src/pages/Admin/AdminCertTemplatesPage.tsx:141-144` | Mark unavailable, hide routes, or implement APIs. Never present fake security/audit data as current. |
| M-09 | Medium | Academic Progress, Planner, and Advising are ten-line shells referenced in `DOMAIN_PAGE_MAP` but absent from `PAGE_BLUEPRINTS`; route generation can never emit them. A breadcrumb points to another nonexistent route. | `Frontend/src/routes/erpRoutes.tsx:74-77`, `Frontend/src/routes/erpRoutes.tsx:110-176`, `Frontend/src/pages/AcademicTracker/AcademicProgressPage.tsx:1-11`, `Frontend/src/config/navigationRegistry.ts:86-94` | Add honest blueprint/route states or remove orphaned pages and correct the academic landing breadcrumb. |
| M-10 | Medium | Static prototype E2E files exist, but CI runs only the responsive audit plus `*.realstack.spec.ts`. The CI comment says 43 specs while the repository currently contains 51 `test()` calls in real-stack specs and 65 across E2E files. | `.github/workflows/ci.yml:165-245`, `Frontend/playwright.config.realstack.ts:23-30` | Run both profiles deliberately and derive/report counts instead of hardcoding them in comments. |
| M-11 | Medium | Production bundles remain large: Mermaid ~1.00 MiB raw/312 KiB gzip, main app ~400 KiB raw, charts ~380 KiB raw, a logo asset ~1.49 MiB, and PWA precache ~6.19 MiB. Vite warns about chunks over 500 KiB. | Build output from `npm run build`; `Frontend/vite.config.ts` chunking/PWA config | Lazy-load Mermaid/charts only on consuming routes, optimize the logo, and budget precache/chunk sizes in CI. |
| M-12 | Medium | Dependency/security audits and Knip are non-blocking by design; CI uploads reports even on high-severity audit or dead-code failures. | `.github/workflows/ci.yml:36-52`, `.github/workflows/ci.yml:89-105`, `.github/workflows/ci.yml:132-154` | Fail on actionable high/critical production advisories and maintain a reviewed Knip allowlist/baseline. |
| L-01 | Low | Knip reports five likely unused UI files, four unused dependencies, 146 unused exports, and 26 duplicate exports. Four k6 files are intentional CLI entry points and are false positives. | Root `npm run knip`; `knip.json`, `Frontend/knip.json` | Remove confirmed dead items and tune entries before turning the gate on. |
| L-02 | Low | First-party files exceed the 500 LOC project rule: `lmsStore.js` 3,042; `careerStore.js` 2,526; `EventWorkflowPages.tsx` 2,231; `erpClient.js` 2,008; `competitionStore.js` 2,006; `eventsStore.js` 1,534. | `wc -l`; project `AGENTS.md` | Continue the documented split plan with ownership boundaries and focused tests. |
| L-03 | Low | Frontend production source contains approximately 82 `any` tokens and 28 `as unknown as` casts; highest concentration is Markdown highlighting and complex ERP/career pages. | Static `rg` count under `Frontend/src` excluding tests | Replace boundary casts with runtime schemas and typed adapters. Treat the count as a triage signal, not a compiler error count. |
| L-04 | Low | Frontend analytics documentation/context says production tracking is intentionally a no-op, but the current implementation sends a production beacon to `/api/analytics/events`. | Project `AGENTS.md` Analytics note; `Frontend/src/lib/core/analytics.ts:41-72` | Update the architectural contract and privacy/retention documentation to match runtime behavior. |
| L-05 | Low | Admin shared-password comparison is plain string equality rather than constant-time comparison. | `Backend/src/utils/adminAccess.js:1-20` | Use a timing-safe comparison after equal-length normalization; preferably replace shared passwords with identity-backed roles. |
| L-06 | Low | `eventsAuth` defaults missing authenticated profile identity fields to generic values such as `erp-user` and example email, increasing collision and misleading audit risk. | `Backend/src/utils/eventsAuth.js:16-24`, `Backend/src/utils/eventsAuth.js:49-52`, `Backend/src/utils/eventsAuth.js:93-115` | Reject incomplete authenticated profiles for state-changing operations and preserve an explicit unknown/null state. |
| L-07 | Low | The generated/ignored `infra/Infra.zip` contains removed legacy Compose/Postgres files and can mislead local operators even though it is not tracked. | Local ignored artifact `infra/Infra.zip`; `.gitignore` | Delete local stale bundles and distribute versioned artifacts through releases, not the source tree. |

## System architecture and dependency map

```text
React 19 SPA (Vite, React Router, TanStack Query)
  ├─ ERP pages ───────────────► /api/v2/erp/* ─► aggregation/cache/policy
  │                                                   └─ Playwright/Cheerio ERP client ─► SRM ERP
  ├─ Events/competitions ─────► /api/events, /api/competitions, /api/teams
  ├─ LMS/resources ───────────► /api/lms/*, /api/resources/*
  ├─ Career/profile ──────────► /api/career/*, /api/profile/*, recommendations
  ├─ Feedback/helpdesk ───────► /api/campus-feedback/*, /api/helpdesk/*
  └─ Admin/telemetry ─────────► /api/admin/*, /api/analytics/*, /api/telemetry/*

Express 5 composition root (`Backend/src/server.js` + `Backend/src/app.js`)
  ├─ Redis: sessions, ERP cache, circuit state, rate limits, locks
  ├─ SQLite stores: content, LMS, events, competitions, career, feedback,
  │                 helpdesk, profiles, analytics, attendance, rooms, teams
  ├─ Filesystem: uploads, LMS files, submissions, certificates, ERP dumps, logs
  └─ Python scraper supervisor ─► Scraper/main.py ─► external career sources

Deployment intent
  └─ nginx ingress ─► SPA + Express + public files
       (currently broken and dangerously broad; see C-01/C-02)
```

### Entrypoints and lifecycle

| Layer | Entrypoint | Lifecycle / state |
|---|---|---|
| Frontend | `Frontend/src/main.tsx` → `App.tsx` → `routes/index.tsx` | Providers own query cache, session/admin/event UI state; route modules are lazy-loaded |
| Backend | `Backend/src/server.js` → `createApp` in `Backend/src/app.js` | Constructs repositories/stores/services, initializes Redis best-effort, starts jobs and HTTP server, shuts down stores/timers |
| Scraper | `Scraper/main.py` | Scheduled or one-shot source scraping, normalization/deduplication, SQLite career writes |
| CI | `.github/workflows/ci.yml` | Separate backend/frontend/build/Knip/responsive/real-stack jobs |
| Production | `docker-compose.yml` plus optional infra overrides | Backend + Redis root bundle; ingress/monitoring overrides (ingress currently invalid) |

### Data ownership

| Data | Owner | Persistence | Key consumers |
|---|---|---|---|
| ERP session/cookies | session service | Redis or memory fallback, 30-minute TTL | Auth, ERP client, all user-context middleware |
| ERP page cache/circuit/locks | aggregation service | Redis or memory | ERP v2/scrape endpoints, dashboard/pages |
| Content/resources | content and LMS stores | SQLite + files | Learning Materials, LMS, admin moderation |
| Events | events store | SQLite JSON state + files | Event browsing/registration/organizer/admin |
| Competitions | competition store | normalized SQLite + submissions/certificates | Teams, rounds, judging, leaderboard, certificates |
| Career | career store + Python scraper | SQLite | Opportunities, applications, alumni, interviews, recommendations |
| Campus feedback/helpdesk | dedicated stores | normalized feedback SQLite; JSON-state helpdesk SQLite | Student flows and admin moderation |
| Unified profile/analytics | profile and analytics stores | SQLite | Public career profile, recommendations, admin dashboards |

## Frontend feature and route matrix

### Base and supplemental routes

| Routes | Status | Auth | Data source / notes |
|---|---|---|---|
| `/`, `/Home` | Implemented redirect | Mixed | Session-aware dashboard/login redirect |
| `/login`, `/forgot-password` | Implemented | Public | ERP captcha/login/password-reset proxy |
| `/career/public/:userId` | Implemented | Public | Public-profile backend contract and privacy settings |
| `/dashboard`, `/profile` | Implemented | Session | ERP pages plus internal companion data |
| `/events`, `/events/create`, `/events/my-activity`, `/events/my-teams`, `/events/my-created`, `/events/attendance` | Implemented | Session | Events/competition APIs |
| `/events/:eventId`, `/register`, `/teams/create`, `/teams/:teamId`, `/invitations`, `/submit/:roundId`, `/my-results/:roundId`, `/leaderboard/:roundId`, `/certificate/:roundId` | Implemented | Session; role checks for mutations | Event provider + competition APIs |
| `/events/:eventId/manage`, `/manage/roles`, `/manage/certificate`, `/manage/rounds/:roundId/submissions`, `/.../:submissionId/evaluate`, `/.../shortlist` | Implemented | Session + frontend permission guard; backend store authorization | Organizer/judge workflows |
| `/teams/persistent/:teamId` | Implemented | Session | Persistent-team API |
| `/learn`, `/learn/discover`, `/learn/practice`, `/learn/me`, `/learn/contribute`, `/learn/contribute/new`, `/learn/requests` | Implemented | Session | LMS APIs |
| `/learn/contributors/:userId`, `/learn/r/:id`, `/learn/subjects/:code`, `/learn/guides`, `/learn/guides/new`, `/learn/guides/:id`, `/learn/roadmaps`, `/learn/roadmaps/new`, `/learn/roadmaps/:id`, `/learn/exam-feedback` | Implemented | Session | LMS resources/guides/roadmaps/tracker APIs |
| `/admin/events-management/:eventId` | Implemented | Session + elevated frontend guard | Reuses event detail |
| `*` | Implemented | Public | Honest 404 with session-aware return action |

### Registered blueprint pages (all 87)

Status legend: **Live** = routed and backed by ERP/internal/external data; **Hidden** = registered but excluded from route generation; **Placeholder** = explicitly unavailable; **Static** = routed but fabricated/non-functional; **Orphan** = code exists but no generated route.

| Domain | Routes | Status and source |
|---|---|---|
| ERP academic | `/dashboard`, `/academic/timetable`, `/academic/attendance-details`, `/academic/curriculum` | Live; ERP v2 with page-specific renderers |
| ERP academic | `/academic/sap-scholarships` | Hidden; ERP |
| Academic tracker | `/academic-tracker/academic-insights` | Live; internal LMS tracker/unified insights |
| Academic tracker | `/academic-tracker/progress`, `/academic-tracker/planner`, `/academic-tracker/advising` | Orphan ten-line shells; not among the 87 blueprints and never emitted as routes |
| Exams | `/exams/current-semester-results`, `/exams/earlier-semester-results` | Live; ERP |
| Exams | `/exams/essentials` | Placeholder; honest coming-soon state |
| Finance | `/finance/fee-dues`, `/finance/fee-paid` | Live; ERP |
| Finance | `/finance/bank-details` | Hidden; ERP |
| Campus/hostel | `/campus/vacant-rooms`, `/transport-hostel/hostel-booking`, `/transport-hostel/room-details` | Live; internal snapshot/ERP |
| Campus/transport | `/transport-hostel/routes`, `/transport-hostel/route-details` | Placeholder; no ERP endpoint |
| Registration | `/registration/course-registration`, `/registration/hostel-registration`, `/registration/transport-registration` | Live; ERP |
| Registration | `/registration/minor-oe-registration`, `/registration/exam-registration`, `/registration/sap-registration` | Hidden; ERP |
| Registration | `/registration/events-registration`, `/registration/registration-tracker` | Placeholder |
| Feedback | `/feedback/course-feedback`, `/feedback/events-feedback`, `/feedback/hostel-mess-feedback`, `/feedback/transport-feedback` | Live; ERP automation or internal feedback APIs |
| Helpdesk | `/helpdesk/raise-ticket`, `/helpdesk/faqs`, `/helpdesk/track-escalate` | Live; internal helpdesk API (blueprint labels say external summary, implementation is native companion UI) |
| Learning workspace | `/learn/materials` | Live; content/resource APIs |
| Learning workspace | `/learn/advanced-access` | Placeholder and hidden |
| Career discovery | `/career`, `/career/opportunities`, `/career/jobs`, `/career/internships`, `/career/hackathons`, `/career/competitions`, `/career/opportunities/:id` | Live; career store + scraper data |
| Career user | `/career/me/bookmarks`, `/career/me/tracker`, `/career/submit`, `/career/interviews`, `/career/me/resume` | Live; internal career API |
| Career user | `/career/me/profile`, `/career/me/skill-gap`, `/career/alumni` | Hidden but implemented |
| Events | `/events`, `/events/:eventId`, `/events/create`, `/events/my-activity`, `/events/my-created`, `/events/my-teams`, `/events/attendance`, `/events/:eventId/register`, `/events/:eventId/teams/create`, `/events/:eventId/teams/:teamId`, `/events/:eventId/submit/:roundId`, `/events/:eventId/my-results/:roundId`, `/events/:eventId/leaderboard/:roundId`, `/events/:eventId/certificate/:roundId` | Live; internal events/competition APIs |
| Event management | `/events/:eventId/manage`, `/events/:eventId/manage/roles`, `/events/:eventId/manage/certificate`, `/events/:eventId/manage/rounds/:roundId/submissions`, `/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate`, `/events/:eventId/manage/rounds/:roundId/shortlist` | Live; role-gated |
| Account | `/profile`, `/settings` | Live; ERP/session. `/notifications` is hidden |
| Admin live | `/admin/events-management`, `/admin/content-management`, `/admin/campus-feedback`, `/admin/companion-analytics`, `/admin/lms-moderation`, `/admin/system-controls`, `/admin/helpdesk-tickets`, `/admin/helpdesk-faqs`, `/admin/career-opportunities`, `/admin/career-interviews`, `/admin/career-alumni`, `/admin/department-performance`, `/admin/event-approvals` | Routed; most use real APIs or reuse live domain screens, subject to H-01 |
| Admin static | `/admin/audit-logs`, `/admin/certificate-templates` | Routed but fabricated/non-functional; see M-08 |

No hidden placeholder is being silently rendered as a real feature: placeholder blueprints take precedence in `erpRoutes.tsx:120-131`. That is a good safety property.
## Backend endpoint inventory

All paths below are mounted under `/api`. The extraction found **341 concrete method/path declarations** in `Backend/src/routes`, matching the static route count after excluding `router.use` middleware declarations.

### Contract conventions

| Route family | Authentication / authorization | Input and persistence | Operational status |
|---|---|---|---|
| Auth, health, metrics, telemetry | Public or session-optional by design | Manual validation; session/observability services | Implemented; security exceptions noted above |
| ERP v2, scrape, attendance, scores, vacant rooms | Session required in handler/service | Query/body normalization; ERP cache, snapshots, room store | Implemented; upstream-dependent |
| Events, competitions, teams | User-context middleware; store-level organizer/judge/admin checks | Manual validators; events/competition/team SQLite and files | Implemented; H-01/H-02 apply |
| LMS/resources/content | Session context; per-operation ownership/admin checks | Manual type/size validators; SQLite and filesystem | Implemented |
| Career/profile/recommendations | Public reads plus session/role-gated mutations | Store validators; career/profile SQLite | Implemented; scraper disabled in container by default |
| Campus feedback/helpdesk/hostel buddy | Session and store role checks; selected governance/options reads public | Dedicated SQLite stores | Implemented; M-04/M-06 apply |

<details>
<summary>Complete 341-endpoint list by source module</summary>

| Module | Endpoints |
|---|---|
| `academicCalendarRoutes.js` (1) | `GET /academic-calendar` |
| `adminRoutes.js` (3) | `GET /admin/access/status`<br>`POST /admin/access/unlock`<br>`POST /admin/access/disable` |
| `attendanceRoutes.js` (2) | `GET /attendance/history`<br>`POST /attendance/mark` |
| `authRoutes.js` (18) | `GET /heartbeat`<br>`GET /auth/heartbeat`<br>`GET /captcha`<br>`GET /auth/captcha`<br>`POST /login`<br>`POST /auth/login`<br>`POST /dev/login`<br>`POST /auth/dev-login`<br>`POST /forgot`<br>`POST /auth/forgot`<br>`POST /logout`<br>`POST /auth/logout`<br>`GET /profile`<br>`GET /auth/profile`<br>`GET /profile/photo`<br>`GET /auth/profile/photo`<br>`GET /profile/photo/debug`<br>`GET /auth/profile/photo/debug` |
| `campusFeedbackRoutes.js` (8) | `GET /campus-feedback/governance`<br>`GET /campus-feedback/:type/options`<br>`POST /campus-feedback/:type/options`<br>`POST /campus-feedback/:type/submissions`<br>`POST /campus-feedback/:type/legacy-import`<br>`GET /campus-feedback/me/submissions`<br>`GET /campus-feedback/admin/submissions`<br>`PATCH /campus-feedback/admin/submissions/:feedbackId` |
| `careerRoutes.js` (52) | `GET /career/permissions`<br>`GET /career/trending`<br>`GET /career/deadline-soon`<br>`GET /career/feed`<br>`GET /career/insights/unified`<br>`GET /career/health`<br>`GET /career/scraper-status`<br>`POST /career/scraper-trigger`<br>`GET /career/stats`<br>`GET /career/opportunities`<br>`POST /career/opportunities`<br>`GET /career/opportunities/:id/fit`<br>`GET /career/opportunities/:id`<br>`PUT /career/opportunities/:id`<br>`DELETE /career/opportunities/:id`<br>`POST /career/opportunities/:id/save`<br>`DELETE /career/opportunities/:id/save`<br>`POST /career/opportunities/:id/bookmark`<br>`POST /career/opportunities/:id/dismiss`<br>`POST /career/opportunities/:id/view`<br>`POST /career/opportunities/:id/apply`<br>`POST /career/opportunities/:id/flag`<br>`GET /career/profile/skill-gaps`<br>`GET /career/resumes`<br>`POST /career/resumes`<br>`GET /career/resumes/:resumeVersionId/analysis`<br>`POST /career/resumes/:resumeVersionId/merge-to-profile`<br>`POST /career/resumes/:resumeVersionId/fit/:opportunityId`<br>`POST /career/profile/resume`<br>`GET /career/profile`<br>`PUT /career/profile`<br>`GET /career/applications`<br>`POST /career/applications`<br>`PUT /career/applications/:applicationId`<br>`DELETE /career/applications/:applicationId`<br>`POST /career/submit`<br>`GET /career/submit/mine`<br>`GET /career/submit/pending`<br>`POST /career/submit/:submissionId/approve`<br>`PATCH /career/submit/:submissionId`<br>`GET /career/interviews/slots`<br>`POST /career/interviews/slots`<br>`PUT /career/interviews/slots/:slotId`<br>`DELETE /career/interviews/slots/:slotId`<br>`GET /career/interviews/bookings`<br>`POST /career/interviews/bookings`<br>`DELETE /career/interviews/bookings/:bookingId`<br>`GET /career/alumni`<br>`POST /career/alumni`<br>`PUT /career/alumni/:alumniId`<br>`DELETE /career/alumni/:alumniId`<br>`POST /career/alumni/:alumniId/requests` |
| `companionAnalyticsRoutes.js` (2) | `POST /analytics/events`<br>`GET /analytics/companion/report` |
| `competitionRoutes.js` (38) | `GET /competitions/:eventId/config`<br>`GET /competitions/:eventId/my-role`<br>`GET /competitions/:eventId/roles`<br>`POST /competitions/:eventId/roles`<br>`DELETE /competitions/:eventId/roles/:regNo`<br>`GET /competitions/:eventId/certificate-template`<br>`PUT /competitions/:eventId/certificate-template`<br>`POST /competitions/:eventId/certificate-template/image`<br>`GET /competitions/:eventId/analytics`<br>`POST /competitions/:eventId/rounds/:roundId/submit`<br>`GET /competitions/:eventId/rounds/:roundId/my-submission`<br>`GET /competitions/:eventId/rounds/:roundId/my-result`<br>`GET /competitions/:eventId/rounds/:roundId/submissions`<br>`PUT /competitions/:eventId/rounds/:roundId/submissions/:id/evaluate`<br>`GET /competitions/:eventId/rounds/:roundId/submissions/:id/evaluations`<br>`PUT /competitions/:eventId/rounds/:roundId/submissions/:id/flag`<br>`POST /competitions/:eventId/rounds/:roundId/shortlist`<br>`POST /competitions/:eventId/rounds/:roundId/publish`<br>`GET /competitions/:eventId/rounds/:roundId/leaderboard`<br>`POST /competitions/:eventId/rounds/:roundId/certificates/generate`<br>`GET /competitions/:eventId/rounds/:roundId/certificates/me`<br>`GET /competitions/:eventId/rounds/:roundId/certificates/me/download`<br>`POST /competitions/reminders/run`<br>`POST /competitions/:eventId/announce`<br>`POST /competitions/:eventId/teams`<br>`GET /competitions/:eventId/teams`<br>`GET /competitions/:eventId/teams/recruitment`<br>`PUT /competitions/:eventId/teams/recruitment`<br>`GET /competitions/:eventId/teams/matches`<br>`GET /competitions/:eventId/teams/my-team`<br>`POST /competitions/:eventId/teams/:teamId/invite`<br>`DELETE /competitions/:eventId/teams/:teamId/invite/:inviteeRegisterNumber`<br>`PUT /competitions/:eventId/teams/:teamId/leader`<br>`DELETE /competitions/:eventId/teams/:teamId/members/me`<br>`DELETE /competitions/:eventId/teams/:teamId`<br>`POST /competitions/:eventId/invitations/:invitationId/accept`<br>`POST /competitions/:eventId/invitations/:invitationId/decline`<br>`GET /competitions/:eventId/invitations/my-invitations` |
| `contentRoutes.js` (13) | `POST /content/admin/verify`<br>`GET /content`<br>`POST /content`<br>`GET /content/admin/workflow`<br>`POST /content/bulk/preview`<br>`POST /content/bulk/execute`<br>`GET /content/:id`<br>`PUT /content/:id`<br>`GET /content/:id/history`<br>`PATCH /content/:id/lifecycle`<br>`DELETE /content/:id`<br>`GET /content/:id/resources`<br>`POST /content/:id/resources` |
| `debugRoutes.js` (1) | `GET /debug/ping` (mounted only in debug mode) |
| `erpV2Routes.js` (8) | `GET /v2/erp/page/:category/:page`<br>`GET /v2/erp/page/:pageKey`<br>`POST /v2/erp/batch`<br>`GET /v2/erp/ui/:category/:page`<br>`GET /v2/erp/ui/:pageKey`<br>`GET /v2/erp/schema/:category/:page`<br>`GET /v2/erp/schema/:pageKey`<br>`POST /v2/erp/action/execute` |
| `eventsRoutes.js` (27) | `GET /events`<br>`GET /events/calendar`<br>`GET /events/my-registrations`<br>`GET /events/my-registered`<br>`GET /events/my-created`<br>`GET /events/analytics`<br>`GET /events/notifications`<br>`POST /events/notifications/reminders`<br>`PATCH /events/notifications/:notificationId/read`<br>`POST /events`<br>`POST /events/bulk-action`<br>`GET /events/:eventId`<br>`PUT /events/:eventId`<br>`PUT /events/:eventId/co-organizers`<br>`DELETE /events/:eventId`<br>`POST /events/:eventId/duplicate`<br>`PATCH /events/:eventId/status`<br>`PATCH /events/:eventId/approval`<br>`POST /events/:eventId/register`<br>`POST /events/:eventId/cancel-registration`<br>`DELETE /events/:eventId/register`<br>`POST /events/:eventId/check-in`<br>`GET /events/:eventId/attendees.csv`<br>`POST /events/:eventId/messages`<br>`POST /events/:eventId/feedback`<br>`POST /events/:eventId/gallery`<br>`GET /events/:eventId/ical` |
| `externalRoutes.js` (2) | `GET /external/:category/:page`<br>`GET /external/:pageKey` |
| `facultyCabinRoutes.js` (1) | `GET /faculty-cabins` |
| `feedbackRoutes.js` (3) | `GET /feedback/end-semester/status`<br>`GET /feedback/end-semester/templates/random`<br>`POST /feedback/end-semester/submit` |
| `healthRoutes.js` (3) | `GET /health`<br>`GET /live`<br>`GET /ready` |
| `helpdeskRoutes.js` (11) | `GET /helpdesk/tickets`<br>`POST /helpdesk/tickets`<br>`PATCH /helpdesk/tickets/bulk`<br>`GET /helpdesk/tickets/:ticketId`<br>`PATCH /helpdesk/tickets/:ticketId`<br>`POST /helpdesk/tickets/:ticketId/escalate`<br>`POST /helpdesk/tickets/:ticketId/replies`<br>`GET /helpdesk/faqs`<br>`POST /helpdesk/faqs`<br>`PUT /helpdesk/faqs/:faqId`<br>`DELETE /helpdesk/faqs/:faqId` |
| `hostelBuddyRoutes.js` (6) | `GET /hostel-buddy/governance`<br>`GET /hostel-buddy/blocks`<br>`GET /hostel-buddy/me`<br>`PUT /hostel-buddy/me`<br>`DELETE /hostel-buddy/me`<br>`GET /hostel-buddy/matches` |
| `lmsRoutes/guideRoadmapRoutes.js` (24) | `GET /lms/collections`<br>`POST /lms/collections`<br>`GET /lms/collections/:id`<br>`POST /lms/collections/:id/items`<br>`DELETE /lms/collections/:id/items/:resourceId`<br>`PUT /lms/collections/:id`<br>`DELETE /lms/collections/:id`<br>`GET /lms/guides`<br>`POST /lms/guides`<br>`GET /lms/guides/:id`<br>`PUT /lms/guides/:id`<br>`DELETE /lms/guides/:id`<br>`POST /lms/guides/:id/sections`<br>`PUT /lms/guides/:id/sections/:sid`<br>`POST /lms/guides/:id/sections/:sid/read`<br>`POST /lms/guides/:id/upvote`<br>`GET /lms/guides/:id/export`<br>`GET /lms/roadmaps`<br>`POST /lms/roadmaps`<br>`GET /lms/roadmaps/:id`<br>`DELETE /lms/roadmaps/:id`<br>`POST /lms/roadmaps/:id/nodes`<br>`POST /lms/roadmaps/:id/edges`<br>`POST /lms/roadmaps/:id/nodes/:nid/complete` |
| `lmsRoutes/learningAdminRoutes.js` (27) | `GET /lms/recommendations/next-step`<br>`GET /lms/recommendations/exam-prep`<br>`GET /lms/recommendations/roadmaps`<br>`GET /lms/recommendations`<br>`GET /lms/explore`<br>`GET /lms/subjects/:code/overview`<br>`GET /lms/subjects/:code/presence`<br>`GET /lms/topics/graph`<br>`GET /lms/leaderboard/weekly`<br>`GET /lms/progress`<br>`GET /lms/progress/:subjectCode`<br>`GET /lms/mastery`<br>`GET /lms/continue`<br>`GET /lms/revision`<br>`POST /lms/revision/:resourceId/review`<br>`GET /lms/streak`<br>`POST /lms/session/generate`<br>`GET /lms/me/contributions`<br>`GET /lms/me/bookmarks`<br>`GET /lms/me/activity`<br>`GET /lms/me/requests`<br>`PUT /lms/me/preferences`<br>`GET /lms/contributors/:userId`<br>`GET /lms/admin/resource-flags`<br>`PATCH /lms/admin/resources/:id/moderation`<br>`GET /lms/admin/flags`<br>`PUT /lms/admin/flags/:key` |
| `lmsRoutes/resourceRoutes.js` (35) | `GET /lms/resources`<br>`GET /lms/resources/check-duplicate`<br>`GET /lms/resources/:id`<br>`POST /lms/resources`<br>`PUT /lms/resources/:id`<br>`DELETE /lms/resources/:id`<br>`POST /lms/resources/:id/restore`<br>`POST /lms/resources/bulk`<br>`POST /lms/resources/:id/upvote`<br>`POST /lms/resources/:id/bookmark`<br>`POST /lms/resources/:id/flag`<br>`POST /lms/resources/:id/mark-outdated`<br>`POST /lms/resources/:id/rate`<br>`POST /lms/resources/:id/view`<br>`GET /lms/resources/:id/comments`<br>`POST /lms/resources/:id/comments`<br>`POST /lms/comments/:id/helpful`<br>`GET /lms/resources/:id/annotations`<br>`POST /lms/resources/:id/annotations`<br>`DELETE /lms/annotations/:id`<br>`GET /lms/pyq/upcoming`<br>`GET /lms/pyq/:subjectCode`<br>`GET /lms/requests`<br>`POST /lms/requests`<br>`POST /lms/requests/:id/upvote`<br>`POST /lms/requests/:id/fulfill`<br>`DELETE /lms/requests/:id`<br>`GET /lms/exam-feedback/pending`<br>`POST /lms/exam-feedback`<br>`POST /lms/resources/:id/quiz-attempt`<br>`GET /lms/resources/:id/quiz-attempts`<br>`GET /lms/question-bank`<br>`POST /lms/question-bank`<br>`POST /lms/question-bank/:id/upvote`<br>`GET /lms/question-bank/build-quiz` |
| `lmsRoutes/searchRoutes.js` (1) | `GET /lms/search` |
| `lmsRoutes/trackerRoutes.js` (6) | `GET /lms/tracker/overview`<br>`GET /lms/tracker/insights`<br>`GET /lms/tracker/unified-insights`<br>`GET /lms/tracker/history`<br>`GET /lms/tracker/recommendation-events`<br>`POST /lms/tracker/recommendation-events` |
| `metricsRoutes.js` (1) | `GET /metrics` |
| `persistentTeamRoutes.js` (7) | `GET /teams/persistent`<br>`POST /teams/persistent`<br>`GET /teams/persistent/invitations`<br>`PATCH /teams/persistent/invitations/:invitationId`<br>`DELETE /teams/persistent/:teamId/invitations/:inviteeRegisterNumber`<br>`POST /teams/persistent/:teamId/invitations`<br>`DELETE /teams/persistent/:teamId` |
| `profileRoutes.js` (13) | `GET /profile/public/:userId`<br>`GET /profile/unified`<br>`POST /profile/recompute`<br>`GET /profile/public-preview`<br>`GET /profile/signals`<br>`POST /profile/signals`<br>`GET /profile/skills`<br>`PATCH /profile/skills/:skill/visibility`<br>`GET /profile/achievements`<br>`POST /profile/achievements/sync`<br>`PATCH /profile/achievements/:achievementId/visibility`<br>`GET /profile/privacy`<br>`PATCH /profile/privacy` |
| `recommendationRoutes.js` (5) | `GET /recommendations/home`<br>`GET /recommendations/lms`<br>`GET /recommendations/career`<br>`GET /recommendations/events`<br>`POST /recommendations/feedback` |
| `resourceRoutes.js` (15) | `POST /uploads`<br>`GET /resources/catalog`<br>`GET /resources/subjects`<br>`GET /resources/library`<br>`GET /resources/admin/items`<br>`POST /resources/items`<br>`PUT /resources/items/:contentId`<br>`DELETE /resources/items/:contentId`<br>`GET /resources/items/:contentId/history`<br>`PATCH /resources/items/:contentId/lifecycle`<br>`POST /resources/admin/items/bulk-preview`<br>`POST /resources/admin/items/bulk-execute`<br>`POST /resources/recommendations`<br>`GET /resources/recommendations`<br>`PATCH /resources/recommendations/:contentId` |
| `scoresRoutes.js` (1) | `GET /scores/me` |
| `scrapeRoutes.js` (5) | `GET /scrape/:pageKey`<br>`GET /scrape/:category/:page`<br>`GET /scrape/examination/earlier-internal-marks/semester/:semester`<br>`GET /:category/:page`<br>`GET /:pageKey` |
| `telemetryRoutes.js` (1) | `POST /telemetry/frontend` |
| `vacantRoomRoutes.js` (1) | `GET /vacant-rooms` |

</details>

### Endpoint consumers and mismatches

- Frontend API clients cover ERP, auth, events/competitions/teams, career/profile, LMS, content/resources, campus feedback/helpdesk, calendar/faculty/rooms, analytics, and recommendations. `npm run audit:api-contracts` passed, but that script only forbids direct external calls; it is not a complete method/path schema comparison.
- The six honest placeholders have no required backend endpoint.
- No backend audit-log endpoint exists, despite the routed Admin Audit Logs screen.
- Global certificate-template CRUD does not exist; the backend model is event-scoped, while the admin screen presents a fabricated global library.
- The broad catch-all scrape routes are registered last, reducing route-shadowing risk, but they make the public contract difficult to document and should eventually be retired behind v2.
## External integrations and configuration

| Integration | Direction | Authentication | Failure behavior | Audit assessment |
|---|---|---|---|---|
| SRM AP student ERP | Backend outbound via Playwright/Cheerio and HTTP helpers | User credentials/cookies kept in session service | Timeouts, cache fallback, circuit breaker, payload validation | Real implementation; circuit isolation and silent sinks need correction |
| Redis | Backend bidirectional | Password in URL/optional Sentinel settings | Memory fallback; limiter fail-open; initialization can permanently stop retries | Useful but degraded mode is under-signaled |
| Career sources | Python scraper outbound (Devfolio, ATS providers, etc.) | Source-dependent/public | Supervisor restart/backoff; disabled in production container by default | Real scraper, but container does not ship its venv/runtime path |
| Prometheus/Grafana/Loki/Alertmanager | Monitoring stack reads backend/logs | Network/config secrets | Optional Compose override | Artifacts exist; ingress/network docs are stale and telemetry labels unsafe |
| Browser/PWA | Frontend static assets/service worker | Same-origin session cookie | Offline/precache | Functional build; cache payload is too large |

### Configuration assessment

- Backend configuration is centralized in `Backend/src/config/env.js`, with approximately 100 environment references across the repository. Defaults are generally explicit.
- `ADMIN_CONTENT_PASSWORD` safely defaults to disabled, and Redis password is required by root Compose. The hardcoded admin-register fallback violates that pattern.
- Root `.env` files are ignored. No committed production credential was found by the scoped scan. Test-only credentials and dummy IDs exist in fixtures/E2E scripts as expected.
- Docker ships the backend without the Python scraper environment and sets `CAREER_SCRAPER_ENABLED=0` by default (`docker-compose.yml:38-41`). The career portal therefore depends on previously populated data or manual scraper deployment in production.
- Deployment docs disagree about network name, TLS paths, file paths, and whether port 80 can serve without TLS.

## Security review

Positive controls confirmed:

- HttpOnly session cookie, secure-by-production default, SameSite=Lax default, and explicit CORS origin allowlist (`Backend/src/utils/cookies.js:49-88`, `Backend/src/app.js:83-104`).
- Helmet and compression enabled; JSON body limit 2 MiB.
- Session IDs are no longer accepted from header/body after the configured legacy cutoff.
- ERP cache keys are user-specific (`erp:<user>:<page>`), preventing obvious cross-user cache reuse.
- Most state stores parameterize SQL and several enforce WAL/foreign-key pragmas.
- Frontend admin and competition guards improve UX, though server authorization remains the true boundary.

Unresolved threats are C-02 and H-01 through H-06. In addition, public certificate names are deterministic (`Backend/src/services/events/competitionStore.js:256-294`) and contain participant IDs in both filenames and PDF contents. Submission URLs include event, round, and user path components. Even after narrowing the nginx mount, these artifacts should not be public-by-possession unless that privacy policy is explicit and identifiers are opaque.

## Performance and scalability review

- Frontend route-level lazy loading is used consistently, but dynamic imports of `identity.ts` and `Markdown.tsx` are defeated by simultaneous static imports according to Vite warnings.
- Mermaid, charts, the main bundle, logo, and service-worker precache exceed reasonable first-load budgets (M-11).
- Backend compression, cache freshness/stale windows, request coalescing, concurrency semaphore, and circuit breaker are well-intentioned. Lock correctness and circuit scope weaken them.
- `appendFileSync` in a request path and synchronous SQLite APIs can block the event loop under slow storage. `node:sqlite` is acceptable for the current single-process target, but high-write endpoints need bounded work.
- Helpdesk/events array-blob persistence makes mutation cost O(total collection size) and complicates multi-instance deployment.
- Analytics and telemetry lack retention/cardinality budgets.

## Dead code and maintainability inventory

Confirmed likely-unused frontend files from Knip:

- `Frontend/src/components/competition/OrganizerGuard.tsx`
- `Frontend/src/components/competition/RoundStatusCard.tsx`
- `Frontend/src/components/data/RowActionButton.tsx`
- `Frontend/src/components/lms/FlipCard.tsx`
- `Frontend/src/components/ThemeToggle.tsx`

Additional dead/unreachable code:

- `Frontend/src/pages/AcademicTracker/AcademicTrackerPage.tsx` has no consumer and still calculates from mock data.
- Academic Progress/Planner/Advising are referenced only by an object that never becomes a route because no corresponding blueprint exists.
- `Backend/load-tests/*.js` are not dead: package scripts treat them as k6 CLI entrypoints. Knip should list them as entries.

Unused dependency candidates reported by Knip:

- `@babel/preset-react`
- `@babel/preset-typescript`
- `babel-plugin-module-resolver`
- `class-variance-authority`

The 146 unused-export and 26 duplicate-export signals include barrel/test false positives and require symbol-by-symbol cleanup; they should not be mass-deleted.

## Test and CI results

| Check | Result | Notes |
|---|---|---|
| Frontend ESLint | Pass | `npm run lint` |
| Frontend Vitest | Pass | 99 files, 1,189 tests |
| Frontend TypeScript + Vite build | Pass with warnings | 3,485 modules; chunk/asset warnings noted above |
| Frontend metadata audit | Pass | 87 pages; nav 4 main / 3 bottom; domain counts ERP 19, campus 35, LMS 3, career 15, admin 15 |
| Frontend API-usage audit | Pass | No prohibited direct external API calls |
| Frontend responsive audit | Not executed locally | Playwright Chromium missing; CI installs it |
| Backend Node tests | Pass | 245 tests; local sandbox initially blocked localhost, unrestricted rerun passed |
| Scraper unittest | Pass | 54 passed, 2 skipped because `ATS_INCLUDE_ALL_ROLES` is enabled |
| Root Knip | Non-zero | 9 unused files (4 intentional k6 entries), 4 unused deps, 146 unused exports, 26 duplicate exports |
| npm production advisory audit | Inconclusive locally | Registry advisory request blocked; CI audit is non-blocking |
| Docker Compose render | Revealed critical defects | Combined canonical command resolves wrong mounts and disjoint networks |

### Coverage gaps

1. No cross-router test asserts that allowlisted-but-not-elevated accounts are denied every admin operation.
2. No unauthenticated multipart test asserts zero bytes written on 401/403 or cleanup after MIME rejection.
3. No production-ingress test performs `nginx -t`, verifies backend DNS/network, TLS port/certs, SPA routing, or sensitive-file denials.
4. No multi-user test verifies circuit-breaker failure isolation.
5. No telemetry fuzz/cardinality or analytics-retention test exists.
6. Scraper tests are not part of `.github/workflows/ci.yml`; `pytest` is not installed and no package script wraps the documented `unittest` command.
7. Static-prototype Playwright suites are not all run as a CI gate.

## Documentation accuracy audit

| Documentation claim | Reality | Action |
|---|---|---|
| `docs/00-INDEX.md` says docs describe code as it exists | Several core deployment/admin/file claims are stale | Remove absolute status claim; add generated conformance checks |
| `docs/02-ARCHITECTURE.md` says `/admin/*` requires elevation | Companion routers derive admin from allowlist alone | Fix H-01, then document one model |
| `docs/03-BACKEND.md` says admin context sets `userContext.hasAdminAccess` | `adminContext` and `userContext` are separate; the latter bypasses elevation | Correct middleware diagram |
| File docs say `/files/submissions` and `/files/certificates` are intentionally public, UUID-only, link-shareable | Certificates are deterministic; ingress exposes the whole data root | Replace with private/signed download policy |
| `docs/09-INFRASTRUCTURE.md` shows one working ingress/TLS topology | Compose paths/network/ports/certs do not support it | Rewrite after C-01 and test the documented command |
| Infra docs say certs are mounted at `/etc/nginx/certs` | Nginx expects `/etc/letsencrypt/live/$host`; Compose mounts neither | Choose and implement one path |
| CI comment says 43 real-stack specs | Current static count is 51 real-stack `test()` calls | Generate counts or remove them |
| Project guidance says analytics is a production no-op | It sends production beacons | Document ingest, consent, retention, and failure semantics |

## Prioritized remediation roadmap

### Phase 0 — Contain before any deployment (0–2 days)

1. Disable/remove the ingress `/files/` alias and do not expose `Backend/data`.
2. Fix the Compose project: paths, shared network, 443, certificates, and `nginx -t`.
3. Centralize admin authorization on elevated session state; remove the hardcoded allowlist fallback.
4. Move authentication/role checks before every upload middleware; clean rejected files.
5. Trust only known proxy hops for client identity and make Redis limiter failure degrade to local limiting.

**Exit criteria:** A clean host can run the documented Compose command; ingress smoke tests pass; all predictable DB/dump/log paths return 404/403; potential admins without elevation get 403; unauthenticated uploads write zero bytes.

### Phase 1 — Restore operational truth (3–7 days)

1. Make Docker health use comprehensive readiness and distinguish optional vs failed Redis.
2. Fix circuit failure classification/isolation and distributed lock atomicity/TTL.
3. Validate/limit telemetry and analytics; implement retention.
4. Remove synchronous hostel debug logging and instrument swallowed ERP sink failures.
5. Align edge/API/UI upload limits.
6. Hide or label static Admin Audit Logs and Certificate Templates until backed by APIs.

### Phase 2 — Correctness and maintainability (1–3 weeks)

1. Normalize helpdesk/event hot-write tables or enforce a documented single-writer topology with optimistic versioning.
2. Resolve orphan academic routes and the broken breadcrumb.
3. Clean test databases and add the scraper to CI.
4. Turn dependency audit into a reviewed blocking policy and Knip into a baseline gate.
5. Split the six largest files according to the repository's 500 LOC rule.
6. Optimize Mermaid/charts/logo and add bundle/precache budgets.

### Phase 3 — Production hardening (3–6 weeks)

1. Replace shared admin password/register allowlist with institutional identity roles and auditable elevation.
2. Implement private object/file storage with opaque IDs, authorization, retention, malware scanning, and signed delivery.
3. Run backup/restore drills for every SQLite database plus filesystem artifacts; test WAL-consistent snapshots.
4. Add load/soak tests for uploads, analytics, helpdesk, LMS, and ERP degradation.
5. Run accessibility and responsive Playwright suites across mobile/tablet/desktop in CI.

## Final verification checklist

- [x] Every tracked top-level subsystem inventoried.
- [x] All 87 registered frontend blueprints categorized.
- [x] Supplemental/base/event/LMS/admin routes traced.
- [x] All 341 backend method/path declarations enumerated.
- [x] Authentication, admin elevation, uploads, static files, rate limits, caches, locks, health, and error paths traced across layers.
- [x] SQLite/file/Redis ownership mapped.
- [x] CI, tests, build output, dead-code output, docs, and deployment configuration checked.
- [x] Critical findings re-opened and line references revalidated.
- [x] No production code was changed.
- [ ] Live upstream ERP behavior verified — intentionally out of scope without credentials.
- [ ] Local browser suites executed — blocked by missing Playwright browser binary; CI configuration inspected instead.
- [ ] Fresh npm advisory result obtained — blocked by registry-access policy; do not interpret this as zero vulnerabilities.

## Bottom line

The codebase has enough real implementation and automated verification to justify continued investment. Its immediate problem is not missing breadth; it is that infrastructure, authorization, and file-delivery boundaries do not match the system the documentation claims exists. Fix the two critical ingress issues and the admin model first. Until those controls are proven with negative tests, this repository should not handle real student data on an internet-reachable production host.
