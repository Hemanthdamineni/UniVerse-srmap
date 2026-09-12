# Production-Grade Deep Audit — 2026-09-11

**Scope:** repository root, `Backend/`, `Frontend/`, `Scraper/`, `infra/`, CI, tests, and operational documentation.  
**Method:** read-only source inspection, dependency audits, graph-assisted architecture review, build/lint/test/coverage/Knip runs, responsive and tap-target browser audits, Compose validation, and cross-checking earlier audit documents against the current tree.  
**Snapshot caveat:** the working tree was already dirty and continued changing during inspection. Findings cite the current paths and line locations observed during the audit; re-run the listed verification commands after the in-progress feature work settles.

## Executive verdict

The project is functionally substantial and has stronger controls than its surface-level problems suggest: the frontend builds, the unit suites pass, API/metadata audits pass, the repository has real-stack E2E coverage, runtime data is ignored, ingress is hardened, and the core Compose stack binds sensitive services to loopback.

It is **not production-grade yet**. The dominant failure mode is not a lack of features; it is that important guarantees are implemented incompletely or exist only as documentation/configuration that is not enforced. The most serious examples are cross-user persistence of academic data, raw ERP HTML execution in a same-origin popup, unsafe browser-based PDF rendering, replayable OAuth state, encryption keys stored beside ciphertext, known vulnerable dependencies tolerated by CI, a monitoring stack that cannot parse, and a backup path that cannot authenticate to Redis.

**Current disposition:** release should be blocked until Critical items and the security/recovery subset of High items are closed.  
**Health score:** 10/20 for the frontend quality dimensions (accessibility 2/4, performance 2/4, responsive 2/4, theming 2/4, design consistency 2/4).  
**Catalog:** 40 findings — 2 Critical, 20 High, 16 Medium, 2 Low.

## Severity framework

- **Critical:** plausible exposure/cross-user disclosure or code execution in a core flow; release blocker with no accepted workaround.
- **High:** material security, data-integrity, availability, recovery, accessibility, or governance failure likely to affect users or invalidate production claims.
- **Medium:** systemic maintainability, performance, portability, observability, or testing weakness that compounds risk but is not an immediate release blocker by itself.
- **Low:** localized inconsistency or hygiene debt with limited direct user impact.

## Category index

- **Security vulnerabilities:** AUD-001–AUD-008, AUD-023–AUD-024, AUD-028–AUD-029, AUD-033.
- **Architectural inconsistencies:** AUD-001, AUD-005, AUD-008, AUD-011, AUD-016–AUD-017, AUD-023, AUD-025, AUD-032, AUD-036.
- **Code quality:** AUD-011, AUD-016, AUD-026–AUD-027, AUD-031–AUD-032, AUD-036, AUD-039.
- **Performance bottlenecks:** AUD-003, AUD-011–AUD-012, AUD-022, AUD-024, AUD-031, AUD-038.
- **Testing deficiencies:** AUD-013–AUD-015, AUD-020–AUD-021, AUD-025–AUD-027, AUD-034, AUD-038.
- **Documentation gaps:** AUD-017–AUD-018, AUD-030, AUD-035, AUD-037.
- **Standardization/governance gaps:** AUD-004, AUD-009–AUD-010, AUD-013–AUD-018, AUD-027–AUD-030, AUD-034–AUD-040.

## Critical findings

### AUD-001 — Persisted query cache is not scoped to the authenticated student

- **Evidence:** `Frontend/src/lib/core/queryPersist.ts:18-26,70` persists ERP, student graph, academic calendar, and session profile data for 24 hours under one global cache; `Frontend/src/lib/erp/queryKeys.ts:4-8` and `Frontend/src/lib/core/queryKeys.ts:4-13` do not include an immutable user identity. `Frontend/src/lib/core/session.ts:88-95,130-134` clears auth/profile flags on failure but does not guarantee removal of the persisted Query cache.
- **Why it fails under scrutiny:** a shared browser can hydrate student A's attendance, results, or profile before student B's refetch completes. The data is also readable to any same-origin script if XSS occurs.
- **Remediation:** key the persister/buster by immutable authenticated user; synchronously delete all persisted academic/session data on logout, forced 401, account change, and storage-version migration; strongly consider never persisting grades/results/profile.
- **Success criteria:** an automated A → logout/expiry → B login test never renders A data, including offline and pre-refetch states; browser storage contains no A record after logout/401; all logout entry points share one tested cleanup function.

### AUD-002 — Raw ERP receipt HTML executes in a same-origin popup

- **Evidence:** `Frontend/src/pages/ERP/FeePaidPage.tsx:32-50`, especially line 45, calls `win.document.write(response.html)` with backend/upstream HTML. The popup retains an opener relationship.
- **Why it fails under scrutiny:** injected script or event-handler markup can execute with the application's origin and reach opener state/storage. This turns an upstream-content trust failure into an application-origin XSS.
- **Remediation:** generate a sanitized receipt/PDF on the backend or render a strict allowlisted document in a sandboxed Blob/iframe; never use `document.write` for upstream HTML; sever `window.opener`.
- **Success criteria:** an OWASP-style payload set (`script`, SVG/script, `img onerror`, malformed attributes) cannot execute or access opener/storage; CSP remains enforced; valid receipts still render and print in an end-to-end test.

