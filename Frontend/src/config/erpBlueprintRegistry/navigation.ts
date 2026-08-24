import type { NavSection, SidebarLeafItem } from "../erpBlueprintTypes";

export const MAIN_NAV: NavSection[] = [
  {
    section: "ERP CORE",
    icon: "LayoutDashboard",
    items: [
      {
        type: "link",
        label: "Dashboard",
        route: "/dashboard",
        icon: "LayoutDashboard",
        domain: "erp",
        access: "B",
      },
      {
        type: "group",
        label: "Academics",
        icon: "GraduationCap",
        domain: "erp",
        children: [
          { type: "link", label: "Time Table", route: "/academic/timetable", domain: "erp", access: "B" },
          { type: "link", label: "Attendance Details", route: "/academic/attendance-details", domain: "erp", access: "B" },
          { type: "link", label: "Curriculum", route: "/academic/curriculum", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Campus Tools",
        icon: "Building2",
        domain: "campus",
        children: [
          { type: "link", label: "Vacant Rooms", route: "/campus/vacant-rooms", domain: "campus", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Exams/Results",
        icon: "ClipboardCheck",
        domain: "erp",
        children: [
          { type: "link", label: "Current Semester Results", route: "/exams/current-semester-results", domain: "erp", access: "B" },
          { type: "link", label: "Earlier Semester Results", route: "/exams/earlier-semester-results", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Finance",
        icon: "Wallet",
        domain: "erp",
        children: [
          { type: "link", label: "Fees Dues", route: "/finance/fee-dues", domain: "erp", access: "B" },
          { type: "link", label: "Fees Paid", route: "/finance/fee-paid", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Registration",
        icon: "ClipboardList",
        domain: "mixed",
        children: [
          { type: "link", label: "Course Registration", route: "/registration/course-registration", domain: "erp", access: "B" },
          { type: "link", label: "Hostel Registration", route: "/registration/hostel-registration", domain: "campus", access: "B" },
          { type: "link", label: "Transport Registration", route: "/registration/transport-registration", domain: "campus", access: "B" },
        ],
      },

      {
        type: "group",
        label: "Feedback",
        icon: "MessageSquareText",
        domain: "mixed",
        children: [
          { type: "link", label: "Course Feedback", route: "/feedback/course-feedback", domain: "erp", access: "B" },
          { type: "link", label: "Events Feedback", route: "/feedback/events-feedback", domain: "campus", access: "A" },
          { type: "link", label: "Hostel & Mess Feedback", route: "/feedback/hostel-mess-feedback", domain: "campus", access: "A" },
          { type: "link", label: "Transport Feedback", route: "/feedback/transport-feedback", domain: "campus", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Academic Tracker",
        icon: "TrendingUp",
        domain: "lms",
        children: [
          { type: "link", label: "Academic Hub", route: "/academic-tracker/academic-insights", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Helpdesk",
        icon: "LifeBuoy",
        domain: "campus",
        children: [
          { type: "link", label: "Raise a Ticket", route: "/helpdesk/raise-ticket", domain: "campus", access: "A" },
          { type: "link", label: "FAQs", route: "/helpdesk/faqs", domain: "campus", access: "B" },
          { type: "link", label: "Track & Escalate", route: "/helpdesk/track-escalate", domain: "campus", access: "A" },
        ],
      },
    ],
  },
  {
    section: "COMPETITION PLATFORM",
    icon: "Compass",
    items: [
      {
        type: "link",
        label: "Discover",
        route: "/events",
        icon: "Compass",
        domain: "campus",
        access: "B",
      },
      {
        type: "group",
        label: "My Participation",
        icon: "UsersRound",
        domain: "campus",
        children: [
          { type: "link", label: "My Activity", route: "/events/my-activity", domain: "campus", access: "A" },
          { type: "link", label: "My Teams", route: "/events/my-teams", domain: "campus", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Organize & Manage",
        icon: "CalendarPlus",
        domain: "campus",
        children: [
          { type: "link", label: "Create Event", route: "/events/create", domain: "campus", access: "A" },
          { type: "link", label: "My Created Events", route: "/events/my-created", domain: "campus", access: "A" },
        ],
      },
    ],
  },

  {
    section: "LEARNING",
    icon: "LibraryBig",
    items: [
      {
        type: "link",
        label: "Home",
        route: "/learn",
        icon: "House",
        domain: "lms",
        access: "B",
      },
      {
        type: "group",
        label: "Learn",
        icon: "BookOpen",
        domain: "lms",
        children: [
          { type: "link", label: "Discover", route: "/learn/discover", domain: "lms", access: "B" },
          { type: "link", label: "Practice", route: "/learn/practice", domain: "lms", access: "B" },
          { type: "link", label: "Roadmaps", route: "/learn/roadmaps", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "My Space",
        icon: "Folders",
        domain: "lms",
        children: [{ type: "link", label: "My Learning", route: "/learn/me", domain: "lms", access: "B" }],
      },
      {
        type: "group",
        label: "Community",
        icon: "HeartHandshake",
        domain: "lms",
        children: [
          { type: "link", label: "Contribute", route: "/learn/contribute", domain: "lms", access: "A" },
          { type: "link", label: "Request Board", route: "/learn/requests", domain: "lms", access: "B" },
        ],
      },
    ],
  },
  {
    section: "CAREER SERVICES",
    icon: "Briefcase",
    items: [
      {
        type: "link",
        label: "Career Home",
        route: "/career",
        icon: "Briefcase",
        domain: "career",
        access: "B",
      },
      {
        type: "group",
        label: "Opportunities",
        icon: "Search",
        domain: "career",
        children: [
          { type: "link", label: "All Opportunities", route: "/career/opportunities", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "My Activity",
        icon: "Route",
        domain: "career",
        children: [
          { type: "link", label: "My Bookmarks", route: "/career/me/bookmarks", domain: "career", access: "B" },
          { type: "link", label: "Application Tracker", route: "/career/me/tracker", domain: "career", access: "B" },
          { type: "link", label: "Interview Booking", route: "/career/interviews", domain: "career", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Profile & Insights",
        icon: "UserRound",
        domain: "career",
        children: [
          { type: "link", label: "Career Profile", route: "/career/me/profile", domain: "career", access: "B" },
          { type: "link", label: "Skill Gap Analysis", route: "/career/me/skill-gap", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Networking",
        icon: "Network",
        domain: "career",
        children: [
          { type: "link", label: "Alumni Connect", route: "/career/alumni", domain: "career", access: "B" },
        ],
      },
    ],
  },
];

export const BOTTOM_NAV: SidebarLeafItem[] = [
  {
    label: "Notifications",
    icon: "Bell",
    route: "/notifications",
    domain: "erp",
  },
  {
    label: "Settings",
    icon: "Settings",
    route: "/settings",
    domain: "erp",
  },
  {
    label: "Logout",
    icon: "LogOut",
    route: "/logout",
    domain: "erp",
  },
];

export const DASHBOARD_QUICK_LINKS = [
  { label: "Time Table", route: "/academic/timetable" },
  { label: "Attendance", route: "/academic/attendance-details" },
  { label: "Current Results", route: "/exams/current-semester-results" },
  { label: "Fees Paid", route: "/finance/fee-paid" },
  { label: "Notifications", route: "/notifications" },
] as const;
