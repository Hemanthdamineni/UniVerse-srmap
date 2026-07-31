# UniVerse ERP — Comprehensive Product Completion Plan

This document covers every remaining task to deliver a complete, production-ready website.
Each task is prioritized by user impact. Mark `[ ]` → `[x]` as each is verified complete.

---

## 1. NAVIGATION & ROUTING INTEGRITY

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1.1 | Verify every `MAIN_NAV` entry has a corresponding route in `erpRoutes.tsx` | HIGH | [x] |
| 1.2 | Verify every `PAGE_BLUEPRINT` has a route registered | HIGH | [x] |
| 1.3 | Remove routes/navigation entries pointing to deleted pages (ProgressOverview, AcademicInsights, UnifiedInsights, ResumeBuilder, CareerProfilePage old) | HIGH | [x] |
| 1.4 | Confirm `AcademicTrackerPage` → `AcademicHubPage` route redirect works | MEDIUM | [x] |
| 1.5 | Confirm `ProfessionalProfilePage` → `/career/me/profile` works | MEDIUM | [x] |
| 1.6 | Verify `TransportRoutesPage` renders at `/transport-hostel/routes` | HIGH | [x] |
| 1.7 | Verify `HostelBookingPage` renders at `/transport-hostel/hostel-booking` | HIGH | [x] |
| 1.8 | Check for dead navigation entries (routes in sidebar that 404) | HIGH | [x] |
| 1.9 | Verify `/feedback/course-feedback` route still works after cleanup | MEDIUM | [x] |
| 1.10 | Check command palette catalog routes match actual pages | MEDIUM | [ ] |

---

## 2. DATA FETCHING & API INTEGRATION

| # | Task | Priority | Status |
|---|------|----------|--------|
| 2.1 | Verify ERP batch endpoint (`/api/v2/erp/batch`) returns valid data for all fetchKeys | HIGH | [x] |
| 2.2 | Fix `findGroupedExtracted` in `shared.ts` to handle multi-key bundles | HIGH | [x] |
| 2.3 | Add null-safety on `extracted.records` in all parsers | HIGH | [x] |
| 2.4 | Add backend validation logging for empty/partial data in extractors | MEDIUM | [ ] |
| 2.5 | Verify fee-paid pipeline handles missing `_extracted` gracefully | HIGH | [x] |
| 2.6 | Check `FEEDBACK_AUTOMATION_ENABLED` env var behavior in production | MEDIUM | [ ] |
| 2.7 | Verify `ResultsEarlierPage` AbortController prevents race conditions | MEDIUM | [x] |
| 2.8 | Test offline/network-error state on all ERP pages | MEDIUM | [ ] |
| 2.9 | Verify `loadExternalPage` fallback works when ERP is unavailable | MEDIUM | [ ] |
| 2.10 | Check static prototype mode (`VITE_STATIC_PROTOTYPE`) works for all pages | HIGH | [ ] |

---

## 3. UI STATE COMPLETENESS (Loading / Error / Empty)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 3.1 | **Loading state**: Every page must show skeleton/spinner during data fetch | HIGH | [ ] |
| 3.2 | **Error state**: Every page must show `InlineError` with retry on failure | HIGH | [ ] |
| 3.3 | **Empty state**: Every page must show `EmptyState` when data is null/empty | HIGH | [ ] |
| 3.4 | Fix `ResultsEarlierPage` — no loading state for initial fetch | MEDIUM | [x] |
| 3.5 | Fix `FeeDuesPage` — add EmptyState when records empty and no dues | MEDIUM | [x] |
| 3.6 | Fix `BankDetailsPage` — add loading skeleton during save | MEDIUM | [x] |
| 3.7 | Fix `RoomDetailsPage` — add empty state when room is unassigned | HIGH | [x] |
| 3.8 | Fix `SapScholarshipsPage` — add error state | HIGH | [ ] |
| 3.9 | Verify `CurriculumPage` empty state renders for empty curriculum | MEDIUM | [x] |
| 3.10 | Verify `TransportRoutesPage` empty state renders | MEDIUM | [x] |

---

## 4. RESPONSIVE / MOBILE

| # | Task | Priority | Status |
|---|------|----------|--------|
| 4.1 | Verify Dashboard 12-col grid collapses to single column on mobile (<640px) | MEDIUM | [x] |
| 4.2 | Add horizontal scroll wrapper to ApplicationTrackerPage Kanban | MEDIUM | [x] |
| 4.3 | Verify sidebar collapses correctly at <900px breakpoint | HIGH | [ ] |
| 4.4 | Check table overflow on mobile for all ERP pages | MEDIUM | [ ] |
| 4.5 | Test form inputs (register, feedback, bank-details) on mobile viewport | MEDIUM | [ ] |
| 4.6 | Verify ErpPageShell header wraps correctly on small screens | MEDIUM | [ ] |
| 4.7 | Test AcademicHubPage tab bar on mobile (5 tabs overflow) | MEDIUM | [ ] |

---

## 5. AUTHENTICATION & AUTHORIZATION

