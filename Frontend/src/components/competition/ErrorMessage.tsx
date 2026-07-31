import { InlineError } from "../ui/Feedback";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;    // shows "Try again" button if provided
  preservedInput?: boolean; // if true, adds "Your input has been preserved" note
}

export function ErrorMessage({ title, message, onRetry, preservedInput }: ErrorMessageProps) {
  const suffix = preservedInput ? " Your input has been preserved." : "";
  return (
    <InlineError
      title={title || "Something went wrong"}
      message={`${message}${suffix}`}
      description="Retry this section. If it keeps failing, your session or the campus service may need attention."
      onRetry={onRetry}
    />
  );
}
