# 🎓 University-ERP Master Task Inventory
> **Platform:** SRM AP UniCurator — University ERP Companion Platform  
> **Generated:** 2026-06-11 | **Owner:** Engineering + Product  
> **Source documents synthesized:** `codebase_audit.md`, `backend_audit.md`, `frontend_audit.md`, `ux_audit.md`, `implementation_plan.md`, `docs/plans/production-readiness-todos.md`, `docs/plans/career-final-plan.md`, `docs/plans/lms-final-plan.md`, `docs/plans/competition-frontend-plan.md`, `docs/plans/erp-availability-and-transformer-audit.md`, `docs/plans/domains-implementation.md`, `docs/12-SYSTEM-AUDIT-REPORT.md`, `docs/evidence/production-readiness/*`

---

## 📊 Status Dashboard

| Workstream | Total Tasks | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ✅ Done |
|---|---|---|---|---|---|---|
| **1. Code Health & Hygiene** | 12 | 1 | 4 | 5 | 2 | 0 |
| **2. UX & Navigation** | 14 | 4 | 5 | 3 | 2 | 0 |
| **3. ERP Pipeline Architecture** | 8 | 2 | 3 | 2 | 1 | 0 |
| **4. Intelligence & Personalization** | 6 | 0 | 3 | 2 | 1 | 0 |
| **5. Governance & Moderation** | 6 | 1 | 2 | 2 | 1 | 0 |
| **6. Production Readiness** | 9 | 2 | 4 | 2 | 1 | 0 |
| **TOTAL** | **55** | **10** | **21** | **16** | **8** | **0** |

> **Legend:** 🔴 Critical (blocks other work / user-facing breakage) · 🟠 High (significant debt or feature gap) · 🟡 Medium (clean opportunistically) · 🟢 Low (nice to have)

---

## 🌐 Global Delivery Standards (Mandatory for ALL tasks)

Before closing **any** task, the following evidence must exist:
- [ ] **Implementation** — code changes complete, no TODOs left in production paths
- [ ] **Tests** — unit + integration + at least one e2e flow
- [ ] **Screenshots** — desktop + mobile (save to `docs/evidence/production-readiness/`)
- [ ] **Edge-case handling** — documented failure modes handled
- [ ] **Docs updated** — `docs/07-API-REFERENCE.md` and relevant runbooks current
- [ ] **Completion % = production readiness**, not lines of code written

---

## WORKSTREAM 1 — Code Health & Hygiene

> Source: `implementation_plan.md` Phase 12, `codebase_audit.md`, `frontend_audit.md`

### 🔴 1.1 — Split `LearningMaterialsPage.tsx` (1,250 LOC God File)
**Priority:** CRITICAL | **Urgency:** Now | **Effort:** 3–4 hrs | **Risk:** Medium

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Milestone check-in** | After build passes |
| **Required integrations** | `Frontend/src/pages/Resources/LearningMaterialsPage.tsx`, `Frontend/src/routes/lmsRoutes.tsx`, `Frontend/src/pages/LMS/index.ts` barrel |
| **Dependency** | None — safe to start immediately |

**Action steps:**
- [ ] Extract the admin-mode branch into `LearningMaterialsAdminPage.tsx`
- [ ] Extract the student browse/filter logic into `LearningMaterialsBrowsePage.tsx`
- [ ] Keep `LearningMaterialsPage.tsx` as a thin dispatcher/barrel (~50 LOC)
- [ ] Update route imports in `lmsRoutes.tsx`
- [ ] Run `npm run build` + `npm test` + `npx madge --circular`

**Acceptance:** All files under 500 LOC. Build green. Zero circular deps.

---

### 🟠 1.2 — Split `Frontend/src/lib/lms/types.ts` (1,119 LOC)
**Priority:** HIGH | **Urgency:** Sprint 1 | **Effort:** 2–3 hrs | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Required integrations** | `Frontend/src/lib/lms/types.ts`, all LMS API modules |

**Action steps:**
- [ ] Split into `types/resource.ts`, `types/community.ts`, `types/progress.ts`, `types/guides.ts`, `types/roadmaps.ts`
- [ ] Re-export all from `Frontend/src/lib/lms/types.ts` as compatibility barrel
- [ ] Verify no broken imports: `grep -r "from.*lms/types" src/`
- [ ] Build + test

---

