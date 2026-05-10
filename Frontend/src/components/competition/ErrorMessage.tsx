import { ErrorState } from "../ui/AsyncState";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;    // shows "Try again" button if provided
  preservedInput?: boolean; // if true, adds "Your input has been preserved" note
}

export function ErrorMessage({ title, message, onRetry, preservedInput }: ErrorMessageProps) {
  const prefix = title ? `${title}: ` : "";
  const suffix = preservedInput ? " Your input has been preserved." : "";
  return (
    <ErrorState message={`${prefix}${message}${suffix}`} onRetry={onRetry} />
  );
}
