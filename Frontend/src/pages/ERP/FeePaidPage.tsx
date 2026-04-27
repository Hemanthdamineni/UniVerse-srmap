import { useEffect, useState } from "react";
import { executePipeline, type FeesPaidModel } from "../../lib/erpTransformers";
// ErpPageShell section-card; paid fees table unchanged.
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";

type Props = {
  blueprint: PageBlueprint;
};

export default function FeePaidPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeesPaidModel | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const batch = await getErpBatch(blueprint.fetchKeys);
        if (!active) return;

        const mainKey = blueprint.fetchKeys[0];
        const rawData = (batch[mainKey] as any)?.data;
        
        if (!rawData) {
          throw new Error("No data found for fees paid.");
        }

        const pipelineResult = executePipeline("finance-paid", rawData);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          // If the pipeline says it's invalid, we show no rows rather than crashing
          setData({ title: blueprint.heading, records: [] });
          return;
        }

        setData(pipelineResult.data as FeesPaidModel);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load fees paid.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [blueprint, refreshTrigger]);

  const rows = data?.records || [];

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      contentLayout="section-card"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading fees paid..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error ? (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      ) : null}

      <section className="dashboard-card overflow-hidden p-0">
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--comp-border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Payment Receipts</h3>
        </div>
        <div className="erp-table-shell rounded-none border-0 shadow-none">
          <table className="erp-table w-full text-left">
            <thead className="erp-table-head">
              <tr>
                <th className="erp-table-head-cell label-text">Sl. No.</th>
                <th className="erp-table-head-cell label-text erp-table-align-right">Amount</th>
                <th className="erp-table-head-cell label-text">Receipt Date</th>
                <th className="erp-table-head-cell label-text">Receipt No.</th>
                <th className="erp-table-head-cell label-text">Particulars</th>
                <th className="erp-table-head-cell label-text erp-table-align-center">Action</th>
              </tr>
            </thead>
            <tbody className="erp-table-body">
              {rows.map((row) => (
                <tr key={`${row.receiptNo}-${row.slNo}`} className="erp-table-row">
                  <td className="erp-table-cell">{row.slNo}</td>
                  <td className="erp-table-cell erp-table-align-right">{row.amount}</td>
                  <td className="erp-table-cell">{row.date}</td>
                  <td className="erp-table-cell">{row.receiptNo}</td>
                  <td className="erp-table-cell">{row.particulars}</td>
                  <td className="erp-table-cell erp-table-align-center">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="comp-btn-primary min-h-0 rounded px-2.5 py-1 text-xs font-semibold"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && !error ? (
                <tr className="erp-table-row">
                  <td colSpan={6} className="erp-table-cell py-8 text-center italic" style={{ color: 'var(--comp-text-muted)' }}>
                    No payment receipts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </ErpPageShell>
  );
}