## High findings

### AUD-003 — Guide PDF export enables authenticated SSRF and Chromium exhaustion

- **Evidence:** authenticated users can create guide content at `Backend/src/routes/lmsRoutes/guideRoadmapRoutes.js:73,101`; export at `:125-133` sends it to `renderGuidePdf`. `Backend/src/routes/lmsRoutes.js:75-104` interpolates title/description/section content directly into HTML and launches a new Chromium process per request without blocking scripts/subresources or applying a worker/concurrency limit.
- **Impact:** stored markup can request internal/link-local resources, and repeated exports can exhaust CPU/RAM.
- **Remediation:** render from a strict safe AST or escape all values; disable JavaScript; reject all network requests except explicitly allowed `data:` assets; isolate the browser in a worker/container; add per-user and global queues, timeouts, and output limits.
- **Success criteria:** remote, localhost, and link-local URLs cause zero outbound requests; scripts are inert; load tests prove browser concurrency never exceeds the configured bound.

### AUD-004 — Known production vulnerabilities are tolerated and audit artifacts are lost

- **Evidence:** current production audits report Backend 1 high + 1 moderate and Frontend 4 high + 1 moderate. `Backend/package-lock.json:1255-1264` resolves vulnerable Multer 2.2.0; reachable parsers exist at `Backend/src/routes/resourceRoutes.js:59-85`, `Backend/src/routes/lmsRoutes.js:122-136`, `Backend/src/routes/careerRoutes.js:25-41`, and `Backend/src/routes/competitionRoutes.js:94-121`. `.github/workflows/ci.yml:37-55,90-108` uses `continue-on-error: true`; artifact paths are root-relative despite job working directories and `if-no-files-found: ignore` hides the mistake.
- **Impact:** remotely triggerable multipart DoS and other known vulnerabilities can ship while the promised reports are absent.
- **Remediation:** upgrade Multer to 2.3+ and all fixable production advisories; make high/critical findings blocking; permit only owned, expiring, reachability-documented waivers; correct artifact paths.
- **Success criteria:** `npm audit --omit=dev --audit-level=high` exits 0 or only approved unexpired waivers remain; a synthetic vulnerable lockfile fails CI and uploads a visible report.

### AUD-005 — Google token “encryption at rest” stores its key with the ciphertext

- **Evidence:** `Backend/src/services/core/googleTokenStore.js:53-60` generates and writes the AES key into `google_meta` in the same SQLite database when `GOOGLE_TOKEN_ENC_KEY` is absent. `Backend/src/services/core/calendarSyncService.js:50-57` similarly sources OAuth state signing material from the same database.
- **Impact:** theft of one database/backup yields both encrypted tokens and the keys required to decrypt them or forge state.
- **Remediation:** require separate, externally managed 32-byte encryption and state-signing keys in production; support key versioning and rotation.
- **Success criteria:** production refuses to start with missing/invalid secrets; a database-only compromise cannot decrypt tokens or sign state; rotation tests rewrite old rows successfully.

### AUD-006 — OAuth state is indefinitely replayable and not bound to the initiating session

- **Evidence:** `Backend/src/services/core/calendarSyncService.js:60-77` builds `userId.nonce.signature` without issue time, TTL, persisted nonce, or session binding. The callback is unauthenticated at `Backend/src/routes/googleCalendarRoutes.js:25-34`.
- **Impact:** captured signed state can be replayed in account-linking/authorization-mix-up scenarios.
- **Remediation:** persist a hash of one-time state with user, initiating session, issued time, and a short TTL; atomically consume it on callback.
- **Success criteria:** expired, replayed, wrong-session, and already-consumed states are rejected; two concurrent callbacks produce exactly one success.

### AUD-007 — Demo login safety depends only on exact `NODE_ENV=production`

- **Evidence:** `Backend/src/config/env.js:8` defaults to development. `Backend/src/routes/authRoutes.js:242-284` exposes unauthenticated dev-login routes for every other value and accepts arbitrary usernames, producing a logged-in session at `:261-267`.
- **Impact:** a systemd/direct/misconfigured deployment can expose authentication bypass; an allowlisted identity can become eligible for elevated behavior.
- **Remediation:** require explicit `ENABLE_DEMO_LOGIN=1`, restrict to loopback/development profile, and fail startup on missing/unknown deployment mode.
- **Success criteria:** every production-like configuration returns 404 for demo login unless an explicit development-only opt-in is active; deployment configuration tests cover this matrix.

### AUD-008 — Uploaded-file delivery and deletion are internally inconsistent

