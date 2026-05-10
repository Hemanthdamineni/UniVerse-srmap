// ErpPageShell section-card; earlier results tables unchanged.
import { useEffect, useState } from "react";
import LoadingSpinner from "../../components/LoadingSpinner";
import { getErpBatch, type ErpBatchPageResult, type ErpPageFailure } from "../../lib/erpApi";
import { extractApiErrorMessage } from "../../lib/auth";
import { getSessionId, handleSessionAuthFailure, isSessionAuthFailure } from "../../lib/session";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";
import { DataTable, type Column } from "../../components/ui/DataTable";

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

const MONTH_PATTERN = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}$/i;
const SUBJECT_CODE_PATTERN = /^[A-Z]{2,}\s*\d{2,3}[A-Z]?$/i;
const GRADE_PATTERN = /^(O|A\+|A|B\+|B|C|D|P|F|RA|AB)$/i;
const RESULT_PATTERN = /^(PASS|FAIL|ABSENT|RA|WH)$/i;

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function humanizeText(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  if (normalized === normalized.toUpperCase() && /[A-Z]/.test(normalized)) {
    return normalized.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  return normalized;
}

function isBatchFailure(result: ErpBatchPageResult | undefined): result is ErpPageFailure {
  return Boolean(result && (result as { success?: boolean }).success === false);
}

function readEarlierInternalMarksSection(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") return null;
  return ((rawData as Record<string, unknown>).Examination as Record<string, unknown> | undefined)?.[
    "Earlier Internal Marks"
  ] as Record<string, unknown> | null;
}

function readExamMarkDetailsSection(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") return null;
  return ((rawData as Record<string, unknown>).Examination as Record<string, unknown> | undefined)?.[
    "Exam Mark Details"
  ] as Record<string, unknown> | null;
}

function parseAvailableSemesters(rawData: unknown) {
  const section = readEarlierInternalMarksSection(rawData);
  if (!section) return [1];

  const documentRecord =
    section.document && typeof section.document === "object"
      ? (section.document as Record<string, unknown>)
      : null;
  const rootRecord =
    documentRecord?.root && typeof documentRecord.root === "object"
      ? (documentRecord.root as Record<string, unknown>)
      : null;
  const childNodes = Array.isArray(rootRecord?.children) ? (rootRecord.children as Array<Record<string, unknown>>) : [];

  const fromButtons = childNodes
    .map((node) =>
      node.props && typeof node.props === "object"
        ? normalizeText((node.props as Record<string, unknown>).label)
        : ""
    )
    .map((label) => label.match(/semester\s+(\d+)/i))
    .map((match) => Number.parseInt(match?.[1] || "", 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const fromText = Array.from(normalizeText(section.text).matchAll(/semester\s+(\d+)/gi))
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const semesters = Array.from(new Set([...fromButtons, ...fromText])).sort((left, right) => left - right);
  return semesters.length > 0 ? semesters : [1];
}

function parseExamMarkTokenRow(tokens: string[]): HistoricalExamMark | null {
  const row: HistoricalExamMark = {
    semester: "-",
    monthYear: "-",
    subjectCode: "-",
    subjectDescription: "-",
    credit: "-",
    grade: "-",
    gradePoint: "-",
    result: "-",
    attempt: "-",
  };

  const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
  if (numericTokens.length > 0) row.semester = numericTokens[0];
  if (numericTokens.length > 1) row.credit = numericTokens[1];
  if (numericTokens.length > 2) row.attempt = numericTokens[numericTokens.length - 1];

  const monthToken = tokens.find((token) => MONTH_PATTERN.test(token));
  if (monthToken) row.monthYear = monthToken;

  const subjectCode = tokens.find((token) => SUBJECT_CODE_PATTERN.test(token));
  if (subjectCode) row.subjectCode = subjectCode;

  const gradeToken = tokens.find((token) => GRADE_PATTERN.test(token));
  if (gradeToken) row.grade = gradeToken;

  const gradePointToken = tokens.find((token) => /^\d+\.\d{2}$/.test(token));
  if (gradePointToken) row.gradePoint = gradePointToken;

  const resultToken = tokens.find((token) => RESULT_PATTERN.test(token));
  if (resultToken) row.result = resultToken;

  const description = tokens
    .filter((token) => token.length > 3)
    .filter((token) => !MONTH_PATTERN.test(token))
    .filter((token) => !SUBJECT_CODE_PATTERN.test(token))
    .filter((token) => !GRADE_PATTERN.test(token))
    .filter((token) => !RESULT_PATTERN.test(token))
    .filter((token) => !/^\d+(\.\d+)?$/.test(token))
    .sort((left, right) => right.length - left.length)[0];

  if (description) row.subjectDescription = humanizeText(description);

  if (row.subjectCode === "-" || row.subjectDescription === "-") {
    return null;
  }

  return row;
}

function parseHistoricalExamMarks(rawData: unknown) {
  const section = readExamMarkDetailsSection(rawData);
  const tables = Array.isArray(section?.tables) ? (section.tables as unknown[]) : [];
  const parsedRows: HistoricalExamMark[] = [];

  tables.forEach((table) => {
    if (!Array.isArray(table) || table.length === 0) return;
    const firstRow = table[0];
    if (!firstRow || typeof firstRow !== "object") return;

    const tokens = Array.from(
      new Set(
        Object.keys(firstRow as Record<string, unknown>)
          .map((key) => key.replace(/_\d+$/, "").trim())
          .filter(Boolean)
      )
    );

    const parsed = parseExamMarkTokenRow(tokens);
    if (parsed) {
      parsedRows.push(parsed);
    }
  });

  const deduped = Array.from(
    new Map(
      parsedRows.map((row) => [
        `${row.semester}|${row.monthYear}|${row.subjectCode}|${row.subjectDescription}|${row.attempt}|${row.grade}`,
        row,
      ])
    ).values()
  );

  return deduped.sort((left, right) => {
    const semesterDiff = Number.parseInt(left.semester || "0", 10) - Number.parseInt(right.semester || "0", 10);
    if (semesterDiff !== 0) return semesterDiff;
    if (left.monthYear !== right.monthYear) return left.monthYear.localeCompare(right.monthYear);
    return left.subjectCode.localeCompare(right.subjectCode);
  });
}

function parseInternalMarks(rawData: unknown) {
  const table =
    rawData && typeof rawData === "object" && Array.isArray((rawData as Record<string, unknown>).tables)
      ? (((rawData as Record<string, unknown>).tables as unknown[])[0] as Array<Record<string, unknown>> | undefined)
      : undefined;

  if (!Array.isArray(table)) return [];

  return table
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      semester: normalizeText(row.Semester),
      code: normalizeText(row.Code),
      description: humanizeText(row.Description),
      subjectType: humanizeText(row["Subject Type"]),
      markObtained: normalizeText(row["Mark Obtained"]),
      maxMark: normalizeText(row["Max Mark"]),
    }))
    .filter((row) => row.code && row.description);
}

