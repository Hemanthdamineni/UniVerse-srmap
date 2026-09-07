import { useMemo, useState } from "react";
import { SectionCard } from "../../../components/erp/ErpPrimitives";
import type { InternalMarksModel } from "../../../lib/erp/types";

// SRM AP absolute grading bands (min total mark, out of 100). These are the
// standard bands; a student on a different scheme can override with a custom
// target percentage below.
const GRADE_BANDS: { grade: string; min: number }[] = [
  { grade: "O", min: 91 },
  { grade: "A+", min: 81 },
  { grade: "A", min: 71 },
  { grade: "B+", min: 61 },
  { grade: "B", min: 56 },
  { grade: "C", min: 50 },
  { grade: "P", min: 45 },
];

function bandFor(total: number): string {
  for (const band of GRADE_BANDS) {
    if (total >= band.min) return band.grade;
  }
  return "F";
}

type Row = {
  code: string;
  description: string;
  internalSecured: number;
  internalMax: number;
  endTermMax: number;
};

export function GradeTargetCalculator({ internalMarks }: { internalMarks: InternalMarksModel | null | undefined }) {
  const [targetGrade, setTargetGrade] = useState("A");
  const [customTarget, setCustomTarget] = useState<string>("");
  const [endTermOverrides, setEndTermOverrides] = useState<Record<string, number>>({});

  const baseRows = useMemo<Row[]>(() => {
    const subjects = internalMarks?.subjects ?? [];
    return subjects
      .filter((s) => s.code && s.maxMarks > 0 && s.maxMarks < 100)
      .map((s) => ({
        code: s.code,
        description: s.description,
        internalSecured: s.marksObtained,
        internalMax: s.maxMarks,
        endTermMax: Math.max(1, Math.round(100 - s.maxMarks)),
      }));
  }, [internalMarks]);

  if (baseRows.length === 0) {
    return (
      <SectionCard title="End-term target per subject">
        <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
          Live internal marks aren&apos;t available yet — refresh the ERP internal-mark-details page, or this
          calculator will appear once CLA marks are entered.
        </p>
      </SectionCard>
    );
  }

  const customValue = customTarget.trim() === "" ? null : Number.parseFloat(customTarget);
  const targetTotal =
    customValue != null && Number.isFinite(customValue)
      ? customValue
      : GRADE_BANDS.find((b) => b.grade === targetGrade)?.min ?? 71;
  const targetLabel = customValue != null && Number.isFinite(customValue) ? `${customValue}/100` : targetGrade;

  return (
    <SectionCard title="End-term target per subject">
      <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
        Given your internal marks so far, what you need on each end-term paper to land a target grade.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
          Target grade
          <select
            aria-label="Target grade"
            value={targetGrade}
            onChange={(e) => setTargetGrade(e.target.value)}
            className="rounded-lg border border-[var(--comp-border)] bg-[var(--background)] px-3 py-2 text-sm"
            style={{ color: "var(--comp-text-primary)" }}
          >
            {GRADE_BANDS.map((b) => (
              <option key={b.grade} value={b.grade}>
                {b.grade} (≥ {b.min})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--comp-text-secondary)" }}>
          Or custom total %
          <input
            aria-label="Or custom total %"
            type="number"
            min={0}
            max={100}
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            placeholder="—"
            className="w-28 rounded-lg border border-[var(--comp-border)] bg-[var(--background)] px-3 py-2 text-sm"
            style={{ color: "var(--comp-text-primary)" }}
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {baseRows.map((row) => {
          const endTermMax = endTermOverrides[row.code] ?? row.endTermMax;
          const neededPoints = targetTotal - row.internalSecured;
          const neededPercent = (neededPoints / endTermMax) * 100;
          const maxPossibleTotal = row.internalSecured + endTermMax;
          const bestGrade = bandFor(maxPossibleTotal);

          let verdict: { text: string; tone: string };
          if (neededPercent <= 0) {
            verdict = {
              text: `Locked in — even 0 on the end-term keeps you at ${targetLabel}.`,
              tone: "var(--success)",
            };
          } else if (neededPercent > 100) {
            verdict = {
              text: `Out of reach — a perfect end-term caps you at ${maxPossibleTotal.toFixed(0)}/100 (${bestGrade}).`,
              tone: "var(--error)",
            };
          } else {
            verdict = {
              text: `Need ${Math.ceil(neededPercent)}/100 on the ${row.code} end-term for ${targetLabel}.`,
              tone: neededPercent > 75 ? "var(--warning)" : "var(--comp-text-primary)",
            };
          }

          return (
            <div
              key={row.code}
              className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                    {row.code}
                  </span>
                  <span className="ml-2 text-xs" style={{ color: "var(--comp-text-muted)" }}>
                    {row.description}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>
                  Internal {row.internalSecured}/{row.internalMax}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium" style={{ color: verdict.tone }}>
                {verdict.text}
              </p>
              <label
                className="mt-2 flex items-center gap-2 text-xs"
                style={{ color: "var(--comp-text-muted)" }}
              >
                End-term worth
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={endTermMax}
                  onChange={(e) =>
                    setEndTermOverrides((prev) => ({
                      ...prev,
                      [row.code]: Math.max(1, Math.min(100, Number.parseInt(e.target.value, 10) || row.endTermMax)),
                    }))
                  }
                  className="w-16 rounded border border-[var(--comp-border)] bg-[var(--background)] px-2 py-1"
                  style={{ color: "var(--comp-text-primary)" }}
                />
                marks of the final 100
              </label>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