- **Evidence:** `Backend/src/routes/resourceRoutes.js:85-97` returns `/uploads/<file>`, but `Backend/src/app.js:128-130` deliberately exposes no static runtime namespace and there is no authenticated `/uploads` download route. LMS files are synchronously written at `Backend/src/routes/lmsRoutes.js:156-160`; `Backend/src/services/lms/lmsStore.js:3015-3025` spreads stored rows, including absolute `filePath`, into API output. Delete/purge paths at `:1985-2033` do not remove files; purge looks up FTS identity after deleting the source row.
- **Impact:** successful uploads can be unusable, server paths leak, files orphan, quota accounting drifts, and search results can survive purge.
- **Remediation:** return opaque file IDs; add an authorization-aware download endpoint; never serialize filesystem paths; implement compensating DB/filesystem operations; delete FTS state before source deletion.
- **Success criteria:** authorized download works and unauthorized access fails; API JSON contains no server paths; create/update/delete/purge failure injection leaves no orphan file, quota discrepancy, or FTS hit.

### AUD-009 — Monitoring Compose stack is invalid

- **Evidence:** `infra/docker/compose.monitoring.yml:42-44` mounts `alertmanager_data`; declared volumes at `:154-157` omit it. `docker compose -f docker-compose.yml -f infra/docker/compose.monitoring.yml config --quiet` fails with an undefined-volume error.
- **Impact:** the documented observability/alerting stack cannot start at all.
- **Remediation:** declare the volume and validate every supported Compose combination in CI.
- **Success criteria:** Compose config succeeds; the monitoring profile boots healthy; a synthetic alert reaches the configured receiver.

### AUD-010 — Redis backup cannot authenticate to the deployed Redis

- **Evidence:** `docker-compose.yml:28,60` requires a Redis password. `infra/cron/backup.cron:9-12` says the password is required, but `infra/scripts/setup-backups.sh:119-129` invokes plain `redis-cli --rdb` without password/host and leaves `REDIS_RDB_PATH` unused. The script is fail-fast.
- **Impact:** Redis backup aborts before off-site copy/retention, creating false recovery confidence.
- **Remediation:** authenticate securely or run the backup inside the Redis container; validate the RDB; surface failure through alerting.
- **Success criteria:** a scheduled restore drill recovers a known key from password-protected Redis; authentication failure fails the entire backup and pages an operator.

### AUD-011 — Synchronous SQLite and per-row work block the Node event loop

- **Evidence:** major request-facing stores use `DatabaseSync`, including `Backend/src/services/lms/lmsStore.js:2997-3007` and `Backend/src/services/campus/feedbackServices.js:7`. The passing backend suite took roughly three minutes in the audit; individual bulk/seed tests consumed tens to hundreds of seconds.
- **Impact:** under concurrent student traffic, one expensive query or bulk mutation can delay unrelated requests and health checks.
- **Remediation:** batch writes in transactions, split read/write services, move heavy work to worker threads/jobs, and measure event-loop delay before selecting a broader async database migration.
- **Success criteria:** explicit p95/p99 latency and event-loop-lag SLOs remain green during representative bulk operations; the fast PR suite completes within an agreed budget.

### AUD-012 — Prometheus `route` labels have unbounded cardinality

- **Evidence:** `Backend/src/middleware/requestContext.js:22-29` records `originalUrl`; `Backend/src/services/campus/feedbackServices.js:633-640` only masks numeric and certain long-ID segments; `:720-729` persists the result as counter/histogram labels.
- **Impact:** arbitrary text slugs/unknown URLs create permanent series, growing heap and scrape payloads without bound.
- **Remediation:** label with Express route templates plus mount path; map unmatched paths to a fixed `other` value.
- **Success criteria:** 100,000 unique text-param/404 URLs produce a bounded series count and stable heap.

### AUD-013 — Frontend coverage thresholds are decorative and currently fail

- **Evidence:** `Frontend/vitest.config.ts:63-99` declares 80/80/80/65 thresholds, but CI runs only `npm test` at `.github/workflows/ci.yml:78-79`. The audit's coverage run exited 1 at 37.41% statements, 30.28% branches, 33.98% functions, and 39.63% lines; it also attempted to parse a study-note Markdown file because `include: ["src/**"]` is overbroad.
- **Impact:** test counts look excellent while many production screens and paths remain at 0%; the configured standard provides no protection.
- **Remediation:** fix coverage inclusion to executable files, add risk-based tests, introduce ratcheting global/per-domain/changed-line thresholds, and make coverage blocking.
- **Success criteria:** coverage runs cleanly with no parser errors; changed executable lines meet at least 90%; critical auth/cache/admin/finance paths meet the agreed branch threshold; CI blocks regression.

### AUD-014 — Scraper has no CI, lock, or standardized test environment

