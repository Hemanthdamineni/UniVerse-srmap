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
  const navigate = useNavigate();
  const { data, loading, error } = useAsyncPage(() => getSubjectOverview(code), [code]);
  const topByUnit = useMemo(() => ((data?.topByUnit as Array<Record<string, unknown>>) || []), [data]);
  const topicMastery = useMemo(() => ((data?.topicMastery as Array<Record<string, unknown>>) || []), [data]);
  const hasActivity = Boolean(
    data && (topByUnit.length > 0 || topicMastery.length > 0 || Number(data.studyingCount || 0) > 0)
  );

  return (
    <LmsFrame title={`Subject ${code}`} loading={loading} error={error}>
      {hasActivity ? (
      <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Studying now" value={String(data?.studyingCount || 0)} />
        <StatCard label="Units covered" value={String(topByUnit.length)} />
        <StatCard label="Open requests" value={String((data?.openRequests as unknown[] | undefined)?.length || 0)} />
      </div>

      <SectionCard title="Top Resources by Unit">
        <div className="divide-y divide-[var(--comp-border)]">
          {topByUnit.map((entry) => (
            <Link key={String(entry.unitNormalized)} to={`/resources/${String((entry.topResource as Record<string, unknown>)?.id || "")}`} className="block space-y-1 py-3">
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
      </>
      ) : (
        <EmptyView
          title={`No community activity for ${code} yet`}
          description="Once students study, bookmark, or request resources for this subject, its overview appears here."
          actionLabel="Browse all resources"
          onAction={() => navigate("/resources/browse")}
        />
      )}
    </LmsFrame>
  );
}

export default SubjectOverviewPage;