async function fetchInternalMarksForSemester(semester: number) {
  const sessionId = getSessionId();
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const response = await fetch(`/api/scrape/examination/earlier-internal-marks/semester/${semester}${query}`, {
    credentials: "include",
  });

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
      extractApiErrorMessage(payload, `Failed to load semester ${semester} internal marks.`)
    );
  }

  return parseInternalMarks(payload);
}

export default function ResultsEarlierPage({ blueprint }: Props) {
  const [historicalMarks, setHistoricalMarks] = useState<HistoricalExamMark[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [internalMarks, setInternalMarks] = useState<InternalMarkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const batch = await getErpBatch(blueprint.fetchKeys);
        const marksResult = batch["examination/exam-mark-details"];
        const internalResult = batch["examination/earlier-internal-marks"];

        if (isBatchFailure(marksResult)) {
          throw new Error(marksResult.error || "Failed to load historical exam marks.");
        }

        if (isBatchFailure(internalResult)) {
          throw new Error(internalResult.error || "Failed to load earlier internal marks.");
        }

        const marksRows = parseHistoricalExamMarks(marksResult?.data);
        const semesters = parseAvailableSemesters(internalResult?.data);
        const initialSemester = semesters[semesters.length - 1] || 1;

        if (!active) return;

        setHistoricalMarks(marksRows);
        setAvailableSemesters(semesters);
        setSelectedSemester(initialSemester);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load earlier semester results.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [blueprint.fetchKeys, refreshTrigger]);

  useEffect(() => {
    if (!selectedSemester) return;

    let active = true;

    async function loadInternalMarks() {
      const semester = selectedSemester;
      if (!semester) return;

      try {
        setInternalLoading(true);
        setInternalError(null);

        const rows = await fetchInternalMarksForSemester(semester);
        if (!active) return;
        setInternalMarks(rows);
      } catch (err) {
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

        <section className="dashboard-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Earlier Internal Mark Details</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
                Pick a semester to load the detailed internal assessment breakdown.
              </p>
            </div>

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
                      color: selected ? '#fff' : 'var(--comp-text-primary)',
                      border: selected ? 'none' : '1px solid var(--comp-border)',
                    }}
                  >
                    Semester {semester}
                  </button>
                );
              })}
            </div>
          </div>

          {internalLoading ? (
            <LoadingSpinner message={`Loading semester ${selectedSemester} internal marks...`} />
          ) : internalError ? (
            <InlineError message={internalError} />
          ) : (
            <DataTable
              data={internalMarks}
              stickyHeader
              ariaLabel="Earlier internal marks"
              emptyTitle={`No internal mark details were found for semester ${selectedSemester}.`}
              keyExtractor={(row) => `${row.semester}-${row.code}-${row.subjectType}`}
              columns={[
                { header: "Semester", accessor: (row) => <span className="font-semibold">{row.semester}</span> },
                { header: "Code", accessor: (row) => <span className="font-semibold">{row.code}</span> },
                { header: "Description", accessor: (row) => row.description },
                { header: "Subject Type", accessor: (row) => row.subjectType },
                { header: "Mark Obtained", accessor: (row) => row.markObtained, className: "text-right" },
                { header: "Max Mark", accessor: (row) => row.maxMark, className: "text-right" },
              ] as Column<InternalMarkRecord>[]}
            />
          )}
        </section>

        <section className="dashboard-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Exam Mark Details</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--comp-text-secondary)' }}>
                Published result history across your completed semesters.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm" style={{ background: 'color-mix(in srgb, var(--comp-surface) 50%, transparent)', color: 'var(--comp-text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>{historicalMarks.length}</span> historical records
            </div>
          </div>

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
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded bg-slate-100 px-2 py-1 font-bold text-[var(--comp-text-primary)]">
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
        </section>
      </div>
    </ErpPageShell>
  );
}