- **Evidence:** `.github/workflows/ci.yml` has no Python/Scraper job. `Scraper/requirements.txt:1-6` uses open-ended `>=`; `Scraper/setup.sh:21-29` upgrades/install latest packages. System `pytest` failed on missing `aiohttp`, while the project venv lacks `pytest`; `unittest discover` passes 52 with 2 environment-dependent skips.
- **Impact:** results depend on ambient interpreter/environment, and a production data-ingestion subsystem can regress without gating the PR.
- **Remediation:** declare Python version; generate a hashed lock; add a single canonical test command plus Ruff/format/type/smoke checks in CI; make unintended skips fail.
- **Success criteria:** clean machines resolve identical versions; all 54 tests execute with zero unintended skips; lint/type/test gates block regressions.

### AUD-015 — Fixture/prototype E2E tests never gate CI

- **Evidence:** `Frontend/playwright.config.ts:3-29` covers the fixture suite, but CI only invokes `playwright.config.realstack.ts` at `.github/workflows/ci.yml:300-305`; its `testMatch` at `Frontend/playwright.config.realstack.ts:23-30` selects only `*.realstack.spec.ts`.
- **Impact:** public-shell, governance, and other non-realstack browser specifications can fail without affecting merge status.
- **Remediation:** add a separate prototype E2E job or explicit Playwright project matrix.
- **Success criteria:** a deliberate failure in `Frontend/e2e/public-shell.spec.ts` fails the required check.

### AUD-016 — The 500-LOC architecture rule is widely unenforced

- **Evidence:** policy is explicit at `AGENTS.md:41-42`, but 47 first-party source/test/script files exceed 500 lines. Major production offenders include `Backend/src/services/career/careerStore.js` (3,425), `Backend/src/services/lms/lmsStore.js` (3,071), `Frontend/src/pages/Events/EventWorkflowPages.tsx` (2,231), `Backend/src/services/events/competitionStore.js` (2,086), `Backend/src/services/erp/erpClient.js` (2,008), and `Frontend/src/lib/campus/campusApi.ts` (1,266). `implementation_plan.md:1-23` documents only a completed Academic Hub split.
- **Impact:** unrelated responsibilities share state and change surfaces; review and testing become coarse; ownership boundaries are unclear.
- **Remediation:** add a measured allowlist with owner, split seam, milestone, and expiry; split stores by repository/domain and pages by workflow component.
- **Success criteria:** no new unplanned file exceeds 500 lines; allowlist count trends down each milestone; each extracted module has focused tests and no circular dependency.

### AUD-017 — Runtime configuration is incomplete, duplicated, and not validated

- **Evidence:** source references materially more keys than examples/documentation, including CORS (`Backend/src/app.js:106-107`), login deadline (`Backend/src/config/env.js:22`), Google OAuth, SMTP (`:139-149`), VAPID/FCM, and multiple DB paths (`:99-155`). `docs/12-CONTRIBUTING.md:243,256` claims coverage that does not exist. Numeric values are generally parsed without schema/range validation.
- **Impact:** silent defaults change security/reliability semantics and make alternate deployments unsafe.
- **Remediation:** create one typed/schema-validated environment registry that generates `.env.example` and configuration documentation; distinguish required production keys and reject invalid ranges.
- **Success criteria:** static env-usage audit reports zero undocumented keys; invalid/missing production settings fail startup with actionable errors.

### AUD-018 — Test, deployment, and readiness documentation is materially stale

- **Evidence:** actual audited suites were about 405 backend tests and 1,236 frontend tests/105 files, while `docs/00-INDEX.md:130-135`, `docs/11-TESTING.md:3-6,43,86,134`, and `docs/10-DEVELOPMENT.md:118-130` still claim 245/1,188/99 and a ~2-second backend run. `README.md:215` links a nonexistent document. `docs/14-PROD-READINESS-CHECKLIST.md:53-64,294-297` mixes stale open items with checked claims and old evidence. `docs/07-API-REFERENCE.md:22-23` says health/metrics require a session although route code and ingress policy differ.
- **Impact:** operators and reviewers make decisions from facts that look authoritative but no longer describe the system.
- **Remediation:** generate test counts/config inventories and validate links; give readiness evidence an owner, commit SHA, command, date, and expiry; archive historical audits.
- **Success criteria:** zero broken internal links; generated counts match runner output; every readiness claim is current, reproducible, and expires when code/config changes.

### AUD-019 — Dark-theme primary actions fail contrast systematically

- **Evidence:** `Frontend/src/styles/base.css:197-202` correctly defines a dark foreground for `--comp-accent:#2EBFA8`, but `Frontend/src/components/button.tsx:9-16` and `Frontend/src/styles/events/utilities.css:117-131` force white. White on this accent measures about 2.30:1; the pattern appears across dozens of CTA usages.
- **Impact:** WCAG 2.1 AA text contrast failure on primary actions, especially harmful for stressed, time-sensitive student tasks.
- **Remediation:** consume paired foreground tokens (`--comp-accent-fg`, semantic on-color tokens) in every state and component; prohibit raw `text-white` on theme tokens.
- **Success criteria:** automated light/dark/state contrast tests show at least 4.5:1 for normal text and 3:1 for large/non-text UI.

