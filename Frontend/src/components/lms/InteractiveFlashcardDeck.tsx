import React, { useState, useEffect, useCallback } from "react";
import { ProgressBar } from "../ui/ProgressBar";
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
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-2xl shadow-sm text-center">
        <div className="w-20 h-20 rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-[var(--comp-accent)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Deck Completed!</h2>
        
        <div className="flex gap-6 mt-6 mb-8">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-[var(--success)]">{confidenceStats.gotIt}</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-secondary)] mt-1">Got It</span>
          </div>
          <div className="w-px h-12 bg-[var(--border)]" />
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-[var(--warning)]">{confidenceStats.needPractice}</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-secondary)] mt-1">Practice</span>
          </div>
        </div>

        <button
          className="flex items-center rounded-xl bg-[var(--comp-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          onClick={() => {
            setCurrentIndex(0);
            setCompleted(false);
            setConfidenceStats({ gotIt: 0, needPractice: 0 });
          }}
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
            <div className="absolute inset-0 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-3xl translate-y-3 scale-[0.96] shadow-sm z-0" />
          )}
          {currentIndex < cards.length - 2 && (
            <div className="absolute inset-0 bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-3xl translate-y-6 scale-[0.92] shadow-sm z-0" />
          )}

          <div
            className="w-full h-full relative grid z-10 rounded-3xl shadow-lg border border-[color-mix(in_srgb,var(--border)_95%,transparent)]"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* Front Face */}
            <div
              className="col-start-1 row-start-1 w-full h-full p-8 flex flex-col items-center justify-center bg-[var(--background)] rounded-3xl"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="absolute top-6 left-6 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Front
              </div>
              <p className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] text-center whitespace-pre-wrap leading-snug">
                {currentCard.front}
              </p>
              <div className="absolute bottom-6 text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                Tap or Space to flip
              </div>
            </div>

            {/* Back Face */}
            <div
              className="col-start-1 row-start-1 w-full h-full p-8 flex flex-col items-center justify-center rounded-3xl"
              style={{ 
                backfaceVisibility: "hidden", 
                transform: "rotateY(180deg)",
                background: "color-mix(in srgb, var(--comp-surface) 96%, var(--comp-accent))",
                borderColor: "color-mix(in srgb, var(--comp-border) 80%, var(--comp-accent))",
                borderWidth: "1px",
                borderStyle: "solid"
              }}
            >
              <div className="absolute top-6 left-6 text-xs font-semibold uppercase tracking-widest text-[var(--comp-accent)]">
                Back
              </div>
              <p className="text-xl sm:text-2xl font-medium text-[var(--text-primary)] text-center whitespace-pre-wrap leading-relaxed">
                {currentCard.back}
              </p>
            </div>
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
          className="flex-1 max-w-[200px] py-3.5 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-semibold bg-[color-mix(in_srgb,var(--success)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)] transition-colors flex items-center justify-center gap-2"
        >
          Got It
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
