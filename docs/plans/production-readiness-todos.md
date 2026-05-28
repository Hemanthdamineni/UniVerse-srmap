# University ERP Production Readiness TODOs

Last updated: 2026-05-25
Owner: Product + Engineering
Status scale: 0-100% reflects production readiness, not LOC written

## Research Baseline (Current State)
- Fee paid combines multiple finance sources (`finance/fee-paid-details`, `finance/payment-acknowledgment`, `finance/online-payment-verification`) and currently deduplicates by receipt in transformer logic:
  - `Frontend/src/lib/erpTransformers.ts`
  - `Frontend/src/pages/ERP/FeePaidPage.tsx`
  - `Backend/src/config/scrapeTargets.js`
- Official course feedback already uses ERP-backed automation (`/feedback/end-semester/*`), but unofficial feedback pages are local storage based:
  - Official: `Frontend/src/pages/Feedback/CourseFeedbackAssistantPage.tsx`, `Backend/src/routes/feedbackRoutes.js`
  - Unofficial/local: `Frontend/src/pages/Feedback/EventsFeedback.tsx`, `Frontend/src/pages/Feedback/HostelMessFeedback.tsx`, `Frontend/src/pages/Feedback/TransportFeedback.tsx`
- Academic tracker currently uses ERP academic signals only (attendance/marks/CGPA) and no resume/career signals:
  - `Frontend/src/lib/academicTracker.ts`
  - `Backend/src/services/lmsTrackerService.js`
- Helpdesk routes and admin actions exist, but operational triage dashboards and ownership workflows are minimal:
  - `Backend/src/routes/helpdeskRoutes.js`
  - `Backend/src/services/helpdeskStore.js`
  - `Frontend/src/pages/Helpdesk/TrackEscalate.tsx`
- Event creation/listing/registration/submission routes exist in both FE and BE, but "Events Registration" in registration module is currently external summary mode:
  - `Frontend/src/config/erpBlueprints.ts` (`/registration/events-registration` is `sourceMode: external`, `integrationState: summary`)
  - `Frontend/src/main.tsx`
  - `Backend/src/routes/eventsRoutes.js`
- LMS already has upvote/flag/recommendation endpoints, but publisher identity, trust, and moderation workflows are not fully productized:
  - `Backend/src/routes/lmsRoutes.js`
  - `Backend/src/services/lmsStore.js`
  - `Backend/src/services/lmsRecommendationEngine.js`
- Career opportunities already support user submissions and admin approval in API, but admin/user workflows, auditability, and visibility need hardening:
  - `Backend/src/routes/careerRoutes.js`
  - `Frontend/src/pages/CareerPortal/SubmitOpportunityPage.tsx`
  - `Frontend/src/pages/Admin/AdminCareerOpportunitiesPage.tsx`
- Insight systems exist in LMS and Career but not as a unified personalization layer with explicit ATS and next-action intelligence.

## Global Delivery Rules (Mandatory)
1. Never mark a task complete without evidence.
2. Every task requires:
   - implementation
   - tests
   - screenshots
   - edge-case handling
   - documentation updates
3. "UI only" implementations are invalid unless explicitly requested.
4. Placeholder/mock implementations must be labeled clearly.
5. Any hardcoded data is incomplete.
6. Every feature must integrate with existing architecture:
   - routes
   - transformers
   - schemas
   - caching
   - notifications
   - permissions
   - logging
7. Prefer extending existing systems over creating parallel systems.
8. If architecture conflicts exist, stop and report before implementing.
9. Any skipped requirement must be documented explicitly.
10. Completion percentage must reflect production readiness, not code written.

## Global Definition of Evidence
- Test evidence: unit + integration + at least one e2e flow per task
- Runtime evidence: logs/metrics proving behavior in non-happy paths
- UX evidence: desktop + mobile screenshots
- Contract evidence: updated API docs and request/response examples
- Data evidence: migration scripts + rollback notes + seed data

---

# Task: Fee Paid Scraping and Table Integrity

## Goal
Ensure all fee-paid source pages are represented correctly without unintended table collapse, missing rows, or ambiguous merges.

## Must Have
- Per-source extraction visibility (`Fee Paid Details`, `Payment Acknowledgment`, `Online Payment Verification`)
- Deterministic merge strategy with source provenance per row
- Duplicate handling by stable key (`receiptNo`, fallback hash)
- Frontend rendering that can display either:
  - separate sections per source, or
  - merged table with source column (explicit)
- Regression tests covering 3-page scrape cases

## Explicitly NOT Allowed
- Silent row dropping
- Implicit combine without source labeling
- Hardcoded row fixes in UI
- Ignoring missing source pages without warnings

## Required Integrations
- `Backend/src/config/scrapeTargets.js`
- `Backend/src/services/erpPayloadNormalizer.js`
- `Frontend/src/lib/erpTransformers.ts`
- `Frontend/src/pages/ERP/FeePaidPage.tsx`
- ERP batch fetch + caching path (`/api/v2/erp/*`)

## Required Deliverables
- Transformer update and tests
- FE display update (source-aware)
- Observability logs for per-source row counts
- API/transform docs update
- Before/after screenshots

## Acceptance Tests
- With 3 valid finance pages, user sees all rows from all pages
- Duplicate receipt appears once, with deterministic conflict resolution
- If one page fails, UI shows partial data + warning banner naming failed source
- Row count before and after transform is traceable in logs

## Failure Conditions
- Any source page contributes zero rows without explicit warning
- Merged output cannot identify origin source
- Table count/row count differs across repeated runs for same payload

## Edge Cases
- Empty page tables
- Header-shifted rows
- Duplicate receipts with mismatched amount/date
- Print action present for only subset of rows

## Performance Constraints
- No extra ERP calls beyond configured fetch keys
- Transformer execution under 150ms for typical finance payload
- No blocking UI operations on row post-processing

