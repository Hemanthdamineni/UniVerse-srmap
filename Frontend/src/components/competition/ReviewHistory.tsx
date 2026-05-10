/**
 * ReviewHistory.tsx — Timeline of past review actions for a submission.
 * Shows who evaluated, when, what score, and decision changes.
 */

interface ReviewEvent {
  actor: string;
  action: string;
  timestamp: string;
  details?: string;
  score?: number;
}

interface ReviewHistoryProps {
  events: ReviewEvent[];
}

export function ReviewHistory({ events }: ReviewHistoryProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
        <p className="comp-body" style={{ margin: 0, fontSize: '0.82rem' }}>
          No review history yet.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
      }}
      role="list"
      aria-label="Review history"
    >
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: 15,
        top: 16,
        bottom: 16,
        width: 2,
        background: 'var(--comp-border)',
      }} />

      {events.map((event, i) => (
        <div
          key={`${event.actor}-${event.timestamp}-${i}`}
          role="listitem"
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) 0',
            position: 'relative',
          }}
        >
          {/* Timeline dot */}
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: i === 0 ? 'var(--comp-accent)' : 'var(--comp-border-strong)',
            border: '2px solid var(--comp-surface)',
            flexShrink: 0,
            marginTop: 4,
            marginLeft: 11,
            position: 'relative',
            zIndex: 1,
          }} />

          <div style={{ flex: 1, marginLeft: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                {event.actor}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--comp-text-muted)' }}>
                {new Date(event.timestamp).toLocaleString('en-IN', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--comp-text-secondary)' }}>
              {event.action}
              {event.score !== undefined && (
                <span style={{ fontWeight: 600, color: 'var(--comp-accent)', marginLeft: 4 }}>
                  Score: {event.score}
                </span>
              )}
            </p>
            {event.details && (
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--comp-text-muted)', fontStyle: 'italic' }}>
                "{event.details}"
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
