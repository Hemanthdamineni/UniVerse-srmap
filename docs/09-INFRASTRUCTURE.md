# 09 — Infrastructure & Deployment

> **Updated 2026-08-29** to reflect the ingress-container topology (Gate 9 P1):
> the old `compose.data.yml` + `compose.app.yml` split has been superseded by
> the root `docker-compose.yml`; nginx now runs inside the container via
> `compose.ingress.yml`, not on the host (`setup-tls.sh` was removed).

## 9.1 Architecture Overview

```
Internet
  │
  ▼
┌──────────────────────┐
│  Nginx (in-container)│  Reverse proxy, TLS, static files, compression
│  compose.ingress.yml │
└──────────┬───────────┘
           │
           ├──── /api/* ──────►  Express Backend (:5000)
           │                          │
           ├──── /files/* ────►  Filesystem (Backend/data/)
           │                          │
           └──── /* ──────────►  React SPA (Frontend/dist/)
                                       │
                                       ▼
                                 Redis (:6379)
```

The root `docker-compose.yml` brings up **backend + Redis**; the ingress override
adds nginx on top. See `infra/README.md` for the bundle ordering details.

---

## 9.2 Docker Compose Bundles

| File | Location | Services | Purpose |
|------|----------|----------|---------|
| `docker-compose.yml` | repo root | Backend, Redis | Single source of truth for the application + data tier |
| `compose.ingress.yml` | `infra/docker/` | Nginx | Edge server (TLS, `/api` proxy, SPA static files) |
| `compose.monitoring.yml` | `infra/docker/` | Prometheus, Grafana, Loki, Promtail, Alertmanager, node-exporter, cAdvisor | Optional observability stack |

The old split (`compose.data.yml` + `compose.app.yml`) was
deprecated by the Gate 9 P1 ingress-container decision and has been
deleted. The root compose already covers backend + Redis with
proper `depends_on: service_healthy` ordering.

### Start Order
```bash
# 1. Backend + Redis (root compose)
docker compose up -d --build

# 2. Build the frontend dist (one-time or on changes)
cd Frontend && npm run build

# 3. Ingress (nginx in front of the backend)
docker compose -f docker-compose.yml \
               -f infra/docker/compose.ingress.yml up -d

# 4. (Optional) Monitoring
docker compose -f docker-compose.yml \
               -f infra/docker/compose.monitoring.yml up -d
```

### Docker Networks
| Network | Purpose |
|---------|---------|
| `university-erp_default` | Backend ↔ Redis ↔ Nginx (created by root compose) |

---

## 9.3 Backend Dockerfile

The current `Backend/Dockerfile` is a multi-stage build (see file for the
exact contents; summary):

```dockerfile
FROM node:22-bookworm-slim AS base
# ... build deps, install Playwright + browsers
FROM node:22-bookworm-slim AS runtime
# ... copy node_modules + app, expose 5000, run as non-root
```

Key points:
- **Base image is `node:22-bookworm-slim`** (not `node:20-slim`; the audit
  flagged this — see prod-readiness ledger D3 for the Open issue).
- **Playwright + Chromium browsers are installed** (D3 mitigation).
- **Exposed port is 5000** (matches the root compose; the e2e-stack
  dev launcher uses 5500 to avoid clashes).
- **`EXPOSE 5000`** in the Dockerfile, but the actual port is
  configurable via the `PORT` env var (default 5000).

---

## 9.4 Nginx Configuration

Located in `infra/nginx/`. Top-level `nginx.conf` loads the vhost
`conf.d/university-erp.conf`, which fronts the SPA + API on a single
port (default 443 in container, 80 if no TLS). Key routing rules:

```nginx
# API proxy → backend service
location /api/ {
    proxy_pass http://backend:5000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
}

# Static file serving (from backend data directory)
location /files/ {
    alias /app/data/;
    autoindex off;
    expires 7d;
}

# SPA fallback (serves index.html for all non-API, non-file routes)
location / {
    root /usr/share/nginx/html;  # Frontend dist/
    try_files $uri $uri/ /index.html;
}
```

The ingress container handles TLS via certs mounted at the standard
paths (`/etc/nginx/certs/`). The decision to use the ingress container
(over a host-nginx + `setup-tls.sh` path) was made in PR 9 (Gate 9 P1);
the old `setup-tls.sh` was deleted.

Additional nginx features:
- Gzip compression enabled
- Request buffering
- HTTPS termination (certs mounted as a volume)
- Security headers (HSTS, X-Frame-Options, etc.)

---

## 9.5 Redis Configuration

**Image:** `redis:7-alpine`

**Configuration:**
- AOF persistence enabled (`--appendonly yes`)
- Persistent volume for data durability
- Exposed on port 6379

**Redis key namespaces:**
| Pattern | Purpose | TTL |
|---------|---------|-----|
| `session:<uuid>` | User session data | 30 min |
| `erp:<userId>:<pageKey>` | Cached ERP responses | 10 min |
| `erp:circuit:<pageKey>` | Circuit breaker state | 5 min |
| `erp:<userId>:<pageKey>:live:lock` | Distributed lock | 12 sec |
| `ratelimit:<ip>` | Rate limit counter | 60 sec |

