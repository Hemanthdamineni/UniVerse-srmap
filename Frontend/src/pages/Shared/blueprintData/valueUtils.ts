import type { PageRenderer } from "../../../config/erpBlueprints";
import type { StatusMessage } from "../../../components/erp/ErpPrimitives";
import { sanitizeErpDisplayText } from "../../../lib/erpDisplayText";

export const CODE_NOISE_PATTERN =
  /(function\s+[a-z0-9_]+\s*\(|\$\(|\.jsp|validationengine|ajaxparameter|e\.preventdefault|window\.open|@page|^\.[a-z0-9_-]+\s*\{|^input,select\{|^thead\{|^var\s+[a-z0-9_]+\s*=|font-size\s*:|font-family\s*:|background(?:-color)?\s*:|text-align\s*:|font-weight\s*:|padding\s*:|color\s*:|url\s*\(|\.jpg|\.png|subheader)/i;

export function stripScriptNoise(text: string) {
  if (!text) return "";

  const expanded = text.replace(/([;{}])/g, "$1\n");
  const lines = expanded
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CODE_NOISE_PATTERN.test(line))
    .filter((line) => !/^[$@.#]/.test(line))
    .filter((line) => !/^\w+\([^)]*\)$/.test(line));

  return sanitizeErpDisplayText(lines.join(" "), "");
}

export function buildSummary(text: string) {
  if (!text) return undefined;

  if (text.length <= 240) return text;

  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const interesting = sentences.filter((sentence) =>
    /note|registration|allowed|closed|disclaimer|period|please|verification|announcement/i.test(sentence)
  );

  const selected = (interesting.length > 0 ? interesting : sentences).slice(0, 2).join(" ");
  if (!selected) return undefined;
  if (selected.length <= 360) return selected;

  return `${selected.slice(0, 357)}...`;
}

export function isNonUserFacingSummary(text: string, renderer: PageRenderer, tableCount: number) {
  const normalized = normalizeCompare(text);
  if (!normalized) return true;

  if (tableCount > 0) {
    return true;
  }

  if (CODE_NOISE_PATTERN.test(normalized)) {
    return true;
  }

  const hasTimetableMarker = normalized.includes("time table");
  const timeHits = (normalized.match(/\b\d{2}:\d{2}\b/g) || []).length;
  const dayHits = (normalized.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length;
  const courseHits = (normalized.match(/\b[a-z]{2,5}\s*\d{2,3}[a-z]?\b/gi) || []).length;
  const headingHits = (normalized.match(/\b(subjects description|faculty name|class room name|l-t-p-c)\b/g) || []).length;
  const colHits = (normalized.match(/\bcol\d+\b/g) || []).length;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentencePunctuationHits = (text.match(/[.!?]/g) || []).length;

  if (hasTimetableMarker && (timeHits >= 4 || dayHits >= 2) && (courseHits >= 3 || headingHits >= 1)) {
    return true;
  }

  if ((colHits >= 2 || courseHits >= 6 || headingHits >= 2) && tokenCount >= 40 && sentencePunctuationHits === 0) {
    return true;
  }

  if (tokenCount >= 110 && sentencePunctuationHits <= 1) {
    return true;
  }

  if (renderer === "generic") {
    const meaningfulHint =
      /note|registration|allowed|closed|disclaimer|period|please|verification|announcement|deadline|schedule|important|policy/i;
    if (!meaningfulHint.test(normalized)) {
      return true;
    }
  }

  if (/^[\][}{)(\s.,;:'"`-]+/.test(text.trim())) {
    return true;
  }

  return false;
}

export function cleanColumnName(name: string) {
  const trimmed = String(name || "").trim();
  if (/^col\d+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed || "Column";
}

export function cleanCell(value: unknown): string {
  const primitive = extractCellPrimitive(value);
  const raw = sanitizeErpDisplayText(
    String(primitive ?? "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/\$\(document\)\.ready\([\s\S]*?\}\);?/g, " ")
      .replace(/\$\(['"][^'"]*['"]\)[\s\S]*?;/g, " ")
      .replace(/<\/?[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
    ""
  );
  if (raw.length <= 220) return raw;
  return `${raw.slice(0, 217)}...`;
}

export function extractCellPrimitive(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return "";

  if (isRecord(value)) {
    if ("text" in value) return extractCellPrimitive(value.text);
    if ("label" in value) return extractCellPrimitive(value.label);
    if ("value" in value) return extractCellPrimitive(value.value);
    if ("props" in value && isRecord(value.props)) {
      if ("text" in value.props) return extractCellPrimitive(value.props.text);
      if ("label" in value.props) return extractCellPrimitive(value.props.label);
      if ("value" in value.props) return extractCellPrimitive(value.props.value);
    }
    return "";
  }

  return "";
}

export function cleanTitle(title: string) {
  return sanitizeErpDisplayText(
    title
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    "Details"
  );
}

export function parseNumericValue(value: string) {
  const normalized = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!normalized) return NaN;
  return Number.parseFloat(normalized[0]);
}

export function statusToneForText(text: string): StatusMessage["tone"] {
  const lowered = text.toLowerCase();
  if (/closed|not applicable|locked/.test(lowered)) return "locked";
  if (/warning|soon|pending/.test(lowered)) return "warning";
  if (/success|approved|registered successfully/.test(lowered)) return "success";
  return "info";
}

export function normalizeCompare(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
