/**
 * StatusBadge.tsx — Status pill with phase-aware styling and accessibility.
 * Includes pulsing dot for live/in-progress states.
 */

interface StatusBadgeProps {
  status:
    | 'draft'
    | 'published'
    | 'public'
    | 'ongoing'
    | 'submission-closed'
    | 'evaluation'
    | 'results-published'
    | 'completed'
    | 'archived'
    | 'open'
    | 'upcoming'
    | 'closed'
    | 'in-progress';
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<
  StatusBadgeProps['status'],
  { bg: string; text: string; border: string; label: string; pulse: boolean }
> = {
  draft: {
    bg: 'var(--status-closed-bg)',
    text: 'var(--status-closed-text)',
    border: 'var(--status-closed-border)',
    label: 'Draft',
    pulse: false,
  },
  published: {
    bg: 'var(--comp-accent-light)',
    text: 'var(--comp-accent)',
    border: '#b6d4d8',
    label: 'Published',
    pulse: false,
  },
  public: {
    bg: 'var(--comp-accent-light)',
    text: 'var(--comp-accent)',
    border: '#b6d4d8',
    label: 'Public',
    pulse: false,
  },
  ongoing: {
    bg: 'var(--status-pending-bg)',
    text: 'var(--status-pending-text)',
    border: 'var(--status-pending-border)',
    label: 'In Progress',
    pulse: true,
  },
  'in-progress': {
    bg: 'var(--status-pending-bg)',
    text: 'var(--status-pending-text)',
    border: 'var(--status-pending-border)',
    label: 'In Progress',
    pulse: true,
  },
  open: {
    bg: 'var(--status-open-bg)',
    text: 'var(--status-open-text)',
    border: 'var(--status-open-border)',
    label: 'Open',
    pulse: false,
  },
  upcoming: {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#cbd5e1',
    label: 'Upcoming',
    pulse: false,
  },
  'submission-closed': {
    bg: 'var(--status-closed-bg)',
    text: 'var(--status-closed-text)',
    border: 'var(--status-closed-border)',
    label: 'Closed',
    pulse: false,
  },
  closed: {
    bg: 'var(--status-closed-bg)',
    text: 'var(--status-closed-text)',
    border: 'var(--status-closed-border)',
    label: 'Closed',
    pulse: false,
  },
  evaluation: {
    bg: '#faf5ff',
    text: '#7c3aed',
    border: '#e9d5ff',
    label: 'Evaluation',
    pulse: false,
  },
  'results-published': {
    bg: 'var(--status-open-bg)',
    text: 'var(--status-open-text)',
    border: 'var(--status-open-border)',
    label: 'Results Out',
    pulse: false,
  },
  completed: {
    bg: 'var(--status-closed-bg)',
    text: 'var(--status-closed-text)',
    border: 'var(--status-closed-border)',
    label: 'Completed',
    pulse: false,
  },
  archived: {
    bg: 'var(--status-closed-bg)',
    text: 'var(--status-closed-text)',
    border: 'var(--status-closed-border)',
    label: 'Archived',
    pulse: false,
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const fontSize = size === 'sm' ? '0.68rem' : '0.75rem';
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';

  return (
    <span
      role="status"
      aria-label={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        borderRadius: 9999,
        padding,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      {style.pulse && (
        <span
          className="status-pulse"
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: style.text,
            flexShrink: 0,
          }}
        />
      )}
      {style.label}
    </span>
  );
}
