/**
 * DocumentErpPage — Generic renderer for ERP pages that return tabular data.
 *
 * Used for registration, settings, and other pages that don't have a custom typed component.
 * Renders title + text + tables[] directly from the adaptToLegacyPayload shape.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, type ErpPageResponse, getErpBatch } from "../../lib/erp/index";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

type TableRow = Record<string, string>;

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return String(value ?? "");
}

function extractSections(responsesByKey: Record<string, ErpPageResponse>) {
  const sections: Array<{ title: string; text: string; tables: TableRow[][] }> = [];

  for (const resp of Object.values(responsesByKey)) {
    const data = resp?.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") continue;

    const title = cleanText(data.title);
    const text = cleanText(data.text);
    const raw = data.tables;
    const tables: TableRow[][] = Array.isArray(raw)
      ? (raw as unknown[]).filter(Array.isArray).map((t) =>
          (t as unknown[]).filter((r): r is TableRow => !!r && typeof r === "object")
        )
      : [];

    if (title || text || tables.some((t) => t.length > 0)) {
      sections.push({ title, text, tables });
    }
  }

  return sections;
}

function SimpleTable({ rows }: { rows: TableRow[] }) {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="erp-table-shell overflow-x-auto">
      <table className="erp-table">
        <thead className="erp-table-head">
          <tr>
            {columns.map((col) => (
              <th key={col} className="erp-table-head-cell label-text">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="erp-table-body">
          {rows.map((row, i) => (
            <tr key={i} className="erp-table-row">
              {columns.map((col) => (
                <td key={col} className="erp-table-cell">
                  {row[col] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocumentErpPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responsesByKey, setResponsesByKey] = useState<Record<string, ErpPageResponse>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const pageKeys = blueprint.fetchKeys;
  const pageTitle = blueprint.heading;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (pageKeys.length === 0) {
        throw new ApiError("No ERP fetch keys configured for this page.", 500, "NO_FETCH_KEYS", false);
      }

      const batch = await getErpBatch(pageKeys);
      const successful: Record<string, ErpPageResponse> = {};
      const failures: string[] = [];

      for (const key of pageKeys) {
        const result = batch[key];
        if (!result || (result as any).success === false) {
          failures.push(cleanText((result as any)?.error) || `Failed to load ${key}`);
        } else {
          successful[key] = result as ErpPageResponse;
        }
      }

      if (Object.keys(successful).length === 0) {
        throw new ApiError(failures[0] || "Failed to load ERP page", 500, "INTERNAL_ERROR", false);
      }

      setResponsesByKey(successful);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to load page";
      setError(message);
      setResponsesByKey({});
    } finally {
      setLoading(false);
    }
  }, [pageKeys]);

  useEffect(() => {
    loadPage();
  }, [loadPage, refreshTrigger]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const sections = extractSections(responsesByKey);
  const hasContent = sections.length > 0;

  return (
    <ErpPageShell
      title={pageTitle}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || `Loading ${pageTitle.toLowerCase()}...`}
      onRefresh={handleRefresh}
    >
      {error && <InlineError message={error} onRetry={handleRefresh} />}

      {hasContent && (
        <div className="space-y-8">
          {sections.map((section, i) => (
            <div key={i} className="space-y-4">
              {section.title && (
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--comp-text-primary)" }}>
                  {section.title}
                </h2>
              )}
              {section.text && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--comp-text-secondary)" }}>
                  {section.text}
                </p>
              )}
              {section.tables.map((rows, ti) => (
                <SimpleTable key={ti} rows={rows} />
              ))}
            </div>
          ))}
        </div>
      )}

      {!hasContent && !loading && !error && (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-6 text-center">
          <p className="text-sm text-[var(--comp-text-secondary)]">No content available for this page.</p>
        </div>
      )}
    </ErpPageShell>
  );
}
