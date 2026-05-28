import { useState, useEffect } from "react";
import { executePipeline, type FeeDuesModel } from "../../lib/erpTransformers";
// ErpPageShell section-card; fee table structure unchanged.
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";

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
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {data && (
        <section className="dashboard-card space-y-4 p-6">

          {data.noDues ? (
            <div className="space-y-4">
              <div className="flex min-h-40 items-center justify-center rounded-2xl px-6 text-center" style={{ border: '1px solid var(--success)', background: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--success)' }}>Status</p>
                  <p className="text-3xl font-black" style={{ color: 'var(--comp-text-primary)' }}>No fee dues.</p>
                  <p className="mx-auto max-w-2xl text-sm leading-6" style={{ color: 'var(--comp-text-secondary)' }}>
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
            <div className="space-y-8">
              <div className="erp-table-shell">
                <table className="erp-table text-left">
                  <thead className="erp-table-head">
                    <tr>
                      <th className="erp-table-head-cell label-text">Fee Category</th>
                      <th className="erp-table-head-cell label-text">Fee Head</th>
                      <th className="erp-table-head-cell label-text erp-table-align-right">Due Amount (INR)</th>
                      <th className="erp-table-head-cell label-text erp-table-align-right">Collected (INR)</th>
                      <th className="erp-table-head-cell label-text erp-table-align-right">To be Paid (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {data.records.map((r, i) => {
                      const isTotalRow = /total/i.test(r.category) && !r.head;
                      return (
                        <tr key={i}
                          className={`erp-table-row${isTotalRow ? ' erp-table-row-total' : ''}`}
                          style={isTotalRow ? { background: 'color-mix(in srgb, var(--comp-accent) 8%, transparent)', borderTop: '1.5px solid color-mix(in srgb, var(--comp-accent) 40%, transparent)' } : {}}
                        >
                          <td className={`erp-table-cell erp-table-cell-strong${isTotalRow ? ' font-bold' : ''}`}
                            style={isTotalRow ? { color: 'var(--comp-accent)' } : {}}
                          >{r.category}</td>
                          <td className="erp-table-cell">{r.head}</td>
                          <td className="erp-table-cell erp-table-align-right font-medium" style={{ color: isTotalRow ? 'var(--comp-accent)' : 'var(--comp-text-primary)' }}>{r.dueAmount}</td>
                          <td className="erp-table-cell erp-table-align-right font-medium" style={{ color: isTotalRow ? 'var(--comp-accent)' : 'var(--comp-text-primary)' }}>{r.collectedAmount}</td>
                          <td className="erp-table-cell erp-table-align-right font-bold" style={{ color: isTotalRow ? 'var(--comp-accent)' : 'var(--success)' }}>{r.toBePaidAmount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-5 border-t border-[color-mix(in_srgb,var(--border)_40%,transparent)] pt-6">
                <div className="flex items-start gap-4 rounded-xl border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] p-5">
                  <div className="mt-0.5 shrink-0" style={{ color: 'var(--comp-accent)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--comp-accent)' }}>
                      Action Required: Official Portal Checkout
                    </h3>
                    <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--comp-text-secondary)' }}>
                      To ensure secure transaction processing, all online fee payments must be completed through the official university ERP portal. Please log in to the main website to clear your outstanding dues.
                    </p>
                  </div>
                </div>

                {notes.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                )}
                
                {notes.length === 0 && (
                  <div className="rounded-xl p-4 text-sm leading-6 shadow-sm" style={{ background: 'color-mix(in srgb, var(--comp-text-primary) 3%, transparent)', color: 'var(--comp-text-secondary)', border: '1px solid color-mix(in srgb, var(--comp-text-primary) 8%, transparent)' }}>
                    <p className="font-medium" style={{ color: 'var(--comp-text-primary)' }}>Important Note on Payments</p>
                    <p className="mt-1">
                      You will be allowed to make the Tuition Fees payment once the other old dues are cleared. To verify the current status of your online Payment Gateway transaction, where the status was not updated and amount was deducted from your bank account, please go through the navigation: <strong style={{ color: 'var(--comp-text-primary)' }}>Finance &raquo; Online Payment Verification</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </ErpPageShell>
  );
}