| # | Task | Priority | Status |
|---|------|----------|--------|
| 5.1 | Verify `ProtectedPage` redirects unauthenticated users to login | HIGH | [x] |
| 5.2 | Verify `AdminOnlyPage` restricts admin routes | HIGH | [x] |
| 5.3 | Test session timeout redirects to login with preserved return URL | MEDIUM | [ ] |
| 5.4 | Verify admin sidebar sections hidden for non-admin users | MEDIUM | [ ] |
| 5.5 | Test `isSessionAuthFailure` handler on all ERP pages | MEDIUM | [ ] |
| 5.6 | Verify `handleSessionAuthFailure` clears session and redirects | MEDIUM | [ ] |

---

## 6. ADMIN WORKFHIGHS

| # | Task | Priority | Status |
|---|------|----------|--------|
| 6.1 | AdminCampusFeedbackPage — verify moderation (approve/reject) works | MEDIUM | [ ] |
| 6.2 | AdminCampusFeedbackPage — verify feedback list renders | MEDIUM | [ ] |
| 6.3 | Content management admin — verify CRUD operations | HIGH | [ ] |
| 6.4 | Event approvals admin — verify approval/rejection flow | HIGH | [ ] |
| 6.5 | Verify inline-admin controls on TransportRoutesPage (admin mode) | HIGH | [ ] |
| 6.6 | Verify inline-admin controls on HostelBookingPage (admin mode) | HIGH | [ ] |

---

## 7. FEEDBACK SYSTEM

| # | Task | Priority | Status |
|---|------|----------|--------|
| 7.1 | Remove "Unofficial campus feedback" label from `CampusFeedbackPage.tsx` | MEDIUM | [ ] |
| 7.2 | Implement Feedback Dashboard (consolidate course + campus) | MEDIUM | [ ] |
| 7.3 | Verify end-to-end feedback flow: submit → admin sees → admin responds → student sees status | MEDIUM | [ ] |
| 7.4 | Update `FeedbackStatusResponse` to remove `disabledMessage` if never used | HIGH | [ ] |

---

## 8. BACKEND COVERAGE

| # | Task | Priority | Status |
|---|------|----------|--------|
| 8.1 | Create `extractTransport.js` for transport route HTML parsing | HIGH | [x] |
| 8.2 | Create `extractHostel.js` for hostel HTML parsing | HIGH | [x] |
| 8.3 | Wire transport/hostel extractors into `extractors/index.js` | HIGH | [x] |
| 8.4 | Verify all API routes return proper error codes | MEDIUM | [ ] |
| 8.5 | Check `campusFeedbackStore.js` for proper DB persistence | MEDIUM | [ ] |
| 8.6 | Verify `erpActionExecutor.js` handles unknown actionIds gracefully | MEDIUM | [ ] |

---

## 9. TEST COVERAGE

| # | Task | Priority | Status |
|---|------|----------|--------|
| 9.1 | Run `npm test` — track all failures | HIGH | [x] |
| 9.2 | Fix `Dashboard/UpcomingEventsWidget.test.tsx` (expects 3 chips, got 2) | MEDIUM | [x] |
| 9.3 | Fix `LMS/LmsHomePage.test.tsx` (3 assertion failures) | MEDIUM | [x] |
| 9.4 | Add tests for `TransportRoutesPage` | HIGH | [x] |
| 9.5 | Add tests for `HostelBookingPage` | HIGH | [x] |
| 9.6 | Add tests for `ProfessionalProfilePage` | HIGH | [x] |
| 9.7 | Add tests for `AcademicHubPage` | HIGH | [x] |

---

## 10. BUILD & DEPLOYMENT

| # | Task | Priority | Status |
|---|------|----------|--------|
| 10.1 | Run `npm run build` — must pass with zero errors | HIGH | [x] |
| 10.2 | Verify production build has no dead code imports | MEDIUM | [ ] |
| 10.3 | Check bundle size for large pages (BlueprintPage, Dashboard) | HIGH | [ ] |
| 10.4 | Verify CI pipeline passes | MEDIUM | [ ] |
| 10.5 | Check for environment variable misconfigurations | MEDIUM | [ ] |

---

## 11. ACCESSIBLE UI

| # | Task | Priority | Status |
|---|------|----------|--------|
| 11.1 | Add `aria-label` to all icon-only buttons | MEDIUM | [x] |
| 11.2 | Verify focus indicators visible on all interactive elements | MEDIUM | [ ] |
| 11.3 | Add `role="main"` and `role="navigation"` landmarks | HIGH | [x] |
| 11.4 | Test keyboard navigation: Tab order through sidebar → content → actions | MEDIUM | [ ] |
| 11.5 | Verify color contrast ratios meet WCAG AA on all status colors | MEDIUM | [ ] |

---

## 12. DATA CONSISTENCY

| # | Task | Priority | Status |
|---|------|----------|--------|
| 12.1 | Cross-reference ERP `fetchKeys` with `scrapeTargets.js` backend | MEDIUM | [ ] |
| 12.2 | Verify blueprint `renderer` values match transformer keys in `registry.ts` | MEDIUM | [ ] |
| 12.3 | Remove duplicate CGPA computation (ERP+tracks multiple sources) | HIGH | [x] |
| 12.4 | Verify `AcademicTrackerPage` correctly merges 3+ API sources | MEDIUM | [x] |

---

## How To Use

1. Run `npm run build` → fix any errors first
2. Run `npm test` → track failures
3. Work through HIGH priority tasks first
4. Mark `[x]` as each is verified
5. When all HIGH tasks are done, proceed to MEDIUM
6. When all are complete (0 unmarked), the website is product-ready
