# University-ERP Codebase Audit (Verified)

> Compiled from live filesystem analysis of the `chore/selected-diff-bootstrap-import` branch.
> Updated on 2026-05-28 after implementation phases 4, 5, and 7 — see status markers below.

## 2026-05-28 Implementation Update

- `main.tsx` is now a 10-line bootstrap file, with providers/router moved to `App.tsx` and routes split under `src/routes/`.
- `LmsPagesShared.tsx` is now a 24-line compatibility barrel, with LMS pages split into per-page files and subfolders.
- `lmsApi.ts`, `erpTransformers.ts`, and `styles.css` are now compatibility facades; implementations moved to `src/lib/lms/`, `src/lib/erp/`, and `src/styles/`.
- Static prototype and debug helpers moved to `src/lib/prototype/`.
- `ErpDocumentRenderer.tsx` is now a 411-line shell. Renderer model/actions/display/form/table logic moved to `src/components/erp/documentRenderer/`, with every new leaf under 500 LOC.
- ERP document fallback now builds renderable documents from parsed `data` sections (`title`, `text`, and `tables`) when the backend/fixture does not include an embedded `document` tree. This fixed status-only registration pages and Student Attendance visibility in the bundled fixture.
- Validation after the split: `npm run build`, `npm test` (37 files, 113 tests), and `npx madge --extensions ts,tsx --circular src` all passed.
- Remaining oversized frontend leaves include `useBlueprintPageData.ts`, `erpBlueprints.ts`, `LearningMaterialsPage.tsx`, `lms/types.ts`, `erp/financeTransformers.ts`, `lms/resourcesApi.ts`, and `styles/events.css`.

---

## At a Glance

| Metric | Value |
|---|---|
| Frontend `.ts/.tsx` total lines | ~47,600 |
| Backend `.js` total lines | ~28,000 |
| Frontend god files (>500 LOC) | **Several remain; Phase 4/5 monoliths split** |
| Backend god files (>500 LOC) | **10 files** |
| `main.tsx` (router monolith) | ✅ **10-line bootstrap** |
| `styles.css` (single CSS file) | ✅ **1-line facade** importing `src/styles/index.css` |
| Root-level scratch/debris files | **12 files** that don't belong |
| ~~Empty page directories~~ | ~~6 directories~~ ✅ **Deleted** |
| ~~Duplicate context folders~~ | ~~`context/` vs `contexts/`~~ ✅ **Merged** |
| LMS micro-services | **8 wired implementations; keep** |
| Backend scripts (one-off tooling) | **15 files** |

---

## Part 1: God Files — The Biggest Problem

These files are too large to reason about, too large for agents to understand in one shot, and almost certainly contain mixed concerns.

### Frontend God Files

| File | Lines | Problem |
|---|---|---|
| [erpTransformers.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/erpTransformers.ts) | ✅ **1-line facade** | Split into `src/lib/erp/` by domain |
| [lmsApi.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/lmsApi.ts) | ✅ **1-line facade** | Split into `src/lib/lms/` by domain |
| [ErpDocumentRenderer.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/components/erp/ErpDocumentRenderer.tsx) | ✅ **411-line shell** | Split into `src/components/erp/documentRenderer/` model/actions/display/controls/table leaves |
| [useBlueprintPageData.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/pages/Shared/useBlueprintPageData.ts) | **1,605** | God hook with all data-fetching logic — split by blueprint type |
| [erpBlueprints.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/config/erpBlueprints.ts) | **1,411** | Config data + logic mixed — pure data config should be JSON/separate |
| [LmsPagesShared.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/pages/LMS/LmsPagesShared.tsx) | ✅ **24-line barrel** | Page components split under `src/pages/LMS/` |
| [main.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/main.tsx) | ✅ **10** | Entry file now only renders `<App />` |
| [styles.css](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/styles.css) | ✅ **1-line facade** | Split into `src/styles/` feature files; `events.css` still needs a second split |
| [campusApi.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/campusApi.ts) | **776** | Mixed helpdesk + feedback + campus APIs |
| [competitionsApi.ts](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/lib/competitionsApi.ts) | **705** | Fine if scoped well, review for dead exports |

### Backend God Files

| File | Lines | Problem |
|---|---|---|
| [lmsStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/lmsStore.js) | **2,681** | Everything LMS in one store — split by concern |
| [careerStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/careerStore.js) | **1,995** | All career DB ops in one file |
| [erpClient.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/erpClient.js) | **1,805** | ERP HTTP client + parsing + caching all mixed |
| [competitionStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/competitionStore.js) | **1,771** | All competition DB ops in one file |
| [eventsStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/eventsStore.js) | **1,458** | All events logic + DB in one file |
| [lmsTrackerService.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/lmsTrackerService.js) | **1,391** | Tracker + analytics + scheduling mixed |
| [contentStore.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/contentStore.js) | **1,356** | All content/resource DB ops |
| [erpAggregationService.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/services/erpAggregationService.js) | **1,023** | |
| [lmsRoutes.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/routes/lmsRoutes.js) | **915** | Routes file shouldn't have business logic |
| [server.js](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Backend/src/server.js) | **361** | Wires up ~20 services manually — messy but functional |

