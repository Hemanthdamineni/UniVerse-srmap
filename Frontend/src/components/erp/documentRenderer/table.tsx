import { useContext, useState } from "react";
import { sanitizeVisibleText } from "../ErpPrimitives";
import type { ErpNode } from "../../../lib/erpApi";
import { ButtonRenderer } from "./controls";
import { NoticeBlock, splitMessageForDisplay } from "./display";
import {
  ActionHandlerContext,
  applyPromotedHeaderRow,
  completeColumns,
  isRecord,
  readColumns,
  readRenderableValue,
  readRows,
  readString,
  rowEchoesColumns,
  type NodeRendererProps,
  type SelectionPromptOption,
  type TableCellValue,
} from "./model";

function renderCell(value: unknown) {
  if (isRecord(value) && ("action" in value || "target" in value)) {
    const actionNode: ErpNode = { type: "button", id: `cell-btn-${Math.random()}`, props: value, children: [] };
    return <ButtonRenderer node={actionNode} renderChildren={() => null} />;
  }

  const normalized = readRenderableValue(value);
  if (typeof normalized === "string") {
    return sanitizeVisibleText(normalized || "—", "—");
  }
  if (typeof normalized === "number" || typeof normalized === "boolean") {
    return String(normalized);
  }
  return "—";
}

