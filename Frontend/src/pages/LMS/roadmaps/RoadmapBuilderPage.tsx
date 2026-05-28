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

export function RoadmapBuilderPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [skill, setSkill] = useState("");
  const [description, setDescription] = useState("");

  return (
    <LmsFrame title="Roadmap Builder">
      <div className="dashboard-card space-y-3 p-5">
        <input className="lms-input" placeholder="Roadmap title" aria-label="Roadmap title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="lms-input" placeholder="Skill" aria-label="Skill" value={skill} onChange={(event) => setSkill(event.target.value)} />
        <textarea className="min-h-24 lms-input" placeholder="Description" aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button
          className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            const roadmap = await createRoadmap({ title, skill, description, published: true });
            await addRoadmapNode(roadmap.id, { title: "Start here", description: "Introduction", nodeType: "concept" });
            navigate(`/resources/roadmaps/${roadmap.id}`);
          }}
        >
          Create roadmap
        </button>
      </div>
    </LmsFrame>
  );
}

export default RoadmapBuilderPage;

