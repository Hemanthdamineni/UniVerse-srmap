import React from "react";
import { RefreshCw } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { InlineError } from "./InlineError";
import { SkeletonCard } from "./SkeletonCard";
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
