// Opportunities: PageHeader, FilterBar, SkeletonCard loading, EmptyState; listOpportunities unchanged.
import React, { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOpportunities, bookmarkOpportunity, type CareerOpportunity } from "../../lib/career/careerApi";
import { careerKeys } from "../../lib/career/queryKeys";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import OpportunityCard from "../../components/career/OpportunityCard";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/Layouts";
import { PageContainer } from "../../components/layout/PageLayouts";
import { FilterBar } from "../../components/ui/FilterBar";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

interface OpportunitiesPageProps {
  initialType?: string;
}

const TYPE_FILTERS = ["all", "job", "internship", "hackathon", "competition", "fellowship", "workshop"] as const;

const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ initialType }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("query") || "");
  const [type, setType] = useState(initialType || searchParams.get("type") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");
  // Keeps typing from firing a request per keystroke.
  const debouncedSearch = useDebouncedValue(searchTerm);

  const opportunityFilters: Record<string, string> = {};
  if (debouncedSearch) opportunityFilters.query = debouncedSearch;
  if (type) opportunityFilters.type = type;
  if (sort) opportunityFilters.sort = sort;

  const opportunitiesQuery = useQuery({
    queryKey: careerKeys.opportunities(opportunityFilters),
    queryFn: () => listOpportunities(opportunityFilters),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const opportunities = opportunitiesQuery.data?.items ?? [];
  const loading = opportunitiesQuery.isPending || opportunitiesQuery.isPlaceholderData;
  const error = opportunitiesQuery.error
    ? opportunitiesQuery.error instanceof Error ? opportunitiesQuery.error.message : "Could not load opportunities."
    : null;

  const handleSearch = (val: string) => {
    setSearchTerm(val);
    setSearchParams((prev) => {
      if (val) prev.set("query", val);
      else prev.delete("query");
      return prev;
    });
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setSearchParams((prev) => {
      if (newType) prev.set("type", newType);
      else prev.delete("type");
      return prev;
    });
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setSearchParams((prev) => {
      prev.set("sort", newSort);
      return prev;
    });
  };

  // Canonical optimistic pattern: cancel in-flight refetches, patch the cache,
  // roll back on error, reconcile with the server verdict on success.
  const bookmarkToggle = useMutation({
    mutationFn: (id: string) => bookmarkOpportunity(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: careerKeys.opportunities() });
      const previous = queryClient.getQueryData(careerKeys.opportunities(opportunityFilters));
      queryClient.setQueryData(careerKeys.opportunities(opportunityFilters), (old: { items: CareerOpportunity[] } | undefined) => ({
        ...(old ?? { items: [] }),
        items: (old?.items ?? []).map((o) => (o.id === id ? { ...o, isBookmarked: !o.isBookmarked } : o)),
      }));
      return { previous };
    },
    onError: (err, _id, context) => {
      console.error(err);
      if (context?.previous) {
        queryClient.setQueryData(careerKeys.opportunities(opportunityFilters), context.previous);
      }
    },
    onSuccess: (result, id) => {
      queryClient.setQueryData(careerKeys.opportunities(opportunityFilters), (old: { items: CareerOpportunity[] } | undefined) => ({
        ...(old ?? { items: [] }),
        items: (old?.items ?? []).map((o) => (o.id === id ? { ...o, isBookmarked: result.bookmarked } : o)),
      }));
    },
  });

  const handleBookmarkToggle = (id: string) => {
    void bookmarkToggle.mutateAsync(id).catch(() => undefined);
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Opportunities" subtitle="Search openings, compare deadlines, and save roles to track later." />

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={handleSearch}
        searchPlaceholder="Search jobs, skills, company..."
        filters={
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((t) => {
              const active = type === (t === "all" ? "" : t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t === "all" ? "" : t)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition md:min-h-9 ${
                    active
                      ? "bg-[var(--comp-accent)] text-[var(--comp-surface)]"
                      : "border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text-secondary)] hover:border-[var(--comp-accent)]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        }
        sortSlot={
          <label className="body-text flex items-center gap-2 text-sm">
            <span className="label-text">Sort</span>
            <select
              className="min-h-11 flex-1 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm md:min-h-9"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Newest</option>
              <option value="deadline">Deadline</option>
              <option value="popular">Popular</option>
            </select>
          </label>
        }
      />

      {error ? (
        <InlineError
          title="Opportunities could not load"
          message={error}
          description="Retry the listing, or open your tracker if you only need applications you already saved."
          onRetry={() => opportunitiesQuery.refetch()}
          action={
            <Link to="/career/me/tracker" className="rounded-md border border-[var(--comp-border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] no-underline">
              Open tracker
            </Link>
          }
        />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} className="min-h-[200px]" />
          ))}
        </div>
      ) : opportunities.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} onBookmarkToggle={handleBookmarkToggle} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={searchTerm || type ? "No matching opportunities" : "No opportunities are open right now"}
          description={searchTerm || type ? "Clear your filters to see all current openings, or try a broader skill or company name." : "Check back later or submit a verified opportunity for classmates."}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-secondary rounded-lg px-4 py-2 text-sm"
                onClick={() => {
                  setSearchTerm("");
                  setType("");
                  setSearchParams({});
                }}
              >
                Clear filters
              </button>
              <Link to="/career/submit" className="rounded-lg border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] no-underline">
                Submit opportunity
              </Link>
            </div>
          }
        />
      )}
    </PageContainer>
  );
};

export default OpportunitiesPage;
