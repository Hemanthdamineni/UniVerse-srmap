export default function TopicMasteryHeatmap({
  items,
}: {
  items: Array<{ label: string; mastery: number }>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--comp-border)] bg-[var(--comp-surface)] p-6 text-sm text-[var(--comp-text-muted)]">
        No mastery data yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="dashboard-card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--comp-text-primary)]">{item.label}</span>
            <span className="text-xs tabular-nums text-[var(--comp-text-muted)]">{Math.round(item.mastery * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--info)]"
              style={{ width: `${Math.max(4, Math.round(item.mastery * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
