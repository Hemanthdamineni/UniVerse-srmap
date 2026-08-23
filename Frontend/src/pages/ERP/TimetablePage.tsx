import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
// ErpPageShell section-card layout; timetable structure unchanged.
import { getErpBatch } from "../../lib/erp/index";
import { executePipeline } from "../../lib/erp/erpTransformers";
import type { TimetableModel } from "../../lib/erp/erpTransformers";
import { getFacultyCabins, buildCabinLookup } from "../../lib/erp/facultyApi";
import type { FacultyCabin } from "../../lib/erp/types";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, TableCardHeader, TableEmptyRow } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

interface TimetablePageProps {
  blueprint: PageBlueprint;
}

export default function TimetablePage({ blueprint }: TimetablePageProps) {
  const [model, setModel] = useState<TimetableModel | null>(null);
  const [cabins, setCabins] = useState<FacultyCabin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setEmptyMessage(null);

    // Cabins are supplementary: a failure here never blocks the timetable.
    getFacultyCabins()
      .then((data) => {
        if (active) setCabins(data);
      })
      .catch(() => {
        if (active) setCabins([]);
      });

    getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;
        const result = batch["academic/time-table"];
        if (!result || (result as any).success === false) {
          setEmptyMessage("Your class timetable has not been published yet. Check back later or contact your department.");
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

  const cabinLookup = useMemo(
    () => (model && cabins.length > 0 ? buildCabinLookup(model.subjects, cabins) : new Map<string, string>()),
    [model, cabins],
  );

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

      {emptyMessage && (
        <EmptyState title="Timetable not available" description={emptyMessage} />
      )}

      {model && !emptyMessage && (
        <>
          {/* Weekly Schedule Grid */}
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text w-28">Day</th>
                  {timeSlots.length > 0 ? (
                    timeSlots.map((slot, i) => (
                      <th key={i} className="erp-table-head-cell label-text erp-table-align-center w-32">
                        {slot}
                      </th>
                    ))
                  ) : (
                    <th className="erp-table-head-cell label-text">Schedule</th>
                  )}
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {days.length === 0 ? (
                  <TableEmptyRow
                    colSpan={timeSlots.length > 0 ? timeSlots.length + 1 : 2}
                    message="No schedule data available"
                    hint="Your class timetable hasn't been published yet. Check back later or contact your department."
                  />
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
              <TableCardHeader title="Course Details & Faculty" />
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
                        <td className="erp-table-cell">
                          {sub.faculty}
                          {cabinLookup.get(sub.faculty) ? (
                            <span
                              className="mt-0.5 block text-xs"
                              style={{ color: "var(--comp-text-muted)" }}
                              title="Faculty cabin location"
                            >
                              {cabinLookup.get(sub.faculty)}
                            </span>
                          ) : null}
                        </td>
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
