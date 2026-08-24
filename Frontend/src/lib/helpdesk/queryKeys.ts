// Query key catalog — helpdesk domain (docs/react-query-migration-plan.md §3.2).
export const helpdeskKeys = {
  all: ["helpdesk"] as const,
  tickets: (filters?: Record<string, string>) =>
    (filters ? (["helpdesk", "tickets", filters] as const) : (["helpdesk", "tickets"] as const)),
  faqs: (filters?: Record<string, string>) =>
    (filters ? (["helpdesk", "faqs", filters] as const) : (["helpdesk", "faqs"] as const)),
};
