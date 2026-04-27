import { useMemo, useState } from "react";

type Question = {
  id?: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
};

export default function QuizRunner({
  questions,
  onSubmit,
}: {
  questions: Question[];
  onSubmit: (answers: number[]) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const answeredCount = useMemo(() => answers.filter((value) => value !== undefined).length, [answers]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white/80 px-4 py-3 text-sm text-[var(--text-secondary)]">
        {answeredCount} of {questions.length} answered
      </div>
      {questions.map((question, index) => (
        <section key={question.id || index} className="dashboard-card space-y-3 p-4">
          <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">
            {index + 1}. {question.question}
          </h3>
          <div className="grid gap-2">
            {question.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={`rounded-2xl border px-3 py-2 text-left text-sm ${
                  answers[index] === optionIndex
                    ? "border-[var(--info)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--comp-text-primary)]"
                    : "border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white text-[var(--text-secondary)]"
                }`}
                onClick={() => {
                  const next = [...answers];
                  next[index] = optionIndex;
                  setAnswers(next);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ))}
      <button
        className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white"
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(answers);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        {busy ? "Submitting..." : "Submit quiz"}
      </button>
    </div>
  );
}
