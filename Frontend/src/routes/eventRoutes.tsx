import type React from "react";
import { useParams } from "react-router-dom";
import ProtectedPage from "../components/ProtectedPage";
import { RequireCompetitionAccess } from "../components/competition/CompetitionAccessGuard";
import { EventProvider } from "../contexts/EventContext";
import CreateEventPage from "../pages/Events/CreateEventPage";
import EvaluationPage from "../pages/Events/EvaluationPage";
import EventAttendance from "../pages/Events/EventAttendance";
import EventDetailPageNew from "../pages/Events/EventDetailPageNew";
import {
  CertificateClaimPage,
  CertificateTemplatePage,
  MyTeamsPage,
  RegistrationFlowPage,
  RolesPage,
  TeamDetailPage,
  TeamFormationPage,
} from "../pages/Events/EventWorkflowPages";
import EventsListingPage from "../pages/Events/EventsListingPage";
import LeaderboardPage from "../pages/Events/LeaderboardPage";
import MyActivityPage from "../pages/Events/MyActivityPage";
import MyCreatedEventsPage from "../pages/Events/MyCreatedEventsPage";
import MyResultsPage from "../pages/Events/MyResultsPage";
import NotificationsPage from "../pages/Events/NotificationsPage";
import OrganizerDashboard from "../pages/Events/OrganizerDashboard";
import ShortlistPage from "../pages/Events/ShortlistPage";
import SubmissionListPage from "../pages/Events/SubmissionListPage";
import SubmissionPage from "../pages/Events/SubmissionPage";

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
].map((route) => ({
  ...route,
  element: <ProtectedPage>{route.element}</ProtectedPage>,
}));
