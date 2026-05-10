import React from 'react';
import { cn } from '../../lib/utils';

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

export default TypeBadge;
