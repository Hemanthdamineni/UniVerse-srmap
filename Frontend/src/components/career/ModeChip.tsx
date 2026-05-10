import React from 'react';
import { cn } from '../../lib/utils';

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

export default ModeChip;
