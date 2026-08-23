# Production Readiness Checklist

> **Created:** 2026-08-22 · **Supersedes:** the release-checklist section of [`TODO.md`](../TODO.md) (2026-07-21), whose claims were re-audited against the codebase on this date.
> **Companion docs:** [`infra/runbooks/companion-platform-production-readiness.md`](../infra/runbooks/companion-platform-production-readiness.md) (companion-module gate), [`infra/runbooks/`](../infra/runbooks/) (ops procedures), [`12-SYSTEM-AUDIT-REPORT.md`](./12-SYSTEM-AUDIT-REPORT.md).

**How to read this:** every item was verified against the current code on 2026-08-22 — not copied forward blindly. ✅ = done and verified. ☐ = open. Priorities: **P0** blocks go-live, **P1** should land before first real users, **P2** acceptable shortly after.

---

## Definition of Done ("prod ready")

This project is prod-ready when:

1. Every **P0** below is closed.
2. A backup has been **restored successfully at least once** using the existing runbook.
3. Alerts fire into a channel a human actually reads.
4. The full CI pipeline (including E2E) is green on `main`.
5. One soak period in a staging-like environment completes without 5xx errors.

---

## 1. Security

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | Helmet security headers applied | `Backend/src/app.js:71` |
| ✅ | — | Redis requires password, bound to `127.0.0.1` | root `docker-compose.yml` |
| ✅ | — | Grafana creds via env vars; compose fails if unset | `GRAFANA_ADMIN_PASSWORD:?` pattern |
| ✅ | — | Admin password held in-memory only on client (not sessionStorage) | per TODO.md fix |
| ✅ | — | `x-user-role` / `x-user-id` header spoofing removed | grep: no matches in `Backend/src` |
| ✅ | — | `adminPassword` no longer accepted via URL query param | grep: no matches |
| ✅ | — | Admin elevation requires session flag (`isElevated = Boolean(session.adminElevated)`), register-number auto-elevation removed | `Backend/src/middleware/adminContext.js:20` |
| ☐ | **P0** | **CSRF protection for state-changing routes under cookie-mode auth.** `SameSite=lax` mitigates but does not replace tokens for POST/PUT/DELETE. Only reference to CSRF in app code is a doc comment. | `Backend/src/app.js`, middleware/ |
| ☐ | P1 | Per-route rate limits: login/captcha/recovery endpoints need stricter budgets than the global 400 req/min | `Backend/src/middleware/`, `.env.example` `RATE_LIMIT_*` |
| ☐ | P1 | `SESSION_COOKIE_SECURE=auto` verified to resolve `true` behind nginx TLS termination (check `X-Forwarded-Proto` handling) | `Backend/src/config/env.js` |
| ☐ | P1 | Automated dependency auditing in CI (`npm audit --omit=dev` job or Dependabot); currently manual only | `.github/workflows/ci.yml` |
| ☐ | P1 | LMS upload hardening review: content-type allowlist + size caps confirmed server-side (25 MB/file, 200 MB/user exist — confirm MIME validation) | `LMS_UPLOAD_MAX_BYTES`, career/LMS upload routes |
| ☐ | P1 | **PII scrubbing in logs:** login diagnostics persist raw HTML artifacts of login attempts (student-identifying). Confirm `LOGIN_DIAGNOSTICS_MAX_ARTIFACTS` retention + `ERP_ARTIFACT_MAX_AGE_DAYS=14` cleanup actually runs in production, and logs never contain passwords/session ids | `LOGIN_DIAGNOSTICS_*`, `utils/logger` |
| ☐ | P2 | Secret rotation plan (REDIS_PASSWORD, ADMIN_CONTENT_PASSWORD) documented; confirm no `.env` ever committed (gitignore check) | `.gitignore`, `infra/scripts/` |

