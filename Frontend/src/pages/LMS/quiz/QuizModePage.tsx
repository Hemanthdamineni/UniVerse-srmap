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

export function QuizModePage() {
  const { id = "" } = useParams();
  const { data, loading, error } = useAsyncPage(() => getLmsResource(id), [id]);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const questions = useMemo(() => {
    const content = (data?.structuredContent as { questions?: Array<Record<string, unknown>> } | null) || null;
    return (content?.questions || []).map((question) => ({
      id: String(question.id || ""),
      question: String(question.question || ""),
      options: Array.isArray(question.options) ? question.options.map(String) : [],
      explanation: String(question.explanation || ""),
      correctIndex: Number(question.correctIndex || 0),
    }));
  }, [data]);

  return (
    <LmsFrame title={data?.title || "Quiz"} loading={loading} error={error}>
      <div className="space-y-3">
        {submittedMessage ? (
          <p className="rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-4 py-2 text-sm font-medium" style={{ color: "var(--success)" }}>
            {submittedMessage}
          </p>
        ) : null}
        <QuizRunner
          questions={questions}
          onSubmit={async (answers) => {
            const result = await submitQuizAttempt(id, { answers, mode: "practice" });
            const score = Number((result as Record<string, unknown>)?.score ?? 0);
            const maxScore = Number((result as Record<string, unknown>)?.maxScore ?? questions.length);
            setSubmittedMessage(`Quiz submitted — scored ${score}/${maxScore}.`);
          }}
        />
      </div>
    </LmsFrame>
  );
}

export default QuizModePage;