## Completion Definition
Task is complete ONLY IF feature works end-to-end, data is persisted/traceable, APIs/docs are updated, errors handled, mobile layout verified, and logs/metrics added.

## Implementation Evidence — 2026-05-25
- Implemented backend one-source-per-fetch-key mapping for `finance/fee-paid-details`, `finance/payment-acknowledgment`, and `finance/online-payment-verification`.
- Added backend `meta.financePaidIntegrity` row-count diagnostics and `erp_finance_paid_source_rows` metric for fee-paid ERP responses.
- Updated frontend fee-paid transformer to preserve source provenance, merge duplicate receipts deterministically, warn on empty/failed/malformed sources, and expose raw/extracted/deduplicated counts.
- Updated `FeePaidPage` to pass full batch envelopes into the transformer, render source warnings and source labels, and execute print actions using the row source page key.
- Added backend and frontend regression tests for source mapping, row-count metadata, 3-source transform, duplicate conflict handling, partial source failure UI, and print-source routing.
- Updated ERP integration and API docs for fee-paid source integrity.
- Added 2026-05-26 evidence artifact: `docs/evidence/production-readiness/fee-paid-integrity-2026-05-26.md`.
- Added Playwright e2e route coverage: `Frontend/e2e/fee-paid-integrity.spec.ts`.
- Added transformer performance regression: typical 180-row, three-source fee-paid transform measured at 3.72ms and asserted under the 150ms production constraint.
- Captured desktop and mobile screenshots:
  - `docs/evidence/production-readiness/fee-paid-desktop-2026-05-26.png`
  - `docs/evidence/production-readiness/fee-paid-mobile-2026-05-26.png`
  - `docs/evidence/production-readiness/fee-paid-mobile-table-top-2026-05-26.png`
- Existing live audit fixture proves the source pages were reachable from ERP on 2026-05-10 (`Backend/data/live-page-audit/2026-05-10T11-02-27-383Z/summary.json`), but a fresh live ERP re-audit after these exact changes still requires manual ERP login through `Backend/scripts/audit-live-frontend-payloads.js`.

---

# Task: Separate Official and Unofficial Feedback Systems

## Goal
Split feedback into two explicit products:
- Official ERP feedback (course/end-semester, university governed)
- Unofficial campus feedback (student/community governed with moderation)

## Must Have
- Separate route namespaces and labels in nav/UI
- Separate storage schemas and access control policies
- Official feedback locked to ERP workflow + audit logs
- Unofficial feedback supports moderation, visibility, and retention policy
- Explicit disclaimers in UI showing data owner/governance path

## Explicitly NOT Allowed
- Mixing official and unofficial entries in one list
- LocalStorage-only unofficial feedback in production mode
- Reusing official feedback submit endpoint for unofficial forms
- Missing governance labels

## Required Integrations
- Official: `Backend/src/routes/feedbackRoutes.js`
- Unofficial: extend `Backend/src/routes/helpdeskRoutes.js` or create dedicated `campus-feedback` routes
- Frontend pages under `Frontend/src/pages/Feedback/*`
- Navigation/blueprints: `Frontend/src/config/erpBlueprints.ts`, `Frontend/src/config/navigationRegistry.ts`

## Required Deliverables
- New backend persistence for unofficial feedback
- Migration from browser-local data to API-backed data
- Moderation/admin queue UI
- Updated IA copy and labels
- Test suite for permission boundaries

## Acceptance Tests
- Student submits unofficial feedback and sees it in their history
- Admin can moderate unofficial feedback without touching official ERP feedback
- Official course feedback continues using ERP session-bound automation
- Unauthorized user cannot access admin moderation endpoints

## Failure Conditions
- Any shared table/endpoint stores both official and unofficial data types
- Unofficial feedback still depends on local storage in production build
- Official feedback can be edited/deleted through unofficial controls

## Edge Cases
- Anonymous-style display while retaining internal actor identity
- Moderation reject with reason
- Duplicate submissions/spam throttling
- Edit window policy (if enabled)

## Performance Constraints
- Feedback list endpoints p95 < 300ms (cached query path)
- No full-page reloads for moderation actions

## Completion Definition
Task is complete ONLY IF governance split is enforced technically (routes/schemas/permissions), UX is explicit, and full tests/docs/evidence exist.

## Implementation Evidence — 2026-05-26
- Added dedicated unofficial campus feedback namespace `/api/campus-feedback/*` with separate SQLite persistence in `CampusFeedbackStore`.
- Kept official ERP course feedback isolated under `/api/feedback/end-semester/*`; campus moderation cannot mutate official feedback.
- Added API-backed events, hostel/mess, and transport feedback pages with governance banners, anonymous student-facing display, internal actor retention, status history, and pending moderation state.
- Added admin-only Campus Feedback moderation queue at `/admin/campus-feedback` with type/status filters, submitter context, audit visibility, and required approve/reject reasons.
- Added admin target creation for event and transport feedback; hostel/mess uses a fixed service target.
- Added bounded legacy import from the old browser-local feedback keys into API-backed pending moderation entries.
- Added duplicate/spam throttle for repeated same-user same-target submissions.
- Added structured backend logs for unofficial feedback submission and moderation decisions.
- Added backend tests for persistence, moderation boundaries, reason enforcement, throttling, and route namespace coverage.
- Added frontend tests for student submission flow and admin moderation action routing.
- Updated API and ERP integration docs for the official/unofficial governance split.
- Strengthened backend route tests on 2026-05-26 to cover unauthenticated 401, student submission, non-admin admin-queue denial, and audited admin approval through the Express router.
- Added Playwright e2e flow: `Frontend/e2e/campus-feedback-governance.spec.ts`.
- Added paginated student/admin list responses with `limit`, `offset`, and `total`; admin moderation audit history now loads in a single batch for the visible page.
- Added 10k-row SQLite benchmark coverage for the admin queue path. Latest measured p95: 6.39ms for status-filtered 50-row pages, under the 300ms target.
- Added rollback notes for disabling the feature, preserving campus feedback SQLite data, and replaying/removing legacy localStorage imports by `legacy_imported` audit action.
- Evidence captured:
  - Backend targeted test: `npm test -- test/campusFeedbackStore.test.js test/campusFeedbackRoutes.test.js test/feedbackAutomationService.test.js`
  - Frontend targeted test: `npm test -- CampusFeedbackPage.test.tsx AdminCampusFeedbackPage.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- campus-feedback-governance.spec.ts`
  - Evidence artifact: `docs/evidence/production-readiness/campus-feedback-governance-2026-05-26.md`
  - Student desktop screenshot: `docs/evidence/production-readiness/campus-feedback-student-desktop-2026-05-26.png`
  - Student mobile screenshot: `docs/evidence/production-readiness/campus-feedback-student-mobile-2026-05-26.png`
  - Admin desktop screenshot: `docs/evidence/production-readiness/campus-feedback-admin-desktop-2026-05-26.png`
  - Admin mobile screenshot: `docs/evidence/production-readiness/campus-feedback-admin-mobile-2026-05-26.png`
