import { extractGenericTables, normalizeRawCell, normalizeRawValue, readBundledPageData } from "./shared";
import type {
  AttendanceRecord,
  ErpGenericTable,
  AttendanceModel,
  TimetableSlot,
  TimetableDay,
  TimetableSubject,
  TimetableModel,
  CourseRegistrationSubject,
  CourseRegistrationModel,
  CurriculumSubject,
  CurriculumModel,
  CurrentResultSubject,
  CurrentResultModel,
  FeeDueRecord,
  FeeDuesModel,
  StudentProfile,
  InternalMarkAssessment,
  InternalMarkSubject,
  InternalMarksModel,
  FieldType,
  SchemaField,
  SchemaDefinition,
  FeePaidRecord,
  FeePaidSourceSummary,
  FeePaidColumn,
  FeePaidSectionRow,
  FeePaidSection,
  FeePaidDuplicateConflict,
  FeePaidIntegritySummary,
  FeesPaidModel,
  BankDetailField,
  BankDetailsModel,
  RoomDetailField,
  RoomDetailsModel,
  SapScholarshipRecord,
  SapScholarshipsModel,
  FaqsModel,
  RefundChangeModel,
  TransformerFn,
  TransformerOutput
} from "./types";

export function transformFeeDues(rawData: unknown): Partial<FeeDuesModel> {
  if (!rawData || typeof rawData !== "object") return { noDues: true, records: [] };
  
  const root = rawData as Record<string, unknown>;

  // Try both possible section structures:
  // 1. Finance -> "Fee Due Details" (from studentreportresources.jsp)
  // 2. Finance -> "Fee Due Groups" (from feeduegroups.jsp)
  // 3. Direct root with tables (raw parsed response)
  const finance = root.Finance as Record<string, unknown> | undefined;
  const section =
    (finance?.["Fee Due Details"] as Record<string, unknown> | undefined) ||
    (finance?.["Fee Due Groups"] as Record<string, unknown> | undefined) ||
    (finance?.["Dues"] as Record<string, unknown> | undefined) ||
    root;
  const title = normalizeRawValue((section as Record<string, unknown>).title) || "Fee Dues";
  const records: FeeDueRecord[] = [];
  let noDues = false;

  // Locate the table: may be nested under section.tables or directly root.tables
  const rawTables = (section as Record<string, unknown>).tables;
  const tables = Array.isArray(rawTables) ? rawTables : (Array.isArray(root.tables) ? root.tables : null);

  if (tables && Array.isArray(tables[0])) {
    const table = tables[0] as Record<string, unknown>[];
    for (const record of table) {
      if (!record || typeof record !== "object") continue;
      const r = record as Record<string, unknown>;
      
      // Detect the "No fee dues" sentinel row
      const firstCellValue = normalizeRawValue(r["Sl.No."] ?? r["Fee Category"] ?? Object.values(r)[0]);
      if (/no fee dues/i.test(firstCellValue)) {
        noDues = true;
        break;
      }

      const slNo = normalizeRawValue(r["Sl.No."]);
      const cat = normalizeRawValue(r["Fee Category"]);
      const head = normalizeRawValue(r["Fee Head"]);
      const isTotalRow = /total/i.test(slNo) && !head && !cat;

      if (isTotalRow) {
        records.push({
          category: slNo,
          head: "",
          dueAmount: normalizeRawValue(r["Due Amount (INR)"]),
          collectedAmount: normalizeRawValue(r["Collected (INR)"]),
          toBePaidAmount: normalizeRawValue(r["To be Paid Amount (INR)"]),
        });
      } else if (cat || head) {
        records.push({
          category: cat,
          head: head,
          dueAmount: normalizeRawValue(r["Due Amount (INR)"]),
          collectedAmount: normalizeRawValue(r["Collected (INR)"]),
          toBePaidAmount: normalizeRawValue(r["To be Paid Amount (INR)"]),
        });
      }
    }
  } else {
    noDues = true;
  }

  return { title, records, noDues: noDues || records.length === 0 };
}

