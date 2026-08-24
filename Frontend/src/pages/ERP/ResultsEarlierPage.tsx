import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getErpBatch, type ErpBatchPageResult, type ErpPageFailure } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import { extractApiErrorMessage } from "../../lib/core/auth";
import { handleSessionAuthFailure, isSessionAuthFailure } from "../../lib/core/session";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, TableCardHeader } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { readExtracted } from "../../lib/erp/shared";

// Strips erp-table-shell chrome so the shared DataTable reads as one flush
// surface inside `dashboard-card overflow-hidden p-0` sections.
const FLUSH_TABLE_SHELL =
  "[&_.erp-table-shell]:rounded-none [&_.erp-table-shell]:border-0 [&_.erp-table-shell]:shadow-none";

interface Props {
  blueprint: PageBlueprint;
}

interface HistoricalExamMark {
  semester: string;
  monthYear: string;
  subjectCode: string;
  subjectDescription: string;
  credit: string;
  grade: string;
  gradePoint: string;
  result: string;
  attempt: string;
}

interface InternalMarkRecord {
  semester: string;
  code: string;
  description: string;
  subjectType: string;
  markObtained: string;
  maxMark: string;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function humanizeText(value: unknown): string {
  const s = clean(value);
  if (!s) return "";
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) {
    return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return s;
}

// Grade tiers follow the SRM 10-point scale: ≥8 celebrates, 6–7 stays calm,
// ≤5 warns, and fail/absent grades alarm. Letter fallback covers rows whose
// grade point cell is blank.
type GradeTier = "success" | "warning" | "error" | null;

function gradeTier(grade: string, gradePoint: string): GradeTier {
  const g = grade.trim().toUpperCase();
  const pt = Number.parseFloat(gradePoint);
  if (/^(F|U|AB)$/.test(g)) return "error";
  if (!Number.isNaN(pt)) {
    if (pt <= 0) return "error";
    if (pt >= 8) return "success";
    if (pt >= 6) return null;
    return "warning";
  }
  if (/^O$|^A\+?$|^[PS]$/.test(g)) return "success";
  if (/^[BC]\+?$/.test(g)) return null;
  if (/^[DE]$/.test(g)) return "warning";
  return null;
}

const GRADE_TIER_PILL: Record<Exclude<GradeTier, null>, string> = {
  success: "erp-status-pill-success",
  warning: "erp-status-pill-warning",
  error: "erp-status-pill-error",
} as const;

function gradePillClass(tier: GradeTier): string {
  return tier ? GRADE_TIER_PILL[tier] : "erp-status-pill-info";
}

function requireExtracted(
  rawData: unknown,
  expectedType: string,
  pageKey: string,
): Record<string, unknown> {
  const extracted = readExtracted(rawData);
  if (!extracted) {
    throw new Error(
      `MISSING_EXTRACTED_PAYLOAD [${pageKey}]: _extracted field is absent. ` +
        `The ERP page structure may have changed. Add or fix the backend extractor.`,
    );
  }
  if (extracted.type !== expectedType) {
    throw new Error(
      `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${extracted.type}". ` +
        `The backend extractor output type has changed.`,
    );
  }
  return extracted;
}

function isBatchFailure(result: ErpBatchPageResult | undefined): result is ErpPageFailure {
  return Boolean(result && (result as { success?: boolean }).success === false);
}

function parseHistoricalExamMarks(rawData: unknown): HistoricalExamMark[] {
  const extracted = requireExtracted(rawData, "exam-mark-details", "examination/exam-mark-details");
  const records = extracted.records as Record<string, unknown>[];
  const total = records.length;
  const parsed = records
    .map((r) => ({
      semester: clean(r.semesterNo),
      monthYear: clean(r.monthYear),
      subjectCode: clean(r.subjectCode),
      subjectDescription: humanizeText(r.subjectName),
      credit: clean(r.credit),
      grade: clean(r.grade),
      gradePoint: clean(r.gradePoints),
      result: clean(r.result),
      attempt: clean(r.attempt),
    }))
    .filter((r) => r.subjectCode && r.subjectDescription);
  const dropped = total - parsed.length;
  if (dropped > 0) {
    console.warn(
      `[ResultsEarlierPage] Dropped ${dropped} of ${total} exam mark records — missing subject code or description.`,
    );
  }
  return parsed;
}

function parseAvailableSemesters(rawData: unknown): number[] {
  const extracted = requireExtracted(
    rawData,
    "earlier-internal-marks",
    "examination/earlier-internal-marks",
  );
  const semesters = (extracted.availableSemesters as Array<{ semesterNo: number }> | undefined) ?? [];
  const nums = semesters
    .map((s) => Number(s.semesterNo))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  return nums.length > 0 ? nums : [1];
}

function parseInternalMarks(rawData: unknown): InternalMarkRecord[] {
  const extracted = requireExtracted(
    rawData,
    "internal-marks",
    "examination/earlier-internal-marks/semester",
  );
  const records = extracted.records as Record<string, unknown>[];
  const total = records.length;
  const parsed = records
    .map((r) => ({
      semester: clean(r.semester ?? ""),
      code: clean(r.subjectCode),
      description: humanizeText(r.subjectName),
      subjectType: clean((r.extras as Record<string, unknown>)?.subjectType ?? ""),
      markObtained: clean(r.marksObtained),
      maxMark: clean(r.totalMarks),
    }))
    .filter((r) => r.code && r.description);
  const dropped = total - parsed.length;
  if (dropped > 0) {
    console.warn(
      `[ResultsEarlierPage] Dropped ${dropped} of ${total} internal mark records — missing subject code or description.`,
    );
  }
  return parsed;
}

async function fetchInternalMarksForSemester(
  semester: number,
  signal?: AbortSignal,
): Promise<InternalMarkRecord[]> {
  const response = await fetch(
    `/api/scrape/examination/earlier-internal-marks/semester/${semester}`,
    { credentials: "include", signal },
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, payload)) {
      handleSessionAuthFailure();
    }
    throw new Error(
      extractApiErrorMessage(payload, `Failed to load semester ${semester} internal marks.`),
    );
  }

  return parseInternalMarks(payload);
}