---

## Part 2: The LMS Page Architecture — Your Specific Question

**The `LmsPagesShared.tsx` anti-pattern** (1,220 lines, 20+ components exported from one file) is a classic vibe-coding artifact. Here's the honest answer to "one file vs many files":

### ✅ Recommended: Hybrid "Barrel + Co-located" Model

```
pages/LMS/
├── index.ts                    ← barrel: re-exports everything (for main.tsx imports)
├── LmsHomePage.tsx             ← standalone, >100 LOC or has own state
├── BrowsePage.tsx
├── ExplorePage.tsx
├── ResourceDetailPage.tsx
├── SubjectOverviewPage.tsx
├── guides/
│   ├── GuidesListPage.tsx
│   ├── GuideEditorPage.tsx
│   └── GuideReaderPage.tsx
├── quiz/
│   ├── QuizModePage.tsx
│   └── FlashcardModePage.tsx
├── me/                         ← "my" pages that share state/hooks
│   ├── MyProgressPage.tsx
│   ├── MyContributionsPage.tsx
│   ├── SavedResourcesPage.tsx
│   └── RevisionQueuePage.tsx
└── _shared/                    ← tiny shared UI between LMS pages only
    └── LmsPageShell.tsx
```

**Rules of thumb:**
- **One file per page** when the page has its own data fetching, state, or is >80 LOC
- **Bundle into one file** only when pages are truly trivial (<30 LOC each) AND share identical structure (e.g., 5 stub placeholder pages)
- **`index.ts` barrel** solves the import ergonomics — `main.tsx` only needs `import { BrowsePage, ExplorePage } from './pages/LMS'`
- Your current `LmsPagesShared.tsx` should be **split** — `main.tsx` already imports 20 named exports from it, showing it's 20 separate pages crammed in one file

---

## Part 3: Structural Dead Weight

### ✅ DONE — Duplicate Context Folders (Fixed)

Previously you had two folders:
- `src/contexts/` — `EventContext.tsx`
- `src/context/` — `AdminModeContext.tsx`

**Status:** `AdminModeContext.tsx` moved to `src/contexts/`, 9 import sites updated (8 source + 1 test), old `context/` folder deleted.

### ✅ DONE — Empty Page Directories (Deleted)

Removed 6 ghost directories: `Academic/`, `Exams&Results/`, `Finance/`, `Notifications/`, `Registration/`, `Transport&Hostel/`

### 🔴 NEW — Root-Level Clutter

The project root contains **12 files that don't belong in a clean repo**:

| File | Size | What it is | Action |
|---|---|---|---|
| `ast_output.json` | 0 bytes | Empty scratch file | Delete |
| `output.txt` | 0 bytes | Empty scratch file | Delete |
| `scratch.ts` | 350 bytes | Agent scratch code | Delete |
| `scratch.tsx` | 689 bytes | Agent scratch code | Delete |
| `scratch_output.json` | 70 bytes | Agent scratch output | Delete |
| `top_left_paths.json` | 229KB | Debug artifact | Delete |
| `view_jpeg.html` | 230 bytes | Debug artifact | Delete |
| `test-transform-timetable.js` | 4.6KB | One-off test | Delete |
| `graph.svg` | 309KB | Madge output — regenerate on demand | Delete |
| `impeccable-output.txt` | 276KB | Agent output dump | Delete |
| `competition_platform_flow_architecture_updated.md` | 33KB | Move to `docs/plans/` |
| `unicurator_master_architecture_flow_map_v2.md` | 5.8KB | Move to `docs/plans/` |
| `implementation_consolidation_plan.md` | 3KB | Move to `docs/plans/` |
| `FRONTEND-ARCHITECTURE-THEORY-v2.md` | 16KB | Move to `docs/` |
| `AUDIT_REPORT.md` | 21KB | Move to `docs/` or delete (superseded by this audit) |
| `Stitch Design.zip` | **207MB** | Design asset ZIP — should be in `.gitignore` or LFS |

> [!CAUTION]
> The 207MB `Stitch Design.zip` is likely bloating your git history. If it's tracked, every clone downloads it forever.

### ✅ DONE — `main.tsx` Router Monolith

[main.tsx](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/main.tsx) is now a 10-line bootstrap file. Routes are split under `src/routes/` and providers/router setup moved to `App.tsx`.

