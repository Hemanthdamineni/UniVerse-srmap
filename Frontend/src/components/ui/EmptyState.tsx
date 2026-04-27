import React from 'react';
import { cn } from '../../lib/utils';
import { FileQuestion } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <div 
      className={cn('flex flex-col items-center justify-center p-8 text-center border-[0.5px] border-dashed border-[color:var(--comp-border-strong)] rounded-[var(--border-radius-lg,12px)] bg-[color:var(--comp-surface)]', className)}
      {...props}
    >
      <div className="mb-4 text-[color:var(--comp-text-muted)] opacity-80">
        {icon || <FileQuestion size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="card-title mb-1">{title}</h3>
      {description && <p className="body-text text-sm max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
