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
import { CalendarClock } from "lucide-react";

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "unknown";
  const today = new Date();
  const dayDiff = Math.ceil(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000
  );
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "tomorrow";
  return `in ${dayDiff} days`;
}

export function RevisionQueuePage() {
  const navigate = useNavigate();
  const { data, setData, loading, error } = useAsyncPage(() => getRevisionQueue(), []);
  const queue = data || [];
  return (
    <LmsFrame title="Revision Queue" loading={loading} error={error}>
      {queue.length === 0 ? (
        <EmptyView
          title="Nothing due for revision"
          description="Resources you study are scheduled here using spaced repetition. Mark resources as studied to build your revision schedule."
          icon={<CalendarClock size={48} strokeWidth={1.5} />}
          actionLabel="Browse Resources"
          onAction={() => navigate("/learn/discover")}
          className="py-12"
        />
      ) : (
        <div className="space-y-3">
          {queue.map((entry) => (
            <div key={String(entry.resourceId)} className="dashboard-card flex items-center justify-between gap-4 p-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{String(entry.title || "")}</h3>
                <p className="text-sm text-[var(--text-secondary)]">Due {formatDueDate(String(entry.dueDate || ""))}</p>
              </div>
              <div className="flex gap-2">
                <button className="lms-btn lms-btn-danger" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 40))}>Again</button>
                <button className="lms-btn lms-btn-primary" onClick={async () => setData(await submitRevisionReview(String(entry.resourceId), 85))}>Reviewed</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </LmsFrame>
  );
}

export default RevisionQueuePage;

