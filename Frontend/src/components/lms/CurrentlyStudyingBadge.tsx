export default function CurrentlyStudyingBadge({ count }: { count?: number | null }) {
  if (!count) return null;
  return (
    <span className="inline-flex rounded-full border border-[#0A3035]/10 bg-[#0A3035]/5 px-2.5 py-1 text-xs font-medium text-[#0A3035]">
      {count} studying today
    </span>
  );
}
