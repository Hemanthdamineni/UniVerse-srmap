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
        'px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-medium border border-blue-100',
        className
      )}>
        Stipend: {stipend}
      </span>
    );
  }

  if (prize) {
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] sm:text-xs font-medium border border-amber-100',
        className
      )}>
        Prize: {prize}
      </span>
    );
  }

  if (isFree === false) {
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-md bg-gray-50 text-gray-700 text-[10px] sm:text-xs font-medium border border-gray-100',
        className
      )}>
        Paid Opportunity
      </span>
    );
  }

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-medium border border-emerald-100',
      className
    )}>
      Free
    </span>
  );
};

export default StipendChip;
