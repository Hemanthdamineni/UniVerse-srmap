# 10 — Development

> How to set up the project locally, run the test suites, debug
> common issues, and add a new feature. For how the system is
> structured, see **[02 — Architecture](./02-ARCHITECTURE.md)**.
> For the data model, see **[05 — Data](./05-DATA.md)**. For the
> API surface, see **[07 — API Reference](./07-API-REFERENCE.md)**.

## 10.1 Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | ≥22.5 | `node:sqlite` (built-in) and the rest of the runtime require it |
| npm | 10+ | Frontend + Backend both ship `package-lock.json` |
| Docker | 24+ | Redis (dev), Playwright browsers (CI), the e2e stack |
| Git | 2.40+ | Filtered rewrite (`git filter-repo`) if you ever redo the contributor cleanup |
| Python | 3.10+ | The career scraper (optional — only if you want to run the scraper locally) |
| (optional) k6 | latest | Load tests (`Backend/load-tests/*.js`) |

The CI matrix (`.github/workflows/ci.yml`) targets Node 22; that's the
version you should develop against.

## 10.2 First-time setup

```bash
# Clone
git clone https://github.com/Hemanthdamineni/UniVerse-srmap.git
cd UniVerse-srmap

# Backend
cd Backend
npm install
cd ..

# Frontend
cd Frontend
npm install
cd ..

# Start Redis (dev only — the e2e stack also runs an in-process Redis fallback)
docker run -d --name unierse-redis -p 6379:6379 redis:7-alpine
```

## 10.3 Run the dev stack

```bash
# Terminal 1 — backend
cd Backend && npm run dev
# backend listening on http://localhost:5000

# Terminal 2 — frontend
cd Frontend && npm run dev
# frontend on http://localhost:5173 (Vite dev server with /api → :5000 proxy)

# Open http://localhost:5173
```

The first time you run the backend, the 14 SQLite DBs are
auto-created in `Backend/data/`. They're empty until you log in
(the captcha flow + ERP login + first scrape populates them).

### 10.3.1 The dev login

`POST /api/auth/dev-login` is enabled when `NODE_ENV !== 'production'`.
It takes no captcha and no real creds — it just creates a session
for a fake student. The frontend uses this in dev:

```bash
curl -X POST http://localhost:5000/api/auth/dev-login \
  -H 'content-type: application/json' \
  -c /tmp/dev-cookies.txt \
  -d '{}'
```

The session cookie is in `/tmp/dev-cookies.txt`. Subsequent curl
calls use `-b /tmp/dev-cookies.txt`.

## 10.4 The e2e stack

The e2e stack is a fixture-seeded backend on a separate port
(5500) so it doesn't clash with the dev backend on 5000. Use it for
the Playwright real-stack suite.

```bash
# Terminal — start the e2e stack
bash Backend/scripts/e2e-stack/start.sh up
# backend on http://localhost:5500 (fixture-seeded)

# Terminal — Playwright
cd Frontend
E2E_BACKEND_URL=http://127.0.0.1:5500 \
E2E_FRONTEND_URL=http://127.0.0.1:5500 \
  npx playwright test --config=playwright.config.realstack.ts

# Tear down
bash Backend/scripts/e2e-stack/start.sh down
```

The e2e stack sets these env vars (among others):

- `SESSION_STORE_DRIVER=memory` — no Redis
- `ERP_CACHE_DRIVER=memory` — no Redis
- `ADMIN_CONTENT_PASSWORD=e2e-admin`
- `LOG_DIR=<e2e-data-dir>/logs`
- `ERP_DUMP_BASE_DIR=<e2e-data-dir>/dump`

The frontend dev server picks up the e2e backend via
`VITE_API_PROXY_TARGET=http://localhost:5500` (set as an env var
when running the dev server, not the e2e stack).

## 10.5 Run the test suites

### 10.5.1 Backend

```bash
cd Backend
npm test
# runs node --test, all 245 tests in ~2s
```

The backend test suite uses `node:test` (no Jest, no Mocha). Each
test file imports the store it wants to test, instantiates a temp
store in a temp dir, runs assertions, cleans up.

### 10.5.2 Frontend

```bash
cd Frontend
npm test
# runs vitest run, all 1188 tests in ~17s
```

Vitest config (`vitest.config.ts`) uses jsdom for component tests
and pure node for transformer / lib tests.

### 10.5.3 Real-stack e2e (Playwright)

```bash
cd Frontend
E2E_BACKEND_URL=http://127.0.0.1:5500 \
E2E_FRONTEND_URL=http://127.0.0.1:5500 \
  npx playwright test --config=playwright.config.realstack.ts
```

