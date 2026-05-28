# ERP Availability and Transformer Audit

Last updated: 2026-05-25  
Scope: Optional ERP content by student type (hosteler/day scholar/transport/SAP) and admin-enabled flows (feedback, registration, etc.)

## Short Answer First

Transformers are required, but not in both places.

- Keep transformation/normalization on the backend as the single source of truth.
- Remove heavy frontend transformation logic for ERP payload meaning.
- Frontend should only render typed backend contracts and small UI formatting helpers.

For your use case (some pages applicable only for some students), the core need is not “more transformers”; it is explicit availability contracts from backend.

## Audit Findings (Current Problems)

## 1) Split normalization responsibility (backend + frontend)

Evidence:
- Backend normalization rules exist (`Backend/src/services/erpPayloadNormalizer.js`) including `applyTimetableSubjectsRule`.
- Frontend also performs heavy interpretation/cleanup (`Frontend/src/lib/erpTransformers.ts`, `Frontend/src/pages/Shared/useBlueprintPageData.ts`, `Frontend/src/components/erp/ErpDocumentRenderer.tsx`).

Why this is a problem:
- Same business meaning can be interpreted differently in two places.
- Fixes must be duplicated.
- Regressions appear when one layer changes and the other does not.

## 2) Optional/eligibility state is inferred from text instead of contract

Evidence:
- Frontend infers statuses using regex patterns like `not applicable`, `feedback not enabled`, `not registered`, etc. in:
  - `Frontend/src/pages/Shared/useBlueprintPageData.ts`
  - `Frontend/src/components/erp/ErpDocumentRenderer.tsx`

Why this is a problem:
- Message wording changes can break behavior.
- “Not applicable” vs “disabled by admin” vs “temporarily closed” are different states but are text-parsed heuristically.
- Hard to produce consistent UI and analytics.

## 3) Two ERP consumption paths increase inconsistency risk

Evidence:
- Legacy-like generic path uses `/api/scrape/*` via `useBlueprintPageData`.
- ERP V2 typed wrapper exists (`/api/v2/erp/*`) used by several dedicated pages (`DocumentErpPage`, `FeePaidPage`, etc.).

Why this is a problem:
- Different pages can behave differently for the same data quality issue.
- Debugging requires checking two pipelines and two response shapes.

## 4) “Black box” feel is real due to hidden heuristics and silent filtering

Evidence:
- Frontend filtering/dedupe/noise removal is extensive (`useBlueprintPageData`, `ErpDocumentRenderer`).
- Rows and summaries are dropped based on heuristics.

Why this is a problem:
- Developers cannot easily answer “why this row disappeared”.
- Product behavior depends on implicit parser behavior rather than explicit states.

## 5) No first-class entitlement matrix for student type + admin toggles

Current state:
- Student-specific applicability appears as payload text.
- Admin enablement appears in some feature-specific services (example: feedback automation), but not as a unified page-availability contract.

Why this is a problem:
- Nav visibility, page state, and backend response are not driven by one canonical entitlement object.

## What To Build Instead (Recommended Target Model)

## A) Backend-first availability contract (mandatory)

For each page key, backend should return:

- `availability.state`: `available | not_applicable | disabled_by_admin | closed_window | not_registered | unavailable`
- `availability.reasonCode`: stable machine code
- `availability.message`: user-facing message
- `availability.effectiveFor`: optional profile qualifiers (hosteler/day scholar/SAP/etc.)
- `availability.lastCheckedAt`

This should come from a single backend service, e.g. `erpAvailabilityService`.

## B) Single normalization source (backend only)

Move business normalization fully to backend:
- Table/header repairs
- Duplicate resolution
- Applicability extraction
- Section merge policy

Frontend should consume only canonical backend shape:
- typed data blocks
- document blocks
- availability/status blocks

## C) Keep frontend transformers minimal

Frontend “transformers” should only handle:
- display formatting (number/date text)
- optional chart shaping from already-canonical data

They should not decide entitlement, not-applicable logic, or upstream data correctness.

## D) Unify fetch path to ERP V2 contracts

Retire page-level usage of `/api/scrape/*` for production pages and standardize on `/api/v2/erp/page` and `/api/v2/erp/batch` contracts.

## E) Add traceability metadata for debugging

Return backend `meta.transformTrace` per key:
- rules applied
- row counts before/after
- dropped row reasons
- source section contribution

This removes the black-box effect.

## Concrete Implementation Plan

## Phase 1: Contract and entitlement foundation

1. Add `availability` object to ERP V2 response schema.
2. Create centralized entitlement evaluator using:
   - session profile
   - admin toggle store
   - registration windows
   - source endpoint health
3. Define stable `reasonCode` enum and map to UI messages.

## Phase 2: Backend normalization consolidation

1. Keep/extend `erpPayloadNormalizer` as authoritative.
2. Move any remaining frontend business cleaning logic to backend.
3. Add `transformTrace` metadata.

## Phase 3: Frontend simplification

1. Update ERP pages to consume `availability` directly.
2. Remove regex-driven status inference from:
   - `useBlueprintPageData`
   - `ErpDocumentRenderer` text status parsing
3. Keep only presentational formatting helpers.

## Phase 4: Testing and rollout

1. Contract tests for each availability state.
2. Matrix tests:
   - hosteler
   - day scholar (bus)
   - non-bus day scholar
   - SAP-eligible / non-eligible
   - admin-enabled / admin-disabled feature
3. Snapshot tests proving no silent row loss.
4. Observability dashboard: availability state counts + normalization rule frequencies.

## Suggested API Shape

```json
{
  "success": true,
  "pageKey": "registration/hostel-registration",
  "source": "live",
  "data": { "document": {} },
  "availability": {
    "state": "not_applicable",
    "reasonCode": "PROFILE_NOT_HOSTELER",
    "message": "Hostel registration is not applicable for your profile.",
    "effectiveFor": { "hosteler": false },
    "lastCheckedAt": "2026-05-25T18:30:00.000Z"
  },
  "meta": {
    "targets": [],
    "normalizationRules": [],
    "transformTrace": []
  }
}
```

## Decision for Your Original Question

“Is transformers and all required for this kind of optional content?”

Recommended decision:
- Yes, a transformation layer is required.
- No, dual backend+frontend heavy transformers are not required.
- Use backend-only business transformers + explicit availability contract.
- Keep frontend thin and deterministic.

This gives you predictable behavior for hosteler/day-scholar/SAP/admin-enabled differences without fragile text parsing.
