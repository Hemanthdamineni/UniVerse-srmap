/**
 * EmptyState.tsx — Contextual empty states with optional action.
 */

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2xl) var(--space-xl)',
        textAlign: 'center',
        gap: 'var(--space-sm)',
      }}
      aria-label={title}
    >
      {icon && (
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }} aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="comp-heading-md" style={{ margin: 0 }}>{title}</p>
      {description && (
        <p className="comp-body" style={{ margin: 0, maxWidth: 360 }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="comp-btn-primary"
          style={{ marginTop: 'var(--space-sm)' }}
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
