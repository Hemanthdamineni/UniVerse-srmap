/**
 * SummaryStatBar.tsx — Horizontal stats row with empty state.
 */

interface Stat {
  label: string;
  value: number;
  color?: string;
}

interface SummaryStatBarProps {
  stats: Stat[];
}

export function SummaryStatBar({ stats }: SummaryStatBarProps) {
  const allZero = stats.every((s) => s.value === 0);

  if (allZero) {
    return (
      <p className="comp-body" style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
        No submissions yet.
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0,
        background: 'var(--comp-surface)',
        border: '1px solid var(--comp-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
      role="list"
      aria-label="Summary statistics"
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          role="listitem"
          style={{
            flex: '1 1 0',
            minWidth: 100,
            padding: 'var(--space-md)',
            borderLeft: i > 0 ? '1px solid var(--comp-border)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: stat.color ?? 'var(--comp-text-primary)',
              lineHeight: 1,
            }}
          >
            {stat.value}
          </span>
          <span className="comp-label">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