### 🟠 1.3 — Split `ResultsCurrentPage.tsx` (817 LOC)
**Priority:** HIGH | **Urgency:** Sprint 2 | **Effort:** 2 hrs | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Frontend/src/pages/ERP/ResultsCurrentPage.tsx`, `Frontend/src/lib/erp/examTransformers.ts` |

**Action steps:**
- [ ] Extract `ResultsSummaryCard.tsx` component
- [ ] Extract `SubjectResultsTable.tsx` component
- [ ] Keep page file as orchestrator < 200 LOC
- [ ] Build + test

---

### 🟠 1.4 — Commit All Untracked Files (40+ files)
**Priority:** HIGH | **Urgency:** Immediate | **Effort:** 30 min | **Risk:** Zero

> **Source:** `implementation_plan.md` Phase 2 (commit step deferred)

| Field | Value |
|---|---|
| **Owner** | Any engineer |
| **Deadline** | This week |

**Action steps:**
- [ ] `git add Backend/src/routes/campusFeedbackRoutes.js Backend/src/routes/debugRoutes.js`
- [ ] `git add Backend/src/services/campusFeedbackStore.js Backend/src/services/lmsTrackerStore.js`
- [ ] `git add Backend/test/ Frontend/e2e/ Frontend/scripts/sync-erp-fixtures-from-audit.mjs`
- [ ] `git add Frontend/public/fixtures/ Frontend/src/components/lms/InteractiveFlashcardDeck.tsx`
- [ ] `git add CLAUDE.md` (already updated)
- [ ] `git commit -m "chore: commit untracked services, tests, e2e specs, and fixtures"`

---

### 🟠 1.5 — Fix `.gitignore` Bugs
**Priority:** HIGH | **Urgency:** Immediate | **Effort:** 10 min | **Risk:** Zero

| Field | Value |
|---|---|
| **Owner** | Any engineer |
| **Deadline** | This week |

**Action steps:**
- [ ] Change `Stitch Designs/` → `Stitch Design/` (typo — actual dir name is singular)
- [ ] Add `graphify-out/`
- [ ] Add `StaticHost/dist/`
- [ ] Verify `git status` no longer shows `Stitch Design/` as untracked

---

### 🟠 1.6 — Move `playwright` to `devDependencies` in Backend
**Priority:** HIGH | **Urgency:** Sprint 1 | **Effort:** 5 min | **Risk:** Zero

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 1 |

**Action steps:**
- [ ] `cd Backend && npm uninstall playwright && npm install --save-dev playwright`
- [ ] Verify `Backend/package.json` shows `playwright` under `devDependencies`
- [ ] Run `npm test` in Backend to confirm no breakage

---

### 🟡 1.7 — Delete Dead Frontend Code
**Priority:** MEDIUM | **Urgency:** Sprint 2 | **Effort:** 30 min | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 2 |

**Files to delete:**
- [ ] `Frontend/src/pages/CareerPortal/ResumeProfile.tsx` — zero imports, no route, dead code
- [ ] `Frontend/src/pages/Dashboard/Calendar.tsx` — superseded by WeekCalendar.tsx
- [ ] `Frontend/src/components/ui/DataTable.tsx` — verify if superseded by `shell/DataTable.tsx`
- [ ] `Frontend/src/assets/compare.html`, `WhatsApp Image...jpeg`, `file(2).svg`

**Acceptance:** `grep -r "ResumeProfile\|Calendar.tsx" src/` returns zero results after deletion.

---

### 🟡 1.8 — Remove/Review One-Off Backend Scripts
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 1 hr | **Risk:** Low

> Source: `implementation_plan.md` section 1J

**Action steps:**
- [ ] Review and delete or archive: `analyze-erp-ui-map.js`, `endpoint-discovery.js`, `fetch-discovered-endpoints.js`, `preprocess-fetched-endpoints.js`, `generate-content-map-template.js`, `manual-refresh-artifacts.js`
- [ ] Keep active dev tools: `create-erp-dump.js`, `seed-demo-data.js`, `check-erp-integrity.js`, `audit-live-frontend-payloads.js`

---

### 🟡 1.9 — Add `analytics.ts` TODO Comment
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 5 min | **Risk:** Zero

**Action steps:**
- [ ] Add to top of `Frontend/src/lib/analytics.ts`: `// TODO: Wire real analytics provider — replace console.debug call with provider SDK (e.g., Mixpanel, PostHog). Calls are pre-placed to avoid future refactoring.`

---

### 🟡 1.10 — Add JSDoc to `navigationExtensions.ts`
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 10 min | **Risk:** Zero

**Action steps:**
- [ ] Add JSDoc to `Frontend/src/config/navigationExtensions.ts` explaining it is the plugin registry for future nav extensions — not dead code, zero extensions registered by design

---

### 🟡 1.11 — Wire or Delete `EventsRegistrationHub.tsx`
**Priority:** MEDIUM | **Urgency:** Sprint 2 | **Effort:** 30 min | **Risk:** Low

> Source: `frontend_audit.md` — file exists but not in route table

**Action steps:**
- [ ] Verify if `EventsRegistrationHub.tsx` was wired via `implementation_plan.md` Phase evidence (events-registration-productization)
- [ ] If already wired: add route to `eventRoutes.tsx` and add to `NAV_HIDDEN_ROUTES` if internal-only
- [ ] If still dead: delete and remove its test file

---

### 🟢 1.12 — Verify `InteractiveFlashcardDeck.tsx` Usage
**Priority:** LOW | **Urgency:** Sprint 3 | **Effort:** 15 min | **Risk:** Zero

**Action steps:**
- [ ] `grep -r "InteractiveFlashcardDeck" Frontend/src/ --include="*.tsx"`
- [ ] If imported: commit. If not: delete before committing.

---

## WORKSTREAM 2 — UX & Navigation

> Source: `ux_audit.md`, `frontend_audit.md`, `docs/plans/competition-frontend-plan.md`

### 🔴 2.1 — Fix Undefined Bug in Event Titles/Venues
**Priority:** CRITICAL | **Urgency:** Immediate | **Effort:** 1 hr | **Risk:** Low

> Source: `competition-frontend-plan.md` Section 0 — Pre-Work

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Today |
| **User impact:** | Event titles showing `undefinedAI Competition...`, venues showing `undefinedMain Auditorium` |

**Action steps:**
- [ ] Search `Frontend/src/pages/Events/` and `Frontend/src/lib/campusApi.ts` for any template literal concatenation on `event.title` and `event.location`
- [ ] Replace every `someVar + event.title` with null-safe: `event.title ?? 'Untitled Event'`
- [ ] Replace every `someVar + event.location` with: `event.location || event.venue || 'Venue TBA'`
- [ ] Verify fix in static prototype mode

---

### 🔴 2.2 — Add Events Widget to Dashboard
**Priority:** CRITICAL | **Urgency:** Sprint 1 | **Effort:** 3–4 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 5 — High Priority #2

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Required integrations** | `Frontend/src/pages/Dashboard/Dashboard.tsx`, `Frontend/src/lib/campusApi.ts`, `Backend/src/routes/eventsRoutes.js` |

