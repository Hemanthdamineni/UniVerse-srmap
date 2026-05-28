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

export function RequestBoardPage() {
  const { data, setData, loading, error } = useAsyncPage(() => listLmsRequests({ status: "open", limit: 50, page: 1 }), []);
  const [title, setTitle] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");

  return (
    <LmsFrame title="Request Board" loading={loading} error={error}>
      <SectionCard title="Post a Request">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="lms-input" placeholder="Title" aria-label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input className="lms-input" placeholder="Subject code" aria-label="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} />
          <input className="lms-input" placeholder="Subject name" aria-label="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
          <input className="lms-input" placeholder="Semester" aria-label="Semester" value={semester} onChange={(event) => setSemester(event.target.value)} />
        </div>
        <textarea className="mt-3 min-h-24 w-full lms-input" placeholder="Description" aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button
          className="mt-3 rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
          onClick={async () => {
            await createLmsRequest({ title, subjectCode, subjectName, semester, description });
            const next = await listLmsRequests({ status: "open", limit: 50, page: 1 });
            setData(next);
            setTitle("");
            setDescription("");
          }}
        >
          Post request
        </button>
      </SectionCard>
      <div className="space-y-3">
        {(data?.items || []).map((request: LmsRequest) => (
          <RequestCard
            key={request.id}
            request={request}
            onUpvote={async (requestId) => {
              await upvoteLmsRequest(requestId);
              const next = await listLmsRequests({ status: "open", limit: 50, page: 1 });
              setData(next);
            }}
          />
        ))}
      </div>
    </LmsFrame>
  );
}

export default RequestBoardPage;

