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

export function RoadmapViewerPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { data, setData, loading, error } = useAsyncPage(() => getRoadmap(id), [id]);
  const registerNo = getProfileRegisterNo(profile);
  const canManageRoadmap = Boolean(
    data && (String(data.authorId || "").toUpperCase() === registerNo || isProfileAdmin(profile))
  );
  return (
    <LmsFrame title={data?.title || "Roadmap"} loading={loading} error={error}>
      {data ? (
        <div className="space-y-4">
          {canManageRoadmap ? (
            <div className="flex justify-end">
              <button
                className="rounded-full border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--error)]"
                onClick={async () => {
                  if (!window.confirm("Delete this roadmap?")) return;
                  await deleteRoadmap(id);
                  navigate("/resources/me/contributions");
                }}
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
    </LmsFrame>
  );
}

export default RoadmapViewerPage;

