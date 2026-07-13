
// ── EmptyState ─────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { cn } from '../../lib/core/utils';
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
      className={cn('flex flex-col items-center justify-center p-8 text-center border-[0.5px] border-dashed border-[color:var(--comp-border-strong)] rounded-[var(--border-radius-lg,12px)] bg-[color:var(--comp-surface)]', className)}
      {...props}
    >
      <div className="mb-4 text-[color:var(--comp-text-muted)] opacity-80">
        {icon || <FileQuestion size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="card-title mb-1">{title}</h3>
      {description && <p className="body-text text-sm max-w-sm mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}


// ── InlineError ─────────────────────────────────────────────────────


export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry, className, ...props }: InlineErrorProps) {
  return (
    <div 
      className={cn(
        'flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] p-4 text-[var(--error)]',
        className
      )}
      {...props}
    >
      <AlertCircle size={20} className="shrink-0" />
      <div className="flex-1 text-sm font-medium">{message}</div>
      {onRetry && (
        <button 
          onClick={onRetry}
          type="button"
          className="min-h-11 min-w-11 shrink-0 rounded-md p-2 transition-colors hover:bg-[color-mix(in_srgb,var(--error)_14%,transparent)] md:min-h-9 md:min-w-9"
          title="Retry"
        >
          <RefreshCw size={16} />
        </button>
      )}
    </div>
  );
}


// ── Toast ─────────────────────────────────────────────────────



export interface ToastProps {
  id: string;
  type?: "success" | "info";
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type = "info", message, onDismiss }: ToastProps) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle : Info;

  return (
    <div className={cn(
      "pointer-events-auto flex w-full max-w-md bg-[var(--comp-surface)] shadow-lg rounded-lg border border-[var(--comp-border)] py-3 px-4",
      "transition-all duration-300 ease-in-out transform"
    )}>
      <div className="flex w-full items-start gap-3">
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", isSuccess ? "text-[var(--success)]" : "text-[var(--info)]")} />
        <div className="flex-1 text-sm font-medium text-[var(--comp-text-primary)]">
          {message}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="shrink-0 text-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Simple export for rendering toast containers externally
export function ToastContainer({ toasts, onDismiss }: { toasts: ToastProps[], onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}


// ── AsyncState ─────────────────────────────────────────────────────

import { SkeletonCard } from "./Skeletons";
import { Button } from "../button";

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
      <SkeletonCard />
    </div>
  );
}

type ErrorProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ message, onRetry, className = "" }: ErrorProps) {
  return <InlineError message={message} onRetry={onRetry} className={className} />;
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

export function RetryAction({ onRetry }: { onRetry: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onRetry}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Retry
    </Button>
  );
}


// ── AnimatedCounter ─────────────────────────────────────────────────────


import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatFn?: (val: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  formatFn = (val) => val.toString(),
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const isInitialMount = useRef(true);
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0, once: true });

  useEffect(() => {
    if (!isVisible) return;

    // If user prefers reduced motion, just set it instantly
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || isInitialMount.current) {
      setDisplayValue(value);
      isInitialMount.current = false;
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;
    const valueDiff = endValue - startValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setDisplayValue(Math.round(startValue + valueDiff * easeProgress));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration, isVisible]);

  return <span ref={ref} className={`tabular-nums ${className}`}>{formatFn(displayValue)}</span>;
};

