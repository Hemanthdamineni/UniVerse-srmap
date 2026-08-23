export default function WeeklyLeaderboard({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  if (!items.length) return null;

  const topScore = Math.max(1, Number(items[0]?.score || 1));

  return (
    <section className="dashboard-card space-y-3 p-4">
      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">
        Weekly Leaderboard
      </h3>
      <ol className="space-y-1.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, i) => {
          const userId = String(item.userId || "Unknown");
          const score = Number(item.score || 0);
          const pct = Math.max(6, Math.round((score / topScore) * 100));
          const isPodium = i < 3;

          return (
            <li
              key={`${userId}-${i}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background: isPodium
                  ? "color-mix(in srgb, var(--comp-accent) 6%, transparent)"
                  : "transparent",
              }}
            >
              {/* Rank */}
              <span
                className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums"
                style={{
                  color: isPodium ? "var(--comp-accent)" : "var(--comp-text-muted)",
                }}
              >
                {i + 1}
              </span>

              {/* Name + bar */}
              <div className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-medium text-[var(--comp-text-primary)]">
                  {userId}
                </span>
                <div
                  className="h-1 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--comp-border)" }}
                >
                  <div
                    className="h-full w-full origin-left rounded-full"
                    style={{
                      transform: `scaleX(${pct / 100})`,
                      background: isPodium ? "var(--comp-accent)" : "var(--comp-text-muted)",
                      transition: "transform var(--duration-slow) var(--ease-spring)",
                    }}
                  />
                </div>
              </div>

              {/* Score */}
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--comp-text-primary)]">
                {score}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
