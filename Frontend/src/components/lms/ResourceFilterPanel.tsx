export type ResourceFilterState = {
  subjectCode?: string;
  type?: string;
  difficulty?: string;
  query?: string;
};

export default function ResourceFilterPanel({
  filters,
  onChange,
}: {
  filters: ResourceFilterState;
  onChange: (next: ResourceFilterState) => void;
}) {
  return (
    <section className="dashboard-card grid gap-3 p-4 md:grid-cols-4">
      <input
        className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--info)]"
        placeholder="Search"
        value={filters.query || ""}
        onChange={(event) => onChange({ ...filters, query: event.target.value })}
      />
      <input
        className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--info)]"
        placeholder="Subject code"
        value={filters.subjectCode || ""}
        onChange={(event) => onChange({ ...filters, subjectCode: event.target.value })}
      />
      <select
        className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--info)]"
        value={filters.type || ""}
        onChange={(event) => onChange({ ...filters, type: event.target.value })}
      >
        <option value="">All types</option>
        <option value="link">Link</option>
        <option value="file">File</option>
        <option value="note">Note</option>
        <option value="quiz">Quiz</option>
        <option value="flashcard">Flashcard</option>
        <option value="pyq">PYQ</option>
      </select>
      <select
        className="rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--info)]"
        value={filters.difficulty || ""}
        onChange={(event) => onChange({ ...filters, difficulty: event.target.value })}
      >
        <option value="">All difficulty</option>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
    </section>
  );
}
