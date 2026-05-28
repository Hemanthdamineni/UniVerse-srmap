// Opportunities: PageHeader, FilterBar, SkeletonCard loading, EmptyState; listOpportunities unchanged.
import React, { useEffect, useState, useCallback } from "react";
import { listOpportunities, bookmarkOpportunity, type CareerOpportunity } from "../../lib/careerApi";
import OpportunityCard from "../../components/career/OpportunityCard";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageContainer } from "../../components/layout/PageLayouts";
import { FilterBar } from "../../components/ui/FilterBar";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { EmptyState } from "../../components/ui/EmptyState";

interface OpportunitiesPageProps {
  initialType?: string;
}

const TYPE_FILTERS = ["all", "job", "internship", "hackathon", "competition", "fellowship", "workshop"] as const;

const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ initialType }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("query") || "");
  const [type, setType] = useState(initialType || searchParams.get("type") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "relevance");

  const fetchOpps = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (searchTerm) filters.query = searchTerm;
      if (type) filters.type = type;
      if (sort) filters.sort = sort;

      const data = await listOpportunities(filters);
      setOpportunities(data.items);
    } catch (err) {
      console.error("Failed to fetch opportunities", err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, type, sort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchOpps();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchOpps]);

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

  const handleBookmarkToggle = async (id: string) => {
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, isBookmarked: !o.isBookmarked } : o));
    try {
      const result = await bookmarkOpportunity(id);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, isBookmarked: result.bookmarked } : o));
    } catch (err) {
      console.error(err);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, isBookmarked: !o.isBookmarked } : o));
    }
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Opportunities" subtitle="Find your next step" />

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

      {loading ? (
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
          title="No opportunities found"
          description="Try adjusting your search or filters to find what you're looking for."
          action={
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm"
              onClick={() => {
                setSearchTerm("");
                setType("");
                setSearchParams({});
              }}
            >
              Clear all filters
            </button>
          }
        />
      )}
    </PageContainer>
  );
};

export default OpportunitiesPage;
