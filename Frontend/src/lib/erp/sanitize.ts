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
/**
 * Returns true if the text is leaked page source rather than prose.
 *
 * Several ERP pages inline `<script>`/`<style>` inside the region the extractor
 * treats as content, so the raw jQuery and CSS arrive here as "text". Without
 * this guard it renders verbatim to students — `/settings` was displaying
 * `input,select{ height: 30px; } $(function () { ... })` as body copy.
 *
 * Two independent signals must agree before text is discarded, so ordinary
 * sentences that merely contain a brace or a parenthesis are never suppressed.
 */
function looksLikeCode(text: string): boolean {
  if (!text) return false;

  const signals = [
    /\bfunction\s+\w*\s*\([^)]*\)\s*\{/, // function declarations
    /\$\(\s*(?:function|document|["'#.])/, // jQuery entry points
    /\b(?:var|const|let)\s+\w+\s*=/, // variable declarations
    /\b(?:ajax|jqXHR|xmlhttp|responseText|onreadystatechange)\b/i, // XHR plumbing
    /[.#]?[\w-]+\s*\{[^}]*:[^}]*(?:px|em|rem|%|#[0-9a-f]{3,6})[^}]*\}/i, // CSS rule bodies
    /\b(?:alert|console\.log)\s*\(/, // debug calls
    /\}\s*\)\s*;/, // closing callback punctuation
  ];

  const hits = signals.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
  if (hits >= 2) return true;

  // A single very strong signal is enough when the text is also brace-dense —
  // prose does not carry a brace every eighty characters.
  const braces = (text.match(/[{}]/g) || []).length;
  return hits >= 1 && braces >= 4 && braces / text.length > 0.0125;
}

/**
 * Splits leaked-code text on statement/block boundaries (`{`, `}`, `;`) and
 * drops every chunk that looks like a code fragment, keeping only the
 * human-readable prose scraped alongside it.
 *
 * ERP pages routinely inline a `<script>`/`<style>` block with no separator
 * before or after the real notice text (e.g. SAP Process ships
 * `function redirectSapRegistration() { funLoadDetails(44); } Note: Students
 * will be allowed to register one time... redirectSapRegistration();` as one
 * string) — chunking on statement punctuation isolates the sentence from the
 * script around it far more reliably than trying to regex out every JS shape
 * in one pass.
 */
function isCodeChunk(chunk: string): boolean {
  const c = chunk.trim();
  if (!c) return true;
  if (!/[a-zA-Z]/.test(c)) return true; // pure punctuation left over from a split
  if (/\bfunction\b/i.test(c)) return true;
  if (/\$\(/.test(c)) return true;
  if (/\.\w+\(/.test(c)) return true; // method call: $(".x").hide(
  if (/\b(?:var|const|let)\s+\w+\s*=/.test(c)) return true;
  if (/\b(?:ajax|jqxhr|xmlhttp|onreadystatechange|superalert|confirm|alert|console\.log)\s*\(/i.test(c)) return true;
  if (/^if\s*\(|^else\b/.test(c)) return true;
  if (/^return\s+(?:false|true)\s*;?\s*$/i.test(c)) return true;
  if (/[=!]==|&&|\|\|/.test(c)) return true;
  if (/:\s*['"]/.test(c)) return true; // object-literal key: 'value'
  if (/^[.#]?[\w-]+$/.test(c)) return true; // bare CSS selector, e.g. ".alert-danger"
  if (/^[.#]?[\w-]+\s*:\s*[\w#%.-]+$/i.test(c)) return true; // CSS declaration: color: red
  if (/^[\w.$#'"]+\s*\([^)]*\)\s*$/.test(c)) return true; // bare call: funLoadDetails(44)
  return false;
}

function stripLeakedCodeFragments(text: string): string {
  const survivors = text
    .split(/[{};]/)
    .filter((chunk) => !isCodeChunk(chunk))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return survivors
    .join(" ")
    .replace(/\b[a-zA-Z_]\w*\s*\(\s*\)\s*;?/g, " ") // stray zero-arg call: redirectX ();
    .replace(/Loading\.{2,}/gi, " ") // client-side "Loading........." placeholder, not real content
    .replace(/\s+/g, " ")
    .trim();
}

/** Punctuation-heavy leftovers (unbalanced JS fragments) read as noise, not prose. */
function looksLikeResidualCode(text: string): boolean {
  const punct = (text.match(/[(){}$;=]/g) || []).length;
  return text.length > 0 && punct / text.length > 0.04;
}

function isTableDump(text: string, title: string): boolean {
  if (!text) return false;

  // Leaked <script>/<style> contents from the upstream page
  if (looksLikeCode(text)) return true;

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

    // Suppress text that is just a dump of the table content — but first try
    // to salvage any real sentence buried inside leaked script/style noise
    // rather than discarding the whole blob (see stripLeakedCodeFragments).
    const baseText = (() => {
      if (!rawText || !isTableDump(rawText, title)) return rawText;
      const salvaged = stripLeakedCodeFragments(rawText);
      // Re-check for genuine leftover code/noise only — not the raw-text-only
      // gates (redirect-call / "Loading....." stubs) in isTableDump, which
      // stripLeakedCodeFragments has already scrubbed above and would
      // otherwise wholesale-reject a perfectly good salvaged sentence that
      // merely used to sit next to one of those artifacts.
      if (!salvaged || looksLikeResidualCode(salvaged) || looksLikeCode(salvaged)) return "";
      return salvaged;
    })();
    // The upstream ERP frequently repeats the same notice in both `text` and a
    // degenerate echo row (or across duplicate rows) — dedupe exact-match lines
    // so "Registration closed" doesn't render twice back to back.
    const text = Array.from(new Set([baseText, ...tableText].filter(Boolean))).join("\n");

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
