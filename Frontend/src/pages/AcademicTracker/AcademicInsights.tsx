import { useEffect, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { getLmsAcademicInsights } from "../../lib/lms/index";

const RECOMMENDATION_STYLES: Record<string, string> = {
  improvement: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)]",
  positive: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]",
  suggestion: "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)]",
  warning: "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]",
};
 
const RECOMMENDATION_LABELS: Record<string, string> = {
  improvement: "text-[var(--warning)]",
  positive: "text-[var(--success)]",
  suggestion: "text-[var(--info)]",
  warning: "text-[var(--error)]",
};

function GpaTrendBar({ semester, sgpa }: { semester: string; sgpa: number }) {
  const widthPercent = Math.min(100, (sgpa / 10) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs font-medium text-[var(--text-secondary)]">{semester}</span>
      <div className="flex-1">
        <div className="h-6 w-full overflow-hidden rounded-full bg-[var(--comp-border)]">
          <div
            className="flex h-full items-center justify-end rounded-full bg-[var(--comp-accent)] px-2 text-xs font-bold text-white transition-all"
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
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{category.category}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{category.subjects} subjects</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[var(--comp-text-primary)]">{category.avgGrade}</p>
                        <p className="text-xs text-[var(--text-secondary)]">Snapshot Grade</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[var(--comp-text-primary)]">{category.avgGpa.toFixed(2)}</p>
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
                  <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">{item.value}</p>
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

          {insights.careerReadiness ? (
            <SectionCard title="Career-Aware Action Plan">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">ATS-style Resume Score</p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--comp-text-primary)]">
                      {insights.careerReadiness.resumeScore.score}%
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Inputs: {insights.careerReadiness.inputsUsed.academicSignals.join(", ") || "career profile only"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                    <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">What to improve next</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
                      {insights.careerReadiness.nextActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  {insights.careerReadiness.recommendedOpportunities.length ? (
                    insights.careerReadiness.recommendedOpportunities.map((opportunity) => (
                      <article
                        key={opportunity.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">
                              {opportunity.title}
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {opportunity.organization || opportunity.type}
                            </p>
                          </div>
                          <span className="rounded-full border border-[var(--border)] px-3 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                            {Math.round(opportunity.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                          <p>Matched: {opportunity.matchedSkills.join(", ") || "profile signals"}</p>
                          <p>Close gaps: {opportunity.missingSkills.join(", ") || "none detected"}</p>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                          {opportunity.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4 text-sm text-[var(--text-secondary)]">
                      No eligible career opportunities are available for the current profile.
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Recommendation Trace">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div>
                <p className="text-sm font-semibold text-[var(--comp-text-primary)]">
                  Snapshot {insights.snapshot ? "saved" : "not persisted"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {insights.snapshot
                    ? `Captured ${new Date(insights.snapshot.createdAt).toLocaleString()} from academic and career signals.`
                    : "Tracker persistence is unavailable in this environment."}
                </p>
              </div>
              <div className="space-y-2">
                {(insights.recommendationEvents || []).slice(0, 4).map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-[var(--comp-text-primary)]">{event.recommendationTitle}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {event.sourceDomain} · {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </ErpPageShell>
  );
}
