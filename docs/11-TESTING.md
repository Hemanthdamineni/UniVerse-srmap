# 11 — Testing

> The platform has 1,500+ tests across three layers: backend unit
> tests (245), frontend unit tests (1188), and Playwright real-stack
> e2e tests (50/51 pass; 51st needs a Playwright browser binary
> locally). This doc covers the strategy, the layers, the patterns
> for writing tests, and how to keep coverage comprehensive.

For how to run the suites, see
**[10 — Development §10.5](./10-DEVELOPMENT.md#105-run-the-test-suites)**.
For the CI matrix, see **[10 — Development §10.6](./10-DEVELOPMENT.md#106-ci)**.

## 11.1 The test pyramid

```
                 /\
                /  \           Playwright real-stack e2e (50/51)
               / E2E\          - boots real backend on :5500
              /------\         - drives actual HTTP + browser
             /        \
            / Integ.  \        backend --test (245)
           /  ration   \       - node:test, no Jest
          /------------\      - per-store + per-route
         /              \
        /   Unit + Com-  \   frontend Vitest (1188)
       /    ponent tests   \   - jsdom for components
      /--------------------\  - pure node for transformers
```

The ratio is roughly:

- **Unit + Component**: ~95% (1188/1232)
- **Integration (backend)**: ~5% (245/1232)
- **End-to-end (Playwright)**: ~0.4% (50/1232)

The pyramid is intentionally top-heavy at the unit layer because
the platform is mostly a thin middleware: the logic that matters
(extractors, transformers, cache policy) is all unit-testable, and
the rest is just plumbing.

## 11.2 The three layers

### 11.2.1 Frontend unit + component (Vitest, 1188 tests)

**Where**: `Frontend/src/**/*.test.{ts,tsx}`.

**Runner**: Vitest 4.1 with jsdom for component tests.

**What it tests**:
- Pure functions in `lib/erp/`, `lib/events/`, `lib/lms/`, etc.
  (transformers, formatters, validators)
- React components (Button, Card, dialogs, etc.) — render
  snapshots + interaction tests
- Hooks (`useAuthStatus`, `useSessionHeartbeat`, etc.)
- Path-alias resolution (`@/lib/...` works as expected)
- The TanStack React Query setup (retry semantics, error handling)

**What it doesn't test**:
- Anything that needs a real backend (use Playwright for that)
- Anything that needs a real browser (Playwright)
- Anything that needs the real ERP (Playwright with the e2e stack
  in `live-direct` mode, off by default)

**Pattern**:

```ts
// Frontend/src/lib/erp/erpTransformers.test.ts
import { describe, it, expect } from "vitest";
import { transformAttendance } from "./attendanceTransformers";

describe("transformAttendance", () => {
  it("converts the legacy payload to a typed AttendanceSummary", () => {
    const legacy = {
      title: "ATTENDANCE DETAILS",
      tables: [[
        { "Subject Code": "CS101", "Present % P / (P+A+OD)": "85" },
      ]],
    };
    const result = transformAttendance(legacy);
    expect(result.subjects[0].code).toBe("CS101");
    expect(result.subjects[0].presentPct).toBe(85);
  });
});
```

### 11.2.2 Backend unit + integration (node:test, 245 tests)

**Where**: `Backend/test/*.test.js`.

**Runner**: `node --test` (no Jest, no Mocha — the runtime is the test runner).

**What it tests**:
- Every store (constructor + schema + CRUD methods)
- Every targeted extractor (loads a saved HTML file, asserts the
  typed output)
- The aggregation service (cache hit / miss / stale, circuit
  breaker behavior, distributed lock)
- The session store (in-memory fallback, Redis roundtrip)
- The rate limiter
- The career scraper supervisor (with `scraperDir` set to a temp
  dir to avoid the missing-venv problem in CI)
- Helper functions (text cleanup, cookie parsing, etc.)

**What it doesn't test**:
- The live ERP scrape (that needs a live ERP, which CI doesn't have)
- The HTTP layer end-to-end (that's the Playwright suite)
- Cross-store transactions (we don't use them)

**Pattern**:

```js
// Backend/test/helpdeskStore.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { HelpdeskStore } = require("../src/services/campus/helpdeskStore");

test("HelpdeskStore creates a ticket and reads it back", () => {
  const dbPath = path.join(os.tmpdir(), `helpdesk-${Date.now()}.sqlite`);
  const store = new HelpdeskStore({ dbPath });
  try {
    const id = store.createTicket({ userId: "u1", subject: "test" });
    const fetched = store.getTicket(id);
    assert.equal(fetched.subject, "test");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});
```

### 11.2.3 Real-stack e2e (Playwright, 50/51)

**Where**: `Frontend/e2e/*.realstack.spec.ts` (real-stack) and
`Frontend/e2e/*.spec.ts` (fixture-only prototype).

**Runner**: Playwright 1.54 with two configs:
- `playwright.config.ts` — fixture-only prototype, runs against
  the `VITE_STATIC_PROTOTYPE=true` build (no real backend)
- `playwright.config.realstack.ts` — boots a real backend on :5500
  and drives a real browser

**What it tests**:
- Auth lifecycle (captcha, login, logout, session refresh)
- ERP page routes (every J1–J8 journey spec from the prod-readiness
  audit)
- API contract (each spec asserts status codes + body shape)
- Cross-user IDOR (where applicable)
- Browser-driven user journeys (clicks, form fills, navigation)

**What it doesn't test**:
- The actual rendering of the upstream ERP (the e2e stack uses
  the cache + the offline dump fallback, not live scraping)
- Visual regression (no screenshot comparison yet — see
  [12 — Contributing](./12-CONTRIBUTING.md) for the future work)

**Pattern**:

```ts
// Frontend/e2e/j1-login-dashboard.realstack.spec.ts
import { test, expect } from "@playwright/test";

test.describe("realstack: auth + dashboard (J1)", () => {
  test("unauthenticated /api/auth/me is 401", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);
  });
});
```

## 11.3 Patterns

### 11.3.1 What to test

For every new feature:

- **Backend**: at least one test for every public method on the
  store (constructor, CRUD). For extractors: at least one test
  per extractor that loads a saved HTML and asserts the typed output.
  For services that orchestrate: a "happy path" + a "missing
  dependency" test + a "circuit open" / "rate limited" test.
- **Frontend**: at least one test for every exported function in
  `lib/`. For React components: at least one render test. For
  pages: a smoke test (renders without crashing) is enough —
  the real behavior is covered by the e2e suite.

### 11.3.2 What NOT to test

- **Don't test the framework.** Don't test that React renders
  correctly, that Vite serves files, that Express routes are
  registered, that Helmet sets headers. Trust the framework.
- **Don't test the integration of well-tested libraries.** Don't
  test that `node:sqlite` works, that `redis-client` connects, that
  Cheerio parses HTML. Trust the library.
- **Don't test private helpers in isolation.** If a private helper
  is complex enough to need a test, promote it to a module-level
  function and test that. Don't add tests for trivial one-liners.
- **Don't test configuration.** If your test reads `process.env`,
  you're testing configuration, not behavior. Mock the env or move
  the config to a parameter.

### 11.3.3 Test naming

Test names should describe the behavior, not the implementation:

```ts
// Good:
"returns 401 when session is missing"
"transforms the legacy payload even when title is empty"

// Bad:
"calls handleAuth()"
"the function works"
```

### 11.3.4 Test isolation

Every test must be independent. No shared state between tests, no
ordering assumptions. For SQLite stores, each test creates its own
temp DB. For Redis, each test gets a fresh in-memory store (the
fallback). For React Query, each test gets a fresh `QueryClient`.

### 11.3.5 The test-data factory pattern

When a test needs a "user" or a "ticket" or a "request", use a
factory function:

```js
function makeUser(overrides = {}) {
  return {
    userId: "u1",
    name: "Test User",
    role: "student",
    hasAdminAccess: false,
    ...overrides,
  };
}
```

This keeps tests readable and makes "I just need an admin user" a
one-liner: `makeUser({ hasAdminAccess: true })`.

### 11.3.6 The "test what would break in prod" heuristic

For every line of business logic, ask:

> "If this breaks in production, how would I find out?"

If the answer is "I'd have to look at the log", write a test that
makes the failure loud. If the answer is "I wouldn't", don't write
the test.

This is why we test cache invalidation, circuit-breaker behavior,
session-expiry redirect, and error-envelope shape. We don't test
that `db.exec()` runs SQL.

## 11.4 What we don't have (yet)

- **No snapshot tests.** The components are simple enough that
  snapshot tests would just be noise. (We considered it for the
  certificate template, but a snapshot of a generated PDF is fragile.)
- **No contract tests** between the SPA and the backend beyond what
  the e2e suite already does.
- **No load tests in CI.** The k6 scripts in `Backend/load-tests/`
  are run manually before big rollouts, not on every commit.
- **No visual regression tests.** The responsive audit verifies
  that the layout doesn't break at standard viewports, but doesn't
  compare screenshots.

These are the next additions to consider, in priority order:

1. **Contract tests** — extract the request/response schemas
   from each API endpoint and assert at the type level that the
   SPA's `lib/<feature>/` matches. This catches the case where
   the backend renames a field and the SPA silently falls back to
   `undefined`.
2. **Visual regression tests** — Playwright's screenshot
   comparison. Useful for the Dashboard and the certificate
   template (the two highest-stakes layouts).
3. **Load tests in CI** — run a 30s k6 burst on every PR. Cheap
   to add, catches accidental perf regressions.

## 11.5 Coverage

Coverage isn't enforced (no threshold in CI), but the goal is
~80% statement coverage on the parts that matter:

| Module | What to cover |
|--------|---------------|
| Backend stores | Every public method |
| Backend services that orchestrate | Happy path + at least one failure mode |
| Backend extractors | At least one HTML sample per extractor |
| Frontend `lib/` pure functions | Every exported function |
| Frontend components | At least one render test (interactions are bonus) |
| Frontend pages | Smoke render is enough; e2e covers the real flows |

What we don't measure:

- CSS coverage (we don't snapshot styles)
- Branch coverage on framework code
- Type-only tests (TypeScript itself is the test)

## 11.6 Running specific tests

```bash
# Backend — one file
cd Backend && node --test test/helpdeskStore.test.js

# Backend — one test name
cd Backend && node --test --test-name-pattern="creates a ticket"

# Frontend — one file
cd Frontend && npx vitest run src/lib/erp/erpTransformers.test.ts

# Frontend — one test name
cd Frontend && npx vitest run -t "converts the legacy payload"

# Playwright — one spec
cd Frontend && npx playwright test e2e/j1-login-dashboard.realstack.spec.ts

# Playwright — one test by name
cd Frontend && npx playwright test -g "unauthenticated"
```

## 11.7 CI test policy

All three layers run on every PR and on every push to `main`. The
matrix is in `.github/workflows/ci.yml`:

| Job | Trigger condition | Failure mode |
|-----|-------------------|---------------|
| Backend Tests | every push | blocks merge |
| Frontend Tests | every push | blocks merge |
| Frontend Build | every push | blocks merge (catches tsc errors) |
| Real-stack e2e | every push | blocks merge |
| Knip dead-export check | every push | blocks merge |
| Responsive Layout Audit | every push | blocks merge |

The 6-job matrix catches ~95% of regressions before they reach
`main`. The remaining 5% is what manual QA + monitoring is for.

## 11.8 Debugging a failing test

### 11.8.1 Local reproduction

```bash
# Backend
cd Backend && node --test test/<name>.test.js

# Frontend
cd Frontend && npm test -- src/lib/<name>.test.ts

# Playwright
cd Frontend && npx playwright test e2e/<name>.realstack.spec.ts --headed
```

`--headed` for Playwright opens a real browser so you can see the
page. `--debug` pauses before each action and lets you step through.

### 11.8.2 Read the assertion, not the stack

If a test fails, the assertion message usually tells you exactly
what's wrong. Read it before reading the stack.

### 11.8.3 Isolate the failure

If a test fails intermittently, run it 100 times:

```bash
cd Backend && node --test --test-repeat=100 test/<name>.test.js
cd Frontend && npx vitest run --reporter=verbose --repeat=100
```

If it passes 100/100, the issue is environment (timing, ordering,
flaky network). If it fails ≥1, the issue is in the test or the
code.

### 11.8.4 The "what would break in prod" check

If a test fails and you don't understand why, ask:

> "If this code were deployed right now, would users be affected?"

If yes, it's a real bug. If no, fix the test (mock more
aggressively, narrow the assertion, or just delete the test if it
was guarding an implementation detail).
