import type React from "react";
import AdminOnlyPage from "../components/AdminOnlyPage";
import ProtectedPage from "../components/ProtectedPage";
import type { PageBlueprint } from "../config/erpBlueprints";
import { isPageVisible, PAGE_BLUEPRINTS, isPlaceholderBlueprint } from "../config/erpBlueprints";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";

const AdminCampusFeedbackPage = lazy(() => import("../pages/Admin/AdminCampusFeedbackPage"));
const AdminCareerAlumniPage = lazy(() => import("../pages/Admin/AdminCareerAlumniPage"));
const AdminCareerInterviewsPage = lazy(() => import("../pages/Admin/AdminCareerInterviewsPage"));
const AdminCareerOpportunitiesPage = lazy(() => import("../pages/Admin/AdminCareerOpportunitiesPage"));
const AdminCertTemplatesPage = lazy(() => import("../pages/Admin/AdminCertTemplatesPage"));
const AdminCompanionAnalyticsPage = lazy(() => import("../pages/Admin/AdminCompanionAnalyticsPage"));
const AdminAuditLogsPage = lazy(() => import("../pages/Admin/AdminAuditLogsPage"));
const AdminContentManagementPage = lazy(() => import("../pages/Admin/AdminContentManagementPage"));
const AdminDeptPerformancePage = lazy(() => import("../pages/Admin/AdminDeptPerformancePage"));
const AdminEventApprovalsPage = lazy(() => import("../pages/Admin/AdminEventApprovalsPage"));
const AdminEventsManagementPage = lazy(() => import("../pages/Admin/AdminEventsManagementPage"));
const AdminHelpdeskFaqsPage = lazy(() => import("../pages/Admin/AdminHelpdeskFaqsPage"));
const AdminHelpdeskTicketsPage = lazy(() => import("../pages/Admin/AdminHelpdeskTicketsPage"));
const AdminLmsModerationPage = lazy(() => import("../pages/Admin/AdminLmsModerationPage"));
const AdminSystemControlsPage = lazy(() => import("../pages/Admin/AdminSystemControlsPage"));
const AcademicHubPage = lazy(() => import("../pages/AcademicTracker/AcademicHubPage"));
const AcademicProgressPage = lazy(() => import("../pages/AcademicTracker/AcademicProgressPage"));
const AcademicPlannerPage = lazy(() => import("../pages/AcademicTracker/AcademicPlannerPage"));
const AcademicAdvisingPage = lazy(() => import("../pages/AcademicTracker/AcademicAdvisingPage"));
const AlumniConnect = lazy(() => import("../pages/CareerPortal/AlumniConnect"));
const HostelRegistrationPage = lazy(() => import("../pages/ERP/HostelRegistrationPage"));
const TransportRegistrationPage = lazy(() => import("../pages/ERP/TransportRegistrationPage"));
const ApplicationTrackerPage = lazy(() => import("../pages/CareerPortal/ApplicationTrackerPage"));
const BookmarksPage = lazy(() => import("../pages/CareerPortal/BookmarksPage"));
const CareerHomePage = lazy(() => import("../pages/CareerPortal/CareerHomePage"));
const InterviewBooking = lazy(() => import("../pages/CareerPortal/InterviewBooking"));
const OpportunitiesPage = lazy(() => import("../pages/CareerPortal/OpportunitiesPage"));
const OpportunityDetailPage = lazy(() => import("../pages/CareerPortal/OpportunityDetailPage"));
const SkillGapPage = lazy(() => import("../pages/CareerPortal/SkillGapPage"));
const SubmitOpportunityPage = lazy(() => import("../pages/CareerPortal/SubmitOpportunityPage"));
const ProfessionalProfilePage = lazy(() => import("../pages/CareerPortal/ProfessionalProfilePage"));
const AttendanceDetailsPage = lazy(() => import("../pages/ERP/AttendanceDetailsPage"));
const VacantRoomsPage = lazy(() => import("../pages/ERP/VacantRoomsPage"));
const BankDetailsPage = lazy(() => import("../pages/ERP/BankDetailsPage"));
const CurriculumPage = lazy(() => import("../pages/ERP/CurriculumPage"));
const DocumentErpPage = lazy(() => import("../pages/ERP/DocumentErpPage"));
const RegistrationErpPage = lazy(() => import("../pages/ERP/RegistrationErpPage"));
const FaqsPage = lazy(() => import("../pages/ERP/FaqsPage"));
const FeeDuesPage = lazy(() => import("../pages/ERP/FeeDuesPage"));
const FeePaidPage = lazy(() => import("../pages/ERP/FeePaidPage"));
const RefundChangePage = lazy(() => import("../pages/ERP/RefundChangePage"));
const ResultsCurrentPage = lazy(() => import("../pages/ERP/ResultsCurrentPage"));
const ResultsEarlierPage = lazy(() => import("../pages/ERP/ResultsEarlierPage"));
const RoomDetailsPage = lazy(() => import("../pages/ERP/RoomDetailsPage"));
const SapScholarshipsPage = lazy(() => import("../pages/ERP/SapScholarshipsPage"));
const TimetablePage = lazy(() => import("../pages/ERP/TimetablePage"));
const EventsFeedback = lazy(() => import("../pages/Feedback/EventsFeedback"));
const HostelMessFeedback = lazy(() => import("../pages/Feedback/HostelMessFeedback"));
const TransportFeedback = lazy(() => import("../pages/Feedback/TransportFeedback"));
const CourseFeedbackAssistantPage = lazy(() => import("../pages/Feedback/CourseFeedbackAssistantPage"));
const EventsRegistrationHub = lazy(() => import("../pages/Events/EventsRegistrationHub"));
const HelpdeskFAQs = lazy(() => import("../pages/Helpdesk/FAQs"));
const RaiseTicket = lazy(() => import("../pages/Helpdesk/RaiseTicket"));
const TrackEscalate = lazy(() => import("../pages/Helpdesk/TrackEscalate"));
const LearningMaterialsPage = lazy(() => import("../pages/Resources/LearningMaterialsPage"));
const BlueprintPage = lazy(() => import("../pages/Shared/BlueprintPage"));

