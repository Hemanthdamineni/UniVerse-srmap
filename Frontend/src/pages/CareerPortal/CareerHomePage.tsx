import React, { useCallback, useEffect, useState } from 'react';
import { listOpportunities, getPersonalizedFeed, bookmarkOpportunity, type CareerOpportunity } from '../../lib/career/careerApi';
import OpportunityCard from '../../components/career/OpportunityCard';
import { Button } from '../../components/button';
import { PlusCircle, Search, Clock, Briefcase, GraduationCap, Code, Trophy, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageLayouts';
import { EmptyState, InlineError } from '../../components/ui/Feedback';
import { SkeletonCard } from '../../components/ui/Skeletons';

/**
 * An opportunity whose deadline has passed should never be recommended — the
 * personalised rail was surfacing expired listings beside a live "Apply" button.
 * Undated opportunities are kept: many sources omit a deadline entirely.
 */
function isStillOpen(opp: CareerOpportunity): boolean {
  if (opp.isActive === false) return false;
  if (!opp.deadline) return true;
  const due = Date.parse(opp.deadline);
  if (Number.isNaN(due)) return true;
  // Compare against the end of the deadline day, not the current instant.
  return due + 24 * 60 * 60 * 1000 > Date.now();
}

const CareerHomePage: React.FC = () => {
  const [latestOpps, setLatestOpps] = useState<CareerOpportunity[]>([]);
  const [personalizedOpps, setPersonalizedOpps] = useState<CareerOpportunity[]>([]);
  const [expiringOpps, setExpiringOpps] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [latest, expiring, personalized] = await Promise.all([
        listOpportunities({ limit: '6', sort: 'recent' }),
        listOpportunities({ limit: '8', sort: 'deadline', expiringWithinDays: '3' }),
        getPersonalizedFeed()
      ]);
      setLatestOpps(latest.items);
      setExpiringOpps(expiring.items.filter(isStillOpen));
      setPersonalizedOpps(personalized.items.filter(isStillOpen).slice(0, 3));
    } catch (err) {
      console.error('Failed to fetch career opportunities', err);
      setError(err instanceof Error ? err.message : "Could not load career opportunities.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleBookmarkToggle = async (id: string) => {
    // Optimistic update
    const updateOpps = (prev: CareerOpportunity[]) => prev.map(o => o.id === id ? { ...o, isBookmarked: !o.isBookmarked } : o);
    setLatestOpps(updateOpps);
    setPersonalizedOpps(updateOpps);
    setExpiringOpps(updateOpps);
    
    try {
      const result = await bookmarkOpportunity(id);
      const confirmOpps = (prev: CareerOpportunity[]) => prev.map(o => o.id === id ? { ...o, isBookmarked: result.bookmarked } : o);
      setLatestOpps(confirmOpps);
      setPersonalizedOpps(confirmOpps);
      setExpiringOpps(confirmOpps);
    } catch (err) {
      console.error(err);
      // Revert optimism
      setLatestOpps(updateOpps);
      setPersonalizedOpps(updateOpps);
      setExpiringOpps(updateOpps);
    }
  };

  const typeFilters = [
    { label: 'All', icon: <Search className="w-4 h-4" />, type: '' },
    { label: 'Jobs', icon: <Briefcase className="w-4 h-4" />, type: 'job' },
    { label: 'Internships', icon: <GraduationCap className="w-4 h-4" />, type: 'internship' },
    { label: 'Hackathons', icon: <Code className="w-4 h-4" />, type: 'hackathon' },
    { label: 'Competitions', icon: <Trophy className="w-4 h-4" />, type: 'competition' },
  ];

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Career Portal</h1>
          <p className="body-text mt-1">Find openings, save what matters, and track every application.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/academic-tracker/unified-insights">
            <Button variant="outline">
              <Sparkles className="mr-2 h-4 w-4" /> Unified Insights
            </Button>
          </Link>
          <Link to="/career/submit">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Submit Opportunity
            </Button>
          </Link>
        </div>
      </header>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map((f) => (
          <Link 
            key={f.label} 
            to={f.type ? `/career/opportunities?type=${f.type}` : '/career/opportunities'}
          >
            <Button variant="outline" className="rounded-full flex items-center gap-2">
              {f.icon} {f.label}
            </Button>
          </Link>
        ))}
      </div>

      {error ? (
        <InlineError
          title="Career opportunities could not load"
          message={error}
          description="You can retry the feed, or open the tracker if you only need your saved applications."
          onRetry={fetchData}
          action={
            <Link to="/career/me/tracker" className="rounded-md border border-[var(--comp-border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] no-underline">
              Open tracker
            </Link>
          }
        />
      ) : null}

      {/* Personalized for You (Phase 4) */}
      {!error && personalizedOpps.length > 0 && (
        <section className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--comp-accent)]" />
              <h2 className="section-title">Personalized for you</h2>
            </div>
            <Link to="/career/me/profile" className="text-sm font-medium text-[var(--comp-accent)] hover:underline">
              Update Profile
            </Link>
          </div>
          {/* Sized to the item count so a one-item rail doesn't render as a
              three-column grid with two empty cells. */}
          <div
            className={`grid gap-4 ${
              personalizedOpps.length === 1
                ? "grid-cols-1"
                : personalizedOpps.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {personalizedOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} onBookmarkToggle={handleBookmarkToggle} />
            ))}
          </div>
        </section>
      )}

      {/* Expiring Soon */}
      {!error && expiringOpps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[var(--error)]" />
            <h2 className="section-title">Expiring soon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {expiringOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} onBookmarkToggle={handleBookmarkToggle} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Opportunities */}
      {!error ? <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title">Latest opportunities</h2>
          <Link to="/career/opportunities" className="text-[var(--comp-accent)] hover:underline text-sm font-medium">
            View all
          </Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : latestOpps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {latestOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} onBookmarkToggle={handleBookmarkToggle} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No opportunities are open right now"
            description="Check back later, browse all filters, or submit a verified opportunity for classmates."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/career/opportunities" className="rounded-lg border border-[var(--comp-border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] no-underline">
                  Browse all
                </Link>
                <Link to="/career/submit" className="rounded-lg bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white no-underline">
                  Submit opportunity
                </Link>
              </div>
            }
          />
        )}
      </section> : null}

      {/* Tracker Shortcut */}
      <section className="dashboard-card flex flex-col sm:flex-row justify-between items-center gap-4 p-6">
        <div>
          <h3 className="card-title">Application Tracker</h3>
          <p className="body-text">Manage your applications and track their status in one place.</p>
        </div>
        <Link to="/career/me/tracker">
          <Button variant="outline">
            Open Tracker
          </Button>
        </Link>
      </section>
    </PageContainer>
  );
};

export default CareerHomePage;
