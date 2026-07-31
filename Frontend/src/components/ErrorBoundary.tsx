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
      className="flex min-h-[320px] w-full items-center justify-center p-6"
    >
      <div
        className="w-full max-w-md space-y-5 rounded-xl border p-6 text-center md:p-8"
        style={{
          background: "var(--surface)",
          borderColor: "color-mix(in srgb, var(--error) 20%, var(--border))",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Icon */}
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--error) 10%, transparent)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--error)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Copy */}
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Something went wrong
          </h2>
          <p className="mx-auto max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
            An error occurred while rendering this section. You can retry or return to the dashboard.
          </p>
        </div>

        {/* Error details */}
        {error && (
          <details
            className="w-full rounded-lg text-left"
            style={{
              border: "1px solid var(--border)",
              background: "var(--background)",
            }}
          >
            <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] select-none">
              Technical details
            </summary>
            <pre className="overflow-auto border-t px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]" style={{ borderColor: "var(--border)" }}>
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Actions — consistent component vocabulary */}
        <div className="flex justify-center gap-3 pt-1">
          <button onClick={onReset} type="button" className="btn-primary gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            type="button"
            className="btn-secondary"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
