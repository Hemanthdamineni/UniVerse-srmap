import React from 'react';
import { cn } from '../../lib/utils';

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

export default DeadlineCountdown;
