
import { AlertTriangle, Check, Circle, Clock, Hourglass, Lock, Minus, Trophy, type LucideIcon } from "lucide-react";

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
  icon: LucideIcon;
  getMessage: (props: SubmissionStatusBannerProps) => string;
}

const BANNER_CONFIG: Record<SubmissionStatusBannerProps['state'], BannerConfig> = {
  'not-submitted': {
    bg: 'var(--status-pending-bg)',
    border: 'var(--status-pending-border)',
    text: 'var(--status-pending-text)',
    icon: AlertTriangle,
    getMessage: (p) => `You haven't submitted for ${p.roundTitle} yet.`,
  },
  submitted: {
    bg: 'var(--status-open-bg)',
    border: 'var(--status-open-border)',
    text: 'var(--status-open-text)',
    icon: Check,
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
    icon: Lock,
    getMessage: () => 'Submission window closed. Awaiting evaluation.',
  },
  'evaluated-pending': {
    bg: 'color-mix(in srgb, var(--info) 10%, var(--background))',
    border: 'color-mix(in srgb, var(--info) 30%, transparent)',
    text: 'var(--info)',
    icon: Hourglass,
    getMessage: () => 'Evaluated. Results will be published by the organizer.',
  },
  shortlisted: {
    bg: 'var(--status-selected-bg)',
    border: 'var(--status-open-border)',
    text: 'var(--status-selected-text)',
    icon: Trophy,
    getMessage: () => "Congratulations! You've been shortlisted.",
  },
  'not-selected': {
    bg: 'var(--status-closed-bg)',
    border: 'var(--status-closed-border)',
    text: 'var(--status-closed-text)',
    icon: Minus,
    getMessage: () => 'You were not selected for the next round.',
  },
  'not-evaluated': {
    bg: 'var(--status-closed-bg)',
    border: 'var(--status-closed-border)',
    text: 'var(--status-closed-text)',
    icon: Circle,
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
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      <config.icon size={16} aria-hidden="true" />
      <span>{config.getMessage(props)}</span>
    </div>
  );
}

