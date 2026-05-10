# Redis Recovery Runbook

## Trigger
- Redis unavailable, high latency, or persistent connection failures from backend.

## Procedure
1. Verify Redis process/container health:
   - `docker ps | grep redis`
   - `redis-cli -h <redis-host> -p 6379 PING`
2. Check persistence health:
   - `redis-cli -h <redis-host> -p 6379 INFO persistence`
3. If unhealthy, restart Redis service/container and confirm readiness.
4. Validate backend recovery:
   - `/api/ready` returns `ok: true`
   - login/session path works
   - ERP cached-first requests recover (`cache-*` or `live` source)

## Validation
- No auth/session outage beyond RTO target.
- No sustained spike in `erp_upstream_failures_total` caused by cache/session unavailability.
