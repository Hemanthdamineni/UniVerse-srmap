/**
 * MyCreatedEventsPage.tsx — /events/my-created
 * Lists events created/co-organized by the current user.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { listEvents, type EventSummary } from '../../lib/campusApi';
import { readStoredProfileData } from '../../lib/session';
import { StatusBadge } from '../../components/competition/StatusBadge';
import { SkeletonTable } from '../../components/competition/Skeletons';
import { EmptyState } from '../../components/competition/EmptyState';
import { ErrorMessage } from '../../components/competition/ErrorMessage';

const MAX_ACTIVE_EVENTS = 5; // platform-enforced limit

export default function MyCreatedEventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profile = readStoredProfileData();
  const userId =
    (profile?.registerNumber as string | undefined) ??
    (profile?.id as string | undefined) ??
    '';

  useEffect(() => {
    setLoading(true);
    listEvents({ createdBy: userId })
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load events.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const activeStatuses = new Set(['published', 'public', 'ongoing', 'draft']);
  const activeCount = events.filter((e) => activeStatuses.has(e.status)).length;
  const atLimit = activeCount >= MAX_ACTIVE_EVENTS;

  const statusValues = [
    'draft', 'published', 'public', 'ongoing', 'submission-closed',
    'evaluation', 'results-published', 'completed', 'archived',
    'open', 'upcoming', 'closed', 'in-progress',
  ] as const;
  type ValidStatus = typeof statusValues[number];

  function safeStatus(s: string): ValidStatus {
    return statusValues.includes(s as ValidStatus) ? (s as ValidStatus) : 'upcoming';
  }

  return (
    <ErpPageShell title="My Created Events" source="Internal API" isLoading={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Active events limit indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)',
          }}
        >
          <div>
            <p className="comp-heading-md" style={{ margin: 0 }}>
              Active Events: {activeCount} / {MAX_ACTIVE_EVENTS}
            </p>
            <p className="comp-body" style={{ margin: 0 }}>
              {atLimit
                ? 'You have reached the active event limit. Archive an event to create a new one.'
                : `You can create ${MAX_ACTIVE_EVENTS - activeCount} more active event${MAX_ACTIVE_EVENTS - activeCount !== 1 ? 's' : ''}.`}
            </p>
          </div>
          <Link
            to="/events/create"
            className={atLimit ? 'comp-btn-ghost' : 'comp-btn-primary'}
            style={{ opacity: atLimit ? 0.5 : 1, pointerEvents: atLimit ? 'none' : undefined }}
            aria-disabled={atLimit}
            aria-label="Create new event"
          >
            + Create Event
          </Link>
        </div>

        {/* Progress bar for active limit */}
        <div style={{ height: 4, background: 'var(--comp-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min((activeCount / MAX_ACTIVE_EVENTS) * 100, 100)}%`,
              background: atLimit ? 'var(--deadline-urgent)' : 'var(--comp-accent)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Error */}
        {error && <ErrorMessage message={error} />}

        {/* Events table */}
        {loading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : events.length === 0 ? (
          <EmptyState
            icon="✨"
            title="No events created yet"
            description="Create your first event to start organizing competitions."
            action={{ label: 'Create Event', onClick: () => window.location.href = '/events/create' }}
          />
        ) : (
          <div
            style={{
              border: '1px solid var(--comp-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--comp-accent)' }}>
                  {['Event Name', 'Category', 'Status', 'Registered', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#fff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((event, i) => (
                  <tr
                    key={event.id}
                    style={{
                      background: i % 2 === 0 ? 'var(--comp-surface)' : 'var(--comp-surface-hover)',
                      borderTop: '1px solid var(--comp-border)',
                    }}
                  >
                    <td style={{ padding: '10px 16px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                      {event.title ?? 'Untitled'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.8rem', color: 'var(--comp-text-secondary)' }}>
                      {event.category ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusBadge status={safeStatus(event.status)} size="sm" />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.8rem', color: 'var(--comp-text-secondary)' }}>
                      {event.registeredCount ?? 0}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link
                          to={`/events/${encodeURIComponent(event.id)}`}
                          style={{ fontSize: '0.78rem', color: 'var(--comp-accent)', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          View
                        </Link>
                        <Link
                          to={`/events/${encodeURIComponent(event.id)}/manage`}
                          style={{ fontSize: '0.78rem', color: 'var(--comp-text-secondary)', textDecoration: 'underline' }}
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}
