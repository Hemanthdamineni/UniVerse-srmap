import { useEffect, useState } from "react";
import { executePipeline, type FeesPaidModel } from "../../lib/erpTransformers";
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";

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
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading fees paid..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="dashboard-card overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold text-[#0A3035]">Payment Receipts</h3>
        </div>
        <div className="erp-table-shell rounded-none border-0 shadow-none">
          <table className="erp-table w-full text-left">
            <thead className="erp-table-head">
              <tr>
                <th className="erp-table-head-cell">Sl. No.</th>
                <th className="erp-table-head-cell erp-table-align-right">Amount</th>
                <th className="erp-table-head-cell">Receipt Date</th>
                <th className="erp-table-head-cell">Receipt No.</th>
                <th className="erp-table-head-cell">Particulars</th>
                <th className="erp-table-head-cell erp-table-align-center">Action</th>
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
                      className="rounded bg-[#0A3035] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#0A3035]/90"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && !error ? (
                <tr className="erp-table-row">
                  <td colSpan={6} className="erp-table-cell py-8 text-center italic text-[var(--text-secondary)]">
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
