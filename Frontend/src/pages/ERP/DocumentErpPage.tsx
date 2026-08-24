/**
 * DocumentErpPage — Generic renderer for ERP pages that return tabular data.
 *
 * Used for registration, settings, and other pages that don't have a custom typed component.
 * Renders title + text + tables[] directly from the adaptToLegacyPayload shape.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, type ErpPageResponse, getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const pageKeys = blueprint.fetchKeys;
  const pageTitle = blueprint.heading;

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(pageKeys), refreshTrigger],
    queryFn: async () => {
      if (pageKeys.length === 0) {
        throw new ApiError("No ERP fetch keys configured for this page.", 500, "NO_FETCH_KEYS", false);
      }
      return getErpBatch(pageKeys);
    },
    staleTime: 60_000,
  });

  const [error, setError] = useState<string | null>(null);
  const responsesByKey: Record<string, ErpPageResponse> = useMemo(() => {
    const batch = batchQuery.data;
    if (!batch) return {};
    const successful: Record<string, ErpPageResponse> = {};
    for (const key of pageKeys) {
      const result = batch[key];
      if (!result || (result as any).success === false) {
        continue;
      }
      successful[key] = result as ErpPageResponse;
    }
    return successful;
  }, [batchQuery.data, pageKeys]);

  useEffect(() => {
    if (batchQuery.error) {
      setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load page");
      return;
    }
    if (!batchQuery.data) return;

    const failures: string[] = [];
    for (const key of pageKeys) {
      const result = batchQuery.data[key];
      if (!result || (result as any).success === false) {
        failures.push(sanitizeText((result as any)?.error) || `Failed to load ${key}`);
      }
    }

    if (Object.keys(responsesByKey).length === 0) {
      setError(failures[0] || "Failed to load ERP page");
    } else {
      setError(null);
    }
  }, [batchQuery.error, batchQuery.data, pageKeys, responsesByKey]);

  const loading = batchQuery.isPending;

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
        <div className="space-y-6">
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
