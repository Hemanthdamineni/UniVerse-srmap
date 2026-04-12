/**
 * MyActivityPage.tsx — /events/my-activity
 * 3 tabs: Registered Events | My Submissions | My Results
 * Tab state via URL ?tab= param
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { listEvents } from '../../lib/campusApi';
import { EmptyState } from '../../components/competition/EmptyState';
import { SkeletonTable } from '../../components/competition/Skeletons';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import type { EventSummary } from '../../lib/campusApi';

const TABS = [
  { key: 'registered', label: 'Registered Events' },
  { key: 'submissions', label: 'My Submissions' },
  { key: 'results', label: 'My Results' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function MyActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') ?? 'registered') as TabKey;

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listEvents({ myRegistrations: 'true' })
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load events.'))
      .finally(() => setLoading(false));
  }, []);

  function setTab(tab: TabKey) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  }

  return (
    <ErpPageShell title="My Activity" source="Internal API" isLoading={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--comp-border)', paddingBottom: 0, marginBottom: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              aria-selected={activeTab === tab.key}
              role="tab"
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                color: activeTab === tab.key ? 'var(--comp-accent)' : 'var(--comp-text-secondary)',
                fontWeight: activeTab === tab.key ? 700 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                borderBottom: `2px solid ${activeTab === tab.key ? 'var(--comp-accent)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && <ErrorMessage message={error} onRetry={() => void listEvents({ myRegistrations: 'true' }).then(setEvents)} />}

        {/* Tab content */}
        {loading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : activeTab === 'registered' ? (
          events.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No registered events"
              description="You haven't registered for any events yet."
              action={{ label: 'Explore Events', onClick: () => window.location.href = '/events' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    background: 'var(--comp-surface)',
                    border: '1px solid var(--comp-border)',
                    borderRadius: 10,
                    padding: 'var(--space-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-md)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p className="comp-heading-md" style={{ margin: 0 }}>{event.title ?? 'Untitled Event'}</p>
                    <p className="comp-body" style={{ margin: 0 }}>
                      {event.department ?? ''} · {event.category ?? 'General'}
                    </p>
                  </div>
                  <Link
                    to={`/events/${encodeURIComponent(event.id)}`}
                    className="comp-btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Open →
                  </Link>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'submissions' ? (
          <EmptyState
            icon="📤"
            title="Submissions appear here"
            description="Once you submit work in a competition round, it will be listed here."
          />
        ) : (
          <EmptyState
            icon="📊"
            title="Results appear here"
            description="Published results from your competition rounds will be shown here."
          />
        )}
      </div>
    </ErpPageShell>
  );
}
