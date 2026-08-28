/**
 * ERP content sanitization and section extraction.
 *
 * Uses the existing sanitizeErpDisplayText from displayText.ts as the
 * primary text cleaner, adds section-level deduplication and garbage
 * filtering on top.
 */
import { sanitizeErpDisplayText } from "./displayText";

type TableRow = Record<string, string>;

export interface ParsedSection {
  title: string;
  text: string;
  tables: TableRow[][];
}

// ── Re-export the existing ERP text sanitizer as sanitizeText ───────────────
export { sanitizeErpDisplayText as sanitizeText };

// ── Section-level text suppression ─────────────────────────────────────────

/**
 * Returns true if the text looks like a concatenation of table header/cell
 * values rather than a human-readable description.
 *
 * Indicators:
 * - Very long (>200 chars) and contains no sentence-ending punctuation
 * - Contains the word "Print" at the end (ERP print links scraped into text)
 * - Looks like a form redirect call (contains "redirect" or "Loading...")
 * - The text starts with the title repeated (common ERP duplication)
 */
function isTableDump(text: string, title: string): boolean {
  if (!text) return false;

  // JS redirect or loading stub
  if (/redirect\w+\s*\(\s*\)/i.test(text)) return true;
  if (/Loading\.{2,}/i.test(text)) return true;

  // Text is just the title repeated
  if (title && text.toLowerCase().startsWith(title.toLowerCase()) && text.length < title.length * 2 + 30) {
    return true;
  }

  // Looks like concatenated table content: very long, ends with "Print",
  // has lots of all-caps words (column headers) or option lists
  if (text.length > 150) {
    if (/\bPrint\b\s*$/.test(text)) return true;
    if (/\[Select\s/i.test(text)) return true;
    // Count all-caps "words" (table headers) — if >30% of words are all-caps it's table noise
    const words = text.split(/\s+/).filter((w) => w.length > 2);
    const capsCount = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w)).length;
    if (words.length > 10 && capsCount / words.length > 0.3) return true;
  }

  return false;
}

/**
 * Returns true if a section has no meaningful content after sanitization.
 */
function isSectionGarbage(section: ParsedSection): boolean {
  const { title, text, tables } = section;
  const hasTables = tables.length > 0;

  // If it has tables it's always worth showing
  if (hasTables) return false;

  // Nothing at all
  if (!title && !text) return true;

  // Only text, and that text is garbage
  if (!hasTables && text && isTableDump(text, title)) return true;

  // Stub section
  if (!title && text.length < 5) return true;

  return false;
}

/**
 * Clean a table row's values using the ERP display sanitizer.
 * Also filters out rows that appear to be dropdown option dumps.
 */
function sanitizeRow(row: TableRow): TableRow | null {
  const cleaned: TableRow = {};
  let hasContent = false;

  for (const [key, val] of Object.entries(row)) {
    const sanitized = sanitizeErpDisplayText(val, "");
    // Skip rows where any cell value is a concatenated dropdown option list
    if (sanitized && /\[Select\s/i.test(sanitized)) return null;
    const monthYearCount = (sanitized.match(/(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}/gi) || []).length;
    if (monthYearCount >= 3) return null;

    cleaned[key] = sanitized || "—";
    if (sanitized) hasContent = true;
  }

  return hasContent ? cleaned : null;
}

// ── Main extraction ─────────────────────────────────────────────────────────

const NUMERIC_KEY_PATTERN = /^(?:0|[1-9]\d*)$/;

/**
 * A "degenerate" row is legacy pipeline noise rather than tabular data:
 * - numeric keys ("0", "1", …) — an array row that lost its headers, so the
 *   array indices leaked in as column names (renders as a raw "0" header)
 * - a single cell whose header echoes its own value — a notice box scraped
 *   as a one-column table
 * Returns the row's display text when degenerate, else null.
 */
function degenerateRowText(row: TableRow): string | null {
  const keys = Object.keys(row);
  if (keys.length === 0) return null;
  const values = Object.values(row)
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) return null;
  const allNumericKeys = keys.every((k) => NUMERIC_KEY_PATTERN.test(k.trim()));
  const singleEchoCell = keys.length === 1 && keys[0].trim().length > 3 && values[0] === keys[0].trim();
  if (allNumericKeys || singleEchoCell) return values.join(" ");
  return null;
}

/**
 * Extract, sanitize, and deduplicate display sections from raw ERP responses.
 */
export function extractSections(
  responsesByKey: Record<string, { data?: unknown; [key: string]: unknown }>,
): ParsedSection[] {
  const raw: ParsedSection[] = [];

  function visit(value: unknown, seen: Set<object>) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (seen.has(value)) return;
    seen.add(value);

    const record = value as Record<string, unknown>;
    const title = sanitizeErpDisplayText(record.title, "");
    const rawText = sanitizeErpDisplayText(record.text, "");
    const rawTables = record.tables;

    const tables: TableRow[][] = [];
    const tableText: string[] = [];

    if (Array.isArray(rawTables)) {
      for (const rawTable of rawTables as unknown[]) {
        if (!Array.isArray(rawTable)) continue;
        const rows = (rawTable as unknown[])
          .filter((row): row is TableRow => !!row && typeof row === "object")
          .map((row) => sanitizeRow(row))
          .filter((row): row is TableRow => row !== null);

        if (rows.length === 0) continue;

        const textLines = rows.map(degenerateRowText);
        if (textLines.every((line) => line !== null)) {
          // The whole table is notice/echo noise — surface it as text so the
          // renderer can style it as a callout instead of a headerless table.
          tableText.push(...(textLines as string[]));
        } else {
          const realRows = rows.filter((_, i) => textLines[i] === null);
          if (realRows.length > 0) tables.push(realRows);
        }
      }
    }

    // Suppress text that is just a dump of the table content
    const baseText = isTableDump(rawText, title) ? "" : rawText;
    const text = [baseText, ...tableText].filter(Boolean).join("\n");

    if (title || text || tables.length > 0) {
      raw.push({ title, text, tables });
      return;
    }

    for (const child of Object.values(record)) visit(child, seen);
  }

  for (const resp of Object.values(responsesByKey)) {
    visit(resp?.data, new Set<object>());
  }

  // Filter sections with no meaningful content
  const cleaned = raw.filter((s) => !isSectionGarbage(s));

  // Deduplicate by title + first 60 chars of text
  const deduped: ParsedSection[] = [];
  const seen = new Set<string>();

  for (const section of cleaned) {
    const key = `${section.title}|||${section.text.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(section);
  }

  return deduped;
}
