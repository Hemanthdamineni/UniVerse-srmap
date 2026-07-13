interface ResultsSummaryCardProps {
  label: string;
  value: string;
  variant?: "accent" | "default";
}

export function ResultsSummaryCard({
  label,
  value,
  variant = "default",
}: ResultsSummaryCardProps) {
  const isAccent = variant === "accent";

  return (
    <div
      className="rounded-2xl p-4 text-white"
      style={{
        background: isAccent
          ? "var(--comp-accent)"
          : "var(--comp-surface)",
        border: "1px solid var(--comp-border)",
      }}
    >
      <p
        className="text-sm"
        style={{ color: isAccent ? "rgba(255,255,255,0.75)" : "var(--comp-text-secondary)" }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold"
        style={{ color: isAccent ? "white" : "var(--comp-text-primary)" }}
      >
        {value || "-"}
      </p>
    </div>
  );
}

interface InternalMarksBundledSectionProps {
  averagePercentage: number;
  children: React.ReactNode;
  title?: string;
}

export function InternalMarksSection({
  averagePercentage,
  children,
  title = "Internal Mark Details",
}: InternalMarksBundledSectionProps) {
  return (
    <section className="dashboard-card p-0">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--comp-text-primary)]">
            {title}
          </h2>
          <span className="rounded-full bg-[var(--comp-surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-secondary)]">
            {averagePercentage.toFixed(2)}% average
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}

export default ResultsSummaryCard;
