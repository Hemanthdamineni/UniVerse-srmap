import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry, className, ...props }: InlineErrorProps) {
  return (
    <div 
      className={cn(
        'flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4 text-[var(--error)]',
        className
      )}
      {...props}
    >
      <AlertCircle size={20} className="shrink-0" />
      <div className="flex-1 text-sm font-medium">{message}</div>
      {onRetry && (
        <button 
          onClick={onRetry}
          type="button"
          className="min-h-11 min-w-11 shrink-0 rounded-md p-2 transition-colors hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)] md:min-h-9 md:min-w-9"
          title="Retry"
        >
          <RefreshCw size={16} />
        </button>
      )}
    </div>
  );
}
