export default function ReadingTimeChip({ minutes }: { minutes?: number | null }) {
  if (!minutes || minutes <= 0) return null;
  return (
    <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] bg-white/80 px-2.5 py-1 text-xs font-medium text-[var(--comp-text-primary)]">
      ~{minutes} min
    </span>
  );
}
