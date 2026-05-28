import type { PageRenderer } from "../../../config/erpBlueprints";
import type { DataTableModel, StatusMessage } from "../../../components/erp/ErpPrimitives";
import {
  CODE_NOISE_PATTERN,
  cleanCell,
  cleanColumnName,
  isRecord,
  normalizeCompare,
  statusToneForText,
} from "./valueUtils";

const RESULT_COLUMN_ORDER = [
  "Semester",
  "Month & Year",
  "Subject Code",
  "Subject Description",
  "Credit",
  "Grade",
  "Grade Point",
  "Result",
  "Attempt",
];

const FINANCE_COLUMN_ORDER = [
  "Sl.No.",
  "Term",
  "Fee Type",
  "Due Date",
  "Amount",
  "Receipt Date",
  "Mode",
  "Number",
  "Receipt No.",
  "Particulars",
  "Received Date",
  "Transaction No.",
  "Reference No.",
  "Payment Channel",
  "Payment Status",
  "Action",
];

export function normalizeTables(
  rawTables: unknown[],
  sectionTitle: string,
  renderer: PageRenderer
): { tables: DataTableModel[]; statuses: StatusMessage[] } {
  const tables: DataTableModel[] = [];
  const statuses: StatusMessage[] = [];

  rawTables.forEach((rawTable, tableIndex) => {
    if (!Array.isArray(rawTable)) return;

    const rawRecords = rawTable.filter(isRecord);
    if (rawRecords.length > 0 && looksLikeNodeTreeData(rawRecords)) {
      return;
    }

    const rawRows = rawRecords.map((row) => sanitizeRow(row));
    if (rawRows.length === 0) return;

    let columns = collectColumns(rawRows);
    let rows = rawRows
      .map((row) => projectRow(row, columns))
      .filter((row) => !isEmptyRow(row, columns))
      .filter((row) => !isHeaderDuplicateRow(row, columns))
      .filter((row) => !isClearlyNoiseRow(row, sectionTitle));

    if (looksLikeObjectTreeTable(columns, rows)) {
      return;
    }

    if (columns.length > 1) {
      columns = columns.filter((column) =>
        rows.some((row) => {
          const v = (row[column] || "").trim();
          return v.length > 0 && v !== "-";
        })
      );
      rows = rows.map((row) => projectRow(row, columns));
    }

    if (rows.length === 0 || columns.length === 0) return;

    if (columns.length === 1 && rows.length <= 3) {
      rows.forEach((row) => {
        const value = row[columns[0]];
        if (!value) return;
        statuses.push({
          id: `${sectionTitle}-${tableIndex}-${value}`,
          tone: statusToneForText(value),
          text: value,
        });
      });
      return;
    }

    tables.push(
      tuneTableModel(
        {
          title: rawTables.length > 1 ? `${sectionTitle} (${tableIndex + 1})` : sectionTitle,
          columns,
          rows,
        },
        sectionTitle,
        renderer,
        tableIndex
      )
    );
  });

  return { tables, statuses };
}

function tuneTableModel(
  table: DataTableModel,
  sectionTitle: string,
  renderer: PageRenderer,
  tableIndex: number
): DataTableModel {
  let columns = [...table.columns];
  let rows = table.rows.map((row) => ({ ...row }));

  if (isFinanceLedgerSection(sectionTitle)) {
    const promoted = promoteFinanceLedgerHeader(columns, rows);
    columns = promoted.columns;
    rows = promoted.rows;
  }

  if (/payment receipts|payment acknowledgment/i.test(sectionTitle)) {
    const renamed = renameColumns(columns, rows, { col6: "Action" });
    columns = renamed.columns;
    rows = renamed.rows;
  }

  if (/online payment verification/i.test(sectionTitle)) {
    const renamed = renameColumns(columns, rows, { col1: "Action" });
    columns = renamed.columns;
    rows = renamed.rows;
  }

  columns = reorderColumnsForSection(columns, sectionTitle, renderer);
  rows = rows.map((row) => projectRow(row, columns));

  if (columns.length > 1) {
    columns = columns.filter((column) =>
      rows.some((row) => {
        const v = (row[column] || "").trim();
        const isZero = /^0(\.0+)?$/.test(v);
        return !isZero && v.replace(/[\W_]/g, "").length > 0;
      })
    );
    rows = rows.map((row) => projectRow(row, columns));
  }

  return {
    title: resolveTableTitle(sectionTitle, renderer, tableIndex),
    columns,
    rows,
    disableInternalScroll: renderer === "finance-paid",
  };
}

