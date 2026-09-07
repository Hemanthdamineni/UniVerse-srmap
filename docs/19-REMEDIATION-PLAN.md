# 19 — Remediation Plan

**Source of truth:** [18 — Complete System Audit](./18-COMPLETE-SYSTEM-AUDIT.md)  
**Principle:** Resolve security and deployment boundaries first, preserve working contracts where safe, and record evidence before changing a status.

| ID | Severity | Problem | Planned Fix | Files | Tests | Status |
|---|---|---|---|---|---|---|
| C-01 | Critical | Ingress Compose paths, network, TLS, ports, and certificate mounts are contradictory | Establish one root-relative ingress override, shared network, TLS mount/ports, and reproducible nginx/Compose checks | `docker-compose.yml`, `infra/docker/compose.ingress.yml`, `infra/nginx/*`, docs/CI | Compose render, nginx `-t`, smoke script | Fix now |
| C-02 | Critical | Entire `Backend/data` can be published | Separate public artifacts from private runtime data; remove broad alias; add authenticated/private delivery policy | ingress config, app/file routes, config, tests | Sensitive-file and traversal negative HTTP tests | Fix now |
| H-01 | High | Allowlist grants admin without elevation | Single elevated-admin predicate; remove fallback allowlist; preserve domain roles | admin middleware/auth/routes/stores/tests | role matrix including post-disable | Fix now |
| H-02 | High | Multer writes before auth/authorization | Gate before Multer, validate type/content, private storage, cleanup | competition routes/store/tests | unauth/unauthorized/MIME/oversize/cleanup tests | Fix now |
| H-03 | High | Spoofable forwarded IP and fail-open limiter | Trusted proxy handling plus local fallback | app/nginx/rate-limit/request-context/tests | spoofed header and Redis-failure tests | Fix now |
| H-04 | High | User errors trip shared ERP circuit; lock is unsafe | Classify failures, extend lock budget, atomic release | ERP aggregation/config/tests | multi-user circuit and lock release tests | Fix now |
| H-05 | High | Public telemetry makes unbounded metric labels | Strict schema, bounded allowlists, session-aware ingest | telemetry/feedback service/tests | cardinality/adversarial payload tests | Fix now |
| H-06 | High | Analytics accepts unlimited anonymous growth | Event schema, actor limits, retention/pruning and monitoring | analytics route/store/config/tests/docs | allowlist/rate/retention tests | Fix now |
| H-07 | High | Health masks failed dependencies | Correct readiness semantics, Redis reconnect, orchestration probe | health/session/Compose/tests | Redis/SQLite healthy and failure tests | Fix now |
| M-01 | Medium | Upload-size mismatch at edge/API/UI | Single configured 25 MiB limit at nginx, backend, frontend copy | nginx/config/UI/tests | configuration and upload boundary tests | Fix now (with H-02) |
| M-02 | Medium | Distributed-lock race and TTL mismatch | Included with H-04 | ERP aggregation/config/tests | atomic-release/expiry tests | Fix now (with H-04) |
| M-03 | Medium | Detailed health and metrics public | Keep public liveness minimal; restrict detailed readiness/metrics at ingress | health/metrics/nginx/docs | public-vs-internal route tests | Fix now |
| M-04 | Medium | Synchronous request-path debug write | Remove debug write | hostel buddy route/test | route regression test | Fix now |
| M-05 | Medium | ERP sink errors swallowed | Structured error logging/metric and freshness signal | server/aggregation/observability/tests | sink-failure regression | Fix now |
| M-06 | Medium | JSON-blob event/helpdesk stores do not scale across writers | Document single-writer scope and introduce optimistic versioning only where feasible | stores/docs | concurrent-write tests | Requires architectural decision |
| M-07 | Medium | Tests leave SQLite files in repo data | Use OS temporary dirs and cleanup hooks | affected tests | clean-workspace test assertion | Fix now |
| M-08 | Medium | Fabricated admin UI data | Hide/label unavailable screens rather than invent backends | admin routes/pages/tests | route/UI tests | Fix now |
| M-09 | Medium | Orphan academic routes/breadcrumb | Remove unreachable route-map entries; repair breadcrumb target | frontend routes/navigation/tests | route reachability tests | Fix now |
| M-10 | Medium | E2E CI count/profile mismatch | Make CI run intended profiles and remove stale count claim | CI/config/docs | workflow syntax/config check | Fix later |
| M-11 | Medium | Oversized frontend bundles/assets | Establish budgets and lazy-load only measured heavy consumers | frontend assets/imports/CI | before/after build stats | Fix later |
| M-12 | Medium | Audit/Knip checks non-blocking | Make security gate policy explicit after advisory access is available; baseline Knip | CI/config | CI command dry run | Fix later |
| L-01 | Low | Dead files/dependencies/exports | Remove only individually confirmed items; tune Knip entries | frontend/config | lint/test/Knip | Fix later |
| L-02 | Low | Oversized files | Split only when changing their ownership boundaries | selected services/pages | focused tests | Fix later |
| L-03 | Low | Unsafe TS casts | Add schemas at external boundaries incrementally | selected API adapters | type/test coverage | Fix later |
| L-04 | Low | Analytics docs stale | Update alongside H-06 implementation | docs | doc review | Fix now (with H-06) |
| L-05 | Low | Non-constant-time shared password check | Use timing-safe comparison while shared password remains | admin helper/tests | comparison tests | Fix now |
| L-06 | Low | Generic fallback user identity | Reject missing identity for state changes; preserve unknown reads | events auth/tests | identity regression tests | Fix later |
| L-07 | Low | Local stale Infra.zip | Do not modify ignored developer-local artifacts from this remediation; document artifact policy | `.gitignore`, docs | N/A | Won't fix — ignored local state is outside versioned product behavior |

## Phase gates

1. **Phase 0:** C-01, C-02, H-01–H-07, M-01–M-05, M-07–M-09, L-04–L-05. No lower-priority deletion or optimization before their focused tests pass.
2. **Phase 1:** Resolve selected CI, maintainability, persistence, and performance work only after an implementation decision is recorded.
3. **Final:** Re-run relevant checks, re-audit every row against evidence, synchronize documentation, and publish `docs/20-POST-REMEDIATION-AUDIT.md` with only evidence-backed statuses.
