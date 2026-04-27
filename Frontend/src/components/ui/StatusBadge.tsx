// Maps status strings to --status-* token presets (no hardcoded colors).
import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  label?: string;
}

type Preset = 'open' | 'pending' | 'closed' | 'live' | 'selected' | 'rejected';

function resolvePreset(status: string): Preset {
  const norm = status.toLowerCase();
  if (
    norm.includes('reject') ||
    norm.includes('fail') ||
    norm.includes('error') ||
    norm.includes('absent') ||
    norm.includes('unpaid')
  ) {
    return 'rejected';
  }
  if (norm.includes('live') || norm.includes('ongoing')) return 'live';
  if (norm.includes('close') || norm.includes('complete') || norm.includes('done') || norm.includes('paid')) {
    return 'closed';
  }
  if (
    norm.includes('pending') ||
    norm.includes('warn') ||
    norm.includes('due') ||
    norm.includes('review') ||
    norm.includes('process')
  ) {
    return 'pending';
  }
  if (norm.includes('select') || norm.includes('shortlist') || norm.includes('approve')) return 'selected';
  return 'open';
}

const presetClass: Record<Preset, string> = {
  open: 'status-badge-open',
  pending: 'status-badge-pending',
  closed: 'status-badge-closed',
  live: 'status-badge-live',
  selected: 'status-badge-selected',
  rejected: 'status-badge-rejected',
};

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const preset = useMemo(() => resolvePreset(status), [status]);
  return (
    <span className={cn('status-badge', presetClass[preset], className)} {...props}>
      {label ?? status}
    </span>
  );
}