function promoteFinanceLedgerHeader(columns: string[], rows: Array<Record<string, string>>) {
  const headerRowIndex = rows.findIndex((row) => {
    const rowText = Object.values(row).join(" ");
    return /term/i.test(rowText) && /fee type/i.test(rowText) && /due date/i.test(rowText);
  });

  if (headerRowIndex < 0) {
    return { columns, rows };
  }

  const headerRow = rows[headerRowIndex];
  const renameMap: Record<string, string> = {};

  columns.forEach((column) => {
    const candidate = (headerRow[column] || "").trim();
    if (!candidate) return;
    if (candidate === "-" || candidate === "0") return;
    renameMap[column] = candidate;
  });

  if (Object.keys(renameMap).length < 3) {
    return { columns, rows };
  }

  const renamed = renameColumns(columns, rows, renameMap);
  return {
    columns: renamed.columns,
    rows: renamed.rows.filter((_, index) => index !== headerRowIndex),
  };
}

function renameColumns(
  columns: string[],
  rows: Array<Record<string, string>>,
  renameMap: Record<string, string>
) {
  const nextColumns = columns.map((column) => renameMap[column] || column);
  const nextRows = rows.map((row) => {
    const mapped: Record<string, string> = {};
    columns.forEach((column, index) => {
      mapped[nextColumns[index]] = row[column] || "";
    });
    return mapped;
  });

  return {
    columns: nextColumns,
    rows: nextRows,
  };
}

function reorderColumnsForSection(
  columns: string[],
  sectionTitle: string,
  renderer: PageRenderer
) {
  if (renderer === "results-current" || renderer === "results-earlier") {
    return reorderColumns(columns, RESULT_COLUMN_ORDER);
  }

  if (renderer === "finance-paid" || renderer === "finance-dues" || /fee|payment|dues/i.test(sectionTitle)) {
    return reorderColumns(columns, FINANCE_COLUMN_ORDER);
  }

  return columns;
}

function reorderColumns(columns: string[], preferredOrder: string[]) {
  const used = new Set<string>();
  const ordered: string[] = [];

  for (const preferred of preferredOrder) {
    const match = columns.find(
      (column) =>
        !used.has(column) &&
        normalizeCompare(column) === normalizeCompare(preferred)
    );

    if (match) {
      used.add(match);
      ordered.push(match);
    }
  }

  columns.forEach((column) => {
    if (!used.has(column)) {
      used.add(column);
      ordered.push(column);
    }
  });

  return ordered;
}

function resolveTableTitle(sectionTitle: string, renderer: PageRenderer, tableIndex: number) {
  const normalized = normalizeCompare(sectionTitle);

  if (renderer === "results-current" && normalized.includes("current semester results")) {
    return "Result Sheet";
  }

  if (renderer === "results-current" && normalized.includes("internal mark details")) {
    return tableIndex === 0 ? "Internal Mark Summary" : `Internal Mark Breakdown ${tableIndex}`;
  }

  if (renderer === "results-earlier" && normalized.includes("historical exam marks")) {
    return "Historical Exam Marks";
  }

  if (renderer === "finance-paid" && normalized.includes("fee paid details")) {
    return tableIndex === 0 ? "Fee Ledger" : "Refund Summary";
  }

  if (renderer === "finance-paid" && /payment receipts|payment acknowledgment/.test(normalized)) {
    return "Receipt History";
  }

  if (renderer === "finance-paid" && normalized.includes("online payment verification")) {
    return "Verification Queue";
  }

  if (renderer === "finance-dues" && /dues|fee due details/.test(normalized)) {
    return "Due Status";
  }

  return sectionTitle;
}

function isFinanceLedgerSection(sectionTitle: string) {
  const normalized = normalizeCompare(sectionTitle);
  return normalized.includes("fee paid details") || normalized.includes("fee paid");
}

function sanitizeRow(row: Record<string, unknown>) {
  const output: Record<string, string> = {};

  Object.entries(row).forEach(([key, value]) => {
    if (key === "children" && Array.isArray(value)) return;
    if (key === "props" && isRecord(value)) return;
    const cleanedKey = cleanColumnName(key);
    output[cleanedKey] = cleanCell(value);
  });

  return output;
}

function collectColumns(rows: Array<Record<string, string>>) {
  const seen = new Set<string>();
  const columns: string[] = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    });
  });

  return columns;
}

function projectRow(row: Record<string, string>, columns: string[]) {
  const projected: Record<string, string> = {};
  columns.forEach((column) => {
    projected[column] = row[column] || "";
  });
  return projected;
}

