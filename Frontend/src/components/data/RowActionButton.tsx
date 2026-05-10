import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type RowActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

export function RowActionButton({ icon, className, children, type = "button", ...props }: RowActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-2 text-sm text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)] focus-visible:ring-offset-2 disabled:opacity-50",
        className
      )}
      {...props}
    >
      {icon ?? children}
    </button>
  );
}