```
src/
├── main.tsx              ← just: createRoot + render(<App />)
├── App.tsx               ← AppProviders + RouterProvider
└── routes/
    ├── index.ts          ← createBrowserRouter([...all route groups])
    ├── erpRoutes.ts      ← blueprint-based routes
    ├── eventRoutes.ts    ← event routes (already partially extracted)
    ├── lmsRoutes.ts      ← LMS routes
    ├── careerRoutes.ts   ← career routes
    └── adminRoutes.ts    ← admin routes
```

### ✅ DONE — `styles.css` Monolith Split

`styles.css` is now a 1-line compatibility facade. Feature CSS lives under `src/styles/`; `events.css` remains the largest leaf and should be split again later.

```
src/styles/
├── base.css              ← CSS reset, variables, typography
├── layout.css            ← sidebar, header, page shell
├── erp.css               ← ERP document/table styles
├── events.css            ← events/competition UI
├── lms.css               ← LMS-specific styles
└── index.css             ← @import all of the above
```

### 🟡 Solo-File Directories (Keep as-is)

| Directory | Contents | Verdict |
|---|---|---|
| `src/test/setupTests.ts` | Referenced by `vitest.config.ts` | ✅ Keep — vitest convention |
| `src/design/tokens.ts` | **Zero imports** in the codebase | 🟡 Delete if CSS variables cover it, or wire it in |

### 🟢 Backend LMS Micro-Services (CORRECTED — Keep)

My initial grep was wrong. The LMS services are real implementations wired through `server.js` dependency injection and used by the LMS routes/store layer. Do not delete them as stubs:
- `lmsModerationService`
- `lmsRevisionScheduler`
- `lmsInteractionTracker`
- `lmsInteractionQueue`
- `lmsDuplicateDetector`
- `lmsExamFeedbackService`
- `lmsFeatureFlagService`
- `lmsReadingTimeEstimator`

### 🟡 `staticPrototype*` Files in `src/lib/`

Prototype/demo mode files now live under `src/lib/prototype/`:
- `staticPrototypeEnv.ts`
- `staticPrototypeProfileData.ts`
- `staticPrototypeSession.ts`
- `erpStaticPrototypeFixtures.ts`
- `debugModeEnv.ts`

---

## Part 4: The Tooling Toolkit

Here's your multi-tool approach, ordered by how much they do automatically:

### Tool 1: **Knip** — Dead Code & Unused Exports ★★★★★

You already have `knip.json` at the root. Run it properly from the **Frontend** directory:

```bash
cd Frontend
npx knip --reporter compact 2>&1 | head -100
```

This will find: unused exported functions/types, files imported nowhere, unused dependencies.

Your current `knip.json` needs upgrading. Create this in `Frontend/`:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignoreDependencies": ["@testing-library/jest-dom"]
}
```

### Tool 2: **ts-prune** — Unused TypeScript Exports ★★★★

More focused than Knip for TypeScript specifically:

```bash
cd Frontend
npx ts-prune | grep -v ".test.ts" | grep -v "__tests__"
```

Each line shows an export that is never imported elsewhere.

### Tool 3: **jscpd** — Duplicate Code Detector ★★★★

Finds copy-pasted blocks — the #1 output of vibe coding:

```bash
npx jscpd Frontend/src --min-lines 10 --min-tokens 50 --reporters "console"
```

### Tool 4: **Madge** — Circular Dependency Detector ★★★

```bash
cd Frontend
npx madge --circular --extensions ts,tsx src/
# Visual graph:
npx madge --image graph.svg --extensions ts,tsx src/main.tsx
```

### Tool 5: **ESLint `no-unused-vars`** ★★★

```bash
cd Frontend
npx eslint src --rule '{"no-unused-vars": "warn"}' --ext .ts,.tsx 2>&1 | grep "no-unused"
```

### Tool 6: **`cloc`** — Lines of Code by Domain ★★

```bash
sudo apt install cloc
cloc Frontend/src/pages/LMS/
cloc Frontend/src/lib/
cloc Backend/src/services/
```

### Tool 7: **Grep audit for stale service imports** ★★

```bash
# Verify which backend services are wired to routes vs only to server.js
for f in Backend/src/services/lms*.js; do
  name=$(basename "$f" .js)
  count=$(grep -r "$name" Backend/src/ --include="*.js" | grep -v "^.*$name.js:" | wc -l)
  echo "$count external refs: $name"
