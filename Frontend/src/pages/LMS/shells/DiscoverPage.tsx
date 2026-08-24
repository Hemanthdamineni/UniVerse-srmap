import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getExploreData,
  searchLmsContent,
  useAsyncPage,
  LmsFrame,
  SectionCard,
} from "../_shared/LmsPageShared";
import RecommendationSection from "../../../components/lms/RecommendationSection";
import ResourceGrid from "../../../components/lms/ResourceGrid";
import { SegmentedControl } from "../../../components/ui";

type Facet = "all" | "resources" | "pyq" | "guides" | "questions";

const FACET_OPTIONS = [
  { label: "All", value: "all" as const },
  { label: "Resources", value: "resources" as const },
  { label: "PYQs", value: "pyq" as const },
  { label: "Guides", value: "guides" as const },
  { label: "Questions", value: "questions" as const },
] as const;

function facetToSearchParams(facet: Facet): { types?: string; type?: string } {
  if (facet === "all") return {};
  if (facet === "resources") return { types: "resources" };
  if (facet === "pyq") return { types: "resources", type: "pyq" };
  return { types: facet };
}

function SearchBar({
  query,
  onQueryChange,
  subjectCode,
  onSubjectChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  subjectCode: string;
  onSubjectChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="search"
        className="lms-input flex-1"
        placeholder="Search notes, PYQs, guides, roadmaps, questions…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="Search learning content"
      />
      <input
        type="text"
        className="lms-input sm:max-w-44 uppercase"
        placeholder="Subject code"
        value={subjectCode}
        onChange={(event) => onSubjectChange(event.target.value)}
        aria-label="Filter by subject code"
      />
    </div>
  );
}

function GuideResultCard({ guide }: { guide: { id: string; title?: string; description?: string | null; subjectCode?: string } }) {
  return (
    <Link to={`/learn/guides/${guide.id}`} className="dashboard-card block space-y-1 p-4 no-underline">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">
        Guide · {guide.subjectCode || "General"}
      </p>
      <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{guide.title}</p>
      <p className="line-clamp-2 text-xs text-[var(--comp-text-secondary)]">{guide.description}</p>
    </Link>
  );
}

function RoadmapResultCard({ roadmap }: { roadmap: { id: string; title?: string; description?: string | null; skill?: string } }) {
  return (
    <Link to={`/learn/roadmaps/${roadmap.id}`} className="dashboard-card block space-y-1 p-4 no-underline">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">
        Roadmap · {roadmap.skill || "Skill path"}
      </p>
      <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{roadmap.title}</p>
      <p className="line-clamp-2 text-xs text-[var(--comp-text-secondary)]">{roadmap.description}</p>
    </Link>
  );
}

export default function DiscoverPage() {
  const [searchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [subjectInput, setSubjectInput] = useState(searchParams.get("subjectCode") || "");
  const [facet, setFacet] = useState<Facet>("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(queryInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const explore = useAsyncPage(() => getExploreData(), []);
  const results = useAsyncPage(
    () =>
      searchLmsContent({
        query: debouncedQuery,
        subjectCode: subjectInput.trim() || undefined,
        ...facetToSearchParams(facet),
        limit: 12,
      }),
    [debouncedQuery, subjectInput, facet]
  );

  const hasQuery = Boolean(debouncedQuery) || facet !== "all" || Boolean(subjectInput.trim());
  const groups = useMemo(() => results.data?.groups, [results.data]);

  return (
    <LmsFrame
      title="Learn"
      loading={(hasQuery && results.loading) || (!hasQuery && explore.loading && !explore.data)}
      error={hasQuery ? results.error : explore.error}
    >
      <div className="space-y-4">
        <SearchBar
          query={queryInput}
          onQueryChange={setQueryInput}
          subjectCode={subjectInput}
          onSubjectChange={setSubjectInput}
        />
        <SegmentedControl options={FACET_OPTIONS} value={facet} onChange={setFacet} />

        {!hasQuery ? (
          <>
            <RecommendationSection title="Trending" items={explore.data?.trending || []} />
            <RecommendationSection title="Top Rated" items={explore.data?.topRated || []} />
            <RecommendationSection title="Exam Ready" items={explore.data?.examReady || []} />
            <SectionCard title="Official learning materials">
              <p className="body-text text-sm">
                Year → course → subject materials curated by the university, separate from the community catalog.
              </p>
              <div className="mt-3">
                <Link to="/learn/materials" className="lms-btn lms-btn-ghost no-underline">
                  Browse official materials
                </Link>
              </div>
            </SectionCard>
          </>
        ) : (
          <>
            {(groups?.resources?.items.length || 0) > 0 ? (
              <SectionCard title={`Resources (${groups!.resources.total})`}>
                <ResourceGrid items={groups!.resources.items} />
              </SectionCard>
            ) : null}

            {(groups?.guides?.items.length || 0) > 0 ? (
              <SectionCard title={`Guides (${groups!.guides.total})`}>
                <div className="grid gap-3 md:grid-cols-2">
                  {groups!.guides.items.map((guide) => (
                    <GuideResultCard key={guide.id} guide={guide} />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {(groups?.roadmaps?.items.length || 0) > 0 ? (
              <SectionCard title={`Roadmaps (${groups!.roadmaps.total})`}>
                <div className="grid gap-3 md:grid-cols-2">
                  {groups!.roadmaps.items.map((roadmap) => (
                    <RoadmapResultCard key={roadmap.id} roadmap={roadmap} />
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {(groups?.questions?.items.length || 0) > 0 ? (
              <SectionCard title={`Questions (${groups!.questions.total})`}>
                <div className="divide-y divide-[var(--comp-border)]">
                  {groups!.questions.items.map((question) => (
                    <Link
                      key={question.id}
                      to="/learn/practice?tab=questions"
                      className="block space-y-1 py-3 no-underline"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">
                        {question.subjectCode} · {question.difficulty || "unrated"} · Practice tab
                      </p>
                      <p className="text-sm font-medium text-[var(--comp-text-primary)]">{question.question}</p>
                    </Link>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {!results.loading &&
            !groups?.resources?.items.length &&
            !groups?.guides?.items.length &&
            !groups?.roadmaps?.items.length &&
            !groups?.questions?.items.length ? (
              <SectionCard title="No matches">
                <p className="body-text text-sm">
                  Nothing matched “{debouncedQuery || facet}”. Try fewer words, a different type, or{" "}
                  <Link to="/learn/contribute?tab=requests" className="font-medium text-[var(--info)] underline underline-offset-2">
                    request it on the board
                  </Link>
                  .
                </p>
              </SectionCard>
            ) : null}
          </>
        )}
      </div>
    </LmsFrame>
  );
}
