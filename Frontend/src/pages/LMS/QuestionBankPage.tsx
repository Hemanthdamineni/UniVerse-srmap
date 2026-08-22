import {
  useState,
  SectionCard,
  InlineError,
  buildQuizFromQuestionBank,
  createQuestionBankItem,
  listQuestionBank,
  upvoteQuestionBankItem,
  useAsyncPage,
  LmsFrame
} from "./_shared/LmsPageShared";
import type {
  LmsGuide,
  LmsRequest,
  LmsResource,
  LmsRoadmap,
  ResourceFilterState,
  ResourceFormState
} from "./_shared/LmsPageShared";
import type { QuestionBankItem, LmsPagination } from "../../lib/lms/resources";
import { Markdown } from "../../components/markdown";

const QUESTION_DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

type QuestionFormState = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  unit: string;
  topicId: string;
};

export function QuestionBankPage() {
  const [subjectCode, setSubjectCode] = useState("");
  const [questionForm, setQuestionForm] = useState<QuestionFormState>({
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    difficulty: "medium",
    unit: "",
    topicId: "",
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [quizMessage, setQuizMessage] = useState("");

  const { data, setData, loading, error } = useAsyncPage<{ items: QuestionBankItem[]; pagination: LmsPagination }>(
    () => (subjectCode ? listQuestionBank({ subjectCode, limit: 50, page: 1 }) : Promise.resolve({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } as LmsPagination })),
    [subjectCode]
  );

  const validateQuestionForm = (): boolean => {
    if (!questionForm.question.trim()) {
      setFormError("Question text is required.");
      return false;
    }
    if (!subjectCode.trim()) {
      setFormError("Subject code is required.");
      return false;
    }
    const validOptions = questionForm.options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setFormError("At least two options are required.");
      return false;
    }
    if (questionForm.correctIndex < 0 || questionForm.correctIndex >= validOptions.length) {
      setFormError("Correct answer must be one of the provided options.");
      return false;
    }
    if (questionForm.difficulty && !QUESTION_DIFFICULTIES.some(d => d.value === questionForm.difficulty)) {
      setFormError("Please select a valid difficulty level.");
      return false;
    }
    return true;
  };

  const handleAddQuestion = async () => {
    setFormError("");
    if (!validateQuestionForm()) return;

    setBusy(true);
    try {
      const validOptions = questionForm.options.filter(opt => opt.trim());
      const correctIndex = Math.min(questionForm.correctIndex, validOptions.length - 1);

      await createQuestionBankItem({
        subjectCode,
        unit: questionForm.unit || undefined,
        topicId: questionForm.topicId || undefined,
        question: questionForm.question,
        options: validOptions,
        correctIndex,
        explanation: questionForm.explanation || undefined,
        difficulty: questionForm.difficulty,
      });

      // Reset form
      setQuestionForm({
        question: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        explanation: "",
        difficulty: "medium",
        unit: "",
        topicId: "",
      });

      const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
      setData(next);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to add question.");
    } finally {
      setBusy(false);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    setQuestionForm(prev => {
      const options = [...prev.options];
      options[index] = value;
      return { ...prev, options };
    });
  };

  const addOption = () => {
    if (questionForm.options.length >= 6) return;
    setQuestionForm(prev => ({ ...prev, options: [...prev.options, ""] }));
  };

  const removeOption = (index: number) => {
    if (questionForm.options.length <= 2) return;
    setQuestionForm(prev => {
      const options = prev.options.filter((_, i) => i !== index);
      // Adjust correctIndex if needed
      let correctIndex = prev.correctIndex;
      if (correctIndex >= options.length) {
        correctIndex = options.length - 1;
      }
      if (correctIndex < 0) correctIndex = 0;
      return { ...prev, options, correctIndex };
    });
  };

  const selectCorrectAnswer = (index: number) => {
    setQuestionForm(prev => ({ ...prev, correctIndex: index }));
  };

  return (
    <LmsFrame title="Question Bank" loading={loading} error={error}>
      <SectionCard title="Contribute Question">
        {formError ? <InlineError message={formError} /> : null}
        <div className="grid gap-3">
          <input
            className="lms-input"
            placeholder="Subject code (e.g., CSE301)"
            aria-label="Subject code"
            value={subjectCode}
            onChange={(event) => setSubjectCode(event.target.value.toUpperCase())}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="lms-input"
              placeholder="Unit (optional)"
              aria-label="Unit"
              value={questionForm.unit}
              onChange={(event) => setQuestionForm({ ...questionForm, unit: event.target.value })}
            />
            <select
              className="lms-input"
              aria-label="Difficulty"
              value={questionForm.difficulty}
              onChange={(event) => setQuestionForm({ ...questionForm, difficulty: event.target.value })}
            >
              {QUESTION_DIFFICULTIES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <textarea
            className="min-h-24 lms-input"
            placeholder="Question"
            aria-label="Question"
            value={questionForm.question}
            onChange={(event) => setQuestionForm({ ...questionForm, question: event.target.value })}
          />

          <div className="grid gap-3">
            <h4 className="font-medium text-[var(--comp-text-primary)]">Options</h4>

            {questionForm.options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={questionForm.correctIndex === index}
                  onChange={() => selectCorrectAnswer(index)}
                  className="w-4 h-4 accent-[var(--comp-accent)]"
                  aria-label={`Mark option ${String.fromCharCode(65 + index)} as correct`}
                />
                <input
                  className="lms-input flex-1"
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  aria-label={`Option ${String.fromCharCode(65 + index)}`}
                  value={opt}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                />
                {questionForm.options.length > 2 && (
                  <button
                    type="button"
                    className="text-xs text-[var(--error)] hover:underline px-2"
                    onClick={() => removeOption(index)}
                    aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            {questionForm.options.length < 6 && (
              <button
                type="button"
                className="text-sm text-[var(--comp-accent)] hover:underline"
                onClick={addOption}
              >
                + Add Option
              </button>
            )}
          </div>

          <input
            className="lms-input"
            placeholder="Explanation (optional)"
            aria-label="Explanation"
            value={questionForm.explanation}
            onChange={(event) => setQuestionForm({ ...questionForm, explanation: event.target.value })}
          />

          <div className="flex gap-3">
            <button
              className="rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white"
              disabled={busy}
              onClick={handleAddQuestion}
            >
              {busy ? "Adding..." : "Add question"}
            </button>
            <button
              className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--comp-text-primary)]"
              onClick={async () => {
                setQuizMessage("");
                try {
                  const quiz = await buildQuizFromQuestionBank({ subjectCode, count: 5 });
                  setQuizMessage(`Generated a practice quiz with ${quiz.count} questions.`);
                } catch (error) {
                  setQuizMessage(error instanceof Error ? error.message : "Could not build a quiz for this subject yet.");
                }
              }}
              disabled={!subjectCode.trim()}
            >
              Build quiz
            </button>
          </div>
          {quizMessage ? (
            <p className="text-sm font-medium" style={{ color: "var(--info)" }}>
              {quizMessage}
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={`Browse Questions ${subjectCode ? `(${subjectCode})` : ""}`}>
        <div className="space-y-3">
          {(data?.items || []).map((item) => (
            <div key={String(item.id)} className="dashboard-card space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[var(--comp-text-primary)] flex-1">{String(item.question || "")}</h3>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium shrink-0" style={{
                  background: `color-mix(in srgb, var(--${item.difficulty === "easy" ? "success" : item.difficulty === "medium" ? "warning" : "error"}) 10%, transparent)`,
                  color: `var(--${item.difficulty === "easy" ? "success" : item.difficulty === "medium" ? "warning" : "error"})`,
                }}>
                  {item.difficulty || "—"}
                </span>
              </div>

              {item.unit && (
                <p className="text-xs text-[var(--text-secondary)]">Unit: {String(item.unit)}</p>
              )}

              <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                {(Array.isArray(item.options) ? item.options : []).map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2"
                    style={{
                      background: index === item.correctIndex
                        ? "color-mix(in srgb, var(--success) 8%, transparent)"
                        : "transparent",
                      borderRadius: "4px",
                      padding: "2px 6px",
                    }}
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-medium rounded-full shrink-0" style={{
                      background: index === item.correctIndex ? "var(--success)" : "var(--comp-border)",
                      color: index === item.correctIndex ? "white" : "var(--comp-text-secondary)",
                    }}>
                      {index === item.correctIndex ? "✓" : String.fromCharCode(65 + index)}
                    </span>
                    <span>{String(option)}</span>
                  </div>
                ))}
              </div>

              {item.explanation && (
                <div className="text-xs italic text-[var(--text-secondary)]">
                  <span className="font-medium not-italic">Explanation:</span>{" "}
                  <Markdown>{String(item.explanation)}</Markdown>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-[var(--comp-border)]">
                <button
                  className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={async () => {
                    await upvoteQuestionBankItem(String(item.id));
                    const next = await listQuestionBank({ subjectCode, limit: 50, page: 1 });
                    setData(next as { items: QuestionBankItem[]; pagination: LmsPagination });
                  }}
                >
                  Upvote {item.upvotes ?? 0}
                </button>
                {item.contributedBy && (
                  <span className="text-xs text-[var(--text-secondary)]">By {String(item.contributedBy)}</span>
                )}
              </div>
            </div>
          ))}

          {(data?.items || []).length === 0 && subjectCode && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              No questions found for this subject code. Add the first one above!
            </p>
          )}
        </div>
      </SectionCard>
    </LmsFrame>
  );
}

export default QuestionBankPage;