50 of 51 specs pass; the 51st requires a Playwright browser binary
locally (CI installs it; local dev doesn't). Run `npx playwright
install` once to get the browser.

### 10.5.4 Audit / coverage

```bash
# Frontend API contract audit (SPA calls the right endpoints?)
cd Frontend && npm run audit:api-contracts

# Responsive layout audit
cd Frontend && npm run audit:responsive

# Knip dead-export check
cd Backend && npx knip

# Live-pages audit (verify ERP pages are still parseable)
cd Backend && npm run audit:live-pages
```

## 10.6 CI

The 6-job CI matrix (`.github/workflows/ci.yml`):

| Job | What it does |
|-----|--------------|
| Backend Tests | `cd Backend && npm test` |
| Frontend Tests | `cd Frontend && npm test` |
| Frontend Build | `cd Frontend && npm run build` (type-check + bundle) |
| Real-stack e2e | Boots e2e backend on :5500, runs Playwright against it |
| Knip dead-export check | Catches unused exports across the monorepo |
| Responsive Layout Audit | Asserts the layout renders correctly at 375×812, 768×1024, 1280×800 |

All 6 jobs are required (continue-on-error: false). The latest
verified green run is 2026-08-30 (`docs/14-PROD-READINESS-CHECKLIST.md`).

## 10.7 Debugging

### 10.7.1 Common issues and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'better-sqlite3'` | Stale lockfile or wrong Node version | `rm -rf node_modules package-lock.json && npm install`; verify `node --version` ≥ 22.5 |
| `SqliteError: database is locked` | A previous test process didn't clean up | `pkill -f 'node --test'; rm -f Backend/data/*.sqlite-shm Backend/data/*.sqlite-wal` |
| `Error: listen EADDRINUSE :::5000` | Two backends running on the same port | `pkill -f 'node src/server.js'` |
| Vite proxy returns 504 for `/api/*` | Backend isn't running, or wrong port | `cd Backend && npm run dev`; check `VITE_API_PROXY_TARGET` |
| `cors` rejection in dev | Wrong origin in `CORS_ALLOWED_ORIGINS` | For local dev, `Vite` proxies to the same origin, so CORS shouldn't fire. If you see it, set `CORS_ALLOWED_ORIGINS=http://localhost:5173` |
| Playwright tests time out on `/api/auth/captcha` | e2e backend isn't running | `bash Backend/scripts/e2e-stack/start.sh up` |
| Frontend tsc fails on missing module | Path alias not in `tsconfig.json` | Verify `@/*` is in `tsconfig.json` paths |
| Backend tests pass locally but fail in CI | Tests use absolute paths | Check `process.env` is mocked |

### 10.7.2 Inspect the live ERP scrape

The backend logs each cache lookup, cache hit/miss, circuit state,
and live scrape. The `LOG_LEVEL` env var controls verbosity:

```bash
# In Backend/
LOG_LEVEL=debug npm run dev
# logs include:
# - "ERP cache" with pageKey, source (cache-fresh | cache-stale | cache-miss | live-direct | dump), userKey
# - "ERP circuit" with pageKey, state (closed | open), failure count
# - "ERP lock" with pageKey, lockKey, acquired
# - "ERP live" with pageKey, latency, statusCode, responseSize
```

The login attempts are logged to `Backend/logs/login-attempts/` (capped
at 20 files) with redacted fields and the raw HTML truncated to
`LOGIN_DIAGNOSTICS_MAX_HTML_CHARS` (default 6000).

### 10.7.3 Inspect the React Query cache

Add a `<ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />`
to `AppProviders` (in `dev` mode only, gated by `import.meta.env.DEV`).
The devtools panel shows every active query, the cached data, the
invalidation history, and the request/response timing.

### 10.7.4 Inspect the Vite proxy

Set `DEBUG=vite:proxy` in the env when running `npm run dev`. The
proxy logs every request: path, target, status, latency.

### 10.7.5 Force a re-scrape

The SPA respects a `?mode=live` query param on the ERP pages. To
bypass the cache and force a fresh scrape, navigate to e.g.
`/academic/attendance-details?mode=live`.

To invalidate a specific cache key from the backend, hit
`DELETE /api/admin/cache/:userId/:pageKey` (admin-gated; or
use `redis-cli DEL erp:<userId>:<pageKey>` if Redis is up).

## 10.8 Adding a new feature

The recommended pattern (in order):

1. **Add a new SQLite store** (if the feature has its own data) —
   follow the pragma-block pattern in
   [03 — Backend §3.5.2](./03-BACKEND.md#35-services). Add a unit
   test in `Backend/test/`.
2. **Add a new route file** — `Backend/src/routes/<name>Routes.js`,
   with `createXxxRoutes({ store })` factory. Mount it in `app.js`.
3. **Add the API client** in `Frontend/src/lib/<feature>/` — typed
   request/response, error envelope parsing, session-401 redirect.
4. **Add the page** in `Frontend/src/pages/<Feature>/` — React Query
   for data, mutation invalidation for invalidation, ProtectedPage
   for auth.
5. **Add the route** to `Frontend/src/routes/<name>Routes.tsx` —
   `<Route path="/<path>" element={...} />`.
6. **Add the e2e spec** in `Frontend/e2e/<feature>.realstack.spec.ts` —
   boot the e2e stack, run the flow, assert.

## 10.9 Adding a new ERP page

This is the most common "extend" workflow. Steps:

1. **Add the pageKey to `scrapeTargets.js`** — run
   `npm run discover:endpoints`, find the new page in the output,
   add the pageKey → `[{dropdown, subitem}]` mapping. If the
   page uses a top-level URL (not nested in the menu), the array
   is empty `[]`.
2. **Decide cached-first vs live-first** in `erp-page-policy.json`.
3. **Write a targeted extractor** in
   `Backend/src/services/erp/extractors/extract<PageName>.js`. The
   signature is `extract(html) → typed payload`. The shape is
   documented in `extractors/types.js`.
4. **Register the extractor** in `extractors/index.js` under
   `SUBITEM_EXTRACTORS` (key: `<Dropdown>|<Subitem>`).
5. **Add a payload contract** in `erpPayloadContracts.js` if the
   default contract is too lax (e.g. the page needs at least one
   table to be considered valid).
6. **Write a transformer** in `Frontend/src/lib/erp/<feature>Transformers.ts`
   that takes the typed backend payload and produces a domain model
   the SPA can render.
7. **Add an ERP blueprint** in `Frontend/src/config/erpBlueprintData.ts` —
   the `fetchKeys`, the `renderer` (a generic component or a custom
   one), the `status` (active/hidden/experimental), and the `domain`
   (erp/lms/career/etc.).
8. **Add a test** in `Backend/test/erpPageContract.test.js` (or a new
   test file) that loads a saved HTML and asserts the extractor
   produces the expected typed payload.

## 10.10 Adding a new env var

1. Add the default value + reader to `Backend/src/config/env.js`.
2. Add a test in `Backend/test/config.test.js` (or create it).
3. Add the var to `.env.example` and `.env.staging.example`.
4. Document it in **[08 — Configuration](./08-CONFIGURATION.md)**.

## 10.11 Adding a new feature flag

Same as a new env var, but the convention is `FEATURE_<NAME>`
(all-caps) and the reader in `env.js` should coerce to boolean.
Feature flags in this codebase are typically checked at the
mount-point of a router, so a feature-flagged router is only mounted
if the flag is on.

## 10.12 Database migrations

- **LMS** has a real migration runner
  (`Backend/src/services/lms/lmsMigrations.js`). Add new migrations
  there.
- **Other stores** use `_ensureSchema()` + column-existence checks.
  Add a new column by extending the CREATE TABLE and adding a
  `columnExists(name)` check + `ALTER TABLE ADD COLUMN … DEFAULT …`.
- **Never** drop a column. Just stop writing it; prune later.

## 10.13 When the upstream ERP changes

The most common breakage mode is a structural HTML change. The
recovery playbook is in
**[06 — ERP Integration §6.14](./06-ERP-INTEGRATION.md#614-when-the-upstream-erp-changes)**.

## 10.14 Where things live in the repo

```
docs/10-DEVELOPMENT.md    # this file
docs/11-TESTING.md        # test strategy + how to write tests
docs/12-CONTRIBUTING.md   # PR flow, code style, commit hygiene
docs/14-PROD-READINESS-CHECKLIST.md  # the gates (P0/P1/P2)
docs/15-DEBUGGING-NOTES.md  # recurring failure modes + 30s checks
docs/16-CONTRIBUTOR-CLEANUP.md  # how the contributor-rewriting was done
docs/17-DEPLOYMENT-GUIDE.md  # free-tier single-VM deploy walkthrough
infra/runbooks/         # operational runbooks (backup, rollback, etc.)
AGENTS.md / CLAUDE.md / PRODUCT.md  # AI assistant design context
```

## 10.15 Common pitfalls

- **Don't put a `useEffect` that fetches** — use `useQuery` (or
  `useSuspenseQuery` if you want the Suspense behavior).
- **Don't hand-fetch with `axios` in a new component** — use the
  campus API client.
- **Don't bypass the React Query cache** by storing server data in
  `useState`.
- **Don't import from `Backend/`** in the frontend (or vice versa) —
  the contract is the HTTP API.
- **Don't add a `setInterval` in a React component** — use the
  backend's setInterval jobs (or a `useQuery` with a `refetchInterval`).
- **Don't store the session in `localStorage`** — it's an httpOnly
  cookie by design.
- **Don't add a new design-system component** without first
  checking `src/components/ui/`.
- **Don't add a new env var without documenting it** in
  [08 — Configuration](./08-CONFIGURATION.md).
