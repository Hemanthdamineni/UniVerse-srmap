# Campus Feedback Governance Evidence - 2026-05-26

## Scope
- Feature: separate official ERP feedback from unofficial campus/community feedback.
- Official route family: `/api/feedback/end-semester/*`
- Unofficial route family: `/api/campus-feedback/*`
- Frontend routes: `/feedback/events-feedback`, `/feedback/hostel-mess-feedback`, `/feedback/transport-feedback`, `/admin/campus-feedback`

## Test Evidence
- Backend targeted tests:
  - Command: `npm test -- test/campusFeedbackStore.test.js test/campusFeedbackRoutes.test.js test/feedbackAutomationService.test.js`
  - Result: 3 test files passed, 9 tests total.
  - Coverage added in `Backend/test/campusFeedbackRoutes.test.js`: unauthenticated submissions return 401, students can submit unofficial feedback, students cannot access the admin queue, and admins can approve with an audit trail.
  - Performance coverage added in `Backend/test/campusFeedbackStore.test.js`: seeded 10,000 SQLite rows and asserted the paginated admin queue p95 stays under 300ms.
  - Latest measured p95: 6.39ms for `/api/campus-feedback/admin/submissions` store-equivalent query with 10,000 rows, status filter, 50-row page, and batched audit loading.
- Frontend targeted tests:
  - Command: `npm test -- CampusFeedbackPage.test.tsx AdminCampusFeedbackPage.test.tsx`
  - Result: 2 test files passed.
- Playwright e2e:
  - Command: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- campus-feedback-governance.spec.ts`
  - Result: 1 Chromium test passed.
  - Flow proved student submission through unofficial events feedback, governance copy showing both namespaces, admin queue visibility, and reasoned approval.

## UX Evidence
- Student desktop screenshot: `docs/evidence/production-readiness/campus-feedback-student-desktop-2026-05-26.png`
- Student mobile screenshot: `docs/evidence/production-readiness/campus-feedback-student-mobile-2026-05-26.png`
- Admin desktop screenshot: `docs/evidence/production-readiness/campus-feedback-admin-desktop-2026-05-26.png`
- Admin mobile screenshot: `docs/evidence/production-readiness/campus-feedback-admin-mobile-2026-05-26.png`

## Contract Evidence
- API docs: `docs/07-API-REFERENCE.md`
- ERP split docs: `docs/05-ERP-INTEGRATION.md`

## Data And Migration Evidence
- Backend store: `Backend/src/services/campusFeedbackStore.js`
  - Separate SQLite tables: `campus_feedback_options`, `campus_feedback_entries`, `campus_feedback_audit`.
  - `legacy-import` endpoint migrates existing browser-local unofficial entries into the API-backed moderation queue.
  - Store enforces spam throttling, de-duplication, internal actor identity, anonymous-style display, and reason-required moderation.
  - Student and admin list endpoints are paginated with `limit`/`offset`; admin audit history is loaded in one batch for the visible page.
- Frontend migration path: `Frontend/src/pages/Feedback/CampusFeedbackPage.tsx`
  - Reads legacy localStorage keys once, imports entries through `/api/campus-feedback/:type/legacy-import`, then removes those local keys.

## Rollback Notes
- Backend rollback: remove `Backend/src/routes/campusFeedbackRoutes.js` from the app mount, stop instantiating `CampusFeedbackStore`, and leave official ERP feedback under `/api/feedback/end-semester/*` untouched.
- Data rollback: retain the SQLite database file for audit review. If the campus feedback feature must be disabled, do not delete `campus_feedback_entries` until imported legacy rows have been exported or reviewed.
- Frontend rollback: hide the `/admin/campus-feedback` nav target and switch unofficial feedback pages to a read-only maintenance state. Do not restore production localStorage-only submission, because that violates the governance split.
- Legacy import rollback: imported rows can be identified by `campus_feedback_audit.action = 'legacy_imported'`; those entries can be exported or removed in a transaction if a migration needs to be replayed.

## Closeout Notes
- What was implemented: dedicated unofficial namespace, persistence schema, governance banners, localStorage migration, moderation queue, status history, audit entries, role-boundary tests, and e2e flow.
- What is still missing: external load testing against a deployed HTTP server remains pending; in-process SQLite store p95 evidence now covers the 10k-row admin queue path.
- Technical debt introduced: static prototype admin queue does not include the full `createdBy` actor object, so screenshots show `Student (unknown)` even though backend responses include actor identity.
- Mocked/faked parts: screenshots and e2e use the static prototype in-memory API, not a production SQLite database.
- Scalability limitations: store benchmark covers indexed SQLite list behavior with 10k rows, not multi-user HTTP concurrency.
- Security limitations: admin protection depends on the existing admin-mode/session system plus backend role checks; no external penetration test was run.
- Suggested next improvements: run a deployed HTTP load test for concurrent moderation reads and writes.
