/**
 * RegistrationClosedBanner.tsx — Inline banner when event registration has closed.
 * Matches the registration_closed_state design screen.
 */

interface RegistrationClosedBannerProps {
  eventTitle?: string;
  closedDate?: string;
  showWaitlist?: boolean;
  onJoinWaitlist?: () => void;
}

export function RegistrationClosedBanner({
  eventTitle,
  closedDate,
  showWaitlist = false,
  onJoinWaitlist,
}: RegistrationClosedBannerProps) {
  return (
    <div
      role="alert" aria-live="polite"
      style={{
        background: 'var(--status-closed-bg)',
        border: '1px solid var(--status-closed-border)',
        borderRadius: 10,
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--status-closed-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          🔒
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--status-closed-text)' }}>
            Registration Closed
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--comp-text-muted)', marginTop: 2 }}>
            {eventTitle
              ? `Registration for ${eventTitle} is no longer available.`
              : 'Registration for this event is no longer available.'}
            {closedDate && ` Closed on ${new Date(closedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}.`}
          </p>
        </div>
      </div>

      {showWaitlist && onJoinWaitlist && (
        <button
          onClick={onJoinWaitlist}
          className="comp-btn-ghost"
          style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
        >
          Join Waitlist →
        </button>
      )}
    </div>
  );
}