const DOMAIN_PAGE_MAP: Record<string, React.ReactNode> = {
  "/helpdesk/raise-ticket": <RaiseTicket />,
  "/helpdesk/faqs": <HelpdeskFAQs />,
  "/helpdesk/track-escalate": <TrackEscalate />,
  "/registration/events-registration": <EventsRegistrationHub />,
  "/feedback/events-feedback": <EventsFeedback />,
  "/feedback/hostel-mess-feedback": <HostelMessFeedback />,
  "/feedback/transport-feedback": <TransportFeedback />,
  "/registration/hostel-registration": <HostelRegistrationPage blueprint={{ route: "/registration/hostel-registration", heading: "Hostel Registration", fetchKeys: ["hostel/hostel-booking-for-full-year"], renderer: "document" as PageBlueprint["renderer"], domain: "campus", sourceMode: "erp" as any, integrationState: "native" }} />,
  "/registration/transport-registration": <TransportRegistrationPage blueprint={{ route: "/registration/transport-registration", heading: "Transport Registration", fetchKeys: ["transport/transport-registration", "transport/registration-acknowledgment", "transport/transport-&-faqs"], renderer: "document" as PageBlueprint["renderer"], domain: "campus", sourceMode: "erp" as any, integrationState: "native" }} />,
  "/academic-tracker/academic-insights": <AcademicHubPage />,
  "/academic-tracker/progress": <AcademicProgressPage />,
  "/academic-tracker/planner": <AcademicPlannerPage />,
  "/academic-tracker/advising": <AcademicAdvisingPage />,
  "/career": <CareerHomePage />,
  "/career/opportunities": <OpportunitiesPage />,
  "/career/opportunities/:id": <OpportunityDetailPage />,
  "/career/hackathons": <OpportunitiesPage initialType="hackathon" />,
  "/career/internships": <OpportunitiesPage initialType="internship" />,
  "/career/jobs": <OpportunitiesPage initialType="job" />,
  "/career/competitions": <OpportunitiesPage initialType="competition" />,
  "/career/me/bookmarks": <BookmarksPage />,
  "/career/me/profile": <ProfessionalProfilePage />,
  "/career/me/resume": <ProfessionalProfilePage />,
  "/career/me/skill-gap": <SkillGapPage />,
  "/career/me/tracker": <ApplicationTrackerPage />,
  "/career/submit": <SubmitOpportunityPage />,
  "/career/alumni": <AlumniConnect />,
  "/career/interviews": <InterviewBooking />,
  "/admin/events-management": <AdminEventsManagementPage />,
  "/admin/content-management": <AdminContentManagementPage />,
  "/admin/system-controls": <AdminSystemControlsPage />,
  "/admin/campus-feedback": <AdminCampusFeedbackPage />,
  "/admin/companion-analytics": <AdminCompanionAnalyticsPage />,
  "/admin/lms-moderation": <AdminLmsModerationPage />,
  "/admin/helpdesk-tickets": <AdminHelpdeskTicketsPage />,
  "/admin/helpdesk-faqs": <AdminHelpdeskFaqsPage />,
  "/admin/career-opportunities": <AdminCareerOpportunitiesPage />,
  "/admin/career-interviews": <AdminCareerInterviewsPage />,
  "/admin/career-alumni": <AdminCareerAlumniPage />,
  "/admin/department-performance": <AdminDeptPerformancePage />,
  "/admin/event-approvals": <AdminEventApprovalsPage />,
  "/admin/audit-logs": <AdminAuditLogsPage />,
  "/admin/certificate-templates": <AdminCertTemplatesPage />,
};