### AUD-020 — Login and password recovery fail mobile layout/touch gates

- **Evidence:** the responsive audit found the login card clipped at 320/375/390 widths. `Frontend/src/pages/Pagelayout.tsx:39-48` combines `h-screen` with login min-height/padding in `Frontend/src/pages/Login/LoginPage.overdrive.css:187-205,221-249,283-300`. The tap audit reported 32 undersized observations: 41px password fields, 15×15 checkbox, 110×19 forgot link (`Frontend/src/pages/Login/LoginPage.tsx:368-388,441-457`) plus undersized recovery actions (`Frontend/src/pages/Login/ForgotPasswordPage.tsx:290-304,440-443`).
- **Impact:** primary authentication is clipped and harder to operate on the project's primary mobile form factor.
- **Remediation:** use scroll-safe `min-height:100dvh`, remove incompatible fixed/min heights, and give every action a 44×44 CSS-pixel hit region.
- **Success criteria:** responsive and tap audits pass at 320–2560px, portrait/landscape, and 200% zoom with zero clipping or undersized controls.

### AUD-021 — Custom keyboard controls violate established interaction patterns

- **Evidence:** `Frontend/src/components/ui/PasswordInput.tsx:23-27,43-50` removes the reveal control from tab order and gives the input only a border focus change. `Frontend/src/components/ui/Progress.tsx:68-101` makes every star a tab stop, lacks arrow/Home/End behavior, and marks every filled star as checked rather than exactly one radio.
- **Impact:** keyboard and assistive-technology users cannot reliably operate or understand controls (WCAG 2.1.1, 2.4.3; ARIA APG radio pattern).
- **Remediation:** restore the password toggle to normal tab order with `aria-pressed` and a visible focus ring; implement native radios or roving-tabindex rating semantics.
- **Success criteria:** keyboard tests demonstrate correct Tab, Space/Enter, arrows, Home/End behavior; exactly one rating is checked; axe and focus-indicator tests pass.

### AUD-022 — Lazy loading is defeated and the PWA installs almost the entire application

- **Evidence:** `Frontend/src/components/markdown/LazyMarkdown.tsx:1-12` dynamically imports Markdown, while `Frontend/src/components/markdown/index.ts:1-7` statically re-exports it; the build warns the dynamic import cannot split. `Frontend/vite.config.ts:41-56` precaches all JS/CSS/fonts/images. The build produced 212 JS chunks and a 4,898 KiB precache (92% of the 5,300 KiB budget), including a 729.9 KiB raw Mermaid chunk and 261 KiB KaTeX chunk.
- **Impact:** students pay install/update bandwidth and cache churn for optional editors/renderers; the absolute budget is nearly exhausted despite passing.
- **Remediation:** fix barrel/import topology; runtime-cache optional route/editor/markdown assets; set user-centric initial-route and install budgets rather than only an aggregate ceiling.
- **Success criteria:** mixed static/dynamic warnings disappear; optional modules are absent from unrelated route waterfalls; precache is reduced to an agreed 1–2 MiB class target; low-end mobile Web Vitals pass.

## Medium findings

### AUD-023 — Redis failure silently changes session/cache semantics

- **Evidence:** `Backend/src/services/core/sessionServices.js:128-134` returns `null` after connection failure; `Backend/src/server.js:108-130` then selects in-memory stores even when Redis was intended.
- **Remediation:** fail startup when the driver is explicitly Redis; allow degraded fallback only through an explicit non-production policy.
- **Success criteria:** a production instance cannot become ready using memory sessions/cache when Redis is required.

### AUD-024 — Fallback rate-limit maps can grow indefinitely

- **Evidence:** global fallback sweeps only after 5,000 buckets at `Backend/src/middleware/rateLimit.js:25-49`; login fallback at `:134-143` never sweeps IP keys; LMS limiter at `Backend/src/routes/lmsRoutes.js:60-71` retains user/path keys.
- **Remediation:** use Redis in production and a bounded TTL/LRU fallback.
- **Success criteria:** unique-IP/user stress reaches steady-state heap after windows expire.

### AUD-025 — Real-stack E2E is not hermetic and waits for liveness, not readiness

- **Evidence:** `Backend/scripts/e2e-stack/start.sh:26-48` redirects only a subset of DB paths; other stores retain repository-local defaults. It waits for `/api/live` at `:65-75`. CI uploads runner-temp Playwright paths at `.github/workflows/ci.yml:312-320`, but `Frontend/playwright.config.realstack.ts:31` uses only the list reporter with no matching output path.
- **Remediation:** place every DB/file/log path under one temp root; wait for `/api/ready`; configure HTML/JSON/trace artifacts and backend logs.
- **Success criteria:** checksums under `Backend/data` do not change; induced failures upload trace, report, and server log.

### AUD-026 — Passing frontend tests normalize real console/runtime warnings

