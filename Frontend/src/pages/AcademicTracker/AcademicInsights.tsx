import { useEffect, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { getLmsAcademicInsights } from "../../lib/lmsApi";

const RECOMMENDATION_STYLES: Record<string, string> = {
  improvement: "border-amber-200 bg-amber-50",
  positive: "border-emerald-200 bg-emerald-50",
  suggestion: "border-blue-200 bg-blue-50",
  warning: "border-rose-200 bg-rose-50",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  improvement: "text-amber-800",
  positive: "text-emerald-800",
  suggestion: "text-blue-800",
  warning: "text-rose-800",
};

function GpaTrendBar({ semester, sgpa }: { semester: string; sgpa: number }) {
  const widthPercent = Math.min(100, (sgpa / 10) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs font-medium text-[var(--text-secondary)]">{semester}</span>
      <div className="flex-1">
        <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="flex h-full items-center justify-end rounded-full bg-[#0A3035] px-2 text-xs font-bold text-white transition-all"
            style={{ width: `${widthPercent}%` }}
          >
            {sgpa.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AcademicInsights() {
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof getLmsAcademicInsights>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getLmsAcademicInsights()
      .then((response) => {
        if (!active) return;
        setInsights(response);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load academic insights.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ErpPageShell
      title="Academic Insights"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Calculating academic insights..."
    >
      {error ? <StatusBanner message={{ id: "insights-error", tone: "warning", text: error }} /> : null}

      {insights ? (
        <>
          <SectionCard title="GPA Trend">
            <div className="space-y-2">
              {insights.gpaTrend.map((item) => (
                <GpaTrendBar key={item.semester} semester={item.semester} sgpa={item.sgpa} />
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Performance by Category">
              <div className="space-y-3">
                {insights.categoryPerformance.map((category) => (
                  <div
                    key={category.category}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-[#0A3035]">{category.category}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{category.subjects} subjects</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#0A3035]">{category.avgGrade}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Snapshot Grade</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#0A3035]">{category.avgGpa.toFixed(2)}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Avg GPA</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Key Highlights">
              <div className="space-y-3">
                {insights.highlights.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                    <p className="text-sm text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-[#0A3035]">{item.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Recommendations">
            <div className="grid gap-3 md:grid-cols-2">
              {insights.recommendations.map((recommendation) => (
                <div
                  key={recommendation.title}
                  className={`rounded-2xl border p-4 ${RECOMMENDATION_STYLES[recommendation.type] || RECOMMENDATION_STYLES.suggestion}`}
                >
                  <h3
                    className={`text-sm font-semibold ${RECOMMENDATION_LABELS[recommendation.type] || RECOMMENDATION_LABELS.suggestion}`}
                  >
                    {recommendation.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    {recommendation.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </ErpPageShell>
  );
}
