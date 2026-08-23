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
import { ConfirmDialog } from "../../../components/dialog";

export function GuideReaderPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getGuide(id), [id]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const registerNo = getProfileRegisterNo(profile);
  const canManageGuide = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || isProfileAdmin(profile))
  );

  async function handleDeleteConfirmed() {
    setConfirmingDelete(false);
    await deleteGuide(id);
    navigate("/resources/me/contributions");
  }
  return (
    <LmsFrame title={data?.title || "Guide"} loading={loading} error={error}>
      <div className="flex flex-wrap gap-3">
        <Link to={`/resources/guides/new?clone=${id}`} className="lms-btn lms-btn-ghost">
          Clone into editor
        </Link>
        {canManageGuide ? (
          <Link to={`/resources/guides/new?edit=${id}`} className="lms-btn lms-btn-ghost">
            Edit
          </Link>
        ) : null}
        <button
          className="lms-btn lms-btn-primary"
          onClick={async () => {
            await toggleGuideUpvote(id);
            const next = await getGuide(id);
            setData(next);
          }}
        >
          Upvote
        </button>
        <a className="lms-btn lms-btn-ghost border-[color-mix(in_srgb,var(--info)_20%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)]" href={`/api/lms/guides/${id}/export`} target="_blank" rel="noreferrer">
          Export PDF
        </a>
        {canManageGuide ? (
          <button
            className="lms-btn lms-btn-danger"
            onClick={() => setConfirmingDelete(true)}
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

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this guide?"
        description={`"${data?.title ?? "This guide"}" will be permanently removed for everyone. This cannot be undone.`}
        confirmLabel="Delete guide"
        danger
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </LmsFrame>
  );
}

export default GuideReaderPage;

