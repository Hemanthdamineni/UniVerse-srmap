const INTERNAL_JSP_PATH_PATTERN = /\b(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.jsp(?:\?[^\s]*)?\b/gi;
const SCRIPT_STYLE_PATTERN = /<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi;
const HTML_TAG_PATTERN = /<\/?[^>]+>/g;
const JQUERY_READY_PATTERN = /\$\(document\)\.ready\([\s\S]*?\}\);?/g;
const JQUERY_STATEMENT_PATTERN = /\$\(['"][^'"]*['"]\)[\s\S]*?;/g;
const UNRESOLVED_CONTROL_ID_PATTERN = /^(?:cmb|ddl|txt|hdn|btn|sel)[A-Z0-9_][A-Za-z0-9_]*$/;

const EXACT_TITLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^MINOR PROGRAM REGISTRATION$/, "Minor / OE Registration"],
  [/^COURSE REGISTRATION$/, "Course Registration"],
  [/^TRANSPORT REGISTRATION\s*20\d{2}$/, "Transport Registration"],
  [/^HOSTEL REGISTRATION\s*20\d{2}$/, "Hostel Registration"],
  [/^SAP ATTACHMENTS$/, "SAP Attachments"],
  [/^SAP DETAILS$/, "SAP Details"],
  [/^SAP FEEDBACK$/, "SAP Feedback"],
  [/^SAP WITHDRAW$/, "SAP Withdraw"],
  [/^STUDENT BANK DETAILS$/, "Student Bank Details"],
  [/^BANK DETAILS$/, "Bank Details"],
  [/^SUBJECT WISE FEEDBACK\s*[-–]\s*END SEMESTER$/i, "Course Feedback"],
];

const MIXED_TITLE_NOISE = [
  /\bMINOR PROGRAM REGISTRATION\b/g,
  /\bCOURSE REGISTRATION\b/g,
  /\bTRANSPORT REGISTRATION\s*20\d{2}\b/g,
  /\bHOSTEL REGISTRATION\s*20\d{2}\b/g,
  /\bSAP ATTACHMENTS\b/g,
  /\bSAP DETAILS\b/g,
  /\bSAP FEEDBACK\b/g,
  /\bSAP WITHDRAW\b/g,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractRenderablePrimitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("text" in record) return extractRenderablePrimitive(record.text);
    if ("label" in record) return extractRenderablePrimitive(record.label);
    if ("value" in record) return extractRenderablePrimitive(record.value);
    if (record.props && typeof record.props === "object" && !Array.isArray(record.props)) {
      return extractRenderablePrimitive(record.props);
    }
  }
  return "";
}

function titleCaseAllCaps(value: string) {
  if (value !== value.toUpperCase() || value.length <= 2 || !/[A-Z]/.test(value)) {
    return value;
  }

  return value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

function cleanupFormId(value: string) {
  if (!/^frm[A-Z]/i.test(value) && !value.toLowerCase().includes("frmstudent")) {
    return value;
  }

  return value
    .replace(/^frmStudent/i, "")
    .replace(/^frm/i, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function collapseAdjacentRepeatedPhrases(value: string) {
  const words = value.split(" ").filter(Boolean);
  if (words.length < 2) return value;

  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.min(6, Math.floor(words.length / 2)); size >= 1; size -= 1) {
      for (let index = 0; index + size * 2 <= words.length; index += 1) {
        const left = words.slice(index, index + size).join(" ").toLowerCase();
        const right = words.slice(index + size, index + size * 2).join(" ").toLowerCase();
        if (left && left === right) {
          words.splice(index + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return words.join(" ");
}

function stripKnownErpTitleNoise(value: string) {
  const exact = EXACT_TITLE_REPLACEMENTS.find(([pattern]) => pattern.test(value));
  if (exact) return exact[1];

  let next = value
    .replace(/\bCourse Registration\s+COURSE REGISTRATION\s+Course Registered successfully\b/g, "Registration completed successfully.")
    .replace(/\bStudent Bank Details\s+Bank Details\b/g, "Student Bank Details");

  MIXED_TITLE_NOISE.forEach((pattern) => {
    next = next.replace(pattern, " ");
  });

  return collapseAdjacentRepeatedPhrases(normalizeWhitespace(next));
}

export function isUnresolvedErpControlId(value: unknown) {
  const text = normalizeWhitespace(extractRenderablePrimitive(value));
  return Boolean(text && UNRESOLVED_CONTROL_ID_PATTERN.test(text));
}

export function sanitizeErpDisplayText(value: unknown, fallback = ""): string {
  let sanitized = extractRenderablePrimitive(value);

  if (!sanitized) return fallback;
  if (isUnresolvedErpControlId(sanitized)) return fallback;

  sanitized = normalizeWhitespace(
    sanitized
      .replace(SCRIPT_STYLE_PATTERN, " ")
      .replace(JQUERY_READY_PATTERN, " ")
      .replace(JQUERY_STATEMENT_PATTERN, " ")
      .replace(INTERNAL_JSP_PATH_PATTERN, " ")
      .replace(HTML_TAG_PATTERN, " ")
      .replace(/&nbsp;/gi, " ")
  );

  if (!sanitized) return fallback;
  if (isUnresolvedErpControlId(sanitized)) return fallback;

  sanitized = stripKnownErpTitleNoise(sanitized);
  sanitized = titleCaseAllCaps(sanitized);
  sanitized = sanitized.replace(/([a-zA-Z0-9])\(/g, "$1 (").replace(/ \)/g, ")").replace(/\( /g, "(");
  sanitized = cleanupFormId(sanitized);

  if (!sanitized || isUnresolvedErpControlId(sanitized)) return fallback;
  return sanitized;
}