- Remaining production hardening: external deployed HTTP concurrency testing is still recommended, but the required list-query latency and rollback evidence are now covered in local executable evidence.

---

# Task: Proper Academic Tracker (Beyond Placeholder Analytics)

## Goal
Implement a real academic and career-aware analytics engine combining ERP academic data with resume/profile/skill/career signals.

## Must Have
- Semester-wise CGPA trends
- Attendance trends per subject
- Marks progression charts
- At-risk subject detection
- Resume/profile completeness scoring
- Skill gap mapping against opportunities
- Actionable next steps (what to learn, what to apply for)
- Backend APIs + persistent history snapshots
- Frontend dashboard + drilldowns

## Explicitly NOT Allowed
- Placeholder cards
- Static/mock data
- Hardcoded analytics
- Fake recommendation text
- Empty dashboards
- TODO comments left in production code

## Required Integrations
- ERP attendance/marks/cgpa transformers
- `Frontend/src/lib/academicTracker.ts`
- `Backend/src/services/lmsTrackerService.js`
- Career profile/resume/opportunity data:
  - `Backend/src/routes/careerRoutes.js`
  - `Backend/src/services/careerStore.js`
- Existing session/profile/permissions system

## Required Deliverables
- Unified analytics service
- DB schema for snapshots and recommendation events
- FE pages/components for overview + insights + action center
- API docs
- Screenshots/videos
- Test cases
- Seed/demo data

## Acceptance Tests
- User with 3 semesters sees trends correctly
- Attendance risk warning appears below threshold
- Skill gaps map to recommended opportunities and resources
- Tracker updates after ERP refresh and profile update
- APIs return validated, typed payloads
- No `[object Object]` rendering issues

## Failure Conditions
- Recommendations generated without citing data inputs
- Any recommendation remains unchanged after meaningful input change
- Tracker fails closed when one source is missing (should degrade gracefully)

## Edge Cases
- Empty semester data
- Missing attendance
- Partial ERP failure
- Invalid marks rows
- No resume uploaded
- Freshers with no application history

## Performance Constraints
- Dashboard load < 2 seconds with cached data
- No duplicate ERP fetches
- No frontend blocking requests
- Recompute pipeline runs async and does not block API request threads

## Completion Definition
Task is complete ONLY IF end-to-end analytics is real, persisted, explainable, documented, tested, and mobile-ready.

## Implementation Evidence — 2026-05-26
- Added career-aware readiness signals to `Backend/src/services/lmsTrackerService.js` by injecting `careerStore`.
- `/api/lms/tracker/overview` and `/api/lms/tracker/insights` now combine ERP academic data with career profile, resume, skill-gap, opportunity, and application signals.
- Added explainability fields for career opportunity recommendations: matched skills, missing skills, confidence, reasons, and `inputsUsed`.
- Added ATS-style resume scoring and profile completeness breakdowns.
- Refactored tracker insights to reuse one ERP batch load for overview and insights, satisfying the no-duplicate-fetch constraint for that path.
- Updated `ProgressOverview` and `AcademicInsights` to render career readiness metrics, top skill gaps, next actions, and explainable recommended opportunities.
- Added backend regression: `Backend/test/lmsTrackerService.test.js`.
- Added `Backend/src/services/lmsTrackerStore.js` with SQLite-backed persisted history snapshots and recommendation event storage.
- Added tracker persistence endpoints: `GET /api/lms/tracker/history`, `GET /api/lms/tracker/recommendation-events`, and `POST /api/lms/tracker/recommendation-events`.
- Overview and insights payloads now include snapshot metadata and history summaries when persistence is configured.
- Insights generation records academic and career recommendation events with source domains, confidence, and traceable payload metadata.
- Updated tracker UI to show analytics trace and recommendation trace panels.
- Added frontend regression tests: `Frontend/src/pages/AcademicTracker/ProgressOverview.test.tsx` and `Frontend/src/pages/AcademicTracker/AcademicInsights.test.tsx`.
- Added Playwright e2e: `Frontend/e2e/academic-tracker-career-readiness.spec.ts`.
- Captured evidence artifact: `docs/evidence/production-readiness/academic-tracker-career-readiness-2026-05-26.md`.
- Evidence captured:
  - Backend targeted test: `npm test -- test/lmsTrackerService.test.js`
  - Frontend targeted test: `npm test -- ProgressOverview.test.tsx AcademicInsights.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- academic-tracker-career-readiness.spec.ts`
  - Combined backend regression subset: `npm test -- test/lmsTrackerService.test.js test/campusFeedbackStore.test.js test/campusFeedbackRoutes.test.js test/erpFinanceIntegrity.test.js test/erpAggregationService.test.js`
  - Frontend production build: `npm run build`
  - Desktop screenshot: `docs/evidence/production-readiness/academic-tracker-overview-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/academic-tracker-insights-mobile-2026-05-26.png`
