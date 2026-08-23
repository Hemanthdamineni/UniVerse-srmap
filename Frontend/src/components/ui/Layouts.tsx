import React from "react";
import { cn } from "@/lib/core/utils";

// ── PageHeader ─────────────────────────────────────────────────────

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Alias for description (subtitle under the title). */
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, description, actions, className, ...props }: PageHeaderProps) {
  const sub = subtitle ?? description;
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6', className)} {...props}>
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="body-text mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
