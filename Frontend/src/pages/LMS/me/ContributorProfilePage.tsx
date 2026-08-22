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

export function ContributorProfilePage() {
  const { userId = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getContributorProfile(userId), [userId]);
  const trust = (data?.trust as Record<string, unknown> | undefined) || {};
  const totals = (data?.totals as Record<string, unknown> | undefined) || {};
  const contributions = (data?.contributions as Record<string, unknown> | undefined) || {};
  const resources = ((data?.recentResources as LmsResource[] | undefined) || (contributions.resources as LmsResource[] | undefined) || []);

  return (
    <LmsFrame title="Publisher Profile" loading={loading} error={error}>
      <SectionCard title={String(data?.displayName || userId || "Publisher")}>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Trust score" value={String(trust.trustScore || 0)} />
          <StatCard label="Resources" value={String(totals.resources || 0)} />
          <StatCard label="Approved" value={String(trust.approvedCount || 0)} />
          <StatCard label="Flagged" value={String(trust.flaggedCount || 0)} />
        </div>
        <p className="mt-4 max-w-3xl text-sm text-[var(--text-secondary)]">
          Publisher history is based on contribution volume, learner quality signals, open reports, and moderation outcomes.
        </p>
      </SectionCard>

      <RecommendationSection title="Published Resources" items={resources} />
      {resources.length === 0 ? (
        <p className="text-center text-sm text-[var(--comp-text-muted)]">
          This contributor has no published resources yet.
        </p>
      ) : null}
    </LmsFrame>
  );
}

export default ContributorProfilePage;

