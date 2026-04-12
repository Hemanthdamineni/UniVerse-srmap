/**
 * EventsListingPage.tsx — Main events discovery page at /events
 *
 * Features:
 * - URL-param driven filters (category, status, search)
 * - 2-column responsive grid
 * - Skeleton loading
 * - Virtualized list for large sets (swap SkeletonCard blocks for virtualized list)
 * - Empty/error/offline states
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { listEvents, type EventSummary } from '../../lib/campusApi';
import { eventCache } from '../../lib/eventCache';
import { CompetitionEventCard } from '../../components/competition/CompetitionEventCard';
import { SkeletonCard } from '../../components/competition/Skeletons';
import { EmptyState } from '../../components/competition/EmptyState';
import { ErrorMessage } from '../../components/competition/ErrorMessage';

const CATEGORIES = ['All', 'Technical', 'Cultural', 'Sports', 'Academic', 'Workshop'];
const STATUSES = ['All', 'published', 'ongoing', 'upcoming'];

export default function EventsListingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? 'All';
  const status = searchParams.get('status') ?? 'All';

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    const qs = new URLSearchParams();
    if (category !== 'All') qs.set('category', category);
    if (status !== 'All') qs.set('status', status);
    if (search) qs.set('q', search);

    const cacheKey = `events-list:${qs.toString()}`;
    const cached = eventCache.get<EventSummary[]>(cacheKey);
    if (cached) {
      setEvents(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string> = {};
      if (category !== 'All') query.category = category;
      if (status !== 'All') query.status = status;
      if (search) query.q = search;

      const data = await listEvents(query);
      eventCache.set(cacheKey, data, 30_000);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [category, status, search]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  function setFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'All' || !value) next.delete(key);
      else next.set(key, value);
      return next;
    });
  }

  return (
    <ErpPageShell
      title="Explore Events"
      source="Internal API"
      isLoading={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Search + Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <input
              type="search"
              placeholder="Search events..."
              defaultValue={search}
              onKeyDown={(e) => e.key === 'Enter' && setFilter('q', (e.target as HTMLInputElement).value)}
              onBlur={(e) => setFilter('q', e.target.value)}
              aria-label="Search events"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--comp-border)',
                borderRadius: 8,
                background: 'var(--comp-surface)',
                color: 'var(--comp-text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter('category', cat)}
                aria-pressed={category === cat}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: `1px solid ${category === cat ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                  background: category === cat ? 'var(--comp-accent)' : 'var(--comp-surface)',
                  color: category === cat ? '#fff' : 'var(--comp-text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setFilter('status', e.target.value)}
            aria-label="Filter by status"
            style={{
              padding: '7px 10px',
              border: '1px solid var(--comp-border)',
              borderRadius: 8,
              background: 'var(--comp-surface)',
              color: 'var(--comp-text-secondary)',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <ErrorMessage message={error} onRetry={fetchEvents} />
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No events found"
            description={search ? `No events match "${search}". Try different keywords.` : 'No events match the current filters.'}
            action={search || category !== 'All' || status !== 'All' ? { label: 'Clear filters', onClick: () => setSearchParams({}) } : undefined}
          />
        ) : (
          <>
            <p className="comp-label">Showing {events.length} event{events.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
              {events.map((event) => (
                <CompetitionEventCard
                  key={event.id}
                  event={event as EventSummary & { isCompetition?: boolean; competitionConfig?: unknown }}
                  onClick={() => navigate(`/events/${encodeURIComponent(event.id)}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </ErpPageShell>
  );
}
