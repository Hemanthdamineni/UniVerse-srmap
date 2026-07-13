
// ── DeadlinePassedBanner ─────────────────────────────────────────────────────

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


// ── RegistrationClosedBanner ─────────────────────────────────────────────────────

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


// ── SubmissionStatusBanner ─────────────────────────────────────────────────────

/**
 * SubmissionStatusBanner.tsx — 7-state submission status display.
 */

interface SubmissionStatusBannerProps {
  state:
    | 'not-submitted'
    | 'submitted'
    | 'locked'
    | 'evaluated-pending'
    | 'shortlisted'
    | 'not-selected'
    | 'not-evaluated';
  submittedAt?: string;
  resubmissionsRemaining?: number;
  roundTitle: string;
}

interface BannerConfig {
  bg: string;
  border: string;
  text: string;
  icon: string;
  getMessage: (props: SubmissionStatusBannerProps) => string;
}

const BANNER_CONFIG: Record<SubmissionStatusBannerProps['state'], BannerConfig> = {
  'not-submitted': {
    bg: 'var(--status-pending-bg)',
    border: 'var(--status-pending-border)',
    text: 'var(--status-pending-text)',
    icon: '⚠️',
    getMessage: (p) => `You haven't submitted for ${p.roundTitle} yet.`,
  },
  submitted: {
    bg: 'var(--status-open-bg)',
    border: 'var(--status-open-border)',
    text: 'var(--status-open-text)',
    icon: '✓',
    getMessage: (p) => {
      const date = p.submittedAt
        ? new Date(p.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      const resubs = p.resubmissionsRemaining !== undefined ? ` · ${p.resubmissionsRemaining} resubmission${p.resubmissionsRemaining !== 1 ? 's' : ''} remaining` : '';
      return `Submitted${date ? ` ${date}` : ''}${resubs}.`;
    },
  },
  locked: {
    bg: 'var(--status-closed-bg)',
    border: 'var(--status-closed-border)',
    text: 'var(--status-closed-text)',
    icon: '🔒',
    getMessage: () => 'Submission window closed. Awaiting evaluation.',
  },
  'evaluated-pending': {
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
    icon: '⏳',
    getMessage: () => 'Evaluated. Results will be published by the organizer.',
  },
  shortlisted: {
    bg: 'var(--status-selected-bg)',
    border: 'var(--status-open-border)',
    text: 'var(--status-selected-text)',
    icon: '🏆',
    getMessage: () => "Congratulations! You've been shortlisted.",
  },
  'not-selected': {
    bg: 'var(--status-closed-bg)',
    border: 'var(--status-closed-border)',
    text: 'var(--status-closed-text)',
    icon: '—',
    getMessage: () => 'You were not selected for the next round.',
  },
  'not-evaluated': {
    bg: 'var(--status-closed-bg)',
    border: 'var(--status-closed-border)',
    text: 'var(--status-closed-text)',
    icon: '○',
    getMessage: () => 'Your submission was not evaluated.',
  },
};

export function SubmissionStatusBanner(props: SubmissionStatusBannerProps) {
  const config = BANNER_CONFIG[props.state];

  return (
    <div
      role="status"
      aria-label={`Submission status: ${props.state}`}
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 8,
        padding: 'var(--space-sm) var(--space-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        color: config.text,
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.getMessage(props)}</span>
    </div>
  );
}

