import { useEffect, useMemo, useState } from "react";
import { ErpPageShell, SectionCard, KpiGrid } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { ProgressBar } from "../../components/ui/Progress";
import { getLmsProgressOverview, getLmsAcademicInsights, getLmsUnifiedInsights } from "../../lib/lms/index";
import SgpaCgpaPredictor from "../ERP/components/SgpaCgpaPredictor";
import { getErpBatch } from "../../lib/erp";
import { executePipeline } from "../../lib/erp/erpTransformers";

type PromiseResult<T> = PromiseSettledResult<T>;
type Tab = "overview" | "history" | "planner" | "risks" | "action";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Where am I?", icon: "📊" },
  { key: "history", label: "What did I do?", icon: "📈" },
  { key: "planner", label: "What if...", icon: "🔮" },
  { key: "risks", label: "Where am I vulnerable?", icon: "⚠️" },
  { key: "action", label: "What now?", icon: "🎯" },
];

interface OverviewData {
  completedCredits: number;
  requiredCredits: number;
  currentCgpa: string;
  progressPercent: number;
  semesters: Array<{ semester: number; label: string; credits: number; sgpa: string; status: string }>;
  attendancePct: string;
  subjectsAtRisk: number;
  careerReadiness?: unknown;
}

interface InsightsData {
  gpaTrend: Array<{ semester: string; sgpa: number }>;
  categoryPerformance: Array<{ category: string; subjects: number; avgGrade: string; avgGpa: number }>;
  highlights: Array<{ label: string; value: string }>;
  recommendations: Array<{ title: string; description: string; type: string }>;
  overview: { progressPercent: number; attendancePct: string };
}

interface UnifiedData {
  actionPlan: Array<{ title: string; description: string; domain: string; priority: string; reasons: string[] }>;
  academicSignals: {
    currentCgpa: string;
    progressPercent: number;
    attendancePct: string;
    subjectsAtRisk: number;
    recommendations: Array<{ title: string; description: string; type: string }>;
  };
  opportunityRecommendations: Array<{
    id: string; title: string; type: string; organization: string;
    matchedSkills: string[]; missingSkills: string[]; confidence: number;
  }>;
  nextSkills: Array<{ skill: string; title: string; opportunityDemand: number; confidence: number }>;
}

interface HistoryData {
  semesters: Array<{
    semester: string; monthYear: string; subjectCode: string;
    subjectDescription: string; credit: string; grade: string; gradePoint: string;
    result: string; attempt: string;
  }>;
}

function computeSgpa(history: HistoryData["semesters"]): Record<string, { sgpa: number; credits: number }> {
  const semMap: Record<string, { points: number; credits: number }> = {};
  for (const row of history) {
    const sem = row.semester;
    if (!sem) continue;
    if (!semMap[sem]) semMap[sem] = { points: 0, credits: 0 };
    const credits = parseFloat(row.credit) || 0;
    const gp = parseFloat(row.gradePoint) || 0;
    semMap[sem].points += gp * credits;
    semMap[sem].credits += credits;
  }
  const result: Record<string, { sgpa: number; credits: number }> = {};
  for (const [sem, data] of Object.entries(semMap)) {
    result[sem] = {
      sgpa: data.credits > 0 ? Math.round((data.points / data.credits) * 100) / 100 : 0,
      credits: data.credits,
    };
  }
  return result;
}

