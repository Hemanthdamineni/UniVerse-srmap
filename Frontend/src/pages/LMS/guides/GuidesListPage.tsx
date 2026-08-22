import {
  useState,
  Link,
  SectionCard,
  EmptyView,
  listGuides,
  useAsyncPage,
  LmsFrame
} from "../_shared/LmsPageShared";
import type { LmsGuide } from "../_shared/LmsPageShared";

export function GuidesListPage() {
  const [query, setQuery] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [sort, setSort] = useState("");

  const { data, setData, loading, error } = useAsyncPage(
    () => listGuides({ query: query || undefined, subjectCode: subjectCode || undefined, sort: sort || undefined }),
    [query, subjectCode, sort]
  );

  const guides: LmsGuide[] = Array.isArray(data) ? data : [];

  return (
    <LmsFrame title="Guides" loading={loading} error={error}>
      <SectionCard title="Find a guide">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="lms-input min-w-56 flex-1 py-1.5 text-sm"
            placeholder="Search by title, description, or subject"
            aria-label="Search guides"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            className="lms-input w-36 py-1.5 text-xs uppercase"
            placeholder="Subject code"
            aria-label="Filter by subject code"
            value={subjectCode}
            onChange={(event) => setSubjectCode(event.target.value.toUpperCase())}
          />
          <label className="flex items-center gap-1.5 text-sm text-[var(--comp-text-secondary)]">
            Sort
            <select
              className="lms-input w-auto py-1.5 text-xs"
              aria-label="Sort guides"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="">Best</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popular">Most upvoted</option>
            </select>
          </label>
        </div>
      </SectionCard>

      {guides.length === 0 && !loading ? (
        <EmptyView
          title="No guides match"
          description="Try clearing the search or picking a different subject."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {guides.map((guide) => (
          <Link key={guide.id} to={`/resources/guides/${guide.id}`} className="dashboard-card block p-5 no-underline">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-[var(--text-secondary)]">{guide.subjectCode}</p>
              {Number(guide.published) === 0 ? (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: "color-mix(in srgb, var(--warning) 10%, transparent)", color: "var(--warning)" }}
                >
                  Draft
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{guide.title}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{guide.description}</p>
          </Link>
        ))}
      </div>
    </LmsFrame>
  );
}

export default GuidesListPage;

