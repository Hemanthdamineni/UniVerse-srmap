# Deployment Runbook — SRMAP Intranet Scraper

> **Applies to:** `Scraper/intranet/` Python ingestion daemon and its integration with the
> Express backend (`Backend/src/services/intranet/intranetScraperSupervisor.js`).
> This runbook covers runtime credentials, process supervision (systemd / cron), and
> health-check monitoring. It is the deployment companion to
> [`docs/integrations/srmap-intranet.md`](../integrations/srmap-intranet.md).

---

## 0. Quick Reference

| Item | Location / value |
|---|---|
| Python entry point | `Scraper/intranet/main.py` |
| Python interpreter | `Scraper/venv/bin/python3` (shared venv, Playwright included) |
| SQLite database | `Backend/data/intranet.sqlite` |
| Log file | `Scraper/intranet/logs/intranet_scraper.log` |
| Instance lock | `Scraper/intranet/.intranet.lock` (flock, kernel-released) |
| Run-now trigger | `Scraper/intranet/.intranet-run-now` (picked up within ~1 s) |
| Default schedule | every **24 h** (`INTRANET_SCRAPER_RUN_INTERVAL_HOURS`) |
| Modes | daemon (`no arg`), one-shot (`--once`), auth check (`--auth-check`) |

**Two supervision models — pick one:**
- **A. Backend supervisor (recommended when the ERP is running):** the Express process
  spawns and keeps the Python daemon alive automatically. Nothing extra to schedule.
- **B. Standalone systemd/cron (recommended when the ERP is down or as a belt-and-suspenders
  fallback):** the Python daemon runs as its own unit. See §3.

The daemon uses an **exclusive flock** on `.intranet.lock`, so model A and B can coexist
safely — only one Python instance ever runs the pipeline at a time; the loser exits cleanly.

---

## 1. Runtime Credentials Setup

All credentials are read from **environment variables only** — never hardcoded. The scraper
uses Playwright (headless Chromium) to authenticate to the SRM University–AP intranet.

### 1.1 Required variables

| Variable | Required | Purpose |
|---|---|---|
| `INTRANET_STUDENT_ID` | **yes** | Student/registration ID used to log in to `https://intranet.srmap.edu.in` |
| `INTRANET_PASSWORD` | **yes** | Corresponding password |

### 1.2 Optional variables (tunables)

See [`Scraper/intranet/config.py`](../../Scraper/intranet/config.py) for defaults and the full
list in `docs/integrations/srmap-intranet.md`. Highlights:

| Variable | Default | Purpose |
|---|---|---|
| `INTRANET_BASE_URL` | `https://intranet.srmap.edu.in` | Origin of the intranet |
| `INTRANET_SCRAPER_RUN_INTERVAL_HOURS` | `24` | Hours between scheduled pipeline runs |
| `INTRANET_SCRAPER_LOG_LEVEL` | `INFO` | Logging verbosity |
| `INTRANET_SCRAPER_TIMEOUT_SECONDS` | `30` | Per-request timeout |
| `INTRANET_SCRAPER_SOURCE_TIMEOUT_SECONDS` | `120` | Hard timeout per source run |
| `INTRANET_SCRAPER_INTER_REQUEST_DELAY` | `0.5` | Delay between page requests |
| `INTRANET_SCRAPER_MAX_PAGINATION_PAGES` | `20` | Pagination depth cap |
| `INTRANET_ENABLE_<SOURCE>` | `1` | Per-source on/off (`announcements`, `events`, `news`, `academic`, `documents`, …) |

### 1.3 Where to put them

The ERP backend already reads `Backend/.env` (via `Backend/src/config/env.js`). The simplest
deployment is to add the two variables there so both the backend supervisor and (if it is
started by the backend) the Python daemon inherit them:

```bash
cd Backend
# Backend/.env
INTRANET_STUDENT_ID=AP2XXXXXXXX
INTRANET_PASSWORD='your-strong-password'
```

> **Security note:** keep `Backend/.env` out of version control (already git-ignored), set
> `chmod 600` on it, and never paste the password into logs, the runbook, or commit history.

