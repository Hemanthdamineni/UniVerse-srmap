/**
 * Shared document utilities extracted from MappedErpPage.
 *
 * These functions handle ERP document type-checking, text collection,
 * deduplication, and combination — used by DocumentErpPage and any
 * page that processes the backend's `document` tree.
 */
import type { ErpDocument, ErpNode, ErpPageResponse } from "./erpApi";
import { sanitizeErpDisplayText } from "./erpDisplayText";

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("text" in record) return cleanText(record.text);
    if ("label" in record) return cleanText(record.label);
    if ("value" in record) return cleanText(record.value);
    return "";
  }
  return "";
}

const DOCUMENT_TEXT_NOISE_PATTERN =
  /(function\s+[a-z0-9_]+\s*\(|\$\(|\.jsp\b|validationengine|ajaxparameter|e\.preventdefault|window\.open|document\.getelementbyid|@page\b|^var\s+[a-z0-9_]+\s*=|font-size\s*:|font-family\s*:|background(?:-color)?\s*:|text-align\s*:|font-weight\s*:|padding\s*:|border(?:-collapse)?\s*:|color\s*:|dialog\(|alert\(|\$.post\(|\$.ajax\()/i;

const USER_FACING_TEXT_HINT_PATTERN =
  /(note:|not registered|not applicable|open soon|registration closed|registered successfully|completed successfully|allowed only between|please select carefully|helpdesk|feedback not enabled|no content available|attendance code|online attendance)/i;

/** Type guard: checks if an unknown value conforms to the ErpDocument shape. */
export function isErpDocument(value: unknown): value is ErpDocument {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    isRecord(value.root) &&
    typeof value.root.id === "string" &&
    typeof value.root.type === "string" &&
    Array.isArray(value.root.children)
  );
}

/** Collects up to `limit` displayable text strings from a document node tree. */
export function collectDocumentText(node: ErpNode | undefined, limit = 16, bucket: string[] = []): string[] {
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

/** Checks if a document node tree contains renderable interactive/visual nodes. */
export function hasRenderableDocumentNodes(node: ErpNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "table" || node.type === "form" || node.type === "field" || node.type === "button") {
    return true;
  }

  return Array.isArray(node.children) ? node.children.some((child) => hasRenderableDocumentNodes(child)) : false;
}

/** Determines if a document has meaningful content worth rendering. */
export function isMeaningfulDocument(document: ErpDocument): boolean {
  if (!document?.root) return false;
  if (hasRenderableDocumentNodes(document.root)) return true;

  const textSample = collectDocumentText(document.root).join(" ");
  const normalized = cleanText(textSample);
  if (!normalized) return false;

  const displayText = sanitizeErpDisplayText(normalized, "");
  if (USER_FACING_TEXT_HINT_PATTERN.test(displayText || normalized)) {
    return true;
  }

  return !DOCUMENT_TEXT_NOISE_PATTERN.test(normalized);
}

function normalizeTitle(value: string) {
  return sanitizeErpDisplayText(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shouldPreferKeyHint(documentTitle: string, keyHint: string) {
  const normalizedDocumentTitle = normalizeTitle(documentTitle);
  const normalizedKeyHint = normalizeTitle(keyHint);

  if (!normalizedKeyHint) return false;
  if (!normalizedDocumentTitle) return true;
  if (normalizedDocumentTitle === normalizedKeyHint) return false;

  if (normalizedDocumentTitle === "course registration" && normalizedKeyHint.includes("cancellation")) {
    return true;
  }

  if (normalizedDocumentTitle === "sap registration" && normalizedKeyHint.includes("sap process")) {
    return true;
  }

  if (/^sap (attachments|details|feedback|withdraw)$/.test(normalizedKeyHint)) {
    return true;
  }

  return false;
}

function documentWithResolvedTitle(
  document: ErpDocument,
  sourceRecord: PlainRecord,
  keyHint = ""
): ErpDocument {
  const documentTitle = cleanText(document.title);
  const recordTitle = cleanText(sourceRecord.title);
  const resolvedTitle =
    shouldPreferKeyHint(documentTitle || recordTitle, keyHint)
      ? cleanText(keyHint)
      : documentTitle || recordTitle || cleanText(keyHint);

  const displayTitle = sanitizeErpDisplayText(resolvedTitle, resolvedTitle);
  if (!displayTitle || displayTitle === document.title) return document;
  return { ...document, title: displayTitle };
}

const EXPECTED_DOCUMENT_TITLE_HINTS: Record<string, string[]> = {
  "sap/sap-process": ["sap process", "sap registration"],
  "sap/withdraw": ["sap withdraw"],
  "sap/details": ["sap details"],
  "sap/attachments": ["sap attachments"],
  "sap/feedback": ["sap feedback"],
};

function filterDocumentsForPageKey(pageKey: string, documents: ErpDocument[]) {
  const expectedTitles = EXPECTED_DOCUMENT_TITLE_HINTS[pageKey];
  if (!expectedTitles?.length) return documents;

  return documents.filter((document) => {
    const normalizedTitle = normalizeTitle(document.title);
    return expectedTitles.some((expectedTitle) => normalizedTitle.includes(expectedTitle));
  });
}

function safeNodeId(value: string, fallback: string) {
  const normalized = normalizeTitle(value).replace(/\s+/g, "-");
  return normalized || fallback;
}

function tableNodeFromParsedRows(table: unknown, tableIndex: number, keyHint: string): ErpNode | null {
  if (!Array.isArray(table)) return null;

  const sourceRows = table.filter((row): row is PlainRecord => isRecord(row));
  if (!sourceRows.length) return null;

  const columnKeys = Array.from(
    new Set(sourceRows.flatMap((row) => Object.keys(row).filter((key) => cleanText(key))))
  );
  if (!columnKeys.length) return null;

  return {
    id: `${safeNodeId(keyHint, "parsed-table")}-table-${tableIndex + 1}`,
    type: "table",
    props: {
      columns: columnKeys.map((key) => ({ key, label: sanitizeErpDisplayText(key, key) })),
      rows: sourceRows.map((row, rowIndex) => ({
        key: `row-${rowIndex + 1}`,
        values: Object.fromEntries(columnKeys.map((key) => [key, row[key] ?? ""])),
      })),
    },
    children: [],
  };
}

function parsedTableEchoesText(table: unknown, text: string) {
  if (!Array.isArray(table) || table.length !== 1) return false;
  const [row] = table;
  if (!isRecord(row)) return false;

  const values = Object.entries(row)
    .flatMap(([key, value]) => [cleanText(key), cleanText(value)])
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length !== 1) return false;

  return cleanText(text).toLowerCase().includes(uniqueValues[0].toLowerCase());
}

function firstTableHeaderIndex(text: string, tables: unknown) {
  if (!Array.isArray(tables)) return -1;

  for (const table of tables) {
    if (!Array.isArray(table)) continue;
    const firstRow = table.find((row) => isRecord(row));
    if (!firstRow || !isRecord(firstRow)) continue;

    for (const key of Object.keys(firstRow)) {
      const header = cleanText(key);
      if (!header || header.length < 3) continue;
      const index = text.toLowerCase().indexOf(header.toLowerCase());
      if (index >= 0) return index;
    }
  }

  return -1;
}

function displayTextFromParsedSection(section: PlainRecord, keyHint = "") {
  const title = cleanText(section.title) || cleanText(keyHint);
  const rawText = cleanText(section.text);
  if (!rawText) return "";

  if (normalizeTitle(title) === "sap process" && /sap registration/i.test(rawText)) {
    return "SAP Registration Note: Students will be allowed to register one time, hence, please select carefully.";
  }

  let text = rawText;
  if (normalizeTitle(title) === "student attendance") {
    const attendanceStart = text.search(/\bCurrent Attendance\b/i);
    if (attendanceStart >= 0) {
      text = text.slice(attendanceStart);
    }
  }

  const tableHeaderIndex = firstTableHeaderIndex(text, section.tables);
  if (tableHeaderIndex > 0) {
    text = text.slice(0, tableHeaderIndex);
  }

  return sanitizeErpDisplayText(text, text)
    .replace(/\bCourse Registered successfully\b/i, "Registration completed successfully")
    .trim();
}

function documentFromParsedSection(section: PlainRecord, keyHint = ""): ErpDocument | null {
  const title = cleanText(section.title) || cleanText(keyHint);
  const children: ErpNode[] = [];
  const text = displayTextFromParsedSection(section, keyHint);

  if (text) {
    children.push({
      id: `${safeNodeId(title || keyHint, "parsed-section")}-text`,
      type: "text",
      props: { text },
      children: [],
    });
  }

  if (Array.isArray(section.tables)) {
    section.tables.forEach((table, tableIndex) => {
      if (text && parsedTableEchoesText(table, text)) return;
      const tableNode = tableNodeFromParsedRows(table, tableIndex, title || keyHint);
      if (tableNode) children.push(tableNode);
    });
  }

  if (!children.length) return null;

  const document: ErpDocument = {
    title: sanitizeErpDisplayText(title, title || "ERP Document"),
    root: {
      id: `${safeNodeId(title || keyHint, "parsed-section")}-root`,
      type: "container",
      props: title ? { title } : {},
      children,
    },
  };

  return isMeaningfulDocument(document)
    ? documentWithResolvedTitle(document, section, keyHint)
    : null;
}

/** Walks a data payload to find embedded ErpDocument instances at any depth. */
export function collectEmbeddedDocumentsFromPayload(payload: unknown): ErpDocument[] {
  const documents: ErpDocument[] = [];
  const queue: Array<{ value: unknown; keyHint?: string }> = [{ value: payload }];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const entry = queue.shift();
    const current = entry?.value;
    if (current == null) continue;

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push({ value: item, keyHint: entry?.keyHint }));
      continue;
    }

    if (!isRecord(current) || seen.has(current)) continue;
    seen.add(current);

    if (isErpDocument(current.document) && isMeaningfulDocument(current.document)) {
      documents.push(documentWithResolvedTitle(current.document, current, entry?.keyHint));
    }

    const parsedDocument = documentFromParsedSection(current, entry?.keyHint);
    if (parsedDocument) {
      documents.push(parsedDocument);
    }

    Object.entries(current).forEach(([key, value]) => {
      if (key === "document") return;
      const keyHint = entry?.keyHint === "SAP" && !/^sap\b/i.test(key) ? `SAP ${key}` : key;
      queue.push({ value, keyHint });
    });
  }

  return documents;
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

/** Generates a structural signature of a document node for deduplication. */
export function documentNodeSignature(node: ErpNode | undefined): unknown {
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

/** Deduplicates and merges multiple ErpDocument instances into one. */
export function combineDocuments(documents: ErpDocument[], title: string): ErpDocument | null {
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

/**
 * Builds a combined document from batch responses for multiple page keys.
 * This is the primary entry point used by DocumentErpPage.
 */
export function buildCombinedDocumentForKeys(
  pageKeys: string[],
  responsesByKey: Record<string, ErpPageResponse>,
  pageTitle: string
): ErpDocument | null {
  const documents = pageKeys
    .flatMap((key) => {
      const response = responsesByKey[key];
      if (!response) return [];

      const embeddedDocuments = collectEmbeddedDocumentsFromPayload(response.data);
      const responseDocuments = response.document && isMeaningfulDocument(response.document)
        ? [documentWithResolvedTitle(response.document, response as unknown as PlainRecord, key)]
        : [];

      return filterDocumentsForPageKey(key, [...responseDocuments, ...embeddedDocuments]);
    });

  return combineDocuments(documents, pageTitle);
}
