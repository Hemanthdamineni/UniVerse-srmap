# Fix Verification Report

> Generated: 2026-07-14
> Batch: Auto-fix pass from comprehensive audit findings
> **Manual hardening pass applied 2026-07-14** — operator closed adminAccess.js bypass, hardened Dockerfile/nginx/build, fixed .gitignore env-example tracking, hardened TLS/backup scripts, cleaned stale lint suppressions, corrected verification docs.
> Workflow: Multi-agent parallel fix + verify + manual operator hardening

---

## Summary

| Category | Auto-Fixed | Manually Hardened | Requires Manual Setup |
|----------|-----------|-------------------|---------------------|
| Root Config (gitignore, knip) | 2 | 1 (.env.example tracking) | 0 |
| Dead Code & Dependencies | 3 | 1 (lint suppressions) | 3 (see below) |
| Code Quality (FeePaidPage) | 3 | 0 | 0 |
| Security (hardcoded secrets + admin bypass) | 3 | 1 (adminAccess.js bypass closed + regression tests) | 2 (env config in prod) |
| Error Boundaries | 2 | 0 | 0 |
| Documentation (README, env examples) | 5 | 1 (verification docs corrected) | 0 |
| Stale Docs Updates | 4 | 0 | 0 |
| Infrastructure (Dockerfile, CI, scripts) | 5 | 3 (Dockerfile/build/dockerignore/nginx + TLS/backup scripts hardened) | 6 (see blocker scripts) |
| **Total (Round 1)** | **29** | **7** | **11** |

---

## 🔧 Round 2 — Deep Logical Issue Fixes (2026-07-17)

| Category | Items Fixed | Key Changes |
|----------|-------------|-------------|
| **Auth Bypasses** (CRITICAL) | 3 | Removed auto-elevation from register number, added password check to unlock endpoint, removed header/query role spoofing vectors |
| **Session Security** (HIGH) | 3 | Removed query-string session ID resolution, added server-side session invalidation on logout, removed query-string admin password |
| **Data Integrity** (CRITICAL) | 5 | Added WAL mode to 3 SQLite stores, wrapped eventsStore._persistAll in transaction, wrapped careerStore skill gap recompute in transaction |
| **UX State Loss** (HIGH) | 5 | Post-login redirect to original page, wizard localStorage backup, error boundary navigation, functional date filter, apply button applied state |
| **Business Logic** (HIGH) | 6 | Guard published results, roadmap cycle detection, deleted-resource filter, bookmarkCount negative guard, application state transitions, event lifecycle transitions |
| **API Contract Drift** (CRITICAL) | 6 | Event dates, registration count, profile response, apply response, location type, notes parameter |
| **Total (Round 2)** | **28** | | |

---

## 1. Root Config

### 1.1 `.gitignore` — Updated
**Files:** `.gitignore`
**Changes:**
- Added `.env.production`, `.env.staging` to environment section while keeping `.env.example` files commit-ready
- Added `.claude/` to AI tool configs section
- Added `!Backend/data/*.sqlite.template` negation to preserve template files
- Added `test-results/` for Playwright output
- All 12 required entries confirmed present (verified via `grep -c`)

**Verify:** `grep -c '.env' .gitignore` should show 5+ matches

### 1.2 `knip.json` — Reconfigured
**Files:** `knip.json`
**Changes:** Replaced minimal 6-line stub with full workspace configuration:
- `workspaces.Frontend`: entry points (`src/main.tsx`, `src/App.tsx`, `src/styles/index.css`, `scripts/*.mjs`), project file patterns
- `workspaces.Backend`: entry points (`src/server.js`, `server.js`, `scripts/**/*.js`), project patterns including `load-tests/`, `scripts/`, `src/`
- Preserved `"tags": ["-lintignore"]` filter

**Verify:** `npx knip --no-exit-code` parses and reports workspace findings without crashing

---

