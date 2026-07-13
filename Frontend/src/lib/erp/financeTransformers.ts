import { readExtracted, readExtractedPage } from "./shared";
import type {
  FeeDueRecord,
  FeeDuesModel,
  FeePaidColumn,
  FeePaidSectionRow,
  FeePaidSection,
  FeePaidSourceSummary,
  FeePaidIntegritySummary,
  FeesPaidModel,
  BankDetailField,
  BankDetailsModel,
  RoomDetailField,
  RoomDetailsModel,
  SapScholarshipsModel,
  FaqsModel,
  RefundChangeModel,
} from "./types";

function requireExtracted(
  pageData: unknown,
  expectedType: string,
  pageKey: string,
): Record<string, unknown> {
  const extracted = readExtracted(pageData);
  if (!extracted) {
    throw new Error(
      `MISSING_EXTRACTED_PAYLOAD [${pageKey}]: _extracted field is absent. ` +
        `The ERP page structure may have changed. Add or fix the backend extractor.`,
    );
  }
  if (extracted.type !== expectedType) {
    throw new Error(
      `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${extracted.type}". ` +
        `The backend extractor output type has changed or the wrong extractor is mapped.`,
    );
  }
  return extracted;
}

// ---------------------------------------------------------------------------
// FEE DUES
// Backend extractor: extractFeeDues → type "fee-dues"
// ---------------------------------------------------------------------------

export function transformFeeDues(rawData: unknown): Partial<FeeDuesModel> {
  const extracted = requireExtracted(rawData, "fee-dues", "finance/fee-due-details");
  const title = String(extracted.title ?? "Fee Dues");
  const records: FeeDueRecord[] = (extracted.records as Record<string, unknown>[])
    .map((r) => ({
      category: String(r.feeCategory ?? ""),
      head: String(r.feeHead ?? ""),
      dueAmount: String(r.dueAmount ?? ""),
      collectedAmount: String(r.collected ?? ""),
      toBePaidAmount: String(r.toBePaid ?? ""),
    }))
    .filter((r) => r.category || r.head);

  return { title, records, noDues: records.length === 0 };
}

// ---------------------------------------------------------------------------
// FEES PAID (multi-source: fee-paid-details, payment-acknowledgment,
//            online-payment-verification)
// Backend extractors: extractFeePaid → "fee-paid",
//                     extractPaymentAcknowledgment → "payment-acknowledgment",
//                     extractGenericTable → "generic-table"
// ---------------------------------------------------------------------------

const FEE_PAID_SOURCES = [
  { pageKey: "finance/fee-paid-details", label: "Fee Paid Details", expectedType: "fee-paid" },
  { pageKey: "finance/payment-acknowledgment", label: "Payment Acknowledgment", expectedType: "payment-acknowledgment" },
  { pageKey: "finance/online-payment-verification", label: "Online Payment Verification", expectedType: "generic-table" },
] as const;

