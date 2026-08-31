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
  getExamPrepRecommendations,
  getExploreData,
  getGuide,
  getLmsAnnotations,
  getLmsMastery,
  getLmsProgress,
  getLmsResource,
  getLmsStreak,
  getLmsProgressOverview,
  getMyBookmarks,
  getMyContributions,
  getPendingExamFeedback,
  getPyqBank,
  getRecommendations,
  getRevisionQueue,
  getRoadmap,
  getRoadmapRecommendations,
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
import { track } from "../../lib/core/analytics";
// Canonical SectionCard (supports `actions`) — shadows the legacy ErpPrimitives
// re-export pulled in through the shared barrel.
import { SectionCard as CanonicalSectionCard } from "../../components/ui";

export function LmsHomePage() {
  const recommendations = useAsyncPage(() => getRecommendations({ limit: 6 }), []);
  const examPrep = useAsyncPage(() => getExamPrepRecommendations({ limit: 6 }), []);
  const roadmapRecommendations = useAsyncPage(() => getRoadmapRecommendations({ limit: 4 }), []);
  const continueLearning = useAsyncPage(() => getContinueLearning(), []);
  const revision = useAsyncPage(() => getRevisionQueue(), []);
  const pendingExam = useAsyncPage(() => getPendingExamFeedback(), []);
  const requests = useAsyncPage(() => listLmsRequests({ status: "open", limit: 5 }), []);
  const leaderboard = useAsyncPage(() => getWeeklyLeaderboard(), []);
  const streak = useAsyncPage(() => getLmsStreak(), []);

  useEffect(() => {
    if (!examPrep.data?.length) return;
    track('lms_exam_prep_recommendations_viewed', {
      count: examPrep.data.length,
      topResourceId: examPrep.data[0]?.id,
    });
  }, [examPrep.data]);

  useEffect(() => {
    if (!roadmapRecommendations.data?.length) return;
    track('lms_roadmap_recommendations_viewed', {
      count: roadmapRecommendations.data.length,
      topRoadmapId: roadmapRecommendations.data[0]?.id,
    });
  }, [roadmapRecommendations.data]);

  return (
    <LmsFrame title="LMS Home" loading={recommendations.loading || examPrep.loading || roadmapRecommendations.loading || continueLearning.loading} error={recommendations.error || examPrep.error || roadmapRecommendations.error || continueLearning.error}>
      {pendingExam.data?.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,var(--comp-surface))] px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {pendingExam.data.length} resource{pendingExam.data.length === 1 ? "" : "s"} you studied appeared on your exam — tell others whether they helped.
          </p>
          <Link to="/learn/exam-feedback" className="lms-btn lms-btn-primary no-underline">
            Share exam feedback
          </Link>
        </div>
      ) : null}

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

      <RecommendationSection title="Exam prep" items={examPrep.data || []} />

      <CanonicalSectionCard
        title="Recommended Roadmaps"
        actions={
          <Link to="/learn/roadmaps" className="text-xs font-medium text-[var(--comp-accent)] no-underline hover:underline">
            Browse all
          </Link>
        }
      >
        {roadmapRecommendations.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {roadmapRecommendations.data.map((roadmap) => (
              <Link
                key={roadmap.id}
                to={`/learn/roadmaps/${roadmap.id}`}
                className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 no-underline transition hover:bg-[var(--comp-surface-hover)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{roadmap.title}</p>
                    <p className="text-xs text-[var(--comp-text-muted)]">
                      {roadmap.skill} · {roadmap.estimatedHours || "Flexible"}h
                    </p>
                  </div>
                  {roadmap.confidence ? (
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--comp-accent)]">
                      {Math.round(roadmap.confidence * 100)}%
                    </span>
                  ) : null}
                </div>
                {roadmap.reasons?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roadmap.reasons.slice(0, 2).map((reason) => (
                      <span key={reason.code} className="rounded-full border border-[var(--comp-border)] px-2 py-0.5 text-xs text-[var(--comp-text-secondary)]">
                        {reason.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="body-text text-sm">Roadmap recommendations appear as you build learning history across subjects.</p>
        )}
      </CanonicalSectionCard>

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
