# Frontend Rollout Checkpoints

## Phase 1: Navigation Contract
- Keep one canonical route catalog in `src/config/navigationRegistry.ts`.
- Generate sidebar groups, command-palette groups, and breadcrumbs from this catalog.
- Validate dynamic route resolution for deep links (`:eventId`, `:roundId`, `:id`).

## Phase 2: App Shell Consistency
- Mount breadcrumbs in the authenticated shell through `AppContentChrome`.
- Keep public and private layout boundaries stable in `PageLayout`.
- Preserve existing route paths and protection wrappers while improving structure.

## Phase 3: Shared Primitives Adoption
- Use `src/components/ui/AsyncState.tsx` for loading/error/empty states.
- Route feature-specific state components to shared primitives first, then deprecate duplicates.
- Prefer `components/layout/PageLayouts.tsx` wrappers for new/updated pages.

## Phase 4: Dashboard as Operating Center
- Keep dashboard as first destination and aggregate ERP, LMS, events, and career signals.
- Apply responsive grid behavior before introducing new widgets.
- Standardize section cards and quick actions to shared primitives.

## Phase 5: Module Migration
- High priority: Events + ERP rendered pages.
- Medium priority: Career and LMS pattern convergence.
- Low priority: secondary admin/support polish and legacy page cleanup.

## Phase 6: Quality Gates
- Unit coverage for route-catalog integrity and dynamic breadcrumb matching.
- Ensure sidebar and command-palette grouping remain aligned.
- Keep dead links out of organizer/admin quick actions.
