# University ERP Companion Platform — Release Checklist

> Current date: 2026-07-21
> Status: **Release-hardening phase** — all feature work is complete. Focus is on verification, security, and deployment readiness.

---

## ✅ Verified Passing

- **Backend**: 131/131 tests
- **Frontend**: 129/129 tests
- **Production build**: `npm run build` succeeds
- **ESLint**: passes
- **API contract audit**: passes
- **npm audit**: passes
- **TypeScript**: `tsc --noEmit` compiles clean

---

## 🟢 Release Checklist

### 1. Production Assets & Build Integrity

- [x] **Header logo** — Fixed: now imports via Vite asset import instead of raw path
- [x] **Sidebar icons** — Fixed: moved from `src/assets/Icons/` to `public/assets/icons/`, all paths updated from `/src/assets/Icons/` to `/assets/icons/`
- [x] **Unused assets** — `Captcha.png`, `ERP Assets.svg`, `ERP Brand Assets.svg`, `Gemini_Generated_Image_*.png`, `Academics.png`, `Back.png`, `DropdownIcon.png`, `Front.png`, `LightDarkToogle.png`, `Separator.png` not referenced in source — candidates for cleanup

### 2. Security Gaps

- [x] **Grafana credentials** — Hardcoded `admin/admin` replaced with env var references (`GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`). Compose fails at startup if unset.
- [x] **Redis authentication** — `--requirepass` added. Port bound to `127.0.0.1` only. Password required via `REDIS_PASSWORD` env var.
- [x] **Admin password in sessionStorage** — Removed. Password now held in React ref (in-memory only) after unlock, never persisted. `getAdminHeaders()` requires explicit password arg.
- [x] **Nginx TLS/HTTPS** — Full HTTPS server block configured with SSL, HSTS, CSP, OCSP stapling, HTTP→HTTPS redirect, ACME challenge path. Cert paths point to Let's Encrypt. The TLS path is the `nginx:1.27-alpine` container in `infra/docker/compose.ingress.yml`; `infra/scripts/setup-tls.sh` (host-nginx path) has been removed in favor of a future in-container certbot sidecar.
- [x] **All ports bound to localhost** — Redis, Grafana, Prometheus, Loki, cAdvisor, node-exporter all changed from `0.0.0.0` to `127.0.0.1`

### 3. Deployment Consistency

- [x] **Unified compose path** — Root `docker-compose.yml` is the primary deployment target. Monitoring is a compose override (`-f infra/docker/compose.monitoring.yml`).
- [x] **Nginx upstream** — Fixed from `app-backend:5000` to `backend:5000` to match root compose service name.
- [x] **Health checks** — Added to backend (`/api/health`), Redis (`redis-cli ping`) services. Monitoring stack services also have health checks.
- [x] **Resource limits** — Memory limits + reservations on all services (backend 512M, prometheus 1G, grafana/loki 256M).
- [x] **Secret handling** — Required env vars documented in `.env.example`. Compose fails if `REDIS_PASSWORD` is unset.
- [x] **Grafana admin password** — `GRAFANA_ADMIN_PASSWORD:?error` pattern ensures it's set.
- [ ] **Alertmanager** — Still missing. Prometheus alert rules exist but no notification channel configured.
- [ ] **Automated backups** — `infra/scripts/setup-backups.sh` exists but cron not configured.

### 4. Incomplete Pages

- [x] `/transport-hostel/route-details` - Placeholder clearly says "Coming soon: this page is not yet available."
- [x] `/transport-hostel/outing-maintenance` - Placeholder clearly says "Coming soon: this page is not yet available.", hidden from sidebar
- [x] `/registration/registration-tracker` - Placeholder clearly says "Coming soon: this page is not yet available.", hidden from sidebar
- [x] `/exams/essentials` - Placeholder clearly says "Coming soon: this page is not yet available.", hidden from sidebar

All known incomplete routes now clearly present as unavailable instead of looking like broken finished pages.

### 5. CI Pipeline

- [x] **Backend tests** — runs on push/PR to main
- [x] **Frontend tests** — runs on push/PR to main
- [x] **Frontend build** — runs after frontend tests
- [x] **Lint** - CI runs `npx eslint .` in the frontend job.
- [x] **Metadata audit** - CI runs `npm run audit:metadata` in the frontend job.
- [x] **API contract audit** - CI runs `npm run audit:api-contracts` in the frontend job.
- [ ] **E2E tests** — Not in CI. 11 Playwright specs exist but run manually only.

### 6. Verification Tooling

- [x] **`audit-blueprints.mjs`** — Fixed: now uses `npx tsx` to evaluate TypeScript modules directly instead of CJS transpilation in a vm sandbox. Resolves the ESM/CJS mismatch.

### 7. Documentation

- [x] **`.env.example`** — Created at project root with all required vars
- [x] **TODO.md** — Updated for release-hardening phase
- [ ] **Root `README.md`** — Still missing. Project has no entry-point documentation.

---

## 🟡 Known Issues (not blocking release)

### Security (Medium)
- Backend `adminContext.js` `isElevated = potentialAdmin || Boolean(session.adminElevated)` auto-elevates admin register numbers. Needs password verification.
- `x-user-role` / `x-user-id` header spoofing in `eventsAuth.js` — client-trusted headers override session identity.
- No CSRF protection on auth endpoints.
- `adminPassword` accepted via URL query param in `adminAccess.js` — leaks to logs.

### Deployment (Medium)
- No staging/production environment separation — single `.env` for all.
- No Alertmanager — alert rules fire into a vacuum.
- No automated backup cron job — script exists (`infra/scripts/setup-backups.sh`) but not scheduled.
- Monitoring data (Prometheus, Grafana, Loki) not in backup strategy.
- No container restart policies on monitoring stack.
- Missing alert rules: disk space, memory, CPU, container down, certificate expiry.

### Incomplete Pages (Low, all hidden from sidebar)
- `/transport-hostel/route-details`, `/transport-hostel/outing-maintenance` - clearly marked as coming soon
- `/registration/registration-tracker` - clearly marked as coming soon
- `/exams/essentials` - clearly marked as coming soon

### API Contract Drift (not block-release)
- 19 documented mismatches between backend and frontend types (event dates, location, profile response, etc.)
- Events routes use different response envelope (`{ success, data }`) than all other routes (`sendApiSuccess`)

### God Files & Tech Debt (not block-release)
- 27 files exceed 500-line limit (largest: lmsStore.js at 2725 lines)
- 3 SQLite stores lack WAL mode (eventsStore, careerStore, competitionStore)
- No centralized frontend state management
- 159 logical/architectural issues documented (19 CRITICAL, 36 HIGH, 41 MEDIUM, 23 LOW)

### Test Coverage Gaps (not block-release)
- No E2E tests for auth/login, mobile viewports, visual regression
- Frontend coverage config only tracks CareerPortal modules
- No backend route integration tests with supertest
- No tests for ERP route handlers, admin pages, LMS store directly

---

## 📋 Effort to Release-Ready

| Area | Items | Est. Effort |
|---|---|---|
| **Release checklist (above)** | ~10 open items | 3-5 days |
| **Critical security fixes** | 4 auth vectors + CSRF | 2-3 days |
| **API contract alignment** | 19 mismatches | 3-5 days |
| **CI pipeline (lint + audit)** | 3 CI steps | 0.5 days |
| **Documentation** | README, runbooks | 1-2 days |
| **TOTAL** | ~39 items | ~10-15 days |
