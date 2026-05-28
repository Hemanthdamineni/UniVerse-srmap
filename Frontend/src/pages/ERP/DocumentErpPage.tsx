/**
 * DocumentErpPage — Thin wrapper for ERP pages that render via ErpDocumentRenderer.
 *
 * Replaces MappedErpPage for "behaviour pages" (registration, feedback, forms)
 * that need the full document tree with interactive form/button rendering.
 *
 * Flow: fetch batch → extract documents → combine → pass to ErpDocumentRenderer.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  type ErpDocument,
  type ErpPageResponse,
  getErpBatch,
} from "../../lib/erpApi";
import { buildCombinedDocumentForKeys } from "../../lib/erpDocumentUtils";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";
import ErpDocumentRenderer from "../../components/erp/ErpDocumentRenderer";

type Props = {
  blueprint: PageBlueprint;
};

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  return String(value ?? "");
}

export default function DocumentErpPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responsesByKey, setResponsesByKey] = useState<Record<string, ErpPageResponse>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const pageKeys = blueprint.fetchKeys;
  const pageTitle = blueprint.heading;

  const loadPage = useCallback(async (): Promise<ErpDocument | null> => {
    setLoading(true);
    setError(null);

    try {
      if (pageKeys.length === 0) {
        throw new ApiError("No ERP fetch keys configured for this page.", 500, "NO_FETCH_KEYS", false);
      }

      const batch = await getErpBatch(pageKeys);
      const successfulByKey: Record<string, ErpPageResponse> = {};
      const failures: Array<{ pageKey: string; error: string }> = [];

      for (const key of pageKeys) {
        const result = batch[key];
        if (!result) {
          failures.push({ pageKey: key, error: "Batch response missing this key." });
          continue;
        }

        if (result && typeof result === "object" && "success" in result && (result as any).success === false) {
          failures.push({
            pageKey: key,
            error: cleanText((result as any).error) || "Failed to load ERP key",
          });
          continue;
        }

        successfulByKey[key] = result as ErpPageResponse;
      }

      if (Object.keys(successfulByKey).length === 0) {
        const firstFailure = failures[0];
        throw new ApiError(
          firstFailure?.error || "Failed to load ERP page",
          500,
          "INTERNAL_ERROR",
          false
        );
      }

      setResponsesByKey(successfulByKey);

      return buildCombinedDocumentForKeys(pageKeys, successfulByKey, pageTitle);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : (err instanceof Error ? err.message : "Failed to load page");
      setError(message);
      setResponsesByKey({});
      return null;
    } finally {
      setLoading(false);
    }
  }, [pageKeys, pageTitle]);

  useEffect(() => {
    loadPage();
  }, [loadPage, refreshTrigger]);

  const document = useMemo(() => {
    return buildCombinedDocumentForKeys(pageKeys, responsesByKey, pageTitle);
  }, [pageKeys, responsesByKey, pageTitle]);

  const refreshDocument = useCallback(async (): Promise<ErpDocument | null> => {
    return loadPage();
  }, [loadPage]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <ErpPageShell
      title={pageTitle}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || `Loading ${pageTitle.toLowerCase()}...`}
      onRefresh={handleRefresh}
    >
      {error && (
        <InlineError message={error} onRetry={handleRefresh} />
      )}

      {document && (
        <section className="space-y-4">
          <ErpDocumentRenderer
            document={document}
            refreshDocument={refreshDocument}
          />
        </section>
      )}

      {!document && !loading && !error && (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--border)_55%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-6 text-center">
          <p className="text-sm text-[var(--comp-text-secondary)]">No content available for this page.</p>
        </div>
      )}
    </ErpPageShell>
  );
}