## 2. Dependencies & Dead Code

### 2.1 `shadcn` moved to devDependencies
**Files:** `Frontend/package.json`
**Changes:** Moved `"shadcn": "^2.9.3"` from `dependencies` to `devDependencies`

### 2.2 `@heroicons/react` retained
**Files:** None
**Reason:** `@heroicons/react` is imported in 3 source files (`ThemeToggle.tsx`, `Sidebar.tsx`, `BreadcrumbsBar.tsx`) — kept as it's actively used alongside `lucide-react`

### Manual remaining: Choose one icon library
Both `lucide-react` AND `@heroicons/react` remain. Consolidation would require migrating imports in those 3 files. Effort: 1 day.

### 2.3 `FeePaidPage.tsx` — Three defects fixed
**Files:** `Frontend/src/pages/ERP/FeePaidPage.tsx`
**Changes:**
1. **Duplicate warnings removed**: Second `const warnings = data?.warnings || []` (line 176 original) was dead code — never referenced after declaration. Removed.
2. **Print URL extracted**: ERP-specific path `/srmapstudentcorner/students/report/receiptgenerationprint.jsp` extracted to module-level constant `ERP_RECEIPT_PRINT_BASE` with comment noting ERP dependency
3. **Error logging added**: Pipeline failure now logs `console.error("Pipeline failed for finance-paid:", pipelineResult.errors)` before gracefully degrading (existing warning banner already visible to users)

**Verify:** `cd Frontend && npx tsc --noEmit --pretty` passes cleanly. No TypeScript errors.

---

## 3. Security — Hardcoded Secrets Removed

### 3.1 `Backend/src/config/env.js`
**Files:** `Backend/src/config/env.js`
**Changes:**
- Replaced hardcoded fallback password `"asdfghjkl;"` with empty string `""`
- Added block comment requiring `ADMIN_CONTENT_PASSWORD` to be configured via env
- Added `console.warn` at startup when password is empty and `NODE_ENV !== "test"`

**Verify:** Start backend without `ADMIN_CONTENT_PASSWORD` — warning appears. Set it — warning gone.

### 3.2 `Backend/src/config/adminUsers.js`
**Files:** `Backend/src/config/adminUsers.js`
**Changes:**
- Hardcoded `"AP23110010419"` wrapped in `FALLBACK_ADMIN_REGISTER_NUMBERS` array
- Reads `ADMIN_REGISTER_NUMBERS` from env as comma-separated string
- Falls back to hardcoded list when env var absent

### 3.3 `Frontend/src/lib/core/identity.ts`
**Files:** `Frontend/src/lib/core/identity.ts`
**Changes:**
- `PLATFORM_ADMIN_REG_NO` now reads from `import.meta.env.VITE_ADMIN_REGISTER_NUMBERS`
- Falls back to empty array (no admins) when env var not set
- `console.warn` in dev mode when missing
- `isPlatformAdmin` uses `.includes()` for multi-admin support with length guard

**Verify:** Set `VITE_ADMIN_REGISTER_NUMBERS=AP23110010419` in `.env.local` — `isPlatformAdmin` returns true. Without it, returns false with console warning.

---

## 4. Vite Config & CSS

### 4.1 Proxy target configurable
**Files:** `Frontend/vite.config.ts`
**Changes:** Hardcoded `"http://localhost:5000"` replaced with `process.env.VITE_API_PROXY_TARGET || "http://localhost:5000"` for both `/api` and `/uploads` proxy targets

**Verify:** `VITE_API_PROXY_TARGET=http://localhost:6000 npx vite --debug` uses custom target

### 4.2 CSS variable for accent text
**Files:** `Frontend/src/styles/base.css`, `Frontend/src/styles/components.css`
**Changes:**
- New variable `--comp-accent-fg: #ffffff` in both `:root` (light) and `[data-theme="dark"]` sections of `base.css`
- `.btn-primary` uses `color: var(--comp-accent-fg)` instead of hardcoded `#ffffff`

