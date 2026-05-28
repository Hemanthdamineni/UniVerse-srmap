/**
 * EventNotFound.tsx — 404 state for event detail pages.
 * Matches the 404_event_not_found design screen.
 */

import { Link } from 'react-router-dom';

interface EventNotFoundProps {
  eventId?: string;
  message?: string;
}

export function EventNotFound({ eventId, message }: EventNotFoundProps) {
  return (
    <div
      role="alert" aria-live="polite"
      aria-label="Event not found"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2xl) var(--space-xl)',
        textAlign: 'center',
        gap: 'var(--space-md)',
        minHeight: 360,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--comp-accent-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
        }}
        aria-hidden="true"
      >
        🔍
      </div>

      <h2 className="comp-heading-lg" style={{ margin: 0 }}>Event Not Found</h2>

      <p className="comp-body" style={{ margin: 0, maxWidth: 380 }}>
        {message ?? 'The event you\'re looking for doesn\'t exist or may have been removed.'}
      </p>

      {eventId && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
          Reference: {eventId}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
        <Link
          to="/events"
          className="comp-btn-primary"
          style={{ textDecoration: 'none', fontSize: '0.85rem' }}
        >
          Browse Events
        </Link>
        <Link
          to="/events/my-activity"
          className="comp-btn-ghost"
          style={{ textDecoration: 'none', fontSize: '0.85rem' }}
        >
          My Activity
        </Link>
      </div>
    </div>
  );
}