export const erpRoutes = Object.values(PAGE_BLUEPRINTS)
  .filter((blueprint) =>
    isPageVisible(blueprint) &&
    blueprint.route !== "/dashboard" &&
    blueprint.route !== "/profile" &&
    !blueprint.route.startsWith("/events")
  )
  .map((blueprint) => {
    let component = <BlueprintPage blueprint={blueprint} />;

    // A placeholder must always win over an older bespoke route. Otherwise a
    // hidden, unavailable task can still render a misleading legacy screen.
    if (isPlaceholderBlueprint(blueprint)) {
      component = <BlueprintPage blueprint={blueprint} />;
    } else if (DOMAIN_PAGE_MAP[blueprint.route]) {
      component = <>{DOMAIN_PAGE_MAP[blueprint.route]}</>;
    } else if (blueprint.route === "/feedback/course-feedback") {
      component = <CourseFeedbackAssistantPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/learning-materials") {
      component = <LearningMaterialsPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/advanced-access") {
      component = <LearningMaterialsPage blueprint={blueprint} advanced />;
    } else if (blueprint.renderer === "attendance") {
      component = <AttendanceDetailsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "vacant-rooms") {
      component = <VacantRoomsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "timetable") {
      component = <TimetablePage blueprint={blueprint} />;
    } else if (blueprint.renderer === "curriculum") {
      component = <CurriculumPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "results-current") {
      component = <ResultsCurrentPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "results-earlier") {
      component = <ResultsEarlierPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "finance-dues") {
      component = <FeeDuesPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "finance-paid") {
      component = <FeePaidPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "bank-details") {
      component = <BankDetailsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "room-details") {
      component = <RoomDetailsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "sap-scholarships") {
      component = <SapScholarshipsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "faqs") {
      component = <FaqsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "refund-change") {
      component = <RefundChangePage blueprint={blueprint} />;
    } else if (blueprint.renderer === "document" && blueprint.route.startsWith("/registration/")) {
      component = <RegistrationErpPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "document") {
      component = <DocumentErpPage blueprint={blueprint} />;
    } else if (
      blueprint.sourceMode !== "erp" ||
      blueprint.fetchKeys.length === 0
    ) {
      component = <BlueprintPage blueprint={blueprint} />;
    }

    const routeElement = blueprint.route.startsWith("/admin/")
      ? <AdminOnlyPage>{component}</AdminOnlyPage>
      : component;

    return {
      path: blueprint.route,
      element: <ProtectedPage><SuspenseWrapper>{routeElement}</SuspenseWrapper></ProtectedPage>,
    };
  });