const FEE_PAID_SOURCES = [
  {
    pageKey: "finance/fee-paid-details",
    label: "Fee Paid Details",
    dropdown: "Finance",
    subitem: "Fee Paid Details",
    priority: 1,
  },
  {
    pageKey: "finance/payment-acknowledgment",
    label: "Payment Acknowledgment",
    dropdown: "Finance",
    subitem: "Payment Acknowledgment",
    priority: 0,
  },
  {
    pageKey: "finance/online-payment-verification",
    label: "Online Payment Verification",
    dropdown: "Finance",
    subitem: "Online Payment Verification",
    priority: 2,
  },
] as const;

type FeePaidSourceConfig = (typeof FEE_PAID_SOURCES)[number];

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStablePart(value: unknown) {
  return normalizeRawValue(value, "-").toLowerCase().replace(/\s+/g, " ").trim();
}

function stableHash(parts: string[]) {
  const joined = parts.map((part) => normalizeStablePart(part)).join("|");
  let hash = 2166136261;
  for (let index = 0; index < joined.length; index += 1) {
    hash ^= joined.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function unwrapFeePaidBatchEntry(value: unknown): {
  data: unknown;
  failed: boolean;
  error: string;
  warnings: string[];
} {
  if (!isRecordValue(value)) {
    return { data: value, failed: false, error: "", warnings: [] };
  }

  if (value.success === false) {
    return {
      data: null,
      failed: true,
      error: normalizeRawValue(value.error) || "ERP source failed",
      warnings: [],
    };
  }

  const looksLikePageEnvelope =
    "data" in value &&
    ("pageKey" in value || "source" in value || "fetchedAt" in value || "policyMode" in value || "meta" in value);

  return {
    data: looksLikePageEnvelope ? value.data : value,
    failed: false,
    error: "",
    warnings: Array.isArray(value.warnings)
      ? value.warnings.map((warning) => normalizeRawValue(warning)).filter(Boolean)
      : [],
  };
}

function getFeePaidSourceEntry(root: Record<string, unknown>, source: FeePaidSourceConfig): unknown {
  if (Object.prototype.hasOwnProperty.call(root, source.pageKey)) {
    return root[source.pageKey];
  }

  return root;
}

function findFeePaidSourceSection(data: unknown, source: FeePaidSourceConfig): Record<string, unknown> | null {
  if (!isRecordValue(data)) return null;

  const finance = data[source.dropdown] as Record<string, unknown> | undefined;
  const exact = finance?.[source.subitem];
  if (isRecordValue(exact)) return exact;

  if (Array.isArray(data.tables)) return data;

  const wantedSubitem = source.subitem.toLowerCase();
  const wantedLabel = source.label.toLowerCase();
  const stack: Record<string, unknown>[] = [data];
  const visited = new Set<Record<string, unknown>>();

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const title = normalizeRawValue(current.title).toLowerCase();
    if (Array.isArray(current.tables) && (title === wantedSubitem || title === wantedLabel)) {
      return current;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === "rawHtml" || key === "document") continue;
      if (key.toLowerCase() === wantedSubitem && isRecordValue(value)) return value;
      if (isRecordValue(value)) stack.push(value);
    }
  }

  return null;
}

function readPrintAction(row: Record<string, unknown>) {
  const cells = ["Print", "Action", "Actions", "", "col6", "col7"]
    .map((key) => row[key])
    .filter(Boolean);
  for (const value of Object.values(row)) {
    if (value && typeof value === "object") cells.push(value);
  }

  for (const cell of cells) {
    if (!isRecordValue(cell)) continue;
    const props = cell.props;
    const action = isRecordValue(props) ? props.action : undefined;
    if (!isRecordValue(action)) continue;

    const target = typeof action.target === "string" ? action.target : normalizeRawValue(action.target);
    const match = target.match(/receiptid=(\d+)/i);
    return {
      receiptId: match?.[1] || null,
      actionId: normalizeRawValue(cell.id) || null,
    };
  }

  return { receiptId: null, actionId: null };
}

function normalizeRowValues(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = normalizeRawCell(value);
  }
  return result;
}