## 2. Data Integrity & Backups

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | WAL mode enabled on all major stores (lmsStore, eventsStore, competitionStore, careerStore, careerServices, unifiedProfileStore) — July TODO claim of "3 stores missing WAL" is now stale/fixed | `PRAGMA journal_mode = WAL` greps |
| ☐ | **P0** | **Schedule backups.** `infra/scripts/setup-backups.sh` works but only *prints* crontab instructions — nothing is scheduled anywhere. Install a cron entry or systemd timer on the host. | `infra/scripts/setup-backups.sh:189` |
| ☐ | **P0** | **Restore drill.** Execute `infra/runbooks/backup-restore.md` end-to-end against a scratch directory once; record result in the runbook. | `infra/runbooks/backup-restore.md` |
| ☐ | P1 | Offsite copy of `Backend/data` (12 SQLite DBs + events/lms/uploads dirs). Local-volume-only backups die with the host. | — |
| ☐ | P1 | Decide + document whether monitoring data (Prometheus/Grafana/Loki volumes) is backed up or explicitly expendable | `infra/docker/compose.monitoring.yml` |
| ☐ | P1 | SQLite schema-migration story for 12 DBs (how do schema changes ship to an existing volume without data loss?) | `services/*/migrations`, `13-DATABASE-SCHEMAS.md` |
| ☐ | P2 | Backup success/failure alerting (a silent backup failure is worse than none) | ties into §5 Alertmanager |

## 3. Deployment & Environments

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | Health checks on backend (`/api/health`) + Redis; restart policies; memory limits/reservations | root `docker-compose.yml` |
| ☐ | **P0** | **Staging/prod separation.** Single `.env` today. At minimum: second env file + second data volume, and a written rule that staging never touches prod ERP credentials/data paths. | `.env.example` |
| ☐ | **P0** | **Parameterize `DUMP_SNAPSHOT_DIR`/`DUMP_SUMMARY_FILE`.** Compose hardcodes a dated snapshot path (`erp-dump/2026-02-24T…`). First re-dump breaks this silently. Derive from latest dump or make it an env var. | root `docker-compose.yml` |
| ☐ | P1 | Image tagging strategy: tag images by git SHA instead of implicit `:latest`; keep last-known-good for one-click rollback | `Backend/Dockerfile`, CI |
| ☐ | P1 | Decide + document prod frontend serving path (nginx static hosting vs Vite preview vs backend-served SPA) — currently implied but not written down | `infra/nginx/` |
| ☐ | P1 | Graceful-shutdown verification: SIGTERM drains in-flight Playwright ERP scrapes and closes SQLite handles cleanly before exit | `Backend/src/server.js` |
| ☐ | P1 | Rehearse `rollback.md` once against a real previous image; fix whatever the rehearsal exposes | `infra/runbooks/rollback.md` |
| ☐ | P2 | Document expected-downtime model (this stack is single-host; zero-downtime deploys are out of scope unless stated) | `09-INFRASTRUCTURE.md` |
| ☐ | P2 | `ADMIN_CONTENT_PASSWORD` empty-default footgun: compose defaults it to empty, backend treats empty as "admin disabled". Make compose fail-fast like REDIS_PASSWORD, or document the intentional disable. | root `docker-compose.yml`, `Backend/.env.example` |

## 4. Observability & Alerting

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | Prometheus + Grafana + Loki + promtail + node-exporter + cAdvisor stack exists (compose override), ports localhost-bound | `infra/docker/compose.monitoring.yml`, `infra/monitoring/` |
| ☐ | **P0** | **Alertmanager.** Prometheus alert rules exist but fire into a vacuum — no Alertmanager service, no notification channel (email/Slack/webhook). This has been open since July. | `infra/monitoring/prometheus/`, no alertmanager dir in `infra/` |
| ☐ | **P0** | **Missing alert rules:** disk space, memory pressure, CPU saturation, container down, TLS certificate expiry | `infra/monitoring/prometheus/rules*` |
| ☐ | P1 | Log retention/rotation for Loki + `Backend/logs/backend.log` (unbounded log growth on a small host) | `infra/monitoring/loki/`, `LOG_DIR` |
| ☐ | P1 | `/api/health` vs `/api/ready` semantics documented; compose healthcheck uses health — confirm ready-gate is what deploy tooling should await | `routes/*health*`, compose |
| ☐ | P1 | Grafana dashboards provisioned-as-code (dashboards survive host rebuild) rather than hand-built | `infra/monitoring/grafana/` |
| ☐ | P2 | External uptime probe (even a free one) — internal monitoring can't see a dead host | optional |

