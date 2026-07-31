import { useState } from "react";
import type { LmsRequest } from "../../lib/lms/index";

export default function RequestCard({
  request,
  onUpvote,
}: {
  request: LmsRequest;
  onUpvote?: (id: string) => Promise<void>;
}) {
  const [upvoted, setUpvoted] = useState(false);
  const [count, setCount] = useState(request.upvotes ?? 0);
  const [busy, setBusy] = useState(false);

  async function handleUpvote() {
    if (busy || upvoted) return;
    setBusy(true);
    try {
      await onUpvote?.(request.id);
      setCount((c) => c + 1);
      setUpvoted(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        background: "var(--comp-surface)",
        borderColor: "var(--comp-border)",
      }}
    >
      {/* Upvote */}
      <button
        type="button"
        aria-label={upvoted ? "Upvoted" : "Upvote"}
        aria-pressed={upvoted}
        onClick={handleUpvote}
        disabled={busy || upvoted}
        className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums disabled:cursor-default"
        style={{
          background: upvoted
            ? "color-mix(in srgb, var(--comp-accent) 10%, transparent)"
            : "transparent",
          color: upvoted ? "var(--comp-accent)" : "var(--comp-text-muted)",
          border: `1px solid ${upvoted ? "color-mix(in srgb, var(--comp-accent) 25%, transparent)" : "var(--comp-border)"}`,
          transition: "background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)",
          minWidth: 36,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={upvoted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
        {count}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">
          {request.title}
        </h3>
        {request.description && (
          <p className="text-xs leading-5 text-[var(--comp-text-secondary)]">
            {request.description}
          </p>
        )}
        <p className="text-xs text-[var(--comp-text-muted)]">
          {[request.subjectCode, request.semester && `Sem ${request.semester}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </article>
  );
}