function buildSectionColumnDefs(
  rows: Record<string, unknown>[]
): FeePaidColumn[] {
  if (rows.length === 0) return [];

  const keysInOrder = new Map<string, number>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!keysInOrder.has(key)) {
        keysInOrder.set(key, keysInOrder.size);
      }
    }
  }

  const labelRow = rows.find((row) => {
    const colValues = Object.entries(row)
      .filter(([k]) => k.startsWith("col"))
      .map(([, v]) => String(v || ""));
    return colValues.some((v) => v && v.length < 30 && !/\d/.test(v));
  });

  const excludedKeys = new Set(["rawHtml", "document"]);

  return Array.from(keysInOrder.entries())
    .filter(([key]) => !excludedKeys.has(key))
    .filter(([key]) =>
      rows.some((r) => {
        const v = r[key];
        return v && typeof v === "string" && v.trim() !== "";
      })
    )
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => {
      const labelRowValue = labelRow?.[key];
      const hasLabel =
        labelRowValue &&
        typeof labelRowValue === "string" &&
        labelRowValue.trim() &&
        labelRowValue.trim() !== key;
      return {
        key,
        label: hasLabel ? labelRowValue!.trim() : key,
      };
    });
}

function extractFeePaidSectionRow(
  row: Record<string, unknown>
): FeePaidSectionRow {
  const cells = normalizeRowValues(row);
  const print = readPrintAction(row);
  return {
    cells,
    printActionId: print.actionId,
    printReceiptId: print.receiptId,
    stableKey: stableHash(Object.values(cells)),
  };
}

export function transformFeesPaid(rawData: unknown): Partial<FeesPaidModel> {
  const title = "Payment Receipts";
  const emptyIntegrity: FeePaidIntegritySummary = {
    sourceCount: 0,
    rawRowCount: 0,
    extractedRowCount: 0,
    deduplicatedRowCount: 0,
    duplicateCount: 0,
    warningCount: 0,
  };

  if (!rawData || typeof rawData !== "object") {
    return { title, records: [], sections: [], sources: [], duplicates: [], warnings: ["No fee-paid payload was provided."], integrity: emptyIntegrity };
  }

  const root = rawData as Record<string, unknown>;
  const sources: FeePaidSourceSummary[] = [];
  const warnings: string[] = [];
  const sections: FeePaidSection[] = [];
  const allRecords: FeePaidRecord[] = [];

  for (const source of FEE_PAID_SOURCES) {
    const entry = getFeePaidSourceEntry(root, source);
    const envelope = unwrapFeePaidBatchEntry(entry);
    const sourceWarnings = [...envelope.warnings];

    if (envelope.failed) {
      sourceWarnings.push(`${source.label} failed: ${envelope.error}`);
      sources.push({
        sourcePageKey: source.pageKey,
        sourceLabel: source.label,
        status: "failed",
        tableCount: 0,
        rowCount: 0,
        extractedCount: 0,
        droppedRowCount: 0,
        warnings: sourceWarnings,
      });
      warnings.push(...sourceWarnings);
      continue;
    }

    const section = findFeePaidSourceSection(envelope.data, source);
    const tables = Array.isArray(section?.tables) ? section.tables : [];
    let rowCount = 0;
    const rawRows: Record<string, unknown>[] = [];

    tables.forEach((table) => {
      if (!Array.isArray(table)) return;
      table.forEach((row) => {
        if (!isRecordValue(row)) return;
        rowCount += 1;
        rawRows.push(row);
      });
    });

    if (!section) {
      sourceWarnings.push(`${source.label} section was not present in the ERP payload.`);
    } else if (rowCount === 0) {
      sourceWarnings.push(`${source.label} returned zero rows.`);
    }

    sources.push({
      sourcePageKey: source.pageKey,
      sourceLabel: source.label,
      status: !section ? "missing" : rowCount === 0 ? "empty" : "loaded",
      tableCount: tables.length,
      rowCount,
      extractedCount: rowCount,
      droppedRowCount: 0,
      warnings: sourceWarnings,
    });
    warnings.push(...sourceWarnings);

    if (rawRows.length === 0) continue;

    const columns = buildSectionColumnDefs(rawRows);
    const sectionRows: FeePaidSectionRow[] = rawRows.map((row) =>
      extractFeePaidSectionRow(row)
    );

    sections.push({
      sourceLabel: source.label,
      sourcePageKey: source.pageKey,
      columns,
      rows: sectionRows,
      tableCount: tables.length,
      extractedCount: rawRows.length,
    });
  }

  return {
    title,
    records: allRecords,
    sections,
    sources,
    duplicates: [],
    warnings,
    integrity: {
      sourceCount: sources.length,
      rawRowCount: sources.reduce((sum, s) => sum + s.rowCount, 0),
      extractedRowCount: sources.reduce((sum, s) => sum + s.extractedCount, 0),
      deduplicatedRowCount: sources.reduce((sum, s) => sum + s.extractedCount, 0),
      duplicateCount: 0,
      warningCount: warnings.length,
    },
  };
}

