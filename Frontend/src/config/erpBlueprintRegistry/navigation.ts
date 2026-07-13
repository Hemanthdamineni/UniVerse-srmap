import type { NavSection, SidebarLeafItem } from "../erpBlueprintTypes";

export const MAIN_NAV: NavSection[] = [
  {
    section: "ERP CORE",
    icon: "/src/assets/Icons/Dashboard.png",
    items: [
      {
        type: "link",
        label: "Dashboard",
        route: "/dashboard",
        icon: "/src/assets/Icons/Dashboard.png",
        domain: "erp",
        access: "B",
      },
      {
        type: "group",
        label: "Academics",
        icon: "/src/assets/Icons/Classroom.png",
        domain: "erp",
        children: [
          { type: "link", label: "Time Table", route: "/academic/timetable", domain: "erp", access: "B" },
          { type: "link", label: "Attendance Details", route: "/academic/attendance-details", domain: "erp", access: "B" },
          { type: "link", label: "Curriculum", route: "/academic/curriculum", domain: "erp", access: "B" },
          { type: "link", label: "SAP & Scholarships", route: "/academic/sap-scholarships", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Exams/Results",
        icon: "/src/assets/Icons/Exams.png",
        domain: "erp",
        children: [
          { type: "link", label: "Current Semester Results", route: "/exams/current-semester-results", domain: "erp", access: "B" },
          { type: "link", label: "Earlier Semester Results", route: "/exams/earlier-semester-results", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Finance",
        icon: "/src/assets/Icons/Fianance.png",
        domain: "erp",
        children: [
          { type: "link", label: "Fees Dues", route: "/finance/fee-dues", domain: "erp", access: "B" },
          { type: "link", label: "Fees Paid", route: "/finance/fee-paid", domain: "erp", access: "B" },
          { type: "link", label: "Bank Details", route: "/finance/bank-details", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Registration",
        icon: "/src/assets/Icons/Exams.png",
        domain: "mixed",
        children: [
          { type: "link", label: "Course Registration", route: "/registration/course-registration", domain: "erp", access: "B" },
          { type: "link", label: "Minor/OE Registration", route: "/registration/minor-oe-registration", domain: "erp", access: "B" },
          { type: "link", label: "Exam Registration", route: "/registration/exam-registration", domain: "erp", access: "B" },
          { type: "link", label: "Hostel Registration", route: "/registration/hostel-registration", domain: "campus", access: "B" },
          { type: "link", label: "Transport Registration", route: "/registration/transport-registration", domain: "campus", access: "B" },
          { type: "link", label: "SAP Registration", route: "/registration/sap-registration", domain: "erp", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Transport & Hostel",
        icon: "/src/assets/Icons/Dashboard.png",
        domain: "campus",
        children: [
          { type: "link", label: "Rooms Details", route: "/transport-hostel/room-details", domain: "campus", access: "B" },
          { type: "link", label: "Route Details", route: "/transport-hostel/route-details", domain: "campus", access: "B" },
          { type: "link", label: "Refund & Change", route: "/transport-hostel/refund-change-requests", domain: "campus", access: "B" },
          { type: "link", label: "FAQs", route: "/transport-hostel/faqs", domain: "campus", access: "B" },
        ],
      },

      {
        type: "group",
        label: "Feedback",
        icon: "/src/assets/Icons/NotificationIcon.png",
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
        icon: "/src/assets/Icons/Placements.png",
        domain: "lms",
        children: [
          { type: "link", label: "Progress Overview", route: "/academic-tracker/progress-overview", domain: "lms", access: "B" },
          { type: "link", label: "Academic Insights", route: "/academic-tracker/academic-insights", domain: "lms", access: "B" },
          { type: "link", label: "Unified Insights", route: "/academic-tracker/unified-insights", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Helpdesk",
        icon: "/src/assets/Icons/SearchIcon.png",
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
    icon: "/src/assets/Icons/Events.png",
    items: [
      {
        type: "link",
        label: "Discover",
        route: "/events",
        icon: "/src/assets/Icons/Events.png",
        domain: "campus",
        access: "B",
      },
      {
        type: "group",
        label: "My Participation",
        icon: "/src/assets/Icons/Dashboard.png",
        domain: "campus",
        children: [
          { type: "link", label: "My Activity", route: "/events/my-activity", domain: "campus", access: "A" },
          { type: "link", label: "My Teams", route: "/events/my-teams", domain: "campus", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Organize & Manage",
        icon: "/src/assets/Icons/Menu-icon.png",
        domain: "mixed",
        children: [
          { type: "link", label: "Create Event", route: "/events/create", domain: "campus", access: "A" },
          { type: "link", label: "My Created Events", route: "/events/my-created", domain: "campus", access: "A" },
          { type: "link", label: "Event Attendance", route: "/events/attendance", domain: "erp", access: "A" },
        ],
      },
    ],
  },

  {
    section: "LEARNING MANAGEMENT",
    icon: "/src/assets/Icons/Library.png",
    items: [
      {
        type: "group",
        label: "Discover",
        icon: "/src/assets/Icons/Library.png",
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
        icon: "/src/assets/Icons/Classroom.png",
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
        icon: "/src/assets/Icons/Dashboard.png",
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
        icon: "/src/assets/Icons/NotificationIcon.png",
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
    icon: "/src/assets/Icons/Placements.png",
    items: [
      {
        type: "link",
        label: "Career Home",
        route: "/career",
        icon: "/src/assets/Icons/Placements.png",
        domain: "career",
        access: "B",
      },
      {
        type: "group",
        label: "Opportunities",
        icon: "/src/assets/Icons/Placements.png",
        domain: "career",
        children: [
          { type: "link", label: "Jobs", route: "/career/jobs", domain: "career", access: "B" },
          { type: "link", label: "Internships", route: "/career/internships", domain: "career", access: "B" },
          { type: "link", label: "Hackathons", route: "/career/hackathons", domain: "career", access: "B" },
          { type: "link", label: "Competitions", route: "/career/competitions", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "My Activity",
        icon: "/src/assets/Icons/Dashboard.png",
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
        icon: "/src/assets/Icons/ProfileIcon.svg",
        domain: "career",
        children: [
          { type: "link", label: "Career Profile", route: "/career/me/profile", domain: "career", access: "B" },
          { type: "link", label: "Skill Gap Analysis", route: "/career/me/skill-gap", domain: "career", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Networking",
        icon: "/src/assets/Icons/Events.png",
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
    icon: "/src/assets/Icons/NotificationIcon.png",
    route: "/notifications",
    domain: "erp",
  },
  {
    label: "Settings",
    icon: "/src/assets/Icons/Settings.png",
    route: "/settings",
    domain: "erp",
  },
  {
    label: "Logout",
    icon: "/src/assets/Icons/Logout.png",
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
