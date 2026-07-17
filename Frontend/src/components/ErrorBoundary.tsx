import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Optional custom fallback UI — replaces the default card when provided. */
  fallback?: React.ReactNode;
  /** Optional callback invoked with error details when an error is caught. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

/**
 * React error boundary that catches render-phase errors in its subtree.
 *
 * - Displays a user-friendly "Something went wrong" fallback card.
 * - Logs errors to `console.error` automatically.
 * - "Try Again" button resets the boundary so children re-render.
 * - Accepts an optional `fallback` prop for fully custom fallback UIs.
 * - Accepts an optional `onError` callback for side-effects (e.g. analytics).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  /** Reset the boundary so the tree is re-rendered. */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// DefaultFallback
// ---------------------------------------------------------------------------

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[300px] w-full items-center justify-center p-8"
    >
      <div className="flex max-w-md flex-col items-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-lg">
        {/* Icon */}
        <span className="text-5xl" aria-hidden="true">
          ⚠️
        </span>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Something went wrong
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            An unexpected error occurred. Please try again or contact support if
            the problem persists.
          </p>
        </div>

        {/* Expandable error details (dev-friendly) */}
        {error && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-[var(--background)] p-3 text-left text-xs text-[var(--text-secondary)]">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Reset button */}
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-medium text-[var(--comp-accent-fg)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
        >
          Try Again
        </button>

        {/* Navigate back to dashboard -- breaks infinite retry loops */}
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
