import type { NavSection, SidebarLeafItem } from "../erpBlueprintTypes";

export const MAIN_NAV: NavSection[] = [
  {
    section: "ERP CORE",
    icon: "/assets/icons/Dashboard.png",
    items: [
      {
        type: "link",
        label: "Dashboard",
        route: "/dashboard",
        icon: "/assets/icons/Dashboard.png",
        domain: "erp",
        access: "B",
      },
      {
        type: "group",
        label: "Academics",
        icon: "/assets/icons/Classroom.png",
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
        icon: "/assets/icons/Dashboard.png",
        domain: "campus",
        children: [
          { type: "link", label: "Vacant Rooms", route: "/campus/vacant-rooms", domain: "campus", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Exams/Results",
        icon: "/assets/icons/Exams.png",
        domain: "erp",
        children: [
          { type: "link", label: "Current Semester Results", route: "/exams/current-semester-results", domain: "erp", access: "B" },
          { type: "link", label: "Earlier Semester Results", route: "/exams/earlier-semester-results", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Finance",
        icon: "/assets/icons/Fianance.png",
        domain: "erp",
        children: [
          { type: "link", label: "Fees Dues", route: "/finance/fee-dues", domain: "erp", access: "B" },
          { type: "link", label: "Fees Paid", route: "/finance/fee-paid", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Registration",
        icon: "/assets/icons/Exams.png",
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
        icon: "/assets/icons/NotificationIcon.png",
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
        icon: "/assets/icons/Placements.png",
        domain: "lms",
        children: [
          { type: "link", label: "Academic Hub", route: "/academic-tracker/academic-insights", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Helpdesk",
        icon: "/assets/icons/SearchIcon.png",
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
    icon: "/assets/icons/Events.png",
    items: [
      {
        type: "link",
        label: "Discover",
        route: "/events",
        icon: "/assets/icons/Events.png",
        domain: "campus",
        access: "B",
      },
      {
        type: "group",
        label: "My Participation",
        icon: "/assets/icons/Dashboard.png",
        domain: "campus",
        children: [
          { type: "link", label: "My Activity", route: "/events/my-activity", domain: "campus", access: "A" },
          { type: "link", label: "My Teams", route: "/events/my-teams", domain: "campus", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Organize & Manage",
        icon: "/assets/icons/Menu-icon.png",
        domain: "campus",
        children: [
          { type: "link", label: "Create Event", route: "/events/create", domain: "campus", access: "A" },
          { type: "link", label: "My Created Events", route: "/events/my-created", domain: "campus", access: "A" },
        ],
      },
    ],
  },

  {
    section: "LEARNING MANAGEMENT",
    icon: "/assets/icons/Library.png",
    items: [
      {
        type: "group",
        label: "Browse & Discover",
        icon: "/assets/icons/Library.png",
        domain: "lms",
        children: [
          { type: "link", label: "Browse Catalog", route: "/resources/browse", domain: "lms", access: "B" },
          { type: "link", label: "Explore", route: "/resources/explore", domain: "lms", access: "A" },
          { type: "link", label: "Roadmaps", route: "/resources/roadmaps", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Learning",
        icon: "/assets/icons/Classroom.png",
        domain: "lms",
        children: [
          { type: "link", label: "Learning Home", route: "/resources", domain: "lms", access: "B" },
          { type: "link", label: "Materials", route: "/resources/learning-materials", domain: "lms", access: "B" },
          { type: "link", label: "Guides", route: "/resources/guides", domain: "lms", access: "B" },
          { type: "link", label: "Question Bank", route: "/resources/question-bank", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "My Workspace",
        icon: "/assets/icons/Dashboard.png",
        domain: "lms",
        children: [
          { type: "link", label: "Bookmarks", route: "/resources/me/bookmarks", domain: "lms", access: "B" },
          { type: "link", label: "Collections", route: "/resources/me/collections", domain: "lms", access: "B" },
          { type: "link", label: "Progress", route: "/resources/me/progress", domain: "lms", access: "B" },
          { type: "link", label: "Revision Queue", route: "/resources/me/revision", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Community",
        icon: "/assets/icons/NotificationIcon.png",
        domain: "lms",
        children: [
          { type: "link", label: "Request Board", route: "/resources/requests", domain: "lms", access: "B" },
          { type: "link", label: "Contribute Resource", route: "/resources/add", domain: "lms", access: "A" },
          { type: "link", label: "My Contributions", route: "/resources/me/contributions", domain: "lms", access: "A" },
          { type: "link", label: "Feedback", route: "/resources/me/exam-feedback", domain: "lms", access: "B" },
        ],
      },
    ],
  },
  {
    section: "CAREER SERVICES",
    icon: "/assets/icons/Placements.png",
    items: [
      {
        type: "link",
        label: "Career Home",
        route: "/career",
        icon: "/assets/icons/Placements.png",
        domain: "career",
        access: "B",
      },
      {
        type: "group",
        label: "Opportunities",
        icon: "/assets/icons/Placements.png",
        domain: "career",
        children: [
          { type: "link", label: "All Opportunities", route: "/career/opportunities", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "My Activity",
        icon: "/assets/icons/Dashboard.png",
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
        icon: "/assets/icons/ProfileIcon.svg",
        domain: "career",
        children: [
          { type: "link", label: "Career Profile", route: "/career/me/profile", domain: "career", access: "B" },
          { type: "link", label: "Skill Gap Analysis", route: "/career/me/skill-gap", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Networking",
        icon: "/assets/icons/Events.png",
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
    icon: "/assets/icons/NotificationIcon.png",
    route: "/notifications",
    domain: "erp",
  },
  {
    label: "Settings",
    icon: "/assets/icons/Settings.png",
    route: "/settings",
    domain: "erp",
  },
  {
    label: "Logout",
    icon: "/assets/icons/Logout.png",
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