export default function ResultsEarlierPage({ blueprint }: Props) {
  const [historicalMarks, setHistoricalMarks] = useState<HistoricalExamMark[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [internalMarks, setInternalMarks] = useState<InternalMarkRecord[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load earlier semester results.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    const marksResult = batch["examination/exam-mark-details"];
    const internalResult = batch["examination/earlier-internal-marks"];

    try {
      if (isBatchFailure(marksResult)) {
        throw new Error(marksResult.error || "Failed to load historical exam marks.");
      }
      if (isBatchFailure(internalResult)) {
        throw new Error(internalResult.error || "Failed to load earlier internal marks.");
      }

      const marksRows = parseHistoricalExamMarks(marksResult?.data);
      const semesters = parseAvailableSemesters(internalResult?.data);
      // Default to the highest available semester; fall back to the highest
      // semester found in historical exam marks if the extractor returned none.
      const initialSemester =
        semesters[semesters.length - 1] ||
        Math.max(...marksRows.map((r) => parseInt(r.semester, 10)).filter((n) => !isNaN(n)), 0) ||
        1;

      setHistoricalMarks(marksRows);
      setAvailableSemesters(semesters);
      setSelectedSemester(initialSemester);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earlier semester results.");
    }
  }, [batchQuery.data]);

  const loading = batchQuery.isPending;

  useEffect(() => {
    if (!selectedSemester) return;
    const controller = new AbortController();
    let active = true;

    async function loadInternalMarks() {
      const semester = selectedSemester;
      if (!semester) return;
      try {
        setInternalLoading(true);
        setInternalError(null);
        const rows = await fetchInternalMarksForSemester(semester, controller.signal);
        if (!active) return;
        setInternalMarks(rows);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!active) return;
        setInternalError(err instanceof Error ? err.message : "Failed to load internal marks.");
        setInternalMarks([]);
      } finally {
        if (active) setInternalLoading(false);
      }
    }

    loadInternalMarks();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedSemester]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage="Loading earlier semester results..."
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      <div className="space-y-6 animate-fade-in">
        {error && (
          <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        )}

        <section className="dashboard-card overflow-hidden p-0">
          <TableCardHeader
            title="Earlier Internal Mark Details"
            right={
              <div className="flex flex-wrap gap-2">
                {availableSemesters.map((semester) => {
                  const selected = semester === selectedSemester;
                  return (
                    <button
                      key={semester}
                      type="button"
                      onClick={() => setSelectedSemester(semester)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                      style={{
                        background: selected ? 'var(--comp-accent)' : 'var(--comp-surface)',
                        color: selected ? 'var(--comp-accent-fg)' : 'var(--comp-text-primary)',
                        border: selected ? 'none' : '1px solid var(--comp-border)',
                      }}
                    >
                      Semester {semester}
                    </button>
                  );
                })}
              </div>
            }
          />
          <p className="px-5 pt-3 text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
            Pick a semester to load the detailed internal assessment breakdown.
          </p>

          <div className={`mt-3 px-3 pb-4 md:p-0 ${FLUSH_TABLE_SHELL}`}>
            <DataTable
              data={internalMarks}
              isLoading={internalLoading}
              error={internalError}
              stickyHeader
              ariaLabel="Earlier internal marks"
              emptyTitle={`No internal mark details were found for semester ${selectedSemester}.`}
              keyExtractor={(row) => `${row.semester}-${row.code}-${row.subjectType}`}
              columns={[
                { header: "Semester", accessor: (row) => <span className="font-semibold">{row.semester}</span> },
                { header: "Code", accessor: (row) => <span className="font-semibold">{row.code}</span> },
                { header: "Description", accessor: (row) => row.description },
                { header: "Subject Type", accessor: (row) => row.subjectType },
                {
                  header: "Mark Obtained",
                  accessor: (row) => {
                    const got = Number.parseFloat(row.markObtained);
                    const max = Number.parseFloat(row.maxMark);
                    const weak = !Number.isNaN(got) && !Number.isNaN(max) && max > 0 && got / max < 0.6;
                    return (
                      <span
                        className="font-medium tabular-nums"
                        style={weak ? { color: "var(--warning)", fontWeight: 700 } : undefined}
                      >
                        {row.markObtained}
                      </span>
                    );
                  },
                  className: "text-right",
                },
                { header: "Max Mark", accessor: (row) => row.maxMark, className: "text-right" },
              ] as Column<InternalMarkRecord>[]}
            />
          </div>
        </section>

        <section className="dashboard-card overflow-hidden p-0">
          <TableCardHeader
            title="Exam Mark Details"
            right={
              <div className="whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs" style={{ background: 'color-mix(in srgb, var(--comp-surface) 50%, transparent)', color: 'var(--comp-text-secondary)' }}>
                <span className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>{historicalMarks.length}</span> historical records
              </div>
            }
          />
          <p className="px-5 pt-3 text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
            Published result history across your completed semesters.
          </p>

          <div className={`mt-3 px-3 pb-4 md:p-0 ${FLUSH_TABLE_SHELL}`}>
            <DataTable
              data={historicalMarks}
              stickyHeader
              ariaLabel="Historical exam marks"
              emptyTitle="No historical exam marks were found."
              keyExtractor={(row) => `${row.semester}-${row.monthYear}-${row.subjectCode}-${row.attempt}`}
              columns={[
                { header: "Semester", accessor: (row) => <span className="font-semibold">{row.semester}</span> },
                { header: "Month & Year", accessor: (row) => row.monthYear },
                { header: "Subject Code", accessor: (row) => <span className="font-semibold">{row.subjectCode}</span> },
                { header: "Subject Description", accessor: (row) => row.subjectDescription },
                { header: "Credit", accessor: (row) => row.credit, className: "text-right" },
                {
                  header: "Grade",
                  accessor: (row) => (
                    <span className={`erp-status-pill ${gradePillClass(gradeTier(row.grade, row.gradePoint))}`}>
                      {row.grade}
                    </span>
                  ),
                  className: "text-center",
                },
                { header: "Grade Point", accessor: (row) => row.gradePoint, className: "text-right" },
                {
                  header: "Result",
                  accessor: (row) => (
                    <span className={`erp-status-pill ${row.result.toLowerCase() === "pass" ? "erp-status-pill-success" : "erp-status-pill-error"}`}>
                      {row.result}
                    </span>
                  ),
                  className: "text-center",
                },
                { header: "Attempt", accessor: (row) => row.attempt, className: "text-right" },
              ] as Column<HistoricalExamMark>[]}
            />
          </div>
        </section>
      </div>
    </ErpPageShell>
  );
}
