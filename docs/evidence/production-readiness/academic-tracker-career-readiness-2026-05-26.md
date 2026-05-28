# Academic Tracker Career Readiness Evidence - 2026-05-26

## Scope
- Feature: academic tracker analytics plus career-aware readiness signals.
- Backend service: `Backend/src/services/lmsTrackerService.js`
- Frontend pages: `/academic-tracker/progress-overview`, `/academic-tracker/academic-insights`

## Implementation Evidence
- `LmsTrackerService` now accepts `careerStore` and combines ERP academic signals with career profile, resume, skill-gap, opportunity, and application data.
- `/api/lms/tracker/overview` and `/api/lms/tracker/insights` pass the authenticated user context into the tracker service.
- `getInsights` now builds overview and insights from one ERP batch load instead of duplicating ERP fetches.
- Added `LmsTrackerStore` with SQLite tables for persisted analytics snapshots and recommendation events:
  - `lms_tracker_snapshots`
  - `lms_tracker_recommendation_events`
- Added tracker APIs for persisted data:
  - `GET /api/lms/tracker/history`
  - `GET /api/lms/tracker/recommendation-events`
  - `POST /api/lms/tracker/recommendation-events`
- Overview and insights responses now include snapshot metadata and recent history summaries when tracker persistence is configured.
- Insights generation records academic and career recommendation events with source domain, confidence, title, id, and payload metadata.
- Career readiness payload includes:
  - profile completeness score with component breakdown and missing fields
  - ATS-style resume score with suggestions
  - skill gaps tied to active opportunity counts
  - opportunity recommendations with matched skills, missing skills, confidence, reasons, and `inputsUsed`
  - next actions tied to resume state, skill gaps, opportunity matches, and application tracking
- Frontend tracker pages now render career readiness metrics, top skill gaps, action steps, resume score, and explainable opportunity recommendations.
- Frontend tracker pages now render analytics trace and recommendation trace panels so users/operators can see persistence and generated recommendation events.
- Static prototype tracker fixtures now cover career readiness, persisted snapshots, and recommendation event traces for browser evidence.

## Test Evidence
- Backend targeted test:
  - Command: `npm test -- test/lmsTrackerService.test.js`
  - Result: 2 tests passed.
  - Coverage: verifies attendance risk, skill gaps, matched/missing opportunity skills, resume suggestion, next action, academic inputs in explainability metadata, one ERP batch load for the insights path, persisted snapshots, generated recommendation events, recommendation event reads, and explicit interaction event ingestion.
- Frontend targeted tests:
  - Command: `npm test -- ProgressOverview.test.tsx AcademicInsights.test.tsx`
  - Result: 2 tests passed.
  - Coverage: verifies career readiness UI, analytics trace, snapshot metadata, explainable career recommendation UI, and recommendation event trace rendering.
- Playwright e2e:
  - Command: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- academic-tracker-career-readiness.spec.ts`
  - Result: 1 Chromium test passed.
  - Coverage: verifies `/academic-tracker/progress-overview` and `/academic-tracker/academic-insights` render career readiness, analytics trace, persisted snapshot state, recommended opportunity, and recommendation trace.
- Combined backend regression subset:
  - Command: `npm test -- test/lmsTrackerService.test.js test/campusFeedbackStore.test.js test/campusFeedbackRoutes.test.js test/erpFinanceIntegrity.test.js test/erpAggregationService.test.js`
  - Result: 5 test files passed.
- Frontend build:
  - Command: `npm run build`
  - Result: TypeScript and Vite production build passed.

## UX Evidence
- Desktop screenshot: `docs/evidence/production-readiness/academic-tracker-overview-desktop-2026-05-26.png`
- Mobile screenshot: `docs/evidence/production-readiness/academic-tracker-insights-mobile-2026-05-26.png`

## Data And Rollback Evidence
- Schema owner: `Backend/src/services/lmsTrackerStore.js`.
- Default DB path: `LMS_TRACKER_DB_PATH`, falling back to `Backend/data/lms-tracker.sqlite`.
- Rollback: stop passing `trackerStore` into `LmsTrackerService` to make snapshot/event persistence inert while preserving read-only analytics behavior.
- Data rollback: snapshot/event tables can be archived independently from LMS learning-resource tables because they live in a separate SQLite database by default.
- Interaction rollback: disable or remove `POST /api/lms/tracker/recommendation-events`; generated recommendation events will still be traceable from insights generation if persistence remains enabled.

## Closeout Notes
- What was implemented: career-aware analytics payload, persisted snapshot/event schema, tracker history/event APIs, frontend action-plan UI, analytics/recommendation trace UI, backend tests, frontend tests, browser e2e, and screenshots.
- What is still missing: deployed HTTP latency/load testing for tracker persistence and fresh live ERP screenshots with a real authenticated student session.
- Technical debt introduced: tracker event ingestion accepts a compact generic payload; the later unified personalization task should formalize all event types across LMS/career/academic modules.
- Mocked/faked parts: backend test uses fake ERP and career stores; production code uses real `erpAggregationService` and `careerStore`.
- Scalability limitations: no benchmark was run for large career opportunity catalogs or high-volume recommendation event streams.
- Security limitations: no new authorization model was introduced; tracker endpoints continue to rely on the existing LMS route session guard.
- Suggested next improvements: add HTTP load tests for tracker history/event endpoints and connect recommendation click/apply UI events from career pages into the tracker event endpoint.
