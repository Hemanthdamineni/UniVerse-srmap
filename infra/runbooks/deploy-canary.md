# Canary Deployment Runbook

## Preconditions
- Prometheus and Grafana are healthy.
- Latest image tags are available for backend and frontend.
- Feature flags configured: `erp_v2_api`, `erp_cached_first`, `erp_prefetch`, `auth_cookie_mode`, `erp_distributed_lock`, `erp_error_envelope`.

## Procedure
1. Deploy new backend image to 5% app nodes.
2. Enable feature flags for 5% traffic.
3. Observe for 15 minutes:
   - `p95 < 1.5s` on cached pages
   - `5xx rate < 1%`
   - no sustained `erp_circuit_open_state`
4. Repeat for 25%, 50%, then 100%.
5. Run smoke checks for `/api/live`, `/api/ready`, `/api/v2/erp/page/dashboard`.

## Success Criteria
- No SLO breach for full promotion window.
- Cache hit ratio `>= 85%` on cached-first pages.