- **Evidence:** the passing 1,236-test run emitted repeated missing Radix dialog descriptions, invalid `loading` DOM attributes from `Frontend/src/components/button.tsx:47-66`, zero-size chart warnings, pipeline errors, and jsdom navigation exceptions from `Frontend/src/lib/core/session.ts:111-133`. `Frontend/src/test/setupTests.ts:17-35` does not isolate navigation.
- **Remediation:** make unexpected `console.error`/`console.warn` and unhandled errors fail tests; inject a navigation adapter; fix dialog descriptions and component prop contracts.
- **Success criteria:** the unit suite exits 0 with clean stderr; a deliberate warning/unhandled rejection fails.

### AUD-027 — Static quality rules are disabled where the code needs them most

- **Evidence:** `Frontend/eslint.config.js:24-31` disables explicit-any, unused vars, exhaustive hook dependencies, and other safeguards, contradicting `docs/12-CONTRIBUTING.md:99-115`. Backend has no lint script/job; no shared formatter or `.editorconfig` governs all languages.
- **Remediation:** adopt a repository-wide formatter/editor contract; add backend lint; ratchet frontend rules by directory with narrow inline exceptions.
- **Success criteria:** formatting and lint run for Backend/Frontend/Scraper; injected `any`, unused variable, and missing dependency failures are blocked in governed directories.

### AUD-028 — Production containers run as root and retain avoidable attack surface

- **Evidence:** `Backend/Dockerfile:1-50` never sets `USER` and ships the browser/system libraries in the runtime image; `infra/docker/ingress.Dockerfile:1-7` also uses a root entrypoint to manage TLS material.
- **Remediation:** use multi-stage/minimized images, non-root UIDs, read-only root filesystems, dropped capabilities, and explicit writable mounts.
- **Success criteria:** container policy scan passes; processes are non-root and operate with `read_only: true` plus minimal writable paths.

### AUD-029 — TLS bootstrap fails open while HSTS claims production certainty

- **Evidence:** `infra/nginx/bootstrap-tls.sh:9-17` silently generates a seven-day self-signed certificate if production material is missing, while `infra/nginx/conf.d/university-erp.conf:57-65` sends long-lived preload HSTS.
- **Remediation:** allow self-signed fallback only under an explicit dev flag; production must fail startup/readiness.
- **Success criteria:** production refuses missing/invalid/hostname-mismatched certificates; development clearly identifies self-signed mode.

### AUD-030 — Observability configuration contains dead or unrendered behavior

- **Evidence:** `infra/monitoring/alertmanager/alertmanager.yml:23-32` contains literal `${ALERT_WEBHOOK_URL}` in a bind-mounted file that Compose will not interpolate; TLS-expiry rules at `infra/monitoring/prometheus/alerts.yml:76-82` require a blackbox metric absent from `infra/monitoring/prometheus/prometheus.yml:13-33`; Loki config at `infra/monitoring/loki/loki-config.yml:14-39` has no retention policy.
- **Remediation:** template and validate Alertmanager config; add the exporter/scrape or remove the dead rule; define log retention and storage alerts.
- **Success criteria:** `amtool`/`promtool` validation passes; a synthetic alert is delivered; TLS metric exists; retention deletion is observed.

### AUD-031 — Motion governance is fragmented and some animations trigger layout

- **Evidence:** reduced-motion overrides are local rather than global; `Frontend/src/styles/events/activity.css:301-313,366-378` animates progress-bar width instead of transform.
- **Remediation:** centralize motion tokens and global reduced-motion behavior; use transform/opacity for progress transitions.
- **Success criteria:** OS reduced-motion suppresses nonessential effects across routes; performance traces show no progress-animation layout work.

### AUD-032 — Theme initialization attaches duplicate media listeners

- **Evidence:** module-scope `initTheme()` at `Frontend/src/App.tsx:14-16` discards cleanup, then an effect calls it again at `:18-20`; `Frontend/src/lib/core/theme.ts:101-116` attaches a listener per invocation.
- **Remediation:** separate synchronous theme application from subscription and own one cleanup path.
- **Success criteria:** exactly one listener exists under StrictMode/HMR and none remains after unmount.

### AUD-033 — External opportunity links retain `window.opener`

- **Evidence:** `Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx:167-173` uses `window.open(url, "_blank")` without `noopener,noreferrer` or a protocol allowlist.
- **Remediation:** validate `https:` destinations and sever opener.
- **Success criteria:** malicious destinations cannot access the opener; `javascript:` and non-approved protocols are rejected.

### AUD-034 — Accessibility automation is shallow

- **Evidence:** no axe dependency exists; `Frontend/e2e/comprehensive-audit.spec.ts:257-305` checks basic headings/alt/labels but explicitly does not compute contrast. Current CI does not establish WCAG coverage across route states/themes.
- **Remediation:** add axe scans plus keyboard/focus, zoom, reflow, and contrast tests for public, authenticated, and admin flows in light/dark mode.
- **Success criteria:** zero serious/critical axe violations in the defined matrix; every exception has owner, rationale, and expiry.

