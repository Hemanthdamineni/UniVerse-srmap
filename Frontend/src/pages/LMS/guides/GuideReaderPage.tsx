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

export function GuideReaderPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getGuide(id), [id]);
  const registerNo = getProfileRegisterNo(profile);
  const canManageGuide = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || isProfileAdmin(profile))
  );
  return (
    <LmsFrame title={data?.title || "Guide"} loading={loading} error={error}>
      <div className="flex flex-wrap gap-3">
        <Link to={`/resources/guides/new?clone=${id}`} className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
          Clone into editor
        </Link>
        {canManageGuide ? (
          <Link to={`/resources/guides/new?edit=${id}`} className="rounded-full border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]">
            Edit
          </Link>
        ) : null}
        <button
          className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await toggleGuideUpvote(id);
            const next = await getGuide(id);
            setData(next);
          }}
        >
          Upvote
        </button>
        <a className="rounded-full border border-[color-mix(in_srgb,var(--info)_20%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" href={`/api/lms/guides/${id}/export`} target="_blank" rel="noreferrer">
          Export PDF
        </a>
        {canManageGuide ? (
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
            onClick={async () => {
              if (!window.confirm("Delete this guide?")) return;
              await deleteGuide(id);
              navigate("/resources/me/contributions");
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
      {(data?.sections || []).map((section) => (
        <GuideSection
          key={section.id}
          section={section}
          onMarkRead={async (sectionId) => {
            const next = await markGuideSectionRead(id, sectionId);
            setData(next);
          }}
        />
      ))}
    </LmsFrame>
  );
}

export default GuideReaderPage;

