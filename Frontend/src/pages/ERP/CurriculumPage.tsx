import { useEffect, useState } from "react";
// ErpPageShell section-card; curriculum table columns unchanged.
import { getErpBatch } from "../../lib/erp/index";
import { executePipeline, type CurriculumModel } from "../../lib/erp/erpTransformers";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

interface CurriculumPageProps {
  blueprint: PageBlueprint;
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
          <div className="flex flex-col gap-2">
            <div className="erp-table-shell">
              <table className="erp-table w-full table-fixed text-left">
                <thead className="erp-table-head">
                  <tr>
                    <th className="erp-table-head-cell label-text erp-table-align-center w-[72px]">Sem</th>
                    <th className="erp-table-head-cell label-text w-[124px]">Code</th>
                    <th className="erp-table-head-cell label-text">Description</th>
                    <th className="erp-table-head-cell label-text erp-table-align-center w-[88px]">Credit</th>
                    <th className="erp-table-head-cell label-text w-[140px]">Group</th>
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {model.subjects.map((row, idx) => (
                    <tr 
                      key={`${row.code}-${idx}`}
                      className="erp-table-row"
                    >
                      <td className="erp-table-cell erp-table-cell-strong erp-table-align-center">{row.semester}</td>
                      <td className="erp-table-cell erp-table-cell-strong">{row.code}</td>
                      <td className="erp-table-cell">{row.description}</td>
                      <td className="erp-table-cell erp-table-cell-strong erp-table-align-center">{row.credit}</td>
                      <td className="erp-table-cell">{row.group}</td>
                    </tr>
                  ))}
                  {model.subjects.length === 0 && (
                    <tr className="erp-table-row">
                      <td colSpan={5} className="erp-table-cell py-12 text-center text-sm italic" style={{ color: 'var(--comp-text-muted)' }}>
                        No subjects listed in curriculum for the current enrollment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}
