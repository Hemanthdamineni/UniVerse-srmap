import { useEffect, useState } from "react";
import { executePipeline, type BankDetailsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

export default function BankDetailsPage({ blueprint }: Props) {
  const [data, setData] = useState<BankDetailsModel | null>(null);
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
          throw new Error("No data found for bank details.");
        }

        const pipelineResult = executePipeline("bank-details", rawData);
        if (!pipelineResult.isValid || !pipelineResult.data) {
          throw new Error("Unable to parse bank details.");
        }

        setData(pipelineResult.data as BankDetailsModel);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load bank details.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [blueprint, refreshTrigger]);

  const fields = data?.fields || [];
  const isForm = data?.isForm;

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading bank details..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {/* Form page: bank details is an input form on the ERP */}
      {data && isForm && (
        <section className="dashboard-card p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}
            >
              🏦
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>
                Bank Details Form
              </h3>
              <p className="text-sm leading-6" style={{ color: 'var(--comp-text-secondary)' }}>
                This page is an input form on the ERP portal where you can register or update your bank
                account details for refund processing. The form requires your beneficiary name, account
                number, bank name, IFSC code, and a cancelled cheque or passbook copy.
              </p>
            </div>
          </div>
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--comp-border)',
              background: 'color-mix(in srgb, var(--surface) 60%, transparent)',
              color: 'var(--comp-text-secondary)',
            }}
          >
            <p className="font-medium mb-1" style={{ color: 'var(--comp-text-primary)' }}>Fields required:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Beneficiary Name</li>
              <li>Beneficiary Account Number</li>
              <li>Bank Name &amp; Branch</li>
              <li>IFSC Code</li>
              <li>Account Owner Relationship &amp; Contact Number</li>
              <li>Cancelled Cheque / First page of Passbook (attachment)</li>
            </ul>
          </div>
          <p className="text-xs" style={{ color: 'var(--comp-text-muted)' }}>
            To fill in your bank details, please visit the Student ERP portal directly under Finance → Bank Details.
          </p>
        </section>
      )}

      {/* Data display: bank details are already saved */}
      {data && !isForm && fields.length > 0 && (
        <section className="dashboard-card overflow-hidden p-0">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--comp-border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Account Information</h3>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--comp-border)' }}>
            {fields.map((field, index) => (
              <div key={`${field.label}-${index}`} className="flex items-center gap-4 px-5 py-3.5">
                <span className="min-w-[180px] shrink-0 text-sm font-medium" style={{ color: 'var(--comp-text-secondary)' }}>
                  {field.label}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--comp-text-primary)' }}>
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data && !isForm && fields.length === 0 && !loading && !error && (
        <div className="flex min-h-40 items-center justify-center rounded-2xl px-6 text-center" style={{ border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--surface) 80%, transparent)' }}>
          <p className="text-sm" style={{ color: 'var(--comp-text-muted)' }}>No bank details available.</p>
        </div>
      )}
    </ErpPageShell>
  );
}
