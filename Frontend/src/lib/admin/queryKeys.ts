// Query key catalog — admin domain (docs/react-query-migration-plan.md §3.2).
export const adminKeys = {
  all: ["admin"] as const,
  lmsModerationQueue: (filters?: Record<string, string | number>) =>
    (filters ? (["admin", "lms-moderation", filters] as const) : (["admin", "lms-moderation"] as const)),
  campusFeedbackQueue: (filters?: Record<string, string | number>) =>
    (filters ? (["admin", "campus-feedback", filters] as const) : (["admin", "campus-feedback"] as const)),
};