- Remaining production hardening: deployed HTTP latency/load testing and fresh live ERP screenshots with a real authenticated student session are still recommended.

---

# Task: Helpdesk Admin Triage and Resolution Workflow

## Goal
Deliver operationally reliable admin handling for tickets so admins know what is pending, owned, breached, and resolved.

## Must Have
- Queue segmentation: new, in-progress, escalated, resolved, breached
- Assignment model: owner/team, reassignment, workload view
- SLA policy and breach timers
- Resolution notes + internal notes + public replies
- Audit trail for every state transition
- Admin filters/search and bulk actions
- Notification hooks (optional phase 2: email/push)

## Explicitly NOT Allowed
- Status changes without audit history
- Ticket resolution without resolution summary
- Admin actions without permission checks
- Frontend-only status simulation

## Required Integrations
- `Backend/src/services/helpdeskStore.js`
- `Backend/src/routes/helpdeskRoutes.js`
- `Frontend/src/pages/Helpdesk/TrackEscalate.tsx`
- `Frontend/src/pages/Admin/AdminHelpdeskTicketsPage.tsx`
- Metrics/audit route stack

## Required Deliverables
- Schema enhancements for ownership + SLA + audit metadata
- Admin UI for triage and workload management
- Escalation policy implementation
- Ops runbook updates
- Test coverage (role-based + SLA logic)

## Acceptance Tests
- Admin sees accurate counts by queue state
- Ticket can move through full lifecycle with complete status history
- SLA breach flag activates automatically after threshold
- Non-admin cannot mutate ticket status
- Resolution action requires non-empty summary

## Failure Conditions
- Tickets can be orphaned without assignee/state
- Closed tickets reopen without reason trail
- SLA breach count mismatches ticket-level indicators

## Edge Cases
- Duplicate ticket subjects
- Admin handoff between teams
- Internal-only comment visibility enforcement
- Repeated escalation attempts

## Performance Constraints
- Ticket list query supports pagination and filtering under p95 < 400ms
- Bulk status update of 100 tickets under 2 seconds

## Completion Definition
Task is complete ONLY IF admin operations are auditable, permission-safe, measurable, and proven via tests.

## Implementation Evidence — 2026-05-26
- Added queue segmentation for `new`, `in-progress`, `escalated`, `breached`, and `resolved` tickets.
- Added priority-based SLA policy and automatic breach detection.
- Added ownership and workload metadata: owner, assigned team, assignee, SLA due date, and active workload summary.
- Added auditable state/action trail for ticket creation, status changes, assignment, resolution, escalation/repeated escalation, public replies, and internal notes.
- Enforced admin-only mutations, non-empty resolution summaries for resolution, and non-empty notes when reopening resolved tickets.
- Enforced internal-only comment visibility so students do not see admin internal notes.
- Added `PATCH /api/helpdesk/tickets/bulk` for up to 100 selected tickets.
- Updated `/admin/helpdesk-tickets` with queue filters, search, workload chips, owner/team assignment, resolution summary, internal note, audit visibility, and bulk action.
- Updated API docs: `docs/07-API-REFERENCE.md`.
- Added backend regression: `Backend/test/helpdeskStore.test.js`.
- Added frontend regression: `Frontend/src/pages/Helpdesk/TrackEscalate.test.tsx`.
- Added Playwright e2e: `Frontend/e2e/helpdesk-admin-triage.spec.ts`.
- Evidence captured:
  - Backend targeted test: `npm test -- test/helpdeskStore.test.js`
  - Frontend targeted test: `npm test -- TrackEscalate.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- helpdesk-admin-triage.spec.ts`
  - Bulk update timing: 100 tickets in 112.41ms, under the 2-second target.
  - Evidence artifact: `docs/evidence/production-readiness/helpdesk-admin-triage-2026-05-26.md`
  - Desktop screenshot: `docs/evidence/production-readiness/helpdesk-admin-triage-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/helpdesk-admin-triage-mobile-2026-05-26.png`
- Remaining production hardening: deployed HTTP concurrency testing and a normalized SQL helpdesk schema are still recommended.

---

# Task: Events Registrations and Submissions Productization

## Goal
Make event registration/submission fully discoverable and functional in main UX, not hidden behind partial/summary pathways.

## Must Have
- Event registration flow visible and linked from event detail and nav
- Submission flow visibility by event/round phase
- "My registrations" and "my submissions" status tracking
- Admin/organizer view for registration and submission monitoring
- Remove confusion between ERP registration summary page and internal events platform

## Explicitly NOT Allowed
- Summary-only stub replacing real registration state
- Dead links to event routes
- Submission pages reachable without phase/permission checks

## Required Integrations
- FE routes: `Frontend/src/main.tsx`, `Frontend/src/config/erpBlueprints.ts`
- Event pages/context: `Frontend/src/pages/Events/*`, `Frontend/src/contexts/EventContext.tsx`
- BE routes/store: `Backend/src/routes/eventsRoutes.js`, `Backend/src/routes/competitionRoutes.js`, `Backend/src/services/eventsStore.js`

## Required Deliverables
- IA/navigation updates
- Route guards and discoverability fixes
- End-to-end registration/submission telemetry
- UX copy clarifying ERP events registration vs platform events
- Test suite for route visibility and eligibility

## Acceptance Tests
- Student can discover, register, submit, and track status from standard nav
- Organizer can view registrants and round submissions
- Route deep links load correctly after refresh
- Registration state syncs correctly in event detail/action buttons

## Failure Conditions
- Registration exists in API but is not reachable from primary UI path
- Submission state differs between user dashboard and organizer dashboard
- "Events Registration" page misleads users away from actual event flow

