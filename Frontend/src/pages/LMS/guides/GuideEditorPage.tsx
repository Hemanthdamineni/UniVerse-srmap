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

export function GuideEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const cloneId = searchParams.get("clone") || "";
  const sourceId = editId || cloneId;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [semester, setSemester] = useState("");
  const [unit, setUnit] = useState("");
  const [sections, setSections] = useState([{ title: "Introduction", content: "" }]);
  const sourceState = useAsyncPage<LmsGuide | null>(
    () => (sourceId ? getGuide(sourceId) : Promise.resolve(null)),
    [sourceId]
  );

  useEffect(() => {
    if (!sourceState.data) return;
    setTitle(editId ? sourceState.data.title : `${sourceState.data.title} Copy`);
    setDescription(sourceState.data.description || "");
    setSubjectCode(sourceState.data.subjectCode || "");
    setSubjectName(sourceState.data.subjectName || "");
    setSemester(sourceState.data.semester || "");
    setUnit(sourceState.data.unit || "");
    setSections(
      sourceState.data.sections?.length
        ? sourceState.data.sections.map((section) => ({ title: section.title, content: section.content }))
        : [{ title: "Introduction", content: "" }]
    );
  }, [sourceState.data?.id, editId]);

  return (
    <LmsFrame title={editId ? "Edit Guide" : "Guide Editor"} loading={Boolean(sourceId && sourceState.loading)} error={sourceState.error}>
      <div className="dashboard-card space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input className="lms-input" placeholder="Guide title" aria-label="Guide title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input className="lms-input" placeholder="Subject code" aria-label="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} />
          <input className="lms-input" placeholder="Subject name" aria-label="Subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} />
          <input className="lms-input" placeholder="Semester" aria-label="Semester" value={semester} onChange={(event) => setSemester(event.target.value)} />
          <input className="lms-input" placeholder="Unit" aria-label="Unit" value={unit} onChange={(event) => setUnit(event.target.value)} />
        </div>
        <textarea className="min-h-24 lms-input" placeholder="Description" aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        {sections.map((section, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] p-4">
            <input className="w-full lms-input" placeholder="Section title" aria-label="Section title" value={section.title} onChange={(event) => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry))} />
            <textarea className="min-h-32 w-full lms-input" placeholder="Section content" aria-label="Section content" value={section.content} onChange={(event) => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, content: event.target.value } : entry))} />
          </div>
        ))}
        <div className="flex gap-3">
          <button className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]" onClick={() => setSections([...sections, { title: `Section ${sections.length + 1}`, content: "" }])}>
            Add section
          </button>
          <button
            className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              const payload = { title, description, subjectCode, subjectName, semester, unit, sections, published: true };
              const guide = editId ? await updateGuide(editId, payload) : await createGuide(payload);
              navigate(`/resources/guides/${guide.id}`);
            }}
          >
            {editId ? "Update guide" : "Publish guide"}
          </button>
        </div>
      </div>
    </LmsFrame>
  );
}

export default GuideEditorPage;

