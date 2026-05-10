import React from 'react';
import { cn } from '../../lib/utils';
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

export default EligibilityBadge;
