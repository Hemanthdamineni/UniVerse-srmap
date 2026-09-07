# 21 — UI/UX & Feature-Completeness Audit

**Audit date:** 2026-09-02
**Scope:** Student-facing UI/UX, feature depth, and capability reachability. Hidden and admin pages excluded from the UI review as requested, *except* where a hidden page is reachable from visible navigation.
**Method:** Static prototype build (`VITE_STATIC_PROTOTYPE=true`) served locally and walked headlessly across 57 routes at 1440×900 and 390×844; static analysis of 151 page components and 343 backend endpoints.
**Out of scope:** Security, infrastructure, deployment — see [18](./18-COMPLETE-SYSTEM-AUDIT.md), [19](./19-REMEDIATION-PLAN.md), [20](./20-POST-REMEDIATION-AUDIT.md).
**Change policy:** Audit only. No production code or configuration was changed.

---

## Executive summary

The breadth is real and the backend is genuinely well-wired: **334 of 343 endpoints are referenced
from the SPA**, and the nine that aren't are legacy catch-all scrape routes, a dev-login, and two
cron-style triggers. This is not a hollow product.

The problem is not missing features. It is that:

1. **~4,000 lines of finished UI are switched off** — 17 page components have no importer anywhere in `src/`.
2. **Four fully-implemented pages return 404 in production**, including Notifications, which is listed in the bottom nav and dashboard quick links and simply vanishes.
3. **`/settings` — one of three permanent bottom-nav items — prints the university's raw jQuery source to the screen** and contains no settings.
4. **Dark mode is unreachable.** 70 dark tokens are defined; the only component that writes `data-theme` is imported by nothing.
5. **On mobile — the stated primary device — a decorative shape paints dark text onto a dark background**, and there is no mobile navigation pattern at all.

| Signal | Value |
|---|---:|
| Lines of finished UI with no route or no importer | ~4,000 |
| Implemented pages returning 404 in production | 4 |
| Media queries in `layout.css` | 0 |
| Ways for a student to reach dark mode | 0 |
| Backend endpoints wired to the frontend | 334 / 343 |
| Horizontal overflow at 390px across 12 routes | 0 |

---

## Group A — Built, paid for, switched off

### A-01 (P0) — Settings is a real page that was never plugged in, and it's hiding dark mode

`pages/Settings/Settings.tsx` is a finished 207-line preferences screen: five event notification
toggles, three privacy/visibility toggles, and a **theme selector with system / light / dark**.
Nothing imports it.

`ThemeToggle.tsx` is the only code in the app that writes `data-theme` to the document — and it is
also imported by nothing. There are 70 dark-mode custom properties under `[data-theme="dark"]` in
`base.css`, and `markdown.css:14` even carries a comment explaining that the app toggles dark via
ThemeToggle. It doesn't. **No student can reach dark mode**, despite design principle #6
("theme-native thinking") and the documented "Deep Command" dark mode.

Wiring this one file is the highest-leverage change in the audit: it simultaneously ships the
settings page, dark mode, notification preferences, and privacy controls.

> **Evidence:** `grep ThemeToggle` → only self-references. `grep` for Settings.tsx importers → none.
> `base.css:153` → 70 tokens under `[data-theme="dark"]`.

### A-02 (P0) — Four finished pages return 404 to every student

`erpRoutes.tsx:104-110` only generates routes where `isPageVisible()` is true, and that returns true
for `status: "hidden"` **only in dev** (`erpBlueprints.ts:36-42`). Four blueprints carry that flag
while being fully implemented and wired into `DOMAIN_PAGE_MAP`:

| Route | Component | Still listed in |
|---|---|---|
| `/career/me/profile` | `ProfessionalProfilePage` | `MAIN_NAV` → "Career Profile" |
| `/career/me/skill-gap` | `SkillGapPage` | `MAIN_NAV` → "Skill Gap Analysis" |
| `/career/alumni` | `AlumniConnect` | `MAIN_NAV` → "Alumni Connect" |
| `/notifications` | announcements renderer | `BOTTOM_NAV` **and** `DASHBOARD_QUICK_LINKS` |

All four render the "404 Page not found" screen in the production static build (confirmed: 237 chars
of body text, `h1` = "Page not found"). The nav filters them out at render, so there is no visibly
broken link — but the consequence is worse: **students have no notifications surface at all**, and
three substantial career features are written into navigation only to be silently stripped.

### A-03 (P1) — A 936-line Resume Builder exists and has never been reachable

`CareerPortal/ResumeBuilder.tsx` is the largest orphan in the codebase. The route that should host
it, `/career/me/resume`, is labelled "Resume Builder" in the blueprint — and then renders
`<ProfessionalProfilePage />`, the same component as `/career/me/profile`
(`erpRoutes.tsx:80-81`). A student clicking "Resume Builder" gets the profile page.

