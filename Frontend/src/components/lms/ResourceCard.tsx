import { Link } from "react-router-dom";
import type { LmsResource } from "../../lib/lms/index";
import { ReadingTimeChip, ExamProvenBadge, CurrentlyStudyingBadge, ValidityChip } from "./LmsChips";

// ── Difficulty chip ─────────────────────────────────────────────────────────

const DIFFICULTY: Record<string, { label: string; token: string }> = {
  beginner: { label: "Beginner", token: "--success" },
  intermediate: { label: "Intermediate", token: "--warning" },
  advanced: { label: "Advanced", token: "--error" },
};

function DifficultyChip({ difficulty }: { difficulty?: string | null }) {
  if (!difficulty) return null;
  const d = DIFFICULTY[difficulty.toLowerCase()];
  if (!d) return null;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: `color-mix(in srgb, var(${d.token}) 10%, transparent)`,
        color: `var(${d.token})`,
      }}
    >
      {d.label}
    </span>
  );
}

// ── Main card ───────────────────────────────────────────────────────────────

export default function ResourceCard({
  resource,
  studyingCount,
}: {
  resource: LmsResource;
  studyingCount?: number | null;
}) {
  return (
    <article className="interactive-card flex h-full flex-col gap-3 p-4">
      {/* Type + metadata chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
          style={{
            background: "color-mix(in srgb, var(--comp-accent) 8%, transparent)",
            color: "var(--comp-accent)",
          }}
        >
          {resource.type}
        </span>
        <DifficultyChip difficulty={resource.difficulty} />
        <ReadingTimeChip minutes={resource.estimatedMinutes ?? undefined} />
        <ExamProvenBadge score={resource.examProvenScore} />
        <ValidityChip value={resource.validForSemester} />
        {resource.moderation?.needsReview && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: "color-mix(in srgb, var(--warning) 10%, transparent)",
              color: "var(--warning)",
            }}
          >
            {resource.moderation.label}
          </span>
        )}
      </div>

      {/* Title + subject */}
      <div className="space-y-0.5">
        <Link
          to={`/learn/r/${resource.id}`}
          className="text-sm font-semibold leading-snug text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
        >
          {resource.title}
        </Link>
        <p className="text-xs text-[var(--comp-text-muted)]">
          {[resource.subjectCode, resource.subjectName, resource.unit].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-[var(--comp-text-secondary)]">
          {resource.description}
        </p>
      )}

      {/* Publisher */}
      {resource.publisher && (
        <p className="text-xs text-[var(--comp-text-muted)]">
          by{" "}
          <Link
            to={`/learn/contributors/${encodeURIComponent(resource.publisher.userId)}`}
            className="font-medium text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
          >
            {resource.publisher.displayName}
          </Link>
        </p>
      )}

      {/* Recommendation reasons */}
      {resource.reasons?.length ? (
        <div className="flex flex-wrap gap-1 text-xs">
          {resource.reasons.slice(0, 3).map((reason) => (
            <span
              key={reason.code}
              className="rounded-full border px-2 py-0.5"
              style={{
                borderColor: "var(--comp-border)",
                color: "var(--comp-text-secondary)",
              }}
            >
              {reason.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Footer stats */}
      <div
        className="mt-auto flex items-center gap-4 pt-2 text-xs tabular-nums"
        style={{
          borderTop: "1px solid var(--comp-border)",
          color: "var(--comp-text-muted)",
        }}
      >
        <span>{resource.upvotes} upvotes</span>
        <span>{resource.bookmarkCount} saved</span>
        <span>{resource.commentCount} comments</span>
        <CurrentlyStudyingBadge count={studyingCount} />
      </div>
    </article>
  );
}
