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
import { TrendingUp } from "lucide-react";

export function ProgressPage() {
  const navigate = useNavigate();
  const progress = useAsyncPage(() => getLmsProgress(), []);
  const mastery = useAsyncPage(() => getLmsMastery(), []);
  const subjects: Array<Record<string, unknown>> = Array.isArray(progress.data?.subjects)
    ? progress.data.subjects
    : [];
  const hasAnyProgress = Number(progress.data?.started || 0) > 0;
  return (
    <LmsFrame title="Progress" loading={progress.loading || mastery.loading} error={progress.error || mastery.error}>
      {!hasAnyProgress ? (
        <EmptyView
          title="No study progress yet"
          description="Open any note, PYQ, quiz, or flashcard deck and mark it as you go — your started, completed, and per-subject progress will show up here."
          icon={<TrendingUp size={48} strokeWidth={1.5} />}
          actionLabel="Browse Resources"
          onAction={() => navigate("/resources/browse")}
          className="py-12"
        />
      ) : (
        <>
          <SectionCard title="Summary">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="dashboard-card p-4">
                <p className="text-sm text-[var(--text-secondary)]">Started</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.started || 0)}</p>
              </div>
              <div className="dashboard-card p-4">
                <p className="text-sm text-[var(--text-secondary)]">Completed</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completed || 0)}</p>
              </div>
              <div className="dashboard-card p-4">
                <p className="text-sm text-[var(--text-secondary)]">Completion rate</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{String(progress.data?.completionRate || 0)}%</p>
              </div>
            </div>
          </SectionCard>

          {subjects.length > 0 ? (
            <SectionCard title="By subject">
              <div className="grid gap-4 md:grid-cols-2">
                {subjects.map((subject) => {
                  const code = String(subject.subjectCode || "");
                  const name = String(subject.subjectName || "");
                  const completed = Number(subject.completed || 0);
                  const started = Number(subject.started || 0);
                  const total = Number(subject.totalResources || 0);
                  const coveredPct = Math.min(100, Math.max(0, Number(subject.coveredPct || 0)));
                  const pct = started > 0 ? Math.round((completed / started) * 100) : 0;
                  return (
                    <Link
                      key={code}
                      to={`/resources/subject/${encodeURIComponent(code)}`}
                      className="dashboard-card space-y-2 p-4 no-underline transition hover:bg-[var(--comp-surface-hover)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-[var(--comp-text-primary)]">{[code, name].filter(Boolean).join(" · ")}</span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--comp-text-muted)]">
                          {completed}/{started} done · {total} available
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--comp-accent) 10%, transparent)" }}>
                        <div
                          className="h-full rounded-full bg-[var(--info)]"
                          style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {pct}% of what you started is complete — you've touched about {coveredPct}% of this subject's library
                      </p>
                    </Link>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}

          <TopicMasteryHeatmap
            items={(mastery.data || []).map((entry) => ({
              label: String(entry.label || "Topic"),
              mastery: Number(entry.mastery || 0),
            }))}
          />
        </>
      )}
    </LmsFrame>
  );
}

export default ProgressPage;

