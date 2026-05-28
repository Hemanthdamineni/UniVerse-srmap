import { createContext, type ReactNode } from "react";
import { sanitizeVisibleText } from "../ErpPrimitives";
import type { ErpNode } from "../../../lib/erpApi";

export type NodeRendererProps = {
  node: ErpNode;
  renderChildren: (children: ErpNode[]) => ReactNode;
};

export type FormValues = Record<string, string>;
export type TableCellValue = string | number | boolean | Record<string, unknown>;

export type ButtonAction = {
  type: string;
  target: string;
  method: string;
  onSuccess: "reload_page" | "update_section" | "no_update";
  targetRoute?: string;
  queryParams?: Record<string, string>;
};

export type SelectionPromptOption = {
  label: string;
  value: string;
};

export type ActionExecutionContext = {
  node: ErpNode;
  formState?: FormValues;
  setPending?: (value: boolean) => void;
  setError?: (value: string) => void;
};

export type ActionHandlerContextValue = {
  debugEnabled: boolean;
  pendingNodeId: string | null;
  globalError: string;
  clearGlobalError: () => void;
  handleAction: (action: ButtonAction, context: ActionExecutionContext) => Promise<unknown>;
};

export type FormContextValue = {
  values: FormValues;
  setValue: (name: string, value: string) => void;
  submitting: boolean;
  error: string;
  clearError: () => void;
  setError: (value: string) => void;
  submit: () => Promise<void>;
};

export const ActionHandlerContext = createContext<ActionHandlerContextValue | null>(null);
export const FormContext = createContext<FormContextValue | null>(null);
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readRenderableValue(value: unknown): string | number | boolean | "" {
  if (typeof value === "string") return sanitizeVisibleText(value, "");
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (isRecord(value)) {
    if ("label" in value) return readRenderableValue(value.label);
    if ("text" in value) return readRenderableValue(value.text);
    if ("value" in value) return readRenderableValue(value.value);
  }

  return "";
}

export function readString(value: unknown, fallback = "") {
  const normalized = readRenderableValue(value);
  if (typeof normalized === "string") return normalized || fallback;
  if (typeof normalized === "number" || typeof normalized === "boolean") {
    return sanitizeVisibleText(String(normalized), fallback);
  }
  return fallback;
}

export function readBoolean(value: unknown) {
  return value === true;
}

export function readCellValue(value: unknown): TableCellValue {
  if (isRecord(value) && ("action" in value || "target" in value)) return value;
  const normalized = readRenderableValue(value);
  if (typeof normalized === "string" || typeof normalized === "number" || typeof normalized === "boolean") {
    return normalized;
  }
  return "";
}

export function readRows(value: unknown): Array<{ key: string; values: Record<string, TableCellValue> }> {
  if (!Array.isArray(value)) return [];

  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => {
      const valuesSource =
        row.values && typeof row.values === "object" && !Array.isArray(row.values)
          ? (row.values as Record<string, unknown>)
          : row;

      return {
        key: readString(row.key, `row-${index + 1}`) || `row-${index + 1}`,
        values: Object.fromEntries(
          Object.entries(valuesSource).map(([key, cellValue]) => [key, readCellValue(cellValue)])
        ),
      };
    });
}

export function readColumns(value: unknown): Array<{ key: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((column, index) => {
      if (typeof column === "string") {
        const label = readString(column);
        return label ? { key: label, label } : null;
      }

      if (column && typeof column === "object") {
        const record = column as Record<string, unknown>;
        const key = readString(record.key, `col${index + 1}`) || `col${index + 1}`;
        const label = readString(record.label, key) || key;
        return { key, label };
      }

      return null;
    })
    .filter((column): column is { key: string; label: string } => Boolean(column));
}

export function humanizeColumnKey(key: string) {
  const normalized = readString(key);
  const colMatch = normalized.match(/^col(\d+)$/i);
  if (colMatch) return `Column ${colMatch[1]}`;

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function completeColumns(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  const seen = new Set(columns.map((column) => column.key));
  const nextColumns = [...columns];

  rows.forEach((row) => {
    Object.keys(row.values || {}).forEach((key) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      nextColumns.push({ key, label: humanizeColumnKey(key) || key });
    });
  });

  return nextColumns;
}

export function looksLikeHeaderCell(value: TableCellValue) {
  const text = readString(value);
  if (!text || text.length > 48) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(text)) return false;
  if (/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/.test(text)) return false;
  return true;
}

export function findPromotedHeaderRowIndex(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  const headerWordPattern =
    /^(term|fee type|due date|amount|receipt date|mode|number|status|particulars|transaction|reference|subject code|subject description|max\.?\s*marks?|marks obtained)$/i;

  return rows.slice(0, 3).findIndex((row) => {
    const values = columns.map((column) => row.values[column.key]).filter((value) => readString(value));
    if (values.length < Math.min(3, columns.length)) return false;
    if (!values.every(looksLikeHeaderCell)) return false;

    const hasGenericColumnLabel = columns.some((column) => /^col\d+$/i.test(column.key) && readString(row.values[column.key]));
    const hasKnownHeaderWord = values.some((value) => headerWordPattern.test(readString(value)));

    return hasGenericColumnLabel && hasKnownHeaderWord;
  });
}

