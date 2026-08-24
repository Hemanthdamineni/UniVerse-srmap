import ProtectedPage from "../components/ProtectedPage";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";

const AddResourcePage = lazy(() => import("../pages/LMS/AddResourcePage"));
const ContributorProfilePage = lazy(() => import("../pages/LMS/me/ContributorProfilePage"));
const ContributePage = lazy(() => import("../pages/LMS/shells/ContributePage"));
const ExamFeedbackPage = lazy(() => import("../pages/LMS/me/ExamFeedbackPage"));
const GuideEditorPage = lazy(() => import("../pages/LMS/guides/GuideEditorPage"));
const GuideReaderPage = lazy(() => import("../pages/LMS/guides/GuideReaderPage"));
const GuidesListPage = lazy(() => import("../pages/LMS/guides/GuidesListPage"));
const LmsHomePage = lazy(() => import("../pages/LMS/LmsHomePage"));
const MyLearningPage = lazy(() => import("../pages/LMS/shells/MyLearningPage"));
const PracticePage = lazy(() => import("../pages/LMS/shells/PracticePage"));
const DiscoverPage = lazy(() => import("../pages/LMS/shells/DiscoverPage"));
const ResourceDetailPage = lazy(() => import("../pages/LMS/ResourceDetailPage"));
const RoadmapBuilderPage = lazy(() => import("../pages/LMS/roadmaps/RoadmapBuilderPage"));
const RoadmapViewerPage = lazy(() => import("../pages/LMS/roadmaps/RoadmapViewerPage"));
const RoadmapsListPage = lazy(() => import("../pages/LMS/roadmaps/RoadmapsListPage"));
const RequestBoardPage = lazy(() => import("../pages/LMS/RequestBoardPage"));
const SubjectHubPage = lazy(() => import("../pages/LMS/shells/SubjectHubPage"));

export const lmsRoutes = [
  { path: "/learn", element: <ProtectedPage><SuspenseWrapper><LmsHomePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/discover", element: <ProtectedPage><SuspenseWrapper><DiscoverPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/practice", element: <ProtectedPage><SuspenseWrapper><PracticePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/me", element: <ProtectedPage><SuspenseWrapper><MyLearningPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/contribute", element: <ProtectedPage><SuspenseWrapper><ContributePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/contribute/new", element: <ProtectedPage><SuspenseWrapper><AddResourcePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/requests", element: <ProtectedPage><SuspenseWrapper><RequestBoardPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/contributors/:userId", element: <ProtectedPage><SuspenseWrapper><ContributorProfilePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/r/:id", element: <ProtectedPage><SuspenseWrapper><ResourceDetailPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/subjects/:code", element: <ProtectedPage><SuspenseWrapper><SubjectHubPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/guides", element: <ProtectedPage><SuspenseWrapper><GuidesListPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/guides/new", element: <ProtectedPage><SuspenseWrapper><GuideEditorPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/guides/:id", element: <ProtectedPage><SuspenseWrapper><GuideReaderPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/roadmaps", element: <ProtectedPage><SuspenseWrapper><RoadmapsListPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/roadmaps/new", element: <ProtectedPage><SuspenseWrapper><RoadmapBuilderPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/roadmaps/:id", element: <ProtectedPage><SuspenseWrapper><RoadmapViewerPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/learn/exam-feedback", element: <ProtectedPage><SuspenseWrapper><ExamFeedbackPage /></SuspenseWrapper></ProtectedPage> },
];
