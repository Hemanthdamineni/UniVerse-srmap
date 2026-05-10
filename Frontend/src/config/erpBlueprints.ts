export type AccessType = "B" | "A";

export type Domain = "erp" | "lms" | "career" | "campus" | "admin";
export type SidebarDomain = Domain | "mixed";
export type PageSourceMode = "erp" | "internal" | "external";
export type IntegrationState = "native" | "adapter" | "summary" | "placeholder";

export type PageRenderer =
  | "dashboard"
  | "timetable"
  | "attendance"
  | "curriculum"
  | "results-current"
  | "results-earlier"
  | "finance-dues"
  | "finance-paid"
  | "profile"
  | "announcements"
  | "generic";

interface PageBlueprintBase {
  route: string;
  heading: string;
  fetchKeys: string[];
  domain: Domain;
  renderer: PageRenderer;
  loadingMessage?: string;
  placeholderReason?: string;
  includeSessionProfile?: boolean;
}

export type ActivePageBlueprint =
  | (PageBlueprintBase & {
      integrationState: "native";
      sourceMode: "erp" | "internal";
    })
  | (PageBlueprintBase & {
      integrationState: "adapter";
      sourceMode: "erp" | "external";
    })
  | (PageBlueprintBase & {
      integrationState: "summary";
      sourceMode: "erp" | "external";
    });

export type PlaceholderPageBlueprint = Omit<PageBlueprintBase, "fetchKeys"> & {
  fetchKeys: [];
  integrationState: "placeholder";
  placeholderReason: string;
  sourceMode?: never;
};

export type PageBlueprint = ActivePageBlueprint | PlaceholderPageBlueprint;

export interface SidebarSubItem {
  label: string;
  route: string;
  type: AccessType;
  domain: Domain;
}

export interface SidebarLeafItem {
  label: string;
  icon: string;
  domain: Domain;
  type?: AccessType;
  route: string;
  submenu?: never;
}

export interface SidebarGroupItem {
  label: string;
  icon: string;
  domain: SidebarDomain;
  route?: never;
  type?: never;
  submenu: SidebarSubItem[];
}

export type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export interface NavLinkItem {
  type: "link";
  label: string;
  route: string;
  icon?: string;
  domain: Domain;
  access?: AccessType;
}

export interface NavGroupItem {
  type: "group";
  label: string;
  icon?: string;
  domain?: SidebarDomain;
  children: NavLinkItem[];
}

export type NavItem = NavLinkItem | NavGroupItem;

export interface NavSection {
  section: string;
  icon: string;
  items: NavItem[];
}

export function isPlaceholderBlueprint(blueprint: PageBlueprint): blueprint is PlaceholderPageBlueprint {
  return blueprint.integrationState === "placeholder";
}

