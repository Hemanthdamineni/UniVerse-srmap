
// ── StatusBadge ─────────────────────────────────────────────────────

// Maps status strings to --status-* token presets (no hardcoded colors).
import React, { useMemo } from 'react';
import { cn } from '../../lib/core/utils';

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


// ── Tag ─────────────────────────────────────────────────────




export interface TagProps {
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

export function Tag({ className, children, variant = "default" }: TagProps) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border";
  
  const variants = {
    default: "bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] border-[var(--comp-border)]",
    success: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_30%,transparent)]",
    error: "bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_30%,transparent)]",
    info: "bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_30%,transparent)]",
    outline: "bg-transparent text-[var(--comp-text-secondary)] border-[var(--comp-border)]"
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)}>
      {children}
    </span>
  );
}

