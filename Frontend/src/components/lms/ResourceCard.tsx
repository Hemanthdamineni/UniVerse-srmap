import { Link } from "react-router-dom";
import type { LmsResource } from "../../lib/lmsApi";
import ReadingTimeChip from "./ReadingTimeChip";
import ExamProvenBadge from "./ExamProvenBadge";
import CurrentlyStudyingBadge from "./CurrentlyStudyingBadge";
import ValidityChip from "./ValidityChip";

export default function ResourceCard({
  resource,
  studyingCount,
}: {
  resource: LmsResource;
  studyingCount?: number | null;
}) {
  return (
    <article className="dashboard-card flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-primary)]">
          {resource.type}
        </span>
        <ReadingTimeChip minutes={resource.estimatedMinutes ?? undefined} />
        <ExamProvenBadge score={resource.examProvenScore} />
        <ValidityChip value={resource.validForSemester} />
        {resource.moderation?.needsReview ? (
          <span className="rounded-full border border-[color-mix(in_srgb,var(--warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
            {resource.moderation.label}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <Link
          to={`/resources/${resource.id}`}
          className="text-lg font-semibold text-[var(--comp-text-primary)] transition hover:text-[var(--info)]"
        >
          {resource.title}
        </Link>
        <p className="text-sm text-[var(--text-secondary)]">
          {resource.subjectCode} • {resource.subjectName}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {resource.unit}
        </p>
      </div>
      <p className="line-clamp-3 text-sm text-[var(--text-secondary)]">
        {resource.description || "No description provided."}
      </p>
      {resource.publisher ? (
        <div className="rounded-lg border border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-accent)_4%,transparent)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <Link
            to={`/resources/contributors/${encodeURIComponent(resource.publisher.userId)}`}
            className="font-semibold text-[var(--comp-text-primary)] no-underline hover:text-[var(--info)]"
          >
            {resource.publisher.displayName}
          </Link>
          <span className="mx-2">Trust {resource.publisher.trustScore}</span>
          <span>{resource.publisher.approvedCount}/{resource.publisher.contributionCount} approved</span>
        </div>
      ) : null}
      {resource.reasons?.length ? (
        <div className="space-y-1 text-xs text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--comp-text-primary)]">Why this is recommended</p>
          <div className="flex flex-wrap gap-2">
            {resource.reasons.slice(0, 3).map((reason) => (
              <span key={reason.code} className="rounded-full bg-[var(--comp-surface)] px-2 py-1">
                {reason.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-[var(--text-secondary)]">
        <span>{resource.upvotes} upvotes</span>
        <span>{resource.bookmarkCount} saved</span>
        <span>{resource.commentCount} comments</span>
        <CurrentlyStudyingBadge count={studyingCount} />
      </div>
    </article>
  );
}
