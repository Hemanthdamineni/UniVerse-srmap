import { useState } from "react";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import SgpaCgpaPredictor from "../../ERP/components/SgpaCgpaPredictor";
import type { InsightsData, OverviewData, PlannerPrefill } from "./types";

export function PlannerTab({
  overview,
  insights,
  plannerPrefill,
  plannerLoading,
}: {
  overview: OverviewData | null;
  insights: InsightsData | null;
  plannerPrefill: PlannerPrefill | null;
  plannerLoading: boolean;
}) {
  const cgpaSummary =
    plannerPrefill?.cgpaSummary?.currentCgpa || plannerPrefill?.cgpaSummary?.semesterNumber
      ? plannerPrefill.cgpaSummary
      : {
          currentCgpa: overview?.currentCgpa || "0",
          semesterLabel: overview?.semesters?.length ? `Semester ${Math.max(...overview.semesters.map(s => s.semester))}` : "",
          semesterNumber: overview?.semesters?.length ? Math.max(...overview.semesters.map(s => s.semester)) : null,
        };

  return (
    <div className="space-y-6">
      <SectionCard title="SGPA / CGPA Planner">
        <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
          Predict your CGPA based on expected grades, or calculate the SGPA needed to reach a target CGPA.
        </p>
        {plannerLoading ? (
          <p className="text-sm" style={{ color: "var(--comp-text-muted)" }}>Loading planner subjects...</p>
        ) : (
          <SgpaCgpaPredictor
            currentCourse={plannerPrefill?.currentCourse ?? null}
            curriculum={plannerPrefill?.curriculum ?? null}
            data={plannerPrefill?.currentResults ?? { title: "Planner", subjects: [], sgpa: "", disclaimer: "" }}
            cgpaSummary={cgpaSummary}
          />
        )}
      </SectionCard>

      {/* Target Calculator */}
      {overview && (
        <SectionCard title="Target CGPA Calculator">
          <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
            What SGPA do you need in upcoming semesters to reach your target CGPA?
          </p>
          <TargetCgpaCalculator
            currentCgpa={parseFloat(overview.currentCgpa) || 0}
            completedCredits={overview.completedCredits}
            requiredCredits={overview.requiredCredits}
          />
        </SectionCard>
      )}

      {insights?.highlights && insights.highlights.length > 0 && (
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

      {/* Study Recommendations */}
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <SectionCard title="Study Recommendations">
          <div className="space-y-2">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-[var(--comp-border)] p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm" style={{ color: rec.type === "warning" ? "var(--warning)" : rec.type === "improvement" ? "var(--info)" : "var(--success)" }}>
                    {rec.type === "warning" && "⚠"}
                    {rec.type === "improvement" && "📈"}
                    {rec.type === "success" && "✓"}
                  </span>
                  <div>
                    <h4 className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>{rec.title}</h4>
                    <p className="text-xs mt-1" style={{ color: "var(--comp-text-secondary)" }}>{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function TargetCgpaCalculator({
  currentCgpa,
  completedCredits,
  requiredCredits,
}: {
  currentCgpa: number;
  completedCredits: number;
  requiredCredits: number;
}) {
  const [targetCgpa, setTargetCgpa] = useState(currentCgpa + 0.5);
  const [creditsPerSem, setCreditsPerSem] = useState(22);

  const remainingCredits = requiredCredits - completedCredits;
  const requiredSgpa = (targetCgpa * requiredCredits - currentCgpa * completedCredits) / remainingCredits;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
        <label className="block text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>Target CGPA</label>
        <input
          type="number"
          step="0.01"
          min={currentCgpa}
          max={10}
          value={targetCgpa}
          onChange={e => setTargetCgpa(parseFloat(e.target.value) || currentCgpa)}
          className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] px-3 py-2 text-sm"
          style={{ color: "var(--comp-text-primary)" }}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
        <label className="block text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>Credits / Semester</label>
        <input
          type="number"
          min={1}
          max={30}
          value={creditsPerSem}
          onChange={e => setCreditsPerSem(parseInt(e.target.value) || 22)}
          className="w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] px-3 py-2 text-sm"
          style={{ color: "var(--comp-text-primary)" }}
        />
      </div>
      <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4 flex items-end">
        <div className="flex w-full flex-col gap-1">
          <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>Required SGPA per sem</p>
          <p className="text-2xl font-bold" style={{ color: requiredSgpa > 10 ? "var(--error)" : requiredSgpa > 9 ? "var(--warning)" : "var(--success)" }}>
            {requiredSgpa > 10 ? "Impossible" : requiredSgpa.toFixed(2)}
          </p>
          <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
            {requiredSgpa > 10
              ? `Even 10.0 SGPA won't reach ${targetCgpa.toFixed(2)}`
              : requiredSgpa > 9
              ? "Very challenging — consider more semesters"
              : "Achievable with consistent effort"}
          </p>
        </div>
      </div>
    </div>
  );
}