### 1.4 Verifying credentials (no full run)

Before enabling scheduled scraping, confirm the credentials work with the **auth check** mode —
it logs in headlessly and prints the resulting page URL:

```bash
cd Scraper
INTRANET_STUDENT_ID='AP2XXXXXXXX' INTRANET_PASSWORD='...' \
  venv/bin/python3 intranet/main.py --auth-check
```

Expected success output:

```
[AUTH-CHECK] Credentials configured for: AP2XXXXXXXX
[AUTH-CHECK] SUCCESS — authenticated at: https://intranet.srmap.edu.in/...
```

Any failure exits non-zero with `[AUTH-CHECK] FAILED:` / `[AUTH-CHECK] AUTH FAILED:`.

### 1.5 One-shot run (manual populate / smoke test)

```bash
cd Scraper
INTRANET_STUDENT_ID='AP2XXXXXXXX' INTRANET_PASSWORD='...' \
  venv/bin/python3 intranet/main.py --once
```

This runs the full pipeline for all enabled sources and upserts into `Backend/data/intranet.sqlite`.

---

## 2. Model A — Backend Supervisor (recommended)

When the Express ERP is running, `Backend/src/server.js` creates an
`intranetScraperSupervisor`, calls `start()` in the listen callback and `stop()` on
shutdown. On start it resolves the venv Python:

- `command = <repo>/Scraper/venv/bin/python3`
- `args = ["main.py"]`
- `cwd = <repo>/Scraper/intranet`

It keeps the child alive (restart w/ exponential backoff), supports a `--once` manual trigger
(via `triggerOnce()`), and exposes status through `getStatus()`. If the venv interpreter is
missing it logs a warning and marks itself `unavailable` rather than crashing the ERP.

