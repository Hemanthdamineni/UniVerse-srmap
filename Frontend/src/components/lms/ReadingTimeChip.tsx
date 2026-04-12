export default function ReadingTimeChip({ minutes }: { minutes?: number | null }) {
  if (!minutes || minutes <= 0) return null;
  return (
    <span className="inline-flex rounded-full border border-[#0A3035]/15 bg-white/80 px-2.5 py-1 text-xs font-medium text-[#0A3035]">
      ~{minutes} min
    </span>
  );
}