done
```

---

## Part 5: Prioritized Action Plan

### ✅ Phase 1 — Safe Structural Cleanup (DONE)

- [x] Deleted 6 empty page directories
- [x] Merged `context/` → `contexts/` (9 import sites updated)
- [x] Deleted old `src/context/` folder

### ✅ Phase 2 — Root Cleanup & Config (cleanup complete, commit deferred)

Completed cleanup:
- Root debris and asset debris were removed.
- Misplaced docs were moved into `docs/` / `docs/plans/`.
- `.gitignore` was updated for generated/design outputs.
- Backend `playwright` was moved from runtime dependencies to dev dependencies.

Deferred:
- Broad staging/commit of untracked files is still pending because the worktree contains many unrelated user changes.

Original checklist:
1. **Delete root debris files:**
   ```bash
   rm -f ast_output.json output.txt scratch.ts scratch.tsx scratch_output.json \
         top_left_paths.json view_jpeg.html test-transform-timetable.js \
         graph.svg impeccable-output.txt
   ```
2. **Move architecture docs** into `docs/` or `docs/plans/`:
   ```bash
   mv competition_platform_flow_architecture_updated.md docs/plans/
   mv unicurator_master_architecture_flow_map_v2.md docs/plans/
   mv implementation_consolidation_plan.md docs/plans/
   mv FRONTEND-ARCHITECTURE-THEORY-v2.md docs/
   ```
3. **Add `Stitch Design.zip` to `.gitignore`** if not already — 207MB should never be in git.
4. **Move `knip.json`** into `Frontend/` with the upgraded config shown above.

### ✅ Phase 3 — Run Knip & Delete Dead Exports (complete)

Completed:
- Added `Frontend/knip.json`.
- Ran Knip, ts-prune, jscpd, and Madge.
- Deleted confirmed unused `config/designSystem.ts`.
- Fixed the reported circular dependency.

### ✅ Phase 4/5 — Split Highest-Impact Frontend God Files (complete)

Completed:
- `main.tsx` → `App.tsx` + `src/routes/`.
- `LmsPagesShared.tsx` → per-page LMS files + barrel.
- `styles.css` → `src/styles/`.
- `erpTransformers.ts` → `src/lib/erp/`.
- `lmsApi.ts` → `src/lib/lms/`.

Remaining priority order:

1. **`ErpDocumentRenderer.tsx`** → split by renderer type.
2. **`useBlueprintPageData.ts`** → split by blueprint/domain.
3. **`erpBlueprints.ts`** → move pure data away from logic.
4. **`styles/events.css`** → second CSS split for event/competition UI.
5. **Backend `lmsStore.js`** → extract `lmsSearchStore.js`, `lmsProgressStore.js`, `lmsContentStore.js`.

### Next — Backend Services & Scripts Audit (1 hour)

1. Keep the 8 LMS micro-services; they are wired implementations, not deletion candidates.
2. Review `Backend/scripts/` — keep scripts in active use (`seed-demo-data.js`, `create-erp-dump.js`, audit/evaluation scripts), archive/delete one-off exploratory scripts only after verifying no package script references them.
3. Start backend god-file splits from `lmsStore.js`, `careerStore.js`, and `erpClient.js`.

### ✅ Phase 6 — Update CLAUDE.md & Agent Guard Rails (complete)

Completed in [CLAUDE.md](file:///home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/CLAUDE.md):
- All contexts live in `src/contexts/` (never `context/`)
- LMS pages use barrel pattern from `pages/LMS/index.ts`
- Routes defined in `src/routes/` modules, NOT `main.tsx`
- No file should exceed 500 LOC without a split plan
- No empty placeholder directories
- Static prototype utilities belong in `src/lib/prototype/`

---

## Expected Outcome After All Phases

| Metric | Before | After |
|---|---|---|
| Largest frontend file | 2,189 LOC | <500 LOC |
| `main.tsx` | 380 lines, 100 imports | ~30 lines, 3 imports |
| `styles.css` | 2,045 lines monolith | 5-6 scoped files, ~300-400 each |
| Empty dirs / duplicate folders | 8 | 0 |
| Root debris files | 12 | 0 |
| Agent confusion surface | Massive | Dramatically reduced |
| Time for new agent to understand structure | 10-15 min | 2-3 min |

---

## Quick Reference: File Organization Rules

```
✅ One page component per file (unless <30 LOC trivial stub)
✅ Use index.ts barrels in feature folders to simplify imports  
✅ API files split by domain: careerApi.ts, lms/resourcesApi.ts
✅ Services split by concern: lmsSearchStore.js, lmsProgressStore.js
✅ All contexts in src/contexts/ (one folder, plural)
✅ Routes defined in src/routes/ modules
✅ CSS split by feature in src/styles/
✅ Static/prototype code in src/lib/prototype/ if kept

❌ Never: 20 page components in one "shared" file
❌ Never: Two folders with similar names (context/ vs contexts/)
❌ Never: Empty directories without a README explaining intent
❌ Never: Backend scripts mixed into src/services/
❌ Never: God files >500 LOC without a split plan
❌ Never: Scratch files in the project root
❌ Never: 200MB binaries tracked in git
```
