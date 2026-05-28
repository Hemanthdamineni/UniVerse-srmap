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

export function LmsHomePage() {
  const recommendations = useAsyncPage(() => getRecommendations({ limit: 6 }), []);
  const continueLearning = useAsyncPage(() => getContinueLearning(), []);
  const revision = useAsyncPage(() => getRevisionQueue(), []);
  const pendingExam = useAsyncPage(() => getPendingExamFeedback(), []);
  const requests = useAsyncPage(() => listLmsRequests({ status: "open", limit: 5 }), []);
  const leaderboard = useAsyncPage(() => getWeeklyLeaderboard(), []);
  const streak = useAsyncPage(() => getLmsStreak(), []);

  return (
    <LmsFrame title="LMS Home" loading={recommendations.loading || continueLearning.loading} error={recommendations.error || continueLearning.error}>
      <SectionCard title="Momentum">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Current streak" value={String(streak.data?.currentStreak || 0)} />
          <StatCard label="Revision due" value={String(revision.data?.length || 0)} />
          <StatCard label="Exam feedback pending" value={String(pendingExam.data?.length || 0)} />
        </div>
      </SectionCard>

      {continueLearning.data ? (
        <SectionCard title="Continue Learning">
          <ResourceGrid items={[continueLearning.data]} />
        </SectionCard>
      ) : null}

      <RecommendationSection title="Recommended for you" items={recommendations.data || []} />

      <SectionCard title="Open Requests">
        <div className="space-y-3">
          {(requests.data?.items || []).map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      </SectionCard>

      <WeeklyLeaderboard items={leaderboard.data || []} />
    </LmsFrame>
  );
}

export default LmsHomePage;

