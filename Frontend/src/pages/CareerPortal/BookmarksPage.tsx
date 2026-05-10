// Bookmarks: PageHeader, SkeletonCard loading, EmptyState + tokens; listOpportunities filter unchanged.
import React, { useEffect, useState } from "react";
import { listOpportunities, type CareerOpportunity } from "../../lib/careerApi";
import OpportunityCard from "../../components/career/OpportunityCard";
import { Bookmark } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { EmptyState } from "../../components/ui/EmptyState";

const BookmarksPage: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const data = await listOpportunities();
        setBookmarks(data.items.filter((opp) => opp.isBookmarked));
      } catch (err) {
        console.error("Failed to fetch bookmarks", err);
      } finally {
        setLoading(false);
      }
    };
    void fetchBookmarks();
  }, []);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="My bookmarks"
        subtitle="Opportunities you've saved for later"
        actions={
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--comp-surface))] md:h-9 md:w-9"
            aria-hidden
          >
            <Bookmark className="h-6 w-6 text-[var(--warning)]" />
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="min-h-[200px]" />
          ))}
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark className="h-12 w-12" />}
          title="No bookmarks yet"
          description="Save opportunities you're interested in to see them here."
        />
      )}
    </PageContainer>
  );
};

export default BookmarksPage;