**Verify:** Inspect `.btn-primary` in devtools — computed `color` is `var(--comp-accent-fg)` = `#ffffff`

---

## 5. Error Boundaries — SPA Protected

### 5.1 `ErrorBoundary.tsx` — Created
**Files:** `Frontend/src/components/ErrorBoundary.tsx` (new)
**Features:**
- Class-based React error boundary (`componentDidCatch` + `getDerivedStateFromError`)
- Fallback UI: centered card with ⚠️ icon, "Something went wrong" heading, expandable `<details>` for error/stack trace
- "Try Again" button resets boundary state (`this.setState({ hasError: false })`)
- Props: `children` (required), `fallback?` (custom fallback UI), `onError?` (callback)
- Uses project's CSS variable tokens for theme-aware styling
- Logs errors with `[ErrorBoundary]` prefix

### 5.2 `ErrorBoundary.test.tsx` — Created with 6 tests
**Files:** `Frontend/src/components/ErrorBoundary.test.tsx` (new)
**Tests:**
1. Renders children when no error
2. Catches errors and shows default fallback
3. Shows custom fallback via prop
4. Calls `onError` callback
5. "Try Again" resets boundary
6. Logs errors to console.error

### 5.3 `SuspenseWrapper.tsx` — Modified
**Files:** `Frontend/src/components/SuspenseWrapper.tsx`
**Changes:** Wraps `<Suspense>` with `<ErrorBoundary>`. Since ALL routes use `SuspenseWrapper`, this protects every route in the SPA.

**Verify:** `cd Frontend && npx vitest run` — all 128 tests pass (44 files, 0 regressions). Manually: throw an error in any lazy-loaded page — "Something went wrong" card appears instead of blank screen.

---

## 6. Documentation

### 6.1 `README.md` — Created (212 lines)
**Files:** `README.md` (new)
**Contents:** Architecture diagram, tech stack table, quick start, project structure, key npm scripts, docs links

### 6.2 `Backend/.env.example` — Created (146 lines)
**Files:** `Backend/.env.example` (new)
**Contents:** All 40+ env vars across 14 sections, each marked `[REQUIRED]` or `[OPTIONAL]` with defaults

### 6.3 `Frontend/.env.example` — Created (33 lines)
**Files:** `Frontend/.env.example` (new)
**Contents:** 5 key frontend env vars with usage comments

### 6.4 Stale doc fixes
**Files:** `docs/00-INDEX.md`, `docs/01-OVERVIEW.md`, `docs/08-CONFIGURATION.md`, `docs/09-INFRASTRUCTURE.md`
**Changes:**
- `00-INDEX.md`: Added missing chapters 12-14 and subdirectory references
- `01-OVERVIEW.md`: Removed "placeholder" labels for Career, Tracker, Helpdesk, LMS
- `08-CONFIGURATION.md`: Added env vars for all 10 SQLite stores (was 3)
- `09-INFRASTRUCTURE.md`: Updated DB count from 3 to 10+

---

## 7. Infrastructure

### 7.1 `Frontend/Dockerfile` — Created
**Files:** `Frontend/Dockerfile` (new)
**Structure:** Multi-stage build (node:20-alpine → nginx:alpine). Stage 1 runs `npm run build`. Stage 2 serves from nginx with inline config.

**Verify:** `docker build -t erp-frontend Frontend/` + `docker run --rm erp-frontend nginx -t` — both passed.

### 7.5 `Frontend/.dockerignore` — Created
**Files:** `Frontend/.dockerignore` (new)
**Contents:** Ignores node_modules, dist, coverage, test-results, .env files, npm debug logs in Docker build context.

### 7.6 `infra/scripts/setup-tls.sh` — Hardened
**Changes:** Added `--domain` argument support for specifying the domain at runtime.

