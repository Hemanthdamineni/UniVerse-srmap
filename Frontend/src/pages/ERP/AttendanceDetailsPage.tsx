import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { ErpPageResponse } from "../../lib/erp/index";
import { executePipeline } from "../../lib/erp/erpTransformers";
import type { AttendanceModel, ErpGenericTable } from "../../lib/erp/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, TableEmptyRow } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { calculateBunkCapacity } from "./components/BunkCalculator";
import { AttendanceTrendSection } from "./components/AttendanceTrendSection";

interface AttendanceDetailsPageProps {
  blueprint: PageBlueprint;
}

export default function AttendanceDetailsPage({ blueprint }: AttendanceDetailsPageProps) {
  const [model, setModel] = useState<AttendanceModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load attendance details.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    const result = batch["academic/attendance-details"];
    if (!result || (result as any).success === false) {
      setError("Attendance data unavailable.");
      return;
    }

    const pipelineResult = executePipeline(blueprint, batch);
    if (pipelineResult?.isValid && pipelineResult.data) {
      setModel(pipelineResult.data as AttendanceModel);
      setError(null);
    } else {
      setError("Invalid attendance data format.");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

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
          {/* Mark attendance — pinned to the top */}
          <StudentAttendanceCard />

          {model.studentAttendanceTables && (
            <TodayAttendanceSection tables={model.studentAttendanceTables} />
          )}

          {/* MAIN attendance summary table */}
          <section>
            <h2 className="label-text mb-3">Attendance Summary</h2>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead className="erp-table-head">
                  <tr>
                    <th className="erp-table-head-cell label-text">Subject Code</th>
                    <th className="erp-table-head-cell label-text">Subject</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Conducted</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Entered</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">OD/ML</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Present</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">OD/ML %</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Attendance %</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Bunk</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Needed</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center">Status</th>
                    <th className="erp-table-head-cell label-text">LMS</th>
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {model.records.length === 0 ? (
                    <TableEmptyRow
                      colSpan={12}
                      message="No attendance records"
                      hint="No attendance records are available for the current semester."
                    />
                  ) : (
                  model.records.map((rec) => {
                    const bunk = calculateBunkCapacity(
                      rec.classesConducted,
                      rec.present,
                      75,
                      rec.odMlTaken,
                    );
                    const statusColor =
                      bunk.status === "safe"
                        ? "var(--success)"
                        : bunk.status === "caution"
                        ? "var(--warning)"
                        : "var(--error)";
                    return (
                      <tr key={rec.subjectCode} className="erp-table-row">
                        <td className="erp-table-cell erp-table-cell-strong min-w-[130px]">{rec.subjectCode}</td>
                        <td className="erp-table-cell min-w-[180px]">{rec.subjectDescription}</td>
                        <td className="erp-table-cell erp-table-align-center">{rec.classesConducted}</td>
                        <td className="erp-table-cell erp-table-align-center">{rec.attendanceEntered}</td>
                        <td className="erp-table-cell erp-table-align-center">{rec.odMlTaken}</td>
                        <td className="erp-table-cell erp-table-align-center">{rec.present}</td>
                        <td className="erp-table-cell erp-table-align-center">{rec.odMlApprovedPct.toFixed(2)}%</td>
                        <td className="erp-table-cell erp-table-align-center font-semibold" style={{ color: rec.attendancePct < 75 ? 'var(--error)' : 'var(--success)' }}>
                          {rec.attendancePct.toFixed(2)}%
                        </td>
                        <td className="erp-table-cell erp-table-align-center font-semibold" style={{ color: statusColor }}>
                          {bunk.safeToSkip > 0 ? bunk.safeToSkip : "—"}
                        </td>
                        <td className="erp-table-cell erp-table-align-center font-semibold" style={{ color: statusColor }}>
                          {bunk.classesNeededToAttend > 0 ? bunk.classesNeededToAttend : "—"}
                        </td>
                        <td className="erp-table-cell erp-table-align-center">
                          <span
                            className="erp-status-pill"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${statusColor} 20%, transparent)`,
                              color: statusColor,
                            }}
                          >
                            {bunk.status === "safe" ? "✓ Safe" : bunk.status === "caution" ? "⚠ Caution" : "✕ Required"}
                          </span>
                        </td>
                        <td className="erp-table-cell">
                          <Link
                            to={`/learn/discover?subjectCode=${encodeURIComponent(rec.subjectCode)}`}
                            className="comp-btn-ghost min-h-0 rounded-full px-3 py-1 text-xs font-semibold"
                          >
                            Resources
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </section>

          <AttendanceTrendSection refreshTrigger={refreshTrigger} />

          {model.notes.length > 0 && (
            <section className="dashboard-card p-4">
              <h2 className="label-text mb-2">Notes</h2>
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

          {model.odMlTables && model.odMlTables.length > 0 && (
            <OdMlDetailsSection title="OD/ML Details" tables={model.odMlTables} />
          )}
        </>
      )}
    </ErpPageShell>
  );
}

const CODE_LENGTH = 7;

function StudentAttendanceCard() {
  const [cells, setCells] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const cellRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  const code = cells.join("");

  const clearFeedback = () => {
    if (formError) setFormError("");
    if (success) setSuccess(false);
  };

  // Single char overwrites the cell and advances; multi-char input (paste) distributes.
  const writeChars = (index: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) {
      if (!cells[index]) return;
      const next = [...cells];
      next[index] = "";
      setCells(next);
      return;
    }
    const chars = clean.length === 2 && clean[0] === cells[index] ? clean.slice(1) : clean;
    const next = [...cells];
    for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i++) {
      next[index + i] = chars[i];
    }
    setCells(next);
    cellRefs.current[Math.min(index + chars.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleCellKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...cells];
      if (next[index]) {
        next[index] = "";
      } else if (index > 0) {
        next[index - 1] = "";
        cellRefs.current[index - 1]?.focus();
      } else {
        return;
      }
      setCells(next);
      clearFeedback();
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      cellRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      cellRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setFormError("Code must be exactly 7 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acode: code }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `Request failed (${res.status})`);
      }
      setSuccess(true);
      setCells(Array(CODE_LENGTH).fill(""));
    } catch (err: any) {
      setFormError(err.message || "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="dashboard-card overflow-hidden" aria-label="Online attendance marking">
      <div className="px-5 py-4 sm:px-6">
        {formError && (
          <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_22%,transparent)] px-3.5 py-3 text-sm text-[var(--error)]">
            <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5zm-.75 6a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75z"/></svg>
            {formError}
          </div>
        )}
        {success && (
          <div role="status" className="mb-3 flex items-start gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_22%,transparent)] px-3.5 py-3 text-sm text-[var(--success)]">
            <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.28 5.03a.75.75 0 0 0-1.06-1.06L7 8.19 5.78 6.97a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75z"/></svg>
            Attendance marked successfully.
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-0">
          {/* Identity zone */}
          <div className="flex items-start gap-3.5 md:pr-8">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--comp-accent-light)] text-[var(--comp-accent)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
                <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
                <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="label-text">Online Attendance</h2>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--comp-text-primary)]">Mark today's session</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--comp-text-secondary)]">
                Enter the 7-character code shared by your faculty to confirm your presence.
              </p>
            </div>
          </div>

          {/* Code console */}
          <form
            onSubmit={handleSubmit}
            className="md:border-l md:border-[color-mix(in_srgb,var(--comp-border-strong)_40%,transparent)] md:pl-8"
          >
            <label htmlFor="attendance-code-0" className="label-text mb-1.5 block">
              Attendance Code
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="flex w-full gap-1 sm:w-auto sm:gap-2">
                {cells.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { cellRefs.current[i] = el; }}
                    id={i === 0 ? "attendance-code-0" : undefined}
                    type="text"
                    value={char}
                    onChange={(e) => { writeChars(i, e.target.value); clearFeedback(); }}
                    onKeyDown={(e) => handleCellKeyDown(i, e)}
                    onPaste={(e) => { e.preventDefault(); writeChars(i, e.clipboardData.getData("text")); }}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={i === 0 ? undefined : `Attendance code, character ${i + 1} of ${CODE_LENGTH}`}
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    autoCapitalize="characters"
                    inputMode="text"
                    spellCheck={false}
                    disabled={submitting}
                    className={`h-11 min-w-0 flex-1 rounded-md border bg-[var(--background)] text-center font-mono text-base font-semibold uppercase text-[var(--comp-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--comp-accent)] focus:ring-1 focus:ring-[var(--comp-accent)] disabled:opacity-50 sm:h-12 sm:w-10 sm:flex-none sm:text-lg ${
                      formError
                        ? "border-[var(--error)]"
                        : char
                          ? "border-[var(--comp-border-strong)]"
                          : "border-[color-mix(in_srgb,var(--comp-border-strong)_50%,transparent)]"
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={submitting || code.length !== CODE_LENGTH}
                className="comp-btn-primary min-h-[44px] w-full shrink-0 sm:w-auto"
              >
                {submitting ? "Marking..." : "Mark Attendance"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function TodayAttendanceSection({ tables }: { tables: ErpGenericTable[] }) {
  // Flatten all rows across tables (Today Attendance is always one table)
  const allTables = tables.filter(t => t.columns.length > 0);
  const hasAnyRows = allTables.some(t => t.rows.length > 0);

  // Hide entirely when faculty hasn't marked any session today
  if (!hasAnyRows) return null;

  return (
    <section>
      <h2 className="label-text mb-3">Today's Attendance</h2>
      <div className="space-y-6">
        {allTables.map((table, tIdx) => (
            <div key={tIdx} className="erp-table-shell overflow-x-auto">
              <table className="erp-table">
                <thead className="erp-table-head">
                  <tr>
                    {table.columns.map((col) => (
                      <th key={col} className="erp-table-head-cell label-text">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {table.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="erp-table-row">
                      {table.columns.map((col) => {
                        const val = row[col] || "-";
                        const isStatus = col.toLowerCase() === "status";
                        const isPresent = isStatus && val.toLowerCase().startsWith("p");
                        const isAbsent = isStatus && val.toLowerCase().startsWith("a");
                        return (
                          <td key={col} className="erp-table-cell">
                            {isStatus ? (
                              <span className={`erp-status-pill ${isPresent ? "erp-status-pill-success" : isAbsent ? "erp-status-pill-error" : "erp-status-pill-info"}`}>
                                {val}
                              </span>
                            ) : (
                              val
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </section>
  );
}

function OdMlDetailsSection({ title, tables }: { title: string; tables: ErpGenericTable[] }) {
  if (!tables || tables.length === 0) return null;

  const normalizeTitle = (t: string) => t.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const normalizedSectionTitle = normalizeTitle(title);

  return (
    <section>
      <h2 className="label-text mb-3">{title}</h2>
      <div className="space-y-6">
        {tables.map((table, index) => {
          const showInnerTitle =
            table.title &&
            normalizeTitle(table.title) !== normalizedSectionTitle &&
            normalizeTitle(table.title) !== "odmldetails";

          return (
            <div key={`${table.title}-${index}`}>
              {showInnerTitle && (
                <p className="mb-2 text-sm font-semibold text-[var(--comp-text-primary)] pl-1">{table.title}</p>
              )}
              <div className="erp-table-shell overflow-x-auto">
                <table className="erp-table">
                  <thead className="erp-table-head">
                    <tr className="erp-table-row">
                      {table.columns.map((column) => (
                        <th key={column} className="erp-table-head-cell label-text">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {table.rows.length === 0 ? (
                      <TableEmptyRow colSpan={table.columns.length} message="No records found." />
                    ) : (
                      table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="erp-table-row">
                          {table.columns.map((column) => (
                            <td key={column} className="erp-table-cell">
                              {row[column] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
