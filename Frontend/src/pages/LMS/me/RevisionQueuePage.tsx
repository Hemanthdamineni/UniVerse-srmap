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

export function RevisionQueuePage() {
  const { data, setData, loading, error } = useAsyncPage(() => getRevisionQueue(), []);
  return (
    <LmsFrame title="Revision Queue" loading={loading} error={error}>
      <div className="space-y-3">
        {(data || []).map((entry) => (
          <div key={String(entry.resourceId)} className="dashboard-card flex items-center justify-between gap-4 p-4">
            <div>
              <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{String(entry.title || "")}</h3>
              <p className="text-sm text-[var(--text-secondary)]">Due {String(entry.dueDate || "")}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full bg-[color-mix(in_srgb,var(--error)_15%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)]" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 40))}>Again</button>
              <button className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 85))}>Reviewed</button>
            </div>
          </div>
        ))}
      </div>
    </LmsFrame>
  );
}

export default RevisionQueuePage;