## Edge Cases
- Team vs solo events
- Registration closed windows
- Multi-round events with rolling submissions
- Withdraw/cancel registration

## Performance Constraints
- Event detail first meaningful load < 2 seconds from warm cache
- No duplicate fetch storms for same event context

## Completion Definition
Task is complete ONLY IF registration + submission are discoverable, actionable, and synchronized across user roles.

## Implementation Evidence — 2026-05-26
- Replaced `/registration/events-registration` summary/external mode with a native internal Events Registration hub.
- Updated `Frontend/src/config/erpBlueprints.ts` so `/registration/events-registration` is `sourceMode: "internal"` and `integrationState: "native"`.
- Added `Frontend/src/pages/Events/EventsRegistrationHub.tsx` to link registration-module users into:
  - `/events` for discovery and event-detail registration
  - `/events/my-activity?tab=registered` for registration tracking
  - `/events/my-activity?tab=submissions` for submission tracking
  - `/events/my-created` for organizer monitoring
- Updated `Frontend/src/main.tsx` to mount the native hub.
- Updated API docs for `registered=true`, registration cancellation, and my-registration tracking.
- Added frontend regression: `Frontend/src/pages/Events/EventsRegistrationHub.test.tsx`.
- Added Playwright e2e: `Frontend/e2e/events-registration-productization.spec.ts`.
- Evidence captured:
  - Frontend targeted test: `npm test -- EventsRegistrationHub.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- events-registration-productization.spec.ts`
  - Evidence artifact: `docs/evidence/production-readiness/events-registration-productization-2026-05-26.md`
  - Desktop screenshot: `docs/evidence/production-readiness/events-registration-hub-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/events-registration-hub-mobile-2026-05-26.png`
- Remaining production hardening: browser proof of real register -> submit -> organizer review against a seeded backend session is still recommended.

---

# Task: LMS Community Moderation, Trust, and Engagement

## Goal
Evolve LMS into a community-managed system with robust contribution, trust, moderation, and recommendation loops.

## Must Have
- Resource contributions with clear publisher identity
- Publisher profile cards (what else they published, quality indicators)
- Upvotes, flags/reports, review comments, moderation state
- Abuse/spam handling rules and moderation queue
- Recommendation ranking that uses engagement + quality + personalization
- Transparent "why recommended" metadata

## Explicitly NOT Allowed
- Anonymous untraceable publishing
- Engagement actions without anti-abuse checks
- Recommendation output without measurable ranking inputs
- Hidden moderation decisions with no audit trail

## Required Integrations
- `Backend/src/routes/lmsRoutes.js`
- `Backend/src/services/lmsStore.js`
- `Backend/src/services/lmsRecommendationEngine.js`
- `Frontend/src/pages/LMS/LmsPagesShared.tsx`
- `Frontend/src/components/lms/*`

## Required Deliverables
- Moderation workflow spec + implementation
- Publisher identity and profile expansion
- Recommendation explainability fields
- Ranking metrics dashboards
- Test coverage for abuse and permissions

## Acceptance Tests
- User can see publisher and navigate to publisher contribution history
- Flagged resources move to moderation queue with reason
- Admin moderation decision updates visibility and search/recommendation eligibility
- Recommendation endpoint returns ranked items + reason codes

## Failure Conditions
- Flagged resources remain publicly ranked without moderation guard
- Publisher attribution missing on detail pages
- Recommendation ranking ignores user engagement signals

## Edge Cases
- Deleted user accounts with legacy content
- Mass-flag attack patterns
- Resource updates after recommendation cache generation

## Performance Constraints
- Recommendation endpoint p95 < 350ms with cached candidate pool
- Moderation queue query p95 < 300ms

## Completion Definition
Task is complete ONLY IF LMS community lifecycle (publish, engage, moderate, recommend) is end-to-end and auditable.

## Implementation Evidence — 2026-05-26
- Added migration-backed LMS moderation audit records and resolved flag state.
- Resource payloads now include publisher trust summaries, contribution counts, moderation labels, visibility eligibility, and recommendation eligibility.
- Resource reporting now requires reasons, blocks self-reporting, applies a daily report limit, and records audit events.
- Added admin-only LMS moderation queue endpoints:
  - `GET /api/lms/admin/resource-flags`
  - `PATCH /api/lms/admin/resources/:id/moderation`
- Admin moderation decisions resolve open flags, write reviewer audit entries, and update search/recommendation visibility.
- Recommendation ranking now uses engagement, quality, personalization, recency, effectiveness, topic gaps, exam signals, and publisher trust.
- Recommendation responses now include `recommendationScore`, `confidence`, `reasons`, `inputsUsed`, and `rankingPolicy`; openly flagged resources are excluded from recommendations.
- Added frontend publisher trust cards, contributor profile history, moderation state visibility, why-recommended chips, and `/admin/lms-moderation`.
- Updated API docs: `docs/07-API-REFERENCE.md`.
- Added evidence artifact: `docs/evidence/production-readiness/lms-community-governance-2026-05-26.md`.
- Evidence captured:
  - Backend targeted test: `npm test -- test/lmsCommunityGovernance.test.js`
  - Frontend targeted test: `npm test -- ResourceCard.test.tsx AdminLmsModerationPage.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- lms-community-governance.spec.ts`
  - Frontend production build: `npm run build`
  - Moderation queue benchmark: 300 reported resources, p95 5.98ms, under the 300ms target.
  - Desktop screenshot: `docs/evidence/production-readiness/lms-community-home-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/lms-community-moderation-mobile-2026-05-26.png`
- Remaining production hardening: deployed HTTP latency testing and full fairness review of moderation decision outcomes are still recommended.

---

# Task: Opportunities Submission and Approval Governance