**Sentinel Support:**
The backend supports Redis Sentinel for HA deployments. Configure via:
```
REDIS_SENTINEL_URLS=sentinel1:26379,sentinel2:26379
REDIS_SENTINEL_MASTER_NAME=mymaster
```

**In-memory fallback:** When `REDIS_URL` is empty, the session store and
rate limiter fall back to in-memory implementations. This is what the
`Backend/scripts/e2e-stack/start.sh` dev launcher uses (it sets
`SESSION_STORE_DRIVER=memory` and `ERP_CACHE_DRIVER=memory`). Not safe
for production — single-process state means a restart drops all
sessions and circuit-breaker state.

---

## 9.6 Monitoring Stack (Optional, but recommended)

### Prometheus
- Scrapes `/api/metrics` endpoint
- Collects: cache hit rates, ERP latency, upstream failures, circuit state, concurrency, HTTP latency by route

### Grafana
- Pre-configured dashboards for ERP performance
- 9 alert rules (see `infra/monitoring/prometheus/alerts.yml`)

### Loki + Promtail
- Log aggregation from backend JSON logs
- Searchable by request ID, page key, error code

### Alertmanager
- Single-webhook routing (`infra/monitoring/alertmanager/alertmanager.yml`)
- Wired to the 9 alert rules; sends to a configured webhook (set via env in the monitoring override)

---

## 9.7 Persistence Notes

- **No PostgreSQL required.** All persistent data uses SQLite files.
- Database files live in `Backend/data/`. The current DB set (14 DBs):
  - `content.sqlite` — Unified content store
  - `events.sqlite` — Events system
  - `external-pages.sqlite` — External page metadata
  - `helpdesk.sqlite` — Helpdesk tickets and FAQs
  - `campus-feedback.sqlite` — Campus feedback
  - `career.sqlite` — Career portal (resumes, job listings)
  - `lms.sqlite` — LMS resources, guides, roadmaps, quizzes, PYQs
  - `lms-tracker.sqlite` — LMS interaction tracking
  - `unified-profile.sqlite` — Unified student profiles
  - `companion-analytics.sqlite` — Companion platform analytics
  - `erp-attendance-snapshots.sqlite` — Daily attendance snapshots
  - `vacant-rooms.sqlite` — Vacant-rooms cache
  - `persistent-teams.sqlite` — Persistent team registry
  - `hostel-buddy.sqlite` — Hostel buddy finder entries
- The `Backend/data/` directory is mounted as a Docker volume in
  the root compose.
- **WAL pragma** is set on all DB-opening stores (verified by
  `Backend/test/walPragmas.test.js`).
- **Backup strategy:** `infra/scripts/setup-backups.sh` copies
  `*.sqlite` + Redis RDB nightly to `BACKUP_DEST` (rsync-friendly).
  Extend with the file-dirs (uploads, events, certificates) per
  prod-readiness ledger D13.
- Discovery map (`endpoint-discovery.json`) is checked in; doesn't
  change at runtime.

---

## 9.8 Deployment Checklist

```
□ Root .env file populated (REDIS_PASSWORD, ADMIN_CONTENT_PASSWORD)
□ Root compose up: docker compose up -d --build
□ /api/live returns 200, /api/ready returns 200 (or 503 with checks)
□ Frontend dist built: cd Frontend && npm run build
□ Ingress override up: docker compose -f docker-compose.yml -f infra/docker/compose.ingress.yml up -d
□ TLS certs mounted at the expected nginx path
□ /api/auth/captcha reachable through the ingress (TLS works)
□ setup-backups.sh installed as a cron entry (02:00 daily)
□ Monitoring override up (if using monitoring): same compose-file pattern
□ Alertmanager webhook configured and a test alert received
□ Restore drill recorded in infra/runbooks/backup-restore.md
```

---

## 9.9 NPM Scripts Reference

### Backend
| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `node src/server.js` | Production start |
| `npm run dev` | `node src/server.js` | Development start |
| `npm test` | `node --test` | Run all test files (245/245 pass) |
| `npm run discover:endpoints` | `node scripts/endpoint-discovery.js` | Run ERP endpoint discovery |
| `npm run fetch:endpoints` | `node scripts/fetch-discovered-endpoints.js` | Fetch all discovered endpoints |
| `npm run preprocess:endpoints` | `node scripts/preprocess-fetched-endpoints.js` | Type-annotate fetched data |
| `npm run analyze:ui-map` | `node scripts/analyze-erp-ui-map.js` | Analyze ERP UI structure |
| `npm run verify:integrity` | `node scripts/check-erp-integrity.js` | Verify system integrity |
| `npm run seed:external` | `node scripts/seed-external-pages.js` | Seed external page data |
| `npm run seed:demo` | `node scripts/seed-demo-data.js` | Seed demo data |
| `npm run seed:pyq` | `node scripts/seed-pyq-papers.js` | Seed PYQ papers |
| `npm run load:cached` | `k6 run load-tests/erp-cached.js` | Load test cached mode |
| `npm run load:live` | `k6 run load-tests/erp-live.js` | Load test live mode |
| `npm run load:mixed` | `k6 run load-tests/erp-mixed.js` | Load test mixed mode |
| `npm run load:career` | `k6 run load-tests/career-portal.js` | Load test career portal |

