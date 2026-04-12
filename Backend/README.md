# University ERP Backend

Node/Express API for University ERP with cached/live aggregation and config-driven mappings.

## Core API
- `GET /api/health`
- `GET /api/live`
- `GET /api/ready`
- `GET /api/metrics` (Prometheus)
- `POST /api/telemetry/frontend`
- `GET /api/captcha`
- `POST /api/login`
- `GET /api/profile`

## ERP V2 API
- `GET /api/v2/erp/page/:pageKey`
- `GET /api/v2/erp/page/:category/:page`
- `POST /api/v2/erp/batch`
- `GET /api/v2/erp/ui/:pageKey`
- `GET /api/v2/erp/ui/:category/:page`
- `GET /api/v2/erp/schema/:pageKey`
- `GET /api/v2/erp/schema/:category/:page`
- `POST /api/v2/erp/action/execute`

Response contract:
- `success`
- `pageKey`
- `source` (`live | cache-fresh | cache-stale | dump`)
- `fetchedAt`
- `staleAt`
- `policyMode`
- `data`
- `warnings`

Error contract:
- `success: false`
- `error.code`
- `error.message`
- `error.retryable`
- `requestId`

ERP schema contract (`/api/v2/erp/schema/*`):
- `success`
- `pageKey`
- `schemaVersion`
- `blocks[]` (`stats | card | form | table | list`)
- `capabilities.blockCount` and per-block-type counts
- `warnings`

## Compatibility Endpoints
- `GET /api/scrape/:pageKey`
- `GET /api/scrape/:category/:page`

These routes now delegate through the V2 aggregation service.

## Sessions
- Primary mode: HTTP-only session cookie (`erp_session` by default)
- Compatibility: `sessionId` query/body/header still works

## Runtime Features
- Policy-driven ERP mode (`cached-first` / `live-first`) via:
  - `src/config/erp-page-policy.json`
- Single-flight request coalescing
- Stale-while-revalidate cache behavior
- Upstream timeout + concurrency caps + simple circuit breaker
- Redis-backed distributed coalescing lock for live ERP calls
- Compression + Helmet + rate limiting
- Request IDs and structured logs

## Configuration Highlights
- `REDIS_URL`
- `LOG_LEVEL=debug|info|warn|error`
- `LOG_DIR`
- `LOG_FILE_NAME`
- `SESSION_STORE_DRIVER=auto|memory|redis`
- `ERP_CACHE_DRIVER=auto|memory|redis`
- `ERP_PAGE_POLICY_FILE`
- `ERP_UI_MAP_FILE` (optional; only for UI/schema/action mapping features)
- `EVENTS_DB_PATH`
- `FEATURE_ERP_V2_API`
- `FEATURE_ERP_CACHED_FIRST`
- `FEATURE_AUTH_COOKIE_MODE`
- `FEATURE_ERP_DISTRIBUTED_LOCK`
- `FEATURE_ERP_ERROR_ENVELOPE`
- `LEGACY_SESSION_ID_CUTOFF_DATE`
- `REDIS_SENTINEL_URLS`
- `REDIS_SENTINEL_MASTER_NAME`

## Run
```bash
cd Backend
npm install
npm run dev
```

## Load Tests (k6)
```bash
cd Backend
npm run load:cached
npm run load:live
npm run load:mixed
```

Optional envs:
- `BASE_URL=http://localhost:5000`
- `SESSION_ID=<valid-session-id>`

## Docker (local)
```bash
docker compose up --build
```

Services:
- `backend` (port 5000)
- `redis` (port 6379)

Persistent data:
- `Backend/data/content.sqlite`
- `Backend/data/external-pages.sqlite`
- `Backend/data/events.sqlite`
- log files under `Backend/logs` by default
