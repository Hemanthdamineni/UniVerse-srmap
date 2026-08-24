import { SectionCard, KpiGrid } from "../../../components/erp/ErpPrimitives";
import { ProgressBar } from "../../../components/ui/Progress";
import GpaTrendChart from "../../../components/charts/GpaTrendChart";
import { ActionButton } from "./controls";
import type { InsightsData, KpiItem, OverviewData, QuickAction } from "./types";

export function OverviewTab({
  overview,
  insights,
  kpis,
  onQuickAction,
}: {
  overview: OverviewData | null;
  insights: InsightsData | null;
  kpis: KpiItem[];
  onQuickAction: QuickAction;
}) {
  if (!overview) return null;

  const attendancePct = parseFloat(overview.attendancePct) || 0;
  const isAttendanceSafe = attendancePct >= 75;
  const currentSemester = overview.semesters.length > 0
    ? overview.semesters[overview.semesters.length - 1]
    : null;

  return (
    <div className="space-y-6">
      {/* KPIs with trends */}
      <KpiGrid
        items={kpis}
      />

      {/* Quick Actions Bar */}
      <SectionCard title="Quick Actions">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="View Timetable"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            onClick={() => onQuickAction("/academic/timetable")}
            variant="outline"
          />
          <ActionButton
            label="Check Attendance"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
            onClick={() => onQuickAction("/academic/attendance-details")}
            variant="outline"
          />
          <ActionButton
            label="Current Results"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>}
            onClick={() => onQuickAction("/exams/current-semester-results")}
            variant="outline"
          />
          <ActionButton
            label="Career Profile"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            onClick={() => onQuickAction("/career/me/profile")}
            variant="outline"
          />
          <ActionButton
            label="Learning Materials"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
            onClick={() => onQuickAction("/learn/discover")}
            variant="outline"
          />
        </div>
      </SectionCard>

      {/* Current Semester Focus */}
      {currentSemester && (
        <SectionCard title={`Current: ${currentSemester.label || `Semester ${currentSemester.semester}`}`}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>SGPA Target Calculator</h4>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{
                  background: "color-mix(in srgb, var(--comp-accent) 15%, transparent)", color: "var(--comp-accent)"
                }}>
                  {currentSemester.status}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="text-center p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--success) 8%, transparent)" }}>
                  <div className="text-2xl font-bold" style={{ color: "var(--success)" }}>{currentSemester.sgpa}</div>
                  <div className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>Current SGPA</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--comp-accent) 8%, transparent)" }}>
                  <div className="text-2xl font-bold" style={{ color: "var(--comp-accent)" }}>{overview.currentCgpa}</div>
                  <div className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>Cumulative CGPA</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--info) 8%, transparent)" }}>
                  <div className="text-2xl font-bold" style={{ color: "var(--info)" }}>{currentSemester.credits}</div>
                  <div className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>Credits This Sem</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
              <h4 className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>Degree Progress</h4>
              <ProgressBar value={overview.progressPercent || 0} max={100} className="h-3" />
              <div className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
                {overview.completedCredits} / {overview.requiredCredits} credits
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--comp-text-muted)" }}>
                <span>Remaining: {overview.requiredCredits - overview.completedCredits} credits</span>
                <span>{overview.progressPercent}% complete</span>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Attendance Status Card */}
      <SectionCard title="Attendance Overview">
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`rounded-xl p-4 ${isAttendanceSafe ? "border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]" : "border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)]"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: isAttendanceSafe ? "var(--success)" : "var(--warning)" }}>
                  {isAttendanceSafe ? "Above Threshold" : "At Risk"}
                </p>
                <p className="text-3xl font-bold mt-1" style={{ color: isAttendanceSafe ? "var(--success)" : "var(--warning)" }}>
                  {overview.attendancePct || "—"}%
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--comp-text-muted)" }}>Overall attendance</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>Minimum required</p>
                <p className="text-xl font-bold">75%</p>
              </div>
            </div>
            <ProgressBar value={attendancePct} max={100} className="h-2 mt-3" />
          </div>
          <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
            <h4 className="font-semibold mb-3" style={{ color: "var(--comp-text-primary)" }}>
              {overview.subjectsAtRisk > 0 ? "⚠ Action Required" : "✓ All Clear"}
            </h4>
            <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
              {overview.subjectsAtRisk > 0
                ? `${overview.subjectsAtRisk} subject${overview.subjectsAtRisk !== 1 ? "s" : ""} below 75%. Risk of detention.`
                : "All subjects above the 75% attendance threshold."}
            </p>
            {overview.subjectsAtRisk > 0 && (
              <ActionButton
                label="View Attendance Details"
                onClick={() => onQuickAction("/academic/attendance-details")}
                variant="primary"
                className="mt-3"
              />
            )}
          </div>
        </div>
      </SectionCard>

      {/* Key Highlights */}
      {insights?.highlights && insights.highlights.length > 0 && (
        <SectionCard title="Key Highlights">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {insights.highlights.map((h, i) => (
              <div key={i} className="flex justify-between items-center rounded-lg border border-[var(--comp-border)] p-3 hover:bg-[var(--comp-surface-hover)] transition-colors">
                <span className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>{h.label}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>{h.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Combined Semester Performance: Chart + Cards */}
      {overview.semesters && overview.semesters.length > 0 && (
        <SectionCard title="Semester Performance">
          {/* GPA Trend Chart at top */}
          {insights?.gpaTrend && insights.gpaTrend.length > 0 && (
            <div className="mb-4">
              <GpaTrendChart data={insights.gpaTrend} height={140} showTrendIndicator={false} showReferenceLines={true} />
            </div>
          )}
          {/* Semester Cards below */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overview.semesters.map((sem) => {
              const sgpa = parseFloat(sem.sgpa) || 0;
              const color = sgpa >= 8 ? "var(--success)" : sgpa >= 6 ? "var(--warning)" : "var(--error)";
              const trend = insights?.gpaTrend.find(g => g.semester.includes(String(sem.semester)));
              const prevTrend = trend && insights
                ? insights.gpaTrend[insights.gpaTrend.indexOf(trend) - 1]
                : null;
              const delta = trend && prevTrend ? trend.sgpa - prevTrend.sgpa : 0;
              return (
                <div
                  key={sem.semester}
                  className="group rounded-xl border border-l-[3px] border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 transition-all hover:border-[color-mix(in_srgb,var(--comp-accent)_40%,transparent)] hover:shadow-md"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate" style={{ color: "var(--comp-text-primary)" }}>
                          {sem.label || `Semester ${sem.semester}`}
                        </span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0" style={{
                          background: `color-mix(in srgb, ${color} 20%, transparent)`, color,
                        }}>
                          {sem.status}
                        </span>
                      </div>
                      <div className="text-3xl font-bold mt-1" style={{ color }}>{sem.sgpa}</div>
                      <p className="text-xs mt-1 flex items-center gap-2" style={{ color: "var(--comp-text-muted)" }}>
                        <span>{sem.credits} credits</span>
                        {delta !== 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: delta > 0 ? "var(--success)" : "var(--error)" }}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
                              {delta > 0 ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                            </svg>
                            {delta > 0 ? "+" : ""}{delta.toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