## Goal
Allow admins and users to add opportunities with strict governance: admins publish directly, users require approval.

## Must Have
- Distinct flows:
  - Admin direct publish
  - User submission -> pending -> admin approve/reject
- Submission validation and deduplication
- Review queue with reasoned decisions
- Publish audit trail (who approved, when, why)
- User feedback on submission status

## Explicitly NOT Allowed
- User-submitted opportunities auto-publishing
- Approvals without reviewer identity
- Missing audit trail for rejected submissions

## Required Integrations
- `Backend/src/routes/careerRoutes.js`
- `Backend/src/services/careerStore.js`
- `Frontend/src/pages/CareerPortal/SubmitOpportunityPage.tsx`
- `Frontend/src/pages/Admin/AdminCareerOpportunitiesPage.tsx`

## Required Deliverables
- Submission lifecycle schema updates
- Admin queue UX and decision workflow
- Notification/status surfacing for submitter
- Test suite for role boundaries + lifecycle
- Docs for opportunity governance policy

## Acceptance Tests
- Admin-created opportunity is visible immediately
- User-submitted opportunity remains pending until approved
- Approved item appears in public opportunity feed
- Rejected item shows rejection reason to submitter

## Failure Conditions
- Pending items leak into public feed
- Admin actions not attributed
- Duplicate opportunities pass through without dedupe warnings

## Edge Cases
- Same opportunity submitted by multiple users
- Expired opportunity approved late
- Reviewer conflict of interest workflow

## Performance Constraints
- Pending queue with 10k submissions remains queryable with pagination
- Approval action latency < 500ms (excluding async notifications)

## Completion Definition
Task is complete ONLY IF opportunity lifecycle is enforced by permissions and transparent to both submitters and admins.

## Implementation Evidence — 2026-05-26
- Removed student submission auto-approval; submissions now remain `pending` until admin review.
- Added submission governance schema fields for reviewer identity, review reason, published opportunity ID, duplicate fingerprint, and audit records.
- Added duplicate checks across public opportunities and pending submissions.
- Added signed-in submitter status endpoint: `GET /api/career/submit/mine`.
- Added admin reasoned review endpoint: `PATCH /api/career/submit/:submissionId`.
- Admin-created opportunities validate required fields and publish directly to the public feed.
- Submitter UI now shows pending/rejected/approved status and rejection reasons.
- Admin career opportunities UI now includes a pending submission queue with required approve/reject reasons.
- Updated API docs: `docs/07-API-REFERENCE.md`.
- Added evidence artifact: `docs/evidence/production-readiness/career-opportunity-governance-2026-05-26.md`.
- Evidence captured:
  - Backend targeted test: `npm test -- test/careerOpportunityGovernance.test.js`
  - Frontend targeted test: `npm test -- SubmitOpportunityPage.test.tsx AdminCareerOpportunitiesPage.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm run test:e2e -- career-opportunity-governance.spec.ts`
  - Frontend production build: `npm run build`
  - Pending queue benchmark: 10,000 submissions, p95 2.77ms.
  - Desktop screenshot: `docs/evidence/production-readiness/career-opportunity-submit-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/career-opportunity-admin-mobile-2026-05-26.png`
- Remaining production hardening: external notification delivery to submitters is still recommended, but status/reason visibility is implemented in-app.

---

# Task: Unified Insights, Personalization, and Recommendations (Academic + Career)

## Goal
Implement a cross-domain intelligence layer that gives accurate, explainable, and actionable recommendations for academics and career readiness.

## Must Have
- Unified profile graph (academic, LMS, resume, applications, engagement)
- ATS-like resume scoring with explainable rubric
- Next-skill recommendations tied to opportunity demand
- Opportunity recommendations tied to eligibility and profile gaps
- Academic and career action plans in one dashboard
- Feedback loop from user actions to ranking models

## Explicitly NOT Allowed
- Generic motivational text as "recommendation"
- Opaque scores with no breakdown
- Static skill roadmap unrelated to user data
- Recommending ineligible opportunities

## Required Integrations
- Academic signals:
  - `Frontend/src/lib/academicTracker.ts`
  - `Backend/src/services/lmsTrackerService.js`
- Career signals:
  - `Backend/src/services/careerStore.js`
  - `Backend/src/routes/careerRoutes.js`
- LMS signals:
  - `Backend/src/services/lmsRecommendationEngine.js`
  - `Backend/src/services/lmsStore.js`
- FE delivery pages: Academic Tracker + Career pages + Dashboard

## Required Deliverables
- Recommendation service contract and scoring schema
- Explainability payload format (`reasons`, `confidence`, `inputsUsed`)
- Frontend "why this recommendation" UI
- Offline evaluation harness + baseline metrics
- Monitoring dashboards for recommendation quality

## Acceptance Tests
- User receives different recommendations after profile/skill change
- ATS score includes component breakdown and improvement suggestions
- Ineligible opportunities are filtered out
- Recommendation click/apply events improve later relevance scores

## Failure Conditions
- Same recommendation list for materially different users
- Recommendations generated without eligibility checks
- No traceability from recommendation to source signals

## Edge Cases
- Sparse data users (cold start)
- Contradictory signals (high CGPA, low resume quality)
- Stale caches after major profile update

## Performance Constraints
- Recommendation API p95 < 400ms from warm cache
- Profile re-score pipeline completes within 2 minutes after update

## Completion Definition
Task is complete ONLY IF recommendations are data-driven, explainable, measurable, and adaptive over time.

