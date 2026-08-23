import type { PageBlueprint } from "../erpBlueprintTypes";

type EventBlueprint = Omit<PageBlueprint, "route" | "heading" | "loadingMessage">;

function bp(
  route: string,
  heading: string,
  loadingMessage: string,
  overrides?: Partial<EventBlueprint>,
): PageBlueprint {
  return {
    route,
    heading,
    loadingMessage,
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    fetchKeys: [],
    ...overrides,
  } as PageBlueprint;
}

export const EVENT_PAGE_BLUEPRINTS: Record<string, PageBlueprint> = {
  "/events/attendance": bp("/events/attendance", "Event Attendance", "Loading event attendance...", {
    fetchKeys: ["events/event-attendance"],
    domain: "erp",
    sourceMode: "erp",
    status: "hidden"
  }),
  "/events": bp("/events", "Discover", "Loading events..."),
  "/events/:eventId": bp("/events/:eventId", "Event Details", "Loading event..."),
  "/events/my-activity": bp("/events/my-activity", "My Activity", "Loading activity..."),
  "/events/my-created": bp("/events/my-created", "My Created Events", "Loading created events..."),
  "/events/create": bp("/events/create", "Create Event", "Loading event builder..."),
  "/events/my-teams": bp("/events/my-teams", "My Teams", "Loading teams..."),
  "/events/:eventId/register": bp("/events/:eventId/register", "Register for Event", "Loading registration..."),
  "/events/:eventId/teams/create": bp("/events/:eventId/teams/create", "Create Team", "Loading team creation..."),
  "/events/:eventId/teams/:teamId": bp("/events/:eventId/teams/:teamId", "Team Details", "Loading team..."),
  "/events/:eventId/certificate/:roundId": bp("/events/:eventId/certificate/:roundId", "Claim Certificate", "Loading certificate..."),
  "/events/:eventId/leaderboard/:roundId": bp("/events/:eventId/leaderboard/:roundId", "Leaderboard", "Loading leaderboard..."),
  "/events/:eventId/manage/roles": bp("/events/:eventId/manage/roles", "Manage Roles", "Loading roles..."),
  "/events/:eventId/manage/certificate": bp("/events/:eventId/manage/certificate", "Certificate Template", "Loading certificate template..."),
  "/events/:eventId/submit/:roundId": bp("/events/:eventId/submit/:roundId", "Submit Your Work", "Loading round details..."),
  "/events/:eventId/my-results/:roundId": bp("/events/:eventId/my-results/:roundId", "Your Results", "Loading your results..."),
  "/events/:eventId/manage": bp("/events/:eventId/manage", "Manage Competition", "Loading competition data..."),
  "/events/:eventId/manage/rounds/:roundId/submissions": bp("/events/:eventId/manage/rounds/:roundId/submissions", "Submissions", "Loading submissions..."),
  "/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate": bp("/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate", "Evaluate Submission", "Loading submission..."),
  "/events/:eventId/manage/rounds/:roundId/shortlist": bp("/events/:eventId/manage/rounds/:roundId/shortlist", "Shortlist & Evaluation", "Loading evaluation data..."),
  "/feedback/course-feedback": bp("/feedback/course-feedback", "Course Feedback", "Loading course feedback...", {
    fetchKeys: ["feedback/end-semester-feedback"],
    domain: "erp",
    sourceMode: "erp",
  }),
  "/feedback/events-feedback": bp("/feedback/events-feedback", "Events Feedback", "Loading events feedback...", {
    fetchKeys: ["feedback/events-feedback"],
    sourceMode: "external",
    integrationState: "summary",
  }),
  "/feedback/hostel-mess-feedback": bp("/feedback/hostel-mess-feedback", "Hostel & Mess Feedback", "Loading hostel and mess feedback...", {
    fetchKeys: ["feedback/hostel-mess-feedback"],
    sourceMode: "external",
    integrationState: "summary",
  }),
  "/feedback/transport-feedback": bp("/feedback/transport-feedback", "Transport Feedback", "Loading transport feedback...", {
    fetchKeys: ["feedback/transport-feedback"],
    sourceMode: "external",
    integrationState: "summary",
  }),
};
