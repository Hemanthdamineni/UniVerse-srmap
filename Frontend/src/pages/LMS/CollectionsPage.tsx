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

export function CollectionsPage() {
  const { data, setData, loading, error } = useAsyncPage(() => listLmsCollections(), []);
  const [name, setName] = useState("");
  return (
    <LmsFrame title="Collections" loading={loading} error={error}>
      <SectionCard title="Create collection">
        <div className="flex gap-3">
          <input className="flex-1 lms-input" placeholder="Collection name" aria-label="Collection name" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white" onClick={async () => {
            await createLmsCollection({ name });
            const next = await listLmsCollections();
            setData(next);
            setName("");
          }}>
            Create
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {(data || []).map((collection) => (
          <Link key={collection.id} to={`/resources/me/collections?collectionId=${collection.id}`} className="dashboard-card block p-4">
            <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{collection.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{collection.description || "No description"}</p>
          </Link>
        ))}
      </div>
    </LmsFrame>
  );
}

export default CollectionsPage;

