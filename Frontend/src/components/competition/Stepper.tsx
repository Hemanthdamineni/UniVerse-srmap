import type { CSSProperties } from "react";

type StepperProps = {
  /** Step labels, rendered in order with 1-based numbering. */
  steps: string[];
  /** Zero-based index of the current step. */
  activeIndex: number;
  /** When provided, steps become buttons that navigate freely (wizard mode). */
  onSelect?: (index: number) => void;
  /** Extra classes appended to the stepper container. */
  className?: string;
  /** Accessible name for the stepper container. */
  ariaLabel?: string;
};

/**
 * Shared step indicator for competition workflows.
 *
 * One visual language (`.create-wizard-steps` in styles/events/create.css —
 * do not duplicate those styles here) with two behaviours:
 * - interactive: pass `onSelect` to render buttons with free navigation
 *   (e.g. CreateEventPage wizard);
 * - passive: omit `onSelect` to render read-only progress pills
 *   (e.g. RegistrationFlowPage).
 */
export function Stepper({ steps, activeIndex, onSelect, className, ariaLabel }: StepperProps) {
  const interactive = typeof onSelect === "function";

  return (
    <div
      className={className ? `create-wizard-steps ${className}` : "create-wizard-steps"}
      style={{ "--stepper-count": steps.length } as CSSProperties}
      aria-label={ariaLabel}
    >
      {steps.map((label, index) => {
        const isActive = index === activeIndex;
        const stepClass = isActive ? "stepper-step is-active" : "stepper-step";
        if (interactive) {
          return (
            <button
              key={label}
              className={stepClass}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={isActive ? "step" : undefined}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          );
        }
        return (
          <span key={label} className={stepClass} aria-current={isActive ? "step" : undefined}>
            <span>{index + 1}</span>
            {label}
          </span>
        );
      })}
    </div>
  );
}