**Action steps:**
- [ ] Create `Frontend/src/pages/Dashboard/UpcomingEventsWidget.tsx`
- [ ] Show: next 3 open-for-registration events with deadline countdown, category badge
- [ ] Add "View all events" link → `/events`
- [ ] Wire into Dashboard grid layout
- [ ] Mobile-first layout (stack, not grid)
- [ ] Write `UpcomingEventsWidget.test.tsx`
- [ ] Screenshot (desktop + mobile)

---

### 🔴 2.3 — Add Career Portal Widget to Dashboard
**Priority:** CRITICAL | **Urgency:** Sprint 1 | **Effort:** 2–3 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 5 — High Priority #3

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Required integrations** | `Frontend/src/pages/Dashboard/Dashboard.tsx`, `Frontend/src/lib/careerApi.ts` (`/career/deadline-soon`) |

**Action steps:**
- [ ] Create `Frontend/src/pages/Dashboard/CareerSpotlightWidget.tsx`
- [ ] Show: 2–3 opportunities expiring soon + application tracker count badge
- [ ] Add "Open Career Portal" CTA → `/career`
- [ ] Wire into Dashboard grid
- [ ] Write widget test + screenshots

---

### 🔴 2.4 — Add Sidebar Nav for 11 Orphaned ERP Pages
**Priority:** CRITICAL | **Urgency:** Sprint 1 | **Effort:** 2 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 2A — 11 ERP pages discoverable only via Command Palette

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Required integrations** | `Frontend/src/config/erpBlueprintRegistry/navigation.ts`, `Frontend/src/config/erpBlueprintRegistry/coreBlueprints.ts` |

**Pages to add nav for:**
- [ ] `/finance/bank-details` → Finance group in sidebar
- [ ] `/transport-hostel/room-details` → Transport/Hostel group
- [ ] `/transport-hostel/faqs` → Transport/Hostel group
- [ ] `/transport-hostel/refund-change-requests` → Transport/Hostel group
- [ ] `/registration/course-registration` → new Registration group or Dashboard QuickLink
- [ ] `/registration/minor-oe-registration`
- [ ] `/registration/exam-registration`
- [ ] `/registration/hostel-registration`
- [ ] `/registration/transport-registration`
- [ ] `/registration/sap-registration`
- [ ] `/transport-hostel/route-details` (placeholder — mark as access="A" until live)

**Acceptance:** All 11 pages discoverable from sidebar. No Command Palette required for core pages.

---

### 🟠 2.5 — Fix Feedback Group in Basic Mode (Empty Accordion)
**Priority:** HIGH | **Urgency:** Sprint 1 | **Effort:** 1 hr | **Risk:** Low

> Source: `ux_audit.md` Section 2A — Feedback group shows ZERO children in Basic mode

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 1 |
| **Required integrations** | `Frontend/src/config/erpBlueprintRegistry/navigation.ts`, `Frontend/components/Sidebar.tsx` |

**Action steps:**
- [ ] Change Course Feedback access level from `"A"` → `"B"` (visible in Basic mode)
- [ ] Add logic in Sidebar to hide group header when all children are access-gated in current mode
- [ ] Test: in Basic mode, Feedback group shows 1 item (Course Feedback) or hides entirely

---

### 🟠 2.6 — Create Student-Facing Interview Booking Page
**Priority:** HIGH | **Urgency:** Sprint 2 | **Effort:** 4–5 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 2D — `/career/interviews/slots` exists in backend but no student UI

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Backend/src/routes/careerRoutes.js` (`/career/interviews/slots`, `/career/interviews/bookings`), `careerApi.ts` |

**Action steps:**
- [ ] Create `Frontend/src/pages/CareerPortal/InterviewBookingPage.tsx`
- [ ] Show: available mock interview slots, book/cancel flow
- [ ] Add route `/career/me/interviews` to `careerRoutes` in frontend
- [ ] Add to Career sidebar under "My Activity"
- [ ] Write test + screenshots

---

### 🟠 2.7 — Create Student-Facing Alumni Connect Page
**Priority:** HIGH | **Urgency:** Sprint 2 | **Effort:** 3–4 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 2D — alumni routes exist in backend, no student page

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Backend/src/routes/careerRoutes.js` (`/career/alumni`, `/career/alumni/:id/requests`), `careerApi.ts` |

**Action steps:**
- [ ] Create `Frontend/src/pages/CareerPortal/AlumniConnectPage.tsx`
- [ ] Show: alumni cards with company/position, mentoring badge, connection request button
- [ ] Add route `/career/alumni` and sidebar link under "Career Services"
- [ ] Write test + screenshots

---

### 🟠 2.8 — Wire `ResumeProfile.tsx` or Delete It
**Priority:** HIGH | **Urgency:** Sprint 1 | **Effort:** 30 min | **Risk:** Zero

> Source: `ux_audit.md` Section 4, `frontend_audit.md` Section 4

**Decision:**
- [ ] Check if `ResumeProfile.tsx` has value distinct from `CareerProfilePage.tsx`
- [ ] **If different scope:** Wire to route `/career/me/resume`, add to Career Profile sidebar group
- [ ] **If redundant:** Delete file and its orphan test (if any)

---

### 🟠 2.9 — Add Helpdesk Link to Dashboard QuickLinks
**Priority:** HIGH | **Urgency:** Sprint 1 | **Effort:** 30 min | **Risk:** Zero

> Source: `ux_audit.md` Section 5 — High Priority #4

