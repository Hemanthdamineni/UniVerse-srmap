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
        {items.map((item, index) => (
          <div key={`${item.userId}-${index}`} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
            <span className="text-sm font-medium text-[var(--comp-text-primary)]">#{index + 1} {String(item.userId || "unknown")}</span>
            <span className="text-sm text-[var(--text-secondary)]">{String(item.score || 0)} pts</span>
          </div>
        ))}
      </div>
    </section>
  );
}
