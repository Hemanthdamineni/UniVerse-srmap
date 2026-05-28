import React, { useState, useEffect, useCallback } from "react";
import { ProgressBar } from "../ui/ProgressBar";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft } from "lucide-react";

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
  const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [busy, setBusy] = useState(false);

  const answeredCount = answers.filter((a) => a !== -1).length;
  const currentQuestion = questions[currentIndex];
  
  // Calculate score if completed and correctIndex is available
  const score = isCompleted ? answers.reduce((acc, answer, idx) => {
    return acc + (answer === questions[idx].correctIndex ? 1 : 0);
  }, 0) : 0;

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (answeredCount === questions.length) {
      setIsCompleted(true);
    }
  }, [currentIndex, questions.length, answeredCount]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleSelect = useCallback((optionIndex: number) => {
    const next = [...answers];
    next[currentIndex] = optionIndex;
    setAnswers(next);
  }, [answers, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (isCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Numbers 1-4 for options
      const keyMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (keyMap[e.key] !== undefined && keyMap[e.key] < currentQuestion.options.length) {
        handleSelect(keyMap[e.key]);
      }
      
      if (e.key === 'Enter' && answers[currentIndex] !== -1) {
        handleNext();
      }
      if (e.key === 'ArrowRight' && answers[currentIndex] !== -1) {
        handleNext();
      }
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion, answers, handleNext, handlePrev, handleSelect, isCompleted]);

  if (questions.length === 0) return null;

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-2xl shadow-sm text-center">
        <div className="w-20 h-20 rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-[var(--comp-accent)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Quiz Completed!</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          You've answered all {questions.length} questions.
        </p>
        
        {questions[0].correctIndex !== undefined && (
          <div className="mb-8 p-6 bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] rounded-xl border border-[var(--border)] w-full max-w-sm">
            <div className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Score</div>
            <div className="text-4xl font-bold text-[var(--text-primary)]">
              {score} <span className="text-lg text-[var(--text-secondary)] font-normal">/ {questions.length}</span>
            </div>
          </div>
        )}

        <button
          className="rounded-xl bg-[var(--comp-accent)] px-8 py-3.5 text-base font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
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
          {busy ? "Submitting..." : "Submit Results"}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col min-h-[60vh] bg-[var(--background)]">
      {/* Sticky Top Shell */}
      <div className="sticky top-0 z-10 bg-[var(--background)] pt-4 pb-6 border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="text-sm font-medium text-[var(--comp-accent)] bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] px-3 py-1 rounded-full">
            {answeredCount} Answered
          </div>
        </div>
        <ProgressBar value={answeredCount} max={questions.length} height={6} className="bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
      </div>

      {/* Question Focus Area */}
      <div className="flex-1 flex flex-col justify-center py-8">
        <div 
          key={currentIndex} 
          className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
        >
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] leading-snug mb-8">
            {currentQuestion.question}
          </h1>

          <div className="grid gap-3">
            {currentQuestion.options.map((option, optionIndex) => {
              const isSelected = answers[currentIndex] === optionIndex;
              return (
                <button
                  key={optionIndex}
                  onClick={() => handleSelect(optionIndex)}
                  className={`
                    group relative flex items-center p-4 rounded-2xl border-2 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)]
                    ${isSelected 
                      ? 'border-[var(--comp-accent)] bg-[color-mix(in_srgb,var(--comp-accent)_5%,transparent)] shadow-[0_0_0_1px_var(--comp-accent)]' 
                      : 'border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[var(--surface)] hover:border-[var(--comp-accent)] hover:bg-[color-mix(in_srgb,var(--comp-accent)_2%,transparent)]'
                    }
                  `}
                >
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 mr-4 transition-colors font-semibold text-sm
                    ${isSelected 
                      ? 'border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white' 
                      : 'border-[var(--border)] text-[var(--text-secondary)] group-hover:border-[var(--comp-accent)] group-hover:text-[var(--comp-accent)]'
                    }
                  `}>
                    {optionIndex + 1}
                  </div>
                  <span className={`text-base font-medium ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="py-6 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--border)_50%,transparent)]">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center px-4 py-2.5 rounded-xl text-[var(--text-secondary)] font-medium transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={answers[currentIndex] === -1}
          className="flex items-center px-6 py-2.5 rounded-xl bg-[var(--comp-accent)] text-white font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {currentIndex === questions.length - 1 ? 'Finish' : 'Next'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
