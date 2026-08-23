
// ── EmptyState ─────────────────────────────────────────────────────

import * as React from "react";
import { cn } from '../../lib/core/utils';
import { Button } from '../button';
import { FileQuestion, AlertCircle, RefreshCw, CheckCircle, Info, X } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-2 p-6 text-center border-[0.5px] border-dashed border-[color:var(--comp-border-strong)] rounded-[var(--border-radius-lg,12px)] bg-[color:var(--comp-surface)]', className)}
      {...props}
    >
      <div className="text-[color:var(--comp-text-muted)] opacity-80">
        {icon || <FileQuestion size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="card-title">{title}</h3>
      {description && <p className="body-text text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}


// ── InlineError ─────────────────────────────────────────────────────


export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  onRetry?: () => void;
}

export function InlineError({ message, title, description, action, onRetry, className, ...props }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4 text-[var(--error)]',
        className
      )}
      {...props}
    >
      <AlertCircle size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">{title}</p> : null}
        <p className="break-words text-sm font-medium">{message}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</p> : null}
        {(onRetry || action) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry ? (
              <button
                onClick={onRetry}
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--error)_24%,transparent)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--error)] transition-colors hover:bg-[color-mix(in_srgb,var(--error)_8%,var(--surface))]"
              >
                <RefreshCw size={14} />
                Try again
              </button>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}


// ── Toast ─────────────────────────────────────────────────────



export interface ToastProps {
  id: string;
  type?: "success" | "error" | "info";
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type = "info", message, onDismiss }: ToastProps) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const Icon = isSuccess ? CheckCircle : isError ? AlertCircle : Info;

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={cn(
        "pointer-events-auto flex w-full max-w-md bg-[var(--comp-surface)] shadow-lg rounded-lg border py-3 px-4",
        isSuccess
          ? "border-[color-mix(in_srgb,var(--success)_45%,transparent)]"
          : isError
            ? "border-[color-mix(in_srgb,var(--error)_45%,transparent)]"
            : "border-[var(--comp-border)]",
        "transition-all [transition-duration:var(--duration-normal)] [transition-timing-function:var(--ease-spring)]"
      )}
    >
      <div className="flex w-full items-start gap-3">
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", isSuccess ? "text-[var(--success)]" : isError ? "text-[var(--error)]" : "text-[var(--info)]")} />
        <div className="flex-1 text-sm font-medium text-[var(--comp-text-primary)]">
          {message}
        </div>
        <button
          onClick={() => onDismiss(id)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded p-1 -m-1 text-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Simple export for rendering toast containers externally
export type ToastInput = Omit<ToastProps, "onDismiss">;

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastInput[], onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToasts(durationMs = 4000) {
  const [toasts, setToasts] = React.useState<ToastInput[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = React.useCallback((message: string, type: ToastInput["type"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    window.setTimeout(() => dismissToast(id), durationMs);
  }, [dismissToast, durationMs]);

  return { toasts, showToast, dismissToast };
}


// ── AsyncState ─────────────────────────────────────────────────────

type LoadingProps = {
  variant?: "card" | "block";
  rows?: number;
  className?: string;
};

export function LoadingState({ variant = "card", rows = 3, className = "" }: LoadingProps) {
  if (variant === "block") {
    return (
      <div className={`space-y-3 ${className}`} aria-hidden="true">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="skeleton-shimmer h-11 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      <SkeletonCardComponent />
    </div>
  );
}

function SkeletonCardComponent() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-3/4 rounded bg-[color-mix(in_srgb,var(--comp-text-primary)_10%,transparent)]" />
      <div className="h-4 w-1/2 rounded bg-[color-mix(in_srgb,var(--comp-text-primary)_10%,transparent)]" />
      <div className="h-4 w-5/6 rounded bg-[color-mix(in_srgb,var(--comp-text-primary)_10%,transparent)]" />
    </div>
  );
}

type EmptyProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyView({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = "",
}: EmptyProps) {
  const action =
    actionLabel && onAction ? (
      <Button type="button" variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : undefined;

  return <EmptyState title={title} description={description} icon={icon} action={action} className={className} />;
}


// ── StatusPill ─────────────────────────────────────────────────────

export function FeedbackStatusPill({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "border-[color-mix(in_srgb,var(--success)_28%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
      : status === "rejected"
        ? "border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]"
        : "border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${className}`}>
      {status}
    </span>
  );
}