function isEmptyRow(row: Record<string, string>, columns: string[]) {
  return columns.every((column) => !(row[column] || "").trim());
}

function isHeaderDuplicateRow(row: Record<string, string>, columns: string[]) {
  const equalCount = columns.filter((column) => {
    const value = normalizeCompare(row[column]);
    return value.length > 0 && value === normalizeCompare(column);
  }).length;

  const combined = columns.map((column) => row[column]).join(" ").toLowerCase();
  if (combined.includes("name mark secured(conducted)")) return true;
  if (combined.includes("present(p)") && combined.includes("absent(a)")) return true;

  const nonEmptyValues = columns
    .map((c) => (row[c] || "").trim())
    .filter((v) => v.length > 0 && v !== "-");
  const alphaValues = nonEmptyValues.filter((v) => /[a-zA-Z]/.test(v));
  if (alphaValues.length >= 1 && alphaValues.every((v) => v === v.toUpperCase())) {
    return true;
  }

  return equalCount >= Math.max(2, columns.length - 1);
}

export function isClearlyNoiseRow(row: Record<string, string>, sectionTitle: string) {
  const joined = Object.values(row).join(" ").trim();
  if (!joined) return true;

  if (CODE_NOISE_PATTERN.test(joined)) return true;

  if (/internal mark details/i.test(sectionTitle) && row["Subject Code"]) {
    const code = row["Subject Code"].trim();
    if (code && !/^[A-Z]{2,}\s*\d+/i.test(code)) {
      return true;
    }
  }

  if (/internal mark details/i.test(sectionTitle) && row.Name) {
    const conducted = (row["Mark Secured(Conducted)"] || "").trim();
    const converted = (row["Mark Secured(Converted)"] || "").trim();
    if (!conducted && !converted) {
      return true;
    }
  }

  const firstVal = Object.values(row)[0]?.trim() ?? "";
  if (/^(print|i agree|i agree, proceed|proceed|submit|save|cancel|reset|back|close|info)$/i.test(firstVal)) {
    return true;
  }

  const strippedJoined = joined.replace(/[-.\s]/g, "").toLowerCase();
  if (/^(print|iagree|proceed|submit|save|cancel|reset|back|close|info|action|actions)$/i.test(strippedJoined)) {
    return true;
  }

  if (
    Object.values(row).filter((v) => v && v.trim() && v.trim() !== "-").length === 1 &&
    /\[select\b/i.test(firstVal)
  ) {
    return true;
  }

  if (joined.toLowerCase().includes("please enter your bank details")) return true;
  if (/^(save\s*-?|submit\s*-?)$/i.test(joined.trim())) return true;

  return false;
}

function looksLikeObjectTreeTable(columns: string[], rows: Array<Record<string, string>>) {
  if (columns.length === 0 || rows.length === 0) return false;

  const normalizedColumns = columns.map((column) => normalizeCompare(column));
  const treeColumnSet = new Set(["id", "type", "props", "children"]);
  const treeColumnHits = normalizedColumns.filter((column) => treeColumnSet.has(column)).length;

  if (treeColumnHits >= 3 && normalizedColumns.length <= 6) {
    return true;
  }

  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);
  const typeColumnIdx = normalizedColumns.indexOf("type");
  if (typeColumnIdx >= 0) {
    const typeColumn = columns[typeColumnIdx];
    const nodeTypeHits = rows.filter((row) => knownNodeTypes.has(normalizeCompare(row[typeColumn]))).length;
    if (nodeTypeHits >= Math.ceil(rows.length * 0.5)) {
      return true;
    }
  }

  const sampleValues = rows
    .flatMap((row) => Object.values(row))
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  if (sampleValues.length === 0) return false;

  const objectLikeCount = sampleValues.filter((value) => {
    return value === "[object object]" || value === "[object]" || /^\{.*\}$/.test(value) || /^\[.*\]$/.test(value);
  }).length;

  return objectLikeCount >= 1;
}

function looksLikeNodeTreeData(rawRows: Array<Record<string, unknown>>): boolean {
  if (rawRows.length === 0) return false;

  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);

  const nodeShapedCount = rawRows.filter((row) => {
    const hasId = "id" in row;
    const hasType = "type" in row && typeof row.type === "string" && knownNodeTypes.has(row.type);
    const hasProps = "props" in row && isRecord(row.props);
    const hasChildren = "children" in row && Array.isArray(row.children);
    return hasType && (hasId || hasProps || hasChildren);
  }).length;

  return nodeShapedCount >= Math.ceil(rawRows.length * 0.5);
}
