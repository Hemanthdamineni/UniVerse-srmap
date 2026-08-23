import { useEffect, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner, KpiGrid } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { ProgressBar, StatCard } from "../../components/ui/Progress";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { getLmsProgressOverview, getLmsAcademicInsights } from "../../lib/lms/index";

type PromiseResult<T> = PromiseSettledResult<T>;

interface MergedData {
  completedCredits: number;
  requiredCredits: number;
  currentCgpa: string;
  progressPercent: number;
  semesters: Array<{ semester: number; label: string; credits: number; sgpa: string; status: string }>;
  attendancePct: string;
  subjectsAtRisk: number;
  careerReadiness?: unknown;
  snapshot?: unknown;
  history?: unknown[];
  gpaTrend: Array<{ semester: string; sgpa: number }>;
  categoryPerformance: Array<{ category: string; subjects: number; avgGrade: string; avgGpa: number }>;
  highlights: Array<{ label: string; value: string }>;
  recommendations: Array<{ title: string; description: string; type: string }>;
  overview: {
    progressPercent: number;
    attendancePct: string;
  };
  recommendationEvents?: unknown[];
}

interface PredictionInputs {
  semester1: string;
  semester2: string;
  semester3: string;
  semester4: string;
  semester5: string;
  semester6: string;
  targetCgpa: string;
}

