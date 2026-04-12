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
    <button
      className="dashboard-card min-h-48 w-full p-6 text-left transition hover:-translate-y-0.5"
      onClick={() => setFlipped((value) => !value)}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {flipped ? "Back" : "Front"}
      </div>
      <p className="text-lg font-semibold text-[#0A3035]">{flipped ? back : front}</p>
    </button>
  );
}
