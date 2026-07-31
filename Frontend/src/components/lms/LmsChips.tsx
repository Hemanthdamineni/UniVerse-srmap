
// ── CurrentlyStudyingBadge ─────────────────────────────────────────────────────

export function CurrentlyStudyingBadge({ count }: { count?: number | null }) {
  if (!count) return null;
  return (
    <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_5%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-text-primary)]">
      {count} studying today
    </span>
  );
}


// ── ExamProvenBadge ─────────────────────────────────────────────────────

export function ExamProvenBadge({ score }: { score?: number | null }) {
  if (!score || score <= 2) return null;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: "color-mix(in srgb, var(--success) 12%, transparent)",
        color: "var(--success)",
        border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)",
      }}
    >
      Exam Proven
    </span>
  );
}


// ── ReadingTimeChip ─────────────────────────────────────────────────────

export function ReadingTimeChip({ minutes }: { minutes?: number | null }) {
  if (!minutes || minutes <= 0) return null;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: "color-mix(in srgb, var(--comp-accent) 6%, var(--comp-surface))",
        color: "var(--comp-text-primary)",
        border: "1px solid color-mix(in srgb, var(--comp-accent) 15%, transparent)",
      }}
    >
      ~{minutes} min
    </span>
  );
}


// ── ValidityChip ─────────────────────────────────────────────────────

export function ValidityChip({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: "color-mix(in srgb, var(--info) 10%, transparent)",
        color: "var(--info)",
        border: "1px solid color-mix(in srgb, var(--info) 25%, transparent)",
      }}
    >
      {value}
    </span>
  );
}


// ── OutdatedWarning ─────────────────────────────────────────────────────

export function OutdatedWarning({ isOutdated }: { isOutdated?: number | boolean }) {
  if (!isOutdated) return null;
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm text-[var(--warning)]">
      This resource may be outdated.
    </div>
  );
}


// ── DuplicateWarning ─────────────────────────────────────────────────────

export function DuplicateWarning({
  exact,
  similarCount,
}: {
  exact?: { title: string } | null;
  similarCount?: number;
}) {
  if (!exact && !similarCount) return null;
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm text-[var(--warning)]">
      {exact
        ? `An exact duplicate already exists: ${exact.title}`
        : `${similarCount} similar resource${similarCount === 1 ? "" : "s"} already exist for this subject.`}
    </div>
  );
}
