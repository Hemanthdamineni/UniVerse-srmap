# Debugging Notes — Real failures I hit, and how to fix them faster next time

This file logs mistakes I made debugging, with the actual fix and the shortcut
that would have caught it in minutes instead of hours. Goal: next time I see
one of these symptoms, I jump straight to the cause.

## 1. Mount-order shadowing: a new /api/<noun>/* route returns 401

**Symptom:** A new route mounted at `/api/whatever/*` returns 401 for every
endpoint, even ones that don't call `ensureAuthenticated`. The `sendApiError`
log shows `"errorMessage":"Authentication required. Please sign in."` which
is the message used by events/helpdesk/career `ensureAuthenticated` calls.

**Actual cause:** A catchall in another route (typically `scrapeRoutes`) is
matching the path first because the new route was mounted AFTER it. Express
matches in mount order, so the later mount never gets a chance.

**How to find it in 30 seconds:**

```bash
# Find any catchall-style routes that might match a single segment
grep -nE 'router\.(get|post)\("/:' Backend/src/routes/
```

The 4 catchalls that have shadowed routes in this codebase:
- `scrapeRoutes.js:63` `router.get("/:category/:page", ...)` — matches `/api/hostel-buddy/blocks` (category=hostel-buddy, page=blocks)
- `scrapeRoutes.js:68` `router.get("/:pageKey", ...)` — matches `/api/hostel-buddy` (pageKey=hostel-buddy)
- `externalRoutes.js:36` `router.get("/external/:pageKey", ...)` — only matches /api/external/*
- `erpV2Routes.js:73` `router.get("/v2/erp/page/:pageKey", ...)` — only matches /api/v2/erp/*

**Fix:** Mount the new route BEFORE the catchall routes, OR add a more
specific mount path (`app.use("/api/whatever", ...)` instead of `app.use("/api", ...)`).

**Why I burned 30 minutes on this:** I assumed the 401 was from inside the
new route handler. Added console.log to the route handler — it never fired
(because the catchall short-circuited). Should have done the grep FIRST.

## 2. Module-cache poisoning via process.env at test time

**Symptom:** Tests use `process.env.X` to set a value, but the production
code's `const X = process.env.X || default` captures the value AT module
load time, so the test value is ignored.

**Example:** `Backend/src/config/env.js` reads `process.env.HOSTEL_BUDDY_DB_PATH`
at module load. Test sets `process.env.HOSTEL_BUDDY_DB_PATH` before calling
`require("../src/config/env")` — but the module is already cached from a
previous `require`, so the new env value is ignored.

**How to fix in 30 seconds:** import the value from the loaded module, not
from `process.env`. Example: `const env = require("../src/config/env"); const
dbPath = env.HOSTEL_BUDDY_DB_PATH;`

**Why I burned 20 minutes on this:** I was reading `process.env.X` in the
test, but the production code had `env.X`. The two diverged silently.

## 3. PRAGMA column-name drift across node:sqlite versions

**Symptom:** `PRAGMA busy_timeout` returns a column with an unexpected
name. In node 22.5+ the column is `timeout`; in older versions it's
`busy_timeout`.

**Fix:** `const value = row.timeout ?? row.busy_timeout;`

**Why I burned 10 minutes on this:** I assumed the column was `busy_timeout`
based on memory of older better-sqlite3 behaviour. The PRAGMA column
returned NaN because the column was named differently.

## 4. Edit conflict: my edits lost when I `git checkout -- <file>`

**Symptom:** I instrumented a file with debug console.logs, then ran
`git checkout -- <file>` to revert. The checkout reverted ALL changes to
the file, including my actual code edits (not just the debug logs).

**Fix:** Use `git stash` to save pending edits before checking out specific
files. Or use a more targeted revert (e.g., remove the specific debug lines
manually).

**Why I burned 15 minutes on this:** I had to re-apply my mount-point edits
in `Backend/src/app.js` and `Backend/src/server.js` after the checkout.

## 5. node:sqlite "Cannot read properties of undefined" in tests

**Symptom:** A test calls a function that internally does `db.prepare(...).get()`,
and the returned object doesn't have the column the test expects.

**Why:** node:sqlite returns column names AS-IS from the SQL. If you query
a PRAGMA and the column name has changed (see #3 above), the test asserts
on a property that doesn't exist.

**Fix:** Inspect the actual response shape first with a debug print, then
write the assertion.

## 6. Stash diff direction confusion

**Symptom:** `git diff stash@{0} -- file` shows the wrong direction
(additions/deleted lines swap).

**Why:** `git diff` without two refs compares the working tree to the index
or HEAD. With one ref (`stash@{0}`), it shows: working tree (left) vs
ref (right). To see what the stash contains, use `git show 'stash@{0}':file`
or `git stash show -p 'stash@{0}'`.

**Why I burned 10 minutes on this:** I was reading the diff backwards
and getting confused about what was in the stash vs in the working tree.

## 7. async router middleware vs sync route handlers

**Symptom:** A test middleware that sets `req.userContext` is added with
`app.use(...)` AFTER the production app is built, but the route handler
sees a different `userContext` (the production userContext middleware
overwrites the test one).

**Why:** Express middleware order is the order they're added. If the
production app adds `router.use(userContext)` before the test runs, the
test's middleware is at the END of the chain. By the time the test
middleware runs, `res` is already sent.

**Fix:** Use a real session store and a real session cookie, OR test
the route in isolation (mount the route directly with a minimal Express
app, not via `createApp`).

**Why I burned 15 minutes on this:** I tried to inject a fake userContext
into the production app, but the production userContext middleware (eventsAuth)
overwrote it before my test could read the value.

## Summary of "what to do first" heuristics

1. Route returns 401 unexpectedly → `grep -nE 'router\.get\("/:'` for catchalls.
2. Test value ignored → import the value from the loaded module, not process.env.
3. PRAGMA column missing → try both `row.timeout` and `row.busy_timeout`.
4. Stash has weird content → use `git show 'stash@{0}':file` not `git diff`.
5. Edit lost to checkout → `git stash` before checking out.
6. Test middleware not firing → mount the route in isolation, not via `createApp`.
