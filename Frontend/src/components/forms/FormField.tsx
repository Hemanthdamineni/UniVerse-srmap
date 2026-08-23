import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
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
  const describedBy =
    [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const field =
    isValidElement(children) && (describedBy || error)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>, {
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
          ...(error ? { "aria-invalid": true } : {}),
        })
      : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">
        {label}
      </label>
      {field}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${id}-hint`} className="text-xs text-[var(--comp-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
