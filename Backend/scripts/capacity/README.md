# Capacity testing

Answers "how many concurrent users can the Oracle Always-Free VM (2 OCPU /
12 GB, per `docs/17-DEPLOYMENT-GUIDE.md` §3) actually serve?" by measuring,
not guessing.

It builds and runs the real backend+redis containers locally, but capped to
the resources those services will actually get on the VM (1.6 OCPU / 9 GB
for the backend, 0.3 OCPU / 512 MB for redis — see `docker-compose.capacity.yml`
for the reasoning on that split), then ramps k6 virtual users against it
while sampling `docker stats` every 2s, and reports the VU count where CPU
saturates.

## Run it

```bash
# from repo root or Backend/
cd Backend && npm run capacity:test
```

Needs `docker` and `k6` (https://k6.io/docs/get-started/installation/) on
your machine, and a repo-root `.env` with `REDIS_PASSWORD` set.

Takes about 6 minutes (the ramp climbs 20 → 1500 VUs in steps, 45s per
step) unless k6 aborts early because latency/error thresholds are already
breached — that's expected and means it found the ceiling before the
ramp finished.

Output lands in `Backend/scripts/capacity/results/<timestamp>/`:
- `monitor.csv` — raw CPU%/mem samples per container per 2s
- `k6.log` — full k6 stdout (per-stage VU counts, final summary, threshold results)
- `report.md` — the joined table + verdict (also printed to stdout)

Use `npm run capacity:test:keep-up` to leave the stack running afterward
(e.g. to poke at `/api/metrics` by hand, or re-run k6 against the same
warm containers without rebuilding).

## Reading the report

The report table shows, per ramp stage, the backend's average/max CPU as a
percentage of its 1.6-core budget. The verdict line calls out the first
stage where average CPU crossed 85% — treat that VU count as the realistic
ceiling for the *2 OCPU / 12 GB single-VM* deployment in §1 of the
deployment guide.

Two important caveats baked into the numbers:

1. **k6 VUs are denser than real users.** Each VU loops continuously with
   only 100-300ms of think time between page loads — real students click,
   read, and idle between requests far longer than that. So the VU count
   this reports is a *worst-case, sustained-load* ceiling, not the number
   of registered users the site can have. If you want an average-case
   estimate, multiply the reported VU ceiling by however many "think time"
   multiples you expect real usage to have (e.g. if a real student issues
   1 request per ~10s of active session time vs. k6's ~0.3s, the same box
   can carry roughly 30x more *logged-in* users at typical usage, not just
   30x more *actively clicking* users).
2. **Caddy and the OS aren't simulated.** The compose override reserves
   ~0.1 OCPU / 2.5 GB of the VM's 2 OCPU / 12 GB budget for them but
   doesn't run Caddy locally, so real production headroom will be a bit
   tighter than this test shows. If you want to close that gap, add a
   Caddy container to `docker-compose.capacity.yml` with its own small
   cpu/memory limit and point k6 at Caddy's port instead of the backend's.

## What it's testing

`capacity-ramp.js` hits local-SQLite-backed endpoints — `/api/career/*`,
`/api/academic-calendar`, `/api/vacant-rooms`, `/api/events` — using one
demo-login session shared across all VUs. It deliberately does **not**
hit `/api/v2/erp/page/*`: those need a real, live-authenticated ERP
session, which the demo-login path doesn't have (no real ERP cookies), so
they 401 with `SESSION_EXPIRED` under demo auth. See "Testing the scraper
path" below for how the real ERP path was measured instead (manually,
with a real login) and why its cost turned out to be close enough to this
ramp's that the SQLite-path ceiling is still a reasonable proxy.

## Testing the scraper path (optional, separate concern)

Headless Chromium (Playwright) is **only launched once per login**
(`submitLoginInBrowser` in `erpClient.js`, to fill the form and get past
the captcha) — not per page view. Once a session is authenticated, every
subsequent ERP page fetch (`/api/v2/erp/page/*`, `/api/v2/erp/batch`)
replays the session's cookies through a lightweight HTTP client
(`createApiContext`, Playwright's `request` API), no browser involved.
This was confirmed by a manual measured session (real login + several
page visits against the capacity-constrained container): the login itself
completed in ~930ms, peaking at ~29% of one core and a few MB of memory
above baseline; the page fetches after it ran 60ms–1.3s each, with CPU
spikes in the same 2–28%-of-one-core range as the SQLite-backed endpoints
this harness already load-tests. So the earlier assumption here — that
scraping is a much heavier per-request cost than the cached-page path —
doesn't hold: **once logged in, ERP page browsing is roughly as cheap as
the SQLite-backed endpoints**, and the general ramp's VU ceiling (see
above) is a reasonable proxy for real ERP browsing capacity too, not an
overcount.

The one cost this harness doesn't measure is a **login rush** — many
students logging in within the same short window (e.g. right when
attendance opens). Each login is a real, if brief, Chromium launch, so N
simultaneous logins compete for the same single Node thread this harness
already found to be the bottleneck (see "What it's testing" above). One
measured login isn't enough to state a concurrent-login ceiling — that
needs multiple real ERP accounts logging in at once, which isn't
something to automate without real credentials for each. If you want that
number, the honest way to get it is watching `docker stats` /
`/api/metrics` during a real peak-login period post-launch, not simulating
it here.

## Rate limiting

The app has a global per-IP rate limiter (`RATE_LIMIT_MAX`, default 400
requests/60s — see `Backend/src/middleware/rateLimit.js`) on every `/api/*`
route. `docker-compose.capacity.yml` raises it to a very high number for
this test only, because every k6 VU shares one source IP: left at the
default, the ramp hits the limiter at a handful of VUs and reports *that*
as the ceiling instead of actual CPU/memory saturation — two different
questions.

Keep the production default in mind separately: **400 req/min is per
source IP**, so if a meaningful number of real students sit behind the
same NAT'd IP (a campus network, for instance), they share one bucket.
That's a deliberate anti-abuse guardrail, not something this capacity test
is meant to validate — but it's worth knowing it exists, since it caps
real per-IP throughput well below whatever the hardware ceiling turns out
to be.

## Re-running with different assumptions

- **Different VM shape:** edit the `cpus`/`memory` limits in
  `docker-compose.capacity.yml` (and the matching `CPU_LIMITS` constant at
  the top of `report.mjs` — they must stay in sync).
- **Different ramp shape/ceiling:** edit `load-tests/capacity/stages.json`
  — both the k6 script and the report read from it, so you only edit it
  once.
- **Different traffic mix:** edit the `PAGES` array in
  `load-tests/capacity/capacity-ramp.js`.
