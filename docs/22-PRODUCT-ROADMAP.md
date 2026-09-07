# 22 — Product Roadmap

**Created:** 2026-09-02
**Companion documents:** [21 — UI/UX Audit](./21-UI-UX-REFINEMENT-AUDIT.md) (what's wrong), [23 — Backlog](./23-BACKLOG.md) (trackable work items)
**Posture:** Feature freeze on *new surfaces*. Everything here either finishes something already started, or builds the one missing foundation (the student graph) that makes the existing surfaces worth using.

---

## 1. The strategic problem

The platform currently competes with the legacy ERP on **presentation**. That is a weak position — a student only needs a prettier attendance table once a week, and the ERP is free.

Everything genuinely defensible in this codebase depends on one thing the ERP can never do: **knowing the student**. Recommendations, skill-gap analysis, resume-to-role fit, revision scheduling, event matching — all of it is built, and all of it is starved because no structured student model exists.

> **The single highest-value investment is not a new feature. It is assembling the data you already collect into one queryable student profile, and then making every existing surface read from it.**

You already hold, per student: branch, semester, specialisation, section, full curriculum (subject codes), per-subject attendance history, per-subject internal marks and grades, CGPA/SGPA history, resume text and parsed skills, event participation and results, LMS activity and mastery signals, helpdesk history. That is a richer profile than most commercial student products have. It is currently scattered across nine SQLite stores and never joined.

---

## 2. Corrections to prior assumptions

Two things worth resetting before planning, because they change what to build:

### 2.1 The career scraper is not underperforming

The assumption was "<100 opportunities, negligible". The actual state of `Backend/data/career.sqlite`:

| Source | Rows |
|---|---:|
| jobspy | 11,638 |
| unstop | 1,437 |
| internshala | 347 |
| ats | 243 |
| devfolio | 59 |
| remoteok | 15 |
| devpost | 13 |
| remotive | 6 |
| **Total active** | **13,419** |

Eight scrapers run on a scheduler with circuit breakers and per-source health tracking. The pipeline is fine.

**The actual bug:** `GET /career/opportunities` defaulted to `limit=20` and `OpportunitiesPage.tsx` had no pagination state at all — no `page`, no `hasMore`, no "load more". Students saw **20 of 13,419**. Fixed in this pass (see §4.1), but the lesson generalises: before scaling ingestion, check the read path.

**The real remaining problem is relevance, not volume.** 13,419 undifferentiated listings is worse UX than 200 well-matched ones. That is a student-graph problem (Epic 2), not a scraper problem.

### 2.2 Hidden ≠ broken

Of the pages hidden because the implementation was disliked, most are structurally fine and were hidden for a *product* reason (they display data without acting on it). That is a redesign brief, not a rewrite. Epic 3 treats them that way.

---

## 3. Roadmap shape

```
 NOW          Phase 1 ── Reconnect          (done in this pass)
              Phase 2 ── Mobile-first       (partly done)
 NEXT         Phase 3 ── The student graph  ← the unlock
              Phase 4 ── Make surfaces act on it
 LATER        Phase 5 ── Integrations (Calendar / Classroom / notifications)
 FUTURE       Phase 6 ── Native shell
```

Phases 3 and 4 are the ones that change whether students choose this product. Phase 5 is what makes them keep it open. Phase 6 is packaging, not capability — deliberately last.

---

## 4. Phase detail

### 4.1 Phase 1 — Reconnect (COMPLETE)

Shipped in this pass. No new features; all of it was reconnecting existing code.

| Change | Effect |
|---|---|
| `/settings` → `Settings.tsx` | Real settings page replaces a screen that printed the ERP's jQuery source |
| `lib/core/theme.ts` + wired selector | **Dark mode is now reachable** — 70 tokens that no user could previously see |
| `lib/core/preferences.ts` | Notification/privacy toggles persist instead of resetting on reload |
| Un-hid 4 blueprints | Career Profile, Skill Gap, Alumni Connect, Notifications no longer 404 |
| `/career/me/resume` → `ResumeBuilder.tsx` | 936-line builder reachable for the first time |
| `looksLikeCode()` in `sanitize.ts` | No ERP page can leak `<script>`/`<style>` contents to students again |
| `getOpportunitiesPage()` + infinite query | **13,419 opportunities reachable instead of 20** |
| Accent wedge `@media` guard | Killed the dark-on-dark heading bug below 768px |
| `MobileTabBar` + sidebar hidden `<md` | Real mobile navigation; content gets the full 390px |
| Dashboard mobile re-order | Attendance → Schedule first; Basic Info sunk to last |

Verified: 1,189 frontend tests, 246 backend tests, `tsc` and ESLint clean.

### 4.2 Phase 2 — Mobile-first (PARTLY DONE)

The shell is fixed. What remains is per-page: data tables that assume desktop width, forms with desktop field ordering, and the LMS/Career rails that render one card in a three-column grid.

Target: every route in the audit's walk list usable one-handed on a 390px screen without horizontal scrolling or pinch-zoom. Add a mobile viewport to the responsive audit script so regressions are caught in CI.

### 4.3 Phase 3 — The student graph (THE UNLOCK)

Build `Backend/src/services/core/studentGraphService.js`: one service that assembles and caches a typed profile per student, joining what already exists.

```
StudentGraph {
  identity     { registerNo, branch, specialisation, semester, section, gradYear }
  academic     { curriculum[], perSubject{ code, name, credits, attendance%, internals, grade },
                 cgpa, sgpaHistory[], atRiskSubjects[] }
  skills       { declared[], fromResume[], fromCourses[], fromEvents[], confidence }
  intent       { targetRoles[], interestAreas[], preferredLocations[], openToRelocate }   ← ONLY new data
  activity     { eventsAttended[], competitionsWon[], lmsMastery{}, contributionScore }
  derived      { skillGaps[], readinessScore, recommendedNextActions[] }
}
```

Everything except `intent` is derivable from data already stored. `intent` is the four questions onboarding must ask — that is the whole new-data requirement for the entire personalisation layer.

**Why this ordering matters:** every downstream feature (Epics 4, 5) reads from this one service. Building them before it means each re-derives the same joins differently, which is how the current duplication happened.

### 4.4 Phase 4 — Make surfaces act on the graph

The recurring complaint — *"it just displays them, no actual use"* — is precisely this phase. For each surface, the shift is from **reporting state** to **answering the question the student actually has**:

| Surface | Today (reports) | Target (answers) |
|---|---|---|
| Academic Hub | Shows attendance %, GPA, subject list | "You can miss 3 more CSE 423 classes." "You need 82 in the CSE 455 final for a 9.0 SGPA." "Given your AI/ML target, take these two electives." |
| Attendance | Per-subject percentage table | Bunk calculator; projection to semester end; alert before crossing 75% |
| Results | Grade tables | What-if grade simulator; CGPA trajectory; which subject moves the needle most |
| Career | 13,419 undifferentiated listings | Ranked by graph fit, with the reason shown ("matches 4 of 6 skills; your CGPA clears their 7.5 cutoff") |
| Skill Gap | Static gap list | Gap → the specific LMS resource, roadmap, or campus event that closes it |
| Events | Chronological list | "Recommended because you're targeting SDE roles and this is a DSA contest" |
| LMS | Resource catalogue | Revision queue driven by upcoming exams from the ERP calendar |

### 4.5 Phase 5 — Integrations

Ordered by (value ÷ risk). See §5 for the important caveats — **read those before committing to WhatsApp or Classroom.**

1. **Web Push** — free, no third-party dependency, works on Android/desktop today and iOS 16.4+ for installed PWAs. This is the correct default notification channel and should ship before any messaging integration.
2. **Google Calendar** — highest-value integration. One-way push of timetable, event registrations, assignment and fee deadlines into the student's own calendar. Low risk, well-documented API, immediately useful.
3. **Email (SMTP/Gmail)** — digests and non-urgent alerts. Use a transactional provider or plain SMTP; do not build on personal Gmail accounts.
4. **WhatsApp** — highest engagement in the Indian student market, highest risk. See §5.2.
5. **Google Classroom** — verify feasibility before scheduling. See §5.3.

### 4.6 Phase 6 — Native shell (FUTURE)

**Recommendation: do not write a React Native or Flutter app.**

The product is a React SPA with a service worker and a PWA precache already configured. The pragmatic path to the Play Store and App Store is **Capacitor**, which wraps the existing build in a native shell and gives you native push, biometric unlock, file access, and store listings without a second codebase.

A rewrite would mean maintaining two implementations of 87 routes for capabilities you can get from a wrapper. Revisit only if you need something Capacitor genuinely cannot do (deep OS integration, heavy offline sync, background location).

**Prerequisite:** Phase 2 must be genuinely finished. A native wrapper around an app that is uncomfortable on a phone just ships the discomfort to the app stores, where it collects one-star reviews.

---

## 5. Integration due diligence

These are the judgement calls worth making deliberately rather than discovering mid-implementation.

### 5.1 Notification strategy

Do not start with WhatsApp. Start with **Web Push**, which is free, unlimited, requires no third-party account, and cannot get anything banned. Add channels only where push genuinely fails:

| Channel | Cost | Risk | Use for |
|---|---|---|---|
| Web Push | Free | None | Default for everything |
| Email | ~Free | None | Digests, receipts, anything needing a record |
| WhatsApp | See below | **High** | Only time-critical, opt-in alerts |
| SMS | Paid | Low | Not recommended — email covers it |

### 5.2 WhatsApp via Evolution API — read this first

Evolution API wraps an **unofficial** WhatsApp connection (Baileys-family, i.e. a logged-in WhatsApp Web session). It is genuinely free and unlimited in the sense that there is no per-message fee. The costs are elsewhere:

- **Ban risk is real and material.** Sending templated bulk messages from a normal WhatsApp number to many recipients is exactly the pattern WhatsApp's anti-spam systems act on. The number gets banned, not warned. If that number is tied to a real person, they lose their personal WhatsApp.
- **It violates WhatsApp's Terms of Service.** For a student side-project this may be an acceptable risk; for anything university-endorsed or handling student data at scale, it is not.
- **It requires a persistent session.** Self-hosted, always-on, with a QR re-scan whenever the session drops. That is real operational burden.
- **The official alternative** is the WhatsApp Business Cloud API from Meta, which has a free service-conversation tier and cheap utility templates. It is not unlimited, but it will not get a number banned.

**Recommendation:** if you want WhatsApp, do it as **strictly opt-in**, from a **dedicated number you don't care about**, for **low-volume high-value alerts only** (attendance dropping below 75%, result published, application deadline tomorrow) — never digests or marketing. Build the notification layer channel-agnostic (Epic 6) so WhatsApp is one adapter you can swap for the official API without touching callers.

### 5.3 Google Classroom — verify before scheduling

The Classroom API only returns data if **all** of these hold:

1. SRM AP uses Google Workspace for Education (not Microsoft 365 — worth confirming first, as many Indian universities are Microsoft shops).
2. Faculty actually use Classroom for the courses students care about.
3. A Workspace admin approves your OAuth client for the required scopes, or students individually consent with their `@srmap.edu.in` account.
4. Your app passes Google's OAuth verification for sensitive scopes.

Point 1 is a five-minute check and gates everything else. **Do that check before this reaches a sprint.** Google Calendar has no such dependency — a student can authorise their own calendar regardless of what the university uses — which is why it is sequenced first.

### 5.4 Privacy posture

The student graph joins academic performance, attendance, and career intent into one record. That is genuinely sensitive. Before Phase 4 ships:

- Explicit consent at onboarding, with a plain-language explanation of what is derived and why.
- A visible "what we know about you" screen, and a working delete.
- Personalisation must degrade gracefully when a student declines — never a dead end.
- Never expose derived academic risk signals to organisers, faculty, or leaderboards.

---

## 6. Disposition of hidden and orphaned surfaces

Every hidden page and orphaned component needs one of three decisions. Leaving them in limbo is what produced 4,000 lines of dark code.

### Reconnected in this pass
`/career/me/profile` · `/career/me/skill-gap` · `/career/alumni` · `/notifications` · `/settings` · `/career/me/resume`

### Still hidden — decide in Epic 8

| Route | Why hidden | Recommendation |
|---|---|---|
| `/academic/sap-scholarships` | ERP page, thin | **Fold in** — surface as a section of Academic Hub, not a route |
| `/finance/bank-details` | ERP page, thin | **Fold in** — a card on the Finance page |
| `/registration/minor-oe-registration` | ERP passthrough | **Fold in** — Registration hub tab |
| `/registration/exam-registration` | ERP passthrough | **Fold in** — Registration hub tab |
| `/registration/sap-registration` | ERP passthrough | **Fold in** — Registration hub tab |
| `/events/attendance` | Superseded by check-in | **Delete** |
| `/learn/advanced-access` | Never specified | **Delete** the placeholder; revisit as a real feature or not at all |

The pattern: five thin ERP passthrough pages are each a nav entry with almost nothing on them. Consolidating them into two hub pages (Academic, Registration) with tabbed sections removes seven sidebar entries and makes each destination worth visiting.

### Placeholders — delete or commit

`/exams/essentials` · `/transport-hostel/routes` · `/transport-hostel/route-details` · `/registration/events-registration` · `/registration/registration-tracker`

All honestly marked "coming soon". Two have no upstream ERP endpoint and therefore cannot be built as designed. **Recommendation: delete all five blueprints.** A coming-soon page that has been coming soon for a year damages trust more than the absence of the page.

### Orphaned components — route, merge, or delete

| Component | LOC | Decision |
|---|---:|---|
| `CareerProfilePage.tsx` | 737 | **Merge** into `ProfessionalProfilePage`, delete the loser — keep whichever has better tests |
| `UnifiedInsights.tsx` | 403 | **Route** — becomes the Academic Hub "Insights" tab in Epic 3 |
| `AcademicTrackerPage.tsx` | 366 | **Delete** — computes from mock data; superseded by Academic Hub |
| `AcademicInsights.tsx` | 225 | **Merge** into the Hub insights tab |
| `ProgressOverview.tsx` | 201 | **Merge** into the Hub overview tab |
| `HostelBookingPage.tsx` | 220 | **Route** — `/transport-hostel/hostel-booking` currently renders a generic fallback |
| `UpcomingEventsWidget.tsx` | 253 | **Route** — mount on the dashboard, replacing the empty events card |
| `CareerWidget.tsx` | 185 | **Route** — dashboard card once the graph can rank opportunities |
| `FeedbackDashboard.tsx` | 170 | **Delete** unless it beats the current per-type feedback pages |
| `EventsWidget.tsx` | 36 | **Delete** — superseded by `UpcomingEventsWidget` |
| `Academic{Advising,Planner,Progress}Page.tsx` | 12 ea. | **Delete** — shells with no blueprint |
| `Resources/{AdvancedAccess,LearningMaterials}.tsx` | 12 ea. | **Delete** — shells |

---

## 7. Recommendations beyond the backlog

Things worth doing that aren't obvious from the audit findings.

**Instrument before you optimise.** `analytics.ts` already posts to `/api/analytics/events`. Nobody currently knows which of the 87 pages students actually open. Two weeks of real usage data would probably retire a third of the navigation and tell you where to spend Phase 4. Do this first — it is cheap and it de-risks everything after it.

**Set a "one destination, one name" rule.** Sidebar "Discover" / breadcrumb "Competition platform" / page title "Active Events" are the same place. Fix it once and add a test asserting nav label, breadcrumb, and `<h1>` agree per route.

**Kill "LMS" as student-facing vocabulary.** It is internal jargon. The sidebar already says "Learning"; the page says "LMS Home".

**Treat the 500-LOC rule as a design smell, not a lint rule.** `lmsStore.js` at 3,042 lines and `careerStore.js` at 2,526 aren't just long — they're where the missing student-graph abstraction went to hide.

**Add a reachability test.** The four 404s existed because nothing asserted that every nav entry resolves. A test that walks the nav tree and asserts each route renders something other than the 404 component would have caught all of them, and would catch the next one.

**Don't build the native app to get notifications.** Web Push covers Android and desktop today, and iOS for installed PWAs. Ship notifications in Phase 5, judge engagement, then decide whether a store presence adds anything.

**Consider dropping Mermaid.** It is 1.00 MiB raw / 312 KiB gzipped — the single largest asset in the bundle, on a product whose users are on mobile data. Confirm it earns that on a phone.
