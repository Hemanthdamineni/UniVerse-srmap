import React from 'react';
import { cn } from '../../lib/utils';

interface ModeChipProps {
  mode?: 'remote' | 'onsite' | 'hybrid' | 'online' | 'offline';
  className?: string;
}

const modeStyles = {
  remote: 'bg-teal-50 text-teal-700 border-teal-100',
  online: 'bg-blue-50 text-blue-700 border-blue-100',
  onsite: 'bg-orange-50 text-orange-700 border-orange-100',
  offline: 'bg-amber-50 text-amber-700 border-amber-100',
  hybrid: 'bg-purple-50 text-purple-700 border-purple-100',
};

const ModeChip: React.FC<ModeChipProps> = ({ mode, className }) => {
  if (!mode) return null;

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium border capitalize',
      modeStyles[mode] || 'bg-gray-50 text-gray-700 border-gray-100',
      className
    )}>
      {mode}
    </span>
  );
};

export default ModeChip;
