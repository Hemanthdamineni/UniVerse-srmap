import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executePipeline, type SapScholarshipsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};


export default function SapScholarshipsPage({ blueprint }: Props) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  const [data, setData] = useState<SapScholarshipsModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load SAP & scholarships.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
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
        setError(null);
        return;
      }

      setError(null);
      setData(pipelineResult.data as SapScholarshipsModel);
    } catch (err: any) {
      setError(err.message || "Failed to load SAP & scholarships.");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

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
            <EmptyState
              title="No data available"
              description={data.message}
            />
          ) : null}
        </>
      )}
    </ErpPageShell>
  );
}
