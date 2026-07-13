
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
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
      Exam Proven
    </span>
  );
}


// ── ReadingTimeChip ─────────────────────────────────────────────────────

export function ReadingTimeChip({ minutes }: { minutes?: number | null }) {
  if (!minutes || minutes <= 0) return null;
  return (
    <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] bg-white/80 px-2.5 py-1 text-xs font-medium text-[var(--comp-text-primary)]">
      ~{minutes} min
    </span>
  );
}


// ── ValidityChip ─────────────────────────────────────────────────────

export function ValidityChip({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
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
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm text-amber-900">
      {exact
        ? `An exact duplicate already exists: ${exact.title}`
        : `${similarCount} similar resource${similarCount === 1 ? "" : "s"} already exist for this subject.`}
    </div>
  );
}

