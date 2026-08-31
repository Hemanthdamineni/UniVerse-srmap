import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
// ErpPageShell section-card layout; timetable structure unchanged.
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
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

/**
 * Parse the raw ERP cell text into a subject code + optional room.
 *
 * The ERP hands back strings like:
 *   "MCE 244(C 705)"
 *   "CSE 304"
 *   "MCE 244(C 705) — Some long title from the title attribute"
 *
 * The trailing em-dash suffix (when the cell has a `title` attribute on the
 * server) is discarded — the actual subject title lives in the legend below.
 */
function parseTimetableEntry(raw: string): { code: string; room: string } | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  // Strip any "code — extra title" suffix the extractor appends.
  const withoutSuffix = trimmed.split(/\s+[—–-]\s+/)[0].trim();
  if (!withoutSuffix) return null;

  const match = withoutSuffix.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return { code: withoutSuffix, room: "" };
  }

  return {
    code: match[1].trim(),
    room: match[2].trim(),
  };
}

export default function TimetablePage({ blueprint }: TimetablePageProps) {
  const [model, setModel] = useState<TimetableModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Phase 5: batch fetch on React Query (fresh window = backend fresh TTL).
  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  // Cabins are supplementary: a failure here never blocks the timetable.
  const cabinsQuery = useQuery({
    queryKey: ["faculty-cabins"],
    queryFn: () => getFacultyCabins(),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const cabins = cabinsQuery.data ?? [];

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load timetable.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    setEmptyMessage(null);
    const result = batch["academic/time-table"];
    if (!result || (result as any).success === false) {
      setEmptyMessage("Your class timetable has not been published yet. Check back later or contact your department.");
      return;
    }

    const rawData = (result as any).data;
    const pipelineResult = executePipeline(blueprint, rawData);
    if (pipelineResult?.isValid && pipelineResult.data) {
      setModel(pipelineResult.data as TimetableModel);
      setError(null);
    } else {
      setError("Invalid timetable data format.");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

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
                      <td className="erp-table-cell erp-table-cell-strong timetable-cell">{dayRow.day}</td>
                      {dayRow.slots.map((slot, i) => {
                        const entry = slot.classDetails ? parseTimetableEntry(slot.classDetails) : null;
                        return (
                          <td key={i} className="erp-table-cell erp-table-align-center timetable-cell">
                            {entry ? (
                              <span className="timetable-entry">
                                <span className="timetable-entry-code">{entry.code}</span>
                                {entry.room ? <span className="timetable-entry-room">{entry.room}</span> : null}
                              </span>
                            ) : (
                              <span className="timetable-cell-empty" aria-label="No class scheduled">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
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
                            to={`/learn/subjects/${encodeURIComponent(sub.code)}`}
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
