# Unified Insights, Personalization, and Recommendations Evidence

Date: 2026-05-26

## Scope
- Added unified cross-domain scoring contract `unified-insights-v1`.
- Exposed `GET /api/lms/tracker/unified-insights` and career alias `GET /api/career/insights/unified`.
- Added profile graph, ATS-style resume rubric, next-skill demand recommendations, eligible opportunity recommendations, unified action plan, recommendation feedback loop, and quality monitoring payloads.
- Added offline evaluation harness: `npm --prefix Backend run evaluate:unified-insights`.
- Added frontend route `/academic-tracker/unified-insights`, Academic Tracker navigation entry, Dashboard quick link, and Career Portal entry point.

## Verification
- Backend targeted test: `npm --prefix Backend test -- test/lmsTrackerService.test.js`.
- Offline evaluation harness: `npm --prefix Backend run evaluate:unified-insights`.
- Frontend targeted test: `npm --prefix Frontend test -- UnifiedInsights.test.tsx`.
- Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm --prefix Frontend run test:e2e -- unified-insights.spec.ts`.
- Frontend production build: `npm --prefix Frontend run build`.

## Baseline Metrics
- Offline explainability coverage: 100%.
- Offline eligible opportunity rate: 100%.
- Offline aggregate profile signal coverage: 62.5%.
- Target recommendation API p95: < 400ms.
- Unit-level measured unified response time: < 400ms.

## Evidence Captured
- Desktop screenshot: `docs/evidence/production-readiness/unified-insights-desktop-2026-05-26.png`.
- Mobile screenshot: `docs/evidence/production-readiness/unified-insights-mobile-2026-05-26.png`.

## Residual Hardening
- Replace fixture-based offline baseline with replayed anonymized production recommendation events once production traffic exists.
- Add long-running scheduled monitoring for recommendation quality drift.
