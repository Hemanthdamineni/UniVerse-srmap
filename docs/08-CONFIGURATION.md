# 08 — Configuration Reference

## 8.1 Environment Variables

All variables are defined in `Backend/src/config/env.js`. Every variable has a default value and works without explicit configuration.

### Core Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | `development` | Runtime environment |

### ERP Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `SRM_BASE_ORIGIN` | `https://student.srmap.edu.in` | ERP base URL origin |
| `SRM_BASE_PATH` | `/srmapstudentcorner` | ERP base path |

Derived:
- `LOGIN_URL` = `${BASE_ORIGIN}${BASE_PATH}/StudentLoginPage`
- `LOGIN_POST_URL` = `${BASE_ORIGIN}${BASE_PATH}/StudentLoginToPortal`

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level (`debug`, `info`, `warn`, `error`) |
| `LOG_DIR` | `Backend/logs` | Log file directory |
| `LOG_FILE_NAME` | `backend.log` | Log file name |
| `LOGIN_DIAGNOSTICS_DIR` | `Backend/logs/login-attempts` | Login attempt artifact directory |
| `LOGIN_DIAGNOSTICS_MAX_ARTIFACTS` | `20` | Max stored login diagnostics |
| `LOGIN_DIAGNOSTICS_MAX_HTML_CHARS` | `6000` | Max HTML chars per diagnostic |

### Session Management

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_TTL_MS` | `1800000` (30 min) | Session Time-To-Live |
| `SESSION_COOKIE_NAME` | `erp_session` | Cookie name |
| `SESSION_COOKIE_SECURE` | `auto` | Secure flag: `true`, `false`, or `auto` (detects HTTPS) |
| `SESSION_COOKIE_SAME_SITE` | `lax` | SameSite: `strict`, `lax`, `none` |
| `SESSION_STORE_DRIVER` | `auto` | Session backend: `redis`, `memory`, `auto` |
| `LOGIN_PREAUTH_TTL_MS` | `15000` (15 sec) | Captcha validity window |
| `LEGACY_SESSION_ID_CUTOFF_DATE` | `2026-05-15T00:00:00.000Z` | After this date, only cookie-based sessions accepted |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `""` | Redis connection URL (e.g., `redis://localhost:6379`) |
| `REDIS_SENTINEL_URLS` | `""` | Comma-separated sentinel endpoints (`host1:port1,host2:port2`) |
| `REDIS_SENTINEL_MASTER_NAME` | `mymaster` | Sentinel master name |
| `REDIS_PASSWORD` | `""` | Redis authentication password |

### ERP Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `ERP_CACHE_DRIVER` | `auto` | Cache backend: `redis`, `memory`, `auto` |
| `ERP_CACHE_FRESH_TTL_MS` | `60000` (1 min) | Duration data is considered "fresh" (returned immediately) |
| `ERP_CACHE_STALE_TTL_MS` | `600000` (10 min) | Duration data is considered "stale" (returned with background refresh) |
| `ERP_CACHED_TIMEOUT_MS` | `6000` (6 sec) | Timeout for cached-first mode live fallback |
| `ERP_LIVE_TIMEOUT_MS` | `15000` (15 sec) | Timeout for live-first mode requests |

### Concurrency & Circuit Breaker

| Variable | Default | Description |
|----------|---------|-------------|
| `ERP_UPSTREAM_MAX_CONCURRENCY` | `30` | Max simultaneous ERP requests (semaphore limit) |
| `ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS` | `1500` | Max wait for semaphore slot |
| `ERP_CIRCUIT_FAILURE_THRESHOLD` | `5` | Failures before circuit opens |
| `ERP_CIRCUIT_COOLDOWN_MS` | `30000` (30 sec) | Circuit open duration |
| `ERP_CIRCUIT_REDIS_TTL_MS` | `300000` (5 min) | Redis TTL for circuit state |
| `ERP_DISTRIBUTED_LOCK_TTL_MS` | `12000` (12 sec) | Distributed lock expiration |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` (1 min) | Sliding window duration |
| `RATE_LIMIT_MAX` | `400` | Max requests per IP per window |
| `RATE_LIMIT_REDIS_PREFIX` | `ratelimit` | Redis key prefix |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_ERP_V2_API` | `1` | Enable V2 ERP routes (schema, batch, UI hints) |
| `FEATURE_ERP_CACHED_FIRST` | `1` | Enable cache-first strategy (if `0`, always live-first) |
| `FEATURE_ERP_PREFETCH` | `1` | Enable background prefetching |
| `FEATURE_AUTH_COOKIE_MODE` | `1` | Enable httpOnly session cookies |
| `FEATURE_ERP_DISTRIBUTED_LOCK` | `1` | Enable Redis-based distributed locks |
| `FEATURE_ERP_ERROR_ENVELOPE` | `1` | Return structured error objects (vs plain string errors) |
| `FEATURE_FRONTEND_PERF_TELEMETRY` | `1` | Accept frontend performance telemetry |