export function transformBankDetails(rawData: unknown): Partial<BankDetailsModel> {
  if (!rawData || typeof rawData !== "object") return { fields: [], isForm: true };

  const root = rawData as Record<string, unknown>;
  const finance = root.Finance as Record<string, unknown> | undefined;
  // Try both section key variants
  const section =
    (finance?.["Bank Account Details"] as Record<string, unknown> | undefined) ||
    (finance?.["Bank Details"] as Record<string, unknown> | undefined) ||
    root;
  const title = normalizeRawValue((section as Record<string, unknown>).title) || "Bank Details";
  const fields: BankDetailField[] = [];

  // Detect form pages by the raw text containing JS form artifacts.
  // The bank details page is always an input form — never a display page.
  const rawText = normalizeRawValue((section as Record<string, unknown>).text);
  const isFormPage =
    /validationengine|funSave|btnSave|txtBeneficiary|input,select/i.test(rawText) ||
    /please enter your bank details/i.test(rawText);

  if (isFormPage) {
    // It's a form — return immediately with isForm: true
    return { title, fields: [], isForm: true };
  }

  // Non-form path: read actual stored bank data from TableContent (key-value map)
  const tableContent = (section as Record<string, unknown>).TableContent as Record<string, unknown> | undefined;
  if (tableContent && typeof tableContent === "object") {
    for (const [key, value] of Object.entries(tableContent)) {
      const label = normalizeRawValue(key);
      const val = normalizeRawValue(value);
      if (label && label !== ":" && !label.toLowerCase().includes("please enter")) {
        fields.push({ label, value: val || "—" });
      }
    }
  }

  // Fallback: extract from tables if TableContent is empty (stored data format)
  if (fields.length === 0) {
    const tables = (section as Record<string, unknown>).tables as Array<Array<Record<string, unknown>>> | undefined;
    if (tables && Array.isArray(tables[0])) {
      for (const row of tables[0]) {
        if (!row || typeof row !== "object") continue;
        const entries = Object.entries(row);
        if (entries.length >= 2) {
          const label = normalizeRawValue(entries[0][1]);
          const value = normalizeRawValue(entries[1][1]);
          if (label && label.length <= 60 && value && value.length < 200) {
            fields.push({ label: label.replace(/\*$/, "").trim(), value });
          }
        }
      }
    }
  }

  const isForm = fields.length === 0;
  return { title, fields, isForm };
}

export function transformRoomDetails(rawData: unknown): Partial<RoomDetailsModel> {
  if (!rawData || typeof rawData !== "object") return { fields: [], noRoom: true };

  const root = rawData as Record<string, unknown>;
  const hostel = root.Hostel as Record<string, unknown> | undefined;
  const section = (hostel?.["Room Details"] as Record<string, unknown> | undefined) || root;
  const title = normalizeRawValue(section.title) || "Room Details";
  const fields: RoomDetailField[] = [];

  const tableContent = section.TableContent as Record<string, unknown> | undefined;
  if (tableContent && typeof tableContent === "object") {
    for (const [key, value] of Object.entries(tableContent)) {
      const label = normalizeRawValue(key);
      const val = normalizeRawValue(value);
      if (label && label !== ":") {
        fields.push({ label, value: val || "—" });
      }
    }
  }

  if (fields.length === 0) {
    const tables = section.tables as Array<Array<Record<string, unknown>>> | undefined;
    if (tables && Array.isArray(tables[0])) {
      for (const row of tables[0]) {
        if (!row || typeof row !== "object") continue;
        const entries = Object.entries(row);
        if (entries.length >= 2) {
          fields.push({
            label: normalizeRawValue(entries[0][1]),
            value: normalizeRawValue(entries[1][1]),
          });
        }
      }
    }
  }

  // Check if text content indicates no room assignment
  const text = normalizeRawValue(section.text);
  const noRoom = fields.length === 0 || /no (hostel|room)|not (assigned|allocated|applicable)/i.test(text);

  return { title, fields, noRoom };
}

