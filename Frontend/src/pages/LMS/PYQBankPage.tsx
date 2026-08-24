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

export function PYQBankSection({ code }: { code: string }) {
  const navigate = useNavigate();
  const { data, loading, error } = useAsyncPage(() => getPyqBank(code, { limit: 50, page: 1, sort: "recent" }), [code]);
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <ResourceGrid
        items={items}
        emptyTitle={`No past papers shared for ${code} yet`}
        emptyDescription="Contribute a previous year question paper from the Contribute page — it helps every batch that follows."
        emptyActionLabel="Contribute a PYQ"
        emptyActionTo="/learn/contribute/new"
        emptyActionDescription="Upload notes, PYQs, quizzes and more for your subjects."
      />
      {!loading && !error && items.length > 0 ? (
        <button
          className="lms-btn lms-btn-ghost"
          onClick={() => navigate("/learn/contribute/new")}
        >
          Contribute a PYQ
        </button>
      ) : null}
    </div>
  );
}

export function PYQBankPage() {
  const { code = "" } = useParams();

  return (
    <LmsFrame title={`PYQ Bank • ${code}`}>
      <PYQBankSection code={code} />
    </LmsFrame>
  );
}

export default PYQBankPage;

