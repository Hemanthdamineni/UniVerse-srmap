import { useEffect, useState } from "react";
import { ErpPageShell, KpiGrid, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { getLmsProgressOverview } from "../../lib/lmsApi";

type ProgressOverviewModel = Awaited<ReturnType<typeof getLmsProgressOverview>>;

export default function ProgressOverview() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ProgressOverviewModel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getLmsProgressOverview()
      .then((response) => {
        if (!active) return;
        setOverview(response);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load progress overview.");
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
      title="Progress Overview"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading academic progress..."
    >
      {error ? <StatusBanner message={{ id: "progress-error", tone: "warning", text: error }} /> : null}

      {overview ? (
        <>
          <KpiGrid
            items={[
              {
                label: "Credits Completed",
                value: `${overview.completedCredits} / ${overview.requiredCredits}`,
              },
              { label: "Current CGPA", value: overview.currentCgpa },
              { label: "Current Semester", value: `Semester ${overview.semesters.length}` },
              { label: "Degree Progress", value: `${overview.progressPercent}%` },
            ]}
          />

          <SectionCard title="Degree Completion">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--comp-text-primary)]">Overall Progress</span>
                <span className="font-semibold text-[var(--comp-text-primary)]">{overview.progressPercent}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--comp-accent)] transition-all"
                  style={{ width: `${overview.progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {overview.completedCredits} of {overview.requiredCredits} credits earned.{" "}
                {Math.max(0, overview.requiredCredits - overview.completedCredits)} credits remaining.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Semester-wise Performance">
            <div className="space-y-3">
              {overview.semesters.map((semester) => (
                <div
                  key={semester.semester}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)]">
                      <span className="text-sm font-bold text-[var(--comp-text-primary)]">{semester.semester}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">{semester.label}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{semester.credits} credits</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--comp-text-primary)]">{semester.sgpa}</p>
                      <p className="text-xs text-[var(--text-secondary)]">SGPA</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        semester.status === "Completed"
                          ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]"
                          : "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)]"
                      }`}
                    >
                      {semester.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Attendance Summary">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Overall Attendance</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{overview.attendancePct}%</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Subjects at Risk</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">{overview.subjectsAtRisk}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Tracker Source</p>
                <p className="mt-2 text-base font-semibold text-[var(--comp-text-primary)]">ERP-derived LMS model</p>
              </div>
            </div>
          </SectionCard>

          {overview.careerReadiness ? (
            <SectionCard title="Career Readiness">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Profile Completeness</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">
                    {overview.careerReadiness.profileCompleteness.score}%
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Resume Score</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">
                    {overview.careerReadiness.resumeScore.score}%
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--comp-surface)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Skill Gaps</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--warning)]">
                    {overview.careerReadiness.skillGaps.length}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Next Actions</h3>
                  <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
                    {overview.careerReadiness.nextActions.map((action) => (
                      <li key={action} className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--comp-text-primary)]">Top Skill Gaps</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {overview.careerReadiness.skillGaps.length ? (
                      overview.careerReadiness.skillGaps.map((gap) => (
                        <span
                          key={gap.skill}
                          className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                          title={gap.reason}
                        >
                          {gap.skill} · {gap.opportunityCount}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)]">No high-priority skill gaps detected.</span>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Analytics Trace">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <p className="text-sm font-semibold text-[var(--comp-text-primary)]">
                  Snapshot {overview.snapshot ? "saved" : "not persisted"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {overview.snapshot
                    ? `Captured ${new Date(overview.snapshot.createdAt).toLocaleString()} with hash ${overview.snapshot.inputsHash.slice(0, 8)}.`
                    : "Tracker persistence is unavailable in this environment."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(overview.history || []).slice(0, 4).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                    <div className="font-semibold capitalize text-[var(--comp-text-primary)]">
                      {snapshot.snapshotType}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.summary.currentCgpa || "CGPA pending"}
                    </div>
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
