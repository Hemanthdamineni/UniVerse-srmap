import React from 'react';
import { cn } from '../../lib/utils';

export interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  titleClassName?: string;
  actions?: React.ReactNode;
  interactive?: boolean;
}

export function SectionCard({ title, description, titleClassName, actions, interactive = false, className, children, ...props }: SectionCardProps) {
  return (
    <div 
      className={cn(
        'border-[0.5px] border-[color:var(--comp-border)] bg-[color:var(--comp-surface)] rounded-[var(--border-radius-lg,12px)] p-[var(--space-lg,24px)]',
        interactive && 'interactive-card',
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex justify-between items-start mb-4 gap-4">
          <div>
            {title && <h2 className={cn('card-title', titleClassName)}>{title}</h2>}
            {description && <p className="body-text mt-1 text-sm">{description}</p>}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
