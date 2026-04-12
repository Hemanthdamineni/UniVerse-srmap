export default function OutdatedWarning({ isOutdated }: { isOutdated?: number | boolean }) {
  if (!isOutdated) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      This resource may be outdated.
    </div>
  );
}