This is the clearest names-sake case in the app: the label is real, the feature is real, and they
were never connected.

### A-04 (P1) — Full orphan ledger

Two entries are worse than orphans: the route *is* live, but renders a generic fallback while the
bespoke page sits unused beside it.

| Component | LOC | Status |
|---|---:|---|
| `CareerPortal/ResumeBuilder.tsx` | 936 | No route; **route label exists but points elsewhere** |
| `CareerPortal/CareerProfilePage.tsx` | 737 | Duplicate of `ProfessionalProfilePage` |
| `AcademicTracker/UnifiedInsights.tsx` | 403 | No route |
| `AcademicTracker/AcademicTrackerPage.tsx` | 366 | No route; still computes from mock data |
| `Dashboard/UpcomingEventsWidget.tsx` | 253 | Not mounted on the dashboard |
| `AcademicTracker/AcademicInsights.tsx` | 225 | No route |
| `ERP/HostelBookingPage.tsx` | 220 | **Route live, renders generic `BlueprintPage` instead** |
| `Settings/Settings.tsx` | 207 | **Route live, renders raw ERP document instead** |
| `AcademicTracker/ProgressOverview.tsx` | 201 | No route |
| `Dashboard/CareerWidget.tsx` | 185 | Not mounted |
| `Feedback/FeedbackDashboard.tsx` | 170 | No route |
| `Dashboard/EventsWidget.tsx` | 36 | Not mounted |
| `AcademicTracker/{Advising,Planner,Progress}Page.tsx` | 12 ea. | Shells; no matching blueprint (confirms M-09) |
| `Resources/{AdvancedAccess,LearningMaterials}.tsx` | 12 ea. | Shells |

---

## Group B — Last-mile quality

### B-01 (P0) — The Settings page prints the university's jQuery source to the screen

`/settings` renders through `DocumentErpPage`, which pipes scraped ERP text through
`lib/erp/sanitize.ts`. That sanitizer has heuristics for table dumps, trailing "Print" links, and
`Loading…` stubs — but **no rule for JavaScript or CSS**. The page currently displays, as body copy:

```
Mobile Number Verification input,select{ height: 30px; } $(function () { });
function funSave () { funMobileVerificationOTP (); } ... ajaxparameter.push
({name: 'optmobilenumber', ...}) ... alert (jqXHR.responseText);
```

Below that, the rest of the viewport is an empty dark wedge. There are no actual settings on the
page. `/settings` is one of only three permanent bottom-nav items, so this is among the most
reachable screens in the product. For a brand built on "Modern, Trustworthy, Sharp," this single
screen does more damage than any missing feature.

**Fix:** strip `<script>`/`<style>` in the backend extractor before it reaches the client, and add a
`looksLikeCode()` guard to `isTableDump()` in `sanitize.ts`. Then point the route at `Settings.tsx`
(A-01).

### B-02 (P0) — The decorative diagonal paints dark text on a dark ground

`.dashboard-background::before` in `layout.css:21-42` draws the brand accent wedge with a
`clip-path: polygon()` built from four fixed percentages (`68.97%`, `45%`, `31.03%`, `55%`, defined
at `base.css:136-139`). **There is not a single `@media` query in `layout.css`.**

On desktop the content sits inside a white card, so the wedge only shows in the gutters. At 390px
there are no gutters — the wedge cuts through the content column while the text underneath keeps its
light-mode dark colour. Captured directly:

- `/academic/attendance-details` — the word "Details" in the H1 and the entire "ATTENDANCE SUMMARY" heading render dark-on-dark and are effectively invisible.
- `/learn` — the "Exam prep" section heading disappears.
- `/settings` — the wedge fills roughly 80% of the viewport as an empty dark void.

The codebase already knows about this class of bug: the comment at `layout.css:24-26` explains a
previous fix that capped the wedge to one viewport height. The geometry still needs to respond to
*width*. There is also a `--page-contrast-fg` / `.page-on-accent` system built for exactly this
(`layout.css:58-74`), but it is applied per-page via a static `data-page-contrast` attribute rather
than from where the wedge actually lands.

### B-03 (P1) — The dashboard's "Student Tasks" card clips its own labels

At 1440px the eight task tiles render as `Today / Open ti…`, `Atten… / Check …`, `Marks / Review …`,
`Reso… / Study …`, `Feed… / Course…`. The card is a fixed-fraction grid row with `overflow-hidden`
and the two-column tile layout lacks width for the copy. `Dashboard.tsx:150` already carries a
comment acknowledging the clip. Truncating "Attendance" to "Atten…" on a desktop monitor reads as
broken rather than dense.