function normalizeComparableText(value: string) {
  return sanitizeVisibleText(value, "")
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readEchoTableItems(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  if (rows.length !== 1 || columns.length === 0) return null;

  const firstRow = rows[0];
  const items = columns
    .map((column) => readString(firstRow.values[column.key], column.label) || column.label)
    .map((value) => sanitizeVisibleText(value, ""))
    .filter(Boolean);

  if (items.length !== columns.length) return null;

  const isEchoTable = columns.every((column, index) => {
    const item = items[index] || "";
    return normalizeComparableText(item) === normalizeComparableText(column.label);
  });

  if (!isEchoTable) return null;

  return Array.from(new Set(items));
}

function readSingleMessage(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  if (rows.length !== 1 || columns.length !== 1) return null;

  const column = columns[0];
  const cellValue = readString(rows[0].values[column.key], column.label) || column.label;
  const message = sanitizeVisibleText(cellValue, column.label);
  return message || null;
}

function parseSelectionOptions(label: string) {
  const normalized = sanitizeVisibleText(label, "");
  if (!normalized.includes("[") || !normalized.includes("]")) return null;

  const match = normalized.match(/^\[(.+?)\]\s*(.*)$/);
  if (!match) return null;

  const placeholder = match[1]?.trim() || "Select";
  const tail = match[2]?.trim() || "";
  if (!tail) return { placeholder, options: [] };

  const options = tail
    .split(/(?=(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4})/i)
    .map((option) => sanitizeVisibleText(option, "").trim())
    .filter(Boolean);

  return {
    placeholder,
    options: options.map((option) => ({
      label: option,
      value: option,
    })),
  };
}

function readSelectionPromptModel(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  if (columns.length !== 2 || rows.length === 0) return null;

  const controlColumn = columns[1];
  const parsedOptions = parseSelectionOptions(controlColumn.label);
  if (!parsedOptions) return null;

  const firstRow = rows[0];
  const fieldLabel = readString(firstRow.values[columns[0].key], columns[0].label) || columns[0].label;
  const controlValue = readString(firstRow.values[controlColumn.key]);
  const hasControlId = Boolean(controlValue) && /^[a-z]{2,}[A-Z0-9_]+$/i.test(controlValue);

  if (!hasControlId && !parsedOptions.options.length) return null;

  const actions = rows
    .slice(1)
    .map((row) => readString(row.values[columns[0].key]))
    .filter(Boolean)
    .filter((value) => value.toLowerCase() !== fieldLabel.toLowerCase());

  return {
    fieldLabel,
    placeholder: parsedOptions.placeholder,
    options: parsedOptions.options,
    actions,
  };
}

function SelectionPromptControl({
  fieldLabel,
  placeholder,
  options,
  actions,
}: {
  fieldLabel: string;
  placeholder: string;
  options: SelectionPromptOption[];
  actions: string[];
}) {
  const [selectedValue, setSelectedValue] = useState("");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(180px,0.32fr)_1fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            Selection
          </p>
          <label
            htmlFor={`selection-${normalizeComparableText(fieldLabel).replace(/\s+/g, "-") || "erp"}`}
            className="mt-1 block text-sm font-semibold text-[var(--text-primary)]"
          >
            {fieldLabel}
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            id={`selection-${normalizeComparableText(fieldLabel).replace(/\s+/g, "-") || "erp"}`}
            value={selectedValue}
            onChange={(event) => setSelectedValue(event.currentTarget.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--comp-text-primary)] shadow-sm outline-none transition focus:border-[var(--comp-accent)] focus:ring-1 focus:ring-[var(--comp-accent)]"
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={`${option.value}-${option.label}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((actionLabel) => (
                <button
                  key={actionLabel}
                  type="button"
                  disabled={!selectedValue}
                  title={!selectedValue ? placeholder : undefined}
                  className="min-h-11 rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color-mix(in_srgb,var(--comp-accent)_80%,#000)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLabel}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function readPropertyList(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  const allCells: Array<any> = [];
  
  const hasMeaningfulColumns = columns.some(c => !/^col\d+$/i.test(c.key) && !/^column \d+$/i.test(c.label));
  
  if (hasMeaningfulColumns) {
    columns.forEach(col => {
      if (/^column \d+$/i.test(col.label)) {
        allCells.push("");
      } else {
        allCells.push(col.label);
      }
    });
  }
  
  rows.forEach(row => {
    columns.forEach(col => {
      const val = row.values[col.key];
      allCells.push(val !== undefined && val !== null ? val : "");
    });
  });
  
  const cleanedCells = allCells.map(c => {
    if (typeof c === 'string') return c.trim();
    if (typeof c === 'object' && c !== null) return c;
    return "";
  });
  
  const properties: Array<{ label: string; value: any }> = [];
  let i = 0;
  let colonCount = 0;
  
  while (i < cleanedCells.length) {
    const cell = cleanedCells[i];
    if (!cell) {
      i++;
      continue;
    }
    
    const next1 = cleanedCells[i+1];
    const next2 = cleanedCells[i+2];
    
    if (typeof next1 === 'string' && next1.trim() === ":") {
      colonCount++;
      properties.push({ label: String(cell).replace(/:$/, '').trim(), value: next2 || "—" });
      i += 3;
    } else {
      i++;
    }
  }
  
  if (colonCount > 0 && properties.length > 0) {
    return properties;
  }

  return null;
}

function PropertyListControl({
  title,
  properties
}: {
  title: string;
  properties: Array<{ label: string; value: any }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      {title ? (
        <div className="border-b border-[var(--border)] px-5 py-4 text-sm font-semibold tracking-wide text-[var(--text-primary)]">
          {title}
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-6 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop, index) => (
          <div key={index} className="flex flex-col gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--comp-text-secondary)]">
              {prop.label}
            </dt>
            <dd className="text-sm font-medium leading-6 text-[var(--comp-text-primary)]">
              {renderCell(prop.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TableRenderer({ node }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);
  const title = readString(node.props.title);
  const initialColumns = readColumns(node.props.columns);
  const initialRows = readRows(node.props.rows);
  const completedColumns = completeColumns(initialColumns, initialRows);
  const promoted = applyPromotedHeaderRow(completedColumns, initialRows);
  const columns = promoted.columns;
  const rows = promoted.rows.filter((row) => !rowEchoesColumns(columns, row));
  const columnOnlyMessage = columns.length === 1 && rows.length === 0 ? readString(columns[0].label) : "";

  if (columns.length === 0 || rows.length === 0) {
    if (columnOnlyMessage) {
      const parsedMessage = splitMessageForDisplay(columnOnlyMessage);
      if (parsedMessage?.body) {
        return (
          <NoticeBlock
            message={parsedMessage.body}
            eyebrow={parsedMessage.eyebrow}
            tone={parsedMessage.tone}
          />
        );
      }
    }

    if (actionHandler?.debugEnabled) {
      console.warn("[ERP document] Table schema mismatch", node);
    }
    return null;
  }

  const singleMessage = readSingleMessage(columns, rows);
  if (singleMessage) {
    const parsedMessage = splitMessageForDisplay(singleMessage);
    return (
      <NoticeBlock
        message={parsedMessage?.body || singleMessage}
        eyebrow={parsedMessage?.eyebrow}
        tone={parsedMessage?.tone || "info"}
      />
    );
  }

  const selectionPrompt = readSelectionPromptModel(columns, rows);
  if (selectionPrompt) {
    return (
      <SelectionPromptControl
        fieldLabel={selectionPrompt.fieldLabel}
        placeholder={selectionPrompt.placeholder}
        options={selectionPrompt.options}
        actions={selectionPrompt.actions}
      />
    );
  }

  const propertyList = readPropertyList(columns, rows);
  if (propertyList) {
    return <PropertyListControl title={title} properties={propertyList} />;
  }

  const echoTableItems = readEchoTableItems(columns, rows);
  if (echoTableItems && echoTableItems.length > 1) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {echoTableItems.map((item) => (
          <div
            key={item}
            data-page-contrast="true"
            className="page-contrast-fg rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--surface)] px-4 py-4 text-sm font-semibold leading-6 shadow-sm"
          >
            {item}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="erp-table-shell">
      {title ? <div data-page-contrast="true" className="page-contrast-fg border-b border-[color-mix(in_srgb,var(--border)_30%,transparent)] px-4 py-3 text-sm font-semibold">{title}</div> : null}
      <table className="erp-table table-fixed">
        <thead className="erp-table-head">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                data-page-contrast="true"
                className="erp-table-head-cell label-text break-words"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="erp-table-body">
          {rows.map((row, index) => (
            <tr key={`${node.id}-${row.key}-${index}`} className="erp-table-row">
              {columns.map((column) => (
                <td
                  key={`${node.id}-${row.key}-${column.key}`}
                  data-page-contrast="true"
                  className="erp-table-cell break-words"
                >
                  {renderCell(row.values[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
