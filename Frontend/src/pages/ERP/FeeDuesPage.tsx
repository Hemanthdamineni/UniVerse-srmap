import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { executePipeline, type FeeDuesModel } from "../../lib/erp/erpTransformers";
// ErpPageShell section-card; fee table structure unchanged.
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell, TableCardHeader } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { ClearanceCard } from "../../components/ui/ClearanceCard";

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

function FinanceClearanceCard({ notes }: { notes: string[] }) {
  return (
    <ClearanceCard
      title="No fee dues"
      description="Your current finance ledger is clear with no outstanding dues."
      notes={notes}
      className="dashboard-card space-y-4 p-5"
    />
  );
}

export default function FeeDuesPage({ blueprint }: Props) {
  const [notes, setNotes] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  const [data, setData] = useState<FeeDuesModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load fee dues");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
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
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load fee dues");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

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

      {!error && !loading && !data && (
        <EmptyState title="No fee information available" description="Fee due data is currently unavailable." />
      )}

      {data && data.noDues && <FinanceClearanceCard notes={notes} />}

      {data && !data.noDues && data.records.length === 0 && (
        <EmptyState title="No pending fee dues" description="You have no outstanding fee dues recorded. Check your fees paid history." />
      )}

      {data && !data.noDues && data.records.length > 0 && (
        <>
          <section className="dashboard-card overflow-hidden p-0">
            <TableCardHeader title="Fee Due Details" />
            <div className="erp-table-shell rounded-none border-0 shadow-none">
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
          </section>

          <section className="dashboard-card overflow-hidden p-0">
            <TableCardHeader title="Payment Information" />
            <div className="space-y-4 px-5 py-4">
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
          </section>
        </>
      )}
    </ErpPageShell>
  );
}
