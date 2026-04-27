export default function CurrentlyStudyingBadge({ count }: { count?: number | null }) {
  if (!count) return null;
  return (
    <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_5%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-text-primary)]">
      {count} studying today
    </span>
  );
}
