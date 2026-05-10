import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter, useParams } from "react-router-dom";
import "./styles.css";
import AppProviders from "./AppProviders";
import PageLayout from "./pages/Pagelayout";
import HomePage from "./pages/Home/HomePage";
import LoginPage from "./pages/Login/LoginPage";
import ForgotPasswordPage from "./pages/Login/ForgotPasswordPage";
import Dashboard from "./pages/Dashboard/Dashboard";
import BlueprintPage from "./pages/Shared/BlueprintPage";
import MappedErpPage from "./pages/ERP/MappedErpPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import CourseFeedbackAssistantPage from "./pages/Feedback/CourseFeedbackAssistantPage";
import LearningMaterialsPage from "./pages/Resources/LearningMaterialsPage";
import { PAGE_BLUEPRINTS, isPlaceholderBlueprint } from "./config/erpBlueprints";
import ProtectedPage from "./components/ProtectedPage";
import AdminOnlyPage from "./components/AdminOnlyPage";

import AttendanceDetailsPage from "./pages/ERP/AttendanceDetailsPage";
import TimetablePage from "./pages/ERP/TimetablePage";
import CurriculumPage from "./pages/ERP/CurriculumPage";
import ResultsCurrentPage from "./pages/ERP/ResultsCurrentPage";
import ResultsEarlierPage from "./pages/ERP/ResultsEarlierPage";
import FeeDuesPage from "./pages/ERP/FeeDuesPage";
import FeePaidPage from "./pages/ERP/FeePaidPage";

/* Domain-specific pages — Campus (Events, Helpdesk, Feedback), LMS, Career */
import SubmissionPage from "./pages/Events/SubmissionPage";
import MyResultsPage from "./pages/Events/MyResultsPage";
import OrganizerDashboard from "./pages/Events/OrganizerDashboard";
import SubmissionListPage from "./pages/Events/SubmissionListPage";
import EvaluationPage from "./pages/Events/EvaluationPage";
import ShortlistPage from "./pages/Events/ShortlistPage";
import LeaderboardPage from "./pages/Events/LeaderboardPage";
import RaiseTicket from "./pages/Helpdesk/RaiseTicket";
/* Competition Platform — New Pages */
import EventsListingPage from "./pages/Events/EventsListingPage";
import CreateEventPage from "./pages/Events/CreateEventPage";
import MyActivityPage from "./pages/Events/MyActivityPage";
import MyCreatedEventsPage from "./pages/Events/MyCreatedEventsPage";
import NotificationsPage from "./pages/Events/NotificationsPage";
import EventAttendance from "./pages/Events/EventAttendance";
/* EventProvider context wrapper */
import { EventProvider } from "./contexts/EventContext";
import { RequireCompetitionAccess } from "./components/competition/CompetitionAccessGuard";
/* Rewritten EventDetailPage */
import EventDetailPageNew from "./pages/Events/EventDetailPageNew";
import {
  RegistrationFlowPage,
  TeamFormationPage,
  TeamDetailPage,
  MyTeamsPage,
  CertificateClaimPage,
  RolesPage,
  CertificateTemplatePage,
} from "./pages/Events/EventWorkflowPages";

/**
 * Thin wrapper: reads eventId from router params, provides EventContext.
 * Needed because React Router's route element can't call useParams() inline.
 */
function EventProviderWrapper({ children }: { children: React.ReactNode }) {
  const { eventId = "" } = useParams();
  return (
    <EventProvider eventId={eventId}>
      {children}
    </EventProvider>
  );
}
import HelpdeskFAQs from "./pages/Helpdesk/FAQs";
import TrackEscalate from "./pages/Helpdesk/TrackEscalate";
import EventsFeedback from "./pages/Feedback/EventsFeedback";
import HostelMessFeedback from "./pages/Feedback/HostelMessFeedback";
import TransportFeedback from "./pages/Feedback/TransportFeedback";
import ProgressOverview from "./pages/AcademicTracker/ProgressOverview";
import AcademicInsights from "./pages/AcademicTracker/AcademicInsights";
import CareerHomePage from "./pages/CareerPortal/CareerHomePage";
import OpportunitiesPage from "./pages/CareerPortal/OpportunitiesPage";
import OpportunityDetailPage from "./pages/CareerPortal/OpportunityDetailPage";
import BookmarksPage from "./pages/CareerPortal/BookmarksPage";
import CareerProfilePage from "./pages/CareerPortal/CareerProfilePage";
import SkillGapPage from "./pages/CareerPortal/SkillGapPage";
import ApplicationTrackerPage from "./pages/CareerPortal/ApplicationTrackerPage";
import SubmitOpportunityPage from "./pages/CareerPortal/SubmitOpportunityPage";
import AdminEventsManagementPage from "./pages/Admin/AdminEventsManagementPage";
import AdminContentManagementPage from "./pages/Admin/AdminContentManagementPage";
import AdminSystemControlsPage from "./pages/Admin/AdminSystemControlsPage";
import AdminHelpdeskTicketsPage from "./pages/Admin/AdminHelpdeskTicketsPage";
import AdminHelpdeskFaqsPage from "./pages/Admin/AdminHelpdeskFaqsPage";
import AdminCareerOpportunitiesPage from "./pages/Admin/AdminCareerOpportunitiesPage";
import AdminCareerInterviewsPage from "./pages/Admin/AdminCareerInterviewsPage";
import AdminCareerAlumniPage from "./pages/Admin/AdminCareerAlumniPage";
import AdminEventDetailPage from "./pages/Admin/AdminEventDetailPage";
import AdminDeptPerformancePage from "./pages/Admin/AdminDeptPerformancePage";
import AdminEventApprovalsPage from "./pages/Admin/AdminEventApprovalsPage";
import AdminAuditLogsPage from "./pages/Admin/AdminAuditLogsPage";
import AdminCertTemplatesPage from "./pages/Admin/AdminCertTemplatesPage";
import {
  AddResourcePage,
  BrowsePage,
  ExamFeedbackPage,
  ExplorePage,
  FlashcardModePage,
  GuideEditorPage,
  GuideReaderPage,
  GuidesListPage,
  LmsHomePage,
  MyContributionsPage,
  ProgressPage as LmsProgressPage,
  PYQBankPage,
  QuestionBankPage,
  QuizModePage,
  RequestBoardPage,
  ResourceDetailPage,
  RevisionQueuePage,
  RoadmapBuilderPage,
  RoadmapViewerPage,
  RoadmapsListPage,
  SavedResourcesPage,
  SubjectOverviewPage,
  CollectionsPage,
} from "./pages/LMS/LmsPagesShared";

