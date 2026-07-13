
// ── SkeletonBlock ─────────────────────────────────────────────────────

import React from 'react';
import { cn } from '../../lib/core/utils';

export interface SkeletonBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function SkeletonBlock({
  className,
  width = '100%',
  height = '1rem',
  circle = false,
  ...props
}: SkeletonBlockProps) {
  return (
    <div
      className={cn('skeleton-shimmer', className)}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : 'var(--border-radius-lg, 12px)',
        ...props.style,
      }}
      {...props}
    />
  );
}


// ── SkeletonCard ─────────────────────────────────────────────────────

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("p-4 md:p-6 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] h-full w-full", className)}>
      <div className="h-6 w-1/3 skeleton-shimmer rounded mb-4"></div>
      <div className="h-4 w-full skeleton-shimmer rounded mb-2"></div>
      <div className="h-4 w-5/6 skeleton-shimmer rounded mb-2"></div>
      <div className="h-4 w-4/6 skeleton-shimmer rounded"></div>
    </div>
  );
}


// ── SkeletonTable ─────────────────────────────────────────────────────

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        border: '1px solid var(--comp-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 8,
          padding: '10px 16px',
          background: 'var(--comp-accent)',
        }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 12,
              borderRadius: 4,
              background: 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--comp-border)',
          }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="skeleton-shimmer"
              style={{ height: 14, borderRadius: 4 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

