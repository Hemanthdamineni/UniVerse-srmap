# ERP Upstream Outage Runbook

## Trigger
- Live ERP scrape endpoints fail or exceed timeout budgets.

## Procedure
1. Verify surge in timeout/circuit metrics.
2. Enforce cached-first via flag/policy for all non-transactional routes.
3. Keep transactional live-first routes with reduced timeout and backpressure.
4. Monitor:
   - `erp_fetch_source_total{source="cache-fresh|cache-stale|dump"}`
   - `erp_circuit_open_state`
   - user-facing error rate

## Exit Criteria
- Upstream healthy for 30 minutes and circuit states closed.
- Restore normal policy set.
