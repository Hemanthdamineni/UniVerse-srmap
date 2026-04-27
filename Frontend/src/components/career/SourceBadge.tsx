import React from 'react';
import { cn } from '../../lib/utils';

interface SourceBadgeProps {
  source: string;
  className?: string;
}

const sourceStyles: Record<string, string> = {
  jobspy: 'text-blue-600 font-semibold',
  devfolio: 'text-purple-600 font-semibold',
  unstop: 'text-blue-500 font-semibold',
  linkedin: 'text-[var(--info)] font-bold',
  manual: 'text-gray-500 italic',
};

const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className }) => {
  if (!source) return null;

  const displaySource = source === 'jobspy' ? 'LinkedIn' : source; // Example normalization

  return (
    <span className={cn(
      'text-[10px] sm:text-xs uppercase tracking-wider',
      sourceStyles[source.toLowerCase()] || 'text-gray-400',
      className
    )}>
      via {displaySource}
    </span>
  );
};

export default SourceBadge;
