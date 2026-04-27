import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// Wrapped in ErpPageShell contentLayout section-card; table styling via shared ERP CSS tokens.
import { getErpBatch } from "../../lib/erpApi";
import { executePipeline } from "../../lib/erpTransformers";
import type { AttendanceModel } from "../../lib/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";

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
      contentLayout="section-card"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {model && (
        <>
          <div className="erp-table-shell">
            <table className="erp-table table-fixed">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text">Subject Code</th>
                  <th className="erp-table-head-cell label-text">Subject</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">Conducted</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">Entered</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">OD/ML</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">Present</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">OD/ML %</th>
                  <th className="erp-table-head-cell label-text erp-table-align-right">Attendance %</th>
                  <th className="erp-table-head-cell label-text">LMS</th>
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {model.records.length === 0 ? (
                  <tr className="erp-table-row">
                    <td colSpan={9} className="erp-table-cell py-8 text-center text-sm italic" style={{ color: 'var(--comp-text-muted)' }}>
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
                      <td className="erp-table-cell erp-table-align-right font-semibold" style={{ color: rec.attendancePct < 75 ? 'var(--error)' : 'var(--success)' }}>
                        {rec.attendancePct.toFixed(2)}%
                      </td>
                      <td className="erp-table-cell">
                        <Link
                          to={`/resources/browse?subjectCode=${encodeURIComponent(rec.subjectCode)}`}
                          className="comp-btn-ghost min-h-0 rounded-full px-3 py-1 text-xs font-semibold"
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
              <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Notes</h2>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
                {model.notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0" style={{ color: 'var(--comp-text-muted)' }}>•</span>
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