**You generally need nothing more.** Ensure:
1. `Scraper/venv` exists (run `Scraper/setup.sh` if not — see §5).
2. `Backend/.env` has `INTRANET_STUDENT_ID` and `INTRANET_PASSWORD` (or export them in the
   backend's process environment).
3. The ERP process has write access to `Backend/data/` and `Scraper/intranet/`.

Manual re-run while the ERP is up (admin-only):

```bash
curl -X POST -H "Cookie: erp_session=<admin-session>" \
  https://your-host/api/intranet/scraper/trigger
```

---

## 3. Model B — Standalone systemd / cron

Use this when the ERP is not running, or to guarantee the scraper survives backend restarts.
Because of the `.intranet.lock` flock, the standalone unit and the backend supervisor never
double-run.

### 3.1 Environment file

Create a credentials/env file that systemd/cron can `EnvironmentFile`/source. Keep it root-only:

```bash
sudo install -m 600 /dev/null /etc/srmap/intranet.env
sudo tee /etc/srmap/intranet.env >/dev/null <<'EOF'
INTRANET_STUDENT_ID=AP2XXXXXXXX
INTRANET_PASSWORD=your-strong-password
INTRANET_SCRAPER_RUN_INTERVAL_HOURS=24
INTRANET_SCRAPER_LOG_LEVEL=INFO
EOF
```

### 3.2 Option B1 — systemd service (recommended for a persistent daemon)

`/etc/systemd/system/srmap-intranet-scraper.service`:

```ini
[Unit]
Description=SRMAP Intranet scraper daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
EnvironmentFile=/etc/srmap/intranet.env
WorkingDirectory=/home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Scraper/intranet
ExecStart=/home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Scraper/venv/bin/python3 /home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Scraper/intranet/main.py
Restart=on-failure
RestartSec=30
# Prevent the flock-based duplicate path from ever racing two copies on one box:
# (The flock already guards this, but a sysadmin can also use an ExecStop timeout.)
TimeoutStopSec=15

# ---- hardening (adjust to your filesystem paths) ----
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Backend/data /home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Scraper/intranet

[Install]
WantedBy=multi-user.target
```

> The daemon runs the scheduler loop (`start_scheduler()`) and uses the `schedule` library to
> fire `job()` every `INTRANET_SCRAPER_RUN_INTERVAL_HOURS`. It also watches `.intranet-run-now`
> for the backend's manual trigger. It is a long-lived process — do **not** combine it with a
> cron timer that also launches `main.py` (the flock makes the second instance a no-op, but it
> is wasteful).

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now srmap-intranet-scraper
sudo systemctl status srmap-intranet-scraper
```

### 3.3 Option B2 — cron one-shot (scheduled runs only, no persistent daemon)

If you prefer no long-lived process, run the pipeline on a schedule with `--once`. Because the
run-now flag and scheduler are then unused, this is a pure periodic-pull model:

```cron
# minute hour dom mon dow   user  command
# Run intranet pipeline at 02:00 and 14:00 IST-ish daily
0 2,14 * * *  www-data  /home/zorro-omarchy/.../Scraper/intranet/run-cron.sh
```

`run-cron.sh` (root-owned, `chmod 755`):

```bash
#!/usr/bin/env bash
set -euo pipefail
export INTRANET_STUDENT_ID='AP2XXXXXXXX'
export INTRANET_PASSWORD='...'
export INTRANET_SCRAPER_RUN_INTERVAL_HOURS=24
cd /home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP/Scraper
exec venv/bin/python3 intranet/main.py --once >> intranet/logs/intranet_scraper.log 2>&1
```

> **Note:** with cron there is no resident process watching `.intranet-run-now`, so the backend's
> `/api/intranet/scraper/trigger` cannot force an immediate run. For that, keep the backend
> supervisor (Model A) or the systemd daemon (B1) instead.

---

## 4. Health-Check & Monitoring

### 4.1 Data-driven health tables (source of truth)

The pipeline records run/source/auth telemetry into `Backend/data/intranet.sqlite`:

| Table | Purpose |
|---|---|
| `intranet_items` | Ingested content (upserted by `source_url`; expired items set `is_active=0`) |
| `intranet_items_fts` | FTS5 search index (built by the backend on first start) |
| `intranet_scraper_runs` | Per-source run rows (`started_at`, `status`, `completed_at`) |
| `intranet_source_health` | Per-source `last_success`, `last_attempt`, `consecutive_fails`, `is_blocked` |
| `intranet_auth_log` | Authentication events |

**Circuit breaker:** after `CIRCUIT_BREAKER_THRESHOLD` (default 5) consecutive failures a source
is marked `is_blocked` and skipped for `CIRCUIT_BREAKER_COOLDOWN_HOURS` (24 h). Use the admin
reset endpoint to clear a stuck breaker after fixing the cause.

### 4.2 Admin API endpoints

All under `/api/intranet` (require an elevated admin session):

| Method & path | Purpose |
|---|---|
| `GET /api/intranet/status` | Supervisor state (`idle/running/backoff/stopping/stopped/exited/unavailable/disabled`), last runs |
| `GET /api/intranet/feed?limit=N` | Latest feed (used by the Dashboard widget) |
| `GET /api/intranet/items/:id` | Item detail (403 unless `audience == shared`) |
| `POST /api/intranet/scraper/trigger` | Force a one-shot run (503 if `unavailable`) |
| `POST /api/intranet/scraper/reset/:source` | Reset a source's circuit breaker |

### 4.3 Logs

- **Python daemon:** `Scraper/intranet/logs/intranet_scraper.log`
- **Backend supervisor:** the ERP backend log (level `warn` on missing venv; runtime events
  logged with the `[intranet-scraper]` prefix).

Useful log-line greps:

```bash
grep -E "ERROR|CRITICAL|BLOCK|circuit|AUTH FAILED" Scraper/intranet/logs/intranet_scraper.log
```

### 4.4 Recommended monitoring checks

1. **Process up (Model A or B1):** `systemctl is-active srmap-intranet-scraper`, or check the
   supervisor reports a non-`exited`/`unavailable` status via `GET /api/intranet/status`.
2. **Auth health:** last row in `intranet_auth_log` should be a success; no repeated
   `AUTH FAILED` in the log.
3. **Source health:** query `intranet_source_health` for any `is_blocked = 1` or
   `consecutive_fails >= 5`:
   ```sql
   sqlite3 Backend/data/intranet.sqlite \
     "SELECT source, last_success, consecutive_fails, is_blocked FROM intranet_source_health;"
   ```
4. **Freshness:** recent `intranet_scraper_runs` rows with `status='completed'`; `last_success`
   within the configured interval.
5. **Item volume:** `SELECT COUNT(*), MAX(published_at) FROM intranet_items WHERE is_active=1;`
   (should grow/stay stable, not silently drop to 0).

Wire these into your existing uptime/error monitoring (e.g. a UptimeRobot/Heartbeat ping on
`/api/intranet/feed` plus a periodic sqlite query job as described in
[`docs/17-DEPLOYMENT-GUIDE.md`](../17-DEPLOYMENT-GUIDE.md)).

---

## 5. First-Time Setup & Verification Checklist

```bash
cd /home/zorro-omarchy/Shared/Workspace/Projects/Personal/University-ERP

# 1. Venv + Playwright present?
test -x Scraper/venv/bin/python3 && echo "venv ok"
venv/bin/python3 -m playwright install chromium 2>/dev/null || true   # if not already installed

# 2. Credentials in place?
grep -q INTRANET_STUDENT_ID Backend/.env && grep -q INTRANET_PASSWORD Backend/.env && echo "env ok"

# 3. Auth works?
cd Scraper
INTRANET_STUDENT_ID='AP2XXXXXXXX' INTRANET_PASSWORD='...' venv/bin/python3 intranet/main.py --auth-check

# 4. One-shot populate?
INTRANET_STUDENT_ID='AP2XXXXXXXX' INTRANET_PASSWORD='...' venv/bin/python3 intranet/main.py --once

# 5. Data landed?
sqlite3 ../Backend/data/intranet.sqlite "SELECT COUNT(*) FROM intranet_items;"

# 6. Enable supervision (choose A: restart backend, or B1: systemctl enable).
```

---

## 6. Operational Notes

- **Single-writer guarantee:** the `.intranet.lock` flock prevents overlapping pipeline runs
  across the backend supervisor, systemd, cron, and ad-hoc CLI invocations. The loser exits with
  `Another intranet scraper instance already holds the lock; exiting.`
- **Backend owns the schema extras:** the Python daemon creates the base `intranet_items`
  tables; the backend creates indexes + the FTS5 virtual table/triggers on first start. Do not
  delete `intranet.sqlite` while the backend is running.
- **Credential rotation:** update `Backend/.env` (and `/etc/srmap/intranet.env` if using Model B)
  and restart the supervisor/service. Run `--auth-check` after every rotation.
- **Stale content:** expired items are soft-deleted (`is_active=0`); the FTS index is maintained
  by backend triggers as `is_active` changes.
- **Timeouts:** keep `INTRANET_SCRAPER_SOURCE_TIMEOUT_SECONDS` ≥ the longest page crawl; a
  blocked source is only re-tried after the circuit-breaker cooldown or an explicit reset.

---

## 7. Verification (this runbook's test gate)

The following suites were green when this runbook was written (see
`docs/integrations/srmap-intranet.md` for the full verification table):

- Python intranet unit tests: `venv/bin/python3 -m unittest discover -s intranet/tests` → **34 passed**
- Backend intranet tests: `node --test test/intranetStore.test.js test/intranetRoutes.test.js test/intranetScraperSupervisor.test.js` → **36 passed**
- Frontend intranet tests: `vitest run` (IntranetFeedWidget + Intranet page) → **7 passed**
- Type check / lint / build: `tsc -b`, `eslint`, `vite build` → clean

> Note: one pre-existing, unrelated flaky test (`Backend/test/loginArtifactRetention.test.js`)
> can intermittently fail on an mtime-tie in login-diagnostics rotation; it is not part of the
> intranet integration and was left untouched.