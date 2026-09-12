import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import VisibilityIcon from "@/assets/Icons/VisibilityIcon.svg";
import VisibilityOffIcon from "@/assets/Icons/VisibilityOffIcon.svg";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Classes for the wrapping relative container (positioning context for the toggle). */
  containerClassName?: string;
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <img
      src={open ? VisibilityIcon : VisibilityOffIcon}
      alt={open ? "Hide password" : "Show password"}
      aria-hidden="true"
      className="h-4 w-4"
    />
  );
}

/**
 * Password field with a keyboard-reachable show/hide toggle. The field's own
 * type stays password unless the user explicitly toggles it.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className={cn("relative", containerClassName)}>
        <input
          {...props}
          ref={ref}
          type={show ? "text" : "password"}
          className={cn(
            "w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--comp-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--comp-accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--comp-surface)]",
            className
          )}
        />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center rounded p-1 text-[var(--comp-text-secondary)] transition-colors hover:text-[var(--comp-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)]"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
