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
import { Pagination } from "../../components/ui/Pagination";

export function BrowsePage() {
  const [filters, setFilters] = useState<ResourceFilterState>({});
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsyncPage(
    () => listLmsResources({ ...filters, limit: 24, page, sort: "quality" }),
    [filters.subjectCode, filters.type, filters.difficulty, filters.query, page, reloadKey]
  );
  const items = data?.items || [];
  const total = data?.pagination?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <LmsFrame title="Browse Resources" loading={loading} error={error}>
      <ResourceFilterPanel filters={filters} onChange={(next) => { setPage(1); setFilters(next); }} />
      <ResourceGrid
        items={items}
        emptyTitle="No resources match your filters"
        emptyDescription="Try clearing the search or picking a different subject — or be the first to contribute."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--comp-text-muted)] tabular-nums">
          {total} resource{total === 1 ? "" : "s"}
        </p>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(next) => { if (!loading) setPage(next); }}
        />
      </div>
    </LmsFrame>
  );
}

export default BrowsePage;