export function transformSapScholarships(rawData: unknown): Partial<SapScholarshipsModel> {
  if (!rawData || typeof rawData !== "object") return { tables: [], message: "" };

  const root = rawData as Record<string, unknown>;
  const sap = root.SAP as Record<string, unknown> | undefined;
  const tables: SapScholarshipRecord[][] = [];
  let title = "SAP & Scholarships";
  let message = "";

  // Try multiple possible section keys
  const sectionKeys = ["Details", "Attachments", "SAP Details", "SAP Attachments"];
  const sections: Record<string, unknown>[] = [];

  if (sap) {
    for (const key of sectionKeys) {
      const section = sap[key] as Record<string, unknown> | undefined;
      if (section && typeof section === "object") {
        sections.push(section);
        if (!title || title === "SAP & Scholarships") {
          title = normalizeRawValue(section.title) || title;
        }
      }
    }
    // If no named sections found, try sap itself
    if (sections.length === 0) {
      sections.push(sap);
    }
  } else {
    sections.push(root);
  }

  for (const section of sections) {
    const sectionTables = section.tables as Array<Array<Record<string, unknown>>> | undefined;
    if (sectionTables && Array.isArray(sectionTables)) {
      for (const table of sectionTables) {
        if (!Array.isArray(table) || table.length === 0) continue;
        const rows: SapScholarshipRecord[] = table
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const record: SapScholarshipRecord = {};
            for (const [key, value] of Object.entries(row)) {
              record[normalizeRawValue(key) || key] = normalizeRawValue(value);
            }
            return record;
          })
          .filter((row) => Object.values(row).some(Boolean));
        if (rows.length > 0) tables.push(rows);
      }
    }

    const text = normalizeRawValue(section.text);
    if (text && !message) {
      message = text;
    }
  }

  if (tables.length === 0 && !message) {
    message = "No SAP or scholarship information available.";
  }

  return { title, tables, message };
}

export function transformFaqs(rawData: unknown): Partial<FaqsModel> {
  if (!rawData || typeof rawData !== "object") return { content: "", sections: [] };

  const root = rawData as Record<string, unknown>;
  let title = "FAQs";
  const textParts: string[] = [];
  const sections: Array<{ heading: string; text: string; url?: string }> = [];

  // FAQs come from external pages — could be under Hostel or Transport
  for (const [category, categoryData] of Object.entries(root)) {
    if (!categoryData || typeof categoryData !== "object") continue;
    const categoryObj = categoryData as Record<string, unknown>;

    for (const [key, sectionData] of Object.entries(categoryObj)) {
      if (!sectionData || typeof sectionData !== "object") continue;
      const section = sectionData as Record<string, unknown>;

      const sectionTitle = normalizeRawValue(section.title);
      const text = normalizeRawValue(section.text);
      const externalUrl = typeof section.externalUrl === "string" ? section.externalUrl.trim() : undefined;

      if (!sectionTitle && !text && !externalUrl) continue;

      if (!title || title === "FAQs") {
        title = sectionTitle || `${category} — ${key}`;
      }

      // This section is an external resource — record the URL
      const isExternalText = /^External resource/i.test(text);
      const entryText = isExternalText ? "" : text;
      const heading = sectionTitle || key;

      if (entryText || externalUrl) {
        if (entryText) textParts.push(entryText);
        sections.push({ heading, text: entryText, url: externalUrl || undefined });
      }
    }
  }

  return { title, content: textParts.join("\n\n"), sections };
}

export function transformRefundChange(rawData: unknown): Partial<RefundChangeModel> {
  // Same structure as FAQs — external page content
  const result = transformFaqs(rawData);
  return {
    ...result,
    title: result.title === "FAQs" ? "Refund & Change Requests" : result.title,
  };
}
