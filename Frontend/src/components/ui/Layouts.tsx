
// ── SplitLayout ─────────────────────────────────────────────────────

import React from "react";
import { cn } from "@/lib/utils";

export interface SplitLayoutProps {
  className?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function SplitLayout({ className, sidebar, children }: SplitLayoutProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-6", className)}>
      {sidebar && (
        <aside className="w-full md:w-64 shrink-0">
          {sidebar}
        </aside>
      )}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}


// ── FormSection ─────────────────────────────────────────────────────


export interface FormSectionProps {
  className?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ className, title, description, children }: FormSectionProps) {
  return (
    <div className={cn("mb-8 last:mb-0", className)}>
      <div className="mb-4">
        <h3 className="section-title">{title}</h3>
        {description && <p className="body-text mt-1">{description}</p>}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}


// ── InputGroup ─────────────────────────────────────────────────────


export interface InputGroupProps {
  className?: string;
  label: string;
  id?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function InputGroup({ className, label, id, error, required, children }: InputGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="label-text">
        {label}
        {required && <span className="text-[var(--error)] ml-1">*</span>}
      </label>
      {children}
      {error && <span className="text-xs text-[var(--error)]">{error}</span>}
    </div>
  );
}


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

