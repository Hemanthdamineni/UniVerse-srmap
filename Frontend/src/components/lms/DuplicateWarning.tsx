export default function DuplicateWarning({
  exact,
  similarCount,
}: {
  exact?: { title: string } | null;
  similarCount?: number;
}) {
  if (!exact && !similarCount) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {exact
        ? `An exact duplicate already exists: ${exact.title}`
        : `${similarCount} similar resource${similarCount === 1 ? "" : "s"} already exist for this subject.`}
    </div>
  );
}