const KNOWN_DOMAINS = new Set<Domain>(["erp", "lms", "career", "campus", "admin"]);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[erpBlueprints] ${message}`);
  }
}

function assertKnownDomain(domain: string, context: string): asserts domain is Domain {
  invariant(KNOWN_DOMAINS.has(domain as Domain), `${context} must use a supported domain, received "${domain}".`);
}

function validateBlueprints(pageBlueprints: Record<string, PageBlueprint>) {
  for (const [pageKey, blueprint] of Object.entries(pageBlueprints)) {
    invariant(pageKey === blueprint.route, `Blueprint key "${pageKey}" must match route "${blueprint.route}".`);
    assertKnownDomain(blueprint.domain, `Blueprint "${blueprint.route}" domain`);

    if (isPlaceholderBlueprint(blueprint)) {
      invariant(blueprint.fetchKeys.length === 0, `Placeholder page "${blueprint.route}" must have empty fetchKeys.`);
      invariant(
        Boolean(blueprint.placeholderReason.trim()),
        `Placeholder page "${blueprint.route}" must define a placeholderReason.`
      );
      invariant(
        !("sourceMode" in blueprint) || blueprint.sourceMode === undefined,
        `Placeholder page "${blueprint.route}" must omit sourceMode.`
      );
      continue;
    }

    invariant(Boolean(blueprint.sourceMode), `Non-placeholder page "${blueprint.route}" must define sourceMode.`);

    if (blueprint.integrationState === "native") {
      invariant(
        blueprint.sourceMode === "internal" || blueprint.sourceMode === "erp",
        `Native page "${blueprint.route}" cannot use sourceMode "${blueprint.sourceMode}".`
      );
    }

    if (blueprint.integrationState === "adapter" || blueprint.integrationState === "summary") {
      invariant(
        blueprint.sourceMode === "external" || blueprint.sourceMode === "erp",
        `${blueprint.integrationState} page "${blueprint.route}" cannot use sourceMode "${blueprint.sourceMode}".`
      );
    }
  }
}

function validateNavItems(
  items: SidebarItem[],
  pageBlueprints: Record<string, PageBlueprint>,
  collectionName: string
) {
  for (const item of items) {
    if ("submenu" in item && item.submenu) {
      const childDomains = new Set<Domain>();

      for (const subItem of item.submenu) {
        assertKnownDomain(subItem.domain, `${collectionName} > ${item.label} > ${subItem.label}`);
        childDomains.add(subItem.domain);

        const linkedBlueprint = pageBlueprints[subItem.route];
        if (linkedBlueprint) {
          invariant(
            linkedBlueprint.domain === subItem.domain,
            `${collectionName} > ${item.label} > ${subItem.label} must match blueprint domain "${linkedBlueprint.domain}".`
          );
        }
      }

      if (item.domain === "mixed") {
        invariant(
          childDomains.size > 1,
          `${collectionName} > ${item.label} can only use "mixed" when child items span multiple domains.`
        );
        continue;
      }

      assertKnownDomain(item.domain, `${collectionName} > ${item.label}`);
      for (const childDomain of childDomains) {
        invariant(
          childDomain === item.domain,
          `${collectionName} > ${item.label} must use "mixed" because child domain "${childDomain}" differs from "${item.domain}".`
        );
      }
      continue;
    }

    assertKnownDomain(item.domain, `${collectionName} > ${item.label}`);

    const linkedBlueprint = pageBlueprints[item.route];
    if (linkedBlueprint) {
      invariant(
        linkedBlueprint.domain === item.domain,
        `${collectionName} > ${item.label} must match blueprint domain "${linkedBlueprint.domain}".`
      );
    }
  }
}

function convertNavItemToSidebarItem(item: NavItem): SidebarItem {
  if (item.type === "link") {
    return {
      label: item.label,
      icon: item.icon ?? "/src/assets/Icons/Dashboard.png",
      domain: item.domain,
      route: item.route,
      type: item.access,
    };
  }

  return {
    label: item.label,
    icon: item.icon ?? "/src/assets/Icons/Dashboard.png",
    domain: item.domain ?? "mixed",
    submenu: item.children.map((child) => ({
      label: child.label,
      route: child.route,
      type: child.access ?? "B",
      domain: child.domain,
    })),
  };
}

function validateNavSections(
  sections: NavSection[],
  pageBlueprints: Record<string, PageBlueprint>,
  collectionName: string
) {
  for (const section of sections) {
    invariant(Boolean(section.section.trim()), `${collectionName} section must have a title.`);
    validateNavItems(
      section.items.map(convertNavItemToSidebarItem),
      pageBlueprints,
      `${collectionName} > ${section.section}`
    );
  }
}

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
          { type: "link", label: "Exam Essentials", route: "/exams/essentials", domain: "erp", access: "B" },
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
        label: "Transport & Hostel",
        icon: "/src/assets/Icons/Library.png",
        domain: "campus",
        children: [
          { type: "link", label: "Rooms Details", route: "/transport-hostel/room-details", domain: "campus", access: "B" },
          { type: "link", label: "Routes Details", route: "/transport-hostel/route-details", domain: "campus", access: "B" },
          { type: "link", label: "FAQs", route: "/transport-hostel/faqs", domain: "campus", access: "B" },
          { type: "link", label: "Refund & Change Requests", route: "/transport-hostel/refund-change-requests", domain: "campus", access: "A" },
          { type: "link", label: "Outing & Maintenance", route: "/transport-hostel/outing-maintenance", domain: "campus", access: "A" },
        ],
      },
      {
        type: "group",
        label: "Registration",
        icon: "/src/assets/Icons/Menu-icon.png",
        domain: "mixed",
        children: [
          { type: "link", label: "Course Registration", route: "/registration/course-registration", domain: "erp", access: "A" },
          { type: "link", label: "Minor / OE Registration", route: "/registration/minor-oe-registration", domain: "erp", access: "A" },
          { type: "link", label: "Events Registration", route: "/registration/events-registration", domain: "campus", access: "A" },
          { type: "link", label: "Exam Registration", route: "/registration/exam-registration", domain: "erp", access: "A" },
          { type: "link", label: "Hostel Registration", route: "/registration/hostel-registration", domain: "campus", access: "A" },
          { type: "link", label: "Transport Registration", route: "/registration/transport-registration", domain: "campus", access: "A" },
          { type: "link", label: "SAP Registration", route: "/registration/sap-registration", domain: "erp", access: "A" },
          { type: "link", label: "Registration Tracker", route: "/registration/registration-tracker", domain: "erp", access: "A" },
        ],
      },
    ],
  },
  {
    section: "COMPETITION PLATFORM",
    icon: "/src/assets/Icons/Events.png",
    items: [
      {
        type: "group",
        label: "Discover",
        icon: "/src/assets/Icons/Events.png",
        domain: "campus",
        children: [
          { type: "link", label: "Explore Events", route: "/events", domain: "campus", access: "B" },
          { type: "link", label: "Notifications", route: "/events/notifications", domain: "campus", access: "B" },
        ],
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
    section: "CAMPUS SERVICES",
    icon: "/src/assets/Icons/Events.png",
    items: [
      {
        type: "group",
        label: "Academic Tracker",
        icon: "/src/assets/Icons/Placements.png",
        domain: "lms",
        children: [
          { type: "link", label: "Progress Overview", route: "/academic-tracker/progress-overview", domain: "lms", access: "B" },
          { type: "link", label: "Academic Insights", route: "/academic-tracker/academic-insights", domain: "lms", access: "B" },
        ],
      },
      {
        type: "group",
        label: "Feedback",
        icon: "/src/assets/Icons/NotificationIcon.png",
        domain: "mixed",
        children: [
          { type: "link", label: "Course Feedback", route: "/feedback/course-feedback", domain: "erp", access: "A" },
          { type: "link", label: "Events Feedback", route: "/feedback/events-feedback", domain: "campus", access: "A" },
          { type: "link", label: "Hostel & Mess Feedback", route: "/feedback/hostel-mess-feedback", domain: "campus", access: "A" },
          { type: "link", label: "Transport Feedback", route: "/feedback/transport-feedback", domain: "campus", access: "A" },
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
    ],
  },
  {
    section: "SUPPORT",
    icon: "/src/assets/Icons/SearchIcon.png",
    items: [
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

export const PAGE_BLUEPRINTS: Record<string, PageBlueprint> = {
  "/dashboard": {
    route: "/dashboard",
    heading: "Dashboard",
    fetchKeys: ["dashboard"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "dashboard",
    loadingMessage: "Loading dashboard...",
  },

  "/academic/timetable": {
    route: "/academic/timetable",
    heading: "Time Table",
    fetchKeys: ["academic/time-table"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "timetable",
    loadingMessage: "Loading time table...",
  },
  "/academic/attendance-details": {
    route: "/academic/attendance-details",
    heading: "Attendance Details",
    fetchKeys: [
      "academic/attendance-details",
      "academic/od-ml-details",
      "academic/student-attendance",
    ],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "attendance",
    loadingMessage: "Loading attendance details...",
  },
  "/academic/curriculum": {
    route: "/academic/curriculum",
    heading: "Curriculum",
    fetchKeys: ["academic/student-wise-subjects"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "curriculum",
    loadingMessage: "Loading curriculum...",
  },
  "/academic/sap-scholarships": {
    route: "/academic/sap-scholarships",
    heading: "SAP & Scholarships",
    fetchKeys: ["sap/attachments", "sap/details"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading SAP and scholarship details...",
  },

  "/exams/current-semester-results": {
    route: "/exams/current-semester-results",
    heading: "Current Semester Results",
    fetchKeys: [
      "examination/current-semester-results",
      "examination/internal-mark-details",
      "academic/course-registration",
      "academic/student-wise-subjects",
      "academic/cgpa-summary",
    ],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "results-current",
    loadingMessage: "Loading current semester results...",
  },
  "/exams/earlier-semester-results": {
    route: "/exams/earlier-semester-results",
    heading: "Earlier Semester Results",
    fetchKeys: ["examination/earlier-internal-marks", "examination/exam-mark-details"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "results-earlier",
    loadingMessage: "Loading earlier semester results...",
  },
  "/exams/essentials": {
    route: "/exams/essentials",
    heading: "Exam Essentials",
    fetchKeys: ["exams/essentials"],
    domain: "erp",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading exam essentials...",
  },

  "/finance/fee-dues": {
    route: "/finance/fee-dues",
    heading: "Fees Dues",
    fetchKeys: ["finance/fee-due-details"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "finance-dues",
    loadingMessage: "Loading fee dues...",
  },
  "/finance/fee-paid": {
    route: "/finance/fee-paid",
    heading: "Fees Paid",
    fetchKeys: [
      "finance/fee-paid-details",
      "finance/payment-acknowledgment",
      "finance/online-payment-verification",
    ],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "finance-paid",
    loadingMessage: "Loading paid fees...",
  },
  "/finance/bank-details": {
    route: "/finance/bank-details",
    heading: "Bank Details",
    fetchKeys: ["finance/bank-account-details"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading bank details...",
  },

  "/transport-hostel/room-details": {
    route: "/transport-hostel/room-details",
    heading: "Rooms Details",
    fetchKeys: ["hostel/room-details"],
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading room details...",
  },
  "/transport-hostel/route-details": {
    route: "/transport-hostel/route-details",
    heading: "Routes Details",
    fetchKeys: [],
    domain: "campus",
    integrationState: "placeholder",
    renderer: "generic",
    placeholderReason: "No university ERP source mapped.",
  },
  "/transport-hostel/faqs": {
    route: "/transport-hostel/faqs",
    heading: "FAQs",
    fetchKeys: ["hostel/hostel-layout-&-faqs", "transport/transport-&-faqs"],
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading FAQs...",
  },
  "/transport-hostel/refund-change-requests": {
    route: "/transport-hostel/refund-change-requests",
    heading: "Refund & Change Requests",
    fetchKeys: ["hostel/hostel-refund-policy", "transport/transport-refund-policy"],
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading refund and change requests...",
  },
  "/transport-hostel/outing-maintenance": {
    route: "/transport-hostel/outing-maintenance",
    heading: "Outing & Maintenance",
    fetchKeys: [],
    domain: "campus",
    integrationState: "placeholder",
    renderer: "generic",
    placeholderReason: "No university ERP source mapped.",
  },

  "/registration/course-registration": {
    route: "/registration/course-registration",
    heading: "Course Registration",
    fetchKeys: ["academic/course-registration", "academic/course-registration-cancellation"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading course registration...",
  },
  "/registration/minor-oe-registration": {
    route: "/registration/minor-oe-registration",
    heading: "Minor / OE Registration",
    fetchKeys: ["academic/minor-program-registration"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading minor/OE registration...",
  },
  "/registration/events-registration": {
    route: "/registration/events-registration",
    heading: "Events Registration",
    fetchKeys: ["registration/events-registration"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading events registration...",
  },
  "/registration/exam-registration": {
    route: "/registration/exam-registration",
    heading: "Exam Registration",
    fetchKeys: ["examination/exam-registration", "examination/exam-registration-details"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading exam registration...",
  },
  "/registration/hostel-registration": {
    route: "/registration/hostel-registration",
    heading: "Hostel Registration",
    fetchKeys: ["hostel/hostel-booking-for-full-year"],
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading hostel registration...",
  },
  "/registration/transport-registration": {
    route: "/registration/transport-registration",
    heading: "Transport Registration",
    fetchKeys: ["transport/transport-registration", "transport/registration-acknowledgment"],
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading transport registration...",
  },
  "/registration/sap-registration": {
    route: "/registration/sap-registration",
    heading: "SAP Registration",
    fetchKeys: ["sap/sap-process", "sap/withdraw"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading SAP registration...",
  },
  "/registration/registration-tracker": {
    route: "/registration/registration-tracker",
    heading: "Registration Tracker",
    fetchKeys: [],
    domain: "erp",
    integrationState: "placeholder",
    renderer: "generic",
    placeholderReason: "No university ERP source mapped.",
  },

  "/events/attendance": {
    route: "/events/attendance",
    heading: "Event Attendance",
    fetchKeys: ["events/event-attendance"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading event attendance...",
  },
  "/events": {
    route: "/events",
    heading: "Explore Events",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading events...",
  },
  "/events/:eventId": {
    route: "/events/:eventId",
    heading: "Event Details",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading event...",
  },
  "/events/my-activity": {
    route: "/events/my-activity",
    heading: "My Activity",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading activity...",
  },
  "/events/my-created": {
    route: "/events/my-created",
    heading: "My Created Events",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading created events...",
  },
  "/events/create": {
    route: "/events/create",
    heading: "Create Event",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading event builder...",
  },
  "/events/notifications": {
    route: "/events/notifications",
    heading: "Notifications",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading notifications...",
  },
  "/events/my-teams": {
    route: "/events/my-teams",
    heading: "My Teams",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading teams...",
  },
  "/events/:eventId/register": {
    route: "/events/:eventId/register",
    heading: "Register for Event",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading registration...",
  },
  "/events/:eventId/teams/create": {
    route: "/events/:eventId/teams/create",
    heading: "Create Team",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading team creation...",
  },
  "/events/:eventId/teams/:teamId": {
    route: "/events/:eventId/teams/:teamId",
    heading: "Team Details",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading team...",
  },
  "/events/:eventId/certificate/:roundId": {
    route: "/events/:eventId/certificate/:roundId",
    heading: "Claim Certificate",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading certificate...",
  },
  "/events/:eventId/leaderboard/:roundId": {
    route: "/events/:eventId/leaderboard/:roundId",
    heading: "Leaderboard",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading leaderboard...",
  },
  "/events/:eventId/manage/roles": {
    route: "/events/:eventId/manage/roles",
    heading: "Manage Roles",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading roles...",
  },
  "/events/:eventId/manage/certificate": {
    route: "/events/:eventId/manage/certificate",
    heading: "Certificate Template",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading certificate template...",
  },
  "/events/:eventId/submit/:roundId": {
    route: "/events/:eventId/submit/:roundId",
    heading: "Submit Your Work",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading round details...",
  },
  "/events/:eventId/my-results/:roundId": {
    route: "/events/:eventId/my-results/:roundId",
    heading: "Your Results",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading your results...",
  },
  "/events/:eventId/manage": {
    route: "/events/:eventId/manage",
    heading: "Manage Competition",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading competition data...",
  },
  "/events/:eventId/manage/rounds/:roundId/submissions": {
    route: "/events/:eventId/manage/rounds/:roundId/submissions",
    heading: "Submissions",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading submissions...",
  },
  "/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate": {
    route: "/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate",
    heading: "Evaluate Submission",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading submission...",
  },
  "/events/:eventId/manage/rounds/:roundId/shortlist": {
    route: "/events/:eventId/manage/rounds/:roundId/shortlist",
    heading: "Shortlist & Publish",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading evaluation data...",
  },
  "/feedback/course-feedback": {
    route: "/feedback/course-feedback",
    heading: "Course Feedback",
    fetchKeys: ["feedback/end-semester-feedback"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading course feedback...",
  },
  "/feedback/events-feedback": {
    route: "/feedback/events-feedback",
    heading: "Events Feedback",
    fetchKeys: ["feedback/events-feedback"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading events feedback...",
  },
  "/feedback/hostel-mess-feedback": {
    route: "/feedback/hostel-mess-feedback",
    heading: "Hostel & Mess Feedback",
    fetchKeys: ["feedback/hostel-mess-feedback"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading hostel and mess feedback...",
  },
  "/feedback/transport-feedback": {
    route: "/feedback/transport-feedback",
    heading: "Transport Feedback",
    fetchKeys: ["feedback/transport-feedback"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading transport feedback...",
  },

  "/resources/learning-materials": {
    route: "/resources/learning-materials",
    heading: "Learning Materials",
    fetchKeys: ["resources/learning-materials"],
    domain: "lms",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading learning materials...",
  },
  "/resources/advanced-access": {
    route: "/resources/advanced-access",
    heading: "Advanced Access",
    fetchKeys: ["resources/advanced-access"],
    domain: "lms",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading advanced access...",
  },

  "/academic-tracker/progress-overview": {
    route: "/academic-tracker/progress-overview",
    heading: "Progress Overview",
    fetchKeys: ["academic-tracker/progress-overview"],
    domain: "lms",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading progress overview...",
  },
  "/academic-tracker/academic-insights": {
    route: "/academic-tracker/academic-insights",
    heading: "Academic Insights",
    fetchKeys: ["academic-tracker/academic-insights"],
    domain: "lms",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading academic insights...",
  },

  "/career": {
    route: "/career",
    heading: "Career Portal",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Opening Career Portal...",
  },
  "/career/opportunities": {
    route: "/career/opportunities",
    heading: "All Opportunities",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Searching opportunities...",
  },
  "/career/jobs": {
    route: "/career/jobs",
    heading: "Job Opportunities",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Searching jobs...",
  },
  "/career/internships": {
    route: "/career/internships",
    heading: "Internships",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Searching internships...",
  },
  "/career/hackathons": {
    route: "/career/hackathons",
    heading: "Hackathons",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Searching hackathons...",
  },
  "/career/competitions": {
    route: "/career/competitions",
    heading: "Competitions",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Searching competitions...",
  },
  "/career/me/bookmarks": {
    route: "/career/me/bookmarks",
    heading: "My Bookmarks",
    fetchKeys: ["career/opportunities"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading bookmarks...",
  },
  "/career/me/profile": {
    route: "/career/me/profile",
    heading: "Career Profile",
    fetchKeys: ["career/profile"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading profile...",
  },
  "/career/me/skill-gap": {
    route: "/career/me/skill-gap",
    heading: "Skill Gap Analysis",
    fetchKeys: ["career/profile/skill-gaps"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Analyzing skill gaps...",
  },
  "/career/me/tracker": {
    route: "/career/me/tracker",
    heading: "Application Tracker",
    fetchKeys: ["career/applications"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading application tracker...",
  },
  "/career/submit": {
    route: "/career/submit",
    heading: "Submit Opportunity",
    fetchKeys: [],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Opening submission form...",
  },
  "/career/opportunities/:id": {
    route: "/career/opportunities/:id",
    heading: "Opportunity Details",
    fetchKeys: ["career/opportunities/:id"],
    domain: "career",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading details...",
  },

  "/helpdesk/raise-ticket": {
    route: "/helpdesk/raise-ticket",
    heading: "Raise a Ticket",
    fetchKeys: ["helpdesk/raise-ticket"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading ticket desk...",
  },
  "/helpdesk/faqs": {
    route: "/helpdesk/faqs",
    heading: "FAQs",
    fetchKeys: ["helpdesk/faqs"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading helpdesk FAQs...",
  },
  "/helpdesk/track-escalate": {
    route: "/helpdesk/track-escalate",
    heading: "Track & Escalate",
    fetchKeys: ["helpdesk/track-escalate"],
    domain: "campus",
    sourceMode: "external",
    integrationState: "summary",
    renderer: "generic",
    loadingMessage: "Loading escalations...",
  },

  "/notifications": {
    route: "/notifications",
    heading: "Notifications",
    fetchKeys: ["announcements"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "announcements",
    loadingMessage: "Loading notifications...",
  },
  "/settings": {
    route: "/settings",
    heading: "Settings",
    fetchKeys: ["verification/mobile-no-verification"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading settings...",
  },
  "/profile": {
    route: "/profile",
    heading: "Profile",
    fetchKeys: ["profile", "verification/mobile-no-verification"],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "profile",
    includeSessionProfile: true,
    loadingMessage: "Loading profile...",
  },
  "/admin/events-management": {
    route: "/admin/events-management",
    heading: "Admin Events Management",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading events management...",
  },
  "/admin/content-management": {
    route: "/admin/content-management",
    heading: "Admin Content Management",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading content management...",
  },
  "/admin/system-controls": {
    route: "/admin/system-controls",
    heading: "Admin System Controls",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading system controls...",
  },
  "/admin/helpdesk-tickets": {
    route: "/admin/helpdesk-tickets",
    heading: "Admin Helpdesk Tickets",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading helpdesk tickets...",
  },
  "/admin/helpdesk-faqs": {
    route: "/admin/helpdesk-faqs",
    heading: "Admin Helpdesk FAQs",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading helpdesk FAQs...",
  },
  "/admin/career-opportunities": {
    route: "/admin/career-opportunities",
    heading: "Admin Career Opportunities",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading career opportunities...",
  },
  "/admin/career-interviews": {
    route: "/admin/career-interviews",
    heading: "Admin Career Interviews",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading career interviews...",
  },
  "/admin/career-alumni": {
    route: "/admin/career-alumni",
    heading: "Admin Career Alumni",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading alumni management...",
  },
  "/admin/department-performance": {
    route: "/admin/department-performance",
    heading: "Department Performance",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading department performance...",
  },
  "/admin/event-approvals": {
    route: "/admin/event-approvals",
    heading: "Event Approvals",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading event approvals...",
  },
  "/admin/audit-logs": {
    route: "/admin/audit-logs",
    heading: "System Audit Logs",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading audit logs...",
  },
  "/admin/certificate-templates": {
    route: "/admin/certificate-templates",
    heading: "Certificate Templates",
    fetchKeys: [],
    domain: "admin",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading certificate templates...",
  },
};

export const DASHBOARD_QUICK_LINKS = [
  { label: "Time Table", route: "/academic/timetable" },
  { label: "Attendance", route: "/academic/attendance-details" },
  { label: "Current Results", route: "/exams/current-semester-results" },
  { label: "Fees Paid", route: "/finance/fee-paid" },
  { label: "Notifications", route: "/notifications" },
] as const;

validateBlueprints(PAGE_BLUEPRINTS);
validateNavSections(MAIN_NAV, PAGE_BLUEPRINTS, "MAIN_NAV");
validateNavItems(BOTTOM_NAV, PAGE_BLUEPRINTS, "BOTTOM_NAV");

for (const quickLink of DASHBOARD_QUICK_LINKS) {
  invariant(
    Boolean(PAGE_BLUEPRINTS[quickLink.route]),
    `Dashboard quick link "${quickLink.label}" must point to a defined page blueprint.`
  );
}
