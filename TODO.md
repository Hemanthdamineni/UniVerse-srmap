# University ERP Companion Platform — TODO

> Current date: 2026-07-14
> Source: Aggregated audits from architecture, blueprints, routing, backend routes, ERP pipeline, platform modules, infra, testing, code health, and documentation.
> **Auto-fix pass applied (2026-07-14):** ~29 items auto-fixed across 6 parallel agents.
> **Manual hardening pass applied (2026-07-14):** ~8 additional fixes by operator — adminAccess.js bypass closed with regression tests (131 backend tests), .gitignore env-example fix, Dockerfile/build/dockerignore/nginx config hardened (Docker build + nginx -t pass), TLS/backup scripts hardened with domain arg and weekly snapshot, stale lint suppressions cleaned, verification docs corrected.
> See [Fix Verification Report](docs/fix-verification-report.md) for details.

---

## ✅ Done (Operational) — everything that works

### Authentication & Session Management
- [x] Playwright-based ERP login flow with captcha handling, storageState persistence, and session expiry detection
- [x] Dual auth paths: API-based login (primary) + headless browser fallback
- [x] httpOnly session cookie (`erp_session`) as primary auth mechanism
- [x] Dev login endpoint for local development
- [x] Session expiry detection via HTML pattern matching (8 HTML patterns + 8 text patterns)
- [x] Forgot-password flow scraping the ERP password reset page
- [x] Admin session elevation (`/api/admin/access/unlock`, `/api/admin/access/disable`)

### ERP Data Pipeline (Core Scraping)
- [x] 16 backend extractors for all major ERP data types (attendance, profile, timetable, internal marks, fee dues, current results, subjects, fee paid, payment acknowledgment, exam mark details, OD/ML details, announcements, bank details, earlier internal marks, generic table)
- [x] Dual-TTL caching layer: 1-minute fresh, 10-minute stale with background refresh
- [x] In-flight request coalescing to deduplicate concurrent requests for the same page+user
- [x] Per-pageKey circuit breaker with configurable threshold, cooldown, and Redis persistence
- [x] Graceful degradation pipeline — invalid rows dropped (not error-thrown), partial data presented
- [x] Batch Page API (`POST /api/v2/erp/batch`) for multi-page dashboard aggregation in one round-trip
- [x] Per-page cache policy overrides via hot-reloaded JSON config (`erp-page-policy.json`)
- [x] 14 Zod schemas enforcing data shape at the end of the transformer pipeline

### ERP Data Pages (Frontend)
- [x] `/dashboard` — Aggregated view of attendance, timetable, marks, events, career
- [x] `/profile` — Student profile display from ERP data
- [x] `/academic/timetable` — Full timetable rendering
- [x] `/academic/attendance-details` — Attendance statistics and breakdown
- [x] `/academic/curriculum` — Student curriculum/subject listing
- [x] `/academic/sap-scholarships` — SAP scholarship details
- [x] `/exams/current-semester-results` — Current semester exam results
- [x] `/exams/earlier-semester-results` — Historical semester results (no schema validation)
- [x] `/exams/essentials` — Exam essentials page (generic fallback)
- [x] `/finance/fee-dues` — Outstanding fee dues
- [x] `/finance/fee-paid` — Paid fee history (with code defect — see Tech Debt)
- [x] `/finance/bank-details` — Bank account information
- [x] `/transport-hostel/room-details` — Room allocation details
- [x] `/transport-hostel/faqs` — FAQs display
- [x] `/transport-hostel/refund-change-requests` — Refund/change request status
- [x] `/registration/course-registration`, `/registration/minor-oe-registration`, `/registration/exam-registration`, `/registration/hostel-registration`, `/registration/transport-registration`, `/registration/sap-registration` — All ERP registration pages (generic fallback rendering)
- [x] `/settings` — User settings page

### Platform Modules — Events
- [x] Full event CRUD with rounds, teams, submissions, evaluation, leaderboard
- [x] Event registration, check-in, cancellation
- [x] Certificate generation per round with template management
- [x] Event gallery, feedback, messaging, notifications
- [x] iCal export, CSV attendee download
- [x] Team management: invitations, recruitment, role management
- [x] Competition/round workflow: submission, evaluation, shortlisting, results publishing
- [x] Co-organizer management
- [x] Event duplication
- [x] 17 backend event routes, 20+ competition routes, 15 frontend event pages

### Platform Modules — Career Portal
- [x] Full opportunity CRUD (jobs, internships, hackathons, competitions)
- [x] Bookmarks, saves, applications, dismissal tracking
- [x] Resume upload and analysis (no actual file processing — stores synthetic URL)
- [x] Skill gap analysis
- [x] Interview slot management and booking
- [x] Alumni directory with connection requests
- [x] Opportunity submission and approval workflow
- [x] Fit scoring for opportunities
- [x] Trending/deadline-soon/feed endpoints
- [x] 11 frontend pages, 50+ backend endpoints

### Platform Modules — LMS
- [x] Full resource CRUD with comments, annotations, ratings, bookmarks, flags
- [x] Subject-based browsing, PYQ storage per subject code
- [x] Study guides with sections and reading progress tracking
- [x] Roadmaps with node/edge DAG and completion tracking
- [x] Collections (curated resource bundles)
- [x] Resource requests with upvoting and fulfillment
- [x] Spaced-revision scheduler
- [x] Recommendation engine (next-step, exam-prep, roadmaps)
- [x] Duplicate detection via file hashing
- [x] Moderation system with flag management
- [x] Leaderboard (weekly contribs)
- [x] User activity tracking with reading time estimation
- [x] Quiz attempts and question bank
- [x] 24+ frontend pages, 80+ backend endpoints

### Platform Modules — Helpdesk
- [x] Ticket CRUD with categories, priority, status workflow
- [x] Ticket replies and escalation
- [x] FAQ management
- [x] Bulk ticket operations
- [x] 3 frontend pages, 11 backend endpoints

### Platform Modules — Campus Feedback
- [x] Multi-type feedback submissions (events, hostel-mess, transport, course)
- [x] Feedback options CRUD per type
- [x] Legacy data import
- [x] Admin submission review workflow
- [x] End-semester feedback automation
- [x] 5 frontend pages, 9 backend endpoints

### Platform Modules — Admin
- [x] 16 admin frontend pages covering events, content, campus feedback, LMS mod, helpdesk, career, analytics, audit logs, certificate templates, system controls
- [x] Admin session elevation mechanism

### Platform Modules — Unified Profile
- [x] Cross-domain profile aggregation (skills, achievements, privacy)
- [x] Public profile endpoint
- [x] Signal ledger for cross-domain event recording
- [x] Achievement sync from events/competitions
- [x] Recommendations engine (home, LMS, career, events)
- [x] 14 backend endpoints

### Platform Modules — Academic Tracker
- [x] Progress overview, academic insights, unified insights pages
- [x] LMS tracker service with career readiness scoring
- [x] 3 frontend pages, 5 backend endpoints

### Infrastructure
- [x] Docker Compose setup (backend + Redis, with separate monitoring stack)
- [x] Nginx reverse proxy configuration (HTTP only — see Production Blockers)
- [x] Prometheus + Grafana monitoring stack with 4 alert rules
- [x] Loki + Promtail logging stack
- [x] k6 load test scripts (4 scripts: page caching, live ERP, mixed, career)
- [x] 6 production runbooks documented
- [x] Backup strategy documented (but not automated)
- [x] HTTPS health check endpoints (`/api/health`, `/api/live`, `/api/ready`)
- [x] Helmet security headers
- [x] Redis-backed rate limiting
- [x] 11 Playwright E2E test specs covering key user journeys
- [x] Frontend multi-stage Dockerfile with `.dockerignore` — build + `nginx -t` verified
- [x] TLS setup script (`infra/scripts/setup-tls.sh`) with `--domain` arg and dry-run mode
- [x] Backup script (`infra/scripts/setup-backups.sh`) with weekly snapshot rotation and dry-run mode
- [x] CI workflow (`.github/workflows/ci.yml`) with 3 jobs: backend-tests, frontend-tests, frontend-build

