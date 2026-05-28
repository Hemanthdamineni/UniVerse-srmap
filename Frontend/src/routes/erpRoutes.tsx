import type React from "react";
import AdminOnlyPage from "../components/AdminOnlyPage";
import ProtectedPage from "../components/ProtectedPage";
import { PAGE_BLUEPRINTS, isPlaceholderBlueprint } from "../config/erpBlueprints";
import AdminCampusFeedbackPage from "../pages/Admin/AdminCampusFeedbackPage";
import AdminCareerAlumniPage from "../pages/Admin/AdminCareerAlumniPage";
import AdminCareerInterviewsPage from "../pages/Admin/AdminCareerInterviewsPage";
import AdminCareerOpportunitiesPage from "../pages/Admin/AdminCareerOpportunitiesPage";
import AdminCertTemplatesPage from "../pages/Admin/AdminCertTemplatesPage";
import AdminAuditLogsPage from "../pages/Admin/AdminAuditLogsPage";
import AdminContentManagementPage from "../pages/Admin/AdminContentManagementPage";
import AdminDeptPerformancePage from "../pages/Admin/AdminDeptPerformancePage";
import AdminEventApprovalsPage from "../pages/Admin/AdminEventApprovalsPage";
import AdminEventsManagementPage from "../pages/Admin/AdminEventsManagementPage";
import AdminHelpdeskFaqsPage from "../pages/Admin/AdminHelpdeskFaqsPage";
import AdminHelpdeskTicketsPage from "../pages/Admin/AdminHelpdeskTicketsPage";
import AdminLmsModerationPage from "../pages/Admin/AdminLmsModerationPage";
import AdminSystemControlsPage from "../pages/Admin/AdminSystemControlsPage";
import AcademicInsights from "../pages/AcademicTracker/AcademicInsights";
import ProgressOverview from "../pages/AcademicTracker/ProgressOverview";
import UnifiedInsights from "../pages/AcademicTracker/UnifiedInsights";
import ApplicationTrackerPage from "../pages/CareerPortal/ApplicationTrackerPage";
import BookmarksPage from "../pages/CareerPortal/BookmarksPage";
import CareerHomePage from "../pages/CareerPortal/CareerHomePage";
import CareerProfilePage from "../pages/CareerPortal/CareerProfilePage";
import OpportunitiesPage from "../pages/CareerPortal/OpportunitiesPage";
import OpportunityDetailPage from "../pages/CareerPortal/OpportunityDetailPage";
import SkillGapPage from "../pages/CareerPortal/SkillGapPage";
import SubmitOpportunityPage from "../pages/CareerPortal/SubmitOpportunityPage";
import AttendanceDetailsPage from "../pages/ERP/AttendanceDetailsPage";
import BankDetailsPage from "../pages/ERP/BankDetailsPage";
import CurriculumPage from "../pages/ERP/CurriculumPage";
import DocumentErpPage from "../pages/ERP/DocumentErpPage";
import FaqsPage from "../pages/ERP/FaqsPage";
import FeeDuesPage from "../pages/ERP/FeeDuesPage";
import FeePaidPage from "../pages/ERP/FeePaidPage";
import RefundChangePage from "../pages/ERP/RefundChangePage";
import ResultsCurrentPage from "../pages/ERP/ResultsCurrentPage";
import ResultsEarlierPage from "../pages/ERP/ResultsEarlierPage";
import RoomDetailsPage from "../pages/ERP/RoomDetailsPage";
import SapScholarshipsPage from "../pages/ERP/SapScholarshipsPage";
import TimetablePage from "../pages/ERP/TimetablePage";
import EventsFeedback from "../pages/Feedback/EventsFeedback";
import HostelMessFeedback from "../pages/Feedback/HostelMessFeedback";
import TransportFeedback from "../pages/Feedback/TransportFeedback";
import CourseFeedbackAssistantPage from "../pages/Feedback/CourseFeedbackAssistantPage";
import EventsRegistrationHub from "../pages/Events/EventsRegistrationHub";
import HelpdeskFAQs from "../pages/Helpdesk/FAQs";
import RaiseTicket from "../pages/Helpdesk/RaiseTicket";
import TrackEscalate from "../pages/Helpdesk/TrackEscalate";
import LearningMaterialsPage from "../pages/Resources/LearningMaterialsPage";
import BlueprintPage from "../pages/Shared/BlueprintPage";

const DOMAIN_PAGE_MAP: Record<string, React.ReactNode> = {
  "/helpdesk/raise-ticket": <RaiseTicket />,
  "/helpdesk/faqs": <HelpdeskFAQs />,
  "/helpdesk/track-escalate": <TrackEscalate />,
  "/registration/events-registration": <EventsRegistrationHub />,
  "/feedback/events-feedback": <EventsFeedback />,
  "/feedback/hostel-mess-feedback": <HostelMessFeedback />,
  "/feedback/transport-feedback": <TransportFeedback />,
  "/academic-tracker/progress-overview": <ProgressOverview />,
  "/academic-tracker/academic-insights": <AcademicInsights />,
  "/academic-tracker/unified-insights": <UnifiedInsights />,
  "/career": <CareerHomePage />,
  "/career/opportunities": <OpportunitiesPage />,
  "/career/opportunities/:id": <OpportunityDetailPage />,
  "/career/hackathons": <OpportunitiesPage initialType="hackathon" />,
  "/career/internships": <OpportunitiesPage initialType="internship" />,
  "/career/jobs": <OpportunitiesPage initialType="job" />,
  "/career/competitions": <OpportunitiesPage initialType="competition" />,
  "/career/me/bookmarks": <BookmarksPage />,
  "/career/me/profile": <CareerProfilePage />,
  "/career/me/skill-gap": <SkillGapPage />,
  "/career/me/tracker": <ApplicationTrackerPage />,
  "/career/submit": <SubmitOpportunityPage />,
  "/admin/events-management": <AdminEventsManagementPage />,
  "/admin/content-management": <AdminContentManagementPage />,
  "/admin/system-controls": <AdminSystemControlsPage />,
  "/admin/campus-feedback": <AdminCampusFeedbackPage />,
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
    blueprint.route !== "/dashboard" &&
    blueprint.route !== "/profile" &&
    !blueprint.route.startsWith("/events")
  )
  .map((blueprint) => {
    let component = <BlueprintPage blueprint={blueprint} />;

    if (DOMAIN_PAGE_MAP[blueprint.route]) {
      component = <>{DOMAIN_PAGE_MAP[blueprint.route]}</>;
    } else if (blueprint.route === "/feedback/course-feedback") {
      component = <CourseFeedbackAssistantPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/learning-materials") {
      component = <LearningMaterialsPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/advanced-access") {
      component = <LearningMaterialsPage blueprint={blueprint} advanced />;
    } else if (blueprint.renderer === "attendance") {
      component = <AttendanceDetailsPage blueprint={blueprint} />;
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
    } else if (blueprint.renderer === "document") {
      component = <DocumentErpPage blueprint={blueprint} />;
    } else if (
      isPlaceholderBlueprint(blueprint) ||
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
      element: <ProtectedPage>{routeElement}</ProtectedPage>,
    };
  });
