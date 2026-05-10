# Refined Metadata Plan for ERP + LMS + Career + Campus

## Summary

- Keep the current routes, components, and sidebar UI unchanged in this phase.
- Make metadata the source of truth so future pillar-based navigation can be added without refactoring.
- Separate concerns cleanly:
  - `domain`: ownership pillar
  - `sourceMode`: data origin
  - `integrationState`: integration maturity

## Interface Changes

- Add `type Domain = "erp" | "lms" | "career" | "campus"`.
- Add `type PageSourceMode = "erp" | "internal" | "external"`.
- Add `type IntegrationState = "native" | "adapter" | "summary" | "placeholder"`.
- Update `PageBlueprint` in [Frontend/src/config/erpBlueprints.ts](/home/zorro-omarchy/Desktop/Coding-Things/Projects/Personal/00_Active/University-ERP/Frontend/src/config/erpBlueprints.ts):
  - `domain: Domain` is required.
  - `integrationState: IntegrationState` is required.
  - `sourceMode?: PageSourceMode` is omitted only for placeholders.
- Update nav metadata:
  - `SidebarSubItem.domain: Domain` for every leaf item.
  - `SidebarItem.domain: Domain | "mixed"` for top-level items only.

## Invariants / Rules

- Each page belongs to exactly one domain.
- Domain must be explicitly defined and not inferred from route or sidebar grouping.
- Non-placeholder pages must define `sourceMode`.
- Placeholder pages must omit `sourceMode` and have empty `fetchKeys`.
- `integrationState` must not contradict `sourceMode`:
  - `native` -> `internal` or `erp`
  - `adapter` -> `external` or `erp`
  - `summary` -> `external` or `erp`
- `"mixed"` domain is allowed only for top-level `SidebarItem`, never for pages or leaf nav items.
- LMS transitions (`internal` -> `external`) must not change route, component, or domain.
- Current sidebar grouping is not domain truth; future filtering and pillar switching must read metadata only.
- All external integrations must go through backend adapters; frontend pages may only call internal `/api/*` contracts.

## Domain Rules

- `erp`: dashboard, profile, academics, exams/results, finance, ERP registrations, course feedback, and ERP event attendance.
- `campus`: platform events, helpdesk, transport/hostel, and campus-service feedback.
- `lms`: learning materials, advanced access, academic tracker, and future learning workflows.
- `career`: opportunities, resume/profile, interviews, alumni.
- Explicit split for events:
  - ERP event attendance stays `domain: "erp"`.
  - Platform event flows stay `domain: "campus"`.

## Initial Classification Pass

- Reclassify Learning Materials and Advanced Access as `lms + internal + native` as long as they use platform-owned `/api/resources/*`.
- Keep LMS pages eligible to move later to `lms + external + adapter` without route or component changes.
- Keep academic tracker as `lms + external + summary` until it becomes a real internal module.
- Keep career/helpdesk summary pages as `career|campus + external + summary` until adapters are built.
- Mark only mixed top-level groups such as `Registration`, `Events`, and `Feedback` as `domain: "mixed"` if their children span domains.

## Test Plan

- Type checks fail if any page lacks `domain` or `integrationState`.
- Type checks fail if a non-placeholder page omits `sourceMode`.
- Type checks fail if a placeholder page defines `sourceMode` or non-empty `fetchKeys`.
- Config audit enforces the valid `integrationState`/`sourceMode` combinations.
- Config audit confirms every page and every leaf nav item has exactly one non-mixed domain.
- Config audit confirms only top-level `SidebarItem` may use `"mixed"`.
- Static audit confirms frontend data fetching targets only internal `/api/*` endpoints.
- Existing routes and sidebar rendering remain unchanged after metadata migration.

## Assumptions

- `domain: "mixed"` is a temporary container-only exception.
- External content links are still allowed as user-facing resources; the adapter rule applies to system integrations, not outbound links.
- No UI regrouping or route renaming is part of this phase.