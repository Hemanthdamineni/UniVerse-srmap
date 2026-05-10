import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({ id, label, hint, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-[var(--error)]">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-[var(--comp-text-muted)]">{hint}</p> : null}
    </div>
  );
}
