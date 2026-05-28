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

export function MyContributionsPage() {
  const { data, loading, error } = useAsyncPage(() => getMyContributions(), []);
  const resources = ((data?.resources as LmsResource[]) || []);
  const guides = ((data?.guides as LmsGuide[]) || []);
  const roadmaps = ((data?.roadmaps as LmsRoadmap[]) || []);
  return (
    <LmsFrame title="My Contributions" loading={loading} error={error}>
      <RecommendationSection title="My Resources" items={resources} />
      <SectionCard title="My Guides">
        <div className="space-y-2">
          {guides.map((guide) => (
            <Link key={guide.id} to={`/resources/guides/${guide.id}`} className="dashboard-card block p-4">
              {guide.title}
            </Link>
          ))}
          {guides.length === 0 ? <p className="body-text">No guides published yet.</p> : null}
        </div>
      </SectionCard>
      <SectionCard title="My Roadmaps">
        <div className="space-y-2">
          {roadmaps.map((roadmap) => (
            <Link key={roadmap.id} to={`/resources/roadmaps/${roadmap.id}`} className="dashboard-card block p-4">
              {roadmap.title}
            </Link>
          ))}
          {roadmaps.length === 0 ? <p className="body-text">No roadmaps published yet.</p> : null}
        </div>
      </SectionCard>
    </LmsFrame>
  );
}

export default MyContributionsPage;

