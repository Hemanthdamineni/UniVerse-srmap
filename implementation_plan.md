# Implementation Plan — God-File Splits

Tracked per AGENTS.md: no file may exceed 500 LOC without a documented split plan.

## AcademicTracker/AcademicHubPage.tsx (was ~1252 LOC)

Split completed. The page is now a composition shell (data fetching, tab state, ERP
history loading, KPI derivation) and renders five section modules from `hub/`:

| Module | Responsibility |
| --- | --- |
| `hub/types.ts` | Tab config (`TABS`), shared data interfaces (`OverviewData`, `InsightsData`, `UnifiedData`, `HistoryData`), SGPA computation |
| `hub/controls.tsx` | Hub-local controls: `TabIcon`, `PriorityBadge`, `ActionButton`, `SkillPill` |
| `hub/OverviewTab.tsx` | KPIs, quick actions, semester focus, attendance overview, GPA trend + semester cards |
| `hub/HistoryTab.tsx` | Cumulative summary and per-semester results tables |
| `hub/PlannerTab.tsx` | SGPA/CGPA predictor embed + `TargetCgpaCalculator` |
| `hub/RisksTab.tsx` | Attendance risk, subject/category risk, unified risk signals, all-clear state |
| `hub/ActionTab.tsx` | Priority actions, skills to develop, recommended opportunities, ATS readiness |

Notes:
- No barrel file: import modules directly (`./hub/OverviewTab`) to keep route imports readable.
- The tab rail uses the shared `SegmentedControl` primitive (`src/components/ui/SegmentedControl.tsx`).
- Behavior, copy, and DOM text are preserved verbatim; `AcademicHubPage.test.tsx` guards the contract.
