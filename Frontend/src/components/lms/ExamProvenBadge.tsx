export default function ExamProvenBadge({ score }: { score?: number | null }) {
  if (!score || score <= 2) return null;
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
      Exam Proven
    </span>
  );
}
