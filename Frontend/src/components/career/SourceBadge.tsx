import React from 'react';
import { cn } from '../../lib/utils';

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

export default SourceBadge;
