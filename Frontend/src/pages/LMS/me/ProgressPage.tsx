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

export function ProgressPage() {
  const progress = useAsyncPage(() => getLmsProgress(), []);
  const mastery = useAsyncPage(() => getLmsMastery(), []);
  return (
    <LmsFrame title="Progress" loading={progress.loading || mastery.loading} error={progress.error || mastery.error}>
      <SectionCard title="Summary">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Started</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.started || 0)}</p>
          </div>
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Completed</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completed || 0)}</p>
          </div>
          <div className="dashboard-card p-4">
            <p className="text-sm text-[var(--text-secondary)]">Completion rate</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completionRate || 0)}%</p>
          </div>
        </div>
      </SectionCard>
      <TopicMasteryHeatmap
        items={(mastery.data || []).map((entry) => ({
          label: String(entry.label || "Topic"),
          mastery: Number(entry.mastery || 0),
        }))}
      />
    </LmsFrame>
  );
}

export default ProgressPage;

