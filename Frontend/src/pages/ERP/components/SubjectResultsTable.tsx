import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  CurrentResultModel,
  InternalMarkSubject,
} from "../../../lib/erp/erpTransformers";
import { AssessmentBreakdownTable } from "./AssessmentBreakdownTable";
import { TableEmptyRow } from "../../../components/erp/ErpPrimitives";
import { useIsMobileViewport } from "../../../hooks/useMediaQuery";

interface SubjectResultsTableProps {
  subjects: CurrentResultModel["subjects"];
  internalMarksByCode: Map<string, InternalMarkSubject>;
}

type Subject = SubjectResultsTableProps["subjects"][number];

function isPass(result: string): boolean {
  return result.trim().toLowerCase() === "pass";
}

/**
 * Mobile: one card per subject leading with the grade — the single number a
 * student opens this page for — with the pass/fail pill next to it. Code and
 * description are demoted to a subtitle; credits/semester sink to a footnote
 * row. Internal marks stay behind the same disclosure toggle as the table.
 */
function SubjectResultCards({
  subjects,
  internalMarksByCode,
  expanded,
  onToggle,
}: SubjectResultsTableProps & {
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (subjects.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--comp-border)] p-4 text-center text-sm italic text-[var(--comp-text-muted)]">
        No subject results found.
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {subjects.map((subject: Subject, index: number) => {
        const subjectKey = `${subject.subjectCode}-${index}`;
        const internalMark = internalMarksByCode.get(
          subject.subjectCode.replace(/\s+/g, "").toUpperCase()
        );
        const isExpanded = expanded.has(subjectKey);
        const passed = isPass(subject.result);

        return (
          <li
            key={subjectKey}
            className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--comp-text-primary)]">
                  {subject.subjectCode}
                </p>
                <p className="mt-0.5 text-xs text-[var(--comp-text-secondary)]">
                  {subject.subjectDescription}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-2xl font-bold leading-none text-[var(--comp-text-primary)]">
                  {subject.grade}
                </span>
                <span
                  className={`erp-status-pill ${passed ? "erp-status-pill-success" : "erp-status-pill-error"}`}
                >
                  {subject.result}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--comp-text-secondary)]">
              <span>Semester {subject.semester}</span>
              <span>{subject.credit} credits</span>
            </div>

            {internalMark ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggle(subjectKey)}
                  aria-label={`${isExpanded ? "Hide" : "Show"} internal marks for ${subject.subjectCode}`}
                  aria-expanded={isExpanded}
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--comp-accent)]"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Internal marks
                </button>
                {isExpanded ? (
                  <div className="mt-1 rounded-xl bg-[var(--comp-surface-hover)] p-3 text-sm">
                    <p className="font-semibold text-[var(--comp-text-primary)]">
                      {internalMark.marksObtained.toFixed(2)} /{" "}
                      {internalMark.maxMarks.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[var(--comp-text-secondary)]">
                      {internalMark.percentage.toFixed(2)}%,{" "}
                      {internalMark.status.replace("-", " ")}
                    </p>
                    {internalMark.assessments &&
                    internalMark.assessments.length > 0 ? (
                      <div className="mt-3">
                        <AssessmentBreakdownTable
                          subject={internalMark}
                          compact
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SubjectResultsTable({
  subjects,
  internalMarksByCode,
}: SubjectResultsTableProps) {
  const isMobile = useIsMobileViewport();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );

  const toggleSubjectExpansion = (subjectCode: string) => {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectCode)) {
        next.delete(subjectCode);
      } else {
        next.add(subjectCode);
      }
      return next;
    });
  };

  // Exclusive render: only one of table / cards is mounted so the a11y tree
  // never carries a duplicate, unannounced copy of every row (the disclosure
  // buttons are focusable, so aria-hidden on a mirror would strand them).
  if (isMobile) {
    return (
      <SubjectResultCards
        subjects={subjects}
        internalMarksByCode={internalMarksByCode}
        expanded={expandedSubjects}
        onToggle={toggleSubjectExpansion}
      />
    );
  }

  return (
    <div className="erp-table-shell overflow-auto">
      <table
        className="erp-table"
        aria-label="Current semester subject results"
      >
        <thead className="erp-table-head">
          <tr className="erp-table-row">
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] w-10 bg-[var(--comp-accent)]">
              {" "}
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)]">
              Code
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)]">
              Description
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] text-center">
              Semester
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] text-center">
              Credits
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] text-center">
              Grade
            </th>
            <th className="erp-table-head-cell label-text sticky top-0 z-[1] text-center">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="erp-table-body">
          {subjects.length === 0 ? (
            <TableEmptyRow colSpan={7} message="No subject results found." />
          ) : (
            subjects.map((subject, index) => {
              const subjectKey = `${subject.subjectCode}-${index}`;
              const normalizedCode = subject.subjectCode
                .replace(/\s+/g, "")
                .toUpperCase();
              const internalMark = internalMarksByCode.get(normalizedCode);
              const isExpanded = expandedSubjects.has(subjectKey);

              return (
                <Fragment key={subjectKey}>
                  <tr className="erp-table-row bg-[color:var(--comp-surface)] hover:bg-[color:var(--comp-surface-hover)]">
                    <td className="erp-table-cell">
                      {internalMark ? (
                        <button
                          type="button"
                          onClick={() => toggleSubjectExpansion(subjectKey)}
                          aria-label={`${isExpanded ? "Hide" : "Show"} internal marks for ${subject.subjectCode}`}
                          aria-expanded={isExpanded}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)] focus:outline-none"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </td>
                    <td className="erp-table-cell font-semibold">
                      {subject.subjectCode}
                    </td>
                    <td className="erp-table-cell">
                      {subject.subjectDescription}
                    </td>
                    <td className="erp-table-cell text-center">
                      {subject.semester}
                    </td>
                    <td className="erp-table-cell text-center font-medium text-[var(--comp-text-secondary)]">
                      {subject.credit}
                    </td>
                    <td className="erp-table-cell text-center">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded bg-[var(--comp-surface-hover)] px-2 py-1 font-bold text-[var(--comp-text-primary)]">
                        {subject.grade}
                      </span>
                    </td>
                    <td className="erp-table-cell text-center">
                      <span
                        className={`erp-status-pill ${isPass(subject.result) ? "erp-status-pill-success" : "erp-status-pill-error"}`}
                      >
                        {subject.result}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && internalMark ? (
                    <tr className="erp-table-row bg-[color:var(--comp-surface)]">
                      <td colSpan={7} className="erp-table-cell">
                        <div className="grid gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] p-4 sm:grid-cols-4">
                          <div>
                            <p className="label-text">Internal Marks</p>
                            <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">
                              {internalMark.marksObtained.toFixed(2)} /{" "}
                              {internalMark.maxMarks.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="label-text">Percentage</p>
                            <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">
                              {internalMark.percentage.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="label-text">Signal</p>
                            <p className="mt-1 text-sm font-semibold capitalize text-[var(--comp-text-primary)]">
                              {internalMark.status.replace("-", " ")}
                            </p>
                          </div>
                          <div>
                            <p className="label-text">Source Row</p>
                            <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">
                              {internalMark.detailTableIndex}
                            </p>
                          </div>
                          {internalMark.assessments &&
                          internalMark.assessments.length > 0 ? (
                            <div className="sm:col-span-4">
                              <AssessmentBreakdownTable subject={internalMark} />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

