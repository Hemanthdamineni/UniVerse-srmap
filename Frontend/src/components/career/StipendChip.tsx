import React from 'react';
import { cn } from '../../lib/utils';

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

export default StipendChip;
