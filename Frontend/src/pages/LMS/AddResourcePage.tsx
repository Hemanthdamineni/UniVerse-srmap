import {
  useState,
  useEffect,
  useNavigate,
  useSearchParams,
  SectionCard,
  InlineError,
  DuplicateWarning,
  createLmsResource,
  getLmsResource,
  updateLmsResource,
  checkLmsDuplicate,
  buildResourcePayload,
  createEmptyResourceForm,
  resourceToForm,
  generateLearningSession,
  useAsyncPage,
  LmsFrame
} from "./_shared/LmsPageShared";
import type {
  LmsResource,
  ResourceFormState
} from "./_shared/LmsPageShared";

const RESOURCE_TYPES = [
  { value: "note", label: "Note" },
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
  { value: "quiz", label: "Quiz" },
  { value: "flashcard", label: "Flashcard" },
  { value: "pyq", label: "PYQ" },
] as const;

const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const EXAM_TYPES = [
  { value: "mid-semester", label: "Mid-semester" },
  { value: "end-semester", label: "End-semester" },
  { value: "supplementary", label: "Supplementary" },
  { value: "model", label: "Model" },
] as const;

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type FlashcardCard = {
  id: string;
  front: string;
  back: string;
};

export function AddResourcePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") || "";
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [duplicate, setDuplicate] = useState<{ exact?: { title: string } | null; similar?: unknown[] } | null>(null);
  const [readingTimePreview, setReadingTimePreview] = useState<number | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ exact?: { title: string } | null; similar?: unknown[] } | null>(null);

  const [form, setForm] = useState<ResourceFormState>(() => createEmptyResourceForm());
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [flashcardCards, setFlashcardCards] = useState<FlashcardCard[]>([]);

  const editState = useAsyncPage<LmsResource | null>(
    () => (editId ? getLmsResource(editId) : Promise.resolve(null)),
    [editId]
  );

  // Load existing quiz/flashcard data when editing
  useEffect(() => {
    if (editState.data) {
      setForm(resourceToForm(editState.data));

      if (editState.data.type === "quiz" && editState.data.structuredContent) {
        const content = editState.data.structuredContent as Record<string, unknown>;
        if (content.questions && Array.isArray(content.questions)) {
          setQuizQuestions(content.questions as unknown as QuizQuestion[]);
        }
      }

      if (editState.data.type === "flashcard" && editState.data.structuredContent) {
        const content = editState.data.structuredContent as Record<string, unknown>;
        if (content.cards && Array.isArray(content.cards)) {
          setFlashcardCards(content.cards as unknown as FlashcardCard[]);
        }
      }
    }
  }, [editState.data?.id]);

  // Generate reading time preview for note/quiz/flashcard
  useEffect(() => {
    if (form.type === "note" && form.noteContent) {
      const words = form.noteContent.trim().split(/\s+/).filter(Boolean).length;
      setReadingTimePreview(Math.max(1, Math.ceil(words / 200)));
    } else if (form.type === "quiz" && quizQuestions.length > 0) {
      setReadingTimePreview(Math.max(5, quizQuestions.length * 2));
    } else if (form.type === "flashcard" && flashcardCards.length > 0) {
      setReadingTimePreview(Math.max(5, Math.ceil(flashcardCards.length * 0.75)));
    } else {
      setReadingTimePreview(null);
    }
  }, [form.type, form.noteContent, quizQuestions.length, flashcardCards.length]);

  // Check duplicate on title/subject change (debounced)
  useEffect(() => {
    if (!form.title.trim() || !form.subjectCode.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const result = await checkLmsDuplicate({
          title: form.title,
          subjectCode: form.subjectCode,
        });
        setDuplicateWarning(result);
      } catch {
        setDuplicateWarning(null);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [form.title, form.subjectCode]);

  const submitLabel = editId ? "Update resource" : "Create resource";
  const frameTitle = editId ? "Edit Resource" : "Add Resource";

  const validateForm = (): boolean => {
    if (!form.title.trim() || !form.subjectCode.trim() || !form.subjectName.trim() || !form.semester.trim() || !form.unit.trim()) {
      setFormError("Title, subject code, subject name, semester, and unit are required.");
      return false;
    }

    if (!DIFFICULTY_LEVELS.some(d => d.value === form.difficulty)) {
      setFormError("Please select a valid difficulty level.");
      return false;
    }

    if (form.type === "link") {
      if (!form.url?.trim()) {
        setFormError("URL is required for link resources.");
        return false;
      }
      try {
        new URL(form.url!);
      } catch {
        setFormError("Please enter a valid URL.");
        return false;
      }
    }

    if (form.type === "note") {
      if (!form.noteContent?.trim()) {
        setFormError("Note content is required.");
        return false;
      }
    }

    if (form.type === "file") {
      if (!form.file) {
        setFormError("File is required for file resources.");
        return false;
      }
    }

    if (form.type === "pyq") {
      if (!form.file) {
        setFormError("File is required for PYQ resources.");
        return false;
      }
      if (!form.examYear?.trim()) {
        setFormError("Exam year is required for PYQ resources.");
        return false;
      }
      if (!form.examType?.trim()) {
        setFormError("Exam type is required for PYQ resources.");
        return false;
      }
      if (!EXAM_TYPES.some(e => e.value === form.examType)) {
        setFormError("Please select a valid exam type.");
        return false;
      }
    }

    if (form.type === "quiz") {
      if (quizQuestions.length === 0) {
        setFormError("At least one quiz question is required.");
        return false;
      }
      for (const q of quizQuestions) {
        if (!q.question.trim()) {
          setFormError("All quiz questions must have text.");
          return false;
        }
        if (q.options.length < 2) {
          setFormError("Each quiz question must have at least 2 options.");
          return false;
        }
        if (q.options.some(opt => !opt.trim())) {
          setFormError("All quiz options must be filled.");
          return false;
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          setFormError("Correct answer index must be valid for each question.");
          return false;
        }
      }
    }

    if (form.type === "flashcard") {
      if (flashcardCards.length === 0) {
        setFormError("At least one flashcard is required.");
        return false;
      }
      for (const card of flashcardCards) {
        if (!card.front.trim() || !card.back.trim()) {
          setFormError("All flashcards must have front and back content.");
          return false;
        }
      }
    }

    return true;
  };

  const buildPayload = () => {
    const basePayload = buildResourcePayload(form);

    if (form.type === "quiz") {
      return {
        ...basePayload,
        structuredContent: { questions: quizQuestions },
      };
    }

    if (form.type === "flashcard") {
      return {
        ...basePayload,
        structuredContent: { cards: flashcardCards },
      };
    }

    // For other types, remove empty fields that shouldn't be sent
    const cleaned = { ...basePayload };
    if (form.type !== "pyq") {
      cleaned.examYear = undefined;
      cleaned.examType = undefined;
      cleaned.examMonth = undefined;
    }
    if (form.type !== "note") {
      cleaned.noteContent = undefined;
    }
    if (form.type !== "link") {
      cleaned.url = undefined;
    }
    if (form.type !== "file" && form.type !== "pyq") {
      cleaned.file = undefined;
    }

    return cleaned;
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!validateForm()) return;

    setBusy(true);
    try {
      const payload = buildPayload();

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

      if (duplicateResult.exact) {
        setFormError(`A resource with this title already exists: "${duplicateResult.exact.title}"`);
        return;
      }

      const created = await createLmsResource(payload);
      navigate(`/resources/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save this resource.");
    } finally {
      setBusy(false);
    }
  };

  // Quiz question handlers
  const addQuizQuestion = () => {
    setQuizQuestions(prev => [
      ...prev,
      { id: crypto.randomUUID(), question: "", options: ["", "", "", ""], correctIndex: 0 },
    ]);
  };

  const removeQuizQuestion = (index: number) => {
    setQuizQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuizQuestion = (index: number, field: keyof QuizQuestion, value: unknown) => {
    setQuizQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const updateQuizOption = (qIndex: number, oIndex: number, value: string) => {
    setQuizQuestions(prev => prev.map((q, i) => {
      if (i !== qIndex) return q;
      const options = [...q.options];
      options[oIndex] = value;
      return { ...q, options };
    }));
  };

  const setQuizCorrectAnswer = (qIndex: number, index: number) => {
    setQuizQuestions(prev => prev.map((q, i) => i === qIndex ? { ...q, correctIndex: index } : q));
  };

  // Flashcard handlers
  const addFlashcardCard = () => {
    setFlashcardCards(prev => [
      ...prev,
      { id: crypto.randomUUID(), front: "", back: "" },
    ]);
  };

  const removeFlashcardCard = (index: number) => {
    setFlashcardCards(prev => prev.filter((_, i) => i !== index));
  };

  const updateFlashcardCard = (index: number, field: "front" | "back", value: string) => {
    setFlashcardCards(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  return (
    <LmsFrame title={frameTitle} loading={Boolean(editId && editState.loading)} error={editState.error}>
      <div className="dashboard-card grid gap-4 p-5">
        <DuplicateWarning exact={duplicateWarning?.exact || null} similarCount={duplicateWarning?.similar?.length || 0} />
        {formError ? <InlineError message={formError} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="lms-input"
            placeholder="Title"
            aria-label="Title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <select
            className="lms-input"
            aria-label="Type"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          >
            {RESOURCE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            className="lms-input"
            placeholder="Semester"
            aria-label="Semester"
            value={form.semester}
            onChange={(event) => setForm({ ...form, semester: event.target.value })}
          />
          <input
            className="lms-input"
            placeholder="Subject code"
            aria-label="Subject code"
            value={form.subjectCode}
            onChange={(event) => setForm({ ...form, subjectCode: event.target.value.toUpperCase() })}
          />
          <input
            className="lms-input"
            placeholder="Subject name"
            aria-label="Subject name"
            value={form.subjectName}
            onChange={(event) => setForm({ ...form, subjectName: event.target.value })}
          />
          <input
            className="lms-input"
            placeholder="Unit"
            aria-label="Unit"
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
          />
          <select
            className="lms-input"
            aria-label="Difficulty"
            value={form.difficulty}
            onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
          >
            {DIFFICULTY_LEVELS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <input
            className="lms-input"
            placeholder="Tags comma separated"
            aria-label="Tags"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
          />
        </div>

        <textarea
          className="min-h-24 lms-input"
          placeholder="Description"
          aria-label="Description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />

        {/* Type-specific fields */}
        {form.type === "link" && (
          <div className="grid gap-3">
            <input
              className="lms-input"
              placeholder="URL (e.g., https://example.com)"
              aria-label="URL"
              type="url"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
            />
            <p className="text-xs text-[var(--text-secondary)]">
              The backend will auto-detect the render type (YouTube, PDF, external page, etc.) from the URL.
            </p>
          </div>
        )}

        {form.type === "note" && (
          <div className="grid gap-3">
            <textarea
              className="min-h-48 lms-input"
              placeholder="Note content (Markdown supported)"
              aria-label="Note content"
              value={form.noteContent}
              onChange={(event) => setForm({ ...form, noteContent: event.target.value })}
            />
            {readingTimePreview && (
              <p className="text-xs text-[var(--text-secondary)]">
                Estimated reading time: {readingTimePreview} minute{readingTimePreview !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {(form.type === "file" || form.type === "pyq") && (
          <div className="grid gap-3">
            <div className="border-2 border-dashed border-[var(--comp-border)] rounded-lg p-6 text-center">
              <input
                type="file"
                className="sr-only"
                id="file-upload"
                onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })}
                accept=".pdf,.zip,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <p className="text-[var(--comp-text-primary)] font-medium">Click or drag to upload a file</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Accepted: PDF, ZIP, DOCX, PPTX, TXT, MD, PNG, JPG (max 25MB)
                </p>
              </label>
            </div>
            {form.file && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--comp-surface)]">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <div>
                    <p className="text-sm font-medium text-[var(--comp-text-primary)]">{form.file.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{(form.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-[var(--error)] hover:underline"
                  onClick={() => setForm({ ...form, file: null })}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

        {form.type === "pyq" && (
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="lms-input"
              placeholder="Exam Year (e.g., 2024)"
              aria-label="Exam Year"
              value={form.examYear}
              onChange={(event) => setForm({ ...form, examYear: event.target.value })}
            />
            <select
              className="lms-input"
              aria-label="Exam Type"
              value={form.examType}
              onChange={(event) => setForm({ ...form, examType: event.target.value })}
            >
              <option value="">Select exam type</option>
              {EXAM_TYPES.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            <input
              className="lms-input"
              placeholder="Exam Month (optional, e.g., May)"
              aria-label="Exam Month"
              value={form.examMonth}
              onChange={(event) => setForm({ ...form, examMonth: event.target.value })}
            />
          </div>
        )}

        {form.type === "quiz" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-[var(--comp-text-primary)]">Quiz Questions</h4>
              <button
                type="button"
                className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={addQuizQuestion}
              >
                + Add Question
              </button>
            </div>

            {quizQuestions.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                Add at least one question to create a quiz resource.
              </p>
            )}

            {quizQuestions.map((q, qIndex) => (
              <div key={q.id} className="dashboard-card p-4 space-y-3 border border-[var(--comp-border)]">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-[var(--comp-text-primary)]">Question {qIndex + 1}</h5>
                  <button
                    type="button"
                    className="text-xs text-[var(--error)] hover:underline"
                    onClick={() => removeQuizQuestion(qIndex)}
                    disabled={quizQuestions.length <= 1}
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  className="min-h-20 lms-input"
                  placeholder="Question text"
                  aria-label={`Question ${qIndex + 1}`}
                  value={q.question}
                  onChange={(event) => updateQuizQuestion(qIndex, "question", event.target.value)}
                />

                <div className="grid gap-2">
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctIndex === oIndex}
                        onChange={() => setQuizCorrectAnswer(qIndex, oIndex)}
                        className="w-4 h-4 accent-[var(--comp-accent)]"
                        aria-label={`Mark option ${oIndex + 1} as correct`}
                      />
                      <input
                        className="lms-input flex-1"
                        placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                        aria-label={`Option ${String.fromCharCode(65 + oIndex)}`}
                        value={opt}
                        onChange={(event) => updateQuizOption(qIndex, oIndex, event.target.value)}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          className="text-xs text-[var(--error)] hover:underline px-2"
                          onClick={() => updateQuizQuestion(qIndex, "options", q.options.filter((_, i) => i !== oIndex))}
                          aria-label={`Remove option ${String.fromCharCode(65 + oIndex)}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      className="text-sm text-[var(--comp-accent)] hover:underline"
                      onClick={() => updateQuizQuestion(qIndex, "options", [...q.options, ""])}
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <input
                  className="lms-input"
                  placeholder="Explanation (optional)"
                  aria-label={`Explanation for question ${qIndex + 1}`}
                  value={q.explanation || ""}
                  onChange={(event) => updateQuizQuestion(qIndex, "explanation", event.target.value)}
                />
              </div>
            ))}

            {quizQuestions.length > 0 && readingTimePreview && (
              <p className="text-xs text-[var(--text-secondary)]">
                Estimated completion time: {readingTimePreview} minute{readingTimePreview !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {form.type === "flashcard" && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-[var(--comp-text-primary)]">Flashcards</h4>
              <button
                type="button"
                className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={addFlashcardCard}
              >
                + Add Card
              </button>
            </div>

            {flashcardCards.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                Add at least one card to create a flashcard resource.
              </p>
            )}

            {flashcardCards.map((card, cIndex) => (
              <div key={card.id} className="dashboard-card p-4 space-y-3 border border-[var(--comp-border)]">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-[var(--comp-text-primary)]">Card {cIndex + 1}</h5>
                  <button
                    type="button"
                    className="text-xs text-[var(--error)] hover:underline"
                    onClick={() => removeFlashcardCard(cIndex)}
                    disabled={flashcardCards.length <= 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <textarea
                    className="min-h-20 lms-input"
                    placeholder="Front (question/prompt)"
                    aria-label={`Card ${cIndex + 1} front`}
                    value={card.front}
                    onChange={(event) => updateFlashcardCard(cIndex, "front", event.target.value)}
                  />
                  <textarea
                    className="min-h-20 lms-input"
                    placeholder="Back (answer/content)"
                    aria-label={`Card ${cIndex + 1} back`}
                    value={card.back}
                    onChange={(event) => updateFlashcardCard(cIndex, "back", event.target.value)}
                  />
                </div>
              </div>
            ))}

            {flashcardCards.length > 0 && readingTimePreview && (
              <p className="text-xs text-[var(--text-secondary)]">
                Estimated study time: {readingTimePreview} minute{readingTimePreview !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white"
            disabled={busy}
            onClick={handleSubmit}
          >
            {busy ? "Saving..." : submitLabel}
          </button>
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--comp-text-primary)]"
            onClick={async () => {
              setSessionMessage("");
              try {
                const next = (await generateLearningSession(30)) as { durationMinutes?: number; totalEstimatedMinutes?: number; resources?: unknown[]; revision?: unknown[] };
                const count = (next.resources || []).length + (next.revision || []).length;
                setSessionMessage(
                  `Suggested a ${String(next.durationMinutes || 30)} min session: ${count} item${count === 1 ? "" : "s"} picked from your revision queue and subjects.`
                );
              } catch (error) {
                setSessionMessage(error instanceof Error ? error.message : "Could not suggest a session right now.");
              }
            }}
          >
            Suggest session
          </button>
        </div>
        {sessionMessage ? (
          <p className="text-sm font-medium" style={{ color: "var(--info)" }}>
            {sessionMessage}
          </p>
        ) : null}
      </div>
    </LmsFrame>
  );
}

export default AddResourcePage;