### Testing
- [x] **131 backend tests** using Node native test runner (including `adminAccess.test.js` regression tests)
- [x] **128 frontend tests** using Vitest + React Testing Library (including 6 `ErrorBoundary.test.tsx` tests)
- [x] 11 Playwright E2E spec files
- [x] 4 k6 load test scripts (up to 1000 concurrent VUs)
- [x] 1 integration smoke test covering all major backend services
- [x] Comprehensive E2E audit spec (crawls 120+ routes, captures console errors, a11y issues, broken images)

### Documentation
- [x] 14 architecture/technical doc chapters (some stale — see Known Gaps)
- [x] Aura Design System documentation
- [x] Architecture flow map
- [x] UAT documentation
- [x] Post-implementation report and root-cause analysis
- [x] Admin content lifecycle runbook

---

## 🔴 Production Blockers — things preventing deployment

### P1: No TLS/SSL — All traffic is unencrypted HTTP
- **Severity**: Critical
- **Details**: Nginx configuration at `infra/nginx/conf.d/university-erp.conf` listens only on port 80. No TLS certificates, no ACME/LetsEncrypt integration, no HTTP-to-HTTPS redirect, no HSTS header.
- **Mitigation**: Setup script created at `infra/scripts/setup-tls.sh` (supports `--domain` arg, dry-run mode). Run with a real domain to provision certs via certbot.
- **Fix**: Add TLS termination via LetsEncrypt certbot, configure HTTPS redirect, add HSTS and CSP headers.