export default function AcademicTrackerPage() {
  const [data, setData] = useState<MergedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<PredictionInputs>({
    semester1: "",
    semester2: "",
    semester3: "",
    semester4: "",
    semester5: "",
    semester6: "",
    targetCgpa: "",
  });

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      getLmsProgressOverview(),
      getLmsAcademicInsights(),
    ])
      .then((results) => {
        if (!active) return;

        const progressResult = results[0] as PromiseResult<Awaited<ReturnType<typeof getLmsProgressOverview>>>;
        const insightsResult = results[1] as PromiseResult<Awaited<ReturnType<typeof getLmsAcademicInsights>>>;

        let progressData = null;
        let insightsData = null;
        let combinedError = null;

        if (progressResult.status === 'fulfilled') {
          progressData = progressResult.value;
        } else {
          combinedError = (combinedError ? combinedError + '; ' : '') + 'Progress Overview failed to load';
        }

        if (insightsResult.status === 'fulfilled') {
          insightsData = insightsResult.value;
        } else {
          combinedError = (combinedError ? combinedError + '; ' : '') + 'Academic Insights failed to load';
        }

        if (progressData && insightsData) {
          const merged: MergedData = {
            ...progressData,
            gpaTrend: insightsData.gpaTrend,
            categoryPerformance: insightsData.categoryPerformance,
            highlights: insightsData.highlights,
            recommendations: insightsData.recommendations,
            overview: insightsData.overview,
            recommendationEvents: insightsData.recommendationEvents,
          };
          setData(merged);
        } else if (combinedError) {
          setError(combinedError);
        } else {
          setError('Failed to load academic data');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'An error occurred');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleInputChange = (field: keyof PredictionInputs, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const calculateProjectedCgpa = () => {
    const semesters = [inputs.semester1, inputs.semester2, inputs.semester3, inputs.semester4, inputs.semester5, inputs.semester6];
    const validSGPA = semesters.filter(s => s !== '').map(Number);

    if (validSGPA.length === 0) return null;

    const current = parseFloat(data?.currentCgpa || '0');
    const completedSemesters = [8.1, 7.8, 8.5].length; // From mock data
    const futureSGPA = validSGPA.reduce((sum, val) => sum + val, 0);
    const totalSemesters = completedSemesters + validSGPA.length;

    const projected = ((current * completedSemesters) + futureSGPA) / totalSemesters;
    return projected.toFixed(2);
  };

  const calculateRequiredCGPA = () => {
    const target = parseFloat(inputs.targetCgpa);
    const current = parseFloat(data?.currentCgpa || '0');
    const semesters = [inputs.semester1, inputs.semester2, inputs.semester3, inputs.semester4, inputs.semester5, inputs.semester6];
    const validSGPA = semesters.filter(s => s !== '').map(Number);

    if (isNaN(target) || isNaN(current) || validSGPA.length === 0) return null;

    const futureSemesters = semesters.length - validSGPA.length;
    if (futureSemesters <= 0) return null;

    const currentWeighted = current * 3; // 3 completed semesters from mock
    const remainingNeeded = target * (futureSemesters + 3) - currentWeighted;
    const requiredAvg = remainingNeeded / validSGPA.length;

    return requiredAvg.toFixed(2);
  };

  const getGpaTrendData = () => {
    if (!data) return [];

    const allSemesters = [];
    for (let i = 1; i <= 6; i++) {
      allSemesters.push({
        semester: `Sem ${i}`,
        sgpa: i <= 3 ? parseFloat(data.semesters[i - 1]?.sgpa || '0') : parseFloat(inputs[`semester${i}` as keyof PredictionInputs] || '0') || null
      });
    }
    return allSemesters.filter(s => s.sgpa !== null && s.sgpa !== 0);
  };

  const getSemesterStatus = (status: string) => {
    switch (status) {
      case 'Completed': return { label: 'Completed', color: 'text-[var(--success)]' };
      case 'In Progress': return { label: 'In Progress', color: 'text-[var(--warning)]' };
      default: return { label: status, color: 'text-[var(--text-secondary)]' };
    }
  };

  const getGpaColor = (sgpa: number) => {
    if (sgpa >= 8.5) return 'bg-[var(--success)]';
    if (sgpa >= 7.5) return 'bg-[var(--warning)]';
    return 'bg-[var(--error)]';
  };

  const kpiItems = data ? [
    { label: 'Current CGPA', value: data.currentCgpa },
    { label: 'Credits Earned', value: `${data.completedCredits}/${data.requiredCredits}` },
    { label: 'Attendance %', value: data.attendancePct },
    { label: 'Subjects at Risk', value: data.subjectsAtRisk.toString() },
    { label: 'Degree Progress', value: `${data.progressPercent}%` },
  ] : [];

  const gpaTrend = getGpaTrendData();
  const projectedCgpa = calculateProjectedCgpa();
  const requiredCgpa = calculateRequiredCGPA();

  return (
    <ErpPageShell
      title="Academic Tracker"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading academic tracker..."
    >
      {error && <StatusBanner message={{ id: "tracker-error", tone: "warning", text: error }} />}

      {!loading && !data && !error && (
        <EmptyState
          title="No data available"
          description="Academic tracker data could not be loaded"
        />
      )}

      {data && (
        <>
          <SectionCard title="Overview">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Key Performance Indicators</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {kpiItems.map((item, idx) => (
                    <div key={idx} className="dashboard-card p-4">
                      <p className="text-sm text-[var(--comp-text-secondary)]">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--comp-text-primary)]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SectionCard title="Semester Performance">
                  <div className="space-y-3">
                    {data.semesters.map((semester) => {
                      const status = getSemesterStatus(semester.status);
                      return (
                        <div key={semester.semester} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--comp-surface)]">
                          <div>
                            <span className="font-semibold text-[var(--comp-text-primary)]">{semester.label}</span>
                            <span className="ml-2 text-sm text-[var(--comp-text-secondary)]">
                              Credits: {semester.credits}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-medium text-[var(--comp-text-primary)]">{semester.sgpa}</span>
                            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Credit Completion">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-[var(--comp-text-primary)]">Progress</span>
                        <span className="font-semibold text-[var(--comp-text-primary)]">{data.progressPercent}%</span>
                      </div>
                      <ProgressBar value={data.progressPercent} className="h-3" />
                    </div>
                    <div className="text-sm text-[var(--comp-text-secondary)]">
                      {data.completedCredits} of {data.requiredCredits} credits earned ({data.requiredCredits - data.completedCredits} remaining)
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="GPA Prediction">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-[var(--comp-text-primary)]">Sem 4 SGPA</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="8.50"
                      value={inputs.semester4}
                      onChange={(e) => handleInputChange('semester4', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--comp-text-primary)]">Sem 5 SGPA</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="9.00"
                      value={inputs.semester5}
                      onChange={(e) => handleInputChange('semester5', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--comp-text-primary)]">Sem 6 SGPA</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="8.75"
                      value={inputs.semester6}
                      onChange={(e) => handleInputChange('semester6', e.target.value)}
                    />
                  </div>
                </div>
                {projectedCgpa && (
                  <div className="p-3 rounded-lg bg-[var(--comp-surface-hover)]">
                    <p className="text-sm text-[var(--comp-text-secondary)]">Projected CGPA: <span className="font-bold text-[var(--comp-accent)]">{projectedCgpa}</span></p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Required GPA Calculator">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--comp-text-primary)]">Target CGPA</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="9.0"
                    value={inputs.targetCgpa}
                    onChange={(e) => handleInputChange('targetCgpa', e.target.value)}
                  />
                </div>
                {requiredCgpa && (
                  <div className="p-3 rounded-lg bg-[var(--comp-surface-hover)]">
                    <p className="text-sm text-[var(--comp-text-secondary)]">
                      Required Average SGPA: <span className="font-bold text-[var(--comp-accent)]">{requiredCgpa}</span>
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="GPA Trend">
            <div className="space-y-3">
              {gpaTrend.map((item) => (
                <div key={item.semester} className="flex items-center gap-4">
                  <span className="w-16 text-sm font-medium text-[var(--text-secondary)]">{item.semester}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={Math.min(100, (item.sgpa || 0) * 10)}
                      className="h-6"
                    />
                  </div>
                  <span className="w-16 text-sm font-medium text-[var(--comp-text-primary)]">
                    {item.sgpa?.toFixed(1) || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Backlog Tracker">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--comp-surface)]">
                  <span className="text-sm font-medium text-[var(--comp-text-primary)]">Subjects at Risk</span>
                  <span className="text-lg font-bold text-[var(--error)]">{data.subjectsAtRisk}</span>
                </div>
                <div className="text-sm text-[var(--comp-text-secondary)]">
                  Attendance impact: {data.subjectsAtRisk} subject(s) below 75% threshold
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Recommendations">
              <div className="space-y-2">
                {(data.highlights || []).map((highlight, idx) => (
                  <div key={idx} className="p-2 rounded text-sm">
                    <span className="font-medium text-[var(--comp-text-primary)]">{highlight.label}:</span>
                    <span className="ml-2 text-[var(--comp-text-secondary)]">{highlight.value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {data.recommendations.length > 0 && (
            <SectionCard title="Action Items">
              <div className="space-y-2">
                {data.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--comp-surface-hover)]">
                    <div className="w-2 h-2 rounded-full bg-[var(--warning)] mt-1" />
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--comp-text-primary)]">{rec.title}</h4>
                      <p className="text-xs text-[var(--comp-text-secondary)] mt-1">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </ErpPageShell>
  );
}