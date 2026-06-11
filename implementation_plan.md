# University-ERP Comprehensive Audit & Implementation Plan

> Based on direct analysis of every flagged file. Phase 1 (context folder merge + empty dirs) is already complete.

## Status Update - 2026-05-31

### Backend Phase Complete

The backend refactor phase is complete. The old backend god files now act as small compatibility facades over domain modules, and every file under `Backend/src` is below the 500 LOC target. The largest backend source file is currently `Backend/src/services/lmsMigrations/baseSchemaSql.js` at 487 LOC.

Completed backend splits:
- `lmsStore.js`, `careerStore.js`, `erpClient.js`, `competitionStore.js`, `eventsStore.js`, `lmsTrackerService.js`
- `contentStore.js`, `erpAggregationService.js`, `helpdeskStore.js`, `erpDocumentBuilder.js`
- `campusFeedbackStore.js`, `erpPayloadNormalizer.js`, `erpActionExecutor.js`, `lmsMigrations.js`, `erpUiMapStore.js`
- `routes/lmsRoutes.js`

Verification:
- `rg --files Backend/src | rg '\.js$' | xargs -n 1 node --check` passed.
- `cd Backend && npm test` passed outside the sandbox: 127 tests, 127 passing.
- The only non-escalated backend test failure seen during this phase was environmental: the sandbox blocked local `127.0.0.1` binding for `contentRoutes.test.js`. The isolated route test and full suite both passed with the required bind permission.

Interesting backend findings:
- Same-millisecond writes made LMS moderation audit and tracker recommendation-event ordering flaky under parallel tests. The relevant queries now add `rowid DESC` as a deterministic tie-breaker.
- `erpDocumentBuilder` had stray debug logging in sanitizer paths; that output is now removed.
- The lowest-risk backend extraction pattern was to preserve public imports with facade files and move implementation into domain modules, instead of changing route call sites while splitting.

---

## Summary Numbers

| Category | Count |
|---|---|
| God files (>500 LOC) needing split | **Frontend follow-ups remain; backend phase complete with 0 `Backend/src` files over 500 LOC** |
| Confirmed dead files (zero imports) | **2** (`design/tokens.ts`, `localStore.ts`) |
| Root debris files to delete | **10** |
| Root docs to relocate | **5** |
| Untracked files never committed | **40+** |
| `.gitignore` typo causing exposure | **1** (Stitch Design dir) |
| `playwright` misplaced in backend deps | **1** |
| CLAUDE.md missing dev rules | **Critical gap** |

---

## Part 1: Complete Issue Inventory

### 1A — Frontend God Files

| File | LOC | Mixed Concerns | Split Strategy |
|---|---|---|---|
| [erpTransformers.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/erpTransformers.ts) | **2,189** | Every ERP entity transformer | `lib/erp/attendanceTransformers.ts`, `financeTransformers.ts`, `examTransformers.ts`, etc. |
| [lmsApi.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/lmsApi.ts) | **2,137** | All LMS API calls in one file | `lib/lms/resourcesApi.ts`, `guidesApi.ts`, `quizApi.ts`, `roadmapsApi.ts`, `progressApi.ts` |
| [ErpDocumentRenderer.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/components/erp/ErpDocumentRenderer.tsx) | **1,961** | Renders every ERP doc type with giant switch | `erp/renderers/AttendanceRenderer.tsx`, `FinanceRenderer.tsx`, `ResultsRenderer.tsx`, etc. |
| [useBlueprintPageData.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/pages/Shared/useBlueprintPageData.ts) | **1,605** | God hook for all blueprint data fetching | Split by blueprint domain — `useErpBlueprintData`, `useFinanceBlueprintData` |
| [erpBlueprints.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/config/erpBlueprints.ts) | **1,411** | Config data + type guards + routing logic | Move pure data to `erpBlueprints.data.ts`, keep logic in `erpBlueprints.ts` |
| [LmsPagesShared.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/pages/LMS/LmsPagesShared.tsx) | **1,220** | **20+ page components in one file** | One file per page + `pages/LMS/index.ts` barrel |
| [styles.css](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/styles.css) | **2,045** | 197 CSS classes, entire app in one file | `src/styles/base.css`, `layout.css`, `erp.css`, `events.css`, `lms.css` + `index.css` |
| [main.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/main.tsx) | **380** | 100+ imports, routing + component map + helpers | `src/routes/erpRoutes.ts`, `eventRoutes.ts`, `lmsRoutes.ts`, `careerRoutes.ts`, `adminRoutes.ts` |

---

### 1B — Backend God Files

> Historical baseline from the original audit. These backend files have since been split; see the 2026-05-31 status update and Phase 10 completion notes.