### P2: No CI/CD Pipeline
- **Severity**: Critical
- **Details**: No `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, or any CI configuration exists. No automated testing, building, or deployment. Every release is manual.
- **Mitigation**: CI workflow created at `.github/workflows/ci.yml` (3 jobs: backend-tests, frontend-tests, frontend-build). Push to GitHub to activate.
- **Fix**: Set up GitHub Actions with lint, test (backend + frontend unit), build, and deploy stages.

### P3: No Staging or Production Environment Configuration
- **Severity**: Critical
- **Details**: No environment separation. No `.env.production`, `.env.staging`, or Docker Compose override files for non-dev environments.
- **Mitigation**: `Backend/.env.example` and `Frontend/.env.example` created with all required vars documented.
- **Fix**: Create `docker-compose.override.yml` (dev), `compose.staging.yml`, `compose.production.yml`. Document required env vars in `.env.example` files.

### P4: No Secrets Management
- **Severity**: Critical
- **Details**: Grafana admin password hardcoded to `admin/admin` in `infra/docker/compose.monitoring.yml`. Redis has no password — port 6379 exposed to host without auth in `compose.data.yml`. ~~Default admin password `asdfghjkl;` hardcoded in `Backend/src/config/env.js` — **FIXED** (empty string default with startup warning). Hardcoded admin register number `AP23110010419` in both `Frontend/src/lib/core/identity.ts` and `Backend/src/config/adminUsers.js` — **FIXED** (env-configurable). Empty-password bypass in `Backend/src/utils/adminAccess.js` — **FIXED** (`!requiredPassword` returns false, regression tests added).~~
- **Impact**: Any attacker with network access can access monitoring, Redis data, and admin functionality.
- **Remaining**: Grafana/Redis passwords still hardcoded in compose files.

### P5: No Frontend Dockerfile
- **Severity**: High
- **Details**: ~~Frontend is built on the host and served via Nginx volume mount.~~ **FIXED**: Multi-stage Dockerfile created at `Frontend/Dockerfile` with `.dockerignore`. Build verified: `docker build -t erp-frontend Frontend/` passes, `nginx -t` passes.
- **Fix**: ~~Create `Frontend/Dockerfile` with multi-stage build~~ ✅ Done.

### P6: No Automated Backup
- **Severity**: High
- **Details**: Backup strategy documented (SQLite databases + Redis RDB + uploads) but not scripted.
- **Mitigation**: Backup script created at `infra/scripts/setup-backups.sh` with SQLite/Redis backup, configurable destination, retention rotation (7 daily, 4 weekly), dry-run mode.
- **Fix**: Configure cron with the backup script and an off-site destination.

### P7: No Alert Notifications
- **Severity**: High
- **Details**: Prometheus alert rules exist (latency, error rate, cache hit ratio, circuit breaker) but no Alertmanager configured. No email, Slack, or PagerDuty notification channel.
- **Impact**: Alerts fire into a vacuum — no operator knows when the system degrades.
- **Fix**: Configure Alertmanager with at minimum email and Slack webhook routing.

---

## 🟡 Known Gaps — partial/incomplete features

### ERP Data Pipeline Gaps

**Missing frontend transformers (no schema validation on critical pages):**
1. `/exams/earlier-semester-results` — Reads `_extracted` directly without any transformer or schema validation
2. `/registration/*` (6 pages) + `/settings` — Use `DocumentErpPage` with generic fallback, no type enforcement
3. `/notifications` — Backend extractor exists but no frontend transformer; data flows raw
4. `/transport-hostel/route-details`, `/transport-hostel/outing-maintenance`, `/registration/registration-tracker`, `/exams/essentials` — Pure placeholder pages with no meaningful UI
5. `exam-mark-details` — No dedicated transformer; consumed inline in `ResultsEarlierPage`
6. `od-ml-details` — No dedicated transformer; consumed inline in `transformAttendance`
7. `payment-acknowledgment` — No dedicated transformer; consumed inline in `transformFeesPaid`

**Transformer defects:**
8. `attendanceTransformer` in `src/lib/erp/attendanceTransformers.ts` swaps `odMlApprovedPct` and `attendancePct` field names (documented as intentional but breaks semantic expectations)
9. `profileTransformer` in `src/lib/erp/profileTransformers.ts` reads raw `TableContent` instead of the typed `_extracted` pipeline — inconsistent with all other transformers
10. Profile field parsing uses brittle `' / '` separator splitting for compound fields (D.O.B./Gender, Program/Section, Contact/Email) that breaks if upstream ERP format changes
11. Profile Zod schema requires all 13 fields as non-empty strings but real ERP data often has missing fields — causes validation failures for incomplete profiles
12. No schema validation for any generic-table backed pages (SAP, registration, hostel, transport, FAQs, refund/change)

**Extractor fragility:**
13. All 16 backend extractors depend on specific SRM HTML structure (table IDs like `#tblSubjectWiseAttendance`, CSS classes like `.timetablehead`, `.subheader`). Any upstream ERP HTML change silently breaks data extraction and produces `MISSING_EXTRACTED_PAYLOAD` errors
14. `UNREGISTERED_ERP_PAGE` throws 500 error — adding any new page to `scrapeTargets` requires simultaneous extractor deployment
15. No mechanism to detect ERP HTML structure changes (no snapshot comparison or checksumming)

**Cache and auth gaps:**
16. Cache invalidation is purely TTL-based — no event-driven invalidation when ERP data changes
17. Session expiry detection uses regex HTML matching that can produce false positives and terminate valid sessions
18. Login browser fallback (`submitLoginInBrowser` in `erpClient.js`) has zero test coverage
19. Distributed lock (FEATURE_ERP_DISTRIBUTED_LOCK) adds Redis operational dependency; lock failures poll at 80ms intervals causing latency spikes

### Platform Module Gaps

**Career Portal:**
20. Resume upload stores synthetic URL path but does not process multipart file uploads — no actual file handling pipeline
21. No E2E tests for core career flows (profile editing, skill-gap, applications)

**LMS:**
22. Quiz and flashcard modes appear entirely client-side — no backend persistence of quiz results or flashcard progress
23. LMS frontend test coverage severely lacking: only 1 component test for 24+ pages (only `LmsHomePage.test.tsx` and `ResourceCard.test.tsx`)
24. Question bank page exists but backend question bank API is unclear/misaligned

**Events:**
25. `EventDetailPageNew` exists alongside `EventDetailPage` — likely duplicate/incomplete migration
26. `EventAttendance` page is a thin ERP wrapper with no native attendance tracking UI
27. `MyActivityPage` lacks integration with competition results

**Helpdesk:**
28. No ticket category/type filtering on frontend (backend supports it)

**Feedback:**
29. `EventsFeedback`, `HostelMessFeedback`, `TransportFeedback` are 15-17 line thin wrappers delegating to `CampusFeedbackPage` — functional but minimal

**Admin:**
30. Admin backend routes are skeletal — only session elevation endpoints (`/api/admin/access/*`). All admin CRUD operations gate on `hasAdminAccess` within domain-specific stores rather than having admin-specific APIs
31. No admin dashboard stats/composite view — admin pages are frontend-heavy, backend-thin
32. No dedicated backend tests for admin CRUD operations (rely on domain-specific store tests)
33. `adminContext.js` middleware uses best-effort resolution with silent catch — admin elevation issues go undetected

**Unified Profile:**
34. Recommendations engine exposes 4 API endpoints but no frontend Dashboard widget renders recommendation cards
35. Career readiness scoring from LMS tracker not surfaced in career profile
36. Signal ledger has no frontend visualization
37. No cross-domain analytics/reporting dashboard on frontend

### Testing Gaps
38. ~~No CI pipeline~~ — **FIXED** (`.github/workflows/ci.yml` created with 3 jobs)
38b. **npm audit — Frontend:** 28 vulnerabilities (2 critical) — run `cd Frontend && npm audit` and triage
38c. **npm audit — Backend:** 7 vulnerabilities — run `cd Backend && npm audit` and triage
38d. **Knip unused exports:** `npx knip --no-exit-code` reports unused files/deps and unresolved backend script imports — needs per-item triage
39. No E2E tests for auth/login flow, mobile/responsive viewports, visual regression, or cross-browser (Chromium only)
40. No E2E tests for Transport/Hostel, Registration pages, Notifications, Settings
41. No dedicated backend route integration tests (no supertest or HTTP assertion library)
42. Frontend Vitest coverage config only tracks CareerPortal modules — ~70% of frontend untracked
43. No performance/benchmark tests for frontend rendering or backend query latencies
44. Backend tests use fixture files but no shared test factories across files
45. No tests for `LmsStore` or `LmsModerationService` (only smoke test coverage)
46. No tests for `discoveryRepository`, `externalSeedData`, `sessionStore` directly
47. No tests for ERP route handlers: `/academic/curriculum`, `/academic/sap-scholarships`, `/exams/earlier-semester-results`, `/transport-hostel/*`, `/registration/*`, `/notifications`, `/settings`
48. No tests for Admin pages: `AdminEventApprovals`, `AdminAuditLogs`, `AdminCertificateTemplates`, `AdminHelpdeskFaqs`

### Documentation Gaps
49. `docs/00-INDEX.md` does not list chapters 12-14 or subdirectories (design, reports, runbooks, UAT)
50. `docs/01-OVERVIEW.md` still labels Career Portal, Academic Tracker, Helpdesk, LMS as "placeholders"
51. `docs/02-ARCHITECTURE.md` layer diagram missing Career, LMS, Competition, Campus Feedback, Helpdesk services
52. `docs/03-BACKEND-DEEP-DIVE.md` covers only 4 route modules, missing 15+
53. `docs/04-FRONTEND-DEEP-DIVE.md` missing new page directories (LMS, CareerPortal sub-pages, Events workflows)
54. `docs/06-DATA-PIPELINE.md` transformer registry outdated
55. `docs/07-API-REFERENCE.md` still references legacy `sessionId` fallback cutoff date of 2026-05-15 (now passed)
56. `docs/08-CONFIGURATION.md` missing env vars for 6 additional SQLite stores
57. `docs/09-INFRASTRUCTURE.md` still references only 3 SQLite databases (reality: 10)
58. No root `README.md` — project entry point for new developers
59. No testing guide covering patterns, runners, and how to write tests
60. No security/privacy document covering auth model, data retention, admin access controls

### Infrastructure Gaps
61. Missing alert rules: disk space, memory, CPU, container down, certificate expiry
62. Loki runs as single instance with in-memory ring — single point of failure for logs
63. No retention policies defined for Prometheus, Grafana, or Loki data
64. Monitoring data not included in backup strategy
65. No docker-compose healthchecks on any service
66. No container resource limits (CPU/memory) on any service
67. Nginx rate limiting (25r/s) may be too restrictive for thousands of concurrent students
68. Backend upstream in nginx references `app-backend` container name that only exists in `compose.app.yml` network context
69. Root `docker-compose.yml` duplicates `infra/docker/` services with different env vars and hardcoded container names (`universe-srmap-*`)
70. Compose files require external networks (`erp_app`, `erp_data`) to be pre-created — start ordering fragile
71. ~~No `.env.example` files anywhere in the project~~ — **FIXED** (`Backend/.env.example` and `Frontend/.env.example` created)

### Missing Runbooks (6 of 12 documented)
72. Database migration runbook (SQLite schema changes)
73. Incident response / on-call escalation runbook
74. Full disaster recovery runbook (bare-metal-to-running)
75. Security incident response runbook
76. Infrastructure provisioning / node setup runbook
77. Certificate lifecycle and renewal runbook

---

## 🔵 Deferred — design-only / future

### Design System Work
- [ ] Aura Design System documented in `docs/design/aura-design-system.md` but not fully implemented in code. CSS variables, color tokens, and component primitives need audit against design spec.
- [ ] Full light/dark mode implementation not verified against the "Pristine Studio" / "Deep Command" theme specification.
- [ ] WCAG 2.1 AA compliance not verified beyond E2E audit a11y checks (axe-core in comprehensive-audit.spec.ts).
- [ ] Spring curve motion personality (`cubic-bezier(0.16, 1, 0.3, 1)`) not consistently applied.

### Future Platform Features
- [ ] Push notification infrastructure — career notification cycle exists but has no delivery channel beyond in-app
- [ ] Event attendance native tracking (not ERP-wrapper) — could connect eventsStore attendance with check-in data
- [ ] Cross-exam feedback integration — ExamFeedbackPage (LMS) disconnected from campus feedback system
- [ ] Adjacent domains: mentorship matching, peer tutoring marketplace, alumni network features, research/startup showcase layer
- [ ] AI/ML features: AI copilots, predictive analytics (dropout risk, grade prediction), context bandits for recommendations, embedding-based semantic search
- [ ] Multi-tenancy / batch/graduation-year isolation
- [ ] Mobile native app or PWA with offline support
- [ ] Real-time collaboration features (study groups, shared annotations)
- [ ] SSO / OAuth integration for university identity provider

### Analytics & Telemetry
- [ ] Wire a real analytics provider — `analytics.ts` is intentionally a no-op in production with only dev logging
- [ ] 6 analytics event types defined in type union but never emitted (`evaluation_started`, `shortlist_applied`, `results_published`, `create_event_started`, `create_event_quick_mode`, `create_event_full_mode`, `create_event_abandoned`)
- [ ] No frontend analytics dashboard beyond admin CompanionAnalyticsPage

---

## ⚪ Tech Debt & Maintenance

### God Files (exceeding 500-line limit with no split plan)
Per CLAUDE.md, all files over 500 lines require a split plan documented in `implementation_plan.md`, which does not exist. 27 files exceed the limit:

**Backend (19 files):**
| File | Lines |
|---|---|
| `Backend/src/services/lms/lmsStore.js` | 2725 |
| `Backend/src/services/career/careerStore.js` | 2424 |
| `Backend/src/services/events/competitionStore.js` | 1998 |
| `Backend/src/services/erp/erpClient.js` | 1842 |
| `Backend/src/services/events/eventsStore.js` | 1500 |
| `Backend/src/services/lms/lmsTrackerService.js` | 1417 |
| `Backend/src/services/lms/contentStore.js` | 1391 |
| `Backend/src/services/erp/erpAggregationService.js` | 1067 |
| `Backend/src/services/erp/erpServices.js` | 1001 |
| `Backend/src/services/core/unifiedProfileStore.js` | 986 |
| `Backend/src/services/campus/helpdeskStore.js` | 854 |
| `Backend/src/services/lms/lmsServices.js` | 811 |
| `Backend/src/services/campus/campusFeedbackStore.js` | 799 |
| `Backend/src/services/campus/feedbackServices.js` | 742 |
| `Backend/src/services/erp/erpActionExecutor.js` | 617 |
| `Backend/src/services/core/sessionServices.js` | 610 |
| `Backend/src/services/erp/erpUiMapStore.js` | 573 |
| `Backend/src/services/lms/lmsMigrations.js` | 572 |
| `Backend/src/services/career/careerServices.js` | 556 |

**Frontend (8 files):**
| File | Lines |
|---|---|
| `Frontend/src/lib/campus/campusApi.ts` | 971 |
| `Frontend/src/pages/Events/EventWorkflowPages.tsx` | 796 |
| `Frontend/src/lib/career/careerApi.ts` | 778 |
| `Frontend/src/pages/CareerPortal/CareerProfilePage.tsx` | 756 |
| `Frontend/src/pages/CareerPortal/Opportunities.tsx` | 556 |
| `Frontend/src/lib/events/competitionsApi.ts` | 534 |
| `Frontend/src/lib/lms/tracker.ts` | 526 |
| `Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx` | 513 |

### No Error Boundaries
The entire SPA has zero error boundaries. A single render crash in any lazy-loaded route can bring down the whole application. Routes unprotected:
- `/` root, `/login`, `/forgot-password`, `/dashboard`, `/profile`, `/career/public/:userId`
- All ERP routes (`/academic/*`, `/exams/*`, `/finance/*`, `/transport-hostel/*`, `/registration/*`)
- All Events routes (`/events/*`)
- All LMS routes (`/resources/*`)
- All Admin routes (`/admin/*`)
- All Career Portal routes (`/career/*`)

### Dead Code
1. `Frontend/src/components/calendar.tsx` — Exported shadcn DayPicker wrapper, never imported anywhere
2. `Frontend/src/components/button.tsx` — Not verified for usage
3. `Frontend/src/lib/lms/http.ts` — Never imported; dead code defining `buildMultipartForm`
4. `Frontend/src/lib/lms/types.ts` — Never imported; re-exports from `content.ts`
5. 6 unused PNG assets: `Captcha.png`, `ERP Assets.svg`, `ERP Brand Assets.svg`, `Gemini_Generated_Image_*.png` (3 files)
6. 6 unused PNG icons: `Academics.png`, `Back.png`, `DropdownIcon.png`, `Front.png`, `LightDarkToogle.png`, `Separator.png`
7. 21 PNG icons in `src/assets/Icons/` used via hardcoded image paths in sidebar instead of SVG components

### Dependency Issues
8. Redundant icon libraries: both `lucide-react` AND `@heroicons/react` in Frontend dependencies — pick one
9. `shadcn` in runtime `dependencies` instead of `devDependencies` in `Frontend/package.json`
10. `express@5.1.0` is a release candidate / staging channel — risk for production vs LTS 4.x line
11. `recharts` (large charting library) may be overkill if only basic charts used

### Hardcoded Values
12. Default admin password `asdfghjkl;` in `Backend/src/config/env.js:74` — must require explicit env config
13. Admin register number `AP23110010419` in `Frontend/src/lib/core/identity.ts` and `Backend/src/config/adminUsers.js`
14. Proxy target `http://localhost:5000` in `vite.config.ts` — not configurable via env variable
15. Color `#ffffff` in `Frontend/src/styles/components.css` (btn-primary text color) — should use CSS variable
16. Hardcoded `box-shadow` and `border-color` with literal `rgba()` values across `layout.css`, events CSS — should use theme-aware variables

### Configuration Issues
17. `knip.json` is minimal (6 lines, tags filter only) — no entry paths, project config, or per-workspace settings
18. No `.env.example` files in project root, Frontend/, or Backend/
19. `Scraper/` directory (15 Python files) fully tracked in git with unclear ingestion path
20. `Stitch Design.zip` (207 MB binary) tracked in git history but gitignored — should be removed
21. `StaticHost/README.md` tracked in git with unclear purpose — flagged for cleanup
22. `assets/brand/` directory exists but is empty
23. `Backend/src/routes/lmsRoutes.js` exists alongside `Backend/src/routes/lmsRoutes/` subdirectory — naming collision risk

### Code Quality
24. `FeePaidPage` (`Frontend/src/pages/ERP/FeePaidPage.tsx`) has duplicate `const warnings = data?.warnings || []` declarations at lines 124 and 176 in same function scope
25. `profileTransformer` uses fragile `' / '` separator parsing for compound fields
26. `FeePaidPage` hardcodes print URL construction with ERP-specific path string concatenation
27. Inline error handling inconsistent: `FeeDuesPage` throws on pipeline failure, `FeePaidPage` silently degrades to empty state
28. 6 analytics event types defined in union but never emitted via `track()` calls

### Cross-Cutting Architectural Issues
29. No centralized frontend state management — pages use direct API calls, making state consistency across modules fragile
30. 14 separate SQLite databases with no migration framework or schema versioning
31. Backend tests have no shared test factories or helpers across files
32. `NotificationSettings` and `Settings` pages have no tests at all
33. `Backend/src/routes/careerRoutes.js` (422 lines) and `Backend/src/routes/resourceRoutes.js` (398 lines) approach the 500-line limit

---


## 🧠 Logical & Architectural Issues

> Auto-detected from deep-logical audits across auth, data pipeline, business logic, architecture, API contracts, UX, and concurrency dimensions (2026-07-17).

---

### CRITICAL — 19 findings

#### Authentication & Authorization (4)

1. **Admin auto-elevation from register number without password** (`Backend/src/middleware/adminContext.js:19`) — `isElevated = potentialAdmin || Boolean(session.adminElevated)` elevates ANY user whose register number appears in the admin list with zero password verification. Every admin register number holder is treated as an admin on every request.

2. **Admin unlock endpoint bypasses password verification entirely** (`Backend/src/routes/adminRoutes.js:20-36`) — POST `/admin/access/unlock` checks only `req.adminContext?.potentialAdmin` then sets `adminElevated: true`. The `x-admin-password` header sent by the frontend is completely ignored server-side.

3. **Role spoofing via x-user-role header and role query param** (`Backend/src/utils/eventsAuth.js:60-67`) — `resolveRoleAsync` returns the role from `x-user-role` header or `role` query parameter without consulting the session. Any unauthenticated user can claim `admin`, `faculty`, or `event_coordinator`.

4. **Full user identity spoofing via x-user-id, x-user-name headers** (`Backend/src/utils/eventsAuth.js:104-111`) — `createUserContextMiddleware` trusts `x-user-id`, `x-user-name`, `x-user-email` headers from the client directly, taking precedence over session-derived identity. Combined with role spoofing, attackers can fully impersonate any user and access unified profiles (skills, achievements, career data, LMS progress).

#### Data Pipeline (2)

5. **Cache write failure incorrectly increments circuit breaker** (`Backend/src/services/erp/erpAggregationService.js:776`) — When `writeCache` throws (Redis down), the catch block calls `markCircuitFailure()`. Redis infrastructure failures are treated as ERP upstream failures, artificially inflating circuit breaker counts and potentially taking down healthy ERP endpoints.

6. **Attendance field-name swap corrupts data semantics** (`Frontend/src/lib/erp/attendanceTransformers.ts:59-61`) — `odMlApprovedPct` receives actual attendance `%` and `attendancePct` receives OD/ML `%`. Any consumer reading by semantic name gets the wrong value. A notification like "if attendancePct < 75, warn" would fire based on OD/ML percentage, not actual attendance.

#### Business Logic — Data Integrity (2)

7. **Competition results silently alterable after publishing** (`Backend/src/services/events/competitionStore.js:521`) — `publishResults` sets `resultsPublished=1` but `evaluateSubmission` and `applyShortlist` have no guards preventing modification. Scores and leaderboards change silently after publication with no audit trail.

8. **Roadmap DAG allows cycles with no detection** (`Backend/src/services/lms/lmsStore.js:2410`) — `addRoadmapEdge` uses `INSERT OR IGNORE` without cycle checking. Adding A→B then B→A creates a cycle, potentially causing infinite loops or incorrect progress calculations for students.

#### API Contract Drift (4)

9. **Event date fields: backend startAt/endAt vs frontend startDate/endDate** (`Backend/src/services/events/eventsStore.js:674` vs `Frontend/src/lib/events/competitionsApi.ts:91`) — Frontend `EventSummary` type declares `startDate`/`endDate` but backend returns `startAt`/`endAt`. Any frontend code accessing by TypeScript type names receives `undefined`.

10. **Event registered count: backend registeredCount vs frontend registrationCount** (`Backend/src/services/events/eventsStore.js:201` vs `Frontend/src/lib/events/competitionsApi.ts:96`)

11. **PUT /career/profile returns full profile, frontend expects `{ updated: boolean }`** (`Backend/src/routes/careerRoutes.js:294` vs `Frontend/src/lib/career/careerApi.ts:397`) — Backend discards `updateProfile()` return and returns `getProfile()` (full profile). Frontend type expects `{ updated: boolean }`. Accessing `result.updated` returns `undefined`.

12. **POST /career/opportunities/:id/apply returns `{ tracked: true }` but frontend expects `{ applied: boolean }`** (`Backend/src/routes/careerRoutes.js:239` vs `Frontend/src/lib/career/careerApi.ts:761`) — Plus the `notes` body parameter is silently ignored by the backend.

#### UX — State Loss (2)

13. **Multi-step registration wizard state lost on page refresh** (`Frontend/src/pages/Events/EventWorkflowPages.tsx:75`) — All wizard state (step, team, invites) held in React component state. Refresh erases everything. The server may have already created a team, but the local `team` state is gone, causing duplicate teams on re-registration.

14. **Create event wizard state lost on page refresh** (`Frontend/src/pages/Events/CreateEventPage.tsx:20`) — All form state across 4 steps is React-local. Refresh during any step loses all entered data (title, description, rounds, judges). No localStorage backup.

#### Concurrency — Partial Write Corruption & Race Conditions (3)

15. **eventsStore._persistAll writes 6 state keys outside a transaction** (`Backend/src/services/events/eventsStore.js:1412`) — Events, registrations, notifications, feedback, gallery, and checkIns are written as six individual SQL statements with no wrapping transaction. Process crash mid-write permanently corrupts in-memory state.

16. **careerStore._recomputeSkillGaps delete-then-insert without transaction** (`Backend/src/services/career/careerStore.js:1206`) — DELETE then INSERT loop (1+N operations) has no transaction. Crash between DELETE and first INSERT permanently deletes all skill gap data.

17. **Three SQLite stores lack WAL mode — blocks concurrent readers** (`Backend/src/services/events/eventsStore.js:1469`, `Backend/src/services/career/careerStore.js:2344`, `Backend/src/services/events/competitionStore.js:1971`) — eventsStore, careerStore, and competitionStore don't set `PRAGMA journal_mode = WAL`, unlike lmsStore, unifiedProfileStore, and lmsTrackerStore which do. Any writer in multi-process deployment blocks all readers up to `busy_timeout` (5000ms).

#### Architecture — Encapsulation Violations (2)

18. **CompetitionStore calls EventsStore private methods** (`Backend/src/services/events/competitionStore.js:35,545,554,563,584,1318`) — Directly invokes `this.eventsStore._persistAll()` and `this.eventsStore._pushNotification()` (underscore-prefixed private methods). Any EventsStore refactor breaks CompetitionStore.

19. **UnifiedProfileStore accesses competitionStore.db directly** (`Backend/src/services/core/unifiedProfileStore.js:583`) — Runs raw SQL against competitionStore's internal SQLite database, completely bypassing its public interface. Schema changes in competitionStore silently break UnifiedProfileStore.

**Fix priorities (CRITICAL):** (1) Remove `potentialAdmin` from `isElevated` and make admin elevation require password verification via `assertAdminAccess()`. (2) Remove client-trusted headers (`x-user-role`, `x-user-id`) from identity/role resolution in eventsAuth.js. (3) Wrap `_persistAll` in `BEGIN IMMEDIATE...COMMIT` transaction. (4) Add WAL mode to eventsStore, careerStore, competitionStore. (5) Implement session rotation on login and server-side session deletion on logout. (6) Align the 4 mismatched API fields (startDate/startAt, registeredCount/registrationCount, profile update response, apply response).

---

### HIGH — 36 findings

#### Authentication & Session Security (5)

1. **Session ID accepted via URL query string** (`Backend/src/utils/cookies.js:43`) — Session IDs in query strings leak to server access logs, browser history, Referer headers. Defeats httpOnly cookie protection.

2. **Logout does not invalidate server-side session** (`Backend/src/routes/authRoutes.js:295-298`) — Only clears cookie. Session remains in store. Attacker with stolen session ID continues using it indefinitely.

3. **No session rotation after successful login** (`Backend/src/routes/authRoutes.js:131`) — Pre-auth captcha session token becomes the permanent authenticated token. No session fixation prevention.

4. **Hardcoded admin dev login** (`Backend/src/routes/authRoutes.js:156-198`) — `/dev/login` creates authenticated session for known admin register number with zero credentials. Guarded only by `NODE_ENV !== "production"`.

5. **Admin password transmitted via URL query parameter** (`Backend/src/utils/adminAccess.js:10-13`) — `getProvidedAdminPassword` reads from `req.query.adminPassword`, exposing it in server access logs, browser history, and Referer headers.

#### Data Pipeline (6)

6. **Circuit breaker state has TOCTOU read-modify-write race** (`Backend/src/services/erp/erpAggregationService.js:602`) — `markCircuitFailure` reads circuit state (GET), modifies in memory, then writes (SET). No atomic Redis INCR. Concurrent requests lose failure counts near threshold.

7. **Session expiry on one scrape target aborts all other concurrent targets** (`Backend/src/services/erp/erpServices.js:856`) — `Promise.all` in `mapWithConcurrency` aborts all in-flight targets when one encounters SESSION_EXPIRED. Transient blip on one sub-request forces full re-auth.

8. **ERP mutations have no idempotency protection** (`Backend/src/services/erp/erpActionExecutor.js:507`) — No idempotency key or dedup mechanism. Network retry or double-click on Print button can cause duplicate attendance code submissions, OTP requests, or fee print actions on the ERP side.

9. **Session save failure after successful mutation returns error to user** (`Backend/src/services/erp/erpActionExecutor.js:583`) — `sessionStore.update` throw after ERP mutation success causes user to see error and retry, potentially applying the mutation twice.

10. **Extractor returning null silently produces empty valid payloads** (`Backend/src/services/erp/extractors/index.js:151`) — `adaptToLegacyPayload` turns null/partial extractor results into `{ title: "", text: "", tables: [] }`. If `minTableCount` isn't set in the contract, empty payloads pass validation and get cached. Users see "0% attendance" silently.

11. **Unconfigured pages default to cached-first, serving stale data** (`Backend/src/config/erp-page-policy.json:2`) — `PagePolicyStore.resolveMode` returns `"cached-first"` for any pageKey not in overrides config. New or misspelled pages silently serve potentially-stale cached data.

#### Business Logic — Events & Competitions (2)

12. **Event lifecycle missing cancel, ongoing, and completed states** (`Backend/src/services/events/eventsStore.js:7`) — Only draft/published/archived exist. Cancelling an event requires deletion (silently removes all registrations with no notification). Archiving leaves registrations dangling.

13. **Event deletion silently removes all registrations without notification** (`Backend/src/services/events/eventsStore.js:874`) — `deleteEvent` removes registrations, feedback, gallery, check-ins. No notification to registered attendees. Events simply vanish from users' registered events lists.

#### Business Logic — Career (2)

14. **Concurrent resume uploads race and orphan previous files** (`Backend/src/services/career/careerStore.js:1174`) — `updateResume` uses simple UPDATE/INSERT without locking or `SELECT FOR UPDATE`. Concurrent uploads can both proceed, with one filePath overwriting the other. The first file is orphaned on disk with no DB reference.

15. **Application state transitions are unrestricted** (`Backend/src/services/career/careerStore.js:1037`) — `updateApplicationStatus` accepts any status without validating transition path. Withdrawn can jump to offered, rejected can bounce back to shortlisted.

#### Business Logic — LMS (1)

16. **Spaced revision queue references deleted/moderated resources** (`Backend/src/services/lms/lmsStore.js:973`) — `getRevisionQueue` joins without filtering on `isDeleted=0` or moderation state. Users clicking "review now" get 404 errors on deleted resources with no explanation.

#### Business Logic — Unified Profile (1)

17. **recordSignal accepts caller-supplied userId without authorization** (`Backend/src/services/core/unifiedProfileStore.js:207`) — No `_ensureAuthenticated` guard. If called from an API handler that doesn't verify caller-to-userId match, signals can be forged for any user (e.g., "achievement" signals on an admin's profile).

#### Architecture & Coupling (4)

18. **LmsTrackerService is a 1417-line god object spanning five domains** (`Backend/src/services/lms/lmsTrackerService.js`) — Merges ERP aggregation, career readiness scoring, academic signal extraction, LMS recommendations, and unified insight building. Uses prototype mixins. 5 constructor dependencies.

19. **UnifiedProfileStore reaches into EventsStore internal Maps/Arrays** (`Backend/src/services/core/unifiedProfileStore.js:67`) — Accesses `eventsStore.registrationsByUser`, `eventById`, `events` as raw properties rather than through query methods. If EventsStore changes property names or storage strategy, this breaks silently.

20. **LmsRecommendationEngine traverses through UnifiedProfileStore to reach eventsStore** (`Backend/src/services/lms/lmsServices.js:344`) — Chains `this.unifiedProfileStore.eventsStore.listEvents()` creating a confusing multi-layer dependency. Middle store acts as pass-through, not abstraction boundary.

21. **Two different response envelopes across route files** (`Backend/src/routes/eventsRoutes.js:24`) — Events/competition routes return `{ success: true, data }` while all others send raw body via `sendApiSuccess`. Frontend uses fragile heuristic unwrapping.

#### API Contract Drift (6)

22. **Event location is an object on backend, frontend expects string** (`Backend/src/services/events/eventsStore.js:679` vs `Frontend/src/lib/events/competitionsApi.ts:93`) — `event.location.startsWith(...)` would crash at runtime.

23. **EventSummary expects `type` field that backend never sets** (`Frontend/src/lib/events/competitionsApi.ts:87`) — Backend has `category` but no `type`. Any frontend code accessing `event.type` gets `undefined`.

24. **EventSummary expects `isCompetition` boolean backend never sets** (`Frontend/src/lib/events/competitionsApi.ts:100` vs `Backend/src/services/events/eventsStore.js:199`)

25. **GET /career/profile never returns name, email, or department** (`Backend/src/services/career/careerStore.js:1085` vs `Frontend/src/lib/career/careerApi.ts:67`) — Career profile type declares these optional but they are always `undefined`.

26. **GET /events/:eventId doesn't return myRole but frontend EventDetail expects it** (`Backend/src/services/events/eventsStore.js:640` vs `Frontend/src/lib/events/competitionsApi.ts:110`) — `myRole` is only available via a separate endpoint, never populated inline.

27. **GET /api/profile/public/:userId user identity fields may be raw userId** (`Backend/src/services/core/unifiedProfileStore.js:497` vs `Frontend/src/lib/career/profileApi.ts:117`) — Fallback to `profile.name || ownerId` means name could be the raw register number if no snapshot exists.

#### UX — Session & Navigation (2)

28. **No redirect to original page after login** (`Frontend/src/pages/Login/LoginPage.tsx:229`) — Always goes to `/dashboard` regardless of the page that triggered session expiry. Users lose their place.

29. **Stale client-side session causes redirect loop to broken dashboard** (`Frontend/src/pages/Login/LoginPage.tsx:138`) — `hasSessionAuth()` returns true from stale data, redirecting to dashboard without backend session validation. All API calls fail, user is trapped on erroring dashboard.

#### UX — Missing Feedback & State (3)

30. **Registration deadline not rechecked during multi-step flow** (`Frontend/src/pages/Events/EventWorkflowPages.tsx:87`) — `isClosed` computed once at render. Deadline could pass while user is on step 2 or 3. Confirm button still visible, server rejects with confusing error.

31. **Apply button always available regardless of application status** (`Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx:258`) — "Apply Now" never changes to "Applied", enabling duplicate applications and confusion.

32. **Error boundary fallback has no navigation option** (`Frontend/src/components/ErrorBoundary.tsx:82`) — Only "Try Again" and error details. No "Back to Dashboard" or "Go Back". Users stuck in infinite retry loop on persistent errors.

#### Concurrency — Race Conditions (3)

33. **markCircuitFailure Redis read-modify-write race** (duplicate of #6 above but counted once in totals)
34. **useOptimistic double-submit causes incorrect rollback state** (`Frontend/src/hooks/useOptimistic.ts:13`) — Two rapid `update()` calls overwrite `prevValue.current`, causing rollback to wrong state on rejection. Lost-update race.

35. **Three stores lack WAL mode** (duplicate of #17 CRITICAL — already counted)

#### Architecture — Coupling (0 additional — 4 listed above is exhaustive)

**Fix priorities (HIGH):** (1) Remove query-string session ID resolution. (2) Add server-side session deletion on logout and session rotation on login. (3) Remove query-parameter-based admin password acceptance. (4) Add idempotency keys to ERP mutation actions. (5) Add transition validation matrix to career application states. (6) Standardize response envelope across all routes. (7) Add WAL mode to the three non-compliant stores. (8) Implement post-login redirect to original page. (9) Guard evaluateSubmission against modifying published results. (10) Fix the 6 API field mismatches (location, type, isCompetition, name/email/dept, myRole, public profile identity).

---

### MEDIUM — 41 findings

#### Authentication & CSRF (3)

1. **No CSRF protection on auth endpoints** (`Backend/src/routes/authRoutes.js`) — No CSRF tokens, SameSite only 'lax', no custom header requirements. Query-string session ID acceptance exacerbates.

2. **Public profile endpoint has weak rate limiting** (`Backend/src/routes/profileRoutes.js:30-31`) — Only global 400 req/min. Enables bulk scraping of student public profiles (skills, achievements, readiness scores).

3. **Admin password persisted in browser sessionStorage accessible to XSS** (`Frontend/src/lib/campus/adminApi.ts:22-25`) — Raw admin password stored in `window.sessionStorage`. Any XSS on any page of same origin can exfiltrate it.

#### Data Pipeline (4)

4. **InMemoryErpCacheStore silently accumulates expired entries** (`Backend/src/services/erp/erpServices.js:158`) — Expired entries cleaned only on read. Entries written without `expiresAt` accumulate forever, causing unbounded heap growth and eventual OOM.

5. **Background refresh failures silently swallowed** (`Backend/src/services/erp/erpAggregationService.js:819`) — `.catch(() => {})` swallows all errors (circuit breaker trip, session expiry, timeout). No metric, no log, no alert.

6. **RedisErpCacheStore doesn't enforce embedded TTL** (`Backend/src/services/erp/erpServices.js:192`) — Reads expired cache entries if Redis TTL hasn't expired yet. Inconsistent with InMemoryErpCacheStore behavior. Clock skew between processes and Redis causes cache-hit-ratio drift.

7. **FeePaidPage pipeline failure renders misleading empty state** (`Frontend/src/pages/ERP/FeePaidPage.tsx:92`) — When pipeline fails, data is set to empty arrays with warnings. Main content area displays "No payment receipts found" even though the system failed to load data.

#### Business Logic — Events & Competitions (2)

8. **No state transition path validation in transitionEvent** (`Backend/src/services/events/eventsStore.js:800`) — Draft can jump to archived without ever being published. Archived can transition back to published. No transition matrix defined.

9. **Team members cannot leave after ANY team submission across all rounds** (`Backend/src/services/events/competitionStore.js:1825`) — `leaveTeam` blocks leaving if ANY submission exists by the team, even from a different round. Member who joined for Round 1 can't leave before Round 2.

#### Business Logic — Career (1)

10. **Bookmark count can go negative on unsave** (`Backend/src/services/career/careerStore.js:930`) — `unsaveOpportunity` decrements without `Math.max(0, ...)` guard. Data corruption or race can set bookmarkCount to -1. LMS `toggleBookmark` does this correctly.

#### Business Logic — LMS (2)

11. **Resource deletion does not free user storage quota** (`Backend/src/services/lms/lmsStore.js:1888`) — `createResource` adds fileSize to `totalBytes` but `deleteResource` never subtracts. Storage tracking inflates over time. Users hit quota early with deleted files still counting.

12. **Quiz attempt answer array length not validated against question count** (`Backend/src/services/lms/lmsStore.js:1050`) — Shorter answers array causes undefined comparisons (counted as wrong). Longer array silently drops extra answers. No warning on mismatch.

#### Business Logic — Helpdesk (2)

13. **Tickets can be escalated multiple times redundantly** (`Backend/src/services/campus/helpdeskStore.js:578`) — Re-escalating already escalated ticket clutters audit trail but has no functional effect. No guard or clear message.

14. **Replies can be added to resolved tickets without reopening** (`Backend/src/services/campus/helpdeskStore.js:610`) — Ticket stays RESOLVED while receiving new replies. Hidden from open-tickets queue. Issue recurrence goes unnoticed.

#### Business Logic — Unified Profile (2)

15. **Event achievement sync resets createdAt timestamps on every profile build** (`Backend/src/services/core/unifiedProfileStore.js:535`) — `upsertAchievement` sets `createdAt = nowIso()` on UPDATE path too. Every profile build rewrites achievement creation dates.

16. **Competition achievement sync queries return duplicate submissions** (`Backend/src/services/core/unifiedProfileStore.js:581`) — Two queries (submittedBy + team membership json_each) can return same row. Second occurrence discarded by `seen` Set.

#### Business Logic — Campus Feedback (1)

17. **Spam throttle checks per-target but not globally per user** (`Backend/src/services/campus/campusFeedbackStore.js:422`) — 10-minute window per type+target+user. User can submit 500 feedback entries for 500 different targets, flooding moderation queue.

#### Architecture (6)

18. **Core lib imports ApiError from feature module erp/** (`Frontend/src/lib/core/apiClient.ts`) — `apiClient.ts` and `requestUtils.ts` (lib/core/) import from `../erp/index`. Core infrastructure depends on feature module. Creates layering violation: core → erp → core cycle.

19. **Redis client never closed on graceful shutdown** (`Backend/server.js:335`) — Shutdown handler closes HTTP server, intervals, LMS queue, logger, but never calls `redisClient.quit()`. Process may hang on exit.

20. **Rate limiter applied after body parsing** (`Backend/src/app.js:89`) — `express.json()` (2MB limit) runs before global rate limiter. Abusive clients force 2MB JSON parsing before being counted.

21. **Auth guard logic duplicated across route files in 3 incompatible patterns** (`Backend/src/routes/eventsRoutes.js:10`) — Some files use per-handler throws (35+ call sites), others use `router.use()` middleware. Each redefines `ensureAuthenticated` locally. Forgetting the guard creates unprotected endpoints.

22. **Eight service classes crammed into one 811-line file** (`Backend/src/services/lms/lmsServices.js`) — Contains LmsDuplicateDetector, LmsExamFeedbackService, LmsFeatureFlagService, LmsInteractionQueue, LmsInteractionTracker, LmsModerationService, LmsReadingTimeEstimator, LmsRecommendationEngine, LmsRevisionScheduler — 9 classes in one module.

23. **DI wiring is implicitly order-dependent with no graph validation** (`Backend/server.js:114-228`) — Procedural construction sequence. Inserting a service in the wrong position or removing a seemingly-unused parameter silently breaks the app.

#### API Contract Drift (6)

24. **Events routes use different response envelope than all other routes** (`Backend/src/routes/eventsRoutes.js:23` vs `Frontend/src/lib/core/apiClient.ts:5`) — Works at runtime via frontend auto-detection but inconsistent for any future consumer that doesn't go through `requestData`.

25. **Backend has two distinct error envelope shapes controlled by env var** (`Backend/src/utils/apiResponse.js:42` vs `Frontend/src/lib/core/requestUtils.ts:4`) — Feature flag toggles between `{error: string}` and `{error: {code, message, retryable}}`. Events routes always use string form.

26. **ERP document field in frontend type is never populated by backend** (`Frontend/src/lib/erp/api.ts:32` vs `Backend/src/services/erp/erpAggregationService.js:11`) — `ErpPageResponse.document` always `undefined`. Misleading type.

27. **ERP meta field shape mismatched** (`Frontend/src/lib/erp/api.ts:28` vs `Backend/src/services/erp/erpAggregationService.js:25`) — Frontend expects `normalizationRules`/`issues` but backend returns `targets`/`financePaidIntegrity`.

28. **GET /career/opportunities returns no pagination metadata** (`Backend/src/routes/careerRoutes.js:171` vs `Frontend/src/lib/career/careerApi.ts:378`) — No `total`, `nextCursor`, `hasMore`. Infinite scroll or "load more" impossible without backend changes.

29. **Frontend expects posterImagePath, backend stores coverImageUrl** (`Frontend/src/lib/events/competitionsApi.ts:102` vs `Backend/src/services/events/eventsStore.js:699`)

#### UX — Feedback & State (7)

30. **No automatic captcha refresh on failed login** (`Frontend/src/pages/Login/LoginPage.tsx:218`) — Server invalidates old captcha on failed attempt. User fixes captcha text and resubmits, gets another error because the captcha image is stale.

31. **Brief empty state flash before loading skeleton** (`Frontend/src/pages/Shared/useBlueprintPageData.ts:12`) — Initial state has `isLoading: false`, briefly showing "No data sections available" before useEffect fires and activates loading overlay.

32. **Silent failure on bookmark and tracker operations** (`Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx:123`) — All mutations wrapped in try/catch with only `console.error`. User sees icon change (optimistic) but server may have rejected it with no feedback.

33. **Date range filter is decorative and does not filter** (`Frontend/src/pages/Events/EventsListingPage.tsx:307`) — `readOnly` date input shows "Upcoming This Week" but `filteredEvents` `useMemo` doesn't consider date. Dead interaction undermines trust.

34. **Discard Draft button has no onClick handler** (`Frontend/src/pages/Events/CreateEventPage.tsx:258`) — Button appears interactive but does nothing. Type not `"button"` — defaults to `"submit"` which may accidentally submit form.

35. **No back-navigation when resource is not found** (`Frontend/src/pages/LMS/ResourceDetailPage.tsx:122`) — 404 on deleted/moderated resource shows error with no "Browse resources" button. Users must use browser back or command palette.

36. **Command palette route visibility depends solely on stale isAdmin boolean** (`Frontend/src/components/NavigationCommandPalette.tsx:91`) — No additional permission check. Stale `admin.isAdmin` can show/hide admin routes incorrectly.

#### Concurrency (5)

37. **toggleUpvote and toggleBookmark use read-check-then-write without transaction** (`Backend/src/services/lms/lmsStore.js:2101,2121`) — Two processes both check, find no row, both INSERT. No `OR IGNORE`. Second INSERT hits PRIMARY KEY violation and throws 500. Counter incremented twice.

38. **getOrRunInflight dedup is per-process only** (`Backend/src/services/erp/erpAggregationService.js:669`) — In cluster/worker_threads, two processes launch same upstream ERP scrape. One result discarded. Should be documented as scope-limited.

39. **Concurrent buildUnifiedProfile for same user races on skill/achievement upserts** (`Backend/src/services/core/unifiedProfileStore.js:641`) — Two simultaneous profile builds can interleave snapshot writes. Final snapshot may miss skill C.

40. **loginWithCaptcha has no dedup for concurrent session refresh** (`Backend/src/services/erp/erpClient.js:1523`) — Two tabs detect SESSION_EXPIRED simultaneously. Both call login. Last write wins. First caller's subsequent requests may use overwritten storageState.

41. **Competition store lacks WAL mode and transactions** (`Backend/src/services/events/competitionStore.js:1971`) — Accessed from profile builds during competition publishing. Reader blocks on writer up to 5000ms.

#### Business Logic — Low severity (moved to bottom of MEDIUM)

42. **SLA due date not recalculated when ticket priority changes** (`Backend/src/services/campus/helpdeskStore.js:504`) — Upgrade from low (72h) to urgent (4h) doesn't recalculate slaDueAt. Urgent ticket still has 62h remaining instead of 4h.

43. **Legacy feedback import loses original submitter identity** (`Backend/src/services/campus/campusFeedbackStore.js:523`) — All 50 imported entries show admin's userId as creator. Students see nothing in `listMine` feedback.

44. **No resubmission workflow for rejected feedback** (`Backend/src/services/campus/campusFeedbackStore.js:714`) — Students never notified of rejection. Feedback shows as "pending" from their perspective but is permanently rejected with no recourse.

**Fix priorities (MEDIUM):** (1) Add periodic expiry sweep to InMemoryErpCacheStore. (2) Add metrics/logging to background refresh failures. (3) Align Redis cache TTL enforcement with in-memory store. (4) Move rate limiter before body parsing. (5) Standardize auth guard on router.use() pattern with shared middleware. (6) Add transition validation for event states. (7) Add global per-user throttle for campus feedback. (8) Fix bookmarkCount negative guard. (9) Add storage quota decrement on resource deletion. (10) Add CSRF tokens to auth endpoints. (11) Fix the 6 MEDIUM API drift issues.

---

### LOW — 23 findings

#### Business Logic (3)

1. **SLA not recalculated on priority change** (`Backend/src/services/campus/helpdeskStore.js:504`)
2. **Legacy feedback import loses original author** (`Backend/src/services/campus/campusFeedbackStore.js:523`)
3. **No resubmission for rejected feedback** (`Backend/src/services/campus/campusFeedbackStore.js:714`)

#### Architecture & Coupling (6)

4. **Centralized Express error handler is dead code** (`Backend/src/app.js:229-234`) — Every route catches errors and sends responses internally. Never calls `next(error)`. Centralized handler never fires for route errors.

5. **Catch-all route silently redirects to / on 404** (`Frontend/src/routes/index.tsx:14`) — No user-facing 404 page. Users navigating to mistyped/removed URL silently land on homepage.

6. **AdminMode and Event contexts not in AppProviders** (`Frontend/src/AppProviders.tsx`) — `useAdminMode()` outside `AdminModeProvider` crashes with no graceful fallback.

7. **No validation of user-supplied route params** (`Backend/src/routes/eventsRoutes.js:126`) — `req.params.eventId`, `roundId`, etc. passed directly to stores without format/length checks. Malformed IDs produce 500 errors.

8. **Auth routes registered under both /api/ and /api/auth/ prefixes** (`Backend/src/routes/authRoutes.js:84`) — Every endpoint doubled for no documented purpose. Doubles attack surface and maintenance burden.

9. **CompetitionStore at 1998 lines** — (Mentioned in tech debt but included here for architectural completeness.)

#### API Contract Drift (3)

10. **CareerOpportunity fields `skillMatch`, `similar`, `personalizedScore` never populated** (`Frontend/src/lib/career/careerApi.ts:51-63` vs `Backend/src/routes/careerRoutes.js:96-113`)
11. **POST /career/opportunities/:id/apply ignores req.body.notes** (`Backend/src/routes/careerRoutes.js:239`)
12. **Resume upload returns `fileName` not `resumeFileName`** (`Frontend/src/lib/career/careerApi.ts:79-80`)

#### UX (7)

13. **Generic empty state offers no actionable guidance** (`Frontend/src/pages/Shared/BlueprintPage.tsx:77`)
14. **Generic loading message in SuspenseWrapper** (`Frontend/src/components/SuspenseWrapper.tsx:8`)
15. **Error state with no retry action on many BlueprintPage instances** (`Frontend/src/pages/Shared/BlueprintPage.tsx:27`)
16. **Developer stack traces exposed in production ErrorBoundary** (`Frontend/src/components/ErrorBoundary.tsx:107`)
17. **Same empty state for zero search results and empty catalog** (`Frontend/src/pages/LMS/BrowsePage.tsx:112`)
18. **Generic error for deleted vs unavailable opportunities** (`Frontend/src/pages/CareerPortal/OpportunityDetailPage.tsx:115`)
19. **No persistent error indicator on registration failure** (`Frontend/src/pages/Events/EventWorkflowPages.tsx:161`)

#### Concurrency (4)

20. **Distributed lock silently degrades to no-op when Redis unreachable** (`Backend/src/services/erp/erpAggregationService.js:624`) — Fail-open allows 120 concurrent upstream requests instead of 30.
21. **useOptimistic has no timeout; API hang keeps UI in indefinite pending** (`Frontend/src/hooks/useOptimistic.ts:13`)
22. **Semaphore.release allows double-release, letting current count drift** (`Backend/src/utils/asyncUtils.js:44`)
23. **qualityMonitoring calls evaluateUnifiedInsightPayload 3 times with same payload** (`Backend/src/services/lms/lmsTrackerService.js:904`) — 3x redundant computation.

---

### Summary

**119 logical/architectural issues identified across 7 audit dimensions: 19 CRITICAL, 36 HIGH, 41 MEDIUM, 23 LOW.**

The most dangerous patterns:

- **Auth privilege escalation**: Four CRITICAL vectors (auto-elevation, password-bypass unlock, role spoofing via headers, identity spoofing via headers) let unauthenticated or low-privilege users gain admin/faculty access. These are the highest-priority fixes.

- **Data corruption without transactions**: Three SQLite stores (eventsStore, careerStore, competitionStore) write multi-statement mutations (6-key persist, delete-insert loops) without transactions or WAL mode. Process crash during these operations causes permanent data corruption. The other three stores (lmsStore, unifiedProfileStore, lmsTrackerStore) handle this correctly — a partial migration.

- **API contract drift**: 19 mismatches between backend and frontend contracts. Four CRITICAL (event dates, registration count, profile update response, apply response) cause silent `undefined` access in production. Location, type, and isCompetition fields are dead on arrival.

- **Session management**: No session rotation on login, no server-side invalidation on logout, query-string session IDs, password-in-query-params. Every session is permanently vulnerable after logout.

- **Deadlines and state loss**: Multi-step wizards lose all state on refresh. Registration deadlines aren't rechecked mid-flow. Error boundary fallback traps users. Apply button never reflects already-applied state.

- **God objects and encapsulation**: LmsTrackerService (1417 lines, 5 domains), CompetitionStore (1998 lines, 10+ tables, multer config), UnifiedProfileStore accessing other stores' internal Maps and SQLite databases directly.


## 📋 Effort Estimate Summary

| Priority | Area | Items | Estimated Effort |
|---|---|---|---|
| **🔴 Production Blockers** | TLS/SSL configuration | 1 | 2-3 days |
| | CI/CD pipeline (GitHub Actions) | 1 | 3-5 days |
| | Environment separation + .env.example | 1 | 1-2 days |
| | Secrets management cleanup | 1 | 1-2 days |
| | Frontend Dockerfile | 1 | 1 day |
| | Automated backup scripts | 1 | 2-3 days |
| | Alertmanager configuration | 1 | 1 day |
| | **Subtotal** | **7** | **11-17 days** |
| **🟡 Known Gaps** | Missing frontend transformers (7 items) | 7 | 5-8 days |
| | Transformer defects (5 items) | 5 | 2-3 days |
| | Platform module feature gaps (20 items) | 20 | 15-25 days |
| | Testing gaps (15 items) | 15 | 10-15 days |
| | Documentation gaps (12 items) | 12 | 5-8 days |
| | Infrastructure gaps (11 items) | 11 | 5-8 days |
| | Missing runbooks (6 items) | 6 | 2-3 days |
| | **Subtotal** | **76** | **44-70 days** |
| **🔵 Deferred / Future** | Design system implementation | - | 10-15 days |
| | Future platform features | - | 20-30 days |
| | Analytics provider wiring | - | 3-5 days |
| | **Subtotal** | - | **33-50 days** |
| **⚪ Tech Debt** | God file splits (27 files) | 27 | 15-25 days |
| | Error boundaries (all routes) | 1 | 3-5 days |
| | Dead code removal (15 items) | 15 | 2-3 days |
| | Dependency cleanup (4 items) | 4 | 1-2 days |
| | Hardcoded value extraction (5 items) | 5 | 2-3 days |
| | Configuration fixes (7 items) | 7 | 2-3 days |
| | Code quality fixes (5 items) | 5 | 3-5 days |
| | Cross-cutting architecture (5 items) | 5 | 5-10 days |
| | **Subtotal** | **69** | **33-56 days** |
| | **GRAND TOTAL** | **~152 items** | **~121-193 days** |

### Quick Wins (1-2 days each)
1. Remove dead code: `calendar.tsx`, `ui/Tabs.tsx`, `lms/http.ts`, `lms/types.ts`, 12 unused PNG assets
2. Consolidate icon libraries (drop `@heroicons/react` or `lucide-react`)
3. Move `shadcn` from dependencies to devDependencies
4. Add `VITE_API_PROXY_TARGET` env variable to `vite.config.ts`
5. Replace hardcoded `#ffffff` in `components.css` with CSS variable
6. Fix duplicate `warnings` declaration in `FeePaidPage.tsx`
7. Create root `README.md` with quick-start instructions
8. Add `.env.example` files for Frontend and Backend
9. Remove `Stitch Design.zip` from git history (BFG Repo-Cleaner)
10. Add HTTP-to-HTTPS redirect in nginx config (once TLS is configured)

### Production Ready Target (highest priority)
After completing the 7 Production Blockers (~11-17 days), the platform could run securely in production, but would still carry significant gaps in test coverage, documentation, and monitoring maturity. A safer "production ready" target including the most critical Known Gaps would be approximately 30-45 days of focused work.
