import { useState, useEffect } from "react";
import { executePipeline, type FeeDuesModel } from "../../lib/erpTransformers";
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";

import { ErpPageShell } from "../../components/erp/ErpPrimitives";

interface Props {
  blueprint: PageBlueprint;
}

function extractFeeDueNotes(rawData: unknown) {
  const section =
    rawData && typeof rawData === "object"
      ? (rawData as Record<string, unknown>).Finance &&
        typeof (rawData as Record<string, unknown>).Finance === "object"
        ? ((rawData as Record<string, unknown>).Finance as Record<string, unknown>)["Fee Due Details"]
        : rawData
      : null;

  const text =
    section && typeof section === "object" && typeof (section as Record<string, unknown>).text === "string"
      ? (section as Record<string, unknown>).text
      : "";

  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  return Array.from(normalized.matchAll(/Note\s*:?\s*(.*?)(?=\s+Note\s*:|$)/gi))
    .map((match) => String(match[1] || "").trim())
    .filter(Boolean)
    .filter((note) => note.length > 20)
    .slice(0, 3);
}

export default function FeeDuesPage({ blueprint }: Props) {
  const [data, setData] = useState<FeeDuesModel | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
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

        const mainKey = blueprint.fetchKeys[0];
        const rawData = (batch[mainKey] as any)?.data;
        
        if (!rawData) {
          throw new Error("No data found for fee dues.");
        }

        const pipelineResult = executePipeline("finance-dues", rawData);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          throw new Error("Validation failed for fee dues data.");
        }

        setData(pipelineResult.data as FeeDuesModel);
        setNotes(extractFeeDueNotes(rawData));
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load fee dues");
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
      loadingMessage={blueprint.loadingMessage || "Loading fee dues..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <section className="dashboard-card space-y-4 p-6">

          {data.noDues ? (
            <div className="space-y-4">
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/90 px-6 text-center">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Status</p>
                  <p className="text-3xl font-black text-emerald-800">No fee dues.</p>
                  <p className="mx-auto max-w-2xl text-sm leading-6 text-emerald-700/90">
                    Your current finance ledger does not show any outstanding dues.
                  </p>
                </div>
              </div>

              {notes.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {notes.map((note, index) => (
                    <div
                      key={`${index}-${note.slice(0, 32)}`}
                      data-page-contrast="true"
                      className="page-contrast-fg rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-4 text-sm leading-6 shadow-sm"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="erp-table-shell">
              <table className="erp-table text-left">
                <thead className="erp-table-head">
                  <tr>
                    <th className="erp-table-head-cell">Fee Category</th>
                    <th className="erp-table-head-cell">Fee Head</th>
                    <th className="erp-table-head-cell erp-table-align-right">Due Amount (INR)</th>
                    <th className="erp-table-head-cell erp-table-align-right">Collected (INR)</th>
                    <th className="erp-table-head-cell erp-table-align-right">To be Paid (INR)</th>
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {data.records.map((r, i) => (
                    <tr key={i} className="erp-table-row">
                      <td className="erp-table-cell erp-table-cell-strong">{r.category}</td>
                      <td className="erp-table-cell">{r.head}</td>
                      <td className="erp-table-cell erp-table-align-right font-medium text-slate-800">{r.dueAmount}</td>
                      <td className="erp-table-cell erp-table-align-right font-medium text-slate-800">{r.collectedAmount}</td>
                      <td className="erp-table-cell erp-table-align-right font-bold text-emerald-700">{r.toBePaidAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ErpPageShell>
  );
}
