# 20 — Post-Remediation Audit

**Scope:** Approved Phase 0 remediation from [19](./19-REMEDIATION-PLAN.md), verified 2026-08-31.

| Finding | Status | Evidence |
|---|---|---|
| C-01 ingress topology | Resolved | Root-relative merged Compose override, shared Compose network, published TLS ports, bootstrap certificate path; `docker compose ... config` and containerized `nginx -t` pass. Production certificate provisioning still requires operator-supplied certs. |
| C-02 public data exposure | Resolved | No runtime-data static mount or nginx data alias remains; `/files/` returns 404. Scoped competition download routes authorize before delivery. HTTP negative test passes. |
| H-01 admin bypass | Resolved | Empty allowlist fails closed; elevated session is required for admin role. Elevation/disable regressions and full backend suite pass. |
| H-02 upload-before-auth | Resolved | Authentication and event authorization precede Multer; MIME/magic validation, generated extensions, quotas, cleanup, and private API delivery are in place. Anonymous multipart regression passes. |
| H-03 forwarded-IP limiter | Resolved | nginx overwrites forwarding address; Express uses one trusted hop; logging and both rate limiters use `req.ip`, with in-memory fallback on Redis errors. Focused tests pass. |
| H-04 ERP circuit/lock | Resolved | Only availability-class failures trip the page-level upstream circuit; lock TTL exceeds operation budget and release uses Redis compare-and-delete. Requires production Redis verification. |
| H-05 telemetry cardinality | Resolved | Ingest requires an authenticated session and maps metrics to fixed route/kind/vital allowlists with bounded values. |
| H-06 analytics growth | Resolved | Ingest requires an actor, uses an event registry and per-actor hourly budget, and prunes rows older than 90 days. Store regression covers actor, allowlist, quota, and retention. |
| H-07 readiness correctness | Partially resolved | Docker probes `/api/ready`; configured Redis is required for readiness and connection initialization retries; public health is minimal. Store-level readiness/freshness checks remain a production-runtime verification item. |

## Verification

- Backend: `npm test` — **246 passed**.
- Frontend: `npm test` — **1,189 passed**; `npm run lint`; `npm run build`; API-contract and metadata audits passed.
- Responsive audit passed against a local Vite server.
- Ingress: merged Compose render and containerized `nginx -t` passed (self-signed test certificate produces the expected OCSP-stapling warning).

## Production blockers

Production rollout remains conditional on target-environment verification of H-07: configured Redis and each mandatory SQLite store must report ready. Operators must also provide the real TLS certificate under the documented mount and verify ingress behavior with that certificate.
