import React, { useState, useEffect, useCallback } from "react";
import { ProgressBar } from "../ui/Progress";
import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";

export interface FlashcardData {
  front: string;
  back: string;
}

export default function InteractiveFlashcardDeck({ cards }: { cards: FlashcardData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [confidenceStats, setConfidenceStats] = useState({ gotIt: 0, needPractice: 0 });

  // Reset flip when index changes
  useEffect(() => {
    setFlipped(false);
  }, [currentIndex]);

  const handleNext = useCallback((confidence: 'gotIt' | 'needPractice') => {
    setConfidenceStats(prev => ({
      ...prev,
      [confidence]: prev[confidence] + 1
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  }, [currentIndex, cards.length]);

  // Keyboard controls
  useEffect(() => {
    if (completed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(prev => !prev);
      }
      if (flipped) {
        if (e.key === "ArrowRight") handleNext('gotIt');
        if (e.key === "ArrowLeft") handleNext('needPractice');
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipped, completed, handleNext]);

  if (cards.length === 0) return null;

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-2xl shadow-sm">
        <div className="w-20 h-20 rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--comp-text-primary)] mb-3">Well done!</h3>
        <p className="text-[var(--text-secondary)] mb-6 text-center max-w-md">
          You got <span className="font-bold text-[var(--success)]">{confidenceStats.gotIt}</span> correct and need to review <span className="font-bold text-[var(--warning)]">{confidenceStats.needPractice}</span> more.
        </p>
        <button
          onClick={() => {
            setCurrentIndex(0);
            setCompleted(false);
            setConfidenceStats({ gotIt: 0, needPractice: 0 });
          }}
          className="flex items-center rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Review Again
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[60vh]">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Card {currentIndex + 1} of {cards.length}
          </span>
          <span className="text-sm font-medium text-[var(--comp-accent)]">
            {Math.round((currentIndex / cards.length) * 100)}%
          </span>
        </div>
        <ProgressBar value={currentIndex} max={cards.length} height={6} className="bg-[color-mix(in_srgb,var(--border)_50%,transparent)]" />
      </div>

      {/* 3D Card Area */}
      <div className="flex-1 flex flex-col items-center justify-center perspective-[1000px] mb-8">
        <button
          className="group relative w-full h-80 outline-none cursor-pointer"
          onClick={() => setFlipped(prev => !prev)}
          style={{ transformStyle: "preserve-3d" }}
          aria-label={flipped ? "Show front" : "Show back"}
        >
          {/* Subtle stack effect for upcoming cards */}
          {currentIndex < cards.length - 1 && (
            <div className="absolute inset-0 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] rounded-3xl shadow-sm"
              style={{ transform: "translateZ(-20px) scale(0.95)", opacity: 0.5 }}
            />
          )}

          {/* Main Card */}
          <div
            className="absolute inset-0 w-full h-full bg-[var(--comp-surface)] border-2 border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] rounded-3xl shadow-lg overflow-hidden p-8 flex flex-col items-center justify-center text-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <p className="text-2xl md:text-3xl font-bold text-[var(--comp-text-primary)] leading-relaxed">
              {currentCard.front}
            </p>
            <p className="absolute bottom-6 text-xs text-[var(--text-secondary)] opacity-50">
              Tap to flip
            </p>
          </div>

          {/* Back Side */}
          <div
            className="absolute inset-0 w-full h-full bg-[color-mix(in_srgb,var(--comp-accent)_5%,var(--comp-surface))] border-2 border-[color-mix(in_srgb,var(--comp-accent)_30%,transparent)] rounded-3xl shadow-lg overflow-hidden p-8 flex flex-col items-center justify-center text-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <p className="text-xl md:text-2xl font-medium text-[var(--comp-text-primary)] leading-relaxed whitespace-pre-wrap">
              {currentCard.back}
            </p>
            <p className="absolute bottom-6 text-xs text-[var(--text-secondary)] opacity-50">
              Tap to flip back
            </p>
          </div>
        </button>
      </div>

      {/* Confidence Actions (Only visible when flipped) */}
      <div
        className={`flex items-center justify-center gap-4 transition-all duration-300 ${
          flipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={() => handleNext('needPractice')}
          className="flex-1 max-w-[200px] py-3.5 rounded-xl border-2 border-[var(--warning)] text-[var(--warning)] font-semibold bg-[color-mix(in_srgb,var(--warning)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] transition-colors"
        >
          Need Practice
        </button>
        <button
          onClick={() => handleNext('gotIt')}
          className="flex-1 max-w-[200px] py-3.5 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-semibold bg-[color-mix(in_srgb,var(--success)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)] transition-colors"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
