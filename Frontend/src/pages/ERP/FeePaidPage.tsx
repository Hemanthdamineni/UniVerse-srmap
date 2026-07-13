import { useEffect, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { executeErpAction, getErpBatch } from "../../lib/erp/index";
import { executePipeline, type FeePaidSectionRow, type FeesPaidModel } from "../../lib/erp/erpTransformers";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

type PrintTarget = {
  key: string;
  pageKey: string;
  actionId: string;
  receiptId: string;
};

export default function FeePaidPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FeesPaidModel | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  async function handlePrintReceipt(target: PrintTarget) {
    setPrintingId(target.key);
    try {
      const response = await executeErpAction({
        pageKey: target.pageKey,
        actionId: target.actionId,
        url: `/srmapstudentcorner/students/report/receiptgenerationprint.jsp?receiptid=${target.receiptId}`,
        method: "GET"
      });

      if (response.html) {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(response.html);
          win.document.close();
          win.focus();
          setTimeout(() => {
            win.print();
          }, 500);
        } else {
          alert("Please allow popups to print receipts.");
        }
      } else {
        alert(response.message || "Failed to fetch printable receipt.");
      }
    } catch (err) {
      alert("Error printing receipt: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPrintingId(null);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const batch = await getErpBatch(blueprint.fetchKeys);
        if (!active) return;

        const rawData = Object.fromEntries(
          blueprint.fetchKeys.map((key) => [
            key,
            batch[key] || {
              success: false,
              pageKey: key,
              error: "Source was not returned by the ERP batch endpoint.",
              status: 502,
              code: "ERP_BATCH_SOURCE_MISSING",
            },
          ])
        );

        const hasAnyLoadedSource = Object.values(rawData).some(
          (value) => value && typeof value === "object" && (value as { success?: boolean }).success !== false
        );

        if (!hasAnyLoadedSource) {
          throw new Error("No data found for fees paid.");
        }

        const pipelineResult = executePipeline("finance-paid", rawData);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          // If the pipeline says it's invalid, we show no rows rather than crashing
          setData({
            title: blueprint.heading,
            records: [],
            sections: [],
            sources: [],
            duplicates: [],
            warnings: pipelineResult.errors,
            integrity: {
              sourceCount: 0,
              rawRowCount: 0,
              extractedRowCount: 0,
              deduplicatedRowCount: 0,
              duplicateCount: 0,
              warningCount: pipelineResult.errors.length,
            },
          });
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

  const warnings = data?.warnings || [];

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading fees paid..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error ? (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      ) : null}

      {!error && warnings.length > 0 ? (
        <section
          className="dashboard-card border p-4"
          style={{ borderColor: "rgba(245, 158, 11, 0.35)", background: "rgba(245, 158, 11, 0.08)" }}
          aria-label="Fee paid source warnings"
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
            Partial finance data warning
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--comp-text-muted)" }}>
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Source extraction trace removed */}

      {data?.sections && data.sections.length > 0 ? (
        <div className="space-y-8">
          {data.sections.map((section) => {
            const hasPrintAction = section.rows.some(
              (r) => r.printActionId && r.printReceiptId
            );
            const dataCols = section.columns.filter(
              (col) =>
                !(
                  col.key.startsWith("col") &&
                  section.rows.every(
                    (r) =>
                      !r.cells[col.key] ||
                      r.cells[col.key].toLowerCase() === "print"
                  )
                )
            );
            const colCount = dataCols.length + (hasPrintAction ? 1 : 0);

  const warnings = data?.warnings || [];

  return (
              <section key={section.sourcePageKey} className="dashboard-card overflow-hidden p-0">
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--comp-border)' }}>
                  <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>{section.sourceLabel}</h3>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--comp-text-muted)' }}>
                    {section.rows.length} receipt{section.rows.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="erp-table-shell rounded-none border-0 shadow-none overflow-x-auto">
                  <table className="erp-table w-full text-left">
                    <thead className="erp-table-head">
                      <tr>
                        {dataCols.map((col) => (
                          <th key={col.key} className="erp-table-head-cell label-text whitespace-nowrap px-4">
                            {col.label}
                          </th>
                        ))}
                        {hasPrintAction ? (
                          <th className="erp-table-head-cell label-text text-center w-[80px]">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="erp-table-body">
                      {section.rows.map((row, ri) => (
                        <tr key={row.stableKey || ri} className="erp-table-row">
                          {dataCols.map((col) => (
                            <td key={col.key} className="erp-table-cell whitespace-nowrap px-4">
                              {row.cells[col.key] || ""}
                            </td>
                          ))}
                          {hasPrintAction && row.printActionId && row.printReceiptId ? (
                            <td className="erp-table-cell text-center">
                              <button
                                onClick={() =>
                                  handlePrintReceipt({
                                    key: row.stableKey,
                                    pageKey: section.sourcePageKey,
                                    actionId: row.printActionId!,
                                    receiptId: row.printReceiptId!,
                                  })
                                }
                                disabled={printingId === row.stableKey}
                                className="inline-flex items-center justify-center text-[11px] font-semibold tracking-wide uppercase px-3 py-1.5 rounded-md border"
                                style={{
                                  borderColor: 'var(--comp-border)',
                                  backgroundColor: printingId === row.stableKey ? 'transparent' : 'var(--comp-bg-elevated, #1e293b)',
                                  color: printingId === row.stableKey ? 'var(--comp-text-muted)' : 'var(--comp-text-primary)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {printingId === row.stableKey ? 'Printing...' : 'Print'}
                              </button>
                            </td>
                          ) : hasPrintAction ? (
                            <td className="erp-table-cell text-center">
                              <span className="text-xs text-muted-foreground">-</span>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      {section.rows.length === 0 ? (
                        <tr className="erp-table-row">
                          <td colSpan={colCount || 1} className="erp-table-cell py-8 text-center italic" style={{ color: 'var(--comp-text-muted)' }}>
                            No payment receipts found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : !error && !loading ? (
        <section className="dashboard-card overflow-hidden p-0">
          <div className="erp-table-shell rounded-none border-0 shadow-none overflow-x-auto">
            <table className="erp-table w-full text-left">
              <thead className="erp-table-head">
                <tr>
                  <th className="erp-table-head-cell label-text">Details</th>
                </tr>
              </thead>
              <tbody className="erp-table-body">
                <tr className="erp-table-row">
                  <td className="erp-table-cell py-8 text-center italic" style={{ color: 'var(--comp-text-muted)' }}>
                    No payment receipts found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ErpPageShell>
  );
}
