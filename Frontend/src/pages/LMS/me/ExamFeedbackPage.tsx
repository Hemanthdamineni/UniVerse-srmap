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
import { EmptyView } from "../../../components/ui/Feedback";
import { MessageSquareHeart } from "lucide-react";

export function ExamFeedbackPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useAsyncPage(() => getPendingExamFeedback(), []);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const pending = data || [];
  return (
    <LmsFrame title="Exam Feedback" loading={loading} error={error}>
      {pending.length === 0 ? (
        <EmptyView
          title="No exam feedback waiting"
          description="After you study exam-proven resources, they appear here so you can tell others whether they actually helped on the exam."
          icon={<MessageSquareHeart size={48} strokeWidth={1.5} />}
          actionLabel="Browse Resources"
          onAction={() => navigate("/resources/browse")}
          className="py-12"
        />
      ) : (
        <>
          <div className="space-y-3">
            {pending.map((resource) => (
              <ExamFeedbackCard key={resource.id} resource={resource} value={votes[resource.id]} onChange={(next) => setVotes({ ...votes, [resource.id]: next })} />
            ))}
          </div>
          <button
            className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Object.keys(votes).length === 0}
            onClick={async () => {
              const feedbackItems = Object.entries(votes).map(([resourceId, helpful]) => ({ resourceId, helpful }));
              await submitExamFeedback(feedbackItems);
              setSubmitted(true);
            }}
          >
            Submit feedback
          </button>
          {submitted ? (
            <p className="rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-4 py-2 text-sm font-medium" style={{ color: "var(--success)" }}>
              Thanks — your feedback helps other students pick exam-proven resources.
            </p>
          ) : null}
        </>
      )}
    </LmsFrame>
  );
}

export default ExamFeedbackPage;

