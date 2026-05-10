# Emergency Rollback Runbook

## Trigger
- Sustained SLO breach for >= 10 minutes.

## Procedure
1. Disable feature flags:
   - `erp_distributed_lock=0`
   - `erp_error_envelope=0` (if needed for client compatibility)
2. Route traffic back to previous stable backend image.
3. Keep compatibility shim endpoints (`/api/scrape/*`, `/api/dump/*`) active.
4. Validate health and key user journeys.

## Post-Rollback
- Capture incident timeline.
- Export Grafana dashboard and relevant Loki logs.
- Open corrective action task list.
