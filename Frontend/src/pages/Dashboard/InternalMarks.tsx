import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { executePipeline, type InternalMarksModel } from "../../lib/erp/erpTransformers";
import { EmptyState } from "../../components/ui/Feedback";

function getTierColor(pct: number) {
  if (pct < 20) return "var(--error)";
  if (pct < 40) return "var(--warning)";
  if (pct < 75) return null;
  return "var(--success)";
}

const STATUS_ORDER: Record<string, number> = {
  "needs-improvement": 0,
  good: 1,
  excellent: 2,
};

export default function InternalMarks({ marksData }: { marksData?: any }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const processed = useMemo(() => {
    const result = executePipeline("internal-marks", marksData);
    if (!result?.isValid || !result.data) return null;
    return result.data as InternalMarksModel;
  }, [marksData]);

  if (!processed || processed.subjects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <EmptyState title="Internal Marks" description="No internal marks data available for this semester." />
      </div>
    );
  }

  const { subjects: rawSubjects, averagePercentage } = processed;
  const subjects = [...rawSubjects].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
  const atRiskCount = rawSubjects.filter((s) => s.percentage < 60).length;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="section-title font-bold">Internal Marks</h2>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[var(--comp-surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--comp-text-secondary)]">
            {averagePercentage.toFixed(0)}% avg
          </span>
          {atRiskCount > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "color-mix(in srgb, var(--error) 12%, var(--comp-surface))",
                color: "var(--error)",
              }}
            >
              {atRiskCount} at risk
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-[var(--comp-surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--comp-text-secondary)]">
            {subjects.length} {subjects.length === 1 ? "course" : "courses"}
          </span>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 content-center gap-2 ${subjects.length > 10 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {subjects.map((subject, index) => {
          const pct = subject.percentage;
          const tierColor = getTierColor(pct);
          const barColor = tierColor || "var(--comp-text-secondary)";

          return (
            <button
              key={subject.code}
              type="button"
              onClick={() => navigate("/exams/current-semester-results")}
              className="group flex flex-col justify-center gap-1 rounded-lg border border-[var(--comp-border)] px-2.5 py-1 text-left transition-colors hover:border-[var(--comp-border-strong)] hover:bg-[var(--comp-surface-hover)] overflow-hidden"
              style={{
                opacity: mounted ? 1 : 0,
                transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)`,
                transitionDelay: mounted ? `${index * 60}ms` : "0ms",
              }}
            >
              <div className="flex items-center justify-between gap-2 leading-tight">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {subject.code}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                  {Number(subject.marksObtained.toFixed(1))}/{subject.maxMarks}
                </span>
              </div>

              <div
                className="relative h-[5px] overflow-hidden rounded-full"
                style={{
                  background: `linear-gradient(90deg,
                    color-mix(in srgb, ${barColor} 40%, transparent) ${pct}%,
                    color-mix(in srgb, var(--border) 35%, transparent) ${pct}%
                  )`,
                }}
              >
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 group-hover:scale-150"
                  style={{
                    left: `${pct}%`,
                    width: 7,
                    height: 7,
                    backgroundColor: barColor,
                    boxShadow: `0 0 0 2px color-mix(in srgb, ${barColor} 25%, transparent)`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
