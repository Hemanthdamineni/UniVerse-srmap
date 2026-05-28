export default function WeeklyLeaderboard({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="dashboard-card space-y-3 p-4">
      <h3 className="text-lg font-semibold text-[var(--comp-text-primary)]">Weekly leaderboard</h3>
      <div className="space-y-2">
        {items.map((item, index) => {
          const isTop3 = index < 3;
          return (
            <div
              key={`${item.userId}-${index}`}
              className="flex items-center justify-between rounded-2xl px-3 py-2"
              style={{
                background: 'var(--comp-surface)',
                borderLeft: isTop3 ? '3px solid var(--comp-accent)' : '3px solid transparent',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="text-xs font-bold shrink-0"
                  style={{
                    color: isTop3 ? 'var(--comp-accent)' : 'var(--comp-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    width: 24,
                    textAlign: 'right',
                  }}
                >
                  #{index + 1}
                </span>
                <span className="text-sm font-medium text-[var(--comp-text-primary)] truncate">
                  {String(item.userId || "unknown")}
                </span>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--comp-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {String(item.score || 0)} pts
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