## Implementation Evidence — 2026-05-26
- Added unified scoring contract `unified-insights-v1` in `Backend/src/services/lmsTrackerService.js`.
- Added profile graph, ATS-style resume rubric, next-skill demand recommendations, eligible opportunity recommendations, unified action plan, feedback loop, and quality monitoring payloads.
- Added `GET /api/lms/tracker/unified-insights` and career alias `GET /api/career/insights/unified`.
- Recommendation payloads include `reasons`, `confidence`, `inputsUsed`, and eligibility metadata.
- Recommendation feedback events now influence later unified confidence scoring for clicked/saved/applied/dismissed recommendations.
- Added offline evaluation harness: `npm --prefix Backend run evaluate:unified-insights`.
- Added frontend route `/academic-tracker/unified-insights`, Academic Tracker navigation, Dashboard quick link, and Career Portal entry point.
- Updated API docs: `docs/07-API-REFERENCE.md`.
- Added evidence artifact: `docs/evidence/production-readiness/unified-insights-personalization-2026-05-26.md`.
- Evidence captured:
  - Backend targeted test: `npm --prefix Backend test -- test/lmsTrackerService.test.js`
  - Offline evaluation harness: `npm --prefix Backend run evaluate:unified-insights`
  - Frontend targeted test: `npm --prefix Frontend test -- UnifiedInsights.test.tsx`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm --prefix Frontend run test:e2e -- unified-insights.spec.ts`
  - Frontend production build: `npm --prefix Frontend run build`
  - Desktop screenshot: `docs/evidence/production-readiness/unified-insights-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/unified-insights-mobile-2026-05-26.png`
- Residual production hardening: replace fixture offline baseline with anonymized production replay and add scheduled drift monitoring after live traffic exists.

---

# Task: Audit and Improve Admin Content Management Workflow

## Goal
Make admin content operations reliable, auditable, scalable, and safe across create/edit/review/publish/archive flows.

## Must Have
- Full workflow mapping of admin actions (create, edit, publish, unpublish, archive, delete, restore)
- Explicit state machine for content lifecycle
- Role/permission matrix for each admin action
- Audit log coverage for all mutating actions
- Bulk operations with preview and rollback protection
- Change history and diff view for critical content updates
- Queue-based review for high-impact content categories

## Explicitly NOT Allowed
- Direct destructive updates without audit records
- Hidden admin-only changes with no actor attribution
- Bulk action execution without preview/confirmation
- Reusing student-facing flows as admin workflow substitutes

## Required Integrations
- `Frontend/src/pages/Admin/AdminContentManagementPage.tsx`
- `Frontend/src/pages/Resources/LearningMaterialsPage.tsx` (admin mode branch)
- `Backend/src/routes/contentRoutes.js`
- `Backend/src/routes/resourceRoutes.js`
- `Backend/src/services/contentStore.js`
- `Frontend/src/lib/lmsApi.ts`

## Required Deliverables
- Admin workflow specification with state transitions
- Backend schema updates for versioning/audit metadata
- Admin UI updates for lifecycle controls and bulk ops
- Runbook updates for rollback and emergency content takedown
- Test suite for permissions, lifecycle transitions, and bulk actions

## Acceptance Tests
- Admin can create, publish, unpublish, and archive content with state visible in UI
- Every content mutation stores actor, timestamp, and before/after delta reference
- Bulk update shows dry-run preview and executes atomically
- Non-admin attempts on admin actions return 403 consistently
- Restored content reappears in catalog according to moderation state

## Failure Conditions
- Content changes occur without audit entry
- Soft-deleted content becomes inaccessible for restore
- Bulk operations partially apply without clear failure report
- Admin mode can be bypassed by client-side checks only

## Edge Cases
- Concurrent edits by two admins
- Delete/restore cycles on content with linked resources
- Large batch updates with mixed valid/invalid items
- Orphaned resources after parent content delete

## Performance Constraints
- Admin list/filter endpoints p95 < 400ms with pagination
- Bulk operation of 200 items completes < 3 seconds with transaction safety

## Completion Definition
Task is complete ONLY IF admin content operations are lifecycle-driven, audited, permission-safe, and recoverable.

## Implementation Evidence — 2026-05-26
- Added backend content lifecycle states: `draft`, `review`, `published`, `unpublished`, `archived`, `deleted`.
- Added content schema fields for lifecycle state, version, deleted timestamp, and last actor.
- Added `content_audit` table with action, actor, reason, before/after payloads, field diff, and timestamp.
- Converted admin delete to soft lifecycle deletion; restore is available through lifecycle transitions.
- Added workflow spec endpoint, content history endpoint, lifecycle transition endpoint, and preview-first atomic bulk lifecycle endpoints.
- Updated resource admin endpoints to use lifecycle/audit metadata and expose history/bulk operations for learning materials.
- Admin UI now shows lifecycle map, role/safety workflow, state/version/actor in queue rows, lifecycle controls, dry-run bulk preview, execute-after-preview, and audit diff history.
- Added runbook: `docs/runbooks/admin-content-lifecycle.md`.
- Updated API docs: `docs/07-API-REFERENCE.md`.
- Added evidence artifact: `docs/evidence/production-readiness/admin-content-lifecycle-2026-05-26.md`.
- Evidence captured:
  - Backend targeted tests: `npm --prefix Backend test -- test/contentStore.test.js test/contentRoutes.test.js`
  - Frontend targeted test: `npm --prefix Frontend test -- AdminContentManagementPage.test.tsx --pool=forks`
  - Static browser e2e: `VITE_STATIC_PROTOTYPE=true npm --prefix Frontend run test:e2e -- admin-content-lifecycle.spec.ts`
  - Frontend production build: `npm --prefix Frontend run build`
  - Desktop screenshot: `docs/evidence/production-readiness/admin-content-lifecycle-desktop-2026-05-26.png`
  - Mobile screenshot: `docs/evidence/production-readiness/admin-content-lifecycle-mobile-2026-05-26.png`
- Residual production hardening: add UI-level concurrent edit warnings once multi-admin production traffic exists.

---

# Task: Improve Recommendation and Personalization System (Quality and Governance)

## Goal
Upgrade recommendation quality, explainability, and fairness with measurable offline/online evaluation and production controls.

## Must Have
- Unified recommendation contract across LMS, academic tracker, and career modules
- Explainability fields on every recommendation:
  - reason codes
  - input signal summary
  - confidence score
- Eligibility and policy filters enforced before ranking
- Experiment framework (A/B or shadow) with success metrics
- Feedback loop ingestion from clicks, saves, applies, completions
- Recommendation quality dashboard (CTR, conversion, satisfaction proxy, drift)

## Explicitly NOT Allowed
- Black-box scores without user-facing rationale
- Recommendations shown before eligibility validation
- Single static ranking formula without monitoring/drift checks
- Personalization based on unconsented sensitive attributes

## Required Integrations
- `Backend/src/services/lmsRecommendationEngine.js`
- `Backend/src/services/lmsInteractionTracker.js`
- `Backend/src/services/lmsTrackerService.js`
- `Backend/src/services/careerStore.js`
- `Backend/src/routes/lmsRoutes.js`
- `Backend/src/routes/careerRoutes.js`
- `Frontend/src/pages/LMS/LmsPagesShared.tsx`
- `Frontend/src/pages/AcademicTracker/AcademicInsights.tsx`
- `Frontend/src/pages/CareerPortal/*`

## Required Deliverables
- Recommendation contract/spec doc
- Backend ranking and policy filter refactor
- Explainability UI components
- Offline evaluation harness with baseline snapshots
- Online telemetry instrumentation and monitoring dashboards
- Guardrails for low-confidence fallback recommendations

## Acceptance Tests
- Recommendation payload includes reasons, confidence, and source domains
- Ineligible content/opportunities are not returned in final top-N
- User profile change causes measurable recommendation shift
- Shadow rank logs can be compared against displayed rank and outcome
- Low-signal users receive safe fallback recommendations with explicit labeling

## Failure Conditions
- No measurable difference between personalized and non-personalized cohorts
- Recommendation output cannot be traced to ranked candidates and filters
- Policy-filtered items appear in UI due to cache/race condition

## Edge Cases
- Cold-start users
- Data sparsity in one domain (academic/career/LMS)
- Conflicting signals (high engagement but low quality resources)
- Feedback loops prone to popularity bias

## Performance Constraints
- Top-N recommendation API p95 < 400ms (warm path)
- Re-ranking updates available within 5 minutes of major profile/interaction changes

## Completion Definition
Task is complete ONLY IF recommendation quality is measurable, explainable, policy-safe, and continuously monitored.

---

# Task: Add Safeguards/Moderation for Community-Maintained Content (Anti-Abuse + Anti-Censorship)

## Goal
Implement balanced governance that prevents spam/abuse while also preventing arbitrary or biased censorship.

## Must Have
- Multi-stage moderation pipeline:
  - automated risk scoring
  - community reports
  - moderator review
  - appeal/review outcome
- Clear policy taxonomy (spam, harassment, misinformation, IP violation, low quality)
- Reporter trust weighting and abuse-resistant report handling
- Moderation decision logs with reason codes
- Appeals workflow with SLA and secondary reviewer path
- Transparency features:
  - user-visible moderation status
  - decision reason
  - appeal status

## Explicitly NOT Allowed
- Permanent takedown without reason logging
- Auto-removal solely by report count without risk review thresholds
- Moderator action without identity attribution
- Silent shadow bans without policy basis

## Required Integrations
- `Backend/src/routes/lmsRoutes.js` (`/lms/resources/:id/flag`, `/lms/admin/flags`)
- `Backend/src/services/lmsStore.js`
- `Backend/src/services/lmsModerationService.js`
- `Frontend/src/pages/LMS/LmsPagesShared.tsx`
- `Frontend/src/components/lms/*`
- `Frontend/src/pages/Admin/AdminContentManagementPage.tsx`

## Required Deliverables
- Moderation policy document + enforcement matrix
- Schema updates for moderation decisions, appeals, and reviewer actions
- Admin moderation queue with evidence/context panel
- User appeal submission + tracking UI
- Anti-abuse rate limiting and anomaly detection hooks
- Tests for abuse prevention and anti-censorship safeguards

## Acceptance Tests
- Reported resource enters moderation queue with policy-tagged reason
- Moderator decision requires reason and is audit-logged
- Creator can view decision and submit appeal
- Appeal decision updates resource status with full audit trail
- Coordinated false-report attempts do not auto-remove valid resources

## Failure Conditions
- Resource removed without auditable decision record
- Appeals cannot be filed or tracked
- Single moderator can repeatedly suppress content without review checkpoints
- Report spam can force takedown of legitimate content

## Edge Cases
- Mass-report brigading
- Repeated offender behavior with escalating penalties
- Conflicting moderator decisions
- Policy updates affecting previously moderated content

## Performance Constraints
- Moderation queue endpoint p95 < 350ms
- Appeal status update reflected to creator within 30 seconds

## Completion Definition
Task is complete ONLY IF moderation is enforceable, transparent, appealable, abuse-resistant, and censorship-resistant.

---

## Cross-Task Implementation Plan
1. Foundation and Governance
   - finalize schemas, audit model, moderation policy, feature flags, rollout plan
2. Data Correctness First
   - fee-paid integrity, feedback split, helpdesk lifecycle hardening
3. Discoverability and Product Flows
   - events registration/submission visibility, opportunities workflow UX, admin content workflow
4. Intelligence Layer
   - academic tracker enrichment, unified personalization, explainable recommendations
5. Stabilization
   - load/perf tests, observability, docs, runbooks, release checklist, moderation fairness review

## Mandatory Closeout Template (Use Before Closing Any Task)
- What was implemented
- What is still missing
- Technical debt introduced
- Mocked/faked parts
- Scalability limitations
- Security limitations
- Suggested next improvements

If any section is non-empty, task cannot be marked 100% complete without explicit sign-off.