### B-04 (P2) — Internal vocabulary and raw enums reach the UI

- Career cards show `VIA MANUAL` — an ingestion-source enum — as a visible label.
- LMS resources are credited "by AP23110010234", a raw register number where a display name belongs.
- The Learning landing page is titled "**LMS Home**" while its own sidebar section is called "Learning". Students have no mental model for "LMS".
- The same destination is called three different things: sidebar "Discover" → breadcrumb "Competition platform" → page title "Active Events".

### B-05 (P2) — Events filters use unstyled native selects

Category, Department and Date Range on `/events` are bare `<select>` elements rendering with OS
chrome, sitting directly beside a fully-designed search input and segmented control. A `Select`
primitive already exists in the design system. This is the most visible break in "consistency
through tokens" found in the audit.

---

## Group C — Mobile, the primary device

The product brief states students access the platform "primarily on mobile." Twelve core routes were
walked at 390×844.

**Good news first:** zero horizontal overflow on every route — the layout genuinely reflows.

### C-01 (P0) — There is no mobile navigation pattern; the desktop sidebar just shrinks

At 390px the sidebar persists as a **~65px unlabelled icon rail**, permanently consuming about a
third of the horizontal space. No hamburger, no drawer, no bottom tab bar — the probe found no
menu-toggle affordance on any of the twelve routes. Students must identify twelve unlabelled glyphs,
and every page renders into roughly 250px of usable width.

Knock-on effects: the greeting truncates to "Good evening, Dam…", the profile email breaks
mid-address, and the floating command-palette pill still advertises `⌘K` on a touch device.

A bottom tab bar for the four domains (ERP · Events · Learn · Career) plus a drawer for the long
tail would reclaim full width and give the four-pillar IA a shape students already recognise.

### C-02 (P0) — The mobile dashboard opens with eleven fields the student already knows

On phone, the first card below the greeting is **"Basic Info"**: name, register number, semester,
academic year, programme, specialisation, section, father's name, mother's name, contact number,
email — stacked vertically in a ~250px column. That is multiple full screen-heights of static
identity data.

A student opening this on their phone is almost always answering one of three questions: *am I short
on attendance?*, *what's my next class?*, *do I owe fees?* All three are pushed far below the fold
behind information they cannot need to look up about themselves. Their parents' names outrank their
attendance.

Invert it: attendance risk, next class, and fee due at the top; collapse Basic Info into a single
expandable row or move it to `/profile`. The desktop grid already uses `max-md:order-*` classes, so
the mechanism exists — the order is wrong.

### C-03 (P1) — Attendance leads with the action but buries the answer

`/academic/attendance-details` opens with a "Mark today's session" code-entry card — a good instinct,
since that's time-sensitive. But the attendance summary sits below it, and on mobile the table's
first visible columns are Subject Code and Subject. **The percentage — the number the student came
for — is not visible on first paint.**

Consider a compact per-subject list on small screens (subject, percentage, safe/at-risk chip) with
the full table on tap.

---

## Group D — Retention: why a student picks this over the alternatives

The competitive advantage over the legacy ERP is not prettier proxying of the same data — it is the
personalisation layer: recommendations, skill-gap analysis, career matching, revision scheduling.
That layer is built. It is also starved.

### D-01 (P1) — Onboarding was built, then commented out

`pages/Dashboard/FirstRunGuide.tsx` is complete — versioned localStorage flag, entrance/leave
animations, keyboard-shortcut hint, graceful handling of private-mode storage failure.
`Dashboard.tsx:14-16` reads:

```
// FirstRunGuide is intentionally not rendered on the dashboard anymore.
// The component (and its tests) stay intact in ./FirstRunGuide.tsx for future reuse.
```

A first-time student lands on a dense multi-panel dashboard with **no orientation of any kind**.
Even restored, the guide is thin: one dismissible banner explaining ERP sync and `⌘K`.

### D-02 (P1) — Nothing asks the student what they want, so personalisation starts cold and stays cold

The platform ships `/api/recommendations/home`, `/lms`, `/career` and `/events`; a skill-gap engine;
resume-to-opportunity fit scoring; and a revision scheduler. Every one needs to know the student's
interests, target roles, or current skills. **No screen collects any of it.** Career Profile and
Skill Gap — the two pages that would — are the same two pages returning 404 (A-02).

Visible result: on `/career`, "Personalized for you" surfaced a single opportunity tagged
**Expired**, with a live "Apply" button next to it — and the same item repeated immediately below
under "Expiring soon."

