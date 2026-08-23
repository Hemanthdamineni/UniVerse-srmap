import { PAGE_BLUEPRINTS, isPageVisible } from "../config/erpBlueprints";
import type React from "react";
import { useParams } from "react-router-dom";
import ProtectedPage from "../components/ProtectedPage";
import { RequireCompetitionAccess } from "../components/competition/CompetitionAccessGuard";
import { EventProvider } from "../contexts/EventContext";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";

const CreateEventPage = lazy(() => import("../pages/Events/CreateEventPage"));
const EvaluationPage = lazy(() => import("../pages/Events/EvaluationPage"));
const EventAttendance = lazy(() => import("../pages/Events/EventAttendance"));
const EventDetailPageNew = lazy(() => import("../pages/Events/EventDetailPageNew"));
const CertificateClaimPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.CertificateClaimPage })));
const CertificateTemplatePage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.CertificateTemplatePage })));
const MyTeamsPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.MyTeamsPage })));
const PersistentTeamPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.PersistentTeamPage })));
const RegistrationFlowPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.RegistrationFlowPage })));
const RolesPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.RolesPage })));
const TeamDetailPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.TeamDetailPage })));
const TeamFormationPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.TeamFormationPage })));
const InvitationsPage = lazy(() => import("../pages/Events/EventWorkflowPages").then(m => ({ default: m.InvitationsPage })));
const EventsListingPage = lazy(() => import("../pages/Events/EventsListingPage"));
const LeaderboardPage = lazy(() => import("../pages/Events/LeaderboardPage"));
const MyActivityPage = lazy(() => import("../pages/Events/MyActivityPage"));
const MyCreatedEventsPage = lazy(() => import("../pages/Events/MyCreatedEventsPage"));
const MyResultsPage = lazy(() => import("../pages/Events/MyResultsPage"));
const OrganizerDashboard = lazy(() => import("../pages/Events/OrganizerDashboard"));
const ShortlistPage = lazy(() => import("../pages/Events/ShortlistPage"));
const SubmissionListPage = lazy(() => import("../pages/Events/SubmissionListPage"));
const SubmissionPage = lazy(() => import("../pages/Events/SubmissionPage"));

export function EventProviderWrapper({ children }: { children: React.ReactNode }) {
  const { eventId = "" } = useParams();
  return <EventProvider eventId={eventId}>{children}</EventProvider>;
}

function withEventProvider(component: React.ReactNode) {
  return <EventProviderWrapper>{component}</EventProviderWrapper>;
}

export const eventRoutes = [
  { path: "/events", element: <EventsListingPage /> },
  { path: "/events/create", element: <CreateEventPage /> },
  { path: "/events/my-activity", element: <MyActivityPage /> },
  { path: "/events/my-teams", element: <MyTeamsPage /> },
  { path: "/events/my-created", element: <MyCreatedEventsPage /> },

  { path: "/teams/persistent/:teamId", element: <PersistentTeamPage /> },

  { path: "/events/attendance", element: <EventAttendance /> },
  { path: "/events/:eventId", element: withEventProvider(<EventDetailPageNew />) },
  { path: "/events/:eventId/register", element: withEventProvider(<RegistrationFlowPage />) },
  { path: "/events/:eventId/teams/create", element: withEventProvider(<TeamFormationPage />) },
  { path: "/events/:eventId/teams/:teamId", element: withEventProvider(<TeamDetailPage />) },
  { path: "/events/:eventId/invitations", element: withEventProvider(<InvitationsPage />) },
  { path: "/events/:eventId/submit/:roundId", element: withEventProvider(<SubmissionPage />) },
  { path: "/events/:eventId/my-results/:roundId", element: withEventProvider(<MyResultsPage />) },
  { path: "/events/:eventId/leaderboard/:roundId", element: withEventProvider(<LeaderboardPage />) },
  { path: "/events/:eventId/certificate/:roundId", element: withEventProvider(<CertificateClaimPage />) },
  {
    path: "/events/:eventId/manage",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canEdit">
        <OrganizerDashboard />
      </RequireCompetitionAccess>
    ),
  },
  {
    path: "/events/:eventId/manage/roles",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canManageRoles">
        <RolesPage />
      </RequireCompetitionAccess>
    ),
  },
  {
    path: "/events/:eventId/manage/certificate",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canManageRoles">
        <CertificateTemplatePage />
      </RequireCompetitionAccess>
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/submissions",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canViewAllSubmissions">
        <SubmissionListPage />
      </RequireCompetitionAccess>
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canEvaluate">
        <EvaluationPage />
      </RequireCompetitionAccess>
    ),
  },
  {
    path: "/events/:eventId/manage/rounds/:roundId/shortlist",
    element: withEventProvider(
      <RequireCompetitionAccess permission="canShortlist">
        <ShortlistPage />
      </RequireCompetitionAccess>
    ),
  },
].filter(route => PAGE_BLUEPRINTS[route.path] ? isPageVisible(PAGE_BLUEPRINTS[route.path]) : true).map((route) => ({
  ...route,
  element: <ProtectedPage><SuspenseWrapper>{route.element}</SuspenseWrapper></ProtectedPage>,
}));