| File | LOC | Problem |
|---|---|---|
| [lmsStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/lmsStore.js) | **2,681** | Every LMS DB op — split by domain |
| [careerStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/careerStore.js) | **1,995** | All career DB ops |
| [erpClient.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/erpClient.js) | **1,805** | ERP HTTP client + parsing + caching mixed |
| [competitionStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/competitionStore.js) | **1,771** | All competition DB ops |
| [eventsStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/eventsStore.js) | **1,458** | All events logic + DB |
| [lmsTrackerService.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/lmsTrackerService.js) | **1,391** | Tracker + analytics + scheduling mixed |
| [contentStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/contentStore.js) | **1,356** | All content/resource DB ops |
| [erpAggregationService.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/erpAggregationService.js) | **1,023** | Aggregation + caching + normalisation mixed |

> **Note on LMS micro-services**: All 8 (`lmsModerationService`, `lmsRevisionScheduler`, `lmsInteractionTracker`, `lmsInteractionQueue`, `lmsDuplicateDetector`, `lmsExamFeedbackService`, `lmsFeatureFlagService`, `lmsReadingTimeEstimator`) are **real, working implementations** — NOT stubs. They are wired through `server.js` and passed via dependency injection to `app.js`. Do not delete them.

---

### 1C — Confirmed Dead Code

| File | Evidence | Action |
|---|---|---|
| [design/tokens.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/design/tokens.ts) | **Zero imports** anywhere in codebase | Delete + delete `design/` folder |
| [lib/localStore.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/localStore.ts) | **Zero external imports** — never used outside itself | Delete (or keep if admin localStorage features planned) |

---

### 1D — No-Op / Placeholder Code (Keep, Document)

| File | Status | Action |
|---|---|---|
| [lib/analytics.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/analytics.ts) | `track()` is a **no-op in prod**, logs only in dev. Used by 6 files across Events and Career pages. | Keep — add `// TODO: wire real analytics provider` comment at top |
| `lib/staticPrototype*.ts` (4 files) | Feature-flag mode used across **12 API files** via `isStaticPrototype()`. Intentional. | Keep — move to `lib/prototype/` subfolder to signal it's a build mode, not runtime feature |
| [config/navigationExtensions.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/config/navigationExtensions.ts) | Plugin system used only by `navigationRegistry.ts`. Zero external extensions registered. | Keep — it's infrastructure for future nav plugins. Add JSDoc comment explaining purpose |

---

### 1E — Structural Issues

#### ✅ FIXED — Duplicate Context Folders
`src/context/` merged into `src/contexts/`. Old folder deleted. 9 import sites updated.

#### ✅ FIXED — Empty Ghost Directories
6 empty page dirs deleted: `Academic/`, `Exams&Results/`, `Finance/`, `Notifications/`, `Registration/`, `Transport&Hostel/`

#### 🔴 Solo-File Directories (noise)
| Directory | Contains | Verdict |
|---|---|---|
| `src/design/` | Only `tokens.ts` (dead) | **Delete entire folder** |
| `src/test/` | Only `setupTests.ts` (vitest config references it) | Keep — vitest convention |

---

### 1F — Root-Level Debris

**Delete these immediately** (safe, no code depends on them):

```bash
rm -f \
  ast_output.json \
  output.txt \
  scratch.ts \
  scratch.tsx \
  scratch_output.json \
  top_left_paths.json \
  view_jpeg.html \
  test-transform-timetable.js \
  graph.svg \
  impeccable-output.txt
```

**Move to `docs/plans/`** (value preserved, noise removed from root):
```bash
mkdir -p docs/plans
mv competition_platform_flow_architecture_updated.md docs/plans/
mv unicurator_master_architecture_flow_map_v2.md docs/plans/
mv implementation_consolidation_plan.md docs/plans/
mv FRONTEND-ARCHITECTURE-THEORY-v2.md docs/
# AUDIT_REPORT.md — superseded by this plan. Delete or archive.
```

---

### 1G — `.gitignore` Bugs

| Bug | Issue | Fix |
|---|---|---|
| `.gitignore` has `Stitch Designs/` (plural) | Actual dir is `Stitch Design/` (singular) — **NOT ignored!** | Change to `Stitch Design/` |
| `graphify-out/` | Generated dependency graph output — not ignored | Add `graphify-out/` |
| `StaticHost/dist/` | Built static prototype artifacts | Add `StaticHost/dist/` |
| `Frontend/src/assets/*.html`, `*.jpeg` | `compare.html` and `WhatsApp Image...` are in source assets | Add rules or delete files |

---

### 1H — Untracked Files (Never Committed)

**40+ untracked files** — notable categories:

| Category | Files | Action |
|---|---|---|
| Backend new services | `campusFeedbackStore.js`, `erpDumpService.js`, `erpFinanceIntegrity.js`, `lmsTrackerStore.js` | **Stage and commit** |
| Backend new routes | `campusFeedbackRoutes.js`, `debugRoutes.js` | **Stage and commit** |
| Backend tests | 8 test files in `Backend/test/` | **Stage and commit** |
| Frontend e2e specs | 9 spec files in `Frontend/e2e/` | **Stage and commit** (playwright.config.ts IS configured) |
| Frontend scripts | `sync-erp-fixtures-from-audit.mjs` | **Stage and commit** |
| Frontend fixture | `public/fixtures/erp-batch.json`, `session-profile.json` | **Stage and commit** |
| Assets debris | `src/assets/compare.html`, `src/assets/WhatsApp Image...`, `src/assets/file(2).svg` | **Delete** |
| New component | `src/components/lms/InteractiveFlashcardDeck.tsx` | Verify if used, then commit or delete |
| CLAUDE.md | Root CLAUDE.md not tracked | **Stage and commit after updating** |

---

### 1I — Backend Dependency Issue

`playwright` is listed under **runtime `dependencies`** in [Backend/package.json](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/package.json) — it's only used by scripts (ERP dump, endpoint discovery), never by the running server.

```bash
cd Backend
npm uninstall playwright
npm install --save-dev playwright
```

---

### 1J — Backend Scripts Classification