/** Route → dedicated component map for non-ERP domain pages */
const DOMAIN_PAGE_MAP: Record<string, React.ReactNode> = {
  /* Campus — Helpdesk */
  "/helpdesk/raise-ticket": <RaiseTicket />,
  "/helpdesk/faqs": <HelpdeskFAQs />,
  "/helpdesk/track-escalate": <TrackEscalate />,
  /* Campus — Feedback */
  "/feedback/events-feedback": <EventsFeedback />,
  "/feedback/hostel-mess-feedback": <HostelMessFeedback />,
  "/feedback/transport-feedback": <TransportFeedback />,
  /* LMS — Academic Tracker */
  "/academic-tracker/progress-overview": <ProgressOverview />,
  "/academic-tracker/academic-insights": <AcademicInsights />,
  /* Career Portal */
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

const appRoutes = Object.values(PAGE_BLUEPRINTS)
  .filter((blueprint) =>
    blueprint.route !== "/dashboard" &&
    blueprint.route !== "/profile" &&
    !blueprint.route.startsWith("/events")
  )
  .map((blueprint) => {
    let Component = <MappedErpPage pageKeys={blueprint.fetchKeys} title={blueprint.heading} />;

    /* Domain-specific pages take priority */
    if (DOMAIN_PAGE_MAP[blueprint.route]) {
      Component = <>{DOMAIN_PAGE_MAP[blueprint.route]}</>;
    } else if (blueprint.route === "/feedback/course-feedback") {
      Component = <CourseFeedbackAssistantPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/learning-materials") {
      Component = <LearningMaterialsPage blueprint={blueprint} />;
    } else if (blueprint.route === "/resources/advanced-access") {
      Component = <LearningMaterialsPage blueprint={blueprint} advanced />;
    } else if (blueprint.renderer === "attendance") {
      Component = <AttendanceDetailsPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "timetable") {
      Component = <TimetablePage blueprint={blueprint} />;
    } else if (blueprint.renderer === "curriculum") {
      Component = <CurriculumPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "results-current") {
      Component = <ResultsCurrentPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "results-earlier") {
      Component = <ResultsEarlierPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "finance-dues") {
      Component = <FeeDuesPage blueprint={blueprint} />;
    } else if (blueprint.renderer === "finance-paid") {
      Component = <FeePaidPage blueprint={blueprint} />;
    } else if (
      isPlaceholderBlueprint(blueprint) ||
      blueprint.sourceMode !== "erp" ||
      blueprint.fetchKeys.length === 0
    ) {
      Component = <BlueprintPage blueprint={blueprint} />;
    }

    const routeElement = blueprint.route.startsWith("/admin/")
      ? <AdminOnlyPage>{Component}</AdminOnlyPage>
      : Component;

    return {
      path: blueprint.route,
      element: <ProtectedPage>{routeElement}</ProtectedPage>,
    };
  });

function withEventProvider(component: React.ReactNode) {
  return (
    <EventProviderWrapper>
      {component}
    </EventProviderWrapper>
  );
}

const eventRoutes = [
  { path: "/events", element: <EventsListingPage /> },
  { path: "/events/create", element: <CreateEventPage /> },
  { path: "/events/my-activity", element: <MyActivityPage /> },
  { path: "/events/my-teams", element: <MyTeamsPage /> },
  { path: "/events/my-created", element: <MyCreatedEventsPage /> },
  { path: "/events/notifications", element: <NotificationsPage /> },
  { path: "/events/attendance", element: <EventAttendance /> },
  { path: "/events/:eventId", element: withEventProvider(<EventDetailPageNew />) },
  { path: "/events/:eventId/register", element: withEventProvider(<RegistrationFlowPage />) },
  { path: "/events/:eventId/teams/create", element: withEventProvider(<TeamFormationPage />) },
  { path: "/events/:eventId/teams/:teamId", element: withEventProvider(<TeamDetailPage />) },
  { path: "/events/:eventId/submit/:roundId", element: withEventProvider(<SubmissionPage />) },
  { path: "/events/:eventId/my-results/:roundId", element: withEventProvider(<MyResultsPage />) },
  { path: "/events/:eventId/leaderboard/:roundId", element: withEventProvider(<LeaderboardPage />) },
  { path: "/events/:eventId/certificate/:roundId", element: withEventProvider(<CertificateClaimPage />) },
  {
    path: "/events/:eventId/manage",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canEdit">
        <OrganizerDashboard />
      </RequireCompetitionAccess>,
    ),
  },
  {
    path: "/events/:eventId/manage/roles",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canManageRoles">
        <RolesPage />
      </RequireCompetitionAccess>,
    ),
  },
  {
    path: "/events/:eventId/manage/certificate",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canManageRoles">
        <CertificateTemplatePage />
      </RequireCompetitionAccess>,
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/submissions",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canViewAllSubmissions">
        <SubmissionListPage />
      </RequireCompetitionAccess>,
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canEvaluate">
        <EvaluationPage />
      </RequireCompetitionAccess>,
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/shortlist",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canShortlist">
        <ShortlistPage />
      </RequireCompetitionAccess>,
    ),
  },
].map((route) => ({
  ...route,
  element: <ProtectedPage>{route.element}</ProtectedPage>,
}));

