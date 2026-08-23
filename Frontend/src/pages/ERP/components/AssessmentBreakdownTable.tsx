import type { InternalMarkSubject } from "../../../lib/erp/erpTransformers";

interface AssessmentBreakdownTableProps {
  subject: InternalMarkSubject;
  compact?: boolean;
}

export function AssessmentBreakdownTable({
  subject,
  compact = false,
}: AssessmentBreakdownTableProps) {
  const assessments = subject.assessments || [];
  if (assessments.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--comp-border)]">
      <table
        className="w-full text-sm"
        aria-label={`${subject.code} internal assessment breakdown`}
      >
        <thead className="bg-[var(--comp-surface)]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">
              Assessment
            </th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">
              Conducted
            </th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">
              Converted
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--comp-border)]">
          {assessments.map((assessment, index) => (
            <tr key={`${subject.code}-${assessment.name}-${index}`}>
              <td className="px-3 py-2 text-[var(--comp-text-primary)]">
                {assessment.name}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--comp-text-secondary)]">
                {assessment.conducted || "-"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[var(--comp-text-secondary)]">
                {assessment.converted || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!compact ? (
        <div className="border-t border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-surface)_60%,transparent)] px-3 py-2 text-right text-xs font-semibold text-[var(--comp-text-secondary)]">
          Total: {subject.marksObtained.toFixed(2)} / {subject.maxMarks.toFixed(0)}
        </div>
      ) : null}
    </div>
  );
}

export default AssessmentBreakdownTable;
