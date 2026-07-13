# Companion Platform Production Readiness Runbook

## Scope

Use this runbook before promoting LMS, Career, Events, Competition, and Unified Profile companion-platform changes to staging or production.

## Preconditions

- Backend and frontend dependencies are installed.
- Backend data directory is writable by the runtime user.
- Backup policy includes:
  - LMS SQLite database and LMS file directory
  - Career SQLite database
  - Events and Competition SQLite databases/data directory
  - Unified Profile SQLite database (`UNIFIED_PROFILE_DB_PATH`)
- A staging user session exists for manual UAT after automated checks.

## Automated Gate

Run from repository root:

```bash
cd Backend
npm test -- --test-reporter=spec test/careerStore.test.js test/careerRoutes.test.js test/lmsCommunityGovernance.test.js test/competitionStore.test.js test/unifiedProfileStore.test.js test/profileRecommendationRoutes.test.js
npm run smoke:companion

cd ../Frontend
npm test -- --run src/components/lms/ResourceCard.test.tsx src/lib/careerApi.test.ts src/pages/CareerPortal/CareerProfilePage.test.tsx src/pages/CareerPortal/OpportunityDetailPage.test.tsx src/pages/Events/EventsRegistrationHub.test.tsx
npm run build
```

Required result: every command exits `0`.

## Staging Smoke

1. Start backend with staging SQLite paths and `UNIFIED_PROFILE_DB_PATH` set.
2. Start frontend against the staging backend.
3. Sign in as a student.
4. Career: upload or paste a text resume, confirm quality score and profile skill sync.
5. Career: open an opportunity, confirm profile fit, matched skills, and missing skills render.
6. LMS: open Learning Home, confirm Exam prep and Recommended for you sections load.
7. Events: open a team-scoped competition, create a team, publish recruitment needs, and confirm candidate matches render.
8. Unified Insights/Profile: recompute profile and confirm competition achievements remain private by default.

## Release Criteria

- Automated gate passes.
- Staging smoke passes with no 5xx errors.
- New SQLite files are present in backup inventory.
- Privacy defaults remain conservative: resume, achievements, LMS activity, and event participation are not public by default.
- No migration requires replacing ERP, LMS, Career, Events, or Competition stores.

## Rollback

1. Disable frontend navigation to new companion-platform surfaces if needed.
2. Roll back backend image.
3. Preserve new SQLite files for forensic inspection; do not delete profile or domain data during rollback.
4. Restore previous frontend bundle.
5. Re-run `/api/ready`, ERP smoke checks, and companion smoke against the restored version.
