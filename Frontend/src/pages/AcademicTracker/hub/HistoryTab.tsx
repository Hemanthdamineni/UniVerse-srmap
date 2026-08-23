import { SectionCard } from "../../../components/erp/ErpPrimitives";
import { EmptyView } from "../../../components/ui/Feedback";
import { computeSgpa } from "./types";
import type { HistoryData, OverviewData } from "./types";

export function HistoryTab({
  history,
  historyLoading,
  overview,
  onLoadHistory,
}: {
  history: HistoryData | null;
  historyLoading: boolean;
  overview: OverviewData | null;
  onLoadHistory: () => void;
}) {
  return (
    <div className="space-y-6">
      {historyLoading ? (
        <div className="text-sm" style={{ color: "var(--comp-text-muted)" }}>Loading results...</div>
      ) : history && history.semesters.length > 0 ? (
        <>
          {/* Cumulative Summary - moved to top */}
          <SectionCard title="Cumulative Summary">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>Total Credits Earned</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--comp-text-primary)" }}>
                  {history.semesters.reduce((sum, s) => sum + s.subjects.reduce((s2, r) => s2 + (parseFloat(r.credit) || 0), 0), 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>Overall CGPA</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--comp-accent)" }}>
                  {overview?.currentCgpa || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>Semesters Completed</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--comp-text-primary)" }}>
                  {overview?.semesters?.filter(s => s.status === "Completed").length || 0}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Results by Semester">
            <div className="space-y-4">
              {Object.entries(computeSgpa(history.semesters)).map(([sem, data]) => (
                <div key={sem} className="flex flex-col gap-2 rounded-xl border border-[var(--comp-border)] p-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                      Semester {sem}
                    </h4>
                    <span className="text-sm font-medium" style={{
                      color: data.sgpa >= 8 ? "var(--success)" : data.sgpa >= 6 ? "var(--warning)" : "var(--error)",
                    }}>
                      SGPA: {data.sgpa} ({data.credits} credits)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--comp-border)]">
                          <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Subject</th>
                          <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Credit</th>
                          <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Grade</th>
                          <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Points</th>
                          <th className="pb-2 font-medium" style={{ color: "var(--comp-text-muted)" }}>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.semesters
                          .find(s => s.semesterNo === sem)?.subjects
                          .map((row, i) => (
                            <tr key={i} className="border-b border-[var(--comp-border)]">
                              <td className="py-2 font-medium">{row.subjectName}</td>
                              <td className="py-2">{row.credit}</td>
                              <td className="py-2 font-semibold">{row.grade}</td>
                              <td className="py-2">{row.gradePoints}</td>
                              <td className="py-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <EmptyView
          title="No results data available"
          description="Semester results will appear here once available from the ERP."
          actionLabel="Refresh"
          onAction={onLoadHistory}
        />
      )}
    </div>
  );
}
