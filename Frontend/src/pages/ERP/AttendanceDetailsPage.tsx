import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getErpBatch } from "../../lib/erpApi";
import { executePipeline } from "../../lib/erpTransformers";
import type { AttendanceModel } from "../../lib/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";

interface AttendanceDetailsPageProps {
  blueprint: PageBlueprint;
}

export default function AttendanceDetailsPage({ blueprint }: AttendanceDetailsPageProps) {
  const [model, setModel] = useState<AttendanceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;

        const result = batch["academic/attendance-details"];
        if (!result || (result as any).success === false) {
          setError("Attendance data unavailable.");
          setLoading(false);
          return;
        }

        const rawData = (result as any).data;
        const pipelineResult = executePipeline(blueprint, rawData);
        if (pipelineResult?.isValid && pipelineResult.data) {
          setModel(pipelineResult.data as AttendanceModel);
        } else {
          setError("Invalid attendance data format.");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load attendance details.");
        setLoading(false);
      });

    return () => { active = false; };
  }, [blueprint.fetchKeys, refreshTrigger]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {model && (
        <>
          <div className="erp-table-shell">
            <table className="erp-table table-fixed">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell">Subject Code</th>
                  <th className="erp-table-head-cell">Subject</th>
                  <th className="erp-table-head-cell erp-table-align-right">Conducted</th>
                  <th className="erp-table-head-cell erp-table-align-right">Entered</th>
                  <th className="erp-table-head-cell erp-table-align-right">OD/ML</th>
                  <th className="erp-table-head-cell erp-table-align-right">Present</th>
                  <th className="erp-table-head-cell erp-table-align-right">OD/ML %</th>
                  <th className="erp-table-head-cell erp-table-align-right">Attendance %</th>
                  <th className="erp-table-head-cell">LMS</th>
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {model.records.length === 0 ? (
                  <tr className="erp-table-row">
                    <td colSpan={9} className="erp-table-cell py-8 text-center text-sm italic text-slate-500">
                      No attendance records for this semester.
                    </td>
                  </tr>
                ) : (
                  model.records.map((rec) => (
                    <tr key={rec.subjectCode} className="erp-table-row">
                      <td className="erp-table-cell erp-table-cell-strong">{rec.subjectCode}</td>
                      <td className="erp-table-cell">{rec.subjectDescription}</td>
                      <td className="erp-table-cell erp-table-align-right">{rec.classesConducted}</td>
                      <td className="erp-table-cell erp-table-align-right">{rec.attendanceEntered}</td>
                      <td className="erp-table-cell erp-table-align-right">{rec.odMlTaken}</td>
                      <td className="erp-table-cell erp-table-align-right">{rec.present}</td>
                      <td className="erp-table-cell erp-table-align-right">{rec.odMlApprovedPct.toFixed(2)}%</td>
                      <td className={`erp-table-cell erp-table-align-right font-semibold ${rec.attendancePct < 75 ? "text-red-600" : "text-emerald-600"}`}>
                        {rec.attendancePct.toFixed(2)}%
                      </td>
                      <td className="erp-table-cell">
                        <Link
                          to={`/resources/browse?subjectCode=${encodeURIComponent(rec.subjectCode)}`}
                          className="inline-flex rounded-full bg-[#0A3035]/10 px-3 py-1 text-xs font-semibold text-[#0A3035] transition hover:bg-[#0A3035] hover:text-white"
                        >
                          Resources
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {model.notes.length > 0 && (
            <section className="dashboard-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-[#0A3035]">Notes</h2>
              <ul className="space-y-1 text-sm text-slate-600">
                {model.notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-slate-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </ErpPageShell>
  );
}
