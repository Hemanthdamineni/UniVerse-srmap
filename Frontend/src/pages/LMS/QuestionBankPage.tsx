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

export function QuestionBankPage() {
  const [subjectCode, setSubjectCode] = useState("");
  const { data, setData, loading, error } = useAsyncPage(
    () => (subjectCode ? listQuestionBank({ subjectCode, limit: 50, page: 1 }) : Promise.resolve({ items: [], pagination: { page: 1, limit: 50 } })),
    [subjectCode]
  );
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Option A, Option B, Option C, Option D");
  const [correctIndex, setCorrectIndex] = useState(0);

  return (
    <LmsFrame title="Question Bank" loading={loading} error={error}>
      <SectionCard title="Contribute Question">
        <div className="grid gap-3">
          <input className="lms-input" placeholder="Subject code" aria-label="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} />
          <textarea className="min-h-24 lms-input" placeholder="Question" aria-label="Question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <input className="lms-input" placeholder="Options comma separated" aria-label="Options" value={options} onChange={(event) => setOptions(event.target.value)} />
          <input className="lms-input" type="number" min={0} aria-label="Correct answer index" value={correctIndex} onChange={(event) => setCorrectIndex(Number(event.target.value))} />
          <div className="flex gap-3">
            <button
              className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                await createQuestionBankItem({
                  subjectCode,
                  question,
                  options: options.split(",").map((item) => item.trim()).filter(Boolean),
                  correctIndex,
                });
                const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
                setData(next);
              }}
            >
              Add question
            </button>
            <button
              className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]"
              onClick={async () => {
                const quiz = await buildQuizFromQuestionBank({ subjectCode, count: 5 });
                window.alert(`Generated ${quiz.count} questions`);
              }}
            >
              Build quiz
            </button>
          </div>
        </div>
      </SectionCard>
      <div className="space-y-3">
        {(data?.items || []).map((item) => (
          <div key={String(item.id)} className="dashboard-card space-y-2 p-4">
            <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{String(item.question || "")}</h3>
            <div className="space-y-1 text-sm text-[var(--text-secondary)]">
              {(Array.isArray(item.options) ? item.options : []).map((option, index) => (
                <div key={index}>{String(option)}</div>
              ))}
            </div>
            <button className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white" onClick={async () => {
              await upvoteQuestionBankItem(String(item.id));
              const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
              setData(next);
            }}>
              Upvote
            </button>
          </div>
        ))}
      </div>
    </LmsFrame>
  );
}

export default QuestionBankPage;