Referenced in `package.json` scripts (keep, they're intentional dev tools):

| Script | Purpose |
|---|---|
| `create-erp-dump.js` | Uses Playwright to dump live ERP data — **active dev tool** |
| `seed-demo-data.js` | Seeds demo DB — **active dev tool** |
| `seed-external-pages.js` | One-time setup |
| `import-learning-materials.js` | Import tool |
| `evaluate-unified-insights.js` | Uses lmsTrackerService — **dev testing tool** |
| `seed-career-stress-sqlite.mjs` | Load test seeder |
| `check-erp-integrity.js` | Integrity verification |
| `audit-live-frontend-payloads.js` | Live audit tool |

**One-off exploration scripts** (consider deleting after verifying not needed):

| Script | Verdict |
|---|---|
| `analyze-erp-ui-map.js` | One-off analysis (33KB) |
| `endpoint-discovery.js` | One-off ERP discovery |
| `fetch-discovered-endpoints.js` | One-off fetch |
| `preprocess-fetched-endpoints.js` | One-off preprocessing |
| `generate-content-map-template.js` | One-off template gen |
| `manual-refresh-artifacts.js` | One-off refresh |

---

### 1K — CLAUDE.md Gap

[CLAUDE.md](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/CLAUDE.md) currently contains **only design context** (brand, aesthetic, principles). It has **zero dev/architecture rules**. This is why agents keep making structural mistakes.

Missing rules (see Phase 6 for the full update):
- Folder conventions (one `contexts/`, not `context/`)
- God file limits (500 LOC max)
- LMS barrel pattern
- Route split into `src/routes/`
- Static prototype pattern explanation
- No scratch files in root
- No empty directories

---

## Part 2: Severity Classification

### 🔴 Critical (blocks agent productivity now)
1. CLAUDE.md has zero dev rules — agents keep recreating broken patterns
2. 40+ untracked files — agents don't know what exists
3. `main.tsx` with 100+ imports — agents can't understand routing at a glance
4. `LmsPagesShared.tsx` — 20 pages in one file

### 🟠 High (significant maintainability debt)
5. Backend god files listed in 1B — **resolved by Phase 10**; keep watching new backend growth
6. `styles.css` monolith (2,045 LOC / 197 classes)
7. `erpTransformers.ts` (2,189 LOC)
8. `lmsApi.ts` (2,137 LOC)
9. `ErpDocumentRenderer.tsx` (1,961 LOC)
10. `.gitignore` typo exposing `Stitch Design/` dir

### 🟡 Medium (clean debt, fix opportunistically)
11. Root debris files (10 to delete, 5 to move)
12. Dead files: `design/tokens.ts`, `lib/localStore.ts`
13. `playwright` in wrong package.json section
14. `staticPrototype` files scattered in `lib/` (move to `lib/prototype/`)
15. `graphify-out/` not gitignored

### 🟢 Low (nice to have)
16. `analytics.ts` needs a TODO comment
17. `navigationExtensions.ts` needs JSDoc explaining it's a plugin system
18. `config/designSystem.ts` used nowhere (needs import or delete)

---

## Part 3: Implementation Plan

### ✅ Phase 1 — Structural Cleanup (COMPLETE)
- [x] Deleted 6 empty page directories
- [x] Merged `src/context/` → `src/contexts/` (9 import sites updated)

---

### Phase 2 — Root Hygiene & Git Health
**Effort**: 30 min | **Risk**: Zero | **Impact**: Immediate clarity for all agents

#### Step 2.1 — Delete root debris
```bash
cd /home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP
rm -f ast_output.json output.txt scratch.ts scratch.tsx scratch_output.json \
      top_left_paths.json view_jpeg.html test-transform-timetable.js \
      graph.svg impeccable-output.txt AUDIT_REPORT.md
```

#### Step 2.2 — Move misplaced docs
```bash
mkdir -p docs/plans
mv competition_platform_flow_architecture_updated.md docs/plans/
mv unicurator_master_architecture_flow_map_v2.md docs/plans/
mv implementation_consolidation_plan.md docs/plans/
mv FRONTEND-ARCHITECTURE-THEORY-v2.md docs/
```

#### Step 2.3 — Delete asset debris
```bash
rm -f Frontend/src/assets/compare.html
rm -f "Frontend/src/assets/WhatsApp Image 2026-04-12 at 5.33.36 PM.jpeg"
rm -f "Frontend/src/assets/file(2).svg"
```

#### Step 2.4 — Delete dead frontend files
```bash
rm -f Frontend/src/design/tokens.ts
rmdir Frontend/src/design
rm -f Frontend/src/lib/localStore.ts  # verify not needed first
```

#### Step 2.5 — Fix .gitignore bugs
Add to `.gitignore`:
```
# Design assets (actual folder name, singular)
Stitch Design/

# Generated outputs
graphify-out/
StaticHost/dist/
```

#### Step 2.6 — Fix backend playwright dependency
```bash
cd Backend
npm uninstall playwright && npm install --save-dev playwright
```

#### Step 2.7 — Commit all untracked files
```bash
git add Backend/src/routes/campusFeedbackRoutes.js Backend/src/routes/debugRoutes.js
git add Backend/src/services/campusFeedbackStore.js Backend/src/services/erpDumpService.js \
        Backend/src/services/erpFinanceIntegrity.js Backend/src/services/lmsTrackerStore.js
git add Backend/test/
git add Frontend/e2e/
git add Frontend/scripts/sync-erp-fixtures-from-audit.mjs
git add Frontend/public/fixtures/
git add Frontend/src/components/lms/InteractiveFlashcardDeck.tsx
git add CLAUDE.md
git commit -m "chore: commit untracked files and cleanup root debris"
```

---

### ✅ Phase 3 — Run Dead Code Tools (COMPLETE)
**Effort**: 2–3 hours | **Risk**: Low | **Impact**: Removes unknown dead exports

**Completed on 2026-05-28.**

Results:
- Added `Frontend/knip.json` and ran Knip from `Frontend/`.
- Ran `ts-prune`, `jscpd`, and `madge`.
- Deleted confirmed unused `Frontend/src/config/designSystem.ts`.
- Fixed the single circular dependency reported by Madge: `lib/erpApi.ts > lib/erpStaticPrototypeFixtures.ts`.
- Left Knip's broader unused-file/export/dependency findings as audit evidence only; several are likely false positives during the ongoing route/page refactor and should be handled after Phase 4.
- Duplicate-code findings are concentrated in ERP pages, `studentToolsApi`/`apiClient`, and `main.tsx`; those map to Phase 4 and Phase 5 refactors.

Verification:
- `npx --no-install madge --circular --extensions ts,tsx src/` → no circular dependency found.
- `npm run build` → passed.
- `npm test` → passed.

#### Step 3.1 — Configure and run Knip
Create `Frontend/knip.json`:
```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignoreDependencies": ["@testing-library/jest-dom"]
}
```

```bash
cd Frontend
npx knip --reporter compact 2>&1 | grep -v "node_modules"
```

#### Step 3.2 — Run ts-prune
```bash
cd Frontend
npx ts-prune | grep -v ".test.ts" | grep -v "node_modules"
```

#### Step 3.3 — Find copy-paste duplicates
```bash
npx jscpd Frontend/src --min-lines 15 --min-tokens 60 --reporters "console"
```

#### Step 3.4 — Check circular dependencies
```bash
cd Frontend
npx madge --circular --extensions ts,tsx src/
```

#### Step 3.5 — Verify designSystem.ts
```bash
grep -rl "from.*config/designSystem" Frontend/src --include="*.tsx" --include="*.ts"
```
If zero results: delete `Frontend/src/config/designSystem.ts`.

---

### ✅ Phase 4 — Split `main.tsx` and `LmsPagesShared.tsx` (COMPLETE)
**Effort**: 3–4 hours | **Risk**: Medium (routing changes) | **Impact**: Highest single clarity win

**Completed on 2026-05-28.**

Results:
- Reduced `Frontend/src/main.tsx` to app bootstrapping only.
- Added `Frontend/src/App.tsx` for providers + `RouterProvider`.
- Split route configuration into `Frontend/src/routes/` modules:
  - `baseRoutes.tsx`
  - `erpRoutes.tsx`
  - `eventRoutes.tsx`
  - `lmsRoutes.tsx`
  - `adminRoutes.tsx`
  - `index.tsx`
- Split the 1,220-line `Frontend/src/pages/LMS/LmsPagesShared.tsx` into one file per page plus `pages/LMS/index.ts`.
- Kept `LmsPagesShared.tsx` as a tiny compatibility barrel for any lingering imports.
- Moved LMS shared hooks/helpers into `pages/LMS/_shared/LmsPageShared.tsx`.

Verification:
- `npm run build` → passed.
- `npm test` → passed.
- `npx --no-install madge --circular --extensions ts,tsx src/` → no circular dependency found.

#### Step 4.1 — Split `main.tsx` into route modules

Target structure:
```
Frontend/src/
├── main.tsx           ← 20 lines: createRoot + render
├── App.tsx            ← AppProviders + RouterProvider
└── routes/
    ├── index.ts       ← createBrowserRouter([...all groups])
    ├── erpRoutes.ts   ← blueprint-driven ERP routes
    ├── eventRoutes.ts ← /events/* routes
    ├── lmsRoutes.ts   ← /resources/* routes
    ├── careerRoutes.ts← /career/* routes
    └── adminRoutes.ts ← /admin/* routes
```

`main.tsx` becomes:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

#### Step 4.2 — Split `LmsPagesShared.tsx`

Target structure:
```
Frontend/src/pages/LMS/
├── index.ts                 ← barrel re-exports all 20 pages
├── LmsHomePage.tsx
├── BrowsePage.tsx
├── ExplorePage.tsx
├── ResourceDetailPage.tsx
├── SubjectOverviewPage.tsx
├── AddResourcePage.tsx
├── CollectionsPage.tsx
├── RequestBoardPage.tsx
├── QuestionBankPage.tsx
├── PYQBankPage.tsx
├── guides/
│   ├── GuidesListPage.tsx
│   ├── GuideEditorPage.tsx
│   └── GuideReaderPage.tsx
├── quiz/
│   ├── QuizModePage.tsx
│   └── FlashcardModePage.tsx
├── roadmaps/
│   ├── RoadmapsListPage.tsx
│   ├── RoadmapBuilderPage.tsx
│   └── RoadmapViewerPage.tsx
└── me/
    ├── MyProgressPage.tsx
    ├── MyContributionsPage.tsx
    ├── SavedResourcesPage.tsx
    ├── RevisionQueuePage.tsx
    ├── ExamFeedbackPage.tsx
    └── ContributorProfilePage.tsx
```

`pages/LMS/index.ts`:
```ts
export { default as LmsHomePage } from "./LmsHomePage";
export { default as BrowsePage } from "./BrowsePage";
// ... all 20 exports
```

No changes needed in `main.tsx` imports (they already use named imports from this path).

---

### ✅ Phase 5 — Split God API Files & CSS (COMPLETE)
**Effort**: 4–6 hours | **Risk**: Medium | **Impact**: High long-term maintainability

**Completed on 2026-05-28.**

Results:
- Replaced `Frontend/src/lib/lmsApi.ts` with a 1-line compatibility facade and split the implementation into `Frontend/src/lib/lms/`.
- Replaced `Frontend/src/lib/erpTransformers.ts` with a 1-line compatibility facade and split transformers into `Frontend/src/lib/erp/`.
- Split `Frontend/src/styles.css` into `Frontend/src/styles/index.css` plus feature CSS files.
- Updated `Frontend/src/main.tsx` to import `./styles/index.css`.
- Moved static prototype and debug helpers into `Frontend/src/lib/prototype/` and updated import sites.

Follow-up leaf files still over the 500-line target:
- `Frontend/src/lib/lms/types.ts` — large shared API type surface.
- `Frontend/src/lib/lms/fixtures.ts` and `Frontend/src/lib/lms/resourcesApi.ts` — payload-heavy LMS leaves.
- `Frontend/src/lib/erp/financeTransformers.ts` — largest remaining ERP transformer leaf.
- `Frontend/src/styles/events.css` — event/competition styles still need a second split.

Verification:
- `npm run build` → passed.
- `npm test` → passed: 37 files, 113 tests.
- `npx madge --extensions ts,tsx --circular src` → processed 336 files, no circular dependency found.

#### Step 5.1 — Split `lmsApi.ts` (2,137 LOC)
```
Frontend/src/lib/lms/
├── index.ts           ← re-exports everything
├── resourcesApi.ts    ← resource CRUD
├── guidesApi.ts       ← guides CRUD
├── quizApi.ts         ← quiz + flashcard
├── roadmapsApi.ts     ← roadmaps
├── progressApi.ts     ← progress + tracking
└── communityApi.ts    ← Q&A, ratings, reviews
```

#### Step 5.2 — Split `erpTransformers.ts` (2,189 LOC)
```
Frontend/src/lib/erp/
├── index.ts
├── attendanceTransformers.ts
├── financeTransformers.ts
├── examTransformers.ts
├── academicTransformers.ts
└── profileTransformers.ts
```

#### Step 5.3 — Split `styles.css` (2,045 LOC)
```
Frontend/src/styles/
├── index.css      ← @import all below
├── base.css       ← CSS reset, variables, themes
├── layout.css     ← sidebar, header, page shell
├── erp.css        ← ERP table/document styles
├── events.css     ← events/competition UI
├── lms.css        ← LMS-specific styles
└── career.css     ← career portal styles
```

Update `main.tsx`: change `import "./styles.css"` → `import "./styles/index.css"`

#### Step 5.4 — Move staticPrototype files
```bash
mkdir -p Frontend/src/lib/prototype
mv Frontend/src/lib/staticPrototypeEnv.ts Frontend/src/lib/prototype/
mv Frontend/src/lib/staticPrototypeProfileData.ts Frontend/src/lib/prototype/
mv Frontend/src/lib/staticPrototypeSession.ts Frontend/src/lib/prototype/
mv Frontend/src/lib/erpStaticPrototypeFixtures.ts Frontend/src/lib/prototype/
mv Frontend/src/lib/debugModeEnv.ts Frontend/src/lib/prototype/
# Update all import sites (12 files)
```

---

### ✅ Phase 6 — Update CLAUDE.md (Critical) (COMPLETE)
**Effort**: 30 min | **Risk**: Zero | **Impact**: Prevents recurrence of all issues above

**Completed on 2026-05-28.**

Add the following section to [CLAUDE.md](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/CLAUDE.md):

```markdown
## Development Architecture Rules

### File Size Limits
- No file should exceed **500 LOC** without a split plan documented here
- God files (currently being split): see implementation_plan.md Phase 5

### Folder Conventions
- All React contexts → `src/contexts/` (plural, never `src/context/`)
- All routes → `src/routes/` modules, never in `main.tsx`
- All CSS → `src/styles/` split by feature, imported via `styles/index.css`
- LMS pages → `src/pages/LMS/` with `index.ts` barrel
- Static prototype / debug utilities → `src/lib/prototype/`

### The LMS Barrel Pattern
When a feature folder has many pages, use:
- One `.tsx` per page (own state/data fetching)
- `index.ts` barrel to re-export all → clean imports in `main.tsx`

### No-Go Rules
- Never create scratch files in project root (use `/tmp` or commit to a branch)
- Never create empty placeholder directories without a `TODO.md`
- Never put generated output (`graphify-out/`, `dist/`) in tracked files
- Never add runtime dependencies to backend that are only used by scripts

### Static Prototype Mode
- `isStaticPrototype()` is a build-time flag (`VITE_STATIC_PROTOTYPE=true`)
- All API files check this and return fixture data in prototype mode
- Prototype utilities live in `src/lib/prototype/`
- This is intentional infrastructure, not dead code

### LMS Micro-Services (Backend)
All 8 LMS services (`lmsModerationService`, `lmsRevisionScheduler`, etc.) are
real implementations wired via `server.js` dependency injection. Do not delete.

### analytics.ts
`track()` is intentionally a no-op in production. Calls are placed now to avoid
future refactoring. Wire a real provider by replacing the console.debug line.
```

---

## Part 4: Expected Outcome

| Metric | Before | After All Phases |
|---|---|---|
| Largest single file | 2,681 LOC (lmsStore.js) | <500 LOC |
| `main.tsx` | 380 lines, 100+ imports | ~20 lines, 3 imports |
| `styles.css` | 2,045 LOC monolith | ~400 LOC per domain file |
| `LmsPagesShared.tsx` | 20 pages, 1,220 LOC | 20 separate files + barrel |
| Root debris files | 10+ | 0 |
| Untracked files | 40+ | 0 |
| Agent understanding time | 10–15 min per feature | 2–3 min |
| Duplicate context folders | 2 (fixed) | 1 |
| CLAUDE.md dev rules | 0 | Comprehensive |
| Dead confirmed files | 2 | 0 |

---

## Phase Execution Order

```
Phase 1 ✅ DONE      — Structural cleanup (context/, empty dirs)
Phase 2 ✅ CLEANUP   — Root hygiene, .gitignore, dead files, backend dep move (commit/stage deferred)
Phase 3 ✅ DONE      — Dead code tools (2-3 hrs, low risk)
Phase 4 ✅ DONE      — Split main.tsx + LmsPagesShared.tsx (3-4 hrs)
Phase 5 ✅ DONE      — Split god API files + CSS (4-6 hrs, per session)
Phase 6 ✅ DONE      — Update CLAUDE.md (30 min, do alongside Phase 2)
Phase 7 ✅ DONE      — Split ErpDocumentRenderer + parsed ERP document fallback
Phase 8 ✅ DONE      — Split useBlueprintPageData into blueprintData modules
Phase 9 ✅ DONE      — Split erpBlueprints registry into typed, validated modules
Phase 10 ✅ DONE      — Backend service and LMS route extraction
Phase 11 ✅ DONE      — Split competition platform CSS
```

> [!TIP]
> Phases 2 and 6 can and should be done together in the same session. They take under an hour total and have zero code risk. After that, every agent you use will have proper context.

> [!IMPORTANT]
> Phase 4 (split `main.tsx`) is the **single highest-value change** for agent productivity. A 20-line entry point with 3 imports is immediately scannable. A 380-line file with 100 imports is not.

---

### ✅ Phase 7 — Split `ErpDocumentRenderer` + Fix Parsed Document Fallback (COMPLETE)
**Effort**: 2–3 hours | **Risk**: Medium | **Impact**: High user-visible ERP coverage

**Completed on 2026-05-28.**

Results:
- Reduced `Frontend/src/components/erp/ErpDocumentRenderer.tsx` from 1,961 LOC to a 411-line document shell.
- Added focused renderer leaves under `Frontend/src/components/erp/documentRenderer/`:
  - `model.ts` — document model readers, table/form state helpers.
  - `actions.ts` — action parsing, target safety checks, error formatting.
  - `display.tsx` — text/notice/process display components.
  - `controls.tsx` — form, field, and button rendering.
  - `table.tsx` — table rendering, selection prompts, property lists.
- Fixed the ERP document combiner to build documents from parsed `data` sections when no backend `document` tree exists.
- Preserved user-facing Student Attendance text from the bundled fixture (`Attendance Code`, `Submit`) after stripping embedded ERP script/style noise.
- Added the missing `academic/cgpa-summary` fixture key required by the current-semester-results blueprint.

Interesting finding:
- Several pages looked empty even though the backend/fixture had useful content. The payload contained parsed `data` with `title`, `text`, and `tables`, but no embedded `document` tree, so document-rendered pages had nothing to show. The fallback now treats parsed ERP sections as first-class renderable documents.

Verification:
- `npm test -- erpBundleCoverage.test.ts` → passed.
- `npm test` → passed: 37 files, 113 tests.
- `npm run build` → passed.
- `npx madge --extensions ts,tsx --circular src` → processed 341 files, no circular dependency found.

---

### ✅ Phase 8 — Split `useBlueprintPageData` (COMPLETE)
**Effort**: 1–2 hours | **Risk**: Medium | **Impact**: High ERP/debug readability

**Completed on 2026-05-28.**

Results:
- Reduced `Frontend/src/pages/Shared/useBlueprintPageData.ts` from 1,605 LOC to a 123-line React hook.
- Added `Frontend/src/pages/Shared/blueprintData/`:
  - `api.ts` — ERP/external fetch + JSON/session error handling.
  - `normalizers.ts` — external and ERP payload normalization.
  - `sectionUtils.ts` — leaf collection, section ordering, session profile section, status dedupe.
  - `tableUtils.ts` — ERP table cleanup, column tuning, finance/result table handling.
  - `examMarkParser.ts` — historical exam-mark token parser.
  - `kpis.ts` — renderer-specific KPI derivation.
  - `valueUtils.ts` — text, cell, and comparison sanitization.
  - `types.ts` — local state and payload types.
- All new `blueprintData` leaves are under 500 LOC.

Interesting finding:
- The generic blueprint loader was doing far more than data fetching. It owned session profile loading, API transport, ERP dump traversal, table cleanup, document-node filtering, status detection, renderer-specific section ordering, KPI derivation, and display summary suppression. This made the earlier "implemented but not visible" problem harder to diagnose because fetch, transform, and display fallbacks were all mixed in one hook.

Verification:
- `npm run build` → passed.
- `npm test` → passed: 37 files, 113 tests.
- `npx madge --extensions ts,tsx --circular src` → processed 349 files, no circular dependency found.

---

### ✅ Phase 9 — Split `erpBlueprints` Registry (COMPLETE)
**Effort**: 1 hour | **Risk**: Medium | **Impact**: High navigation/ERP registry readability

**Completed on 2026-05-28.**

Results:
- Reduced `Frontend/src/config/erpBlueprints.ts` from 1,411 LOC to a 184-line public validator/barrel.
- Added `Frontend/src/config/erpBlueprintTypes.ts` for shared blueprint/nav type definitions.
- Added `Frontend/src/config/erpBlueprintData.ts` as a 12-line registry aggregator.
- Added `Frontend/src/config/erpBlueprintRegistry/`:
  - `navigation.ts` — main nav, bottom nav, dashboard quick links.
  - `coreBlueprints.ts` — dashboard, academic, exams, finance, hostel/transport, registration blueprints.
  - `eventBlueprints.ts` — events and feedback blueprints.
  - `workspaceBlueprints.ts` — LMS, academic tracker, career, helpdesk, profile/settings, admin blueprints.
- Kept public imports stable through `../config/erpBlueprints`.

Interesting finding:
- Type-only imports can still create circular-dependency findings in Madge. The first split had registry data importing types back from `erpBlueprints.ts`, which TypeScript accepted, but Madge correctly saw a cycle. Moving types to `erpBlueprintTypes.ts` made the dependency direction clean: `types -> data -> validated public barrel`.

Verification:
- `npm run build` → passed.
- `npm test` → passed: 37 files, 113 tests.
- `npx madge --extensions ts,tsx --circular src` → processed 355 files, no circular dependency found.

---

### ✅ Phase 10 — Backend Service and Route Extraction (COMPLETE)
**Started on 2026-05-28. Completed on 2026-05-31.**

Results:
- Split all planned backend service monoliths into compatibility facades plus domain modules:
  - `lmsStore.js`, `careerStore.js`, `erpClient.js`, `competitionStore.js`, `eventsStore.js`, `lmsTrackerService.js`
  - `contentStore.js`, `erpAggregationService.js`, `helpdeskStore.js`, `erpDocumentBuilder.js`
  - `campusFeedbackStore.js`, `erpPayloadNormalizer.js`, `erpActionExecutor.js`, `lmsMigrations.js`, `erpUiMapStore.js`
- Split `Backend/src/routes/lmsRoutes.js` into focused LMS route modules.
- Preserved existing public imports and route call sites through facade files.
- Brought every file under `Backend/src` below 500 LOC.

Verification:
- `rg --files Backend/src | rg '\.js$' | xargs -n 1 node --check` → passed.
- `cd Backend && npm test` → passed outside sandbox: 127 tests, 127 passing.

Interesting findings:
- Method extraction in backend CommonJS classes needs to handle default object parameters like `method(arg, { flag = true } = {})`. A naive brace scanner mistakes the parameter default object for the method body.
- Fast parallel tests exposed same-millisecond ordering bugs in LMS audit and recommendation-event queries. Those queries now use `rowid DESC` as a deterministic tie-breaker after timestamp ordering.
- `erpDocumentBuilder` still had sanitizer debug logging; removing it made the test output clean without changing renderer behavior.

---

### ✅ Phase 11 — Split Competition Platform CSS (COMPLETE)
**Effort**: 30 min | **Risk**: Low | **Impact**: Frontend style maintainability

**Completed on 2026-05-28.**

Results:
- Replaced `Frontend/src/styles/events.css` with a 5-line import facade.
- Added `Frontend/src/styles/events/`:
  - `utilities.css` — shared typography, focus, animation, button, chip, and utility classes.
  - `shell.css` — competition page shell, cards, grids, empty/access panels, form controls.
  - `detail.css` — event detail hero/layout/timeline/action bar.
  - `activity.css` — activity dashboard, created-event summaries, rows, stats.
  - `create.css` — create-event wizard, choice rows, review/footer cards.
- Every split CSS leaf is under 500 LOC.

Verification:
- `npm run build` → passed.
- `npm test` → passed: 37 files, 113 tests.
- `npx madge --extensions ts,tsx --circular src` → processed 360 files, no circular dependency found.

---

### Phase 12 — Next Cleanup Candidate
Current largest frontend leaves:
- `Frontend/src/pages/Resources/LearningMaterialsPage.tsx` — 1,250 LOC.
- `Frontend/src/lib/lms/types.ts` — 1,119 LOC.
- `Frontend/src/pages/ERP/ResultsCurrentPage.tsx` — 817 LOC.

Current largest backend leaves:
- `Backend/src/services/lmsMigrations/baseSchemaSql.js` — 487 LOC.
- `Backend/src/services/eventsStore/eventCrud.js` — 430 LOC.
- `Backend/src/services/lmsStore/moderation.js` — 424 LOC.
- `Backend/src/services/careerStore/schema.js` — 421 LOC.

Recommended next move:
- Return to the remaining frontend leaves over 500 LOC, starting with `LearningMaterialsPage.tsx` or `Frontend/src/lib/lms/types.ts`.
- Keep backend work to targeted behavioral fixes unless a new backend file crosses the 500 LOC threshold.
