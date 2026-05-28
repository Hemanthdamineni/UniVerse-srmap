/**
 * DeadlinePassedBanner.tsx — Inline banner for submission deadline passed state.
 * Matches the submission_deadline_passed design screen.
 */

interface DeadlinePassedBannerProps {
  roundTitle?: string;
  deadline?: string;
  canResubmit?: boolean;
  onRequestExtension?: () => void;
}

export function DeadlinePassedBanner({
  roundTitle,
  deadline,
  canResubmit = false,
  onRequestExtension,
}: DeadlinePassedBannerProps) {
  return (
    <div
      role="alert" aria-live="polite"
      style={{
        background: 'var(--status-live-bg)',
        border: '1px solid var(--status-live-border)',
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
            background: 'var(--status-live-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ⏰
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--status-live-text)' }}>
            Submission Deadline Passed
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--comp-text-muted)', marginTop: 2 }}>
            {roundTitle
              ? `The submission window for "${roundTitle}" has closed.`
              : 'The submission window for this round has closed.'}
            {deadline && ` Deadline was ${new Date(deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`}
          </p>
        </div>
      </div>

      {canResubmit && onRequestExtension && (
        <button
          onClick={onRequestExtension}
          className="comp-btn-ghost"
          style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
        >
          Request Extension
        </button>
      )}
    </div>
  );
}
