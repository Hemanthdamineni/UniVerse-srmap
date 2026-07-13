import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// ErpPageShell section-card layout; timetable structure unchanged.
import { getErpBatch } from "../../lib/erp/index";
import { executePipeline } from "../../lib/erp/erpTransformers";
import type { TimetableModel } from "../../lib/erp/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

interface TimetablePageProps {
  blueprint: PageBlueprint;
}

export default function TimetablePage({ blueprint }: TimetablePageProps) {
  const [model, setModel] = useState<TimetableModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;
        const result = batch["academic/time-table"];
        if (!result || (result as any).success === false) {
          setError("Timetable data unavailable.");
          setLoading(false);
          return;
        }

        const rawData = (result as any).data;
        const pipelineResult = executePipeline(blueprint, rawData);
        if (pipelineResult?.isValid && pipelineResult.data) {
          setModel(pipelineResult.data as TimetableModel);
        } else {
          setError("Invalid timetable data format.");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load timetable.");
        setLoading(false);
      });

    return () => { active = false; };
  }, [blueprint.fetchKeys, refreshTrigger]);

  const { timeSlots, days, subjects } = model ?? { timeSlots: [], days: [], subjects: [] };

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {model && (
        <>
          {/* Weekly Schedule Grid */}
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text w-28">Day</th>
                  {timeSlots.map((slot, i) => (
                    <th key={i} className="erp-table-head-cell label-text erp-table-align-center min-w-[130px]">
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {days.length === 0 ? (
                  <tr className="erp-table-row">
                    <td colSpan={timeSlots.length + 1} className="erp-table-cell py-8 text-center text-sm italic" style={{ color: 'var(--comp-text-muted)' }}>
                      No schedule data available.
                    </td>
                  </tr>
                ) : (
                  days.map((dayRow) => (
                    <tr key={dayRow.day} className="erp-table-row">
                      <td className="erp-table-cell erp-table-cell-strong">{dayRow.day}</td>
                      {dayRow.slots.map((slot, i) => (
                        <td key={i} className="erp-table-cell erp-table-align-center">
                          {slot.classDetails ? (
                            <span className="inline-block rounded px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--comp-accent-light)', color: 'var(--comp-text-primary)' }}>
                              {slot.classDetails}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--comp-text-muted)' }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Subject Legend */}
          {subjects.length > 0 && (
            <section className="dashboard-card overflow-hidden p-0">
              <div className="border-b px-4 py-3" style={{ borderColor: 'var(--comp-border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Course Details & Faculty</h2>
              </div>
              <div className="erp-table-shell rounded-none border-0 shadow-none">
                <table className="erp-table text-left">
                  <thead className="erp-table-head">
                    <tr>
                      <th className="erp-table-head-cell label-text">Code</th>
                      <th className="erp-table-head-cell label-text">Subject</th>
                      <th className="erp-table-head-cell label-text">L-T-P-C</th>
                      <th className="erp-table-head-cell label-text">Faculty</th>
                      <th className="erp-table-head-cell label-text">Room</th>
                      <th className="erp-table-head-cell label-text">Study</th>
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {subjects.map((sub) => (
                      <tr key={sub.code} className="erp-table-row">
                        <td className="erp-table-cell erp-table-cell-strong">{sub.code}</td>
                        <td className="erp-table-cell">{sub.name}</td>
                        <td className="erp-table-cell">{sub.ltpc}</td>
                        <td className="erp-table-cell">{sub.faculty}</td>
                        <td className="erp-table-cell">{sub.room || "—"}</td>
                        <td className="erp-table-cell">
                          <Link
                            to={`/resources/subject/${encodeURIComponent(sub.code)}`}
                            className="comp-btn-ghost min-h-0 rounded-full px-3 py-1 text-xs font-semibold"
                          >
                            Study
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </ErpPageShell>
  );
}
