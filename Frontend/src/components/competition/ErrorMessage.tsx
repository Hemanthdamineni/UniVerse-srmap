/**
 * ErrorMessage.tsx — Standardized inline error display.
 *
 * Toast policy: Use toast notifications ONLY for success confirmation.
 * Never for errors that require user action — those get this component.
 */

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;    // shows "Try again" button if provided
  preservedInput?: boolean; // if true, adds "Your input has been preserved" note
}

export function ErrorMessage({ title, message, onRetry, preservedInput }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      style={{
        background: '#fff1f2',
        border: '1px solid #fecdd3',
        borderRadius: 8,
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }} aria-hidden="true">⚠️</span>
        <div style={{ flex: 1 }}>
          {title && (
            <p style={{ fontWeight: 600, color: '#9f1239', fontSize: '0.875rem', margin: 0 }}>
              {title}
            </p>
          )}
          <p style={{ color: '#be123c', fontSize: '0.875rem', margin: 0, marginTop: title ? 2 : 0 }}>
            {message}
          </p>
          {preservedInput && (
            <p style={{ color: 'var(--comp-text-muted)', fontSize: '0.8rem', margin: 0, marginTop: 4 }}>
              Your input has been preserved.
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="comp-btn-ghost"
          style={{ alignSelf: 'flex-start', marginTop: 'var(--space-xs)', fontSize: '0.8rem' }}
          aria-label="Try again"
        >
          Try again
        </button>
      )}
    </div>
  );
}
