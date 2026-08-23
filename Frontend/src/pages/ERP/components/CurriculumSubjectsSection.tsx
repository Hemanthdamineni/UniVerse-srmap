import { useMemo } from "react";
import type { CurriculumModel } from "../../../lib/erp/types";
import { EmptyState } from "../../../components/ui/Feedback";
import { KpiGrid, TableCardHeader } from "../../../components/erp/ErpPrimitives";

function isElective(group: string): boolean {
  const g = group.toLowerCase().trim();
  return (
    g.includes("elective") ||
    g.includes("hum") ||
    g.includes("open") ||
    g.includes("soft skill") ||
    g.includes("value education") ||
    g.includes("technical training") ||
    g.includes("nptel") ||
    g.includes("mooc")
  );
}

export function CurriculumSubjectsSection({ model }: { model: CurriculumModel }) {
  const semesterGroups = useMemo(() => {
    const groups = new Map<number, typeof model.subjects>();
    for (const s of model.subjects) {
      const sem = parseInt(s.semester, 10) || 0;
      if (!groups.has(sem)) groups.set(sem, []);
      groups.get(sem)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [model]);

  const kpis = useMemo(() => {
    const total = model.subjects.length;
    const coreCount = model.subjects.filter((s) => !isElective(s.group)).length;
    const totalCredits = model.subjects.reduce((sum, s) => sum + (parseFloat(s.credit) || 0), 0);
    return [
      { label: "Total Subjects", value: String(total) },
      { label: "Core / Elective", value: `${coreCount} / ${total - coreCount}` },
      { label: "Total Credits", value: String(totalCredits) },
      { label: "Semesters", value: String(semesterGroups.length) },
    ];
  }, [model, semesterGroups]);

  if (model.subjects.length === 0) {
    return (
      <EmptyState
        title="No curriculum data available"
        description="No subjects are listed in the curriculum for the current enrollment."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid items={kpis} />
      {semesterGroups.map(([semester, subjects]) => {
        const semCredits = subjects.reduce((sum, s) => sum + (parseFloat(s.credit) || 0), 0);
        return (
          <div key={semester} className="erp-table-shell">
            <TableCardHeader
              title={`Semester ${semester}`}
              right={
                <span className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                  {subjects.length} subject{subjects.length !== 1 ? "s" : ""} &middot; {semCredits}{" "}
                  credit{semCredits !== 1 ? "s" : ""}
                </span>
              }
            />
            <table className="erp-table w-full text-left">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text w-28">Code</th>
                  <th className="erp-table-head-cell label-text">Description</th>
                  <th className="erp-table-head-cell label-text erp-table-align-center w-24">
                    Credit
                  </th>
                  <th className="erp-table-head-cell label-text w-36">Type</th>
                </tr>
              </thead>
              <tbody className="erp-table-body">
                {subjects.map((row, idx) => (
                  <tr key={`${row.code}-${idx}`} className="erp-table-row">
                    <td className="erp-table-cell erp-table-cell-strong">{row.code}</td>
                    <td className="erp-table-cell">
                      <span
                        title={row.description.length > 60 ? row.description : undefined}
                        className="cursor-default"
                      >
                        {row.description}
                      </span>
                    </td>
                    <td className="erp-table-cell erp-table-cell-strong erp-table-align-center">
                      {row.credit}
                    </td>
                    <td className="erp-table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isElective(row.group)
                            ? "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]"
                            : "bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] text-[var(--comp-text-secondary)]"
                        }`}
                      >
                        {isElective(row.group) ? "Elective" : "Core"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