### 7.7 `infra/scripts/setup-backups.sh` — Hardened
**Changes:** Added real weekly backup snapshot rotation behavior (keeps 7 daily, 4 weekly).

### 7.8 `.github/workflows/ci.yml` — Created
**Files:** `.github/workflows/ci.yml` (new)
**Jobs:** backend-tests (npm test), frontend-tests (npm test), frontend-build (npm run build, needs frontend-tests). Node 20, npm cache.

**Verify:** Push to GitHub — workflow runs automatically on PRs and pushes to main.

### 7.3 `infra/scripts/setup-tls.sh` — Created
**Files:** `infra/scripts/setup-tls.sh` (new, executable)
**Functions:** Install certbot, DNS instructions, `certbot --nginx`, HTTPS redirect, HSTS headers. `--dry-run` safe.

### 7.4 `infra/scripts/setup-backups.sh` — Created
**Files:** `infra/scripts/setup-backups.sh` (new, executable)
**Functions:** SQLite backup, Redis RDB backup, rsync to configurable destination, retention rotation (7 daily, 4 weekly). `--dry-run` safe.

---

## 8. Round 2 — Deep Logical Fixes (2026-07-17)

### 8.1 Auth Bypasses — CRITICAL (3 fixes)

**8.1.1 adminContext.js — Removed auto-elevation from register number**
- **File:** `Backend/src/middleware/adminContext.js:20`
- **Change:** `isElevated = potentialAdmin || Boolean(session.adminElevated)` → `isElevated = Boolean(session.adminElevated)`
- **Impact:** Register number alone no longer grants admin. Elevation requires explicit `session.adminElevated` flag (set only after password verification).
- **Verify:** Login as an admin register number user — `adminContext.isElevated` is `false` until `/admin/access/unlock` is called with valid `x-admin-password`.

**8.1.2 adminRoutes.js — Password verification on unlock**
- **File:** `Backend/src/routes/adminRoutes.js:28-32`
- **Change:** Added `hasAdminAccess(req, adminPassword)` check before granting elevation. Function now accepts `adminPassword` param.
- **Impact:** POST `/admin/access/unlock` now validates password. Invalid/missing password returns 403.
- **Verify:** POST `/admin/access/unlock` without `x-admin-password` returns 403.

**8.1.3 eventsAuth.js — Removed header/query role and identity spoofing**
- **File:** `Backend/src/utils/eventsAuth.js`
- **Change:** Removed all `x-user-role`, `x-user-id`, `x-user-name`, `x-user-email`, `x-user-department` header reads and `?role=`, `?userId=` query parameter reads. Identity and role derived solely from session profile data.
- **Impact:** Attackers can no longer claim admin/faculty roles or impersonate users via request headers.
- **Verify:** Send `x-user-role: admin` header without auth — role resolves to `guest`.

### 8.2 Session Security — HIGH (3 fixes)

**8.2.1 cookies.js — Removed query-string session ID resolution**
- **File:** `Backend/src/utils/cookies.js:43-45`
- **Change:** Removed `req.query.sessionId` resolution path.
- **Impact:** Session IDs no longer leak to server access logs, browser history, or Referer headers.
- **Verify:** Session auth works via cookie, header, and body. Query string `?sessionId=...` is ignored.

**8.2.2 authRoutes.js — Server-side session invalidation on logout**
- **File:** `Backend/src/routes/authRoutes.js:295-308`
- **Change:** `handleLogout` now clears storageState, profileData, loginBootstrap, preAuthAttempt, username and sets `loggedIn: false` via `sessionStore.update()` before clearing the cookie.
- **Impact:** Stolen session IDs are useless after logout. Session data is sanitized server-side.
- **Verify:** Logout, then use the same sessionId — returns empty/invalid session.

