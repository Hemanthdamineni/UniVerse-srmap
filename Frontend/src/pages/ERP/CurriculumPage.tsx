import { useEffect, useMemo, useState } from "react";
import { getErpBatch } from "../../lib/erp/index";
import { executePipeline, type CurriculumModel } from "../../lib/erp/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, KpiGrid } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

interface CurriculumPageProps {
  blueprint: PageBlueprint;
}

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

export default function CurriculumPage({ blueprint }: CurriculumPageProps) {
  const [model, setModel] = useState<CurriculumModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;

        const result = batch["academic/student-wise-subjects"];
        if (!result || (result as any).success === false) {
          setError("Curriculum data unavailable.");
          setLoading(false);
          return;
        }

        const rawData = (result as any).data;
        const pipelineResult = executePipeline(blueprint, rawData);
        if (pipelineResult?.isValid && pipelineResult.data) {
          setModel(pipelineResult.data as CurriculumModel);
        } else {
          setError("Invalid curriculum data format.");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load curriculum.");
        setLoading(false);
      });

    return () => { active = false; };
  }, [blueprint.fetchKeys, blueprint, refreshTrigger]);

  const semesterGroups = useMemo(() => {
    if (!model) return [];
    const groups = new Map<number, typeof model.subjects>();
    for (const s of model.subjects) {
      const sem = parseInt(s.semester, 10) || 0;
      if (!groups.has(sem)) groups.set(sem, []);
      groups.get(sem)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [model]);

  const kpis = useMemo(() => {
    if (!model) return [];
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

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      <div className="flex flex-col gap-6">
        {error && (
          <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        )}

        {model && (
          <>
            <KpiGrid items={kpis} />

            {model.subjects.length === 0 ? (
              <EmptyState
                title="No curriculum data available"
                description="No subjects are listed in the curriculum for the current enrollment."
              />
            ) : (
              semesterGroups.map(([semester, subjects]) => {
                const semCredits = subjects.reduce((sum, s) => sum + (parseFloat(s.credit) || 0), 0);
                return (
                  <div key={semester} className="erp-table-shell">
                    <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--comp-border)' }}>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--comp-text-primary)' }}>
                        Semester {semester}
                      </h3>
                      <span className="text-xs" style={{ color: 'var(--comp-text-muted)' }}>
                        {subjects.length} subject{subjects.length !== 1 ? 's' : ''} &middot; {semCredits} credit{semCredits !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <table className="erp-table w-full text-left">
                      <thead className="erp-table-head">
                        <tr>
                          <th className="erp-table-head-cell label-text w-[124px]">Code</th>
                          <th className="erp-table-head-cell label-text">Description</th>
                          <th className="erp-table-head-cell label-text erp-table-align-center w-[88px]">Credit</th>
                          <th className="erp-table-head-cell label-text w-[140px]">Type</th>
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
                            <td className="erp-table-cell erp-table-cell-strong erp-table-align-center">{row.credit}</td>
                            <td className="erp-table-cell">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isElective(row.group) ? 'bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)]' : 'bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] text-[var(--comp-text-secondary)]'
                                }`}
                              >
                                {isElective(row.group) ? 'Elective' : 'Core'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </ErpPageShell>
  );
}
