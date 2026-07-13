import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  CurrentResultModel,
  InternalMarkSubject,
} from "../../../lib/erp/erpTransformers";
import { AssessmentBreakdownTable } from "./AssessmentBreakdownTable";

interface SubjectResultsTableProps {
  subjects: CurrentResultModel["subjects"];
  internalMarksByCode: Map<string, InternalMarkSubject>;
}

export function SubjectResultsTable({
  subjects,
  internalMarksByCode,
}: SubjectResultsTableProps) {
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

  return (
    <>
      {/* Desktop Table */}
      <div className="erp-table-shell hidden overflow-auto md:block">
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
              <tr className="erp-table-row">
                <td
                  colSpan={7}
                  className="erp-table-cell py-8 text-center text-sm italic text-[var(--comp-text-muted)]"
                >
                  No subject results found.
                </td>
              </tr>
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
                          className={`erp-status-pill ${subject.result.toLowerCase() === "pass" ? "erp-status-pill-success" : "erp-status-pill-error"}`}
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

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {subjects.length === 0 ? (
          <p className="rounded-xl border border-[var(--comp-border)] p-4 text-center text-sm italic text-[var(--comp-text-muted)]">
            No subject results found.
          </p>
        ) : (
          subjects.map((subject, index) => {
            const subjectKey = `${subject.subjectCode}-${index}`;
            const internalMark = internalMarksByCode.get(
              subject.subjectCode.replace(/\s+/g, "").toUpperCase()
            );
            const isExpanded = expandedSubjects.has(subjectKey);

            return (
              <div
                key={subjectKey}
                className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--comp-text-primary)]">
                      {subject.subjectCode}
                    </p>
                    <p className="mt-1 text-sm text-[var(--comp-text-secondary)]">
                      {subject.subjectDescription}
                    </p>
                  </div>
                  {internalMark ? (
                    <button
                      type="button"
                      onClick={() => toggleSubjectExpansion(subjectKey)}
                      aria-label={`${isExpanded ? "Hide" : "Show"} internal marks for ${subject.subjectCode}`}
                      aria-expanded={isExpanded}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)] focus:outline-none"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <span className="text-[var(--comp-text-secondary)]">
                    Semester: {subject.semester}
                  </span>
                  <span className="text-[var(--comp-text-secondary)]">
                    Credits: {subject.credit}
                  </span>
                  <span className="font-semibold text-[var(--comp-text-primary)]">
                    Grade: {subject.grade}
                  </span>
                  <span className="font-semibold text-[var(--comp-text-primary)]">
                    Result: {subject.result}
                  </span>
                </div>
                {isExpanded && internalMark ? (
                  <div className="mt-4 rounded-xl bg-[var(--comp-surface-hover)] p-3 text-sm">
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
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export default SubjectResultsTable;
