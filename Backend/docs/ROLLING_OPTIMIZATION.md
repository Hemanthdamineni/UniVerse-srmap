# ERP Optimization Rollout

## Feature Flags
- `FEATURE_ERP_V2_API` (default `1`)
- `FEATURE_ERP_CACHED_FIRST` (default `1`)
- `FEATURE_AUTH_COOKIE_MODE` (default `1`)
- Frontend prefetch: `VITE_ERP_PREFETCH` (default `1`)

## Canary Sequence
1. Enable flags for 5% traffic.
2. Observe:
   - `erp_http_request_duration_seconds`
   - `erp_http_requests_total`
   - `erp_cache_result_total`
   - `erp_fetch_source_total`
   - `erp_upstream_failures_total`
3. Promote to 25%, 50%, then 100% only if:
   - `p95 < 1.5s` on cached pages
   - `error rate < 1%`
   - no sustained circuit-open spikes

## Rollback
1. Set `FEATURE_ERP_V2_API=0` to disable v2 endpoints.
2. Set `FEATURE_ERP_CACHED_FIRST=0` to force live-first behavior.
3. Set `FEATURE_AUTH_COOKIE_MODE=0` to rely only on legacy `sessionId` flow.

## Recovery Targets
- Target RTO: 5 minutes
- Target RPO: 1 minute

Operationally this requires managed Redis persistence plus regular SQLite/filesystem backups in production.
