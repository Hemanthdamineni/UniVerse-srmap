
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


// ── PageSkeleton ─────────────────────────────────────────────────────
// Full-page loading state that mirrors real ERP page anatomy instead of
// floating text over an empty surface. Decorative bars are aria-hidden;
// `message` stays in the DOM as a visually-hidden live region.

export type PageSkeletonVariant = "table" | "stats" | "document";

export interface PageSkeletonProps {
  message?: string;
  variant?: PageSkeletonVariant;
  className?: string;
}

function ShimmerBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton-shimmer rounded", className)} style={style} />;
}

/** Column rhythm loosely mirrors ERP tables: label-heavy first column. */
const TABLE_COLUMN_WIDTHS = ["22%", "30%", "18%", "16%", "8%"];

function SkeletonTableCard({ rows = 6 }: { rows?: number }) {
  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--comp-border)] px-5 py-3">
        <ShimmerBar className="h-4 w-36" />
        <ShimmerBar className="h-3 w-14" />
      </div>
      <div>
        {Array.from({ length: rows + 1 }).map((_, row) => (
          <div
            key={row}
            className={`flex items-center gap-6 px-5 ${row === 0 ? "py-2.5" : "border-t border-[color-mix(in_srgb,var(--comp-border)_55%,transparent)] py-3.5"}`}
          >
            {TABLE_COLUMN_WIDTHS.map((width, col) => (
              <ShimmerBar
                key={col}
                className={row === 0 ? "h-3" : "h-3.5"}
                // Rotate widths per row so rows read as distinct records.
                style={row === 0 ? undefined : { width: TABLE_COLUMN_WIDTHS[(col + row) % TABLE_COLUMN_WIDTHS.length] }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonSectionCard() {
  return (
    <div className="dashboard-card space-y-3 p-4">
      <ShimmerBar className="h-4 w-40" />
      <ShimmerBar className="h-3 w-full" />
      <ShimmerBar className="h-3 w-11/12" />
      <ShimmerBar className="h-3 w-4/6" />
    </div>
  );
}

function SkeletonKpiCard() {
  return (
    <div className="dashboard-card space-y-2 p-4">
      <ShimmerBar className="h-3 w-24" />
      <ShimmerBar className="h-7 w-16" />
      <ShimmerBar className="h-2.5 w-20" />
    </div>
  );
}

function SkeletonTabBar({ segments = 4 }: { segments?: number }) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-1">
      {Array.from({ length: segments }).map((_, i) => (
        <ShimmerBar key={i} className="h-8 flex-1" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      <SkeletonTableCard />
      <SkeletonSectionCard />
    </>
  );
}

function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
      </div>
      <SkeletonTabBar />
      <SkeletonTableCard rows={5} />
    </>
  );
}

function DocumentSkeleton() {
  return (
    <div className="dashboard-card space-y-4 p-4 md:p-6">
      <ShimmerBar className="h-5 w-48" />
      <div className="space-y-2.5">
        <ShimmerBar className="h-3 w-full" />
        <ShimmerBar className="h-3 w-11/12" />
        <ShimmerBar className="h-3 w-4/5" />
      </div>
      <div className="grid gap-4 pt-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <ShimmerBar className="h-2.5 w-20" />
            <ShimmerBar className="h-3.5 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ message, variant = "table", className }: PageSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("space-y-4", className)}>
      {message ? <span className="sr-only">{message}</span> : null}
      <div aria-hidden="true">
        {variant === "stats" ? <StatsSkeleton /> : variant === "document" ? <DocumentSkeleton /> : <TableSkeleton />}
      </div>
    </div>
  );
}