### Frontend
| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite` | Development server (hot reload, default port 5173) |
| `npm run build` | `tsc -b && vite build` | Production build (type-check then bundle) |
| `npm run lint` | `eslint .` | Lint check |
| `npm run preview` | `vite preview` | Preview production build |
| `npm run test` | `vitest run` | Run all vitest files (1188/1188 pass) |
| `npm run test:e2e` | `playwright test` | Run all Playwright specs |
| `npm run audit:api-contracts` | `node ./scripts/audit-frontend-api-usage.mjs` | Verify the SPA calls the right endpoints |

---

## Staging / production separation (Gate 9 P0)

Staging exists so the same images that ship to production can be
exercised against a real data path before the rollout goes live.
The contract:

1. **Same images.** Staging runs the exact same backend and
   frontend image tags as production — only the env file changes.
   No `staging-only` code branches; if a change needs different
   behavior in staging, it's not ready for production either.
2. **Separate credentials.** Staging has its own `REDIS_PASSWORD`,
   `ADMIN_CONTENT_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, and
   `BACKUP_DEST`. None of these are reused from production. See
   `.env.staging.example` for the full template.
3. **Separate data volumes.** `COMPOSE_PROJECT_NAME=university-erp-staging`
   ensures docker compose names the staging volumes with a
   different prefix, so an accidental `docker compose down` on the
   wrong host cannot delete the production data.
4. **Separate ERP dump directory.** `ERP_DUMP_BASE_DIR` points at a
   staging-only path; the live ERP integration tests against that
   directory, never the production one.
5. **Never point at production credentials.** A test that needs the
   real ERP uses a *recorded proxy* or a sandbox account, not the
   real student register numbers.

If staging starts behaving differently from production (an image
that runs in staging but errors in production, or vice versa) the
first thing to check is whether someone bypassed any of these
rules. The secret-rotation runbook (`infra/runbooks/secret-rotation.md`)
covers the operational procedure; this file covers the contract.

---

## Expected-downtime model (Gate 9 P2)

The platform runs on a single host in the current deployment. That
implies a brief restart window during image-tag rollouts and
security rotations. The expected-downtime budget:

- **Routine image-tag rollout:** 30–60s of 503s from the
  proxy. Frontend static assets are served by nginx directly; only
  the backend restarts. Drain and restart budget is enforced at 8s
  (`fix(be): hard shutdown budget on SIGTERM`).
- **Planned secret rotation:** 5–15s, same single-host profile.
  See `infra/runbooks/secret-rotation.md`.
- **Emergency rollback (image tag):** 60–120s including cache
  warm-up. Procedure in `infra/runbooks/rollback.md`.
- **Unplanned outage (host failure):** Until the host is replaced
  or restarted, the platform is down. Mitigations: nightly
  `setup-backups.sh` + offsite `BACKUP_DEST` rsync + the
  02:00 cron entry in `infra/cron/backup.cron`.

If the deployment grows beyond a single host, revisit this section:
the model changes materially when there's more than one backend
behind a load balancer (zero-downtime rolling restarts become
feasible, and the SHUTDOWN_BUDGET_MS hard deadline can be relaxed).

---

## Monitoring Data Policy

The Prometheus + Grafana + Loki stack stores all telemetry in
docker-managed volumes on the host that runs the monitoring
override. The volumes are:

- `prometheus_data` — Prometheus time-series DB
- `grafana_data` — Grafana dashboards, datasources, users
- `loki_data` — Loki log chunks
- `alertmanager_data` — alert silences + notification state

These volumes are **declared expendable** in the prod-readiness
audit (Gate 8). The rationale:

1. **Telemetry is reproducible.** Scrape configs and the Grafana
   dashboards are checked into this repo and re-applied by the
   `infra/docker/compose.monitoring.yml` override.
2. **Alerts are reproducible.** The `infra/monitoring/prometheus/alerts.yml`
   file is the source of truth; Alertmanager's silence state is not.
3. **Logs are sampled.** Loki retention is 30 days; the runbooks
   (this file, `infra/runbooks/*`) are the source of truth for
   operational knowledge, not the log archive.

If the monitoring host is lost, the override can be re-deployed
and Prometheus + Grafana + Loki will re-bootstrap from zero in
under 5 minutes — losing the volumes costs alerts history and
dashboard favorites, but no operational data the team needs to
recover the system.

This is a deliberate trade-off against the cost of backing up
multi-GB time-series DBs on a small host. Operators who need
longer retention can override the policy in the runbook and add
the volumes to `infra/scripts/setup-backups.sh` directly.