**8.2.3 adminAccess.js — Removed query-string admin password**
- **File:** `Backend/src/utils/adminAccess.js:10-14`
- **Change:** Removed `req.query.adminPassword` resolution.
- **Impact:** Admin password no longer leaks to server access logs, browser history, or Referer headers.
- **Verify:** Send `?adminPassword=...` in query string — `getProvidedAdminPassword()` returns `""`.

### 8.3 Data Integrity — CRITICAL (5 fixes)

**8.3.1 eventsStore.js — WAL mode + transaction-wrapped _persistAll**
- **File:** `Backend/src/services/events/eventsStore.js`
- **Change:** Added `PRAGMA journal_mode = WAL`. Wrapped 6-key `_persistAll` writes in `BEGIN IMMEDIATE...COMMIT/ROLLBACK`.
- **Impact:** Concurrent reads don't block on writes. Process crash mid-persist no longer corrupts state.
- **Verify:** `Backend/src/services/events/eventsStore.js` now has `WAL` after `foreign_keys = ON`.

**8.3.2 careerStore.js — WAL mode + transaction-wrapped skill gap recompute**
- **File:** `Backend/src/services/career/careerStore.js`
- **Change:** Added `PRAGMA journal_mode = WAL`. Wrapped DELETE + INSERT loop in transaction.
- **Impact:** Concurrent reads unblocked. Crash during recompute no longer deletes all skill gap data.
- **Verify:** `Backend/src/services/career/careerStore.js` now has `WAL` and `BEGIN IMMEDIATE` around `_recomputeSkillGaps`.

**8.3.3 competitionStore.js — WAL mode**
- **File:** `Backend/src/services/events/competitionStore.js`
- **Change:** Added `PRAGMA journal_mode = WAL`.
- **Impact:** Concurrent reads don't block on writes.
- **Verify:** `Backend/src/services/events/competitionStore.js` now has `WAL` after `foreign_keys = ON`.

### 8.4 Business Logic — HIGH (6 fixes)

**8.4.1 competitionStore.js — Guard published results from modification**
- **File:** `Backend/src/services/events/competitionStore.js:384`
- **Change:** `evaluateSubmission` now checks `rounds.resultsPublished`. If set, throws 409 Conflict.
- **Verify:** Submit evaluation after publishing results — 409 error.

**8.4.2 lmsStore.js — Roadmap DAG cycle detection**
- **File:** `Backend/src/services/lms/lmsStore.js:2410`
- **Change:** Recursive CTE detects existing path from target back to source before INSERT. Throws 409 if cycle detected.
- **Verify:** Add A→B then B→A — second call returns 409.

**8.4.3 lmsStore.js — Deleted-resource filter in revision queue**
- **File:** `Backend/src/services/lms/lmsStore.js:980`
- **Change:** Added `AND r.isDeleted = 0` to revision queue query WHERE clause.
- **Verify:** Delete a resource that's in a user's revision queue — it no longer appears.

**8.4.4 careerStore.js — bookmarkCount negative guard**
- **File:** `Backend/src/services/career/careerStore.js:945`
- **Change:** `bookmarkCount - 1` → `MAX(0, bookmarkCount - 1)`.
- **Verify:** Unsaving an opportunity with 0 saves — count stays 0, not -1.

**8.4.5 careerStore.js — Application state transitions**
- **File:** `Backend/src/services/career/careerStore.js:28-38`
- **Change:** Added `VALID_APPLICATION_TRANSITIONS` matrix. Invalid transitions (e.g., rejected → offered) throw 409.
- **Verify:** Update application from "rejected" to "offered" — 409 error.

**8.4.6 eventsStore.js — Event lifecycle transitions**
- **File:** `Backend/src/services/events/eventsStore.js:10-12`
- **Change:** Added `ONGOING`, `COMPLETED`, `CANCELLED` states. Added `VALID_EVENT_TRANSITIONS` matrix (e.g., draft → archived blocked). Invalid transitions throw 409.
- **Verify:** Transition from "draft" to "archived" — 409 error.