const router = createBrowserRouter([
  { path: "/", element: <PageLayout><HomePage /></PageLayout> },
  { path: "/Home", element: <Navigate to="/" replace /> },
  { path: "/login", element: <PageLayout><LoginPage /></PageLayout> },
  { path: "/forgot-password", element: <PageLayout><ForgotPasswordPage /></PageLayout> },
  { path: "/dashboard", element: <ProtectedPage><Dashboard /></ProtectedPage> },
  { path: "/profile", element: <ProtectedPage><ProfilePage /></ProtectedPage> },
  ...eventRoutes,
  { path: "/resources", element: <ProtectedPage><LmsHomePage /></ProtectedPage> },
  { path: "/resources/browse", element: <ProtectedPage><BrowsePage /></ProtectedPage> },
  { path: "/resources/explore", element: <ProtectedPage><ExplorePage /></ProtectedPage> },
  { path: "/resources/add", element: <ProtectedPage><AddResourcePage /></ProtectedPage> },
  { path: "/resources/:id", element: <ProtectedPage><ResourceDetailPage /></ProtectedPage> },
  { path: "/resources/subject/:code", element: <ProtectedPage><SubjectOverviewPage /></ProtectedPage> },
  { path: "/resources/subject/:code/pyq", element: <ProtectedPage><PYQBankPage /></ProtectedPage> },
  { path: "/resources/guides", element: <ProtectedPage><GuidesListPage /></ProtectedPage> },
  { path: "/resources/guides/new", element: <ProtectedPage><GuideEditorPage /></ProtectedPage> },
  { path: "/resources/guides/:id", element: <ProtectedPage><GuideReaderPage /></ProtectedPage> },
  { path: "/resources/roadmaps", element: <ProtectedPage><RoadmapsListPage /></ProtectedPage> },
  { path: "/resources/roadmaps/new", element: <ProtectedPage><RoadmapBuilderPage /></ProtectedPage> },
  { path: "/resources/roadmaps/:id", element: <ProtectedPage><RoadmapViewerPage /></ProtectedPage> },
  { path: "/resources/quiz/:id", element: <ProtectedPage><QuizModePage /></ProtectedPage> },
  { path: "/resources/flashcards/:id", element: <ProtectedPage><FlashcardModePage /></ProtectedPage> },
  { path: "/resources/question-bank", element: <ProtectedPage><QuestionBankPage /></ProtectedPage> },
  { path: "/resources/requests", element: <ProtectedPage><RequestBoardPage /></ProtectedPage> },
  { path: "/resources/me/contributions", element: <ProtectedPage><MyContributionsPage /></ProtectedPage> },
  { path: "/resources/me/bookmarks", element: <ProtectedPage><SavedResourcesPage /></ProtectedPage> },
  { path: "/resources/me/collections", element: <ProtectedPage><CollectionsPage /></ProtectedPage> },
  { path: "/resources/me/progress", element: <ProtectedPage><LmsProgressPage /></ProtectedPage> },
  { path: "/resources/me/revision", element: <ProtectedPage><RevisionQueuePage /></ProtectedPage> },
  { path: "/resources/me/exam-feedback", element: <ProtectedPage><ExamFeedbackPage /></ProtectedPage> },
  ...appRoutes,
  {
    path: "/admin/events-management/:eventId",
    element: (
      <ProtectedPage>
        <AdminOnlyPage>
          <EventProviderWrapper>
            <AdminEventDetailPage />
          </EventProviderWrapper>
        </AdminOnlyPage>
      </ProtectedPage>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>
);
