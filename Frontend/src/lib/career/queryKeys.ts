// Query key catalog — career domain (docs/react-query-migration-plan.md §3.2).
export const careerKeys = {
  all: ["career"] as const,
  interviewSlots: (filters?: Record<string, string>) =>
    (filters ? (["career", "interview-slots", filters] as const) : (["career", "interview-slots"] as const)),
  interviewBookings: (filters?: Record<string, string>) =>
    (filters ? (["career", "interview-bookings", filters] as const) : (["career", "interview-bookings"] as const)),
  alumni: (filters?: Record<string, string>) =>
    (filters ? (["career", "alumni", filters] as const) : (["career", "alumni"] as const)),
  alumniNominationsMine: ["career", "alumni-nominations", "mine"] as const,
  alumniNominationsPending: ["career", "alumni-nominations", "pending"] as const,
  alumniRequestsSent: ["career", "alumni-requests", "sent"] as const,
  alumniRequestsPending: ["career", "alumni-requests", "pending"] as const,
  opportunities: (filters?: Record<string, string>) =>
    (filters ? (["career", "opportunities", filters] as const) : (["career", "opportunities"] as const)),
  applications: ["career", "applications"] as const,
  savedSearches: ["career", "saved-searches"] as const,
  learningPlans: ["career", "learning-plans"] as const,
};
