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
      <div className="rounded-2xl border border-[#0A3035]/10 bg-white/80 px-4 py-3 text-sm text-[var(--text-secondary)]">
        {answeredCount} of {questions.length} answered
      </div>
      {questions.map((question, index) => (
        <section key={question.id || index} className="dashboard-card space-y-3 p-4">
          <h3 className="text-base font-semibold text-[#0A3035]">
            {index + 1}. {question.question}
          </h3>
          <div className="grid gap-2">
            {question.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={`rounded-2xl border px-3 py-2 text-left text-sm ${
                  answers[index] === optionIndex
                    ? "border-[#34AEBE] bg-[#34AEBE]/10 text-[#0A3035]"
                    : "border-[#0A3035]/10 bg-white text-[var(--text-secondary)]"
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
        className="rounded-full bg-[#0A3035] px-5 py-2.5 text-sm font-semibold text-white"
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
