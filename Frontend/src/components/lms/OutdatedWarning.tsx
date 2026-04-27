export default function OutdatedWarning({ isOutdated }: { isOutdated?: number | boolean }) {
  if (!isOutdated) return null;
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-sm text-[var(--warning)]">
      This resource may be outdated.
    </div>
  );
}
