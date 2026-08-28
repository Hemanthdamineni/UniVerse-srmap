import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { executePipeline, type BankDetailsModel } from "../../lib/erp/erpTransformers";
import { getErpBatch, executeErpAction } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { FileUploadZone } from "../../components/ui/FileUploadZone";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data:mime;base64, prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BankDetailsPage({ blueprint }: Props) {
  const [data, setData] = useState<BankDetailsModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Form state
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load bank details.");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
      const mainKey = blueprint.fetchKeys[0];
      const rawData = (batch[mainKey] as any)?.data;

      if (!rawData) {
        throw new Error("No data found for bank details.");
      }

      const pipelineResult = executePipeline("bank-details", rawData);
      if (!pipelineResult.isValid || !pipelineResult.data) {
        throw new Error("Unable to parse bank details.");
      }

      setError(null);
      setData(pipelineResult.data as BankDetailsModel);
    } catch (err: any) {
      setError(err.message || "Failed to load bank details.");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

  // Initialize form values when data loads
  useEffect(() => {
    if (data?.fields) {
      const values: Record<string, string> = {};
      for (const field of data.fields) {
        values[field.label] = field.value || "";
      }
      setFormValues(values);
    }
  }, [data]);

  const handleFieldChange = (label: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [label]: value }));
    setSubmitResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      let filePayload: Record<string, unknown> = {};
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        filePayload = {
          _fileBuffer: base64,
          _fileName: selectedFile.name,
          _fileMimeType: selectedFile.type,
        };
      }

      const result = await executeErpAction({
        pageKey: blueprint.fetchKeys[0] || "finance/bank-account-details",
        actionId: "bank-details-save",
        actionPayload: {
          beneficiaryName: formValues["Beneficiary Name"] || "",
          accountNumber: formValues["Beneficiary Account Number"] || "",
          bankName: formValues["Bank Name"] || "",
          branchName: formValues["Bank Branch name"] || "",
          ifscCode: formValues["IFSC Code"] || "",
          accountOwnerRelation: formValues["Account owner relationship"] || "",
          accountOwnerContact: formValues["Account owner Contact number"] || "",
          ...filePayload,
        },
      });

      setSubmitResult({
        success: result.success,
        message: result.message || (result.success ? "Bank details saved successfully." : "Couldn't save your bank details. Please try again."),
      });
    } catch (err: any) {
      setSubmitResult({
        success: false,
        message: err.message || "Couldn't save your bank details. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fields = data?.fields || [];

  // Group fields into two columns
  const leftFields = fields.filter((_, i) => i % 2 === 0);
  const rightFields = fields.filter((_, i) => i % 2 === 1);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading bank details..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError
          message={error}
          onRetry={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {!error && fields.length === 0 && !loading && (
        <EmptyState
          title="No bank details available"
          description="No bank account information found. Please try again later."
        />
      )}

      {!error && fields.length > 0 && (
        <form onSubmit={handleSubmit} className="dashboard-card space-y-6 p-4 md:p-6">
          {/* Form header */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--comp-accent) 12%, var(--background))" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--comp-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                Account Information
              </h2>
              <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                Fill in your bank details below. Fields marked with * are required.
              </p>
            </div>
          </div>

          {/* Two-column form grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left column */}
            <div className="space-y-4">
              {leftFields.map((field) => (
                <FormField
                  key={field.label}
                  field={field}
                  value={formValues[field.label] || ""}
                  onChange={(v) => handleFieldChange(field.label, v)}
                  disabled={submitting}
                />
              ))}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {rightFields.map((field) => (
                <FormField
                  key={field.label}
                  field={field}
                  value={formValues[field.label] || ""}
                  onChange={(v) => handleFieldChange(field.label, v)}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>

          {/* File upload for Cancelled Cheque / Passbook */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
              Cancelled Cheque / First page of Passbook
            </label>
            <FileUploadZone
              onFile={(file) => {
                setSelectedFile(file);
                setSubmitResult(null);
              }}
              accept={["image/*", ".pdf"]}
              maxSizeMb={5}
              currentFile={selectedFile ? { name: selectedFile.name, size: selectedFile.size } : undefined}
            />
            <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
              Upload a scanned copy of your cancelled cheque or first page of passbook. Max 5MB.
            </p>
          </div>

          {/* Submit result */}
          {submitResult && (
            <div
              className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: submitResult.success
                  ? "color-mix(in srgb, var(--success) 30%, transparent)"
                  : "color-mix(in srgb, var(--error) 30%, transparent)",
                background: submitResult.success
                  ? "color-mix(in srgb, var(--success) 8%, var(--background))"
                  : "color-mix(in srgb, var(--error) 8%, var(--background))",
                color: submitResult.success ? "var(--success)" : "var(--error)",
              }}
            >
              {submitResult.success ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              <span>{submitResult.message}</span>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="comp-btn-primary min-h-[42px]"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Bank Details
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </ErpPageShell>
  );
}

// ── Form field component ──────────────────────────────────────────────────

function FormField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: { label: string; value: string; fieldType: string; options?: Array<{ value: string; label: string }> };
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const isSelect = field.fieldType === "select" && field.options?.length;
  const isFile = field.fieldType === "file";

  if (isFile) {
    // File upload is handled separately in the parent form
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
        {field.label}
      </label>
      {isSelect ? (
        <select disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
          style={{
            borderColor: "color-mix(in srgb, var(--comp-border) 60%, transparent)",
            background: "var(--comp-surface)",
            color: "var(--comp-text-primary)",
          }}
        >
          <option value="">Select...</option>
          {field.options!.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input disabled={disabled}
          type={field.fieldType === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
          style={{
            borderColor: "color-mix(in srgb, var(--comp-border) 60%, transparent)",
            background: "var(--comp-surface)",
            color: "var(--comp-text-primary)",
          }}
        />
      )}
    </div>
  );
}
