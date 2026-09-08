# 23 — Delivery Backlog

**Created:** 2026-09-02
**Companions:** [21 — UI/UX Audit](./21-UI-UX-REFINEMENT-AUDIT.md) · [22 — Product Roadmap](./22-PRODUCT-ROADMAP.md)

## How this is structured

```
EPIC      A body of work with a single outcome. Weeks.
 └ STORY  Student-visible value, phrased from their side. Days.
    └ TASK       One engineer, one sitting. Hours.
       └ Subtask Checklist item inside a task.
```

**Conventions**
`[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped (say why)
Size: `XS` <2h · `S` ~half day · `M` 1–2 days · `L` 3–5 days · `XL` >1 week (split it)
Every story carries **AC** (acceptance criteria). A story is not done until its AC is demonstrable in the running app, not just merged.

**Status (2026-09-04):**
- Epic 1 complete.
- **B1 complete** — Epic 2 (mobile): data tables → cards, single-item rails, mobile shell, tap-target sweep (0 offenders), responsive audit at 390px + wedge check, both blocking in CI.
- **B2 complete bar the tail** — Epic 8: route-reachability tests (8.4), server-side `<script>/<style>` strip + tests (8.5), prototype-synthesiser audit + reconciliation tests (8.6.3), `route_view` analytics + admin Top-Pages report (8.1.1–8.1.2), ~14 MB orphaned assets deleted (8.2.2), **Knip cleanup + CI blocking (8.3) and bundle-budget CI (8.2.3) done 2026-09-07** — Knip baseline 176 exports / 105 types / 6 deps → 0/0/0; `audit:bundle` gates JS gzip + largest chunk + precache size. Epic 8 code is complete (incl. the KaTeX `$`-detection split, 8.2.1, 2026-09-07); only the 2-week analytics soak (8.1.3, ops wait) is outstanding.
- **B3 done (2026-09-07)** — Epic 5 (minus 5.1, done in B14): naming guarded (5.2); career discovery collapsed to one `/career/opportunities` front door + `?type=` redirects (5.3); `CareerProfilePage` merged (5.4.1); `HostelBookingPage` routed + Campus Tools nav (5.4.2); 14 dead files deleted (5.4.3); last Events `<select>` swapped (5.4.5); `SourceBadge` cleaned + `userDirectoryStore` / `GET /api/users/resolve` / `useResolvedNames` so leaderboards, judge/shortlist lists and audit trails show names not register numbers (5.4.6).
- **B4 done (2026-09-06)** — Epic 3 Story 3.1: `studentGraphService` (identity + attendance + skills + activity + derived signals: at-risk subjects, skill gaps, readiness score), `GET/POST /api/student-graph`, 60s TTL cache with ERP-refresh invalidation, `StudentGraph` TS contract + `useStudentGraph()` hook. `erpReader` seam wired in B6.
- **B5 done (2026-09-06)** — Epic 3 Stories 3.2 + 3.3: `studentIntentStore` + intent/consent/provenance/delete endpoints, a 5-step `OnboardingFlow` (consent-first, skippable, skills pre-filled from the graph), a skipped-state re-prompt banner, full editing + a "What we know about you" list + inference-delete in Settings.
- **B6 partial (2026-09-06 / 2026-09-07)** — Epic 4 Story 4.1: `BunkAdvicePanel` (per-subject "can I skip class" answers from the graph) leads the Risks tab; `erpAcademicSnapshotStore` makes curriculum/results/CGPA/SGPA-by-sem live on the graph (closes B4's seam); deleted 3 orphaned insight components; **`GradeTargetCalculator` (2026-09-07)** — per-subject "N in this final for grade X" from live internal marks; **end-of-term attendance trend projection (4.1.3, 2026-09-07)** off the new academic-calendar `termProgress`; **elective guidance (4.1.4, 2026-09-07)** — role taxonomy + `rankElectives()` + a keyword seed map (exact SRM AP elective codes TODO). Story 4.1 code-complete.
- **B7 partial (2026-09-06)** — Epic 4 Story 4.2 done: `opportunityFit.js` graph fit-scorer (skills, CGPA cutoff, eligibility, target-role, deadline), `GET /career/opportunities?sort=fit` ranking a 400-candidate window, `sort=fit` as the default, "Why this: …" + fit-% badge on `OpportunityCard`. **Stories 4.2 (incl. rail de-dup + saved-search alerts), 4.3 (skill-gap resource/roadmap/jobs links + opt-in learning plans with auto-closure tracking), 4.4 + 4.5 all done (2026-09-07)**: `eventFit.js` graph scorer (mirrors `opportunityFit`, adds a "recovery aid" signal for at-risk subjects + registration-history affinity), `GET /events?sort=fit`, fit-powered "Recommended for you" rail on `EventsListingPage`, "For you" ordering on the dashboard `CampusHubWidget`; and a shared `academicCalendar.js` feeding `LmsRevisionScheduler` (reviews pulled before mid-term/end-term/practical/CLA windows, at-risk subjects capped to a 3-day loop and floated up the queue).
- **B8 done (2026-09-06)** — Epic 6 Stories 6.1 + 6.2: `notificationService` (event taxonomy, adapter contract, delivery log + retry, quiet hours / category mute / rate limit) with in-app + Web Push adapters; VAPID auto-generates in dev; `sw-push.js` handlers; Settings "Push notifications" card; `attendance_risk` + `results_published` wired from the ERP sink.
- **B9 code-complete (2026-09-06)** — Epic 6 Story 6.4: `createEmailAdapter` (nodemailer, inert without `SMTP_HOST`), `digestService` weekly-digest builder + once-per-ISO-week cycle driven by the student graph, one-click HMAC unsubscribe (RFC 8058 headers), Settings toggle. Only a real SMTP host stands between it and prod.
- **B14 done (2026-09-06)** — Epic 5 Story 5.1: `/registration` hub with 6 tabs replaces the 3-child nav group; Bank Details moved into the Finance group; 5 placeholder blueprints + `EventsRegistrationHub` deleted (87 → 83 pages). `audit:metadata` green.
- **B14 revised (2026-09-08, user request)** — the tabbed `/registration` hub was reverted to six standalone pages under one "Registration" nav group (`RegistrationHubPage.tsx` + the `/registration` blueprint/route deleted; the six per-flow blueprints un-hidden).
- **B10 code-complete (2026-09-06)** — Epic 6 Story 6.3: dependency-free Google OAuth (`config/googleOAuth.js`), AES-256-GCM `googleTokenStore`, `calendarSyncService` (secondary calendar + weekly-recurring timetable events + one-off deadline events, idempotent upsert via `erpKey`, prune, disconnect removes the whole calendar + revokes). Settings card. Only a Google OAuth client stands between it and prod.
- **B12 code-complete (2026-09-06)** — Epic 6 Story 6.6: `classroomService` (read-only coursework pull, flag-gated `GOOGLE_CLASSROOM_ENABLED`), `unifiedDeadlineService` merging Classroom + opportunities + events + academic-calendar into one `/api/deadlines` timeline, "Coming up" panel in the Academic Hub. Works fully without Classroom; the flag stays off until T6.6.0 is answered.
- **B13 spike + code-complete (2026-09-06)** — Epic 7: Capacitor 6 config + scripts + `docs/24-NATIVE-SHELL.md` (auth strategy settled), native-push helper + inert FCM adapter + `native_subscriptions` endpoints, offline-first query persister + honest `OfflineBanner`. Remaining: store-listing builds (Play + App Store accounts) and biometric unlock.
- Verification (2026-09-07, after the tails): FE **1,210/1,210**, BE **351/351**, `tsc -b` + ESLint clean, production build green, `knip` at 0 (now blocking), `audit:bundle` OK, tap-target + responsive audits 0 issues.
- **B11 DEFERRED** — WhatsApp. Do not implement; blocked on a human go/no-go (ToS + number-ban risk). The B8 seam is ready for a drop-in adapter later.
- **Pure-code tails cleared (2026-09-07):** `CareerProfilePage`→`ProfessionalProfilePage` merge (T5.4.1), event graph fit-scorer + recs (Story 4.4), exam-aware / at-risk-weighted revision scheduler (Story 4.5), per-subject end-term grade calculator (T4.1.2), Knip cleanup + CI blocking (Story 8.3), bundle-budget CI (T8.2.3).
- **What's left inside batches:** account-gated store listings (B13), the flag-flip decisions (T6.6.0 answered / T6.5.1 pending), the 2-week analytics soak (T8.1.3, ops), populating `electiveRoleMap.json` with SRM AP's real elective codes (T4.1.4 — content, not code), and the deferred WhatsApp story (B11). Everything else is done or code-complete.

---

## Batches — independent units of delivery

The backlog is sliced into batches that can each be picked up on their own: a
batch names the epics/stories it pulls in, states what (if anything) must land
first, and what external thing — a credential, an account, an ops decision —
gates the parts that are not pure code. **Order below is a recommendation, not a
dependency chain**, except where "Needs" says otherwise.

| Batch | Scope (epics/stories) | Needs first | External gate | Status |
|---|---|---|---|---|
| **B1 — Mobile finish + responsive CI** | Epic 2 remainder (2.2.2, 2.4.3, 2.6, 2.7) | — | none | ✅ **done 2026-09-04** |
| **B2 — Engineering-health guardrails** | Epic 8 (8.1.1–8.1.2, 8.2, 8.3, 8.4, 8.5, 8.6.3) + carried 1.3.3, 1.5.2 | — | none (8.1.3 = 2-week data soak is an ops wait, not code) | ✅ **all code done 2026-09-07** (guardrails, Knip cleanup + blocking, bundle-budget CI, KaTeX `$`-gate); only the 8.1.3 analytics soak (ops) is outstanding |
| **B3 — Navigation & naming consolidation** | Epic 5 except 5.1 (5.2, 5.3, 5.4) | — | none | ✅ **done 2026-09-07** — career one front door + redirects (5.3), `HostelBookingPage` routed (5.4.2), Events `<select>` (5.4.5), register-no→name resolution on organizer surfaces (5.4.6) |
| **B4 — Student graph service** | Story 3.1 | — | Redis (or documented in-proc fallback) | ✅ **done 2026-09-06** (`erpReader` seam wired in B6 via `erpAcademicSnapshotStore`) |
| **B5 — Onboarding & consent** | Stories 3.2, 3.3 | B4 contract (T3.1.1) | none | ✅ **done 2026-09-06** |
| **B6 — Academic Hub becomes an answer** | Story 4.1 | B4 | none | ✅ **Story 4.1 code-complete 2026-09-07** (bunk advice, grade sim, end-of-term trend, elective guidance scaffold); only content left: real elective codes in `electiveRoleMap.json` |
| **B7 — Ranking & recommendations** | Stories 4.2, 4.3, 4.4, 4.5 | B4 | none | ✅ **all four stories done 2026-09-07** (career + event graph fit-scorers, `?sort=fit`, rail de-dup, saved-search alerts, skill-gap learning plans, exam-aware + at-risk-weighted revision scheduler) |
| **B8 — Notification core + Web Push** | Stories 6.1, 6.2 | — | VAPID keypair (self-generated) | ✅ **done 2026-09-06** (VAPID auto-generates in dev; set env keys for prod) |
| **B9 — Email digests** | Story 6.4 | B8 | transactional-email provider API key | ✅ **code-complete 2026-09-06** (inert without `SMTP_HOST`; `EMAIL_DEV_JSON=1` to preview) |
| **B10 — Google Calendar sync** | Story 6.3 | B8 | Google Cloud OAuth client (calendar scope) + verified consent screen | ✅ **code-complete 2026-09-06** (inert without `GOOGLE_CLIENT_ID`/`SECRET`/`OAUTH_REDIRECT`) |
| **B11 — WhatsApp channel** | Story 6.5 | B8 | self-hosted Evolution API instance **+ explicit go/no-go on ban risk** (22 §5.2) | ⏸️ **DEFERRED — do not implement.** Blocked on an explicit human go/no-go (ToS + number-ban risk). No code until then. |
| **B12 — Google Classroom** | Story 6.6 | B8, B10 (shared Google OAuth) | ~~T6.6.0~~ **answered YES**; now just the Google OAuth client + Classroom-scope verification | ✅ **code-complete 2026-09-06** — flip `GOOGLE_CLASSROOM_ENABLED=1` when scopes clear verification. `/api/deadlines` already live without it |
| **B13 — Native shell (Capacitor)** | Epic 7 | B1 done, PWA precache green (8.2.3) | Apple Developer + Play Console accounts for the store-listing tasks only | ◐ **spike + code-complete 2026-09-06** (7.1.1, 7.1.2, 7.2.1, 7.2.2); store listings (7.1.3/7.1.4) + biometric (7.1.5) need accounts / are deferred |
| **B14 — Registration hub** | Story 5.1 | B3 (nav cleanup) recommended | none | ✅ **done 2026-09-06** |

**Rules of the split**
- A batch touches its own files; where two batches would edit the same module
  (e.g. B8 and B9 both touch `notificationService`), the earlier batch lands
  the seam (interface + one adapter) and the later one only adds an adapter.
- Batches with an **External gate** are still code-complete when merged: the
  integration sits behind a feature flag defaulting **off**, with the missing
  credential the only thing between it and production.
- B4 is the keystone. B5–B7 assume its contract but not its implementation —
  they can be built against a fixture graph and swapped to the live service.

---

## EPIC 1 — Reconnect what already exists ✅ COMPLETE

> **Outcome:** No finished feature is unreachable, and no page lies about what it is.
> Delivered 2026-09-02. Verified: 1,189 FE tests, 246 BE tests, `tsc -b` and ESLint clean.

### STORY 1.1 — As a student, I can change my settings and the app remembers ✅
**AC:** Every control on `/settings` persists across reload; no raw ERP markup appears. ✔

- [x] **T1.1.1** Create `lib/core/preferences.ts` (load/save/reset, storage-failure tolerant) `S`
- [x] **T1.1.2** Wire all 8 toggles to the store; add live-region save status `S`
- [x] **T1.1.3** Route `/settings` → `Settings.tsx` in `DOMAIN_PAGE_MAP` `XS`
- [x] **T1.1.4** Implement Export (device-scoped JSON) and Clear cache (`queryClient.clear()`) `S`
- [x] **T1.1.5** Add `"This device"` to `PageSourceLabel` so the source badge is honest `XS`

### STORY 1.2 — As a student, I can use dark mode ✅
**AC:** system/light/dark selectable, applies instantly, survives reload, follows OS on "system". ✔

- [x] **T1.2.1** Create `lib/core/theme.ts` — 3-state choice, single writer for `data-theme` + `.dark` + `color-scheme` `M`
  - [x] Migrate the legacy binary `theme` key so existing dark users aren't reset
  - [x] `matchMedia` listener active only while choice is `system`
  - [x] Pub/sub so header toggle and Settings stay in sync
- [x] **T1.2.2** Call `initTheme()` at module scope in `App.tsx` (pre-paint) `XS`
- [x] **T1.2.3** Wire the Appearance selector to `setThemeChoice` `XS`

### STORY 1.3 — As a student, pages linked in the nav actually open ✅
**AC:** No nav entry or quick link resolves to the 404 page. ✔

- [x] **T1.3.1** Un-hide `/career/me/profile`, `/career/me/skill-gap`, `/career/alumni`, `/notifications` `XS`
- [x] **T1.3.2** Point `/career/me/resume` at `ResumeBuilder.tsx` instead of the profile page `XS`
- [x] **T1.3.3** Done in B2 as `routes/routeReachability.test.tsx` — see T8.4 `M`

### STORY 1.4 — As a student, I can browse every opportunity, not just the first 20 ✅
**AC:** The list pages through the full catalogue; count is visible. ✔

- [x] **T1.4.1** `careerStore.getOpportunitiesPage()` returning `{items, page, limit, hasMore}` `S`
- [x] **T1.4.2** Return pagination metadata from `GET /career/opportunities` `XS`
- [x] **T1.4.3** `useInfiniteQuery` + Load more in `OpportunitiesPage`; back-compat shape guard in `careerApi` `M`

### STORY 1.5 — As a student, I never see the university's page source ✅
**AC:** No JS/CSS fragment renders as body copy on any ERP-backed page. ✔

- [x] **T1.5.1** `looksLikeCode()` in `sanitize.ts` — two-signal rule + brace-density fallback `S`
- [x] **T1.5.2** Done in B2 via `services/erp/extractors/loadHtml.js` — see T8.5 `S`

---

## EPIC 2 — Mobile-first ✅ COMPLETE (Batch B1, 2026-09-04)

> **Outcome:** Every route is comfortable one-handed on a 390px screen. This is the
> single biggest lever on retention — it is the device students actually use.
> Verified: responsive audit 0 issues at 320/390/768/1440px, tap-target audit
> 0 offenders across the main routes, 1,190 FE tests, `tsc -b` + ESLint clean.

### STORY 2.1 — As a student on my phone, I can navigate without a desktop sidebar ✅
**AC:** No icon rail below 768px; labelled tabs; content gets full width. ✔

- [x] **T2.1.1** Build `components/shell/MobileTabBar.tsx` — 4 pillars + More, longest-prefix active state `M`
- [x] **T2.1.2** Hide sidebar `<md`; convert to overlay drawer driven by PageLayout `M`
- [x] **T2.1.3** Bottom padding on `<main>` + `env(safe-area-inset-bottom)` `XS`
- [x] **T2.1.4** Hide the `⌘K` / shortcuts pills on touch viewports `XS`

### STORY 2.2 — As a student, headings are readable on my phone ✅
**AC:** No text renders on the accent wedge below 768px. ✔

- [x] **T2.2.1** `@media (max-width: 767px)` suppressing `.dashboard-background::before` `XS`
- [x] **T2.2.2** `usePageContrast` already builds the accent polygon from the
      `--dash-accent-*` geometry vars; now it also reads whether the wedge
      `::before` is actually painted and clears `page-on-accent` (bailing) when
      it is not — so the suppressed-below-768px wedge can't leave stale state `M`

### STORY 2.3 — As a student, the dashboard leads with what I opened it for ✅
**AC:** Attendance and next class above the fold; identity data last. ✔

- [x] **T2.3.1** Dissolve the widget row below `md` so cards order independently `S`
- [x] **T2.3.2** Re-order: Welcome → Attendance → Schedule → Calendar → Tasks → To-Do → Campus → Basic Info `S`

### STORY 2.4 — As a student, I can read data tables on my phone `L` ◐
**AC:** No table requires horizontal scrolling or zoom; the key number is visible on first paint.

- [x] **T2.4.1** Per-viewport rendering via `hooks/useMediaQuery.ts` (`useIsMobileViewport`) —
      exactly one of table / cards is mounted, keeping the a11y tree honest `M`
- [x] **T2.4.2** Attendance — `AttendanceSubjectCards` leads with the percentage and the
      "you can miss N more" action; raw counts demoted `S`
- [x] **T2.4.3** Results current + earlier now use exclusive per-viewport
      rendering: `SubjectResultsTable` mobile cards lead with the **grade** +
      pass/fail pill (counts demoted); the shared `DataTable` (earlier-results
      internal + exam marks) dropped its `hidden md:block` / `md:hidden` mirror
      for `useIsMobileViewport`, so the a11y tree carries one copy `S`
- [x] **T2.4.4** Fee Dues / Fee Paid — `FeeRowCards` + inline receipt cards, lead amount emphasised `S`
- [x] **T2.4.5** Widened the attendance chart y-axis (28→36px) so "100%" is not clipped to "00%" `XS`

### STORY 2.5 — As a student, single-item sections don't look broken `S` ✅
**AC:** A rail with one item renders as one wide card, not a 3-col grid with two holes. ✔

- [x] **T2.5.1** Item-count-aware grid classes in `ResourceGrid` (1 → full row, 2 → split, 3+ → 3-col) `S`
- [x] **T2.5.2** Applied on `/learn` (Continue Learning via ResourceGrid) and `/career` (Personalized rail) `XS`

### STORY 2.6 — As a maintainer, mobile regressions fail CI `M` ✅
- [x] **T2.6.1** `390` added to `responsive-audit.mjs` `ALL_WIDTHS` and to the
      CI invocation (`--widths 320,390,768,1440`) `XS`
- [x] **T2.6.2** Audit already fails on horizontal overflow + clipped text;
      added a `WEDGE` check — below 768px `.dashboard-background::before` must be
      `display:none`, else the route is flagged and the job fails `S`
- [x] **T2.6.3** The `responsive-audit` job had no `continue-on-error` (already
      blocking) but no browser either — added `npx playwright install --with-deps
      chromium`; also added a `tap-target audit` step to the same job `XS`

### STORY 2.7 — As a student, the app fixes its remaining mobile rough edges `M` ✅
- [x] **T2.7.1** New `scripts/tap-target-audit.mjs` (`npm run audit:tap-targets`)
      sweeps every route at 390px, fails on any interactive element under 44×44
      (2px sub-pixel tolerance) that is not an inline prose link. Systemic fixes:
      `.comp-btn-primary`/`.comp-btn-ghost` 44px floor; new `styles/touch-targets.css`
      (`@media (pointer:coarse)`) for breadcrumb links, `h-9`/`h-10` controls,
      icon-only buttons, native selects; `SegmentedControl` `min-h-11` on touch;
      Header links, `OpportunityCard` title link, attendance-code cells. Result:
      **0 offenders** (2 documented exceptions for the contiguous code cells) `M`
- [x] **T2.7.2** Sidebar/Header/Login logo replaced with the `UniVerseWordmark`
      SVG (`currentColor` + `--comp-accent`) — the old asset was a photo of a
      printed sign with a baked-in off-white background `XS`
- [x] **T2.7.3** Reviewed Create Event + Raise Ticket: both already collapse to a
      single column ≤760px with the DOM order = visual order (Raise Ticket:
      category → priority → subject → description → submit; Create Event: form
      card then the banner/preview/tip aside). No reorder needed; `min-h-11` /
      44px targets confirmed by the tap-target audit `S`

---

## EPIC 3 — The student graph   ◐ (Batch B4, 2026-09-06 — Story 3.1 landed)

> **Outcome:** One typed, cached, queryable profile per student. Nothing else in
> Epics 4–6 works properly without it. **Build this before those.**

### STORY 3.1 — As the platform, I can assemble a complete student profile `L` ✅ (bar the ERP-marks seam)
**AC:** `GET /api/student-graph` returns identity, academic, skills, activity and derived sections for the session user in <200ms warm. ✔ (warm path is a `Map.get`)

- [x] **T3.1.1** `Frontend/src/lib/core/studentGraph.ts` — full `StudentGraph`
      type + `STUDENT_GRAPH_CONTRACT` version + `getStudentGraph()` /
      `recomputeStudentGraph()` clients + `readinessLabel()`. The service header
      documents the equivalent shape; a standalone `.json` schema file is the
      only unshipped part `S`
- [x] **T3.1.2** `services/core/studentGraphService.js` composes:
  - [x] Identity from the session user context
  - [x] Per-subject attendance from `attendanceSnapshotStore.history()`
  - [x] Skills + activity (events / LMS / achievements) from `unifiedProfileStore.buildUnifiedProfile()`
  - [~] Curriculum + marks/SGPA/CGPA via an **`erpReader` seam** (sync `getCurriculum`/`getResults`) — defined and tested, not yet wired to the ERP aggregation cache, so those sections currently report `sources.* = "unavailable"` and the graph still builds. **This is the remaining T3.1.2 work.**
- [x] **T3.1.3** `SimpleTtlCache` (60s TTL, user-scoped `student-graph:<id>` key,
      LRU-ish cap). `invalidate()` wired into `erpDataSink.onLivePageFetched`
      for any `academic/*` or `examination/*` page. Redis swap = replace `cache`
      with a get/set/delete wrapper, nothing else changes `M`
- [x] **T3.1.4** `routes/studentGraphRoutes.js` — `GET /api/student-graph`
      (`?recompute=1` bypass) + `POST /api/student-graph/recompute`, auth-gated,
      mounted in `app.js`; `studentGraphService` constructed in `server.js` `S`
- [x] **T3.1.5** `derived`: `atRiskSubjects` (+ `classesToRecover` — consecutive
      classes to climb back to 75%), `borderlineSubjects`, `skillGaps`,
      `readinessScore` 0–100 from a weighted 4-part `readinessBreakdown`
      (academic 40 / skills 25 / activity 20 / profile 15) `M`
- [x] **T3.1.6** `test/studentGraphService.test.js` — 9 tests: full assembly,
      `classesToRecover` arithmetic, **sparse student** (no profile, no
      attendance → score 0, no throw), cache warm/invalidate/recompute,
      auth rejection, `erpReader` path, TTL expiry, and a route integration
      test (401 → 200 → warm → recompute). Frontend: `hooks/useStudentGraph.ts`
      + `studentGraphKeys` for B5–B7 consumers `M`

### STORY 3.2 — As a student, I'm asked what I want so recommendations are useful `M` ✅ (Batch B5, 2026-09-06)
**AC:** First run collects target roles, interest areas, skills, grad year; skippable; re-editable in Settings. ✔

- [x] **T3.2.1** `pages/Onboarding/OnboardingFlow.tsx` — a 5-step Dialog (consent →
      target roles → interest areas → skills → graduation year + placement
      intent), mounted in `PageLayout`, auto-opens once when `intent.status ===
      "none"`. Roles/interests are chip inputs with seeded suggestions; the
      skills step is **pre-filled from `graph.skills`** (resume + courses +
      activity) to confirm-or-edit. `FirstRunGuide` (the old dismissible banner)
      is left as-is `M`
- [x] **T3.2.2** `services/core/studentIntentStore.js` (`student_intent` table,
      shares the unified-profile DB) + `GET`/`PUT /api/student-graph/intent` in
      `studentGraphRoutes.js`, merge-write with list/enum sanitisation `S`
- [x] **T3.2.3** A skip calls `putIntent({skipped:true})` → status `"skipped"`
      (a real row, not empty), so downstream fallbacks have branch/semester to
      work with. `hasAnySignal()` also auto-promotes to `"complete"` `S`
- [x] **T3.2.4** `pages/Settings/CareerIntentSettings.tsx` — edit every field +
      consent from Settings, rendered as two `SectionCard`s `S`
- [x] **T3.2.5** `OnboardingFlow` renders a slim re-prompt **banner** (not the
      dialog) at the top of the content area while `intent.status === "skipped"`,
      with "Set it up" (reopens the flow) and a session-local dismiss `S`

### STORY 3.3 — As a student, I control what the platform infers about me `M` ✅ (Batch B5, 2026-09-06)
**AC:** A screen shows every derived signal with its source, and delete works. ✔

- [x] **T3.3.1** Step 1 of `OnboardingFlow` is consent: 3 toggles
      (`derivedSignals`, `leaderboards`, `publicProfile`), **all default off**,
      plain-language help text, and copy stating every feature works with all of
      them off `S`
- [x] **T3.3.2** `GET /api/student-graph/provenance` + `buildProvenance()`
      re-projects the graph into a flat, categorised list — every identity /
      academic / skill / derived / declared row tagged with a human source
      ("Parsed from your uploaded resume", "Computed from your attendance", …).
      Surfaced in Settings under "What we know about you" `M`
- [x] **T3.3.3** `DELETE /api/student-graph/derived` → `studentIntentStore.clear()`
      + graph-cache invalidation; wired to a "Delete what the platform inferred"
      button in Settings. Consent flags travel *with* the graph so leaderboard /
      organiser surfaces can honour `consent.leaderboards === false` (academic
      risk is never in a non-self projection) `M`

**Tests:** `test/studentIntentStore.test.js` (16 — store CRUD/sanitisation, skip
semantics, clear, graph fold-in, provenance, full route flow) +
`OnboardingFlow.test.tsx` (4 — gating, skip, 5-step finish payload, skipped
banner). BE 270, FE 1,200.

---

## EPIC 4 — Surfaces that act, not display

> **Outcome:** Every major surface answers the student's actual question.
> **Depends on Epic 3.**

### STORY 4.1 — As a student, the Academic Hub tells me what to do `L` ◐ (Batch B6, 2026-09-06)
**AC:** Every hub tab leads with an answer or an action, not a table.

- [x] **T4.1.1** `hub/BunkAdvicePanel.tsx` — reads the student graph's per-subject
      attendance and states the number for each: "you can miss **N** more of
      CSE101", "attend the next **N** to get back to 75%", plus a summary line.
      Leads the "Where am I vulnerable?" tab; the old blunt aggregate alert is
      now a fallback for when the graph has no snapshot. 5 tests `M`
- [x] **T4.1.2** PlannerTab carries the semester-level simulator
      (`SgpaCgpaPredictor` grade→CGPA + `TargetCgpaCalculator` target→required
      SGPA/sem) **and now** `hub/GradeTargetCalculator.tsx` — the per-subject
      "N in *this* final" answer. `AcademicHubPage` adds
      `examination/internal-mark-details` to the planner ERP batch; the
      `results-current` pipeline already bundles it as
      `currentResults.internalMarks.subjects[]` (`marksObtained`/`maxMarks` =
      internal secured/max). For each subject it derives end-term weight
      (`100 - internalMax`, editable per row), takes a target grade (SRM AP
      absolute bands O…P, or a custom %), and states "Need **78/100** on the
      CSE304 end-term for **A**" — with "locked in" / "out of reach (caps at
      X/100)" verdicts. 6 tests. `M`
- [x] **T4.1.3** Real end-of-term projection (2026-09-07). `academicCalendar.js`
      gains `listTeachingTerms()` + `termProgress({now})` (elapsed fraction,
      weeks remaining to the last teaching day); `studentGraphService._derive`
      surfaces it as `graph.derived.termProgress`. `BunkAdvicePanel` estimates
      each subject's classes-per-week from the pace so far and projects to the
      last teaching day: "Attend N of the ~M classes left to clear 75%", or
      "75% is out of reach — even a perfect record from here lands near X%".
      Falls back to the old remaining-fraction heuristic when the calendar is
      absent or the term is < 2 weeks in. 4 BE + 3 FE tests. `M`
- [x] **T4.1.4** Elective guidance scaffolded (2026-09-07). Role taxonomy
      (`TRACKS`, 12 tracks) + free-text-goal → track resolver +
      `rankElectives()` in `services/career/electiveGuidance.js`; a **keyword
      seed map** `data/electiveRoleMap.json` (~40 topic → `[trackId, weight]`
      entries) matched as substrings against each curriculum subject's name —
      **TODO in the file: swap/augment with SRM AP's exact elective codes** once
      the catalogue is to hand (keyword matching stays as the fallback).
      `GET /career/elective-guidance` (reads curriculum + intent off the student
      graph); `hub/ElectiveGuidancePanel.tsx` in the "What if…" tab: "Ranked for
      **ML / AI Engineer** — Introduction to Machine Learning · *Strong for ML /
      AI Engineer*". 5 BE + 3 FE tests. `L`
- [x] **T4.1.5** Deleted the orphaned standalone `UnifiedInsights.tsx` /
      `AcademicInsights.tsx` / `ProgressOverview.tsx` (+ tests) — unrouted, and
      their data has long been consumed through the hub tabs' `getLms*` queries `M`
- [x] **T4.1.6** `AcademicTrackerPage.tsx` deleted in B3 (T5.4.3) `XS`

**B6 also closed B4's open seam:** `services/erp/erpAcademicSnapshotStore.js` —
the live-data sink now captures curriculum / current-results / CGPA / exam
history per user; `readerFor()` is the synchronous `erpReader` the graph needed,
so `graph.academic.curriculum` and `graph.academic.results` (CGPA, SGPA-by-
semester, current subjects) are live. 5 tests. Frontend: `useStudentGraph` wired
into `AcademicHubPage`.

### STORY 4.2 — As a student, opportunities are ranked for me `L` ✅ (Batch B7, 2026-09-06)
**AC:** Default sort is graph fit; every card states why it was surfaced. ✔

- [x] **T4.2.1** `services/career/opportunityFit.js` — pure `scoreOpportunityFit()`:
      skills ∩ requirements, **CGPA cutoff** (`opportunity.minCGPA` vs graph
      CGPA; unknown never disqualifies), branch/year eligibility, target-role
      keyword alignment, deadline urgency → 0–100 `fitScore` + matched/missing
      skills + hard `eligible` flag. `rankOpportunities()` scores+sorts a batch,
      drops the ineligible. `GET /career/opportunities?sort=fit` scores a
      400-candidate window against the student graph and paginates the ranking.
      7 + 1 tests `L`
- [x] **T4.2.2** `scoreOpportunityFit().whyThis` — up to 3 plain-language reasons
      ("Matches your goal: Data Scientist", "You have 2/3 of the listed skills",
      "Your CGPA clears the 7 cutoff", "Closes in 5 days"). Rendered as a
      "Why this: …" line on `OpportunityCard`, plus an "N% fit" badge `S`
- [x] **T4.2.3** `OpportunitiesPage` defaults to `sort=fit` ("Best fit for you"
      is the first sort option); server falls back to relevance when the graph
      service is absent. Recency / deadline / popular kept `S`
- [x] **T4.2.4** `isStillOpen()` in `CareerHomePage` filters passed-deadline /
      `isActive === false` opportunities out of the rails (earlier mobile pass) `XS`
- [x] **T4.2.5** `CareerHomePage` now shows each opportunity in at most one rail
      (Personalized > Expiring soon > Latest) via a `useMemo` dedup; the Latest
      section hides entirely when everything in it already appeared above. `S`
- [x] **T4.2.6** Saved searches + alerts (2026-09-07). `career_saved_searches`
      table + `savedSearchMethods` on `careerStore` (CRUD, 20/user cap,
      `matchSavedSearchAlerts(now)` counting new matches since `lastRunAt` via
      the FTS query + column filters). `runCareerNotificationCycle` emits one
      idempotent-per-day `career_saved_search_match` in-app notification per hit.
      `GET/POST/PATCH/DELETE /career/saved-searches`. Frontend:
      `SavedSearchBar` on `OpportunitiesPage` — a "Save search" chip that
      captures the current `{query,type}` (name + alert toggle), plus chips to
      re-apply / bell-toggle / delete each saved search. 3 BE + 4 FE tests. `M`

### STORY 4.3 — As a student, skill gaps come with a way to close them `M` ✅ (2026-09-07)
- [x] **T4.3.1** Per gap, `SkillGapPage` now deep-links to **Resources**
      (`/learn/discover?q=<skill>`), a **Roadmap** (`/learn/roadmaps?q=<skill>` —
      `RoadmapsListPage` gained `?q=` filtering over skill/title/description) and
      **jobs** (`/career/opportunities?query=<skill>`). `M`
- [x] **T4.3.2** "Close this gap" → `career_learning_plans` table +
      `learningPlanMethods` on `careerStore` (create/reopen, 30-active cap,
      manual close/reopen, delete). `GET/POST/PATCH/DELETE
      /career/learning-plans`. The button on each gap becomes "Mark done" /
      "Closed" once a plan exists. `M`
- [x] **T4.3.3** `reconcileLearningPlans(user, acquiredSkills)` auto-closes a
      plan (`closedReason: "acquired"`) once its skill appears in
      `graph.skills` — run on every `GET /career/learning-plans`. `SkillGapPage`
      shows a "Your progress" card: N gaps closed / N in progress, the active
      list with "done", and recently-closed with "now on your profile" +
      reopen/remove. 3 BE + 4 FE (SkillGap) + 3 FE (Roadmaps ?q) tests. `S`

### STORY 4.4 — As a student, events are recommended by relevance `M` ✅ (2026-09-07)
- [x] **T4.4.1** `services/events/eventFit.js` — the events-side mirror of
      `career/opportunityFit.js`. `scoreEventFit({event, student})` blends: an
      eligible/live openness floor (0.15), event-text ∩ student skills (0.22),
      skill-gap builder (0.16), target-role/interest overlap (0.14), academic
      department alignment (0.13), **recovery aid** — the event touches an
      at-risk subject from the graph (0.10), category/tag affinity from the
      student's own registration history (0.08), registration urgency (0.07),
      plus competition/featured boosts. Returns `{fitScore, eligible,
      matchedSkills, whyThis[], breakdown}`; branch named on an eligibility
      whitelist the student isn't on → `eligible:false`. `rankEvents()` +
      `studentSliceFromGraph()`. `GET /api/events?sort=fit` ranks the upcoming
      list against `studentGraphService.getGraph()` (falls back to the plain
      chronological list when the graph isn't wired). 9 unit + 3 route tests. `M`
- [x] **T4.4.2** `EventsListingPage`'s "Recommended for you" rail now prefers
      the graph fit feed (`?sort=fit`), rendering `fit.whyThis` reasons + the
      fit-% badge, and falls back to the keyword `getPlatformRecommendations`
      path (prototype / no-graph). `events_recommendations_viewed` /
      `events_recommendation_clicked` analytics fire for whichever source. `S`
- [x] **T4.4.3** Dashboard: the events surface is `CampusHubWidget` (it
      superseded the now-dormant `UpcomingEventsWidget`, which stays retired).
      Its events tab fetches `?sort=fit`, orders by `fit.fitScore`, and badges
      each card "For you" with the top reason. `S`

### STORY 4.5 — As a student, revision follows my real exam schedule `M` ✅ (2026-09-07)
- [x] **T4.5.1** New shared `services/core/academicCalendar.js` — the single
      reader for `academicCalendar.json` (`parseAcademicDateRange` handles the
      `"DD.MM.YYYY - DD.MM.YYYY"` windows the old inline parser silently
      dropped; `listExamWindows()` classifies mid-term / end-term / practical /
      CLA-mark-entry rows). `unifiedDeadlineService` refactored onto it.
      `LmsRevisionScheduler` now takes `{ academicCalendar }` and
      `getNextRevision` pulls a review to **two days before** the nearest
      assessment within a 45-day lookahead (`adjustedForExam` on the result),
      leaving reviews that already land earlier untouched. Fully backward
      compatible — omit the context and it's the old SM-2. 5 + 8 unit tests. `M`
- [x] **T4.5.2** `getNextRevision({ atRisk })` caps an at-risk subject's
      interval at 3 days (`adjustedForAtRisk`). `learningAdminRoutes` reads
      `graph.derived.atRiskSubjects` (injected `studentGraphService`), passes the
      codes to `lmsStore.updateRevisionSchedule` / `generateLearningSession`
      (which resolves each resource's `subjectCode`), and re-weights
      `GET /lms/revision` so an at-risk subject floats to the top of its week
      bucket. `RevisionQueuePage` badges those rows "Prioritised · attendance
      low". 2 store tests. `S`

---

## EPIC 5 — Consolidate navigation and naming

> **Outcome:** Fewer, better destinations. Removes ~7 sidebar entries.

### STORY 5.1 — As a student, related ERP pages live in one place `M` ✅ (Batch B14, 2026-09-06)
- [x] **T5.1.1** ~~`pages/ERP/RegistrationHubPage.tsx` at `/registration` — one
      `SegmentedControl` with six tabs~~ **Superseded (2026-09-08, user request):**
      the tabbed hub is gone. The six per-flow blueprints
      (`/registration/{course,minor-oe,exam,hostel,transport,sap}-registration`)
      are visible standalone pages again — each renders `RegistrationErpPage`
      (hostel via `HostelRegistrationPage` for the Buddy Finder) — grouped under
      a single "Registration" nav group. `RegistrationHubPage.tsx` +
      `SegmentedControl` tab chrome + the `/registration` blueprint / route
      deleted `M`
- [x] **T5.1.2** `/finance/bank-details` un-hidden and added to the **Finance**
      nav group; SAP & Scholarships is reachable from the hub's SAP tab. The
      six per-flow registration blueprints are now `status: hidden` (the hub is
      the front door; they stay directly navigable / deep-linkable) `S`
- [x] **T5.1.3 / T5.4.4** Deleted the 5 stale placeholder blueprints
      (`/exams/essentials`, `/transport-hostel/{routes,route-details}`,
      `/registration/{events-registration,registration-tracker}`) and the now-
      unused local `placeholder()` factory; also deleted the orphaned
      `EventsRegistrationHub.tsx` (+test) and its dead `DOMAIN_PAGE_MAP` entry.
      `audit:metadata` passes (83 pages, was 87) `XS`

### STORY 5.2 — As a student, one place has one name `S` ✅ (Batch B3, 2026-09-04)
- [x] **T5.2.1 / T5.2.2** Audit result: the nav is already consistent. Breadcrumb
      leaves come from the same `getRouteCatalog()` labels as the nav, and **no**
      student-facing nav label contains the string "LMS". The only heading↔label
      divergence is `/learn/materials` ("Official materials" nav / "Learning
      Materials" page) — a deliberate terse-nav choice, frozen in the test `XS`
- [x] **T5.2.3** `config/navConsistency.test.ts` (2 tests): every visible
      blueprint `heading` equals its nav label bar a frozen `KNOWN_MISMATCHES`
      allowlist (fails on a *new* mismatch or a stale entry); and no nav label
      matches `/\blms\b/i`. Full label=breadcrumb=`<h1>` render check deferred —
      the render-free registry check covers the regression risk `S`

### STORY 5.3 — As a student, career discovery has one front door `M` ✅ (2026-09-07)
- [x] **T5.3.1** `/career/opportunities` is the one front door; type is a `?type=`
      filter (already fully wired in `OpportunitiesPage` — URL-synced state +
      filter chips). Deleted the 4 per-type blueprints
      (`/career/{jobs,internships,hackathons,competitions}`), their 4
      `DOMAIN_PAGE_MAP` entries, and the now-dead `initialType` prop. `S`
- [x] **T5.3.2** `careerRedirectRoutes` in `routes/erpRoutes` — each retired
      path `<Navigate replace>`s to `/career/opportunities?type=<type>`, spread
      into the router before the `*` fallback so old links / bookmarks land on
      the filtered list instead of 404. `XS`

### STORY 5.4 — As a maintainer, dead code is gone `M` ✅ (2026-09-07)
- [x] **T5.4.1** Merged `CareerProfilePage` (unrouted, 736 LOC) into the routed
      `ProfessionalProfilePage` and deleted the loser + its 7-case test. Ported
      the features worth keeping: **Career Preferences** (preferredTypes toggles
      / preferredLocations / minStipend / cgpa — now sent in `updateProfile` so
      they feed B7's `opportunityFit` scorer), the **Public Portfolio** panel
      (completeness/skill/achievement tiles, skills-audience `Select`, copy link,
      Markdown export, preview) and **Verified Achievements** panel (per-item
      visibility `Select` + sync) — both extracted to a self-contained
      `ProfileSharingPanels.tsx` (288 LOC) — plus resume `analysis.suggestions`
      + parsed-skill chips and the `track()` calls (`resume_analyzed`,
      `resume_skills_synced`, `career_achievement*`, `public_career_profile_*`).
      The Proof/resume card moved to `ResumeProofPanel.tsx` (113 LOC) to keep the
      page at 450 LOC (< 500). Net −257 page LOC, zero feature loss, dead route
      gone. `ProfessionalProfilePage.test.tsx` rewritten to 8 cases (migrated the
      6 useful behaviours from the deleted test). `tsc -b` + ESLint clean,
      8/8 + full FE suite green. `M`
- [x] **T5.4.2** `HostelBookingPage` was rendering the *generic* `BlueprintPage`
      at `/transport-hostel/hostel-booking` — now wired to its bespoke component
      via `DOMAIN_PAGE_MAP`, and "Hostel Booking" + "Rooms Details" (its equally
      orphaned campus sibling) added to the sidebar's **Campus Tools** group so
      both are reachable. `CareerWidget` stays retired — it's explicitly
      "Dormant: superseded by `CampusHubWidget`" (whose Career tab already
      covers it), same call as `UpcomingEventsWidget` in T4.4.3. `S`
- [x] **T5.4.3** Deleted 14 dead files, all verified zero-reference / stub-body,
      `tsc -b` + ESLint + 1,196 FE tests green after:
      `AcademicTrackerPage.tsx` (also T4.1.6), `EventsWidget.tsx` +test,
      `FeedbackDashboard.tsx`, the 5 shells (`Academic{Advising,Planner,Progress}Page.tsx`,
      `Resources/{AdvancedAccess,LearningMaterials}.tsx`), and 5 more Knip-flagged
      orphans (`competition/OrganizerGuard.tsx`, `competition/RoundStatusCard.tsx`,
      `data/RowActionButton.tsx`, `lms/FlipCard.tsx`, `ThemeToggle.tsx` — the
      last superseded by `lib/core/theme.ts`) `S`
- [x] **T5.4.4** Done in B14 (T5.1.3) — 5 placeholder blueprints + the
      `placeholder()` factory + `EventsRegistrationHub` removed `XS`
- [x] **T5.4.5** The last two raw `<select>` on the Events surface (Category +
      Department on `CreateEventPage` step 1) swapped for the design-system
      `Select` with `aria-label`s. Every other Events select already used it. `S`
- [x] **T5.4.6** `SourceBadge` no longer renders "VIA MANUAL" — `manual`/`seed`/
      `internal`/`admin` origins map to `null` and render nothing; known portals
      get friendly names (`jobspy`/`linkedin`→LinkedIn, `unstop`→Unstop,
      `devfolio`→Devfolio); unknown values pass through. `SourceBadge.test.tsx`
      rewritten (5 cases). **Done 2026-09-07:** `userDirectoryStore` (SQLite
      `user_directory`, own db) populated as a side effect of the shared
      `createUserContextMiddleware` — every authed events/competition request
      records its `{ registerNo, name }` (best-effort, never breaks a request;
      role placeholders ignored). `GET /api/users/resolve?ids=…` (auth, ≤200
      ids, `name: null` for unknowns). Frontend: `resolveUserNames` +
      `useResolvedNames(ids) → nameFor(id)` hook (batched, 5-min cache, falls
      back to the raw id). Applied to `LeaderboardPage`, `ShortlistPage`,
      `EvaluationPage` participant line + `AuditHistoryPanel` actor (new
      optional `resolveActor` prop). 5 BE + 2 FE tests. `S`

---

## EPIC 6 — Notifications and integrations

> **Outcome:** The platform reaches students where they are.
> **Read [22 §5](./22-PRODUCT-ROADMAP.md#5-integration-due-diligence) before starting — WhatsApp and Classroom both carry real risk.**

### STORY 6.1 — As the platform, I have one channel-agnostic notification layer `L` ✅ (Batch B8, 2026-09-06)
**AC:** Callers emit an event; adapters decide delivery. Adding a channel touches no caller. ✔

- [x] **T6.1.1** `services/core/notificationService.js` — `NOTIFICATION_EVENTS`
      taxonomy (attendance_risk, results_published, deadline_tomorrow,
      opportunity_match, event_reminder, organizer_message, digest_weekly),
      each with a `category` (academic/career/events/system), `critical` flag,
      default channels, and title/body/url templates. `emit(eventKey, {userId,
      params})` resolves the template, checks prefs, dispatches. Per-user
      channel prefs in `notificationStore.js` (shares the unified-profile DB) `M`
- [x] **T6.1.2** Adapter contract `{ name, deliver({userId, notification}) →
      {ok, error?} }`. `createInAppAdapter` (through the events-store list) +
      `createWebPushAdapter` (`web-push`, prunes 404/410 subs). Delivery log
      table with per-attempt rows; `_deliverWithRetry` does 2 attempts with
      backoff `M`
- [x] **T6.1.3** Quiet hours (IST clock, overnight-window aware) + per-category
      mute + per-category rate limit (8/hour). Non-critical events are held /
      throttled; `critical` events (attendance/results/deadline) always pass `M`

### STORY 6.2 — As a student, I get push notifications for free `M` ✅ (Batch B8, 2026-09-06)
**AC:** Opt-in Web Push works on Android and installed iOS PWAs. ✔

- [x] **T6.2.1** `config/vapid.js` resolves a keypair from env → `data/vapid.json`
      → **auto-generated on first dev boot** (verified: server logs the public
      key, persists the pair, gitignored). Routes: `GET
      /api/notifications/vapid-key`, `POST /api/notifications/push/{subscribe,
      unsubscribe}`, `GET/PUT /api/notifications/preferences`,
      `GET /api/notifications/deliveries`, `POST /api/notifications/test` `S`
- [x] **T6.2.2** `public/sw-push.js` (`push` + `notificationclick`, focus-or-open),
      imported by the Workbox SW via `vite.config.ts → workbox.importScripts`.
      `lib/core/webPush.ts` handles permission + subscribe + server registration;
      `Settings → Push notifications` card exposes the per-device toggle,
      per-category switches, and quiet-hours pickers (prompt shown from Settings,
      not nagged on load) `M`
- [x] **T6.2.3** `attendance_risk` fires from the ERP live-data sink for each
      breaching subject, but only when the snapshot actually **changed** (so a
      re-fetch doesn't re-notify); `results_published` fires on the transition
      from no-graded-results → graded (via `erpAcademicSnapshotStore.hasGradedResults`).
      `deadline_tomorrow` template is in place; wiring it through the existing
      `runCareerNotificationCycle` (currently a direct in-app push) is the
      remaining bit `S`

**Tests:** `test/notificationService.test.js` (13 — store CRUD, quiet-hours math,
channel gating, category mute, rate limit, retry+log, adapters, full route
flow, 503 when unconfigured). BE 296, FE 1,203.

### STORY 6.3 — As a student, my timetable is in my Google Calendar `L` ✅ (Batch B10, 2026-09-06 — code-complete; needs a Google OAuth client for prod)
- [x] **T6.3.1** `config/googleOAuth.js` (dependency-free — raw `fetch` against
      Google's token endpoint): auth-URL builder (scope `calendar.events` +
      `calendarlist`, `access_type=offline`, `prompt=consent`), code exchange,
      refresh, revoke. `isConfigured()` gates everything on
      `GOOGLE_CLIENT_ID`/`SECRET`/`OAUTH_REDIRECT`. `services/core/googleTokenStore.js`
      — **AES-256-GCM at rest** (key from `GOOGLE_TOKEN_ENC_KEY` or auto-persisted),
      partial-save keeps the refresh token, `synced_items` table `M`
- [x] **T6.3.2** `services/core/calendarSyncService.js` `syncTimetable()` —
      creates ONE secondary "University ERP" calendar per user, turns each
      timetable period into a **weekly-recurring** event (`RRULE:FREQ=WEEKLY`,
      IST, 10-min popup). `erpAcademicSnapshotStore` now captures the timetable
      schedule from the live-data sink for the sync cycle to read `M`
- [x] **T6.3.3** `syncDeadlines()` — one-off events for saved-opportunity
      deadlines (24h + 1h popups). `/api/integrations/google/sync` runs both;
      a 6-hourly `calendarTicker` re-syncs every connected user. (Fee dues /
      event registrations use the same `syncDeadlines` shape when those feeds
      are wired.) `M`
- [x] **T6.3.4** Every event carries `extendedProperties.private.erpKey`, so a
      re-sync is an idempotent upsert (PATCH existing / POST new / re-create on
      404) and `_prune` deletes events whose erpKey vanished. `disconnect()`
      deletes the whole secondary calendar, revokes the refresh token, and
      clears the store `M`

**Tests:** `test/calendarSync.test.js` (13 — OAuth URL/exchange/refresh, encrypted
token round-trip, signed+tamper-evident state, callback→calendar creation,
timetable create/idempotent-PATCH/prune, deadline events, disconnect cleanup,
expired-token refresh, `parseSlot` 12h handling, full route flow). Settings gets
a "Google Calendar" card (connect / sync now / disconnect / unavailable state).
BE 316, FE 1,202.

### STORY 6.4 — As a student, I get email digests `M` ✅ (Batch B9, 2026-09-06 — code-complete; needs an SMTP host for prod)
- [x] **T6.4.1** `createEmailAdapter` (a B8-contract adapter) — `nodemailer` SMTP
      transport from `EMAIL_CONFIG` env (`SMTP_HOST`/`PORT`/`USER`/`PASS`/
      `EMAIL_FROM`/`APP_BASE_URL`). **Inert with no config**; `EMAIL_DEV_JSON=1`
      logs the payload. `notificationStore` gained a `notification_contact`
      table (userId→email, kept current by a route middleware) since `emit()`
      only carries `userId`. `email` added to the channel set, default OFF `S`
- [x] **T6.4.2** `services/core/digestService.js` — `buildWeeklyDigest({graph,
      deadlines, topFits, events})` renders HTML + text from the student graph
      (readiness score, at-risk subjects, skill gap) plus career deadlines;
      "all clear" when there's nothing to say. `runWeeklyDigestCycle` iterates
      `notificationStore.digestRecipients()` (email channel on, contact known,
      `system` not muted), **once per ISO week** (idempotency marker = the week
      key in the delivery log). Hourly `digestTicker` in `server.js` `M`
- [x] **T6.4.3** `GET|POST /api/notifications/email/unsubscribe?u=&t=` — no
      session; a per-user HMAC token (`notificationStore.unsubscribeToken`,
      secret auto-persisted) is the authorisation. Sets `channels.email = false`
      and returns a plain confirmation page. Every digest carries the link plus
      `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058). Settings
      shows a "Weekly email digest" toggle with the address on file `XS`

**Tests:** `test/digestService.test.js` (6) + unsubscribe route + email-adapter
cases in `test/notificationService.test.js`. BE 303, FE 1,203.

### STORY 6.5 — As a student, I can opt in to WhatsApp alerts `L` ⏸️ DEFERRED — DO NOT IMPLEMENT
**Blocked on a human go/no-go decision.** Evolution API is an unofficial WhatsApp
Web session; sending templated bulk messages risks the number being **banned, not
warned**, and violates WhatsApp's ToS. **Do not write any WhatsApp code** — no
adapter, no routes, no opt-in UI — until T6.5.1 returns an explicit "go".
The B8 notification layer already has the seam; a `whatsApp` adapter drops in
later with zero caller changes.

- [ ] **T6.5.1** ⏸️ Spike: self-host Evolution API, confirm session stability, **document ban risk and get an explicit go/no-go** `M`
- [ ] **T6.5.2** ⏸️ Adapter behind the Epic 6.1 interface — **only after T6.5.1 = go** `M`
- [ ] **T6.5.3** ⏸️ Opt-in with number verification; default OFF `S`
- [ ] **T6.5.4** ⏸️ Hard limit to time-critical categories; never digests `S`

### STORY 6.6 — As a student, my Classroom assignments appear alongside campus deadlines `L` ✅ (Batch B12, 2026-09-06 — code-complete)
**T6.6.0 answered YES (2026-09-06):** SRM AP runs Google Workspace for Education;
a Google Classroom is created per course and used actively for all assignments,
CLAs, and prof↔student communication. Classroom is therefore in scope — flip
`GOOGLE_CLASSROOM_ENABLED=1` once the Google Cloud OAuth client has the two
`classroom.*.readonly` scopes added and Google's app verification passes (same
external gate as B10's calendar client).

- [x] **T6.6.0** ✅ **YES — Google Workspace for Education, Classroom used actively.**
      `GOOGLE_CLASSROOM_ENABLED` may be set as soon as the OAuth client's Classroom
      scopes clear Google verification `XS`
- [x] **T6.6.1** `googleOAuth` gained `CLASSROOM_SCOPES` (`courses.readonly` +
      `coursework.me.readonly`) and `requestedScopes()` — the consent screen asks
      for calendar-only by default and adds Classroom **only** when
      `GOOGLE_CLASSROOM_ENABLED=1`. One Google connection (B10's) covers both;
      `classroomService.status()` reports `needsReconnect` when the stored grant
      predates the flag being turned on. Shared `googleTokenAccess.validAccessToken`
      (refactored out of `calendarSyncService`) `M`
- [x] **T6.6.2** `services/core/classroomService.js` — `listCoursework(userId)`
      walks active courses → `courseWork` → `studentSubmissions`, normalises to
      `{ id, course, title, dueAt (UTC), link, state, submitted }`, 10-min
      per-user cache. `isUsable()` requires the flag + a Classroom scope in the
      actual grant `M`
- [x] **T6.6.3** `services/core/unifiedDeadlineService.js` — `getTimeline(user)`
      merges Classroom coursework (unsubmitted only) + saved-opportunity
      deadlines + registered events + `academicCalendar.json` milestones into
      one horizon-filtered, de-duped, chronological list. `GET /api/deadlines`
      (works with or without Classroom). Surfaced as a **"Coming up"** panel in
      the Academic Hub (`DeadlineTimeline.tsx`, renders nothing when empty) `M`

**Tests:** `test/classroomDeadlines.test.js` (7 — scope gating, `available/isUsable/
status`, coursework normalisation + cache, `dueToIso`/`parseDdMmYyyy`, timeline
merge/sort/horizon/dedupe, no-collaborator degradation, route auth + output).
BE 323, FE 1,202.

---

## EPIC 7 — Native apps   ◐ (Batch B13, 2026-09-06 — spike + code-complete parts)

> **Outcome:** Play Store and App Store presence.
> Capacitor wrapper, not a rewrite. See **[docs/24 — Native shell](./24-NATIVE-SHELL.md)**.

### STORY 7.1 — As a student, I can install the app from the store `L` ◐
- [x] **T7.1.1** Capacitor 6 added (`@capacitor/core`/`app`/`network`/`cli`),
      `Frontend/capacitor.config.ts`, `cap:sync`/`cap:android`/`cap:ios`/`cap:doctor`
      scripts, `android/`+`ios/` gitignored, `docs/24-NATIVE-SHELL.md`. The spike
      settled the **auth question**: a WebView is cross-origin to the API so
      cookie sessions break → load the deployed origin directly via
      `CAP_SERVER_URL` (`server.url`), which keeps cookie auth, the SW, and OTA
      web deploys working. Alternative (bearer token + `CapacitorHttp`)
      documented `M`
- [x] **T7.1.2** `@capacitor/push-notifications` + `lib/core/nativePush.ts`
      (no-op on web; on native requests permission, registers, POSTs the FCM/APNs
      token). Backend: `native_subscriptions` table + `POST /api/notifications/
      native/{register,unregister}` + `createNativePushAdapter` (FCM legacy HTTP,
      **inert without `FCM_SERVER_KEY`**, prunes `NotRegistered`). `nativePush`
      added to the channel set + the taxonomy's push events `M`
- [ ] **T7.1.3** Android build signing + Play Console listing — **needs a Play
      Console account** `M`
- [ ] **T7.1.4** iOS build + App Store Connect listing — **needs an Apple
      Developer account** `L`
- [ ] **T7.1.5** Biometric unlock — adds `capacitor-native-biometric`; gate app
      open behind it when a "lock" pref is set. Deferred (community dep) `M`

### STORY 7.2 — As a student, the app works without signal `L` ✅ (Batch B13)
- [x] **T7.2.1** `lib/core/queryPersist.ts` — a localStorage persister
      (`PersistQueryClientProvider` in `AppProviders`) replays the last good
      responses for a small allowlist (`erp` batches, `student-graph`,
      `deadlines`, `academic-calendar`, the profile) with a 24h grace and a
      version buster. Only `success` queries with data are written; mutations /
      auth never touch disk. No change to the SW's `NetworkOnly` `/api/` rule `L`
- [x] **T7.2.2** `hooks/useOnlineStatus.ts` (navigator.onLine + `erp:network-*`
      events the API client dispatches on a fetch `TypeError`) + a slim
      `OfflineBanner` in `PageLayout`: "You're offline — showing the last data
      that loaded. It may be out of date." `S`

---

## EPIC 8 — Engineering health   ◐ (Batch B2, 2026-09-04 — guardrails done)

> **Outcome:** The failures found in this audit cannot recur silently.
> Backend 250 tests, FE 1,197 tests, `tsc -b` + ESLint clean.

### STORY 8.1 — As a maintainer, I know which pages are used `S` ◐
- [x] **T8.1.1** Added the `route_view` event + `lib/core/useRouteViewTracking.ts`
      (one per distinct path, deduped, auth-gated) wired into `PageLayout`.
      Backend allow-lists `route_view`, classifies it `navigation`, and gives it
      a separate 400/hr actor budget so a heavy navigator never gets 429s on
      real product events `XS`
- [x] **T8.1.2** `getReport()` now returns `pageViews {totalViews, distinctRoutes,
      byRoute[]}`; `AdminCompanionAnalyticsPage` renders a **Top Pages** table.
      Covered by `companionAnalyticsStore.test.js` + the admin page test `S`
- [ ] **T8.1.3** **Run for 2 weeks before committing Epic 4 priorities** — ops
      wait, starts the day the B2 client ships `XS`

### STORY 8.2 — As a student, the app loads fast on mobile data `M` ✅ (2026-09-07)
- [x] **T8.2.1** Math gated behind `$`-detection (2026-09-07). Split
      `components/markdown/math.ts` into `mathNormalize.ts` (dep-free, runs
      every render) + `math.ts` (the KaTeX plugin) + new `mathDetect.ts`.
      `Markdown.tsx` now `import()`s `./math` **and** `katex/dist/katex.min.css`
      only when `hasMath(source)` is true, caching the plugin across instances.
      `katex` pinned to its own `manualChunks` entry (was the Rollup-misnamed
      `mermaid-*.js`). Result: **`katex-*.js` (77 KB gz) + `math-*.js` (rehype/
      remark-katex) load on demand only** — verified no route chunk statically
      depends on either. The residual eager `mermaid-*.js` (224 KB gz) is
      streamdown's own bundled mermaid+shiki, not KaTeX. `Markdown.test` math
      cases now `await` the lazy render; 3 new `mathDetect` tests. `M`
- [x] **T8.2.2** Deleted the orphaned multi-MB raster set (`Icons.png` 2.9M,
      `dark_mode_icon.png` 1.6M, `light_mode_icon.png` 1.2M, `horizontal_logo.png`
      1.5M in **both** `src/assets/Icons/` and `public/assets/icons/`, plus
      `FullSrmlogo.png`) — ~14 MB, zero code references. `vite.config` PWA
      `globIgnores` trimmed to the surviving badge sprites `XS`
- [x] **T8.2.3** `Frontend/scripts/bundle-budget.mjs` + `npm run audit:bundle`,
      wired into the Frontend Build CI job (blocking). Three budgets, each with
      ~8–10% headroom over the current build: **JS gzip total** (1127 / 1230
      KiB), **largest single chunk** (KaTeX/`mermaid-*` 303 / 330 KiB gzip — so
      the already-lazy math chunk can't creep, and a new eager mega-chunk trips
      it), and the **Workbox precache set** (4858 / 5300 KiB, same glob as
      vite.config's PWA `globPatterns` minus `globIgnores`). Bumping a budget is
      a deliberate same-PR act. `--json` emits a report artifact. `S`

### STORY 8.3 — As a maintainer, orphaned code can't accumulate `S` ✅ (2026-09-07)
- [x] **T8.3.1** Config fixed + tuned. The root `knip.json` was effectively
      broken (globbed `src/**` from the repo root, so it scanned Backend and
      reported nonsense — the reason CI was `continue-on-error`). Now: `npm run
      knip` = `cd Frontend && knip`, and `Frontend/knip.json` is the one config
      — barrels (`pages/LMS/index.ts`, `components/{ui,markdown}/index.ts`) as
      entries, `ignoreExportsUsedInFile`, `duplicates` rule off (the `X |
      default` page pattern is intentional — CLAUDE.md barrel convention),
      vendored `components/{chart,popover}.tsx` (shadcn) ignored, `tailwindcss`
      (Tailwind v4 CSS `@import`) in `ignoreDependencies`. `S`
- [x] **T8.3.2** Worked the baseline (176 exports / 105 types / 6 unused deps /
      1 unused file) down to **0 / 0 / 0 / 0** and flipped the CI job to
      blocking (`continue-on-error` removed; `knip` non-zero fails the build).
      Deleted: 6 dead deps (`@babel/preset-*`, `babel-plugin-module-resolver`,
      `class-variance-authority`, `@capacitor/{app,network}`), the dead
      `pages/LMS/index.ts`-as-file finding (now an entry), ~35 dead exports
      (deleted-feature remnants like `getLearningMaterial*` in `studentToolsApi`,
      B8 debug helpers `getDeliveryLog`/`sendTestNotification`, unused
      `Data/DetailPageLayout`, `AdminAccessPanel`, competition `JudgeNotes`/
      `ReviewHistory`/`Deadline*`/`RegistrationClosedBanner`, unused `lib/erp/api`
      wrappers + their now-orphaned type chain, `renderWithProviders`, …) and
      ~10 redundant `export default`/named twins. `tsc -b` + ESLint + 1,210 FE
      tests + `npm run build` all green. `XS`

### STORY 8.4 — As a maintainer, unreachable routes fail CI `M` ✅
- [x] **T8.4.1 / T8.4.2 / T8.4.3** `routes/routeReachability.test.tsx` (4 tests):
      every `getRouteCatalog()` destination and every visible blueprint route
      resolves to a concrete (non-`*`) route; every `DOMAIN_PAGE_MAP` key is
      backed by a visible blueprint. `DOMAIN_PAGE_MAP` is now exported for the
      test. All green on the current tree — the guardrail is in place `M`

### STORY 8.6 — Data-correctness bugs surfaced while building the mobile views ◐

Both found by eyeballing the new mobile cards, which put the number next to the
counts that should explain it.

- [x] **T8.6.1** Bunk-status thresholds were inverted — a student who could skip 10
      classes saw amber "Caution" while one clinging to a single spare class saw
      green "Safe". Fixed in `BunkCalculator.ts`; added a monotonicity invariant test. `S`
- [x] **T8.6.2** Static-prototype attendance synthesis had `attendancePercentage` and
      `odMlPercentage` swapped (a column-shift in the two-row ERP header), so the
      prototype showed 10% for a student at 85%. Fixed in `prototype.ts`; added
      `prototypeAttendance.test.ts` that reconciles (present+OD/ML)/conducted against
      the headline percentage. **Production path uses the positional backend
      extractor and was not affected — verify once on a real ERP session anyway.** `S`
- [x] **T8.6.3** Audited all four. `fee-dues` (due − collected = toBePaid) and
      `internal-marks` (0 ≤ obtained ≤ max) read their labels correctly;
      `results-current` synthesises no numeric fields (grade is stubbed). Only
      `timetable`'s *subjects* sub-table is column-shifted in the fixture — the
      synthesiser already stubs `subjects: []`, now with a comment explaining
      why, and `prototypeSynthesis.test.ts` (3 tests) reconciles each
      synthesiser + asserts the stub holds `M`

### STORY 8.5 — As a student, ERP scraping degrades safely `S` ✅
- [x] **T8.5.1** New `services/erp/extractors/loadHtml.js` — `loadHtml()` /
      `stripNonContent()` remove `<script>/<style>/<noscript>/<template>/<head>`
      and comment nodes before any `.text()` walk. Wired into `extractGenericTable`
      (the `$("body").text()` fallback), `extractCgpaSummaryFromHtml`, and
      `parseFeedbackLandingPage` `S`
- [x] **T8.5.2** `test/erpExtractorSanitize.test.js` (3 tests) — feeds a page
      with realistic inline JS/CSS and asserts no `function(`, `var x =`,
      `jQuery(`, `console.log`, CSS-rule-body, `document.write` text survives
      into `.text` or `.tables`, while real rows are preserved `S`

---

## Suggested sequence (by batch)

| Order | Batch | Why here |
|---|---|---|
| ✅ | **B1** mobile finish | Primary device, biggest retention lever, no dependencies. Done 2026-09-04. |
| 1 | **B2** eng-health guardrails | Locks in the fixes from this audit so they can't recur silently; kicks off the 2-week analytics soak (8.1.3) that de-risks B6/B7 prioritisation. Pure code. |
| 2 | **B3** nav & naming consolidation | Cheap, and shrinks the surface B6/B14 have to cover. Pure code. |
| 3 | **B4** student graph | The unlock. Nothing in B5–B7 is worth building first. |
| 4 | **B5** onboarding & consent | Makes B4's derived signals honest and user-controlled; needs only the B4 contract. |
| 5 | **B6** Academic Hub answers | Highest-visibility payoff of B4. |
| 6 | **B7** ranking & recommendations | The product differentiator; needs B4. |
| 7 | **B8** notification core + Web Push | Retention multiplier; Web Push is free and needs no third party. |
| 8 | **B9 / B10 / B11 / B12** channels | Add one adapter at a time behind the B8 seam. Order by external-gate readiness, not by code size. |
| 9 | **B13** native shell | Packaging. Only once B1 shipped and the PWA precache budget is green. |
| — | **B14** registration hub | Any time after B3; independent of the graph work. |

**Answer these two before scheduling the batch that depends on them** — each is
<1 day and can invalidate a whole batch:
- ~~**T6.6.0** — is SRM AP on Google Workspace for Education or Microsoft 365?~~
  **Answered 2026-09-06: Google Workspace for Education, Classroom used actively per course.**
  B12 code is complete; it just needs the OAuth client's Classroom scopes verified, then `GOOGLE_CLASSROOM_ENABLED=1`.
- **T6.5.1** — self-host Evolution API, confirm session stability, get an explicit go/no-go on the ban risk → gates **B11** (still open — B11 stays deferred)
