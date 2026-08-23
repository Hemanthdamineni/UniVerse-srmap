import { useEffect, useRef, useState } from "react";

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
  const hasActive = !!(filters.query || filters.subjectCode || filters.type || filters.difficulty);

  // Echo text inputs locally and propagate changes debounced so list pages
  // don't re-filter their grids on every keystroke.
  const [localQuery, setLocalQuery] = useState(filters.query || "");
  const [localSubject, setLocalSubject] = useState(filters.subjectCode || "");
  const queryTimer = useRef<number | null>(null);
  const subjectTimer = useRef<number | null>(null);

  useEffect(() => {
    setLocalQuery(filters.query || "");
  }, [filters.query]);

  useEffect(() => {
    setLocalSubject(filters.subjectCode || "");
  }, [filters.subjectCode]);

  useEffect(
    () => () => {
      if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
      if (subjectTimer.current !== null) window.clearTimeout(subjectTimer.current);
    },
    []
  );

  const handleQueryChange = (val: string) => {
    setLocalQuery(val);
    if (queryTimer.current !== null) window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => onChange({ ...filters, query: val }), 300);
  };

  const handleSubjectChange = (val: string) => {
    setLocalSubject(val);
    if (subjectTimer.current !== null) window.clearTimeout(subjectTimer.current);
    subjectTimer.current = window.setTimeout(() => onChange({ ...filters, subjectCode: val }), 300);
  };

  const inputStyle = {
    background: "var(--comp-surface)",
    borderColor: "var(--comp-border)",
    color: "var(--comp-text-primary)",
  } as const;

  return (
    <section className="dashboard-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search */}
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--comp-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="resource-filter-search"
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--info)]"
            style={inputStyle}
            placeholder="Search resources"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            type="search"
            aria-label="Search resources"
          />
        </div>

        {/* Subject code */}
        <input
          id="resource-filter-subject"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[var(--info)]"
          style={{ ...inputStyle, minWidth: 140 }}
          placeholder="Subject code"
          value={localSubject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          aria-label="Filter by subject code"
        />

        {/* Type */}
        <select
          id="resource-filter-type"
          className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[var(--info)]"
          style={{ ...inputStyle, minWidth: 120 }}
          value={filters.type || ""}
          onChange={(e) => onChange({ ...filters, type: e.target.value })}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="link">Link</option>
          <option value="file">File</option>
          <option value="note">Note</option>
          <option value="quiz">Quiz</option>
          <option value="flashcard">Flashcard</option>
          <option value="pyq">PYQ</option>
        </select>

        {/* Difficulty */}
        <select
          id="resource-filter-difficulty"
          className="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-[var(--info)]"
          style={{ ...inputStyle, minWidth: 120 }}
          value={filters.difficulty || ""}
          onChange={(e) => onChange({ ...filters, difficulty: e.target.value })}
          aria-label="Filter by difficulty"
        >
          <option value="">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        {/* Reset */}
        {hasActive && (
          <button
            type="button"
            id="resource-filter-clear"
            onClick={() => onChange({})}
            className="btn-ghost shrink-0 text-sm"
            aria-label="Clear all filters"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
