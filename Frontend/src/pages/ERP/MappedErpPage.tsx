import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ApiError,
  type ErpAction,
  type ErpBatchPageResult,
  type ErpDocument,
  type ErpNode,
  type ErpForm,
  type ErpSchemaBlock,
  type ErpSchemaResponse,
  type ErpUiHintsResponse,
  type ErpUiSection,
  type ErpPageResponse,
  executeErpAction,
  getErpBatch,
} from "../../lib/erpApi";
import { usePageContrast } from "../../hooks/usePageContrast";
import { fetchSessionProfile, getSessionId, readStoredProfileData } from "../../lib/session";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import ErpDocumentRenderer from "../../components/erp/ErpDocumentRenderer";

type Props = {
  pageKeys?: string[];
  pageKey?: string;
  title?: string;
};

type PlainRecord = Record<string, unknown>;
type TableRowView = {
  sourceRowIdx: number;
  values: Record<string, string>;
};

type MessageState = {
  type: "success" | "error" | "info";
  text: string;
} | null;

type SectionData = {
  id: string;
  sourcePageKey: string;
  dropdown: string;
  subitem: string;
  payload: unknown;
};

type KeyDiagnostic = {
  pageKey: string;
  source: string;
  fetchedAt?: string;
  status?: number;
  code?: string;
  error?: string;
};

type ActionTemplateField = {
  key: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  maxLength?: number;
  type?: "text" | "select";
  options?: string[];
};

const TARGET_ID_ROUTE_MAP: Record<number, string> = {
  8: "/finance/fee-dues",
  11: "/registration/hostel-registration",
  16: "/registration/course-registration",
  33: "/academic/elective-preferences",
  40: "/academic/electives",
};

const MONTH_REGEX = /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})\b/gi;

function isRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "";
  if (typeof value === "object") {
    // Extract displayable text from nested objects instead of "[object Object]"
    const record = value as Record<string, unknown>;
    if ("text" in record) return cleanText(record.text);
    if ("label" in record) return cleanText(record.label);
    if ("value" in record) return cleanText(record.value);
    return "";
  }
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePageKey(value: string) {
  return cleanText(value).toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");
}

function isTimetablePageKey(value: string) {
  const normalized = normalizePageKey(value);
  return normalized === "academic/time-table" || normalized === "academic/timetable";
}