function buildFeePaidSection(
  sourceLabel: string,
  sourcePageKey: string,
  extracted: Record<string, unknown>,
): FeePaidSection | null {
  const type = extracted.type as string;

  if (type === "fee-paid") {
    const rawCols = (extracted.columns as string[]) ?? [];
    const colLabels: Record<string, string> = {
      term: "Term", feeType: "Fee Type", dueDate: "Due Date",
      dueAmount: "Due Amount", receiptDate: "Receipt Date",
      mode: "Mode", receiptNumber: "Receipt No.", paidAmount: "Paid Amount", balance: "Balance",
    };
    const columns: FeePaidColumn[] = rawCols.map((k) => ({
      key: k,
      label: colLabels[k] ?? k,
    }));

    const rows: FeePaidSectionRow[] = (extracted.records as Record<string, unknown>[]).map((r) => {
      const receiptNumber = String(r.receiptNumber ?? "");
      const hasPrint = Boolean(receiptNumber && /^\d+$/.test(receiptNumber));
      return {
        stableKey: `${String(r.term ?? "")}-${String(r.feeType ?? "")}-${receiptNumber}`,
        cells: Object.fromEntries(rawCols.map((k) => [k, String(r[k] ?? "")])),
        ...(hasPrint ? { printActionId: "print-receipt", printReceiptId: receiptNumber } : {}),
      };
    });

    if (rows.length === 0) return null;
    return { sourceLabel, sourcePageKey, columns, rows, tableCount: 1, extractedCount: rows.length };
  }

  if (type === "payment-acknowledgment") {
    const columns: FeePaidColumn[] = [
      { key: "slNo", label: "Sl.No." },
      { key: "receiptDate", label: "Receipt Date" },
      { key: "receiptNo", label: "Receipt No." },
      { key: "particulars", label: "Particulars" },
      { key: "amount", label: "Amount" },
    ];
    const rows: FeePaidSectionRow[] = (extracted.records as Record<string, unknown>[]).map((r) => {
      const receiptNo = String(r.receiptNo ?? "");
      const hasPrint = Boolean(receiptNo && /^\d+$/.test(receiptNo));
      return {
        stableKey: `ack-${String(r.slNo ?? "")}-${receiptNo}`,
        cells: {
          slNo: String(r.slNo ?? ""),
          receiptDate: String(r.receiptDate ?? ""),
          receiptNo,
          particulars: String(r.particulars ?? ""),
          amount: String(r.amount ?? ""),
        },
        ...(hasPrint ? { printActionId: "print-receipt", printReceiptId: receiptNo } : {}),
      };
    });

    if (rows.length === 0) return null;
    return { sourceLabel, sourcePageKey, columns, rows, tableCount: 1, extractedCount: rows.length };
  }

  if (type === "generic-table") {
    const tables = (extracted.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];
    const table = tables[0];
    if (!table || table.rows.length === 0) return null;

    const columns: FeePaidColumn[] = table.columns.map((c) => ({ key: c, label: c }));
    const rows: FeePaidSectionRow[] = table.rows.map((r, i) => ({
      stableKey: `generic-${i}`,
      cells: Object.fromEntries(table.columns.map((c) => [c, String(r[c] ?? "")])),
    }));

    return { sourceLabel, sourcePageKey, columns, rows, tableCount: 1, extractedCount: rows.length };
  }

  throw new Error(
    `UNEXPECTED_PAYLOAD_TYPE [${sourcePageKey}]: unhandled type "${type}" for fee-paid source.`,
  );
}

