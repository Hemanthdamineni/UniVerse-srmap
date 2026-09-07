// Query key catalog — session domain (docs/react-query-migration-plan.md §3.2).
// Keys are created through factories only; never inline raw arrays at call
// sites so invalidation cannot drift from readers.
export const sessionKeys = {
  all: ["session"] as const,
  profile: ["session", "profile"] as const,
};

// Student graph (Batch B4). Surfaces in Epics 4–7 read through this key so a
// single invalidation after an ERP refresh reaches every consumer.
export const studentGraphKeys = {
  all: ["student-graph"] as const,
  graph: ["student-graph", "self"] as const,
};
