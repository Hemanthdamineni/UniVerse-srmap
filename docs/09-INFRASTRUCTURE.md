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