**Action steps:**
- [ ] Add "Raise a Ticket" quick link to `DASHBOARD_QUICK_LINKS` in `navigation.ts` → `/helpdesk/raise-ticket`
- [ ] Add icon (life-ring or ticket icon from Lucide)

---

### 🟠 2.10 — Add Flashcards Sidebar Link in LMS
**Priority:** HIGH | **Urgency:** Sprint 2 | **Effort:** 30 min | **Risk:** Zero

> Source: `ux_audit.md` Section 5 — Medium Priority #6

**Action steps:**
- [ ] Add "Flashcards" entry under LMS → Learning group in `workspaceBlueprints.ts`
- [ ] Route: `/resources/flashcards` (list view — needs new page if not exists, or redirect to browse with type filter)
- [ ] Verify sidebar renders correctly in both Basic and Advanced modes

---

### 🟡 2.11 — Add PYQ Bank Shortcut to LMS Sidebar
**Priority:** MEDIUM | **Urgency:** Sprint 2 | **Effort:** 30 min | **Risk:** Zero

**Action steps:**
- [ ] Add "PYQ Bank" link under LMS → Learning group → `/resources/subject/:code/pyq` or a PYQ browse page
- [ ] If no subject-agnostic PYQ landing exists, create `/resources/pyq` that redirects to Browse filtered by type=pyq

---

### 🟡 2.12 — Fix Empty Accordion Groups in Basic Mode
**Priority:** MEDIUM | **Urgency:** Sprint 2 | **Effort:** 1 hr | **Risk:** Low

> Source: `ux_audit.md` Section 5 — Low Priority #12

**Action steps:**
- [ ] In `Sidebar.tsx`, add logic: if a group's children are ALL access-gated beyond current mode, hide the group header entirely
- [ ] Test: toggle Basic ↔ Advanced mode, verify no empty accordions appear

---

### 🟡 2.13 — Add Admin Dashboard Landing Page
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 3–4 hrs | **Risk:** Low

> Source: `ux_audit.md` Section 2F — "No admin dashboard landing page"

**Action steps:**
- [ ] Create `Frontend/src/pages/Admin/AdminDashboardPage.tsx`
- [ ] Show: summary stats (open tickets, pending LMS flags, pending career submissions, events needing approval)
- [ ] Add route `/admin/dashboard` and make it the first link in ADMINISTRATION sidebar section
- [ ] Write test + screenshots

---

### 🟢 2.14 — Add Dashboard Quick-Links for Bank Details, Room Details, Registration
**Priority:** LOW | **Urgency:** Sprint 3 | **Effort:** 30 min | **Risk:** Zero

> Source: `ux_audit.md` Section 5 — Low Priority #13

**Action steps:**
- [ ] Add to Dashboard QuickLinks or as a second "Records" section: Bank Details, Room Details, Course Registration
- [ ] Keep primary QuickLinks lean — use expandable "More" section if needed

---

## WORKSTREAM 3 — ERP Pipeline Architecture

> Source: `docs/plans/erp-availability-and-transformer-audit.md`, `docs/12-SYSTEM-AUDIT-REPORT.md`, `codebase_audit.md`

### 🔴 3.1 — Implement Backend-First ERP Availability Contract
**Priority:** CRITICAL | **Urgency:** Sprint 2 | **Effort:** 1–2 days | **Risk:** High

> Source: `erp-availability-and-transformer-audit.md` Phase 1

| Field | Value |
|---|---|
| **Owner** | Backend Engineer + Frontend Engineer |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Backend/src/services/erpAggregationService.js`, `Backend/src/services/erpPayloadNormalizer.js`, `Frontend/src/pages/Shared/blueprintData/api.ts` |

**Action steps:**
- [ ] Add `availability` object to ERP V2 response schema in `erpAggregationService.js`:
  ```json
  { "state": "available|not_applicable|disabled_by_admin|closed_window|not_registered", "reasonCode": "...", "message": "...", "effectiveFor": {} }
  ```
- [ ] Create `Backend/src/services/erpAvailabilityService.js` — evaluates entitlement from session profile + admin toggle store + registration windows + source health
- [ ] Define `reasonCode` enum (PROFILE_NOT_HOSTELER, FEEDBACK_NOT_ENABLED, NOT_REGISTERED, etc.)
- [ ] Update frontend `useBlueprintPageData` / `blueprintData/api.ts` to consume `availability` directly instead of regex-parsing text
- [ ] Contract tests for each availability state × student type matrix (hosteler, day scholar, SAP, admin-enabled/disabled)
- [ ] Screenshot evidence of each state rendering correctly

**Acceptance:** No regex-based status inference remains in `useBlueprintPageData` or `ErpDocumentRenderer`.

---

### 🔴 3.2 — Consolidate Normalization to Backend Only
**Priority:** CRITICAL | **Urgency:** Sprint 2–3 | **Effort:** 1–2 days | **Risk:** High

> Source: `erp-availability-and-transformer-audit.md` Phase 2

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Backend/src/services/erpPayloadNormalizer.js`, `Frontend/src/pages/Shared/blueprintData/normalizers.ts`, `Frontend/src/pages/Shared/blueprintData/tableUtils.ts` |

**Action steps:**
- [ ] Audit all business normalization logic in `normalizers.ts`, `tableUtils.ts`, `sectionUtils.ts` — move any that interprets data meaning to `erpPayloadNormalizer.js`
- [ ] Add `transformTrace` metadata to backend response: `{ rulesApplied: [], rowCountBefore, rowCountAfter, droppedRowReasons: [] }`
- [ ] Frontend normalizers reduced to display formatting only (date formatting, number formatting)
- [ ] Snapshot tests proving no silent row loss

---

