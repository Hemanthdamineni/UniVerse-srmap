
// ── DeadlineBadge ─────────────────────────────────────────────────────

import React from 'react';
import { cn } from '../../lib/core/utils';

interface DeadlineCountdownProps {
  deadline?: string;
  className?: string;
}

const DeadlineCountdown: React.FC<DeadlineCountdownProps> = ({ deadline, className }) => {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let display = '';
  let colorClass = '';

  if (diffDays < 0) {
    display = 'Expired';
    colorClass = 'text-[var(--comp-text-muted)] bg-[var(--comp-surface-hover)] border-[var(--comp-border)]';
  } else if (diffDays === 0) {
    display = 'Today, closes tonight';
    colorClass = 'text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border-[color-mix(in_srgb,var(--error)_30%,transparent)] font-bold';
  } else if (diffDays < 3) {
    display = `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
    colorClass = 'text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border-[color-mix(in_srgb,var(--error)_24%,transparent)] font-bold';
  } else if (diffDays < 7) {
    display = `Deadline in ${diffDays} days`;
    colorClass = 'text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border-[color-mix(in_srgb,var(--warning)_24%,transparent)]';
  } else if (diffDays < 14) {
    display = `Deadline in ${diffDays} days`;
    colorClass = 'text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] border-[color-mix(in_srgb,var(--warning)_20%,transparent)]';
  } else {
    display = `Deadline: ${deadlineDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    colorClass = 'text-[var(--comp-text-secondary)] bg-[var(--comp-surface-hover)] border-[var(--comp-border)]';
  }

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-[10px] sm:text-xs border whitespace-nowrap',
      colorClass,
      className
    )}>
      {display}
    </span>
  );
};

export { DeadlineCountdown };
export { DeadlineCountdown as DeadlineBadge };


// ── EligibilityBadge ─────────────────────────────────────────────────────

import { CheckCircle2, XCircle } from 'lucide-react';

interface EligibilityBadgeProps {
  eligible: boolean;
  label: string;
  className?: string;
}

const EligibilityBadge: React.FC<EligibilityBadgeProps> = ({ eligible, label, className }) => {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium',
      eligible 
        ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_24%,transparent)]' 
        : 'bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_24%,transparent)]',
      className
    )}>
      {eligible ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      {eligible ? 'Eligible' : 'Not Eligible'}: {label}
    </div>
  );
};

export { EligibilityBadge };


// ── ModeChip ─────────────────────────────────────────────────────


interface ModeChipProps {
  mode?: 'remote' | 'onsite' | 'hybrid' | 'online' | 'offline';
  className?: string;
}

const modeStyles = {
  remote: 'bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] text-[var(--comp-accent)] border-[color-mix(in_srgb,var(--comp-accent)_22%,transparent)]',
  online: 'bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_24%,transparent)]',
  onsite: 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_24%,transparent)]',
  offline: 'bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_24%,transparent)]',
  hybrid: 'bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)] border-[var(--comp-border)]',
};

const ModeChip: React.FC<ModeChipProps> = ({ mode, className }) => {
  if (!mode) return null;

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium border capitalize',
      modeStyles[mode] || 'bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] border-[var(--comp-border)]',
      className
    )}>
      {mode}
    </span>
  );
};

export { ModeChip };


// ── SourceBadge ─────────────────────────────────────────────────────


interface SourceBadgeProps {
  source: string;
  className?: string;
}

const sourceStyles: Record<string, string> = {
  jobspy: 'text-[var(--comp-accent)] font-semibold',
  devfolio: 'text-[var(--comp-accent)] font-semibold',
  unstop: 'text-[var(--comp-accent)] font-semibold',
  linkedin: 'text-[var(--comp-accent)] font-bold',
  manual: 'text-[var(--comp-text-muted)] italic',
};

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className }) => {
  if (!source) return null;

  const displaySource = source === 'jobspy' ? 'LinkedIn' : source; // Example normalization

  return (
    <span className={cn(
      'text-[10px] sm:text-xs uppercase tracking-wider',
      sourceStyles[source.toLowerCase()] || 'text-[var(--comp-text-muted)]',
      className
    )}>
      via {displaySource}
    </span>
  );
};

export { SourceBadge };


// ── StipendChip ─────────────────────────────────────────────────────


interface StipendChipProps {
  stipend?: string;
  prize?: string;
  isFree?: boolean;
  className?: string;
}

const StipendChip: React.FC<StipendChipProps> = ({ stipend, prize, isFree, className }) => {
  if (stipend) {
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)] text-[10px] sm:text-xs font-medium border border-[color-mix(in_srgb,var(--info)_24%,transparent)]',
        className
      )}>
        Stipend: {stipend}
      </span>
    );
  }

  if (prize) {
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)] text-[10px] sm:text-xs font-medium border border-[color-mix(in_srgb,var(--warning)_24%,transparent)]',
        className
      )}>
        Prize: {prize}
      </span>
    );
  }

  if (isFree === false) {
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-md bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] text-[10px] sm:text-xs font-medium border border-[var(--comp-border)]',
        className
      )}>
        Paid Opportunity
      </span>
    );
  }

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-md bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] text-[10px] sm:text-xs font-medium border border-[color-mix(in_srgb,var(--success)_24%,transparent)]',
      className
    )}>
      Free
    </span>
  );
};

export { StipendChip };


// ── TypeBadge ─────────────────────────────────────────────────────


interface TypeBadgeProps {
  type: 'job' | 'internship' | 'hackathon' | 'competition' | 'fellowship' | 'workshop';
  className?: string;
}

const typeStyles = {
  job: 'bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] text-[var(--comp-accent)] border-[color-mix(in_srgb,var(--comp-accent)_25%,transparent)]',
  internship: 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]',
  hackathon: 'bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]',
  competition: 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_30%,transparent)]',
  fellowship: 'bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] text-[var(--comp-text-primary)] border-[color-mix(in_srgb,var(--comp-accent)_22%,transparent)]',
  workshop: 'bg-[color-mix(in_srgb,var(--surface)_70%,var(--background)_30%)] text-[var(--comp-text-primary)] border-[var(--comp-border)]',
};

const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className }) => {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
      typeStyles[type] || 'bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)] border-[var(--comp-border)]',
      className
    )}>
      {type}
    </span>
  );
};

export { TypeBadge };

