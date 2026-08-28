import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { InternalMarksModel } from "../../../lib/erp/erpTransformers";
import { AssessmentBreakdownTable } from "./AssessmentBreakdownTable";
import { TableCardHeader } from "../../../components/erp/ErpPrimitives";

interface InternalMarksBundledSectionProps {
  model: InternalMarksModel;
}

export function InternalMarksBundledSection({
  model,
}: InternalMarksBundledSectionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <section className="dashboard-card p-0">
      <TableCardHeader
        title="Internal Mark Details"
        right={
          <span className="rounded-full bg-[var(--comp-surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-secondary)] tabular-nums">
            {model.averagePercentage.toFixed(2)}% average
          </span>
        }
      />

      {model.subjects.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm italic text-[var(--comp-text-muted)]">
          No internal mark details found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          {model.subjects.map((subject) => {
            const isOpen = expanded.has(subject.code);
            const hasAssessments =
              subject.assessments && subject.assessments.length > 0;
            const pct =
              subject.maxMarks > 0
                ? (subject.marksObtained / subject.maxMarks) * 100
                : 0;
            const pctColor =
              pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--error)";

            return (
              <div
                key={subject.code}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--comp-border)] bg-[var(--background)] transition-shadow hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => hasAssessments && toggle(subject.code)}
                  aria-expanded={hasAssessments ? isOpen : undefined}
                  aria-label={
                    hasAssessments
                      ? `${isOpen ? "Collapse" : "Expand"} ${subject.code}`
                      : undefined
                  }
                  className={`w-full px-5 py-4 text-left transition-colors ${
                    hasAssessments
                      ? "cursor-pointer hover:bg-[var(--comp-surface-hover)]"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 rounded-md bg-[var(--comp-accent-light)] px-2.5 py-1 text-xs font-bold tracking-wide text-[var(--comp-accent)] tabular-nums">
                          {subject.code}
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--comp-text-primary)]">
                          {subject.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-5">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <p className="text-sm tabular-nums">
                            <span className="font-bold text-[var(--comp-accent)]">
                              {subject.marksObtained.toFixed(2)}
                            </span>
                            <span className="mx-0.5 text-[var(--comp-text-muted)]">
                              /
                            </span>
                            <span className="text-xs text-[var(--comp-text-muted)]">
                              {subject.maxMarks.toFixed(0)}
                            </span>
                          </p>
                          <span
                            className={`erp-status-pill tabular-nums text-xs font-bold ${
                              pct >= 75
                                ? "erp-status-pill-success"
                                : pct >= 50
                                  ? "erp-status-pill-warning"
                                  : "erp-status-pill-error"
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="ml-auto mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
                          <div
                            className="h-full w-full origin-left rounded-full transition-transform duration-300"
                            style={{
                              transform: `scaleX(${Math.min(pct, 100) / 100})`,
                              background: pctColor,
                            }}
                          />
                        </div>
                      </div>

                      {hasAssessments ? (
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-[var(--comp-text-muted)] transition-transform duration-200"
                          style={{
                            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        />
                      ) : (
                        <div className="w-4" />
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && hasAssessments ? (
                  <div className="border-t border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-5 py-4">
                    <AssessmentBreakdownTable subject={subject} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default InternalMarksBundledSection;
