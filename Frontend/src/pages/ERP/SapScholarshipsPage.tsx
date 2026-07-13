import { useEffect, useState } from "react";
import { executePipeline, type SapScholarshipsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

function SapEmptyNotice({ message }: { message: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-8 py-10 text-center">
      <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--comp-text-secondary)]">
        Application History
      </span>
      <p className="max-w-xs text-sm leading-6 text-[var(--comp-text-secondary)]">{message}</p>
    </div>
  );
}


export default function SapScholarshipsPage({ blueprint }: Props) {
  const [data, setData] = useState<SapScholarshipsModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const batch = await getErpBatch(blueprint.fetchKeys);
        if (!active) return;

        // Merge data from all fetch keys
        const merged: Record<string, unknown> = {};
        for (const key of blueprint.fetchKeys) {
          const rawData = (batch[key] as any)?.data;
          if (rawData && typeof rawData === "object") {
            Object.assign(merged, rawData);
          }
        }

        if (Object.keys(merged).length === 0) {
          throw new Error("No data found for SAP & scholarships.");
        }

        const pipelineResult = executePipeline("sap-scholarships", merged);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          setData({ title: blueprint.heading, tables: [], message: "No SAP or scholarship information available." });
          return;
        }

        setData(pipelineResult.data as SapScholarshipsModel);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load SAP & scholarships.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint, refreshTrigger]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading SAP and scholarship details..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {data && (
        <>
          {data.tables.length > 0 ? (
            data.tables.map((table, tableIndex) => {
              const headers = Object.keys(table[0] || {});
              return (
                <section key={tableIndex} className="dashboard-card overflow-hidden p-0">
                  <div className="erp-table-shell rounded-none border-0 shadow-none">
                    <table className="erp-table w-full text-left">
                      <thead className="erp-table-head">
                        <tr>
                          {headers.map((header) => (
                            <th key={header} className="erp-table-head-cell label-text">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="erp-table-body">
                        {table.map((row, rowIndex) => (
                          <tr key={rowIndex} className="erp-table-row">
                            {headers.map((header) => (
                              <td key={header} className="erp-table-cell">
                                {row[header] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          ) : data.message ? (
            <SapEmptyNotice message={data.message} />
          ) : null}
        </>
      )}
    </ErpPageShell>
  );
}
