import type { PageBlueprint } from "../erpBlueprintTypes";

type Bp = PageBlueprint;
function internal(route: string, heading: string, fetchKeys: string[], loadingMessage: string, overrides?: Partial<Bp>): Bp {
  return {
    route, heading, fetchKeys, loadingMessage,
    domain: "career", sourceMode: "internal", integrationState: "native", renderer: "generic",
    ...overrides,
  } as Bp;
}
function externalSummary(route: string, heading: string, fetchKeys: string[], loadingMessage: string): Bp {
  return {
    route, heading, fetchKeys, loadingMessage,
    domain: "campus", sourceMode: "external", integrationState: "summary", renderer: "generic",
  } as Bp;
}

export const WORKSPACE_PAGE_BLUEPRINTS: Record<string, PageBlueprint> = {
  "/learn/materials":  internal("/learn/materials",  "Learning Materials",  ["resources/learning-materials"],  "Loading learning materials...",  { domain: "lms" }),
  "/learn/advanced-access": {
    route: "/learn/advanced-access",
    heading: "Advanced Access",
    fetchKeys: [],
    domain: "lms",
    integrationState: "placeholder",
    renderer: "generic",
    placeholderReason: "Coming soon: advanced access is not yet available to students.",
    status: "hidden",
  } as Bp,

  "/academic-tracker/academic-insights": internal("/academic-tracker/academic-insights", "Academic Tracker", ["academic-tracker/academic-insights", "academic-tracker/progress-overview"], "Loading academic tracker...", { domain: "lms" }),

  "/career":                        internal("/career",                        "Career Portal",         ["career/opportunities"],                       "Opening Career Portal..."),
  "/career/opportunities":          internal("/career/opportunities",          "All Opportunities",     ["career/opportunities"],                       "Searching opportunities..."),
  "/career/jobs":                   internal("/career/jobs",                   "Job Opportunities",     ["career/opportunities"],                       "Searching jobs..."),
  "/career/internships":            internal("/career/internships",            "Internships",           ["career/opportunities"],                       "Searching internships..."),
  "/career/hackathons":             internal("/career/hackathons",             "Hackathons",            ["career/opportunities"],                       "Searching hackathons..."),
  "/career/competitions":           internal("/career/competitions",           "Competitions",          ["career/opportunities"],                       "Searching competitions..."),
  "/career/me/bookmarks":           internal("/career/me/bookmarks",           "My Bookmarks",          ["career/opportunities"],                       "Loading bookmarks..."),
  "/career/me/profile":             internal("/career/me/profile",             "Career Profile",        ["career/profile"],                             "Loading profile...",           { status: "hidden" }),
  "/career/me/skill-gap":           internal("/career/me/skill-gap",           "Skill Gap Analysis",    ["career/profile/skill-gaps"],                  "Analyzing skill gaps...",      { status: "hidden" }),
  "/career/me/tracker":             internal("/career/me/tracker",             "Application Tracker",   ["career/applications"],                        "Loading application tracker..."),
  "/career/submit":                 internal("/career/submit",                 "Submit Opportunity",    [],                                             "Opening submission form..."),
  "/career/alumni":                 internal("/career/alumni",                 "Alumni Connect",        ["career/alumni"],                              "Loading alumni...",            { status: "hidden" }),
  "/career/interviews":             internal("/career/interviews",             "Interview Booking",     ["career/interviews"],                          "Loading interviews..."),
  "/career/me/resume":              internal("/career/me/resume",              "Resume Builder",        ["career/resume"],                              "Loading resume..."),
  "/career/opportunities/:id":      internal("/career/opportunities/:id",      "Opportunity Details",   ["career/opportunities/:id"],                   "Loading details..."),

  "/helpdesk/raise-ticket":         externalSummary("/helpdesk/raise-ticket",  "Raise a Ticket",        ["helpdesk/raise-ticket"],                      "Loading ticket desk..."),
  "/helpdesk/faqs":                 externalSummary("/helpdesk/faqs",          "FAQs",                  ["helpdesk/faqs"],                              "Loading helpdesk FAQs..."),
  "/helpdesk/track-escalate":       externalSummary("/helpdesk/track-escalate","Track & Escalate",      ["helpdesk/track-escalate"],                    "Loading escalations..."),

  "/notifications":                 { route: "/notifications", heading: "Notifications", fetchKeys: ["announcements"], domain: "erp", sourceMode: "erp", integrationState: "native", renderer: "announcements", loadingMessage: "Loading notifications...", status: "hidden" } as Bp,
  "/settings":                      { route: "/settings",                      heading: "Settings",                    fetchKeys: ["verification/mobile-no-verification"], domain: "erp", sourceMode: "erp", integrationState: "native", renderer: "document", loadingMessage: "Loading settings..." } as Bp,
  "/profile":                       { route: "/profile",                       heading: "Profile",                    fetchKeys: ["profile", "verification/mobile-no-verification"], domain: "erp", sourceMode: "erp", integrationState: "native", renderer: "profile", includeSessionProfile: true, loadingMessage: "Loading profile..." } as Bp,

  "/admin/events-management":       internal("/admin/events-management",       "Admin Events Management",       [], "Loading events management...",       { domain: "admin" }),
  "/admin/content-management":      internal("/admin/content-management",      "Admin Content Management",      [], "Loading content management...",      { domain: "admin" }),
  "/admin/campus-feedback":         internal("/admin/campus-feedback",         "Campus Feedback Moderation",    [], "Loading campus feedback...",         { domain: "admin" }),
  "/admin/companion-analytics":     internal("/admin/companion-analytics",     "Companion Analytics",           [], "Loading companion analytics...",     { domain: "admin" }),
  "/admin/lms-moderation":          internal("/admin/lms-moderation",          "LMS Moderation",                [], "Loading LMS moderation...",          { domain: "admin" }),
  "/admin/system-controls":         internal("/admin/system-controls",         "Admin System Controls",         [], "Loading system controls...",         { domain: "admin" }),
  "/admin/helpdesk-tickets":        internal("/admin/helpdesk-tickets",        "Admin Helpdesk Tickets",        [], "Loading helpdesk tickets...",        { domain: "admin" }),
  "/admin/helpdesk-faqs":           internal("/admin/helpdesk-faqs",           "Admin Helpdesk FAQs",           [], "Loading helpdesk FAQs...",           { domain: "admin" }),
  "/admin/career-opportunities":    internal("/admin/career-opportunities",    "Admin Career Opportunities",    [], "Loading career opportunities...",    { domain: "admin" }),
  "/admin/career-interviews":       internal("/admin/career-interviews",       "Admin Career Interviews",       [], "Loading career interviews...",       { domain: "admin" }),
  "/admin/career-alumni":           internal("/admin/career-alumni",           "Admin Career Alumni",           [], "Loading alumni management...",       { domain: "admin" }),
  "/admin/department-performance":  internal("/admin/department-performance",  "Department Performance",        [], "Loading department performance...",  { domain: "admin" }),
  "/admin/event-approvals":         internal("/admin/event-approvals",         "Event Approvals",               [], "Loading event approvals...",         { domain: "admin" }),
  "/admin/audit-logs":              internal("/admin/audit-logs",              "System Audit Logs",             [], "Loading audit logs...",              { domain: "admin" }),
  "/admin/certificate-templates":   internal("/admin/certificate-templates",   "Certificate Templates",         [], "Loading certificate templates...",   { domain: "admin" }),
};
