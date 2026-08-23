// Query key catalog — ERP domain (docs/react-query-migration-plan.md §3.2).
// pageKey is the backend scrape key ("academic/time-table", ...). Parameterized
// keys append their params object (e.g. semester marks).
export const erpKeys = {
  all: ["erp"] as const,
  page: (pageKey: string, params?: Record<string, string | number>) =>
    (params ? (["erp", pageKey, params] as const) : (["erp", pageKey] as const)),
  batch: (pageKeys: readonly string[]) => ["erp", "batch", ...pageKeys] as const,
};
