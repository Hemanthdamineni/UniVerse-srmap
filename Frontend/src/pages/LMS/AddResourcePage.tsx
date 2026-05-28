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

export function AddResourcePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicate, setDuplicate] = useState<{ exact?: { title: string } | null; similar?: unknown[] } | null>(null);
  const [form, setForm] = useState<ResourceFormState>(() => createEmptyResourceForm());
  const editState = useAsyncPage<LmsResource | null>(
    () => (editId ? getLmsResource(editId) : Promise.resolve(null)),
    [editId]
  );

  useEffect(() => {
    if (editState.data) {
      setForm(resourceToForm(editState.data));
    }
  }, [editState.data?.id]);

  const submitLabel = editId ? "Update resource" : "Create resource";
  const frameTitle = editId ? "Edit Resource" : "Add Resource";

  return (
    <LmsFrame title={frameTitle} loading={Boolean(editId && editState.loading)} error={editState.error}>
      <div className="dashboard-card grid gap-4 p-5">
        <DuplicateWarning exact={duplicate?.exact || null} similarCount={duplicate?.similar?.length || 0} />
        {formError ? <InlineError message={formError} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <input className="lms-input" placeholder="Title" aria-label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select className="lms-input" aria-label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="note">Note</option>
            <option value="link">Link</option>
            <option value="file">File</option>
            <option value="quiz">Quiz</option>
            <option value="flashcard">Flashcard</option>
            <option value="pyq">PYQ</option>
          </select>
          <input className="lms-input" placeholder="Semester" aria-label="Semester" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
          <input className="lms-input" placeholder="Subject code" aria-label="Subject code" value={form.subjectCode} onChange={(event) => setForm({ ...form, subjectCode: event.target.value.toUpperCase() })} />
          <input className="lms-input" placeholder="Subject name" aria-label="Subject name" value={form.subjectName} onChange={(event) => setForm({ ...form, subjectName: event.target.value })} />
          <input className="lms-input" placeholder="Unit" aria-label="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          <input className="lms-input" placeholder="Difficulty" aria-label="Difficulty" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })} />
          <input className="lms-input" placeholder="Tags comma separated" aria-label="Tags" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        </div>
        <textarea className="min-h-24 lms-input" placeholder="Description" aria-label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        {form.type === "link" ? (
          <input className="lms-input" placeholder="URL" aria-label="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
        ) : null}
        {form.type === "note" ? (
          <textarea className="min-h-48 lms-input" placeholder="Note content" aria-label="Note content" value={form.noteContent} onChange={(event) => setForm({ ...form, noteContent: event.target.value })} />
        ) : null}
        {(form.type === "file" || form.type === "pyq") ? (
          <input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} />
        ) : null}
        <div className="flex gap-3">
          <button
            className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFormError("");
              try {
                if (!form.title.trim() || !form.subjectCode.trim() || !form.subjectName.trim()) {
                  setFormError("Title, subject code, and subject name are required.");
                  return;
                }

                const payload = buildResourcePayload(form);
                if (editId) {
                  const updated = await updateLmsResource(editId, payload);
                  navigate(`/resources/${updated.id}`);
                  return;
                }

                const duplicateResult = await checkLmsDuplicate({
                  title: form.title,
                  subjectCode: form.subjectCode,
                });
                setDuplicate(duplicateResult);
                const created = await createLmsResource(payload);
                navigate(`/resources/${created.id}`);
              } catch (err) {
                setFormError(err instanceof Error ? err.message : "Unable to save this resource.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving..." : submitLabel}
          </button>
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--comp-text-primary)]"
            onClick={async () => {
              const next = await generateLearningSession(30);
              window.alert(`Suggested session time: ${String(next.totalEstimatedMinutes || 0)} min`);
            }}
          >
            Preview study fit
          </button>
        </div>
      </div>
    </LmsFrame>
  );
}

export default AddResourcePage;