export function transformFeesPaid(rawData: unknown): Partial<FeesPaidModel> {
  const title = "Payment Receipts";
  const sections: FeePaidSection[] = [];
  const sources: FeePaidSourceSummary[] = [];
  const warnings: string[] = [];

  for (const source of FEE_PAID_SOURCES) {
    const pageData = readExtractedPage(rawData, source.pageKey);

    if (!pageData) {
      warnings.push(`${source.label}: page not returned in this batch (may not apply).`);
      sources.push({
        sourcePageKey: source.pageKey, sourceLabel: source.label,
        status: "missing", tableCount: 0, rowCount: 0,
        extractedCount: 0, droppedRowCount: 0, warnings: [],
      });
      continue;
    }

    if (pageData.type !== source.expectedType) {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [${source.pageKey}]: expected "${source.expectedType}", ` +
        `got "${pageData.type}". Backend extractor may have changed.`,
      );
    }

    const section = buildFeePaidSection(source.label, source.pageKey, pageData);
    const extractedCount = section?.extractedCount ?? 0;

    sources.push({
      sourcePageKey: source.pageKey, sourceLabel: source.label,
      status: section ? "loaded" : "empty",
      tableCount: section?.tableCount ?? 0, rowCount: extractedCount,
      extractedCount, droppedRowCount: 0, warnings: [],
    });

    if (section) sections.push(section);
  }

  const emptyIntegrity: FeePaidIntegritySummary = {
    sourceCount: sources.length,
    rawRowCount: sources.reduce((s, x) => s + x.rowCount, 0),
    extractedRowCount: sources.reduce((s, x) => s + x.extractedCount, 0),
    deduplicatedRowCount: sources.reduce((s, x) => s + x.extractedCount, 0),
    duplicateCount: 0,
    warningCount: warnings.length,
  };

  return { title, records: [], sections, sources, duplicates: [], warnings, integrity: emptyIntegrity };
}

// ---------------------------------------------------------------------------
// BANK DETAILS
// Backend extractor: extractBankDetails → type "bank-details"
// ---------------------------------------------------------------------------

export function transformBankDetails(rawData: unknown): Partial<BankDetailsModel> {
  const extracted = requireExtracted(rawData, "bank-details", "finance/bank-account-details");
  const title = String(extracted.title ?? "Bank Details");
  const fields: BankDetailField[] = (extracted.fields as Record<string, unknown>[])
    .map((f) => ({ label: String(f.label ?? ""), value: String(f.value ?? "") }))
    .filter((f) => f.label);
  const isForm = fields.every((f) => !f.value);
  return { title, fields, isForm };
}

// ---------------------------------------------------------------------------
// ROOM DETAILS — generic-table (Hostel|Room Details)
// ---------------------------------------------------------------------------

export function transformRoomDetails(rawData: unknown): Partial<RoomDetailsModel> {
  const extracted = requireExtracted(rawData, "generic-table", "hostel/room-details");
  const title = String(extracted.title ?? "Room Details");
  const tables = (extracted.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];
  const table = tables[0];

  if (!table || table.rows.length === 0) {
    return { title, fields: [], noRoom: true };
  }

  // Expect two-column layout: [label, value] or keyed rows
  const fields: RoomDetailField[] = table.rows
    .map((row) => {
      const vals = Object.values(row);
      return {
        label: String(vals[0] ?? ""),
        value: String(vals[1] ?? ""),
      };
    })
    .filter((f) => f.label && f.label.length < 80);

  const text = String(extracted.text ?? "");
  const noRoom = fields.length === 0 || /no (hostel|room)|not (assigned|allocated|applicable)/i.test(text);

  return { title, fields, noRoom };
}

// ---------------------------------------------------------------------------
// SAP & SCHOLARSHIPS — multiple generic-table sources bundled
// ---------------------------------------------------------------------------

export function transformSapScholarships(rawData: unknown): Partial<SapScholarshipsModel> {
  // SAP pages are all generic-table. rawData may be a merged batch of multiple keys.
  // Collect all tables from any available extracted payload.
  const tables: Record<string, string>[][] = [];
  let title = "SAP & Scholarships";
  let message = "";

  const candidates = ["sap/details", "sap/attachments", "sap/feedback", "sap/sap-process"];
  for (const key of candidates) {
    const pageData = readExtractedPage(rawData, key);
    if (!pageData) continue;
    if (pageData.type !== "generic-table") {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [${key}]: expected "generic-table", got "${pageData.type}".`,
      );
    }
    const pageTables = (pageData.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];
    if (!title || title === "SAP & Scholarships") {
      title = String(pageData.title ?? title);
    }
    const pageText = String(pageData.text ?? "");
    if (pageText && !message) message = pageText;

    for (const t of pageTables) {
      if (t.rows.length === 0) continue;
      tables.push(
        t.rows.map((row) =>
          Object.fromEntries(
            t.columns.map((col) => [col, String(row[col] ?? "")]),
          ),
        ),
      );
    }
  }

  // Fallback: try reading directly from rawData._extracted for single-key batch
  if (tables.length === 0) {
    const direct = readExtracted(rawData);
    if (direct) {
      if (direct.type !== "generic-table") {
        throw new Error(
          `UNEXPECTED_PAYLOAD_TYPE [sap/*]: expected "generic-table", got "${direct.type}".`,
        );
      }
      const pageTables = (direct.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];
      for (const t of pageTables) {
        if (t.rows.length === 0) continue;
        tables.push(t.rows.map((row) =>
          Object.fromEntries(t.columns.map((col) => [col, String(row[col] ?? "")])),
        ));
      }
      title = String(direct.title ?? title);
      message = String(direct.text ?? "");
    }
  }

  if (tables.length === 0 && !message) {
    message = "No SAP or scholarship information available.";
  }

  return { title, tables, message };
}

// ---------------------------------------------------------------------------
// FAQS — generic-table (Hostel|Hostel Layout & FAQs, Transport|Transport & FAQs)
// ---------------------------------------------------------------------------

export function transformFaqs(rawData: unknown): Partial<FaqsModel> {
  const extracted = readExtracted(rawData);
  if (!extracted || extracted.type !== "generic-table") {
    return { title: "FAQs", content: "", sections: [] };
  }
  const title = String(extracted.title ?? "FAQs");
  const text = String(extracted.text ?? "");
  const tables = (extracted.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];

  const sections = tables.map((t, i) => ({
    heading: t.columns.join(" / ") || `Section ${i + 1}`,
    text: t.rows.map((row) => Object.values(row).join(" — ")).join("\n"),
  }));

  return { title, content: text, sections };
}

// ---------------------------------------------------------------------------
// REFUND & CHANGE — same structure as FAQs
// ---------------------------------------------------------------------------

export function transformRefundChange(rawData: unknown): Partial<RefundChangeModel> {
  const result = transformFaqs(rawData);
  return {
    ...result,
    title: result.title === "FAQs" ? "Refund & Change Requests" : result.title,
  };
}