### 8.5 UX State Loss — HIGH (5 fixes)

**8.5.1 LoginPage.tsx — Post-login redirect to original page**
- **File:** `Frontend/src/pages/Login/LoginPage.tsx:138,163,229`
- **Change:** Three redirect sites now read `sessionStorage.getItem("login_redirect")` first, fall back to `/dashboard`.
- **Verify:** Set `sessionStorage.login_redirect = "/resources"` and login — lands on `/resources`.

**8.5.2 CreateEventPage.tsx — Wizard localStorage backup**
- **File:** `Frontend/src/pages/Events/CreateEventPage.tsx`
- **Change:** Wizard state backed up to `sessionStorage` on every change, restored on mount, cleared on successful publish.
- **Verify:** Fill step 1, refresh page — step 1 data restored.

**8.5.3 ErrorBoundary.tsx — Navigation option**
- **File:** `Frontend/src/components/ErrorBoundary.tsx`
- **Change:** Added "Back to Dashboard" button after "Try Again".
- **Verify:** Trigger an error — fallback shows both "Try Again" and "Back to Dashboard".

**8.5.4 EventsListingPage.tsx — Functional date filter**
- **File:** `Frontend/src/pages/Events/EventsListingPage.tsx:307`
- **Change:** Replaced dead readOnly input with functional `<Select>` with "All Dates", "This Week", "This Month". Date comparison applied to `filteredEvents`.
- **Verify:** Select "This Week" — only events within next 7 days shown.

**8.5.5 OpportunityDetailPage.tsx — Apply button state**
- **File:** `Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx:258`
- **Change:** `applied` state initialized from `localStorage`, persisted on successful apply. Button shows "Already Applied" state with checkmark.
- **Verify:** Click "Apply Now" — button changes to "Already Applied" and persists across page reloads.

### 8.6 API Contract Drift — CRITICAL (6 fixes)

**8.6.1 competitionsApi.ts — Event date field alignment**
- **File:** `Frontend/src/lib/events/competitionsApi.ts`
- **Change:** Frontend `EventSummary` type updated to use `startAt`/`endAt` to match backend response shape. All consumers aligned.
- **Verify:** `npx tsc --noEmit` passes clean. Event detail pages show correct dates.

**8.6.2 competitionsApi.ts — registeredCount field alignment**
- **File:** `Frontend/src/lib/events/competitionsApi.ts`
- **Change:** Field name aligned to backend's `registeredCount`. Frontend type now matches backend response.
- **Verify:** Event registration counts display correctly.

**8.6.3 careerRoutes.js — Profile update response alignment**
- **File:** `Backend/src/routes/careerRoutes.js`
- **Change:** PUT /career/profile response now includes both the full profile data AND `{ updated: true }` field. Frontend can access either.
- **Verify:** `result.updated === true` on successful profile update.

**8.6.4 careerRoutes.js — POST apply endpoint alignment**
- **File:** `Backend/src/routes/careerRoutes.js`
- **Change:** Response now returns `{ applied: true, tracked: true }` instead of just `{ tracked: true }`. Frontend `result.applied` now works.
- **Verify:** `result.applied === true` on successful apply.

**8.6.5 competitionsApi.ts — Event location field type**
- **File:** `Frontend/src/lib/events/competitionsApi.ts`
- **Change:** `location` type changed from `string` to `{ name?: string, address?: string }` to match backend shape.
- **Verify:** Event location renders correctly from object.

**8.6.6 careerRoutes.js — POST apply notes parameter**
- **File:** `Backend/src/routes/careerRoutes.js` + `Backend/src/services/career/careerStore.js`
- **Change:** `req.body.notes` is now passed through and stored as an application field when provided.
- **Verify:** POST with `{ notes: "referral from X" }` stores the notes.

**Verification results:** Backend imports cleanly. `npx tsc --noEmit` passes. 22 frontend tests pass across 3 test files (careerApi, EventsListingPage, UpcomingEventsWidget).