export function applyPromotedHeaderRow(
  columns: Array<{ key: string; label: string }>,
  rows: Array<{ key: string; values: Record<string, TableCellValue> }>
) {
  const promotedIndex = findPromotedHeaderRowIndex(columns, rows);
  if (promotedIndex < 0) return { columns, rows };

  const headerRow = rows[promotedIndex];
  const promotedColumns = columns.map((column) => {
    const candidate = headerRow.values[column.key];
    return looksLikeHeaderCell(candidate)
      ? { ...column, label: readString(candidate, column.label) }
      : column;
  });

  return {
    columns: promotedColumns,
    rows: rows.filter((_, index) => index !== promotedIndex),
  };
}

function normalizeComparableText(value: string) {
  return sanitizeVisibleText(value, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function rowEchoesColumns(
  columns: Array<{ key: string; label: string }>,
  row: { values: Record<string, TableCellValue> }
) {
  const values = columns
    .map((column) => readString(row.values[column.key]))
    .filter(Boolean);

  if (values.length < Math.min(2, columns.length)) return false;

  return values.every((value) =>
    columns.some((column) => normalizeComparableText(value) === normalizeComparableText(column.label))
  );
}

export function readOptions(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((option): option is Record<string, unknown> => Boolean(option) && typeof option === "object")
    .map((option) => ({
      label: readString(option.label || option.value),
      value: readString(option.value || option.label),
      selected: readBoolean(option.selected),
    }))
    .filter((option) => option.label || option.value);
}

export function readAction(value: unknown): ButtonAction | null {
  if (typeof value === "string" && value.trim()) {
    return {
      type: "navigate",
      target: value.trim(),
      method: "GET",
      onSuccess: "no_update",
      targetRoute: value.trim()
    };
  }

  if (!isRecord(value)) return null;

  const type = readString(value.type);
  const targetRoute = readString(value.targetRoute);
  const target = readString(targetRoute || value.target || value.url || value.href);
  const defaultMethod = type === "navigate" ? "GET" : "POST";
  const method = readString(value.method, defaultMethod).toUpperCase() || defaultMethod;
  const onSuccessValue = readString(value.onSuccess, type === "navigate" ? "no_update" : "reload_page");
  const onSuccess =
    onSuccessValue === "update_section" || onSuccessValue === "no_update" ? onSuccessValue : "reload_page";

  const queryParams: Record<string, string> = {};
  if (isRecord(value.queryParams)) {
    Object.entries(value.queryParams).forEach(([key, itemValue]) => {
      const normalized = sanitizeVisibleText(itemValue, "");
      if (!key || !normalized) return;
      queryParams[key] = normalized;
    });
  }

  if (!type) return null;

  return {
    type,
    target,
    method,
    onSuccess,
    targetRoute: targetRoute || undefined,
    queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  };
}

export function readSelectedOptionValue(node: ErpNode) {
  const options = readOptions(node.props.options);
  return options.find((option) => option.selected)?.value || "";
}

export function getFieldInitialValue(node: ErpNode) {
  const inputType = readString(node.props.inputType, "text").toLowerCase();
  if (inputType === "checkbox" || inputType === "radio") {
    return readBoolean(node.props.checked) ? readString(node.props.value, "on") : "";
  }
  return readString(node.props.value, readSelectedOptionValue(node));
}

export function collectInitialFormState(nodes: ErpNode[]) {
  const values: FormValues = {};

  const visit = (currentNodes: ErpNode[]) => {
    currentNodes.forEach((child) => {
      if (child.type === "field") {
        const name = readString(child.props.name);
        if (name && !(name in values)) {
          values[name] = getFieldInitialValue(child);
        }
      }

      if (Array.isArray(child.children) && child.children.length > 0) {
        visit(child.children);
      }
    });
  };

  visit(nodes);
  return values;
}

export function findSubmitAction(nodes: ErpNode[]): ButtonAction | null {
  for (const node of nodes) {
    if (node.type === "button") {
      const action = readAction(node.props.action);
      if (action?.type === "submit_form") {
        return action;
      }
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const nested = findSubmitAction(node.children);
      if (nested) return nested;
    }
  }

  return null;
}

export function buildDefaultSubmitAction(node: ErpNode): ButtonAction | null {
  const target = readString(node.props.action);
  if (!target) return null;

  return {
    type: "submit_form",
    target,
    method: readString(node.props.method, "POST").toUpperCase() || "POST",
    onSuccess: "reload_page",
  };
}
