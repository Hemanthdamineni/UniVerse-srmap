// Shared useQuery option presets (docs/react-query-migration-plan.md §3.3).
// The backend ERP cache is the freshness authority: fresh TTL 60s, stale-serve
// up to 10min with background refresh. Client staleTime must stay at or below
// the backend fresh window so cached reads never outlive it.
export const ERP_FRESH_TTL_MS = 60_000;

export const erpReadOptions = {
  staleTime: ERP_FRESH_TTL_MS,
} as const;

export const listOptions = {
  staleTime: 30_000,
} as const;

export const referenceDataOptions = {
  staleTime: 10 * 60_000,
} as const;

export const adminQueueOptions = {
  staleTime: 15_000,
} as const;
