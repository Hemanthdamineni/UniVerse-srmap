/**
 * AuditHistoryPanel.tsx — Compact audit log for evaluation/shortlist/publish events.
 * Used in EvaluationPage, OrganizerDashboard, and ShortlistPage.
 */

interface AuditEvent {
  label: string;   // "Evaluated by", "Shortlist applied", "Results published"
  actor?: string;  // register number
  at: string;      // ISO timestamp
}

interface AuditHistoryPanelProps {
  events: AuditEvent[];
}

function formatAuditTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AuditHistoryPanel({ events }: AuditHistoryPanelProps) {
  if (events.length === 0) return null;

  return (
    <div
      aria-label="History"
      style={{
        borderTop: '1px solid var(--comp-border)',
        paddingTop: 'var(--space-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <p className="comp-label" style={{ marginBottom: 4 }}>History</p>
      {events.map((event, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8rem',
            color: 'var(--comp-text-secondary)',
          }}
        >
          <span style={{ color: 'var(--status-open-text)' }} aria-hidden="true">✓</span>
          <span>
            {event.label}
            {event.actor && <strong> {event.actor}</strong>}
          </span>
          <span style={{ color: 'var(--comp-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {formatAuditTime(event.at)}
          </span>
        </div>
      ))}
    </div>
  );
}