An onboarding flow capturing three or four things — target role, interest areas, current skills,
graduation year — converts the recommendation engine from decoration into the reason students open
this instead of the ERP. **Highest-value product change in the audit, and it needs no new backend.**

### D-03 (P2) — Career discovery has three redundant front doors

The same list is reachable via the sidebar's "All Opportunities", via filter chips on Career home,
and via four blueprint routes (`/career/jobs`, `/career/internships`, `/career/hackathons`,
`/career/competitions`) that all mount `OpportunitiesPage` with a different `initialType`. Three
navigation models for one list dilutes each and triples the surface to keep consistent.

### D-04 (P2) — Single-item rails render as mostly empty grids

On `/learn` and `/career`, sections designed as multi-column rails ("Continue Learning",
"Personalized for you") hold one card in a three-column container, leaving two-thirds of a
full-width panel blank. A one-item rail should render as a single wide card or a compact row.

---

## What's working — parts worth protecting

- **Backend-to-frontend coverage is excellent** — 334/343 endpoints referenced; the gap is legacy catch-alls, a dev-login, and cron triggers.
- **Events is the strongest surface**: hero event, working filters, card grid with live registration counts, and a "Host event" affordance built into the grid rather than bolted on.
- **Empty states are well written** — "No upcoming events right now" with a "Browse all events" action is exactly right.
- **The blueprint system correctly gives placeholders precedence** over stale bespoke routes (`erpRoutes.tsx:116-119`), so nothing half-finished masquerades as finished.
- **Skip-to-main-content is implemented** (`Pagelayout.tsx:53`).
- **`prefers-reduced-motion` is respected** in four stylesheets.
- **Zero horizontal overflow** at 390px across every route tested.

---

## Sequenced plan

Ordered by student-visible impact per unit of effort. Phase 1 is entirely reconnecting or
constraining work that already exists — no new features.

### Phase 1 — Turn the lights on (2–4 days)

1. **Route `/settings` to `Settings.tsx`** — ships settings, dark mode, notification preferences and privacy controls in one change.
2. **Strip `<script>`/`<style>` in the backend extractor** and add a `looksLikeCode()` guard to `sanitize.ts`, so no ERP page can leak source again.
3. **Make the accent wedge responsive** — suppress `::before` below the sidebar breakpoint, or drive the polygon percentages from width media queries and let `.page-on-accent` follow the actual geometry.
4. **Flip the four hidden blueprints to `active`** (career profile, skill gap, alumni, notifications) after confirming each renders against live data.

### Phase 2 — Fix the phone (1–2 weeks)

1. **Ship a mobile navigation pattern** — bottom tab bar for the four domains plus a drawer; retire the icon rail below the breakpoint.
2. **Re-order the mobile dashboard** — attendance risk, next class, fees first; Basic Info collapsed or moved to `/profile`.
3. **Give attendance a mobile-native summary** so the percentage is visible on first paint.
4. **Fix Student Tasks clipping** — let the tile grid wrap instead of hiding overflow.

### Phase 3 — Feed the personalisation engine (1–2 weeks)

1. **Restore `FirstRunGuide` and grow it into a real first-run flow** capturing target role, interest areas, skills and graduation year.
2. **Route `ResumeBuilder.tsx`** to `/career/me/resume`, which currently lies about what it opens.
3. **Filter expired opportunities** out of "Personalized for you"; de-duplicate items across rails.

### Phase 4 — Consolidate and name things properly (ongoing)

1. **Collapse the three career front doors** into one list with type filters; retire redundant blueprint routes.
2. **Settle the naming** — one name per destination across sidebar, breadcrumb and page title. Retire "LMS" as student-facing vocabulary.
3. **Replace native `<select>`** on Events with the design-system primitive.
4. **Resolve duplicate pairs** — `CareerProfilePage` vs `ProfessionalProfilePage`, `Opportunities` vs `OpportunitiesPage` — then route or delete the remaining orphans rather than leaving 4,000 lines in limbo.
5. **Humanise leaked internals** — resolve register numbers to display names, hide ingestion-source enums.

---

## Audit basis and limitations

- The walk used the static prototype build, so all data is fixture data. Findings about *layout, reachability, routing, and copy* transfer directly to production; findings about *data density* (e.g. single-item rails) may present differently with real volume.
- Contrast was assessed visually from captured screenshots rather than by automated ratio computation — an initial scripted pass mis-parsed CSS `color(srgb …)` backgrounds and its numeric results were discarded as unreliable. The dark-on-dark failures in B-02 are visually unambiguous in the captures.
- Hidden and admin pages were excluded from UI review per request, except where reachable from visible navigation.
- Interactive flows (form submission, registration, team creation, submission upload) were not exercised end-to-end; this audit covers first-paint state, reachability, and information architecture.
