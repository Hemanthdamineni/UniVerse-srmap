import * as React from "react";
import { cn } from "../../lib/core/utils";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Marks the chip as the active selection; renders accent surface with on-accent text. */
  selected?: boolean;
}

export function Chip({ selected = false, className, type = "button", children, ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]",
        selected
          ? "border-transparent bg-[var(--comp-accent)] text-[var(--comp-accent-fg)]"
          : "border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text-secondary)] hover:border-[var(--comp-border-strong)] hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
