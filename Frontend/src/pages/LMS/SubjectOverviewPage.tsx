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
} from "./_shared/LmsPageShared";
import type {
  LmsGuide,
  LmsRequest,
  LmsResource,
  LmsRoadmap,
  ResourceFilterState,
  ResourceFormState
} from "./_shared/LmsPageShared";

export function SubjectOverviewPage() {
  const { code = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getSubjectOverview(code), [code]);
  const topByUnit = useMemo(() => ((data?.topByUnit as Array<Record<string, unknown>>) || []), [data]);
  const topicMastery = useMemo(() => ((data?.topicMastery as Array<Record<string, unknown>>) || []), [data]);

  return (
    <LmsFrame title={`Subject ${code}`} loading={loading} error={error}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Studying now</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(data?.studyingCount || 0)}</p>
        </div>
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Units covered</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(topByUnit.length)}</p>
        </div>
        <div className="dashboard-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Open requests</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String((data?.openRequests as unknown[] | undefined)?.length || 0)}</p>
        </div>
      </div>

      <SectionCard title="Top Resources by Unit">
        <div className="space-y-3">
          {topByUnit.map((entry) => (
            <Link key={String(entry.unitNormalized)} to={`/resources/${String((entry.topResource as Record<string, unknown>)?.id || "")}`} className="dashboard-card block p-4">
              <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{String(entry.unit || entry.unitNormalized)}</p>
              <p className="text-sm text-[var(--text-secondary)]">{String((entry.topResource as Record<string, unknown>)?.title || "")}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <TopicMasteryHeatmap
        items={topicMastery.map((entry) => ({
          label: String(entry.label || "Topic"),
          mastery: Number(entry.mastery || 0),
        }))}
      />
    </LmsFrame>
  );
}

export default SubjectOverviewPage;

