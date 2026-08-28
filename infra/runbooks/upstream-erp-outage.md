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

## Escalation: who decides "cached-first for how long?"

When the upstream ERP (student.srmap.edu.in) is degraded, the platform
can serve users from cache for an extended period — but the decision
of "how long is too long" is not a technical one. Cached data can be
hours or days stale; certain user-visible flows (payment status,
registration, marks) demand fresher data than the cache can provide.

The decision tree is:

1. **First 15 minutes:** no action needed — the in-memory cache and
   dump fallback handle short outages automatically. Watch
   `erp_circuit_open_state` and `erp_fetch_source_total`.
2. **15 to 60 minutes:** engineering on call can switch policy to
   cached-first globally if the upstream is clearly down (not just
   slow). This is documented in the `erpActions.js` policy store;
   flip the override via a config push, no code change.
3. **Beyond 60 minutes:** requires a human decision. Engineering
   escalates to the platform owner (Hemanth Damineni — see
   `AGENTS.md` and `CODEOWNERS` for current ownership). The
   decision is whether to (a) keep serving cached data and risk
   user-visible staleness, (b) take the platform offline to avoid
   misleading users, or (c) rate-limit the cache fallback and
   surface an "ERP is slow" banner to the UI.

The runbooks do NOT make this decision automatically because the
right answer depends on factors outside the platform (time of
semester, exam season, current ERP incident status).
