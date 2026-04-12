import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getErpBatch } from "../../lib/erpApi";
import { executePipeline } from "../../lib/erpTransformers";
import type { TimetableModel } from "../../lib/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";

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
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {model && (
        <>
          {/* Weekly Schedule Grid */}
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell w-28">Day</th>
                  {timeSlots.map((slot, i) => (
                    <th key={i} className="erp-table-head-cell erp-table-align-center min-w-[130px]">
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {days.length === 0 ? (
                  <tr className="erp-table-row">
                    <td colSpan={timeSlots.length + 1} className="erp-table-cell py-8 text-center text-sm italic text-slate-500">
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
                            <span className="inline-block rounded bg-[#0A3035]/8 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {slot.classDetails}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
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
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-[#0A3035]">Course Details & Faculty</h2>
              </div>
              <div className="erp-table-shell rounded-none border-0 shadow-none">
                <table className="erp-table text-left">
                  <thead className="erp-table-head">
                    <tr>
                      <th className="erp-table-head-cell">Code</th>
                      <th className="erp-table-head-cell">Subject</th>
                      <th className="erp-table-head-cell">L-T-P-C</th>
                      <th className="erp-table-head-cell">Faculty</th>
                      <th className="erp-table-head-cell">Room</th>
                      <th className="erp-table-head-cell">Study</th>
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
                            className="inline-flex rounded-full bg-[#0A3035]/10 px-3 py-1 text-xs font-semibold text-[#0A3035] transition hover:bg-[#0A3035] hover:text-white"
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
