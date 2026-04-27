import type { LmsRequest } from "../../lib/lmsApi";

export default function RequestCard({
  request,
  onUpvote,
}: {
  request: LmsRequest;
  onUpvote?: (id: string) => Promise<void>;
}) {
  return (
    <article className="dashboard-card flex items-start justify-between gap-4 p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{request.title}</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          {request.subjectCode} • {request.semester}
        </p>
        {request.description ? (
          <p className="text-sm text-[var(--text-secondary)]">{request.description}</p>
        ) : null}
      </div>
      <button
        className="rounded-full bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-white"
        onClick={() => onUpvote?.(request.id)}
      >
        {request.upvotes} upvotes
      </button>
    </article>
  );
}
