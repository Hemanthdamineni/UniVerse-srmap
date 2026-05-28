# Career Opportunity Governance Evidence

Date: 2026-05-26

## Implementation
- Student submissions now always remain `pending` until admin review; removed auto-approval from the submission path.
- Added submission governance metadata: reviewer, review reason, published opportunity ID, fingerprint, and audit trail.
- Added duplicate checks across active opportunities and pending submissions.
- Added admin reasoned review endpoint: `PATCH /api/career/submit/:submissionId`.
- Added signed-in submitter status endpoint: `GET /api/career/submit/mine`.
- Admin direct publish validates title, type, and `https://` apply URL and publishes immediately.
- Frontend submitter page shows prior submission statuses and rejection reasons.
- Admin career opportunities page shows pending submission review queue with required approve/reject reasons.

## Verification
- Backend: `npm --prefix Backend test -- test/careerOpportunityGovernance.test.js`
- Frontend: `npm --prefix Frontend test -- SubmitOpportunityPage.test.tsx AdminCareerOpportunitiesPage.test.tsx`
- E2E: `VITE_STATIC_PROTOTYPE=true npm --prefix Frontend run test:e2e -- career-opportunity-governance.spec.ts`
- Build: `npm --prefix Frontend run build`

## Runtime Evidence
- Pending queue benchmark: 10,000 submissions, 20 paginated queue reads, p95 `2.77ms`, under the pagination target.
- Screenshots:
  - `docs/evidence/production-readiness/career-opportunity-submit-desktop-2026-05-26.png`
  - `docs/evidence/production-readiness/career-opportunity-admin-mobile-2026-05-26.png`

## Rollback Notes
- Disable the admin queue by removing `/admin/career-opportunities` queue rendering while preserving direct opportunity publishing.
- Keep `career_submission_audit` and review columns; they are additive and preserve governance history.
- To revert to old behavior, reintroducing auto-approval must be paired with a product decision because it violates the readiness rule that user submissions require approval.