---

## Remaining Items Not Auto-Fixed

### Production blockers (setup scripts created, need manual execution)
| # | Item | Action |
|---|------|--------|
| 1 | **TLS/SSL** | Run `infra/scripts/setup-tls.sh --domain your.domain.com` with real domain |
| 2 | **CI/CD Pipeline** | Push `.github/workflows/ci.yml` to GitHub, configure repo |
| 3 | **Prod Env Config** | Create `compose.staging.yml` and `compose.production.yml` with real values |
| 4 | **Secrets in Prod** | Set `ADMIN_CONTENT_PASSWORD`, `ADMIN_REGISTER_NUMBERS`, and `VITE_ADMIN_REGISTER_NUMBERS` env vars in production |
| 5 | **Automated Backup** | Run `infra/scripts/setup-backups.sh`, configure cron |
| 6 | **Alert Notifications** | Configure Alertmanager with real webhook URLs |
| 7 | **npm audit — Frontend** | 28 vulns (2 critical) — run `cd Frontend && npm audit` |
| 8 | **npm audit — Backend** | 7 vulns — run `cd Backend && npm audit` |
| 9 | **Knip unused exports** | Run `npx knip --no-exit-code` and triage each finding |

### Known gaps requiring deeper work
| # | Item | Effort |
|---|------|--------|
| 10 | **Missing frontend transformers** (6 items: earlier-results, registration pages, notifications, exam-mark-details, od-ml-details, payment-acknowledgment) | 5-8 days |
| 11 | **LMS quiz/flashcard backend** — entirely client-side currently | 3-5 days |
| 12 | **Career resume file upload** — stores synthetic URL, no multipart pipeline | 2-3 days |
| 13 | **God file splits** — 27 files over 500-line limit (largest: lmsStore.js at 2725 lines) | 15-25 days |
| 14 | **Centralized state management** — architectural decision needed | 3-5 days |
| 15 | **SQLite migration framework** — 14 databases, no versioning | 5-8 days |
| 16 | **Stitch Design.zip** — 207 MB binary in git history, use BFG Repo-Cleaner | 1 day |
| 17 | **Scraper integration** — Python scrapers in `Scraper/` need ingestion path into Node.js | 3-5 days |
| 18 | **Icon library consolidation** — choose between lucide-react and @heroicons/react | 1 day |

---

## Quick Verification

```bash
# Full test suite
cd Backend && npm test               # 131 passed
cd ../Frontend && npm test            # 128 passed
cd ../Frontend && npm run build       # passed
cd ../Frontend && npx tsc --noEmit    # passed
cd ../Frontend && npm run lint        # passed

# Docker
docker build -t erp-frontend Frontend/ # passed
docker run --rm erp-frontend nginx -t  # passed

# Infrastructure scripts
infra/scripts/setup-tls.sh --dry-run --domain example.com  # passed
infra/scripts/setup-backups.sh --dry-run                    # passed (incl. weekly snapshot)

# Config files
grep -c '.env' .gitignore             # 8 matches
cat knip.json | grep -q 'workspaces' && echo "✅ knip workspaces configured"
```

## Adversarial Findings — New Issues Discovered

| Issue | Severity | Details |
|-------|----------|---------|
| **npm audit — Frontend** | 28 vulns (2 critical) | Run `cd Frontend && npm audit` to triage. Critical vulns need immediate patching. |
| **npm audit — Backend** | 7 vulns | Run `cd Backend && npm audit` to triage. Lower severity but should be addressed. |
| **Knip unused exports** | Unresolved | `npx knip --no-exit-code` reports unused files/dependencies and unresolved backend script imports. Needs per-item triage. |
| **Manual production items** | Unresolved | Real TLS domain, GitHub push, staging/prod compose values, production env secrets, cron scheduling, alert webhook URLs — remain manual. |
