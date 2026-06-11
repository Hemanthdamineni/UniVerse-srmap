import ProtectedPage from "../components/ProtectedPage";
import { lazy } from "react";
import { SuspenseWrapper } from "../components/SuspenseWrapper";

const AddResourcePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.AddResourcePage })));
const BrowsePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.BrowsePage })));
const CollectionsPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.CollectionsPage })));
const ContributorProfilePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.ContributorProfilePage })));
const ExamFeedbackPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.ExamFeedbackPage })));
const ExplorePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.ExplorePage })));
const FlashcardModePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.FlashcardModePage })));
const GuideEditorPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.GuideEditorPage })));
const GuideReaderPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.GuideReaderPage })));
const GuidesListPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.GuidesListPage })));
const LmsHomePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.LmsHomePage })));
const MyContributionsPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.MyContributionsPage })));
const LmsProgressPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.ProgressPage })));
const PYQBankPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.PYQBankPage })));
const QuestionBankPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.QuestionBankPage })));
const QuizModePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.QuizModePage })));
const RequestBoardPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.RequestBoardPage })));
const ResourceDetailPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.ResourceDetailPage })));
const RevisionQueuePage = lazy(() => import("../pages/LMS").then(m => ({ default: m.RevisionQueuePage })));
const RoadmapBuilderPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.RoadmapBuilderPage })));
const RoadmapViewerPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.RoadmapViewerPage })));
const RoadmapsListPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.RoadmapsListPage })));
const SavedResourcesPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.SavedResourcesPage })));
const SubjectOverviewPage = lazy(() => import("../pages/LMS").then(m => ({ default: m.SubjectOverviewPage })));

export const lmsRoutes = [
  { path: "/resources", element: <ProtectedPage><SuspenseWrapper><LmsHomePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/browse", element: <ProtectedPage><SuspenseWrapper><BrowsePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/explore", element: <ProtectedPage><SuspenseWrapper><ExplorePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/add", element: <ProtectedPage><SuspenseWrapper><AddResourcePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/contributors/:userId", element: <ProtectedPage><SuspenseWrapper><ContributorProfilePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/:id", element: <ProtectedPage><SuspenseWrapper><ResourceDetailPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/subject/:code", element: <ProtectedPage><SuspenseWrapper><SubjectOverviewPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/subject/:code/pyq", element: <ProtectedPage><SuspenseWrapper><PYQBankPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/guides", element: <ProtectedPage><SuspenseWrapper><GuidesListPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/guides/new", element: <ProtectedPage><SuspenseWrapper><GuideEditorPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/guides/:id", element: <ProtectedPage><SuspenseWrapper><GuideReaderPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/roadmaps", element: <ProtectedPage><SuspenseWrapper><RoadmapsListPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/roadmaps/new", element: <ProtectedPage><SuspenseWrapper><RoadmapBuilderPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/roadmaps/:id", element: <ProtectedPage><SuspenseWrapper><RoadmapViewerPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/quiz/:id", element: <ProtectedPage><SuspenseWrapper><QuizModePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/flashcards/:id", element: <ProtectedPage><SuspenseWrapper><FlashcardModePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/question-bank", element: <ProtectedPage><SuspenseWrapper><QuestionBankPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/requests", element: <ProtectedPage><SuspenseWrapper><RequestBoardPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/contributions", element: <ProtectedPage><SuspenseWrapper><MyContributionsPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/bookmarks", element: <ProtectedPage><SuspenseWrapper><SavedResourcesPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/collections", element: <ProtectedPage><SuspenseWrapper><CollectionsPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/progress", element: <ProtectedPage><SuspenseWrapper><LmsProgressPage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/revision", element: <ProtectedPage><SuspenseWrapper><RevisionQueuePage /></SuspenseWrapper></ProtectedPage> },
  { path: "/resources/me/exam-feedback", element: <ProtectedPage><SuspenseWrapper><ExamFeedbackPage /></SuspenseWrapper></ProtectedPage> },
];