### AUD-035 — Scraper configuration and deployment are non-portable

- **Evidence:** `Scraper/config.py:95` defines a circuit threshold that `Scraper/db.py:394` ignores in favor of hardcoded 5; `Scraper/db.py:17-22,277-278` commits per row. `Scraper/career-scraper.service:7-9` hardcodes a user and obsolete absolute repository path with little sandboxing.
- **Remediation:** inject configuration, batch source runs transactionally, and generate/install a templated hardened systemd unit.
- **Success criteria:** changing the threshold changes behavior; batch throughput improves without recovery loss; a clean host can install/start the unit without editing it; `systemd-analyze security` meets an agreed score.

### AUD-036 — Graceful shutdown does not own all initialized resources

- **Evidence:** `Backend/src/server.js:564-580` clears only one ticker explicitly; multiple intervals and SQLite stores created at `:149-307` are not centrally closed/checkpointed. Forced exit at `:582-598` can interrupt writes.
- **Remediation:** register all disposables, stop every queue/ticker, await Redis, checkpoint/close databases, then exit.
- **Success criteria:** shutdown integration test leaves no active handles, incomplete transactions, or growing WAL files.

### AUD-037 — Release and review governance is incomplete

- **Evidence:** only one workflow exists; there is no CODEOWNERS, Dependabot/Renovate config, PR template, SECURITY.md, settled license, runtime-version file, release workflow, or immutable artifact/provenance process. CI also lacks top-level least-privilege permissions, concurrency cancellation, timeouts, and immutable action SHA pins.
- **Remediation:** add ownership/security/release files; protect main; pin actions; build signed/SBOM-attached immutable images; require rollback evidence.
- **Success criteria:** protected main requires named checks and review/ownership; policy lint is clean; tagged releases produce immutable verifiable artifacts and a tested rollback path.

### AUD-038 — Benchmark-scale tests run in the default PR suite without a tiering strategy

- **Evidence:** the backend suite took roughly three minutes, far above `docs/10-DEVELOPMENT.md:118`; LMS moderation seeding and helpdesk bulk tests dominate runtime.
- **Remediation:** profile and optimize fixtures/transactions; split fast deterministic PR tests from scheduled performance suites with statistically meaningful budgets.
- **Success criteria:** fast PR backend suite stays below an agreed target (for example 30 seconds); scheduled performance checks retain p95/p99 regression thresholds.

## Low findings

### AUD-039 — Generated/stale artifacts remain tracked

- **Evidence:** `infra/Infra.zip` is tracked despite `.gitignore:117-118` and contains obsolete deployment copies; timestamped LMS critique JSON artifacts live under `Backend/scripts/lms-content-automation/`.
- **Remediation:** keep one canonical configuration/curated fixture and publish generated reports as CI artifacts.
- **Success criteria:** generated-artifact CI check is clean and no stale deployment source competes with the canonical tree.

### AUD-040 — Login's visual treatment conflicts with the product's stated calm/clarity direction

- **Evidence:** `Frontend/src/pages/Login/LoginPage.overdrive.css:12-55,81-126,186-249` layers continuous mesh/gradient motion, staggered entrances, and glass-depth effects on the highest-stress entry flow. Reduced-motion handling at `:337-343` is a positive but does not resolve the default cognitive load.
- **Remediation:** simplify motion and surfaces around credential entry; retain purposeful feedback only; codify foreground/state/motion contracts in a maintained design-system document.
- **Success criteria:** usability review confirms one dominant action and lower distraction; motion is state-driven; both themes meet the same token/contrast contract.

## Remediation sequence

### Phase 0 — Release blockers

1. Fix AUD-001 and AUD-002 with two-user, forced-401, XSS, and opener tests.
2. Close AUD-003–AUD-007: PDF sandbox, dependency upgrades, external token keys, one-time OAuth state, explicit demo-login flag.
3. Make file delivery coherent (AUD-008) and prove backups/monitoring (AUD-009–AUD-010).

### Phase 1 — Reliability and user access

1. Establish event-loop/metrics bounds (AUD-011–AUD-012).
2. Make coverage, scraper, and both E2E profiles blocking (AUD-013–AUD-015).
3. Fix dark contrast, login reflow/touch targets, and keyboard widgets (AUD-019–AUD-021).
4. Reduce PWA install weight and restore real lazy boundaries (AUD-022).

### Phase 2 — Consistency and maintainability

1. Enforce the file-size plan and typed configuration source of truth (AUD-016–AUD-017).
2. Regenerate/expire documentation evidence (AUD-018).
3. Close degraded-mode, rate-limit, E2E isolation, test-noise, and lint gaps (AUD-023–AUD-027).
4. Harden containers, TLS, observability, motion, theme lifecycle, external navigation, accessibility, scraper deployment, and shutdown (AUD-028–AUD-036).

### Phase 3 — Governance and cleanup

