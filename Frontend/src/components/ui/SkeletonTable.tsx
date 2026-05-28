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
