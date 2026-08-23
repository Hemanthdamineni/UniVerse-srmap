import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { ProgressBar } from "../../../components/ui/Progress";
import type { InsightsData, OverviewData, UnifiedData } from "./types";

export function RisksTab({
  overview,
  insights,
  unified,
}: {
  overview: OverviewData | null;
  insights: InsightsData | null;
  unified: UnifiedData | null;
}) {
  if (!overview) return null;

  const attendancePct = parseFloat(overview.attendancePct) || 0;

  return (
    <div className="space-y-6">
      {/* Attendance Risk */}
      {attendancePct < 75 && (
        <SectionCard title="🚨 Critical: Attendance Below Threshold">
          <div className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--error) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)" }}>
            <div className="flex items-start gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex flex-1 flex-col gap-2">
                <h4 className="font-semibold" style={{ color: "var(--error)" }}>Attendance: {overview.attendancePct}%</h4>
                <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
                  You are below the 75% minimum attendance requirement. This puts you at risk of <strong>detention from exams</strong>.
                </p>
                <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                  Immediate action: Attend all remaining classes. Contact faculty for any makeup sessions.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {overview.subjectsAtRisk > 0 && (
        <SectionCard title={`⚠ ${overview.subjectsAtRisk} Subject${overview.subjectsAtRisk !== 1 ? "s" : ""} at Academic Risk`}>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
              These subjects need immediate attention to avoid failing grades or backlogs.
            </p>
            {insights?.categoryPerformance && insights.categoryPerformance.length > 0 && (
              <div className="space-y-2">
                {insights.categoryPerformance
                  .filter(cat => (cat.avgGpa || 0) < 7)
                  .map((cat, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-lg border border-[var(--comp-border)] p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium" style={{ color: "var(--comp-text-primary)" }}>{cat.category}</span>
                        <span className="text-sm font-semibold" style={{ color: "var(--error)" }}>
                          {cat.avgGrade} ({cat.avgGpa?.toFixed(1)})
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                        {cat.subjects} subject{cat.subjects !== 1 ? "s" : ""} • Focus area for improvement
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Performance by Category */}
      {insights?.categoryPerformance && insights.categoryPerformance.length > 0 && (
        <SectionCard title="Performance by Category">
          <div className="space-y-3">
            {insights.categoryPerformance.map((cat, i) => {
              const gpa = cat.avgGpa || 0;
              const color = gpa >= 8 ? "var(--success)" : gpa >= 6 ? "var(--warning)" : "var(--error)";
              const status = gpa >= 8 ? "Strong" : gpa >= 6 ? "Needs Work" : "At Risk";
              return (
                <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3 hover:bg-[var(--comp-surface-hover)] transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium" style={{ color: "var(--comp-text-primary)" }}>{cat.category}</span>
                      <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                        {status}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold" style={{ color }}>{cat.avgGrade} ({cat.avgGpa?.toFixed(1)})</span>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>{cat.subjects} subject{cat.subjects !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <ProgressBar value={Math.max(0, Math.min(100, (gpa / 10) * 100))} max={100} color={color} className="h-1.5 mt-2" />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Academic Recommendations */}
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <SectionCard title="Academic Recommendations">
          <div className="space-y-2">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm" style={{ color: rec.type === "warning" ? "var(--warning)" : "var(--info)" }}>
                    {rec.type === "warning" && "⚠"}
                    {rec.type === "improvement" && "📈"}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>{rec.title}</h4>
                    <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Unified Risk Signals */}
      {unified?.academicSignals?.recommendations && unified.academicSignals.recommendations.length > 0 && (
        <SectionCard title="Priority Risk Signals">
          <div className="space-y-2">
            {unified.academicSignals.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3 bg-[color-mix(in_srgb,var(--warning)_5%,transparent)]">
                <h4 className="font-medium text-sm" style={{ color: "var(--warning)" }}>{rec.title}</h4>
                <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>{rec.description}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* All Clear State */}
      {attendancePct >= 75 && overview.subjectsAtRisk === 0 && (
        <SectionCard title="✅ All Systems Clear">
          <div className="flex flex-col gap-2 rounded-xl p-6 text-center" style={{ background: "color-mix(in srgb, var(--success) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--success) 20%, transparent)" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h4 className="font-semibold" style={{ color: "var(--success)" }}>No immediate academic risks detected</h4>
            <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
              Attendance is above 75% and no subjects are flagged at risk. Keep up the good work!
            </p>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