const INTERNAL_JSP_PATH_PATTERN = /\b(?:[a-z0-9_-]+\/)+[a-z0-9_-]+\.jsp(?:\?[^\s]*)?\b/gi;
const DOCUMENT_TEXT_NOISE_PATTERN =
  /(function\s+[a-z0-9_]+\s*\(|\$\(|\.jsp\b|validationengine|ajaxparameter|e\.preventdefault|window\.open|document\.getelementbyid|@page\b|^var\s+[a-z0-9_]+\s*=|font-size\s*:|font-family\s*:|background(?:-color)?\s*:|text-align\s*:|font-weight\s*:|padding\s*:|border(?:-collapse)?\s*:|color\s*:|dialog\(|alert\(|\$.post\(|\$.ajax\()/i;

function displayText(value: unknown, fallback = "") {
  const normalized = cleanText(value);
  if (!normalized) return fallback;

  const withoutInternalPaths = normalized.replace(INTERNAL_JSP_PATH_PATTERN, " ");
  let sanitized = withoutInternalPaths.replace(/\s+/g, " ").trim();

  // Advanced Normalization

  // 1. Convert ALL CAPS text to Title Case (ignoring pure numbers or tiny abbreviations)
  if (sanitized === sanitized.toUpperCase() && sanitized.length > 2 && /[A-Z]/.test(sanitized)) {
    sanitized = sanitized.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  }

  // 2. Fix spacing around parentheses/brackets
  sanitized = sanitized.replace(/([a-zA-Z0-9])\(/g, "$1 (");
  sanitized = sanitized.replace(/ \)/g, ")");
  sanitized = sanitized.replace(/\( /g, "(");

  // 3. Clean up internal Form IDs (e.g., frmStudentFeeDueDetails -> Fee Due Details)
  if (sanitized.match(/^frm[A-Z]/i) || sanitized.toLowerCase().includes('frmstudent')) {
    sanitized = sanitized
      .replace(/^frmStudent/i, '')
      .replace(/^frm/i, '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  return sanitized || fallback;
}

function isTimeRangeLabel(value: string) {
  return /^\d{1,2}:\d{2}\s*(?:to|-)\s*\d{1,2}:\d{2}$/i.test(cleanText(value));
}

function isWeekdayLabel(value: string) {
  return /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(cleanText(value));
}

function getTableHeaderLabel(header: string, isTimetablePage: boolean) {
  const normalized = cleanText(header);

  if (isTimetablePage) {
    if (!normalized || normalized === "-") return "Room";
    if (/^details?$/i.test(normalized)) return "Day";
  }

  if (normalized === "col1") return "Details";
  if (normalized === "col2") return "Info";
  if (normalized.startsWith("col")) return "";

  return normalized;
}

function normalizeToken(value: unknown) {
  return cleanText(value).toLowerCase();
}

function sectionId(dropdown: unknown, subitem: unknown) {
  return `${normalizeToken(dropdown)}::${normalizeToken(subitem)}`;
}

function sectionCompositeId(sourcePageKey: string, dropdown: unknown, subitem: unknown) {
  return `${normalizeToken(sourcePageKey)}::${sectionId(dropdown, subitem)}`;
}

function toPageTitle(pageKey: string, fallback?: string) {
  if (fallback && cleanText(fallback)) return cleanText(fallback);
  return pageKey
    .split("/")
    .join(" ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function collectTextPool(payload: unknown, limit = 200): string[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  const pool: string[] = [];

  while (queue.length > 0 && pool.length < limit) {
    const current = queue.shift();
    if (current == null) continue;

    if (typeof current === "string") {
      const value = cleanText(current);
      if (value) pool.push(value);
      continue;
    }

    if (Array.isArray(current)) {
      for (const entry of current) queue.push(entry);
      continue;
    }

    if (isRecord(current)) {
      if (seen.has(current)) continue;
      seen.add(current);
      for (const value of Object.values(current)) queue.push(value);
    }
  }

  return pool;
}

function normalizeSectionsFromData(
  data: unknown,
  sourcePageKey: string,
  title?: string
): SectionData[] {
  const sections: SectionData[] = [];

  const push = (dropdown: string, subitem: string, payload: unknown) => {
    const id = sectionCompositeId(sourcePageKey, dropdown, subitem);
    if (sections.some((item) => item.id === id)) return;
    sections.push({ id, sourcePageKey, dropdown, subitem, payload });
  };

  if (isRecord(data)) {
    if (Array.isArray(data.tables) || isRecord(data.TableContent) || typeof data.text === "string") {
      push("Page", toPageTitle(sourcePageKey, title), data);
    }

    for (const [dropdown, groupedValue] of Object.entries(data)) {
      if (!isRecord(groupedValue) || Array.isArray(groupedValue)) continue;

      let addedSubsection = false;
      for (const [subitem, subsectionPayload] of Object.entries(groupedValue)) {
        if (!isRecord(subsectionPayload) && !Array.isArray(subsectionPayload)) continue;
        push(dropdown, subitem, subsectionPayload);
        addedSubsection = true;
      }

      if (!addedSubsection) {
        const hasRenderableContent =
          Array.isArray((groupedValue as PlainRecord).tables) ||
          isRecord((groupedValue as PlainRecord).TableContent) ||
          typeof (groupedValue as PlainRecord).text === "string";

        if (hasRenderableContent) {
          push(dropdown, dropdown, groupedValue);
        }
      }
    }
  }

  if (sections.length === 0) {
    push("Page", toPageTitle(sourcePageKey, title), data);
  }

  return sections;
}

function findSectionByRef(
  sections: SectionData[],
  ref: { sourcePageKey?: string; key?: string; dropdown?: string; subitem?: string } | undefined
): SectionData | null {
  if (!sections.length) return null;
  if (!ref) return sections[0];

  if (ref.sourcePageKey) {
    const bySource = sections.filter(
      (section) => normalizeToken(section.sourcePageKey) === normalizeToken(ref.sourcePageKey)
    );
    if (bySource.length > 0) {
      const narrowed: SectionData | null = findSectionByRef(bySource, {
        key: ref.key,
        dropdown: ref.dropdown,
        subitem: ref.subitem,
      });
      if (narrowed) return narrowed;
    }
  }

  const refKey = cleanText(ref.key);
  if (refKey) {
    const normalizedRef = normalizeToken(refKey);
    const byKey = sections.find((section) => {
      const composite = `${normalizeToken(section.sourcePageKey)}::${normalizeToken(
        section.dropdown
      )}::${normalizeToken(section.subitem)}`;
      const legacy = `${normalizeToken(section.dropdown)}::${normalizeToken(section.subitem)}`;
      return composite === normalizedRef || legacy === normalizedRef;
    });
    if (byKey) return byKey;
  }

  const byParts = sections.find(
    (section) =>
      normalizeToken(section.dropdown) === normalizeToken(ref.dropdown) &&
      normalizeToken(section.subitem) === normalizeToken(ref.subitem)
  );
  if (byParts) return byParts;

  const bySubitem = sections.find(
    (section) => normalizeToken(section.subitem) === normalizeToken(ref.subitem)
  );
  if (bySubitem) return bySubitem;

  const byDropdown = sections.find(
    (section) => normalizeToken(section.dropdown) === normalizeToken(ref.dropdown)
  );
  if (byDropdown) return byDropdown;

  return sections[0];
}

function extractTables(payload: unknown): Array<Array<Record<string, string>>> {
  const tables: Array<Array<Record<string, string>>> = [];
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) continue;

    if (Array.isArray(current)) {
      if (current.length > 0 && current.every((item) => isRecord(item))) {
        // Skip if these records look like document node tree entries
        if (looksLikeNodeArray(current as Array<Record<string, unknown>>)) {
          continue;
        }

        const rows = current
          .map((item) => {
            const row: Record<string, string> = {};
            for (const [key, value] of Object.entries(item)) {
              // Skip structural node keys that would produce [object Object]
              if (key === "children" && Array.isArray(value)) continue;
              if (key === "props" && isRecord(value)) continue;
              row[cleanText(key)] = cleanText(value);
            }
            return row;
          })
          .filter((row) => Object.values(row).some(Boolean));

        if (rows.length > 0) {
          tables.push(rows);
        }
      } else {
        for (const item of current) queue.push(item);
      }
      continue;
    }

    if (!isRecord(current) || seen.has(current)) continue;
    seen.add(current);

    const tableContent = current.TableContent;
    if (isRecord(tableContent)) {
      const pairs = Object.entries(tableContent).map(([key, value]) => ({
        Field: cleanText(key),
        Value: cleanText(value),
      }));
      if (pairs.length > 0) tables.push(pairs);
    }

    for (const [key, value] of Object.entries(current)) {
      // Skip document tree — handled by ErpDocumentRenderer
      if (key === "document" && isRecord(value) && isRecord((value as Record<string, unknown>).root)) {
        continue;
      }
      // Skip children arrays that contain node tree entries
      if (key === "children" && Array.isArray(value) && looksLikeNodeArray(value.filter(isRecord) as Array<Record<string, unknown>>)) {
        continue;
      }
      queue.push(value);
    }
  }

  return tables;
}

/** Detects if an array of records represents document node tree entries */
function looksLikeNodeArray(records: Array<Record<string, unknown>>): boolean {
  if (records.length === 0) return false;
  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);
  const nodeCount = records.filter((row) => {
    const hasType = typeof row.type === "string" && knownNodeTypes.has(row.type);
    const hasProps = "props" in row && isRecord(row.props);
    const hasChildren = "children" in row && Array.isArray(row.children);
    return hasType && (hasProps || hasChildren);
  }).length;
  return nodeCount >= Math.ceil(records.length * 0.5);
}

function extractSummaryText(payload: unknown) {
  const looksLikeDump = (text: string) => {
    const normalized = cleanText(text).toLowerCase();
    if (!normalized) return true;

    const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
    const punctuationHits = (text.match(/[.!?]/g) || []).length;
    const timeHits = (normalized.match(/\b\d{2}:\d{2}\b/g) || []).length;
    const dayHits = (normalized.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length;
    const colHits = (normalized.match(/\bcol\d+\b/g) || []).length;
    const cssHits = (normalized.match(/\b(font-size|font-family|background(?:-color)?|text-align|font-weight|padding|url\(|validationengine|window\.open)\b/g) || []).length;

    if (/^[\]\[}{)(\s.,;:'"`-]+/.test(text.trim())) return true;
    if (cssHits > 0) return true;
    if ((timeHits >= 4 || dayHits >= 2 || colHits >= 2) && tokenCount >= 30 && punctuationHits === 0) return true;
    if (tokenCount >= 110 && punctuationHits <= 1) return true;
    return false;
  };

  if (isRecord(payload) && typeof payload.text === "string") {
    const value = displayText(payload.text);
    return looksLikeDump(value) ? "" : value;
  }

  const pool = collectTextPool(payload, 10).join(" ").slice(0, 420);
  const value = displayText(pool);
  return looksLikeDump(value) ? "" : value;
}

function extractStudentIdFromProfile(profileData: Record<string, unknown> | null) {
  const table =
    profileData && isRecord(profileData.TableContent)
      ? (profileData.TableContent as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(table)) {
    if (!/student\s*id|\bstu\s*id\b/i.test(key)) continue;
    const match = cleanText(value).match(/\b(\d{3,})\b/);
    if (match) return match[1];
  }

  return "";
}

function inferExamMonthValues(payload: unknown, studentId: string) {
  const values = new Set<string>();
  const pool = collectTextPool(payload, 140).join(" ");

  let match: RegExpExecArray | null;
  while ((match = MONTH_REGEX.exec(pool))) {
    const month = cleanText(match[1]).toUpperCase();
    const year = cleanText(match[2]);
    if (!month || !year) continue;
    const sid = cleanText(studentId);
    values.add(`${month},${year},${sid}`);
  }

  return Array.from(values);
}

function deriveFallbackRoute(action: ErpAction) {
  const fnName = normalizeToken(action.controlRef?.functionName || action.execution?.functionName);

  if (fnName === "funearlierinternalmarks") return "/exams/earlier-semester-results";
  if (fnName === "funreturnhome") return "/login";
  if (fnName === "funsapapplicationhistroy") return "/registration/sap-registration";

  const targetId = Number(action.execution?.targetId);
  if (Number.isFinite(targetId)) {
    return TARGET_ID_ROUTE_MAP[targetId] || null;
  }

  return null;
}

function printHtmlDocument(html: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1280,height=860");
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    return;
  }

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(frame)) {
        document.body.removeChild(frame);
      }
    }, 400);
  }, 160);
}

function flattenWarnings(
  pageResponse: ErpPageResponse | null,
  uiHints: ErpUiHintsResponse | null,
  schema: ErpSchemaResponse | null,
  localWarnings: string[]
) {
  return [
    ...(Array.isArray(pageResponse?.warnings) ? pageResponse.warnings : []),
    ...(Array.isArray(uiHints?.warnings) ? uiHints.warnings : []),
    ...(Array.isArray(schema?.warnings) ? schema.warnings : []),
    ...localWarnings,
  ]
    .map((warning) => displayText(warning))
    .filter(Boolean);
}

function actionFieldTemplates(action: ErpAction, sectionPayload: unknown, studentId: string): ActionTemplateField[] {
  const endpoint = normalizeToken(action.execution?.url);
  const fnName = normalizeToken(action.controlRef?.functionName || action.execution?.functionName);

  if (endpoint.includes("studentattendanceresources.jsp")) {
    return [
      {
        key: "acode",
        label: "Attendance Code",
        placeholder: "Enter 7-character attendance code",
        required: true,
        maxLength: 7,
      },
    ];
  }

  if (endpoint.includes("mobilenumberverificationotp.jsp") || fnName === "funsendotp") {
    return [
      {
        key: "mobileNumber",
        label: "Mobile Number",
        placeholder: "Enter mobile number",
        required: true,
      },
    ];
  }

  if (fnName === "funprintapplication") {
    const options = inferExamMonthValues(sectionPayload, studentId);
    return [
      {
        key: "examMonthValue",
        label: "Exam Selection",
        type: options.length > 0 ? "select" : "text",
        options,
        placeholder: "DECEMBER,2025,STUDENT_ID",
        helperText: "Use format ExamMonth,ExamYear,StudentId if dropdown is empty.",
        required: true,
      },
    ];
  }

  return [];
}

function buildFallbackBlocks(
  pageKey: string,
  uiHints: ErpUiHintsResponse | null,
  sections: SectionData[]
): ErpSchemaBlock[] {
  if (uiHints?.sections?.length) {
    const blocks: ErpSchemaBlock[] = [];

    for (const section of uiHints.sections) {
      const sourcePageKey = cleanText(section.sourcePageKey || pageKey) || pageKey;
      blocks.push({
        id: `${sectionCompositeId(sourcePageKey, section.dropdown, section.subitem)}-card`,
        type: "card",
        sourcePageKey,
        showStatus: true,
        showDescription: true,
        showActions: true,
        section: {
          sourcePageKey,
          key: sectionCompositeId(sourcePageKey, section.dropdown, section.subitem),
          dropdown: section.dropdown,
          subitem: section.subitem,
        },
      });

      if (Array.isArray(section.forms) && section.forms.length > 0) {
        blocks.push({
          id: `${sectionCompositeId(sourcePageKey, section.dropdown, section.subitem)}-form`,
          type: "form",
          sourcePageKey,
          showActions: true,
          section: {
            sourcePageKey,
            key: sectionCompositeId(sourcePageKey, section.dropdown, section.subitem),
            dropdown: section.dropdown,
            subitem: section.subitem,
          },
        });
      }

      blocks.push({
        id: `${sectionCompositeId(sourcePageKey, section.dropdown, section.subitem)}-table`,
        type: "table",
        sourcePageKey,
        section: {
          sourcePageKey,
          key: sectionCompositeId(sourcePageKey, section.dropdown, section.subitem),
          dropdown: section.dropdown,
          subitem: section.subitem,
        },
      });
    }

    return blocks;
  }

  if (sections.length > 0) {
    return sections.flatMap((section) => [
      {
        id: `${section.id}-card`,
        type: "card",
        sourcePageKey: section.sourcePageKey,
        showStatus: true,
        showDescription: true,
        showActions: true,
        section: {
          sourcePageKey: section.sourcePageKey,
          key: section.id,
          dropdown: section.dropdown,
          subitem: section.subitem,
        },
      },
      {
        id: `${section.id}-table`,
        type: "table",
        sourcePageKey: section.sourcePageKey,
        section: {
          sourcePageKey: section.sourcePageKey,
          key: section.id,
          dropdown: section.dropdown,
          subitem: section.subitem,
        },
      },
    ]);
  }

  return [{ id: `${pageKey}-table`, type: "table", sourcePageKey: pageKey }];
}

function normalizeConfiguredPageKeys(props: Props) {
  const values = Array.isArray(props.pageKeys) ? props.pageKeys : [];
  const legacy = props.pageKey ? [props.pageKey] : [];

  return Array.from(
    new Set(
      [...values, ...legacy]
        .map((key) => cleanText(key))
        .filter(Boolean)
    )
  );
}

function isErpDocument(value: unknown): value is ErpDocument {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    isRecord(value.root) &&
    typeof value.root.id === "string" &&
    typeof value.root.type === "string" &&
    Array.isArray(value.root.children)
  );
}

function collectDocumentText(node: ErpNode | undefined, limit = 16, bucket: string[] = []): string[] {
  if (!node || bucket.length >= limit) return bucket;

  const candidates = [node.props?.title, node.props?.label, node.props?.text]
    .map((value) => cleanText(value))
    .filter(Boolean);

  candidates.forEach((value) => {
    if (bucket.length < limit) bucket.push(value);
  });

  if (Array.isArray(node.children)) {
    node.children.forEach((child) => {
      if (bucket.length < limit) {
        collectDocumentText(child, limit, bucket);
      }
    });
  }

  return bucket;
}

function hasRenderableDocumentNodes(node: ErpNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "table" || node.type === "form" || node.type === "field" || node.type === "button") {
    return true;
  }

  return Array.isArray(node.children) ? node.children.some((child) => hasRenderableDocumentNodes(child)) : false;
}

function isMeaningfulDocument(document: ErpDocument) {
  if (!document?.root) return false;
  if (hasRenderableDocumentNodes(document.root)) return true;

  const textSample = collectDocumentText(document.root).join(" ");
  const normalized = cleanText(textSample);
  if (!normalized) return false;

  return !DOCUMENT_TEXT_NOISE_PATTERN.test(normalized);
}

function collectEmbeddedDocumentsFromPayload(payload: unknown) {
  const documents: ErpDocument[] = [];
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) continue;

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (!isRecord(current) || seen.has(current)) continue;
    seen.add(current);

    if (isErpDocument(current.document) && isMeaningfulDocument(current.document)) {
      documents.push(current.document);
    }

    Object.entries(current).forEach(([key, value]) => {
      if (key === "document") return;
      queue.push(value);
    });
  }

  return documents;
}

function combineDocuments(documents: ErpDocument[], title: string): ErpDocument | null {
  if (documents.length === 0) return null;

  const dedupedDocuments: ErpDocument[] = [];
  const seenSignatures = new Set<string>();

  for (const document of documents) {
    const signature = JSON.stringify({
      title: cleanText(document.title),
      root: documentNodeSignature(document.root),
    });

    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    dedupedDocuments.push(document);
  }

  if (dedupedDocuments.length === 1) return dedupedDocuments[0];

  return {
    title,
    root: {
      id: "root",
      type: "container",
      props: {},
      children: dedupedDocuments.map((document, index) => ({
        id: `document-${index + 1}`,
        type: "container",
        props: document.title ? { title: document.title } : {},
        children: Array.isArray(document.root?.children) ? document.root.children : [],
      })),
    },
  };
}

function documentNodeSignature(node: ErpNode | undefined): unknown {
  if (!node) return null;

  const normalizedProps = Object.fromEntries(
    (Object.entries(node.props || {}) as Array<[string, unknown]>)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeDocumentValue(value)] as const)
      .sort(([left], [right]) => left.localeCompare(right))
  );

  return {
    type: node.type,
    props: normalizedProps,
    children: Array.isArray(node.children) ? node.children.map((child) => documentNodeSignature(child)) : [],
  };
}

function normalizeDocumentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDocumentValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      (Object.entries(value) as Array<[string, unknown]>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, normalizeDocumentValue(item)] as const)
        .sort(([left], [right]) => left.localeCompare(right))
    );
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  return value;
}

function buildCombinedDocumentForKeys(
  pageKeys: string[],
  responsesByKey: Record<string, ErpPageResponse>,
  pageTitle: string
) {
  const documents = pageKeys
    .flatMap((key) => {
      const response = responsesByKey[key];
      if (!response) return [];

      const embeddedDocuments = collectEmbeddedDocumentsFromPayload(response.data);
      const responseDocuments = response.document && isMeaningfulDocument(response.document) ? [response.document] : [];

      return [...responseDocuments, ...embeddedDocuments];
    });

  return combineDocuments(documents, pageTitle);
}

function isBatchError(result: ErpBatchPageResult | undefined): result is {
  success: false;
  pageKey: string;
  error: string;
  status: number;
  code: string;
} {
  return Boolean(result && (result as { success?: boolean }).success === false);
}

export default function MappedErpPage({ pageKeys, pageKey, title }: Props) {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const configuredPageKeys = useMemo(
    () => normalizeConfiguredPageKeys({ pageKeys, pageKey, title }),
    [pageKeys, pageKey, title]
  );
  const primaryPageKey = configuredPageKeys[0] || "erp-page";
  const isTimetablePage = useMemo(
    () => configuredPageKeys.some((key) => isTimetablePageKey(key)),
    [configuredPageKeys]
  );

  const [pageResponse, setPageResponse] = useState<ErpPageResponse | null>(null);
  const [pageResponsesByKey, setPageResponsesByKey] = useState<Record<string, ErpPageResponse>>({});
  const [uiHints, setUiHints] = useState<ErpUiHintsResponse | null>(null);
  const [schema, setSchema] = useState<ErpSchemaResponse | null>(null);
  const [keyDiagnostics, setKeyDiagnostics] = useState<KeyDiagnostic[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [localWarnings, setLocalWarnings] = useState<string[]>([]);

  const [message, setMessage] = useState<MessageState>(null);
  const [pendingActionId, setPendingActionId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>(() =>
    extractStudentIdFromProfile(readStoredProfileData())
  );

  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [actionValues, setActionValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let active = true;

    fetchSessionProfile()
      .then((profile) => {
        if (!active) return;
        setStudentId(extractStudentIdFromProfile(profile));
      })
      .catch(() => {
        if (!active) return;
        setStudentId(extractStudentIdFromProfile(readStoredProfileData()));
      });

    return () => {
      active = false;
    };
  }, []);

  const loadPage = useCallback(
    async (withSpinner = true): Promise<ErpDocument | null> => {
      if (withSpinner) setLoading(true);
      setLoadError(null);
      setMessage(null);

      const extraWarnings: string[] = [];

      try {
        if (configuredPageKeys.length === 0) {
          throw new ApiError("No ERP fetch keys configured for this page.", 500, "NO_FETCH_KEYS", false);
        }

        const batch = await getErpBatch(configuredPageKeys);
        const successfulByKey: Record<string, ErpPageResponse> = {};
        const successResponses: ErpPageResponse[] = [];
        const diagnostics: KeyDiagnostic[] = [];
        const failures: Array<{ pageKey: string; error: string; status: number; code: string }> = [];

        for (const key of configuredPageKeys) {
          const result = batch[key];
          if (!result) {
            failures.push({
              pageKey: key,
              error: "Batch response missing this key.",
              status: 502,
              code: "BATCH_KEY_MISSING",
            });
            continue;
          }

          if (isBatchError(result)) {
            failures.push({
              pageKey: key,
              error: cleanText(result.error) || "Failed to load ERP key",
              status: Number(result.status || 500),
              code: cleanText(result.code) || "INTERNAL_ERROR",
            });
            continue;
          }

          successfulByKey[key] = result;
          successResponses.push(result);
          diagnostics.push({
            pageKey: key,
            source: cleanText(result.source) || "unknown",
            fetchedAt: cleanText(result.fetchedAt) || undefined,
          });
        }

        failures.forEach((failure) => {
          diagnostics.push({
            pageKey: failure.pageKey,
            source: "error",
            status: failure.status,
            code: failure.code,
            error: failure.error,
          });
          extraWarnings.push(`${failure.pageKey}: ${failure.error}`);
        });

        if (successResponses.length === 0) {
          const firstFailure = failures[0];
          throw new ApiError(
            firstFailure?.error || "Failed to load ERP page",
            Number(firstFailure?.status || 500),
            firstFailure?.code || "INTERNAL_ERROR",
            false
          );
        }

        const mergedUiHints: ErpUiHintsResponse | null = null;
        const schemaResult: ErpSchemaResponse | null = null;

        const mergedWarningsFromData = successResponses.flatMap((response) =>
          Array.isArray(response.warnings) ? response.warnings : []
        );
        const sourceSet = Array.from(
          new Set(
            successResponses
              .map((response) => cleanText(response.source))
              .filter(Boolean)
          )
        );
        const combinedDocument = buildCombinedDocumentForKeys(
          configuredPageKeys,
          successfulByKey,
          toPageTitle(primaryPageKey, title)
        );

        setPageResponse({
          success: true,
          pageKey: primaryPageKey,
          source: sourceSet.length === 1 ? sourceSet[0] : "mixed",
          fetchedAt: successResponses[0]?.fetchedAt,
          staleAt: successResponses[0]?.staleAt || null,
          policyMode: successResponses[0]?.policyMode,
          warnings: mergedWarningsFromData,
          document: combinedDocument || undefined,
          data: Object.fromEntries(
            configuredPageKeys
              .filter((key) => Boolean(successfulByKey[key]))
              .map((key) => [key, successfulByKey[key].data])
          ),
        });
        setPageResponsesByKey(successfulByKey);
        setUiHints(mergedUiHints);
        setSchema(schemaResult);
        setKeyDiagnostics(diagnostics);
        setLocalWarnings(extraWarnings);

        setFormValues({});

        return combinedDocument;
      } catch (err) {
        const unknownError = err as Partial<ApiError> | undefined;
        const normalized = err instanceof ApiError
          ? err
          : new ApiError(
            cleanText(unknownError?.message) || "Failed to load ERP page",
            Number(unknownError?.status || 500),
            cleanText(unknownError?.code) || "INTERNAL_ERROR",
            false
          );
        setLoadError(normalized);
        setPageResponsesByKey({});
        setKeyDiagnostics([]);
        setUiHints(null);
        setSchema(null);
        setPageResponse(null);
        setLocalWarnings(extraWarnings);
        setFormValues({});
        setActionValues({});
        return null;
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [configuredPageKeys, primaryPageKey, title]
  );

  useEffect(() => {
    loadPage(true);
  }, [loadPage]);

  const sections = useMemo(
    () =>
      configuredPageKeys.flatMap((key) => {
        const payload = pageResponsesByKey[key]?.data;
        if (payload == null) return [];
        return normalizeSectionsFromData(payload, key, title);
      }),
    [configuredPageKeys, pageResponsesByKey, title]
  );

  const blocks = useMemo(() => {
    if (schema?.blocks?.length) return schema.blocks;
    return buildFallbackBlocks(primaryPageKey, uiHints, sections);
  }, [schema?.blocks, primaryPageKey, uiHints, sections]);

  const warnings = useMemo(
    () => flattenWarnings(pageResponse, uiHints, schema, localWarnings),
    [pageResponse, uiHints, schema, localWarnings]
  );

  const documentForRender = useMemo(() => {
    return buildCombinedDocumentForKeys(configuredPageKeys, pageResponsesByKey, toPageTitle(primaryPageKey, title));
  }, [configuredPageKeys, pageResponsesByKey, primaryPageKey, title]);

  const updateFormField = (section: ErpUiSection, fieldKey: string, value: string) => {
    const sid = sectionCompositeId(
      cleanText(section.sourcePageKey || primaryPageKey),
      section.dropdown,
      section.subitem
    );
    setFormValues((prev) => ({
      ...prev,
      [sid]: {
        ...(prev[sid] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const updateActionField = (actionId: string, key: string, value: string) => {
    setActionValues((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] || {}),
        [key]: value,
      },
    }));
  };

  const handleAction = async (
    sectionHint: ErpUiSection,
    sectionData: SectionData | null,
    action: ErpAction
  ) => {
    if (!action?.id) return;
    if (action.enabled === false) {
      setMessage({
        type: "info",
        text: action.disabledReason || "This action is currently disabled.",
      });
      return;
    }

    const actionPageKey = cleanText(sectionHint.sourcePageKey || sectionData?.sourcePageKey || primaryPageKey);
    const sid = sectionCompositeId(actionPageKey, sectionHint.dropdown, sectionHint.subitem);
    const actionInput = actionValues[action.id] || {};
    const formInput = formValues[sid] || {};

    const payload: Record<string, unknown> = {
      ...(action.payloadDefaults || {}),
      ...formInput,
      ...actionInput,
    };

    const templates = actionFieldTemplates(action, sectionData?.payload, studentId);
    const missing = templates
      .filter((field) => field.required)
      .filter((field) => !cleanText(payload[field.key]))
      .map((field) => field.label);

    if (missing.length) {
      setMessage({
        type: "error",
        text: `Missing required action fields: ${missing.join(", ")}`,
      });
      return;
    }

    setPendingActionId(action.id);
    setMessage(null);

    try {
      const sessionId = getSessionId();
      const result = await executeErpAction({
        pageKey: actionPageKey,
        actionId: action.id,
        actionPayload: payload,
        method: action.execution?.method,
        url: action.execution?.url,
        sessionId: sessionId || undefined,
      });

      if (result.targetRoute) {
        navigate(result.targetRoute);
      }

      if (result.html && (result.printReady || /print/i.test(cleanText(action.label)))) {
        printHtmlDocument(result.html);
      }

      const successMessage = displayText(result.message, "Action executed successfully.");
      setMessage({ type: "success", text: successMessage });

      if (!result.targetRoute) {
        await loadPage(false);
      }
    } catch (err) {
      const apiError = err as ApiError;
      const isNotMapped =
        apiError.code === "ACTION_NOT_MAPPED" || /not mapped/i.test(cleanText(apiError.message));

      if (isNotMapped) {
        const route = deriveFallbackRoute(action);
        if (route) {
          setMessage({
            type: "info",
            text: "Action target is not mapped in ERP metadata. Redirected using fallback route.",
          });
          navigate(route);
          setPendingActionId("");
          return;
        }

        setMessage({
          type: "error",
          text: "Navigation action is available in ERP but this target is not mapped yet.",
        });
        setPendingActionId("");
        return;
      }

      setMessage({ type: "error", text: apiError.message || "Action execution failed." });
    } finally {
      setPendingActionId("");
    }
  };

  const renderActionControls = (sectionHint: ErpUiSection, sectionData: SectionData | null, actions: ErpAction[]) => {
    if (!actions.length) return null;

    return (
      <div className="mt-4 space-y-3">
        {actions.map((action) => {
          const templates = actionFieldTemplates(action, sectionData?.payload, studentId);
          const actionInput = actionValues[action.id] || {};
          const isBusy = pendingActionId === action.id;

          return (
            <div key={action.id} className="rounded-md border border-gray-200 p-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAction(sectionHint, sectionData, action)}
                  disabled={isBusy || action.enabled === false}
                  className="rounded bg-[#0A3035] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isBusy ? "Processing..." : displayText(action.label, "Run Action")}
                </button>

                {action.enabled === false && (
                  <span className="text-xs text-red-700">{displayText(action.disabledReason, "Disabled")}</span>
                )}
              </div>

              {templates.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {templates.map((field) => {
                    const value = cleanText(actionInput[field.key]);

                    if (field.type === "select") {
                      return (
                        <label key={field.key} className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">{field.label}</span>
                          <select
                            value={value}
                            onChange={(e) => updateActionField(action.id, field.key, e.target.value)}
                            className="rounded border border-gray-300 px-2 py-2"
                          >
                            <option value="">Select</option>
                            {(field.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          {field.helperText && <span className="text-xs text-gray-500">{field.helperText}</span>}
                        </label>
                      );
                    }

                    return (
                      <label key={field.key} className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{field.label}</span>
                        <input
                          value={value}
                          onChange={(e) => updateActionField(action.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          maxLength={field.maxLength}
                          className="rounded border border-gray-300 px-2 py-2"
                        />
                        {field.helperText && <span className="text-xs text-gray-500">{field.helperText}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderForms = (sectionHint: ErpUiSection) => {
    const forms = sectionHint.forms || [];
    if (!forms.length) return null;

    return (
      <div className="space-y-4">
        {forms.map((form: ErpForm, formIndex) => {
          const fields = form.fields || [];
          const formKey = cleanText(form.id || form.name || `form-${formIndex}`);

          return (
            <div key={formKey} className="rounded-md border border-gray-200 bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-gray-700">
                {displayText(form.name || form.id, `Form ${formIndex + 1}`)}
              </div>

              {fields.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {fields.map((field, fieldIndex) => {
                    const fieldKey = cleanText(field.name || field.id || `field-${fieldIndex}`);
                    if (!fieldKey) return null;

                    const value = cleanText(
                      formValues[
                      sectionCompositeId(
                        cleanText(sectionHint.sourcePageKey || primaryPageKey),
                        sectionHint.dropdown,
                        sectionHint.subitem
                      )
                      ]?.[fieldKey]
                    );

                    if (Array.isArray(field.options) && field.options.length > 0) {
                      return (
                        <label key={fieldKey} className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">{displayText(field.label || fieldKey, fieldKey)}</span>
                          <select
                            value={value}
                            onChange={(e) => updateFormField(sectionHint, fieldKey, e.target.value)}
                            disabled={Boolean(field.disabled || field.readOnly)}
                            className="rounded border border-gray-300 px-2 py-2"
                          >
                            <option value="">Select</option>
                            {field.options.map((option) => (
                              <option key={`${fieldKey}-${option.value}-${option.label}`} value={option.value}>
                                {displayText(option.label || option.value, cleanText(option.value))}
                              </option>
                            ))}
                          </select>
                          {field.helperText && <span className="text-xs text-gray-500">{displayText(field.helperText)}</span>}
                        </label>
                      );
                    }

                    return (
                      <label key={fieldKey} className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{displayText(field.label || fieldKey, fieldKey)}</span>
                        <input
                          type={cleanText(field.type || "text") || "text"}
                          value={value}
                          onChange={(e) => updateFormField(sectionHint, fieldKey, e.target.value)}
                          placeholder={displayText(field.placeholder)}
                          disabled={Boolean(field.disabled)}
                          readOnly={Boolean(field.readOnly)}
                          maxLength={typeof field.maxLength === "number" ? field.maxLength : undefined}
                          className="rounded border border-gray-300 px-2 py-2"
                        />
                        {field.helperText && <span className="text-xs text-gray-500">{displayText(field.helperText)}</span>}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTables = (sectionData: SectionData | null, actions: ErpAction[]) => {
    const tables = extractTables(sectionData?.payload);
    if (!tables.length) return <div className="text-sm text-gray-500">No table data available.</div>;

    return (
      <div className="space-y-4">
        {tables.map((rows, tableIdx) => {
          const rawHeaders = Array.from(
            rows.reduce((set, row) => {
              for (const key of Object.keys(row)) {
                // Ignore weird trailing duplicated headers parsed by scraper (e.g. SUBJECT_1)
                if (!/_\d+$/.test(key) && key !== "" && !/^col(16|17|18|19)$/.test(key)) {
                  set.add(key);
                }
              }
              return set;
            }, new Set<string>())
          );

          const timetableHeaderRowIndex =
            isTimetablePage
              ? rows.findIndex((row) => {
                const detailHeader = rawHeaders.find((header) => /details?|day/i.test(header)) || rawHeaders[rawHeaders.length - 1] || "";
                const slotHeaders = rawHeaders.filter((header) => header !== detailHeader);
                return (
                  slotHeaders.length >= 2 &&
                  slotHeaders.every((header) => isTimeRangeLabel(cleanText(row[header] ?? "")))
                );
              })
              : -1;

          const timetableScheduleView =
            isTimetablePage && timetableHeaderRowIndex >= 0
              ? (() => {
                const headerRow = rows[timetableHeaderRowIndex];
                const detailHeader =
                  rawHeaders.find((header) => /details?|day/i.test(header)) || rawHeaders[rawHeaders.length - 1] || "";
                const slotHeaders = rawHeaders.filter((header) => header !== detailHeader);
                const periodHeaders = slotHeaders.map((header, index) =>
                  cleanText(headerRow[header] ?? "") || `Period ${index + 1}`
                );
                const headers = ["Day", ...periodHeaders];
                const viewRows: TableRowView[] = rows.reduce<TableRowView[]>((acc, row, sourceRowIdx) => {
                  if (sourceRowIdx === timetableHeaderRowIndex) {
                    return acc;
                  }

                  const dayValue = cleanText(row[detailHeader] ?? row[rawHeaders[0]] ?? "");
                  if (!dayValue || isTimeRangeLabel(dayValue) || isWeekdayLabel(dayValue) === false) {
                    return acc;
                  }

                  const values: Record<string, string> = { Day: dayValue };
                  slotHeaders.forEach((header, index) => {
                    values[headers[index + 1]] = cleanText(row[header] ?? "") || "-";
                  });

                  acc.push({ sourceRowIdx, values });
                  return acc;
                }, []);

                return viewRows.length > 0 ? { headers, rows: viewRows } : null;
              })()
              : null;

          const tableView: { headers: string[]; rows: TableRowView[] } = timetableScheduleView || {
            headers: rawHeaders.map((header) => getTableHeaderLabel(header, isTimetablePage)),
            rows: rows.map((row, sourceRowIdx) => ({ sourceRowIdx, values: row as Record<string, string> })),
          };

          // Sanitize & Deduplicate rows: The scraper sometimes duplicates an entire table with _1 suffix keys or simply concatenates identically
          const uniqueRows: TableRowView[] = [];
          const seenSignatures = new Set<string>();

          for (const row of tableView.rows) {
            const values = Object.values(row.values).map((v) => String(v).trim());
            const nonEmpties = values.filter(v => v !== '');
            const isAllDashes = values.every(v => v === '-' || v === '_' || v === '');
            const isAllNumbers = values.every(v => /^[\d\s]+$/.test(v) || v === '');

            // Check if this row is just echoing the table keys (duplicate header row from scraper)
            const keys = Object.keys(row.values);
            const isEchoingKeys = keys.length > 0 && keys.every(k => {
              const val = String(row.values[k]).trim().toLowerCase();
              return val === '' || val === k.toLowerCase() || val === k.toLowerCase().replace(/_/g, ' ');
            });

            // Check if row is just a single merged string that matches the section title or a known junk header
            const uniqueVals = new Set(nonEmpties.map(v => v.toLowerCase()));
            const isJunkHeading = uniqueVals.size === 1 && (() => {
              const val = Array.from(uniqueVals)[0];
              if (val === (sectionData?.subitem || '').toLowerCase()) return true;
              if (val === 'earlier internal mark details') return true;
              return false;
            })();

            const hasCalculationJunk = Object.values(row.values).some(v => {
              const str = String(v).toLowerCase();
              return str.includes("attendance percentage calculation") ||
                str.includes("od/ml calculation") ||
                /^present\s*\(\s*p\s*\)$/.test(str) ||
                /^absent\s*\(\s*a\s*\)$/.test(str);
            });

            if (isAllDashes || isAllNumbers || isEchoingKeys || isJunkHeading || hasCalculationJunk) continue;

            // Build a strict signature of the core data to identify true duplicates based ONLY on visible UI columns
            const signature = tableView.headers
              .map(h => String(row.values[h] ?? row.values[`${h}_1`] ?? row.values[`${h}_2`] ?? '')
                .trim().toLowerCase().replace(/\s+/g, ''))
              .join('|');

            if (!signature || signature.replace(/\|/g, '').length < 3) continue; // Skip rows that are essentially empty or too small

            if (!seenSignatures.has(signature)) {
              seenSignatures.add(signature);
              uniqueRows.push(row);
            }
          }

          if (uniqueRows.length === 0) return null;

          return (
            <div key={`${sectionData?.id || "section"}-table-${tableIdx}`} className="erp-table-shell">
              <table className="erp-table table-fixed">
                <thead className="erp-table-head">
                  <tr>
                    {tableView.headers.map((header) => (
                      <th key={header} className="erp-table-head-cell break-words">
                        {displayText(header, "-").toUpperCase()}
                      </th>
                    ))}
                    {actions.some((action) => typeof action.tableRowIndex === "number") && (
                      <th className="erp-table-head-cell">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="erp-table-body">
                  {uniqueRows.map(({ sourceRowIdx, values: row }) => {
                    const rowActions = actions.filter((action) => action.tableRowIndex === sourceRowIdx);
                    return (
                      <tr key={`${tableIdx}-${sourceRowIdx}`} className="erp-table-row">
                        {tableView.headers.map((header) => (
                          <td key={`${sourceRowIdx}-${header}`} className="erp-table-cell break-words">
                            {displayText(row[header] ?? row[`${header}_1`] ?? row[`${header}_2`], "-")}
                          </td>
                        ))}
                        {actions.some((action) => typeof action.tableRowIndex === "number") && (
                          <td className="erp-table-cell">
                            {rowActions.length ? (
                              <div className="flex flex-wrap gap-2">
                                {rowActions.map((action) => (
                                  <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => handleAction(findUiSectionForData(sectionData), sectionData, action)}
                                    disabled={pendingActionId === action.id || action.enabled === false}
                                    className="rounded bg-[#0A3035] px-2 py-1 text-xs text-white disabled:opacity-50"
                                  >
                                    {pendingActionId === action.id ? "..." : displayText(action.label, "Run")}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  const findUiSectionForData = (sectionData: SectionData | null): ErpUiSection => {
    if (!sectionData) {
      return {
        sourcePageKey: primaryPageKey,
        dropdown: "Page",
        subitem: toPageTitle(primaryPageKey, title),
      };
    }

    const matched = (uiHints?.sections || []).find(
      (section) =>
        sectionCompositeId(
          cleanText(section.sourcePageKey || primaryPageKey),
          section.dropdown,
          section.subitem
        ) === sectionData.id
    );

    return (
      matched || {
        dropdown: sectionData.dropdown,
        subitem: sectionData.subitem,
      }
    );
  };

  const metaSource = displayText(pageResponse?.source, "unknown");
  const metaFetchedAt = displayText(pageResponse?.fetchedAt);
  usePageContrast(pageRef, [
    loading,
    loadError?.code,
    primaryPageKey,
    title,
    metaSource,
    metaFetchedAt,
    warnings.length,
    pendingActionId,
  ]);

  if (loading) {
    return (
      <div ref={pageRef} className="min-h-screen p-6 pb-10">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0A3035] border-b-transparent" />
          <span>Loading {toPageTitle(primaryPageKey, title)}...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    const isDriftError = [
      "INVALID_UPSTREAM_PAYLOAD",
      "PAYLOAD_CONTRACT_MISMATCH",
      "MISSING_ENDPOINT_MAPPING",
      "BATCH_KEY_MISSING",
    ].includes(cleanText(loadError.code).toUpperCase());
    const isAuthError =
      cleanText(loadError.code).toUpperCase() === "UNAUTHORIZED" || Number(loadError.status) === 401;

    return (
      <div ref={pageRef} className="min-h-screen p-6 pb-10">
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700 space-y-3">
          <div className="font-semibold">
            {isAuthError
              ? "ERP session expired."
              : isDriftError
                ? "ERP data changed upstream."
                : "Failed to load ERP page."}
          </div>
          <div>
            {displayText(
              loadError.message,
              isAuthError ? "Redirecting to sign in..." : "Failed to load ERP page"
            )}
          </div>
          <div className="text-xs text-red-800">
            Code: {displayText(loadError.code, "UNKNOWN")} | Status: {Number(loadError.status || 500)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadPage(true)}
              className="rounded border border-red-400 bg-white px-3 py-2 text-sm font-medium text-red-700"
            >
              Retry
            </button>
            {isAuthError && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="rounded border border-red-400 bg-white px-3 py-2 text-sm font-medium text-red-700"
              >
                Sign In Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef}>
      <ErpPageShell
        title={toPageTitle(primaryPageKey, title)}
        source={metaSource as any}
        updatedAt={metaFetchedAt}
        isLoading={loading}
        onRefresh={() => loadPage(true)}
      >
        <div className="space-y-6">

          {message && (
            <div
              className={`rounded p-3 text-sm ${message.type === "error"
                  ? "border border-red-300 bg-red-50 text-red-700"
                  : message.type === "success"
                    ? "border border-green-300 bg-green-50 text-green-700"
                    : "border border-blue-300 bg-blue-50 text-blue-700"
                }`}
            >
              {displayText(message.text)}
            </div>
          )}

        {keyDiagnostics.length > 0 && (
          <div className="hidden">
            <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-700">
              <div className="font-semibold">Fetch Diagnostics</div>
              <div className="erp-table-shell mt-2 shadow-none">
                <table className="erp-table text-left">
                  <thead className="erp-table-head">
                    <tr>
                      <th className="erp-table-head-cell">Key</th>
                      <th className="erp-table-head-cell">Source</th>
                      <th className="erp-table-head-cell">Code</th>
                      <th className="erp-table-head-cell">Fetched</th>
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {keyDiagnostics.map((item, index) => (
                      <tr key={`${item.pageKey}-${item.code || item.source}-${index}`} className="erp-table-row">
                        <td className="erp-table-cell">{item.pageKey}</td>
                        <td className="erp-table-cell">{displayText(item.source, "-")}</td>
                        <td className="erp-table-cell">{displayText(item.code || item.error, "-")}</td>
                        <td className="erp-table-cell">{displayText(item.fetchedAt, "-")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {documentForRender ? (
            <ErpDocumentRenderer document={documentForRender} refreshDocument={() => loadPage(false)} />
          ) : (() => {
            const renderedSectionKeys = new Set<string>();

            const renderedBlocks = blocks.map((block) => {
              const sectionData = findSectionByRef(sections, block.section);
              const sectionHint = findUiSectionForData(sectionData);
              const actions = (uiHints?.sections || [])
                .find(
                  (section) =>
                    sectionCompositeId(
                      cleanText(section.sourcePageKey || primaryPageKey),
                      section.dropdown,
                      section.subitem
                    ) ===
                    sectionCompositeId(
                      cleanText(sectionHint.sourcePageKey || sectionData?.sourcePageKey || primaryPageKey),
                      sectionHint.dropdown,
                      sectionHint.subitem
                    )
                )
                ?.actions || [];

              const uniqueKey = `${block.type}-${sectionData?.id || sectionHint.subitem}`;
              if (renderedSectionKeys.has(uniqueKey)) return null;

              if (block.type === "stats") {
                return null;
              }

              if (block.type === "card") {
                const summaryText = extractSummaryText(sectionData?.payload);
                const hasTables = extractTables(sectionData?.payload).length > 0;
                const hasForms = Boolean((sectionHint.forms || []).length);
                const hasActions = actions.length > 0;

                if (hasTables || hasForms) {
                  return null;
                }

                if (!summaryText && !hasActions) {
                  return null;
                }

                renderedSectionKeys.add(uniqueKey);
                return (
                  <section key={block.id} className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-xl p-6 shadow-sm overflow-hidden">
                    {(() => {
                      const headingText = displayText(sectionHint.pageHeading || sectionHint.subitem || sectionData?.subitem, "Section");
                      if (headingText.toLowerCase() === toPageTitle(primaryPageKey, title).toLowerCase() || headingText.toLowerCase() === "page") return null;
                      return <h3 className="mb-4 text-xl font-bold text-[var(--text-primary)] tracking-tight">{headingText}</h3>;
                    })()}
                    {(() => {
                      if (block.showDescription === false || !summaryText) return null;
                      const headingText = displayText(sectionHint.pageHeading || sectionHint.subitem || sectionData?.subitem, "Section");

                      // Sanitize redundant substrings from the summary (e.g., repeating the title or displaying duplicate date ranges)
                      let cleanSummary = summaryText;
                      if (cleanSummary.toLowerCase().includes(headingText.toLowerCase())) {
                        cleanSummary = cleanSummary.replace(new RegExp(headingText, 'ig'), '').trim();
                      }

                      // Sometimes "DURING THE PERIOD" is concatenated twice by the parser
                      if (cleanSummary.includes("DURING THE PERIOD")) {
                        const match = cleanSummary.match(/DURING THE PERIOD.*?[0-9]{4}/i);
                        if (match) {
                          // If it appears more than once, just show it once
                          cleanSummary = match[0];
                        }
                      }

                      if (!cleanSummary || cleanSummary.length < 3) return null;

                      return <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{cleanSummary}</p>;
                    })()}
                    {block.showActions && renderActionControls(sectionHint, sectionData, actions)}
                  </section>
                );
              }

              if (block.type === "form") {
                const hasForms = Boolean((sectionHint.forms || []).length);
                if (!hasForms && block.visibleWhenEmpty === false) return null;

                renderedSectionKeys.add(uniqueKey);
                return (
                  <section key={block.id} className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-xl p-6 shadow-sm overflow-hidden">
                    {(() => {
                      const headingText = displayText(sectionHint.subitem, "Form");
                      if (headingText.toLowerCase() === toPageTitle(primaryPageKey, title).toLowerCase() || headingText.toLowerCase() === "page") return null;
                      return <h3 className="mb-6 text-xl font-bold text-[var(--text-primary)] tracking-tight">{headingText}</h3>;
                    })()}
                    {renderForms(sectionHint)}
                    {block.showActions && renderActionControls(sectionHint, sectionData, actions)}
                  </section>
                );
              }

              if (block.type === "list") {
                return null;
              }

              if (block.type === "table") {
                const tables = extractTables(sectionData?.payload);
                if (!tables.length && block.visibleWhenEmpty === false) return null;
                if (!tables.length) return null;

                renderedSectionKeys.add(uniqueKey);
                return (
                  <section key={block.id} className="rounded-2xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-xl p-6 shadow-sm overflow-hidden">
                    {(() => {
                      const headingText = displayText(sectionHint.subitem, "Data");
                      if (headingText.toLowerCase() === toPageTitle(primaryPageKey, title).toLowerCase() || headingText.toLowerCase() === "page" || headingText.toLowerCase() === "information") return null;
                      return <h3 className="mb-6 text-xl font-bold text-[var(--text-primary)] tracking-tight">{headingText}</h3>;
                    })()}
                    {renderTables(sectionData, actions)}
                    {!block.showActions && renderActionControls(sectionHint, sectionData, actions.filter((a) => typeof a.tableRowIndex !== "number"))}
                  </section>
                );
              }

              return null;
            });

            const isPageEmpty = renderedBlocks.every(block => block === null);

            if (isPageEmpty) {
              return (
                <div className="flex flex-col items-center justify-center p-16 text-center bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] rounded-2xl border border-[color-mix(in_srgb,var(--border)_50%,transparent)] shadow-sm">
                  <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl opacity-60 grayscale">📄</span>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Content Available</h3>
                  <p className="text-[var(--text-secondary)] text-sm max-w-sm">
                    There are no records, forms, or data matrices currently logged for this section.
                  </p>
                </div>
              );
            }

            return renderedBlocks;
          })()}
        </div>
        </div>
      </ErpPageShell>
    </div>
  );
}
