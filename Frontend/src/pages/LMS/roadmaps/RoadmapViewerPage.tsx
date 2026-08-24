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
import { ConfirmDialog } from "../../../components/dialog";
import type {
  LmsGuide,
  LmsRequest,
  LmsResource,
  LmsRoadmap,
  ResourceFilterState,
  ResourceFormState
} from "../_shared/LmsPageShared";

export function RoadmapViewerPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getRoadmap(id), [id]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const registerNo = getProfileRegisterNo(profile);
  const canManageRoadmap = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || isProfileAdmin(profile))
  );

  async function handleDeleteConfirmed() {
    setConfirmingDelete(false);
    await deleteRoadmap(id);
    navigate("/learn/contribute?tab=contributions");
  }

  return (
    <LmsFrame title={data?.title || "Roadmap"} loading={loading} error={error}>
      {data ? (
        <div className="space-y-4">
          {canManageRoadmap ? (
            <div className="flex justify-end">
              <button
                className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete roadmap
              </button>
            </div>
          ) : null}
          <RoadmapGraph
            roadmap={data}
            onComplete={async (nodeId) => {
              const next = await completeRoadmapNode(id, nodeId);
              setData(next);
            }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this roadmap?"
        description={`"${data?.title ?? "This roadmap"}" will be permanently removed for everyone. This cannot be undone.`}
        confirmLabel="Delete roadmap"
        danger
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </LmsFrame>
  );
}

export default RoadmapViewerPage;

