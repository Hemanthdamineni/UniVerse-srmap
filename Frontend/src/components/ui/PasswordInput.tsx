import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Classes for the wrapping relative container (positioning context for the toggle). */
  containerClassName?: string;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Password field with a built-in show/hide toggle. The toggle is excluded
 * from tab order via tabIndex={-1} so keyboard users tab field → submit;
 * the field's own type stays password unless toggled.
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
            "w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]",
            className
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((value) => !value)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center border-0 bg-transparent p-0.5 text-[var(--comp-text-secondary)] transition-colors hover:text-[var(--comp-accent)]"
        >
          <EyeIcon open={show} />
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