### Data Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTENT_DB_PATH` | `Backend/data/content.sqlite` | Unified content SQLite database |
| `EXTERNAL_DB_PATH` | `Backend/data/external-pages.sqlite` | External pages SQLite database |
| `EVENTS_DB_PATH` | `Backend/data/events.sqlite` | Events SQLite database |
| `EVENTS_DATA_DIR` | `Backend/data/events` | Events filesystem storage |
| `ERP_UI_MAP_FILE` | `""` | ERP UI mapping file (optional) |
| `ERP_PAGE_POLICY_FILE` | `Backend/src/config/erp-page-policy.json` | Page policy config |
| `FRONTEND_BLUEPRINT_FILE` | `Frontend/src/config/erpBlueprints.ts` | Frontend blueprint file (for integrity checks) |
| `ADMIN_CONTENT_PASSWORD` | `asdfghjkl;'` | Content admin password |
| `ERP_ARTIFACT_MAX_AGE_DAYS` | `14` | Max age for ERP dump artifacts |
| `DUMP_SNAPSHOT_DIR` | — | Path to ERP dump snapshot directory |
| `DUMP_SUMMARY_FILE` | — | Path to ERP dump summary file |

---

## 8.2 Page Policy Configuration

**File:** `Backend/src/config/erp-page-policy.json`

This file controls whether each ERP page uses **cached-first** or **live-first** strategy. It is **hot-reloaded** (checked every second for file changes).

### Structure
```json
{
  "defaultMode": "cached-first",
  "cachedFirstPrefixes": ["dashboard", "academic/attendance-details", ...],
  "liveFirstPrefixes": ["finance/payment-acknowledgment", ...],
  "overrides": {
    "finance/fee-paid-details": "live-first",
    "academic/time-table": "cached-first"
  }
}
```

### Resolution Order
1. Explicit `mode` query parameter override from request
2. `overrides` — exact pageKey match
3. `liveFirstPrefixes` — prefix match
4. `cachedFirstPrefixes` — prefix match
5. `defaultMode` — fallback

### Current Policy (as configured)

**Cached-First** (serve stale data while refreshing):
- `dashboard`, `academic/attendance-details`, `academic/time-table`
- `examination/current-semester-results`, `examination/earlier-internal-marks`
- `examination/exam-mark-details`, `finance/fee-due-details`
- `academic/student-attendance`

**Live-First** (fetch from ERP first):
- `finance/fee-paid-details`, `finance/fee-paid`
- `finance/payment-acknowledgment`, `finance/online-payment-verification`
- `examination/exam-registration`, `examination/exam-registration-details`
- `academic/course-registration`, `academic/course-registration-cancellation`

**Rationale:** Financial and registration pages need real-time data. Academic/viewing pages benefit from instant cache response.

---

## 8.3 Payload Contracts

**File:** `Backend/src/config/erpPayloadContracts.js`

Defines data quality expectations per page:

| Page Pattern | Min Tables | Suspicious Text Rejected | Text Fallback Allowed |
|-------------|------------|--------------------------|----------------------|
| `dashboard` | 1 | Yes | Yes |
| `academic/time-table` | 1 | Yes | Yes |
| `academic/attendance-details` | 1 | Yes | Yes |
| `examination/*` results/marks | 1 | Yes | No |
| `finance/*` | 1 | Yes | No |
| `profile` | Special | — | — |
| Default (all others) | 0 | Yes | No |

---

## 8.4 Docker Compose Configuration

**File:** `docker-compose.yml` (root)

```yaml
services:
  backend:
    build: ./Backend
    ports: ["5000:5000"]
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379
      SESSION_STORE_DRIVER: auto
      ERP_CACHE_DRIVER: auto
      FEATURE_ERP_V2_API: 1
      FEATURE_ERP_CACHED_FIRST: 1
      FEATURE_AUTH_COOKIE_MODE: 1
      CONTENT_DB_PATH: /app/data/content.sqlite
      EXTERNAL_DB_PATH: /app/data/external-pages.sqlite
      EVENTS_DB_PATH: /app/data/events.sqlite
    volumes: ["./Backend/data:/app/data"]
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: ["redis-server", "--appendonly", "yes"]
    volumes: [redis_data:/data]
```

---

## 8.5 Vite Dev Configuration

**File:** `Frontend/vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { proxy: { '/api': 'http://localhost:5000' } },
});
```

The dev proxy ensures frontend `fetch("/api/...")` calls are forwarded to the backend running on port 5000.
