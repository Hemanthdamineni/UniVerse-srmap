import {
  useEffect,
  useMemo,
  useState,
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  SectionCard,
  InlineError,
  StatCard,
  AnnotationPanel,
  DuplicateWarning,
  ExamFeedbackCard,
  InteractiveFlashcardDeck,
  GuideSection,
  OutdatedWarning,
  QuizRunner,
  RecommendationSection,
  RequestCard,
  ResourceFilterPanel,
  ResourceGrid,
  RoadmapGraph,
  TopicMasteryHeatmap,
  WeeklyLeaderboard,
  addRoadmapNode,
  buildQuizFromQuestionBank,
  checkLmsDuplicate,
  completeRoadmapNode,
  createGuide,
  createLmsCollection,
  createLmsRequest,
  createLmsResource,
  deleteGuide,
  deleteLmsResource,
  createQuestionBankItem,
  createRoadmap,
  deleteLmsAnnotation,
  deleteRoadmap,
  flagLmsResource,
  generateLearningSession,
  getContinueLearning,
  getContributorProfile,
  getExploreData,
  getGuide,
  getLmsAnnotations,
  getLmsMastery,
  getLmsProgress,
  getLmsResource,
  getLmsStreak,
  getMyBookmarks,
  getMyContributions,
  getPendingExamFeedback,
  getPyqBank,
  getRecommendations,
  getRevisionQueue,
  getRoadmap,
  getSubjectOverview,
  getWeeklyLeaderboard,
  listGuides,
  listLmsCollections,
  listLmsRequests,
  listLmsResources,
  listQuestionBank,
  listRoadmaps,
  markGuideSectionRead,
  markLmsResourceOutdated,
  postLmsComment,
  rateLmsResource,
  recordLmsResourceView,
  saveLmsAnnotation,
  submitExamFeedback,
  submitQuizAttempt,
  submitRevisionReview,
  toggleGuideUpvote,
  toggleResourceBookmark,
  toggleResourceUpvote,
  updateGuide,
  updateLmsResource,
  upvoteLmsRequest,
  upvoteQuestionBankItem,
  useSession,
  isProfileAdmin,
  getProfileRegisterNo,
  createEmptyResourceForm,
  resourceToForm,
  buildResourcePayload,
  useAsyncPage,
  LmsFrame,
  EmptyView,
  renderResourceBody
} from "../_shared/LmsPageShared";
import type {
  LmsGuide,
  LmsRequest,
  LmsResource,
  LmsRoadmap,
  ResourceFilterState,
  ResourceFormState
} from "../_shared/LmsPageShared";

export function RoadmapsListPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsyncPage(() => listRoadmaps(), []);
  const roadmaps = data || [];
  return (
    <LmsFrame title="Roadmaps" loading={loading} error={error}>
      {roadmaps.length === 0 ? (
        <EmptyView
          title="No roadmaps published yet"
          description="Roadmaps are guided skill paths built by the community. Be the first to chart one."
          actionLabel="Build a roadmap"
          onAction={() => navigate("/resources/roadmaps/new")}
        />
      ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        {roadmaps.map((roadmap: LmsRoadmap) => (
          <Link key={roadmap.id} to={`/resources/roadmaps/${roadmap.id}`} className="dashboard-card block p-5">
            <p className="text-sm text-[var(--text-secondary)]">{roadmap.skill}</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{roadmap.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{roadmap.description}</p>
          </Link>
        ))}
      </div>
      )}
    </LmsFrame>
  );
}

export default RoadmapsListPage;

