/**
 * SkeletonCard.tsx — Shimmer card skeleton matching CompetitionEventCard shape.
 * SkeletonTable.tsx — Shimmer table skeleton with configurable row count.
 */

/** Mimics CompetitionEventCard proportions */
export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--comp-surface)',
        border: '1px solid var(--comp-border)',
        borderRadius: 12,
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      {/* Category + status chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="skeleton-shimmer" style={{ height: 20, width: 70, borderRadius: 20 }} />
        <div className="skeleton-shimmer" style={{ height: 20, width: 50, borderRadius: 20 }} />
      </div>
      {/* Title */}
      <div className="skeleton-shimmer" style={{ height: 20, width: '80%', borderRadius: 4 }} />
      <div className="skeleton-shimmer" style={{ height: 16, width: '55%', borderRadius: 4 }} />
      {/* Description */}
      <div className="skeleton-shimmer" style={{ height: 14, width: '100%', borderRadius: 4 }} />
      <div className="skeleton-shimmer" style={{ height: 14, width: '70%', borderRadius: 4 }} />
      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--comp-border)', margin: '4px 0' }} />
      {/* Metadata row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="skeleton-shimmer" style={{ height: 14, width: 80, borderRadius: 4 }} />
        <div className="skeleton-shimmer" style={{ height: 14, width: 60, borderRadius: 4 }} />
        <div className="skeleton-shimmer" style={{ height: 14, width: 50, borderRadius: 4 }} />
      </div>
      {/* CTA row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <div className="skeleton-shimmer" style={{ height: 28, width: 90, borderRadius: 6 }} />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/** Mimics a data table with N shimmer rows */
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
      {/* Header */}
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
      {/* Rows */}
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