## 5. CI/CD

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | Backend tests (131), frontend tests (129), ESLint, metadata audit, API-contract audit, frontend build — all in CI | `.github/workflows/ci.yml` |
| ☐ | **P0** | **E2E in CI.** 11 Playwright specs exist but run manually only. Add a CI job (Playwright docker image, start compose, run `npm run test:e2e`). Open since July. | `Frontend/e2e/`, ci.yml |
| ☐ | P1 | Build/push backend Docker image in CI (validates Dockerfile on every change, produces the tagged artifact §3 needs) | ci.yml |
| ☐ | P1 | `npm audit` step (see §1) | ci.yml |
| ☐ | P1 | Coverage visibility: FE coverage config only tracks CareerPortal modules — either widen or state why | `Frontend/vitest.config` / coverage config |
| ☐ | P2 | knip (`npm run knip`) added to CI to catch dead exports | root `package.json` |

## 6. Testing Gaps

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ☐ | P1 | HTTP-level integration tests for route handlers (ERP routes, admin, LMS store direct) — supertest or equivalent; current BE tests are mostly service-level | `Backend/test/` |
| ☐ | P1 | **Contract tests against committed ERP dumps** — locks transformer behavior against real payload shapes and catches upstream ERP drift (explicit recommendation in `12-SYSTEM-AUDIT-REPORT.md`) | `scripts/dump:erp`, extractors tests |
| ☐ | P1 | E2E coverage additions: auth/login flow, mobile viewports, visual regression baseline | `Frontend/e2e/` |
| ☐ | P2 | Define load-test pass thresholds (p95 latency, error rate) for the three k6 scenarios so "load test passes" means something | `Backend/load-tests/` |
| ☐ | P2 | Password-recovery flow covered by automated tests (flow recently overhauled) | recent auth commits |

## 7. API Contract Drift

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ☐ | P1 | Resolve the 19 documented backend/frontend type mismatches (event dates, location, profile response, …) | `07-API-REFERENCE.md` vs types |
| ☐ | P1 | Unify Events response envelope (`{ success, data }`) with the standard `sendApiSuccess` used everywhere else | `Backend/src/routes/events*`, `utils/apiResponse` |
| ✅ | — | Drift is *detected*: `audit:api-contracts` runs in CI — remaining work is fixing what it reports | ci.yml |

## 8. Code Quality Gates

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ☐ | P2 | Split god files: 27 files >500 LOC, largest `lmsStore.js` (~2725 lines). Not a launch blocker, but set a "no new god files" rule now | `implementation_plan.md`, AGENTS.md rule |
| ☐ | P2 | Backend linting (ESLint) — CI lints frontend only | ci.yml |
| ✅ | — | `tsc --noEmit` clean (included in `npm run build`, which CI runs) | ci.yml frontend-build job |

## 9. Documentation & Runbooks

| Status | Pri | Item | Evidence / Where |
|---|---|---|---|
| ✅ | — | Root README exists with architecture, scripts, docs index (July TODO item now stale) | `README.md` |
| ☐ | P1 | Prune stale items from `TODO.md` (README-done, WAL-done, fixed security vectors) or replace its checklist section with a pointer to this doc | `TODO.md` |
| ☐ | P1 | Validate ops runbooks against current compose reality: `deploy-canary.md`, `redis-failover.md`, `upstream-erp-outage.md` predate some renames (e.g. `app-backend` → `backend` service name) | `infra/runbooks/` |
| ☐ | P1 | Write the "who does what when ERP breaks" escalation note (single-maintainer project still needs the decision recorded) | new short doc or `09-INFRASTRUCTURE.md` |

---

## Go-Live Gate (final sign-off)

Work top-to-bottom; do not sign off with an unchecked box above it:

- [ ] All **P0** items in §§1–5 checked
- [ ] Backup restore drill executed and recorded (§2)
- [ ] Alertmanager delivering to a monitored channel; test alert fired and received (§4)
- [ ] Full CI green including E2E on `main` (§5)
- [ ] Staging soak: ≥3 days, zero unexplained 5xx, ERP circuit breaker observed recovering naturally (§3 + `upstream-erp-outage.md`)
- [ ] Rollback rehearsed within the last 30 days (§3)
- [ ] Sign-off recorded here: `_date_ · _name_`

## Verification Quick Reference

```bash
# Tests & audits
cd Backend  && npm test && npm run smoke:companion
cd Frontend && npm test && npx eslint . && npm run audit:api-contracts && npm run build

# E2E (target state: also runs in CI)
cd Frontend && npm run test:e2e

# Container stack + monitoring
docker compose up -d --build
docker compose -f docker-compose.yml -f infra/docker/compose.monitoring.yml up -d

# Backups (target state: scheduled, not manual)
bash infra/scripts/setup-backups.sh
```
