import { useState } from "react";

export default function FlipCard({
  front,
  back,
}: {
  front: string;
  back: string;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button aria-label="Action"
      className="group relative w-full text-left outline-none"
      onClick={() => setFlipped((value) => !value)}
      style={{ perspective: "1000px" }}
      aria-label={flipped ? "Show front" : "Show back"}
    >
      <div
        className="w-full relative grid"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front Face */}
        <div
          className="dashboard-card col-start-1 row-start-1 w-full min-h-48 p-6 flex flex-col"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="mb-3 flex justify-between items-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            <span>Front</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity">
              Tap to flip ↩
            </span>
          </div>
          <p className="text-lg font-semibold text-[var(--comp-text-primary)] whitespace-pre-wrap">{front}</p>
        </div>

        {/* Back Face */}
        <div
          className="dashboard-card col-start-1 row-start-1 w-full min-h-48 p-6 flex flex-col"
          style={{ 
            backfaceVisibility: "hidden", 
            transform: "rotateY(180deg)",
            background: "color-mix(in srgb, var(--comp-surface) 96%, var(--comp-accent))"
          }}
        >
          <div className="mb-3 flex justify-between items-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            <span>Back</span>
            <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity">
              Tap to flip ↩
            </span>
          </div>
          <p className="text-lg font-semibold text-[var(--comp-text-primary)] whitespace-pre-wrap">{back}</p>
        </div>
      </div>
    </button>
  );
}
