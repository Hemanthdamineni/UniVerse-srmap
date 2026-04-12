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
                <span className="font-medium text-[#0A3035]">Overall Progress</span>
                <span className="font-semibold text-[#0A3035]">{overview.progressPercent}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0A3035] transition-all"
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A3035]/8">
                      <span className="text-sm font-bold text-[#0A3035]">{semester.semester}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#0A3035]">{semester.label}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{semester.credits} credits</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#0A3035]">{semester.sgpa}</p>
                      <p className="text-xs text-[var(--text-secondary)]">SGPA</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                        semester.status === "Completed"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-blue-200 bg-blue-50 text-blue-800"
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
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-sm text-[var(--text-secondary)]">Overall Attendance</p>
                <p className="mt-2 text-3xl font-semibold text-[#0A3035]">{overview.attendancePct}%</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-sm text-[var(--text-secondary)]">Subjects at Risk</p>
                <p className="mt-2 text-3xl font-semibold text-amber-600">{overview.subjectsAtRisk}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-sm text-[var(--text-secondary)]">Tracker Source</p>
                <p className="mt-2 text-base font-semibold text-[#0A3035]">ERP-derived LMS model</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </ErpPageShell>
  );
}