### 🟠 3.3 — Retire `/api/scrape/*` for Production Pages
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 2–3 days | **Risk:** High

> Source: `erp-availability-and-transformer-audit.md` Section D

| Field | Value |
|---|---|
| **Owner** | Backend Engineer + Frontend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Frontend/src/pages/Shared/blueprintData/api.ts`, `Backend/src/routes/scrapeRoutes.js`, `Backend/src/routes/erpV2Routes.js` |

**Action steps:**
- [ ] Audit which pages still call `/api/scrape/*` directly (check `api.ts` and blueprint fetch modes)
- [ ] Migrate all production pages to `/api/v2/erp/page` or `/api/v2/erp/batch` contracts
- [ ] Keep scrape routes alive for dev/admin/dump scripts only — not production student pages
- [ ] Add deprecation warning log in scrape routes when called outside dev mode

---

### 🟠 3.4 — Add ERP Schema Drift CI Alert
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `docs/12-SYSTEM-AUDIT-REPORT.md` — Residual Risk #1

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 3 |

**Action steps:**
- [ ] Commit current ERP JSON dump snapshots to `Backend/test/fixtures/erp-snapshots/`
- [ ] Write CI contract test that runs transformers against snapshots and asserts column counts / key names have not drifted
- [ ] Alert on: new headers appearing, headers disappearing, row count zero for non-empty pages
- [ ] Add `npm run check:erp-integrity` script wrapping `check-erp-integrity.js`

---

### 🟠 3.5 — Implement Domain Metadata for All Page Blueprints
**Priority:** HIGH | **Urgency:** Sprint 2 | **Effort:** 2 hrs | **Risk:** Low

> Source: `docs/plans/domains-implementation.md`

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Frontend/src/config/erpBlueprintRegistry/*.ts`, `Frontend/src/config/erpBlueprintTypes.ts` |

**Action steps:**
- [ ] Add `domain: "erp" | "lms" | "career" | "campus"` to `PageBlueprint` type (required field)
- [ ] Add `integrationState: "native" | "adapter" | "summary" | "placeholder"` (required field)
- [ ] Add `sourceMode?: "erp" | "internal" | "external"` (required for non-placeholder)
- [ ] Annotate all 97 blueprints in `coreBlueprints.ts`, `eventBlueprints.ts`, `workspaceBlueprints.ts`
- [ ] Add TypeScript compile-time checks that enforce invariants (placeholder ⇒ no sourceMode, native ⇒ internal/erp only)
- [ ] Config audit test validates domain uniqueness per page

---

### 🟡 3.6 — Add Transport/Hostel Route Details Placeholder → Native
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 1 hr | **Risk:** Low

**Action steps:**
- [ ] `/transport-hostel/route-details` is currently placeholder — check if ERP scrape target exists
- [ ] If yes: wire `route-details` scrape key and update blueprint `integrationState: "adapter"`
- [ ] If no: mark blueprint `integrationState: "placeholder"` explicitly with TODO comment

---

### 🟡 3.7 — Add Observability Dashboard for ERP Availability States
**Priority:** MEDIUM | **Urgency:** Sprint 4 | **Effort:** 1 day | **Risk:** Low

> Source: `erp-availability-and-transformer-audit.md` Phase 4

**Action steps:**
- [ ] Add availability state counts and normalization rule frequencies to `/health` or `/admin/system-controls`
- [ ] Track: which pages return `not_applicable` most often, which normalization rules fire most
- [ ] Expose in Admin System Controls UI

---

### 🟢 3.8 — Add NAV_HIDDEN_ROUTES Cleanup Pass
**Priority:** LOW | **Urgency:** Sprint 4 | **Effort:** 30 min | **Risk:** Zero

> Source: `ux_audit.md` Section 2A

**Action steps:**
- [ ] Review `NAV_HIDDEN_ROUTES` (4 routes hidden from sidebar AND command palette)
- [ ] Decide fate: `/exams/essentials`, `/transport-hostel/outing-maintenance`, `/registration/registration-tracker` — promote, archive, or document as intentional placeholders with roadmap dates

---

## WORKSTREAM 4 — Intelligence & Personalization

> Source: `docs/plans/production-readiness-todos.md` Tasks 3, 6, 8

### 🟠 4.1 — Improve Recommendation Quality: Unified Contract Across Domains
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 2–3 days | **Risk:** Medium

> Source: `production-readiness-todos.md` — "Improve Recommendation and Personalization System"

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Backend/src/services/lmsRecommendationEngine.js`, `Backend/src/services/lmsInteractionTracker.js`, `Backend/src/services/lmsTrackerService.js`, `Backend/src/services/careerStore.js` |

**Action steps:**
- [ ] Formalize unified recommendation contract: every recommendation payload includes `reasons[]`, `confidence`, `inputsUsed[]`, `rankingPolicy`
- [ ] Enforce eligibility filter runs BEFORE ranking (not after)
- [ ] Add experiment framework: shadow ranking with `algorithmKey` in `lms_ranking_shadow` table
- [ ] Add online telemetry: CTR, completion, apply events feed back into ranking weights
- [ ] Add low-signal (cold-start) fallback recommendation path with explicit "Explore" label
- [ ] Offline eval harness: `npm --prefix Backend run evaluate:unified-insights` must pass baseline

**Acceptance:** Same user profile → same top-3 recommendations on repeated calls (deterministic). Different profile → measurably different top-3. Ineligible items never in top-N.

---

### 🟠 4.2 — Re-ranking Update Pipeline: Within 5 Minutes of Profile Change
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Medium

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Backend/src/services/careerStore.js` (profile update hook), `Backend/src/services/lmsTrackerService.js` |

**Action steps:**
- [ ] On `PUT /career/profile` — trigger async re-score of top-N candidates; update cache within 5 minutes
- [ ] On `PUT /lms/me/preferences` — invalidate recommendation cache for that user
- [ ] Add `profileUpdatedAt` to recommendation response so frontend can show "Updated just now"

---

### 🟠 4.3 — Career Portal Phase 2: Python Scraper Activation
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 2–3 days | **Risk:** Medium

> Source: `docs/plans/career-final-plan.md` Phase 2

| Field | Value |
|---|---|
| **Owner** | Data/Backend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Scraper/main.py`, `Scraper/scheduler.py`, `Backend/data/career.sqlite` |

**Action steps:**
- [ ] Verify `Scraper/` directory structure exists with all Phase 2 files
- [ ] Implement or verify `jobspy_scraper.py` (LinkedIn, Indeed, Glassdoor)
- [ ] Implement or verify `devfolio_scraper.py` (Hackathons via Playwright)
- [ ] Wire circuit breaker (`career_source_health` table)
- [ ] Wire expiry logic (deadline past + 60-day no-deadline rule)
- [ ] Test: run scraper manually, verify rows appear in `career_opportunities`
- [ ] Verify Node.js backend reads freshly scraped data correctly
- [ ] Screenshots: opportunities from real scraped data in UI

---

### 🟡 4.4 — Academic Tracker: Live ERP Screenshots After Profile Update
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** Varies | **Risk:** Low

> Source: `production-readiness-todos.md` — Academic Tracker remaining hardening

**Action steps:**
- [ ] Perform fresh live ERP authentication via `Backend/scripts/audit-live-frontend-payloads.js`
- [ ] Capture actual authenticated student session tracker screenshots (replaces fixture-based screenshots)
- [ ] Add to `docs/evidence/production-readiness/academic-tracker-live-2026-06.md`

---

### 🟡 4.5 — Recommendation Quality Monitoring Dashboard
**Priority:** MEDIUM | **Urgency:** Sprint 4 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — Required deliverable for recommendation quality task

**Action steps:**
- [ ] Add admin-facing recommendation quality metrics to `/admin/system-controls` or new `/admin/recommendation-health`
- [ ] Metrics: click-through rate on recommended items, completion rate, satisfaction proxy (upvotes after recommendation click)
- [ ] Add drift detection: alert if top-10 recommended resources haven't changed in 7+ days for a user cohort

---

### 🟢 4.6 — Career Scraper Phase 3: Unstop + Internshala
**Priority:** LOW | **Urgency:** Sprint 5+ | **Effort:** 3–5 days | **Risk:** High

> Source: `career-final-plan.md` Phase 3

**Action steps:**
- [ ] Implement `unstop_scraper.py` after JobSpy + Devfolio stable for 2+ weeks
- [ ] Implement `internshala_scraper.py`
- [ ] Add phase-3 opportunity types to filter UI (competitions, workshops)

---

## WORKSTREAM 5 — Governance & Moderation

> Source: `docs/plans/production-readiness-todos.md` — Community Moderation and Content Safeguards tasks

### 🔴 5.1 — Implement Content Moderation Appeals Workflow
**Priority:** CRITICAL | **Urgency:** Sprint 3 | **Effort:** 2–3 days | **Risk:** Medium

> Source: `production-readiness-todos.md` — "Add Safeguards/Moderation for Community Content"

| Field | Value |
|---|---|
| **Owner** | Backend + Frontend Engineer |
| **Deadline** | Sprint 3 |
| **Required integrations** | `Backend/src/routes/lmsRoutes.js`, `Backend/src/services/lmsModerationService.js`, `Backend/src/services/lmsStore.js`, `Frontend/src/pages/Admin/AdminLmsModerationPage.tsx` |

**Action steps:**
- [ ] Add appeal submission endpoint: `POST /lms/resources/:id/appeal`
- [ ] Add appeal review endpoint: `PATCH /lms/admin/resources/:id/appeal/:appealId`
- [ ] Schema: appeals table with status, reason, reviewer, SLA timestamp
- [ ] Frontend: creator sees "Appeal" button on hidden/removed resource detail
- [ ] Admin moderation queue shows pending appeals with context panel
- [ ] SLA: appeal must be reviewed within defined window; alert admin if breached
- [ ] Anti-brigading: coordinated mass-report attempts detected by daily-report-limit + reporter trust score
- [ ] Tests: appeal filed → appears in queue → reviewed → status updates to creator

**Acceptance:** No resource can be permanently removed without auditable decision + creator-visible reason + appeal path.

---

### 🟠 5.2 — Add Multi-Stage Automated Risk Scoring to LMS Flags
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — Moderation policy taxonomy

**Action steps:**
- [ ] Add policy taxonomy to flag reasons: spam, harassment, misinformation, IP_violation, low_quality
- [ ] Add automated risk score to each reported resource: flag count × reporter trust weight
- [ ] Only resources crossing threshold (risk score ≥ configurable limit) enter moderation queue — low-risk reports queue silently
- [ ] Moderator sees full report history, risk score breakdown, and policy category

---

### 🟠 5.3 — Helpdesk: Deployed HTTP Concurrency Testing
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — Remaining hardening for helpdesk task

**Action steps:**
- [ ] Run `wrk` or similar load test against `/helpdesk/tickets` with 50 concurrent connections
- [ ] Assert p95 < 400ms for list/filter queries under load
- [ ] Assert bulk update of 100 tickets < 2 seconds under concurrent load
- [ ] Document results in `docs/evidence/production-readiness/helpdesk-load-test-2026-06.md`

---

### 🟡 5.4 — Campus Feedback: External HTTP Concurrency Testing
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — Campus feedback remaining hardening

**Action steps:**
- [ ] Load test `/campus-feedback/admin/submissions` with 50 concurrent connections
- [ ] Assert p95 < 300ms for status-filtered pages
- [ ] Document in evidence artifact

---

### 🟡 5.5 — Normalized SQL Helpdesk Schema Migration
**Priority:** MEDIUM | **Urgency:** Sprint 4 | **Effort:** 2 days | **Risk:** High

> Source: `production-readiness-todos.md` — Helpdesk remaining hardening

**Action steps:**
- [ ] Migrate `helpdesk_state` from key-value JSON blob store to normalized SQLite tables (tickets, replies, FAQs as proper rows)
- [ ] Write migration script with rollback capability
- [ ] All existing helpdesk routes must function identically post-migration
- [ ] Load test after migration

---

### 🟢 5.6 — Career Portal: External Notification Delivery (Submitter Status Emails)
**Priority:** LOW | **Urgency:** Sprint 5+ | **Effort:** 2 days | **Risk:** Medium

> Source: `production-readiness-todos.md` — Career opportunity governance remaining hardening

**Action steps:**
- [ ] Implement email/push notification when submission is approved or rejected
- [ ] Use `CareerNotifier` pattern; add notification type `submission_reviewed`
- [ ] Test: submitted → approved → email delivered with reason
- [ ] In-app status already implemented; this adds out-of-band delivery

---

## WORKSTREAM 6 — Production Readiness

> Source: `docs/plans/production-readiness-todos.md` cross-task plan, `docs/12-SYSTEM-AUDIT-REPORT.md`

### 🔴 6.1 — Live ERP Session End-to-End Test (Register → Submit → Organizer Review)
**Priority:** CRITICAL | **Urgency:** Sprint 2 | **Effort:** 1 day | **Risk:** Medium

> Source: `production-readiness-todos.md` — Events registration remaining hardening

| Field | Value |
|---|---|
| **Owner** | QA / Engineer with ERP access |
| **Deadline** | Sprint 2 |
| **Required integrations** | `Backend/scripts/seed-demo-data.js`, live ERP session, `Backend/scripts/audit-live-frontend-payloads.js` |

**Action steps:**
- [ ] Seed backend with demo event (competition with 2 rounds)
- [ ] Authenticate real student session via ERP
- [ ] Walk full flow: discover event → register → form team → submit round 1 → organizer evaluates → results published → certificate downloaded
- [ ] Capture screenshots of each step
- [ ] Document in `docs/evidence/production-readiness/events-e2e-live-2026-06.md`

---

### 🔴 6.2 — Wire `analytics.ts` to Real Analytics Provider
**Priority:** CRITICAL (deferred from code) | **Urgency:** Pre-launch | **Effort:** 1 day | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Frontend Engineer |
| **Deadline** | Before production launch |
| **Required integrations** | `Frontend/src/lib/analytics.ts`, 6 call sites in Events + Career pages |

**Action steps:**
- [ ] Select provider: PostHog (open-source, self-hostable) or Mixpanel
- [ ] Replace `console.debug` in `analytics.ts` with provider SDK `track()` call
- [ ] Verify existing call sites (Events, Career) emit events correctly
- [ ] Add `VITE_ANALYTICS_KEY` to env vars + docs

---

### 🟠 6.3 — Recommendation API Load Testing (p95 < 400ms Warm Path)
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — Unified insights performance constraints

**Action steps:**
- [ ] Load test `GET /lms/recommendations` with warm Redis cache, 100 concurrent users
- [ ] Load test `GET /career/insights/unified` same conditions
- [ ] Assert p95 < 400ms
- [ ] Document results in evidence artifact

---

### 🟠 6.4 — LMS Community: Deployed HTTP Latency Testing
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `production-readiness-todos.md` — LMS community governance remaining hardening

**Action steps:**
- [ ] Load test `GET /lms/recommendations` (p95 < 350ms) and `GET /lms/admin/resource-flags` (p95 < 300ms) under load
- [ ] Document results + add to `docs/evidence/production-readiness/lms-load-test-2026-06.md`

---

### 🟠 6.5 — Career Portal: Personalized Feed Load Testing
**Priority:** HIGH | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

> Source: `career-final-plan.md` — `getPersonalizedFeed` performance

**Action steps:**
- [ ] Load test `GET /career/feed` with user profile injected, warm cache
- [ ] Assert p95 < 400ms with 50 concurrent requests
- [ ] Document results

---

### 🟠 6.6 — Moderation Queue: Fairness Review
**Priority:** HIGH | **Urgency:** Sprint 4 | **Effort:** 1–2 days | **Risk:** Medium

> Source: `production-readiness-todos.md` — LMS community remaining hardening

**Action steps:**
- [ ] Analyze moderation decisions (approve/reject rates) across: content type, subject area, uploader cohort
- [ ] Check for systematic bias patterns (are certain subjects flagged disproportionately?)
- [ ] Document findings in `docs/evidence/production-readiness/moderation-fairness-review-2026-06.md`
- [ ] Adjust `lmsModerationService.js` thresholds if bias found

---

### 🟡 6.7 — Release Checklist + Runbook for First Production Deployment
**Priority:** MEDIUM | **Urgency:** Sprint 4 | **Effort:** 1 day | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Tech Lead |
| **Deadline** | Sprint 4 |

**Action steps:**
- [ ] Create `docs/runbooks/production-deployment.md` with:
  - Pre-deploy checks (build green, tests green, Madge clean)
  - Database migration sequence (LMS → Career → Helpdesk)
  - Redis setup and health check
  - ERP connectivity test
  - Python scraper service start
  - Rollback procedure for each component
- [ ] Walk through checklist once against staging environment

---

### 🟡 6.8 — Scheduler: Run Analytics / Notifier on Cron
**Priority:** MEDIUM | **Urgency:** Sprint 3 | **Effort:** 1 day | **Risk:** Low

| Field | Value |
|---|---|
| **Owner** | Backend Engineer |
| **Deadline** | Sprint 3 |

**Action steps:**
- [ ] Set up cron job (or `node-cron`) for `CareerNotifier.runDeadlineReminders()` — daily
- [ ] Set up cron for `LmsRevisionScheduler.processRevisionQueue()` — daily
- [ ] Set up cron for Python career scraper — every 6 hours
- [ ] Add health check: `/health` response includes last successful run time for each cron

---

### 🟢 6.9 — Document Repeatable Framework for Future Documentation Cycles
**Priority:** LOW | **Urgency:** Sprint 5 | **Effort:** 2 hrs | **Risk:** Zero

**Action steps:**
- [ ] Create `docs/DOCUMENTATION-LIFECYCLE.md` documenting:
  - How to run a new audit cycle (codebase_audit → frontend_audit → ux_audit → production-readiness-todos)
  - Evidence standards (what screenshots/tests are required for each task type)
  - How to update this master task inventory
  - Mandatory closeout template (from `production-readiness-todos.md`)
  - When to archive completed tasks vs. keep as reference

---

## 📋 Execution Order (Sprint-by-Sprint Priority)

### Sprint 1 (Immediate — highest user impact, zero risk)
1. **2.1** Fix undefined bug in event titles (today)
2. **1.4** Commit 40+ untracked files
3. **1.5** Fix .gitignore bugs
4. **2.2** Add Events Dashboard widget
5. **2.3** Add Career Dashboard widget
6. **2.4** Add sidebar nav for 11 orphaned ERP pages
7. **2.5** Fix Feedback group in Basic mode
8. **2.8** Wire or delete ResumeProfile.tsx
9. **2.9** Add Helpdesk quick link to Dashboard
10. **1.1** Split LearningMaterialsPage.tsx (1,250 LOC)

### Sprint 2 (Architecture foundation)
11. **3.1** Backend-first ERP availability contract
12. **3.5** Domain metadata for all blueprints
13. **1.6** Move playwright to devDependencies
14. **2.6** Student-facing Interview Booking page
15. **2.7** Student-facing Alumni Connect page
16. **6.1** Live ERP end-to-end event flow test
17. **1.2** Split lms/types.ts
18. **1.7** Delete dead frontend code

### Sprint 3 (Intelligence + Governance)
19. **3.2** Consolidate normalization to backend only
20. **3.3** Retire /api/scrape/* for production pages
21. **4.1** Unified recommendation contract
22. **4.2** Re-ranking update pipeline
23. **4.3** Career scraper Phase 2 activation
24. **5.1** Content moderation appeals workflow
25. **5.2** Multi-stage automated risk scoring
26. **5.3** Helpdesk concurrency testing
27. **6.3** Recommendation API load testing
28. **6.4** LMS community load testing
29. **6.8** Cron scheduler setup

### Sprint 4 (Observability + Polish)
30. **3.4** ERP schema drift CI alert
31. **3.7** ERP observability dashboard
32. **2.11** PYQ Bank sidebar shortcut
33. **2.12** Fix empty accordion in Basic mode
34. **2.13** Admin dashboard landing page
35. **5.5** Normalized SQL helpdesk schema
36. **6.5** Career feed load testing
37. **6.6** Moderation fairness review
38. **6.7** Production deployment runbook

### Sprint 5+ (Long-tail + Future)
39. **4.6** Career scraper Phase 3 (Unstop + Internshala)
40. **5.6** External notification delivery
41. **6.2** Wire analytics.ts to real provider
42. **6.9** Documentation lifecycle framework
43. All remaining 🟢 LOW items

---

## 🔁 Mandatory Closeout Template

> Use before marking **any** task complete:

```
## Task Closeout: [Task ID] — [Task Name]
Date closed: 
Engineer:

### What was implemented

### What is still missing

### Technical debt introduced

### Mocked or faked parts (must be labeled in code)

### Scalability limitations

### Security limitations

### Suggested next improvements
```

If any section above is non-empty, the task **cannot** be marked 100% complete without explicit sign-off from the tech lead.

---

## 📁 Evidence Repository

All task evidence artifacts go here:
- **Markdown reports:** `docs/evidence/production-readiness/[task-name]-[date].md`
- **Screenshots:** `docs/evidence/production-readiness/[feature]-desktop-[date].png` + `*-mobile-[date].png`
- **Codex snapshots:** `.codex/[feature]-governance-[date].md`

Existing evidence (already captured, 2026-05-26):
- ✅ Fee Paid Integrity (`fee-paid-integrity-2026-05-26.md`)
- ✅ Campus Feedback Governance (`campus-feedback-governance-2026-05-26.md`)
- ✅ Academic Tracker Career Readiness (`academic-tracker-career-readiness-2026-05-26.md`)
- ✅ Helpdesk Admin Triage (`helpdesk-admin-triage-2026-05-26.md`)
- ✅ Events Registration Productization (`events-registration-productization-2026-05-26.md`)
- ✅ LMS Community Governance (`lms-community-governance-2026-05-26.md`)
- ✅ Career Opportunity Governance (`career-opportunity-governance-2026-05-26.md`)
- ✅ Unified Insights Personalization (`unified-insights-personalization-2026-05-26.md`)
- ✅ Admin Content Lifecycle (`admin-content-lifecycle-2026-05-26.md`)
