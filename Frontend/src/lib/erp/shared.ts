import { sanitizeErpDisplayText } from "../erpDisplayText";
import type { ErpGenericTable } from "./types";

export function normalizeRawValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const cleaned = sanitizeErpDisplayText(value, fallback);
    return cleaned || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Objects and arrays are NOT displayable — return fallback, not [object Object]
  return fallback;
}

// ---------------------------------------------------------------------------
// 2. ATTENDANCE TRANSFORMER
// ---------------------------------------------------------------------------

export function readBundledPageData(rawData: unknown, pageKey: string): unknown {
  if (!rawData || typeof rawData !== "object") return rawData;

  const root = rawData as Record<string, unknown>;
  const pagePayload = root[pageKey];

  if (pagePayload && typeof pagePayload === "object" && "data" in pagePayload) {
    return (pagePayload as { data?: unknown }).data;
  }

  return pagePayload ?? rawData;
}

export function sectionTitleFromKey(key: string, fallback: string) {
  return normalizeRawValue(key)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || fallback;
}

export function extractGenericTables(rawData: unknown, fallbackTitle: string): ErpGenericTable[] {
  const tables: ErpGenericTable[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown, titleHint: string) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.tables)) {
      record.tables.forEach((table, tableIndex) => {
        if (!Array.isArray(table)) return;

        const rows = table
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
          .map((row) =>
            Object.fromEntries(
              Object.entries(row)
                .map(([key, cell]) => [key, normalizeRawValue(cell)])
                .filter(([, cell]) => cell && cell !== "-")
            )
          )
          .filter((row) => Object.keys(row).length > 0);

        if (!rows.length) return;

        const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
        if (!columns.length) return;

        const title = normalizeRawValue(record.title) || titleHint || fallbackTitle;
        const signature = `${title}::${tableIndex}::${columns.join("|")}::${rows.length}`;
        if (seen.has(signature)) return;
        seen.add(signature);

        tables.push({ title, columns, rows });
      });
    }

    Object.entries(record).forEach(([key, child]) => {
      if (key === "tables") return;
      visit(child, sectionTitleFromKey(key, fallbackTitle));
    });
  };

  visit(rawData, fallbackTitle);
  return tables;
}

export function normalizeRawCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}
