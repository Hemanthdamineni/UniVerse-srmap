import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getErpBatch, sendErpDocumentRequest } from "../../lib/erpApi";
import type { ErpDocument, ErpPageResponse } from "../../lib/erpApi";
import { executePipeline } from "../../lib/erpTransformers";
import type { AttendanceModel, ErpGenericTable } from "../../lib/erpTransformers";
import { buildCombinedDocumentForKeys } from "../../lib/erpDocumentUtils";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import ErpDocumentRenderer from "../../components/erp/ErpDocumentRenderer";
import { InlineError } from "../../components/ui/InlineError";

interface AttendanceDetailsPageProps {
  blueprint: PageBlueprint;
}

export default function AttendanceDetailsPage({ blueprint }: AttendanceDetailsPageProps) {
  const [model, setModel] = useState<AttendanceModel | null>(null);
  const [studentAttendanceDocument, setStudentAttendanceDocument] = useState<ErpDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;

        const result = batch["academic/attendance-details"];
        if (!result || (result as any).success === false) {
          setError("Attendance data unavailable.");
          setStudentAttendanceDocument(null);
          setLoading(false);
          return;
        }

        const pipelineResult = executePipeline(blueprint, batch);
        if (pipelineResult?.isValid && pipelineResult.data) {
          const studentAttendanceResult = batch["academic/student-attendance"] as ErpPageResponse | undefined;
          setModel(pipelineResult.data as AttendanceModel);
          setStudentAttendanceDocument(
            studentAttendanceResult
              ? buildCombinedDocumentForKeys(
                  ["academic/student-attendance"],
                  { "academic/student-attendance": studentAttendanceResult },
                  "Student Attendance"
                )
              : null
          );
        } else {
          setError("Invalid attendance data format.");
          setStudentAttendanceDocument(null);
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
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {model && (
        <>
          {studentAttendanceDocument && (
            <StudentAttendanceCard document={studentAttendanceDocument} />
          )}

          {model.studentAttendanceTables && (
            <TodayAttendanceSection tables={model.studentAttendanceTables} />
          )}

          <div className="erp-table-shell mt-10">
            <table className="erp-table table-fixed">
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
                      <td className="erp-table-cell erp-table-align-center">{rec.classesConducted}</td>
                      <td className="erp-table-cell erp-table-align-center">{rec.attendanceEntered}</td>
                      <td className="erp-table-cell erp-table-align-center">{rec.odMlTaken}</td>
                      <td className="erp-table-cell erp-table-align-center">{rec.present}</td>
                      <td className="erp-table-cell erp-table-align-center">{rec.odMlApprovedPct.toFixed(2)}%</td>
                      <td className="erp-table-cell erp-table-align-center font-semibold" style={{ color: rec.attendancePct < 75 ? 'var(--error)' : 'var(--success)' }}>
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

          {model.odMlTables && model.odMlTables.length > 0 && (
            <OdMlDetailsSection title="OD/ML Details" tables={model.odMlTables} />
          )}
        </>
      )}
    </ErpPageShell>
  );
}

function StudentAttendanceCard({ document }: { document: ErpDocument }) {
  let action: any = null;
  let fieldName: string = "txtCode";

  const scanNode = (node: any) => {
    if (!node) return;
    if (node.type === "form" && node.props?.action) action = node.props.action;
    if (node.type === "button" && node.props?.action && !action) action = node.props.action;
    if (node.type === "field" && node.props?.name) fieldName = node.props.name;
    if (Array.isArray(node.children)) node.children.forEach(scanNode);
  };

  if (document.root) scanNode(document.root);
  if (Array.isArray((document as any).children)) (document as any).children.forEach(scanNode);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!action) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length !== 7) {
      setFormError("Code must be exactly 7 characters.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setSuccess(false);
    try {
      await sendErpDocumentRequest({
        url: action.target,
        method: action.method || "POST",
        data: { [fieldName]: trimmed },
      });
      setSuccess(true);
      setCode("");
    } catch (err: any) {
      setFormError(err.message || "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-8 dashboard-card overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Left: label area */}
        <div className="border-b border-[var(--comp-border)] md:border-b-0 md:border-r px-6 py-5 md:w-5/12 lg:w-2/5 bg-[color-mix(in_srgb,var(--surface)_60%,var(--background))]">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--comp-text-secondary)] mb-2">Online Attendance</p>
          <h2 className="text-base font-bold text-[var(--comp-text-primary)] leading-snug">Mark today's session</h2>
          <p className="mt-1.5 text-sm text-[var(--comp-text-secondary)] leading-relaxed max-w-xs">
            Enter the 7-character code shared by your faculty to confirm your presence.
          </p>
        </div>

        {/* Right: form area */}
        <div className="flex-1 px-6 py-5">
          {formError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_22%,transparent)] px-3.5 py-3 text-sm text-[var(--error)]">
              <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 4.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 1.5 0v-3.5zm-.75 6a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75z"/></svg>
              {formError}
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_22%,transparent)] px-3.5 py-3 text-sm text-[var(--success)]">
              <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.28 5.03a.75.75 0 0 0-1.06-1.06L7 8.19 5.78 6.97a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75z"/></svg>
              Attendance marked successfully.
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-0">
                <label htmlFor="attendanceCode" className="comp-label block mb-2">
                  Attendance Code
                </label>
                <input
                  id="attendanceCode"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (formError) setFormError("");
                    if (success) setSuccess(false);
                  }}
                  placeholder="e.g. A123456"
                  className="w-full rounded-lg border border-[var(--comp-border-strong)] bg-[var(--background)] px-3.5 py-2.5 font-mono text-sm tracking-[0.08em] text-[var(--comp-text-primary)] transition-colors placeholder:text-[var(--comp-text-muted)] focus:border-[var(--comp-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--comp-accent)] disabled:opacity-50"
                  maxLength={7}
                  disabled={submitting}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                disabled={submitting || code.trim().length !== 7}
                className="comp-btn-primary shrink-0 min-h-[42px] px-7 text-sm"
              >
                {submitting ? "Marking..." : "Mark Attendance"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--comp-text-muted)]">
              First alphabet followed by 6 digits, e.g. <span className="font-mono">A123456</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function TodayAttendanceSection({ tables }: { tables: ErpGenericTable[] }) {
  // Flatten all rows across tables (Today Attendance is always one table)
  const allTables = tables.filter(t => t.columns.length > 0);

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--comp-text-primary)] pl-1">
        Today's Attendance
      </h2>

      {allTables.length === 0 || allTables.every(t => t.rows.length === 0) ? (
        <div className="erp-table-shell px-6 py-12 flex flex-col items-center justify-center text-center gap-3">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--comp-text-muted)] opacity-60">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
            <path d="M9 16l2 2 4-4"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-[var(--comp-text-primary)]">No sessions recorded yet</p>
            <p className="mt-1 text-xs text-[var(--comp-text-muted)] max-w-xs">
              Today's attendance will appear here once your faculty marks sessions. Mark your attendance using the code above.
            </p>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}

function OdMlDetailsSection({ title, tables }: { title: string; tables: ErpGenericTable[] }) {
  if (!tables || tables.length === 0) return null;

  const normalizeTitle = (t: string) => t.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const normalizedSectionTitle = normalizeTitle(title);

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--comp-text-primary)] pl-1">{title}</h2>
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
                      <tr className="erp-table-row">
                        <td colSpan={table.columns.length} className="erp-table-cell py-8 text-center text-sm italic text-[var(--comp-text-muted)]">
                          No records found.
                        </td>
                      </tr>
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
    </div>
  );
}
