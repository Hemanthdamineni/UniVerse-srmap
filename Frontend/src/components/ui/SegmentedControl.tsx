import * as React from "react";
import { cn } from "../../lib/core/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional counter rendered as a pill inside the option; hidden when null/undefined/false. */
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** sm = dense widget toggles; md = page-level tab rails. */
  size?: "sm" | "md";
  /** Stretch options equally on screens ≥480px (page tab rails). */
  fluid?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Segmented toggle group rendered as buttons with aria-pressed.
 * For full WAI-ARIA tabs semantics (arrow-key navigation, roving
 * tabindex) build on the tablist pattern instead.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fluid = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg font-medium transition-all",
              size === "sm" ? "gap-2 px-3 py-2 text-xs font-semibold" : "gap-1.5 px-3 py-2 text-sm",
              fluid && "min-[480px]:flex-1",
              active
                ? "bg-[var(--comp-accent)] text-[var(--comp-accent-fg)] shadow-sm"
                : "text-[var(--comp-text-secondary)] hover:bg-[var(--comp-surface-hover)]"
            )}
          >
            {option.label}
            {option.badge != null && option.badge !== false && (
              <span
                className={cn(
                  "rounded-full px-2 text-xs font-bold leading-4",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]"
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
