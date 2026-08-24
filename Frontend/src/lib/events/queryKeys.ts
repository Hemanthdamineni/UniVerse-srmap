// Query key catalog — events domain (docs/react-query-migration-plan.md §3.2).
// Adopts the TTL table documented in lib/events/eventCache.ts: detail 60s,
// config 120s, role 60s, submissions 30s.
export const eventKeys = {
  all: ["events"] as const,
  detail: (eventId: string) => ["event", eventId] as const,
  config: (eventId: string) => ["event", eventId, "config"] as const,
  role: (eventId: string) => ["event", eventId, "role"] as const,
  submissions: (eventId: string) => ["event", eventId, "submissions"] as const,
};