export default function AcademicHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [unified, setUnified] = useState<UnifiedData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getLmsProgressOverview(),
      getLmsAcademicInsights(),
      getLmsUnifiedInsights().catch(() => null),
    ]).then((results) => {
      if (!active) return;
      const [progressRes, insightsRes, unifiedRes] = results;

      if (progressRes.status === "fulfilled" && progressRes.value) {
        setOverview(progressRes.value as OverviewData);
      }
      if (insightsRes.status === "fulfilled" && insightsRes.value) {
        setInsights(insightsRes.value as InsightsData);
      }
      if (unifiedRes.status === "fulfilled" && (unifiedRes as PromiseFulfilledResult<UnifiedData>).value) {
        setUnified((unifiedRes as PromiseFulfilledResult<UnifiedData>).value as UnifiedData);
      }

      const hasError = progressRes.status === "rejected" && insightsRes.status === "rejected";
      if (hasError) setError("Could not load academic data. Please try again.");
      else setError(null);
      setLoading(false);
    }).catch((err) => {
      if (active) {
        setError(err instanceof Error ? err.message : "Failed to load academic data.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const loadHistory = async () => {
    if (history) return;
    setHistoryLoading(true);
    try {
      const batch = await getErpBatch([
        "examination/exam-mark-details",
        "examination/current-semester-results",
        "examination/internal-mark-details",
        "academic/course-registration",
        "academic/student-wise-subjects",
      ]);
      const marksResult = batch["examination/exam-mark-details"];
      const marksData = (marksResult as any)?.data;
      if (marksData) {
        const parsed = executePipeline("results-current", marksData);
        const records = (parsed.data as any)?.subjects || [];
        setHistory({ semesters: records });
      }
    } catch {
      // history may not be available
    } finally {
      setHistoryLoading(false);
    }
  };

  const kpis = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Current CGPA", value: overview.currentCgpa || "—" },
      { label: "Degree Progress", value: `${overview.progressPercent || 0}%` },
      { label: "Credits", value: `${overview.completedCredits}/${overview.requiredCredits}` },
      { label: "Attendance", value: `${overview.attendancePct || "—"}%` },
      { label: "Subjects at Risk", value: String(overview.subjectsAtRisk || 0) },
    ];
  }, [overview]);

  return (
    <ErpPageShell
      title="Academic Hub"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading academic data..."
    >
      {error && <InlineError message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="space-y-6">
          <nav className="flex gap-1 rounded-xl bg-[var(--comp-surface)] p-1 border border-[var(--comp-border)]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "history" && !history) loadHistory();
                }}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-[var(--comp-accent)] text-white shadow-sm"
                    : "text-[var(--comp-text-secondary)] hover:bg-[var(--comp-surface-hover)]"
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <KpiGrid items={kpis} />

              {overview && (
                <SectionCard title="Degree Completion">
                  <ProgressBar
                    value={overview.progressPercent || 0}
                    max={100}
                    className="h-3"
                  />
                  <p className="mt-2 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
                    {overview.completedCredits} of {overview.requiredCredits} credits completed
                  </p>
                </SectionCard>
              )}

              {overview && overview.semesters && overview.semesters.length > 0 && (
                <SectionCard title="Semester Performance">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {overview.semesters.map((sem) => {
                      const sgpa = parseFloat(sem.sgpa) || 0;
                      const color = sgpa >= 8 ? "var(--success)" : sgpa >= 6 ? "var(--warning)" : "var(--error)";
                      return (
                        <div key={sem.semester} className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
                              {sem.label || `Semester ${sem.semester}`}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{
                              background: color + "20", color,
                            }}>
                              {sem.status}
                            </span>
                          </div>
                          <div className="text-2xl font-bold" style={{ color }}>{sem.sgpa}</div>
                          <p className="text-xs mt-1" style={{ color: "var(--comp-text-muted)" }}>
                            {sem.credits} credits
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {overview && overview.subjectsAtRisk > 0 && (
                <SectionCard title="Academic Alerts">
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-4">
                    <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
                      {overview.subjectsAtRisk} subject{overview.subjectsAtRisk !== 1 ? "s" : ""} at risk
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>
                      Check the Risks tab for details and recommendations.
                    </p>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-6">
              {historyLoading ? (
                <div className="text-sm" style={{ color: "var(--comp-text-muted)" }}>Loading results...</div>
              ) : history && history.semesters.length > 0 ? (
                <>
                  <SectionCard title="Results by Semester">
                    <div className="space-y-4">
                      {Object.entries(computeSgpa(history.semesters)).map(([sem, data]) => (
                        <div key={sem} className="rounded-xl border border-[var(--comp-border)] p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                              Semester {sem}
                            </h4>
                            <span className="text-sm font-medium" style={{
                              color: data.sgpa >= 8 ? "var(--success)" : data.sgpa >= 6 ? "var(--warning)" : "var(--error)",
                            }}>
                              SGPA: {data.sgpa}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Detailed Results">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--comp-border)]">
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Semester</th>
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Subject</th>
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Credit</th>
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Grade</th>
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Points</th>
                            <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.semesters.map((row, i) => (
                            <tr key={i} className="border-b border-[var(--comp-border)]">
                              <td className="py-2">{row.semester}</td>
                              <td className="py-2 font-medium">{row.subjectDescription}</td>
                              <td className="py-2">{row.credit}</td>
                              <td className="py-2 font-semibold">{row.grade}</td>
                              <td className="py-2">{row.gradePoint}</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  row.result?.toLowerCase() === "pass"
                                    ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]"
                                    : "bg-[color-mix(in_srgb,var(--error)_15%,transparent)] text-[var(--error)]"
                                }`}>
                                  {row.result}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                </>
              ) : (
                <EmptyState
                  title="No results data available"
                  description="Semester results will appear here once available."
                />
              )}
            </div>
          )}

          {activeTab === "planner" && (
            <div className="space-y-6">
              <SectionCard title="SGPA / CGPA Planner">
                <p className="text-sm mb-4" style={{ color: "var(--comp-text-secondary)" }}>
                  Predict your CGPA based on expected grades, or calculate the SGPA needed to reach a target.
                </p>
                <SgpaCgpaPredictor
                  currentCourse={null}
                  curriculum={null}
                  data={{ title: "Planner", subjects: [], sgpa: "", disclaimer: "" }}
                  cgpaSummary={{
                    currentCgpa: overview?.currentCgpa || "0",
                    semesterLabel: overview?.semesters?.length ? `Semester ${Math.max(...overview.semesters.map(s => s.semester))}` : "",
                    semesterNumber: overview?.semesters?.length ? Math.max(...overview.semesters.map(s => s.semester)) : null,
                  }}
                />
              </SectionCard>

              {insights && insights.highlights && insights.highlights.length > 0 && (
                <SectionCard title="Key Highlights">
                  <div className="grid gap-3 md:grid-cols-2">
                    {insights.highlights.map((h, i) => (
                      <div key={i} className="flex justify-between items-center rounded-lg border border-[var(--comp-border)] p-3">
                        <span className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>{h.label}</span>
                        <span className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>{h.value}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {activeTab === "risks" && (
            <div className="space-y-6">
              {insights && insights.categoryPerformance && insights.categoryPerformance.length > 0 && (
                <SectionCard title="Performance by Category">
                  <div className="space-y-3">
                    {insights.categoryPerformance.map((cat, i) => {
                      const gpa = cat.avgGpa || 0;
                      const color = gpa >= 8 ? "var(--success)" : gpa >= 6 ? "var(--warning)" : "var(--error)";
                      return (
                        <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium" style={{ color: "var(--comp-text-primary)" }}>{cat.category}</span>
                            <span className="text-sm font-semibold" style={{ color }}>
                              {cat.avgGrade} ({cat.avgGpa?.toFixed(1)})
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: "var(--comp-text-muted)" }}>
                            {cat.subjects} subject{cat.subjects !== 1 ? "s" : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {overview && overview.subjectsAtRisk > 0 && (
                <SectionCard title="Subjects at Risk">
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-4">
                    <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
                      {overview.subjectsAtRisk} subject{overview.subjectsAtRisk !== 1 ? "s" : ""} need attention
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>
                      Check the Action tab for targeted recommendations.
                    </p>
                  </div>
                </SectionCard>
              )}

              {insights && insights.recommendations && insights.recommendations.length > 0 && (
                <SectionCard title="Academic Recommendations">
                  <div className="space-y-2">
                    {insights.recommendations.map((rec, i) => (
                      <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3">
                        <h4 className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>{rec.title}</h4>
                        <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {overview && overview.attendancePct && parseFloat(overview.attendancePct) < 75 && (
                <SectionCard title="Attendance Warning">
                  <div className="rounded-xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] p-4">
                    <p className="text-sm font-medium" style={{ color: "var(--warning)" }}>
                      Attendance below 75% threshold
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>
                      Current attendance: {overview.attendancePct}%. Maintain above 75% to avoid detention.
                    </p>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {activeTab === "action" && (
            <div className="space-y-6">
              {unified && unified.actionPlan && unified.actionPlan.length > 0 ? (
                <SectionCard title="Priority Actions">
                  <div className="space-y-3">
                    {unified.actionPlan.map((action, i) => (
                      <div key={i} className="rounded-xl border border-[var(--comp-border)] p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-sm" style={{ color: "var(--comp-text-primary)" }}>
                            {action.title}
                          </h4>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: action.priority === "high" ? "color-mix(in_srgb,var(--error)_15%,transparent)" : "color-mix(in_srgb,var(--info)_15%,transparent)",
                            color: action.priority === "high" ? "var(--error)" : "var(--info)",
                          }}>
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>{action.description}</p>
                        {action.reasons && action.reasons.length > 0 && (
                          <p className="text-xs mt-2" style={{ color: "var(--comp-text-muted)" }}>
                            Because: {action.reasons.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : (
                <SectionCard title="Recommendations">
                  <EmptyState
                    title="No action items right now"
                    description="Personalized recommendations will appear here based on your academic performance."
                  />
                </SectionCard>
              )}

              {unified && unified.nextSkills && unified.nextSkills.length > 0 && (
                <SectionCard title="Skills to Develop">
                  <div className="flex flex-wrap gap-2">
                    {unified.nextSkills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border"
                        style={{
                          borderColor: "var(--comp-border)",
                          background: "color-mix(in_srgb,var(--info)_8%,transparent)",
                          color: "var(--comp-text-secondary)",
                        }}
                      >
                        {skill.title} ({skill.opportunityDemand} opportunities)
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}

              {unified && unified.opportunityRecommendations && unified.opportunityRecommendations.length > 0 && (
                <SectionCard title="Recommended Opportunities">
                  <div className="space-y-2">
                    {unified.opportunityRecommendations.map((opp) => (
                      <div key={opp.id} className="flex justify-between items-center rounded-lg border border-[var(--comp-border)] p-3">
                        <div>
                          <p className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>{opp.title}</p>
                          <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>{opp.organization}</p>
                        </div>
                        <span className="text-xs font-medium" style={{
                          color: opp.confidence >= 0.8 ? "var(--success)" : "var(--warning)",
                        }}>
                          {Math.round(opp.confidence * 100)}% match
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && !overview && (
        <EmptyState
          title="No academic data available"
          description="Academic data will appear here once your profile is synchronized with the university ERP."
        />
      )}
    </ErpPageShell>
  );
}
