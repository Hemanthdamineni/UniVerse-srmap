# 09 — Infrastructure & Deployment

## 9.1 Architecture Overview

```
Internet
  │
  ▼
┌──────────────┐
│    Nginx     │  Reverse proxy, TLS, static files, compression
│   (ingress)  │
└──────┬───────┘
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

---

## 9.2 Docker Compose Bundles

The infrastructure is organized into modular compose files in `infra/docker/`:

| File | Services | Purpose |
|------|----------|---------|
| `compose.data.yml` | Redis | Data layer (cache, sessions) |
| `compose.app.yml` | Backend | Application server |
| `compose.ingress.yml` | Nginx | Edge server (requires frontend build) |
| `compose.monitoring.yml` | Prometheus, Grafana, Loki, Promtail | Optional observability |

### Start Order
```bash
# 1. Data layer
docker compose -f infra/docker/compose.data.yml up -d

# 2. Application
docker compose -f infra/docker/compose.app.yml up -d

# 3. Build frontend
cd Frontend && npm run build

# 4. Ingress
docker compose -f infra/docker/compose.ingress.yml up -d

# 5. (Optional) Monitoring
docker compose -f infra/docker/compose.monitoring.yml up -d
```

### Docker Networks
| Network | Purpose |
|---------|---------|
| `erp_app` | Backend ↔ Nginx |
| `erp_data` | Backend ↔ Redis |

---

## 9.3 Backend Dockerfile

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5000
CMD ["node", "src/server.js"]
```

Note: Playwright browsers are **not installed** in the Docker image. The backend uses Playwright's `request` API only, which works with the `playwright` npm package alone (no browser binary needed).

---

## 9.4 Nginx Configuration

Located in `infra/nginx/`. Key routing rules:

```nginx
# API proxy
location /api/ {
    proxy_pass http://backend:5000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
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

Additional Nginx features:
- Gzip compression enabled
- Request buffering
- HTTPS termination (configure with your certs)
- Security headers

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

---

## 9.6 Monitoring Stack (Optional)

### Prometheus
- Scrapes `/api/metrics` endpoint
- Collects: cache hit rates, ERP latency, upstream failures, circuit state, concurrency

### Grafana
- Pre-configured dashboards for ERP performance
- Alert rules for circuit breaker activation, high error rates

### Loki + Promtail
- Log aggregation from backend JSON logs
- Searchable by request ID, page key, error code

---

## 9.7 Persistence Notes

- **No PostgreSQL required.** All persistent data uses SQLite files.
- Database files live in `Backend/data/`:
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
- The `Backend/data/` directory is mounted as a Docker volume
- **Backup strategy:** Backup `Backend/data/` directory regularly
- Discovery map (`endpoint-discovery.json`) is checked in; doesn't change at runtime

---

## 9.8 Deployment Checklist

```
□ Redis running and accessible
□ Backend environment variables configured
□ Discovery map present at Backend/data/endpoint-discovery.json
□ SQLite databases initialized (auto-created on first start)
□ Frontend built: cd Frontend && npm run build
□ Nginx configured with certs (if HTTPS)
□ Admin password changed from default (ADMIN_CONTENT_PASSWORD)
□ Rate limiting tuned for expected load
□ Circuit breaker thresholds reviewed
□ Log directory writable
□ Health check endpoint (/api/ready) returns 200
```

---

## 9.9 NPM Scripts Reference

### Backend
| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `node src/server.js` | Production start |
| `npm run dev` | `node src/server.js` | Development start |
| `npm test` | `node --test` | Run tests |
| `npm run discover:endpoints` | `node scripts/endpoint-discovery.js` | Run ERP endpoint discovery |
| `npm run fetch:endpoints` | `node scripts/fetch-discovered-endpoints.js` | Fetch all discovered endpoints |
| `npm run preprocess:endpoints` | `node scripts/preprocess-fetched-endpoints.js` | Type-annotate fetched data |
| `npm run analyze:ui-map` | `node scripts/analyze-erp-ui-map.js` | Analyze ERP UI structure |
| `npm run verify:integrity` | `node scripts/check-erp-integrity.js` | Verify system integrity |
| `npm run seed:external` | `node scripts/seed-external-pages.js` | Seed external page data |
| `npm run load:cached` | `k6 run load-tests/erp-cached.js` | Load test cached mode |
| `npm run load:live` | `k6 run load-tests/erp-live.js` | Load test live mode |
| `npm run load:mixed` | `k6 run load-tests/erp-mixed.js` | Load test mixed mode |

### Frontend
| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite` | Development server (hot reload) |
| `npm run build` | `tsc -b && vite build` | Production build |
| `npm run lint` | `eslint .` | Lint check |
| `npm run preview` | `vite preview` | Preview production build |

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
   different prefix, so an accidental `docker compose down` on
   the wrong host cannot delete the production data.
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

## Expected-downtime model (Gate 9 P2)

The platform runs on a single host in the current deployment. That
implies a brief restart window during image-tag rollouts and
security rotations. The expected-downtime budget:

- **Routine image-tag rollout:** 30–60s of 503s from the
  proxy. Frontend static assets are served by nginx directly; only
  the backend restarts. Drain and restart budget is enforced at 8s
  (PR 3 `fix(be): hard shutdown budget on SIGTERM`).
- **Planned secret rotation:** 5–15s, same single-host profile.
  See `infra/runbooks/secret-rotation.md`.
- **Emergency rollback (image tag):** 60–120s including cache
  warm-up. Procedure in `infra/runbooks/rollback.md`.
- **Unplanned outage (host failure):** Until the host is replaced
  or restarted, the platform is down. Mitigations: weekly
  `setup-backups.sh` runs + offsite `BACKUP_DEST` rsync + the
  02:00 cron entry in `infra/cron/backup.cron` (PR 8).

If the deployment grows beyond a single host, revisit this section:
the model changes materially when there's more than one backend
behind a load balancer (zero-downtime rolling restarts become
feasible, and the SHUTDOWN_BUDGET_MS hard deadline can be relaxed).

>>>>>>> 2d3b17a (chore(infra): staging env file, downtime model, ERP outage escalation (Gate 9))
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