1. Implement release/ownership/supply-chain controls (AUD-037).
2. Tier performance tests (AUD-038).
3. Remove stale artifacts and simplify the login presentation (AUD-039–AUD-040).

## Long-term governance checks

### Required PR checks

- Frontend: TypeScript build; ESLint with `--max-warnings=0`; formatter; Vitest with ratcheting coverage; unexpected-console failure; Knip; metadata and API-contract audits; responsive, tap-target, axe, and contrast checks; prototype and real-stack Playwright; per-route bundle/precache budgets.
- Backend: ESLint/formatter; Node tests with coverage; auth/OAuth/upload/SSRF/path-disclosure adversarial tests; configuration-schema tests; event-loop/heap/cardinality regression checks.
- Scraper: pinned Python setup; Ruff/formatter/type check; all parser/dedupe tests with zero unintended skips; smoke import and batch-throughput budget.
- Infrastructure: every Compose combination through `docker compose config`; `nginx -t`; ShellCheck; `promtool`; `amtool`; container-policy scan; backup/restore smoke; secret scan.
- Supply chain: blocking high/critical production audit; automated dependency updates; SBOM; image/action pinning; expiring vulnerability waiver file.
- Repository rules: automated 500-LOC check with a temporary owned allowlist; generated-artifact and broken-link checks; environment-variable inventory generation.

### Code-review standard

Every PR that touches a sensitive boundary must answer, with tests or evidence:

1. Is state scoped to the authenticated identity and cleared on every termination path?
2. Does user/upstream content cross HTML, filesystem, URL, process, SQL, or network boundaries safely?
3. Are authorization and ownership checked at the final data access point?
4. Are failure, retry, rollback, cleanup, and migration behaviors explicit?
5. Can metrics/log labels or caches grow with attacker-controlled cardinality?
6. Does the change work by keyboard, at 200% zoom, on 320px mobile, and in both themes?
7. Does it preserve reduced motion and correct semantic foreground tokens?
8. Are runtime configuration, operational docs, alerts, backup/restore, and release evidence updated together?

### Definition of done for the remediation program

- Zero Critical findings open.
- Zero unwaived High security findings; every waiver has owner, reachability analysis, compensating control, and expiry.
- All required checks are blocking on protected `main`.
- Clean-checkout setup, build, test, Compose validation, backup, and restore are reproducible from documented commands.
- Two-user privacy, SSRF/XSS, OAuth replay, upload lifecycle, and recovery drills pass.
- Accessibility matrix is green for key public/student/admin flows in light and dark themes.
- Performance budgets cover event-loop lag, critical-route latency, PWA install weight, heap/cardinality, and background-worker concurrency.
- Documentation facts are generated or evidence-dated; no current doc contradicts code/configuration.

## Positive controls to preserve

- Lockfile-based Node installs and a passing TypeScript production build.
- Large existing backend/frontend unit suites and real-stack journey coverage.
- Blocking Knip and bundle/responsive/tap-target jobs already present in CI design, once their blind spots are closed.
- Loopback-only Backend/Redis Compose ports and required Redis password.
- Effective ignores for secrets, runtime databases, generated builds, references, and graph output.
- Nginx security headers, internal readiness/metrics ingress locations, authenticated API/download intent, and NetworkOnly PWA handling for API/upload paths.
- Skip navigation, main-content focus target, route lazy loading foundations, comprehensive theme tokens, and existing targeted reduced-motion rules.
- The evidence-oriented Definition of Done in `docs/14-PROD-READINESS-CHECKLIST.md:70-80`; retain the structure, but regenerate and expire the evidence.

## Verification log

- Frontend lint: passed with one unused-disable warning.
- Frontend production build: passed; reported ineffective mixed dynamic/static imports and a >500 KiB chunk.
- Frontend unit suite: 105 files / 1,236 tests passed, with substantial stderr warnings.
- Frontend coverage: failed at 37.41% statements / 30.28% branches / 33.98% functions / 39.63% lines against 80/65 thresholds.
- Frontend Knip: passed on final contradiction check.
- Metadata and frontend external-API audits: passed.
- Responsive audit: failed on login clipping (1 of 15 audited routes).
- Tap-target audit: failed with 32 undersized observations.
- Bundle audit: passed, but at 1,131.9/1,230 KiB JS gzip and 4,898/5,300 KiB precache.
- Backend tests: all passed in the inspected snapshot; runtime was roughly three minutes and dominated by benchmark-scale cases.
- Scraper: `unittest discover` passed 52 with 2 skips; ambient `pytest` setup was not reproducible.
- Dependency audit: Backend 1 high + 1 moderate; Frontend 4 high + 1 moderate production findings.
- Root + ingress Compose validation: passed. Root + monitoring Compose validation: failed on missing `alertmanager_data`.
- Graph context: existing graph contained 6,400 nodes; it was used for navigation only because it predates the current dirty snapshot and reports a graphify skill/package version mismatch.
