/**
 * DocumentErpPage — Generic renderer for ERP pages that return tabular data.
 *
 * Used for registration, settings, and other pages that don't have a custom typed component.
 * Renders title + text + tables[] directly from the adaptToLegacyPayload shape.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, type ErpPageResponse, getErpBatch } from "../../lib/erp/index";
import { extractSections, sanitizeText } from "../../lib/erp/sanitize";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";

type Props = {
  blueprint: PageBlueprint;
};

type TableRow = Record<string, string>;


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
          failures.push(sanitizeText((result as any)?.error) || `Failed to load ${key}`);
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
            <div key={i} className="space-y-3">
              {section.title && (
                <h2 className="text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  {section.title}
                </h2>
              )}
              {/* Only show text when there are no tables — otherwise text is usually a
                  concatenated dump of the same table data */}
              {section.text && section.tables.length === 0 && (
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
        <EmptyState
          title="No content available"
          description="This page doesn't have any data to display right now. Try refreshing or check back later."
        />
      )}
    </ErpPageShell>
  );
}
