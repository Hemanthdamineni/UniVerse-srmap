import { sanitizeErpDisplayText } from "./displayText";
import type { ErpGenericTable } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// _extracted fast-path utilities
//
// When a targeted backend extractor processes a page, it embeds its typed
// output in `payload._extracted`. These utilities read that field so frontend
// transformers can read typed data directly.
// ---------------------------------------------------------------------------

/**
 * Read the `_extracted` typed payload from a page response.
 * Returns null if no targeted extractor ran for this page.
 */
export function readExtracted(pageData: unknown): Record<string, unknown> | null {
  if (!pageData || typeof pageData !== "object") return null;
  const payload = pageData as Record<string, unknown>;

  // Fast path 1: _extracted at top level (adaptToLegacyPayload result passed directly)
  if (payload._extracted && typeof payload._extracted === "object" && !Array.isArray(payload._extracted)) {
    return payload._extracted as Record<string, unknown>;
  }

  // Fast path 2: nested under .data at top level
  // (ErpPageResponse where data = adaptToLegacyPayload result with _extracted embedded)
  const data = payload.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data._extracted && typeof data._extracted === "object" && !Array.isArray(data._extracted)) {
      return data._extracted as Record<string, unknown>;
    }

    // Path 3: grouped ERP blob under .data wrapper
    // scrapeByKey returns { Dropdown: { Subitem: { _extracted, ... } } }
    // and getBatch wraps each page's result in { success, pageKey, data: { ... } }
    const found = findGroupedExtracted(data);
    if (found) return found;
  }

  // Path 4: grouped ERP blob at the top level (no .data wrapper)
  // Used when a component receives the inner .data value directly,
  // e.g. Dashboard extracts timetableData = batch["academic/time-table"]?.data
  // which is already { "Academic": { "Time Table": { ..._extracted } } }
  const found = findGroupedExtracted(payload);
  if (found) return found;

  return null;
}

/**
 * Search a grouped ERP blob for the first _extracted field.
 * grouped ERP shape: { Dropdown: { Subitem: { _extracted, ... } } }
 */
function findGroupedExtracted(
  root: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const section of Object.values(root)) {
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    const sectionRecord = section as Record<string, unknown>;
    for (const subsection of Object.values(sectionRecord)) {
      if (!subsection || typeof subsection !== "object" || Array.isArray(subsection)) continue;
      const sub = subsection as Record<string, unknown>;
      if (sub._extracted && typeof sub._extracted === "object" && !Array.isArray(sub._extracted)) {
        return sub._extracted as Record<string, unknown>;
      }
    }
  }
  return null;
}

/**
 * Read `_extracted` for a specific bundled page key.
 * Used when a single transformer consumes multiple bundled pages.
 *
 * Handles two shapes:
 *   V2 batch response: rawData[pageKey] = { success: true, data: { Dropdown: { Subitem: { _extracted } } } }
 *   Direct payload:    rawData[pageKey] = { _extracted: ... }  (or a grouped blob already at pagePayload level)
 */
export function readExtractedPage(rawData: unknown, pageKey: string): Record<string, unknown> | null {
  if (!rawData || typeof rawData !== "object") return null;
  const root = rawData as Record<string, unknown>;
  const pagePayload = root[pageKey];
  if (!pagePayload || typeof pagePayload !== "object") return null;

  // V2 batch response wrapper: { success: true, data: groupedErpBlob, ... }
  // Unwrap .data so readExtracted can search the grouped structure.
  const pp = pagePayload as Record<string, unknown>;
  if (pp.success === true && pp.data && typeof pp.data === "object" && !Array.isArray(pp.data)) {
    return readExtracted(pp.data);
  }

  return readExtracted(pagePayload);
}
