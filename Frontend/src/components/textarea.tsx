import * as React from "react";
import { cn } from "../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[96px] w-full rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--comp-text-primary)] placeholder:text-[var(--comp-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
