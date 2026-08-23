// Query key catalog — session domain (docs/react-query-migration-plan.md §3.2).
// Keys are created through factories only; never inline raw arrays at call
// sites so invalidation cannot drift from readers.
export const sessionKeys = {
  all: ["session"] as const,
  profile: ["session", "profile"] as const,
};
