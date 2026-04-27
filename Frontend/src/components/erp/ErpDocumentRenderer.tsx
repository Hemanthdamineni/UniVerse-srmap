import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { sanitizeVisibleText } from "./ErpPrimitives";
import {
  ApiError,
  sendErpDocumentRequest,
  type ErpDocument,
  type ErpNode,
  type ErpNodeType,
} from "../../lib/erpApi";

type NodeRendererProps = {
  node: ErpNode;
  renderChildren: (children: ErpNode[]) => ReactNode;
};

type FormValues = Record<string, string>;
type TableCellValue = string | number | boolean | Record<string, unknown>;

type ButtonAction = {
  type: string;
  target: string;
  method: string;
  onSuccess: "reload_page" | "update_section" | "no_update";
  targetRoute?: string;
  queryParams?: Record<string, string>;
};

type ActionExecutionContext = {
  node: ErpNode;
  formState?: FormValues;
  setPending?: (value: boolean) => void;
  setError?: (value: string) => void;
};

type ActionHandlerContextValue = {
  debugEnabled: boolean;
  pendingNodeId: string | null;
  globalError: string;
  clearGlobalError: () => void;
  handleAction: (action: ButtonAction, context: ActionExecutionContext) => Promise<unknown>;
};

type FormContextValue = {
  values: FormValues;
  setValue: (name: string, value: string) => void;
  submitting: boolean;
  error: string;
  clearError: () => void;
  setError: (value: string) => void;
  submit: () => Promise<void>;
};

const ActionHandlerContext = createContext<ActionHandlerContextValue | null>(null);
const FormContext = createContext<FormContextValue | null>(null);
const DEBUG_RENDER = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRenderableValue(value: unknown): string | number | boolean | "" {
  if (typeof value === "string") return sanitizeVisibleText(value, "");
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (isRecord(value)) {
    if ("label" in value) return readRenderableValue(value.label);
    if ("text" in value) return readRenderableValue(value.text);
    if ("value" in value) return readRenderableValue(value.value);
  }

  return "";
}

function readString(value: unknown, fallback = "") {
  const normalized = readRenderableValue(value);
  if (typeof normalized === "string") return normalized || fallback;
  if (typeof normalized === "number" || typeof normalized === "boolean") {
    return sanitizeVisibleText(String(normalized), fallback);
  }
  return fallback;
}

function readBoolean(value: unknown) {
  return value === true;
}

function readCellValue(value: unknown): TableCellValue {
  if (isRecord(value) && ("action" in value || "target" in value)) return value;
  const normalized = readRenderableValue(value);
  if (typeof normalized === "string" || typeof normalized === "number" || typeof normalized === "boolean") {
    return normalized;
  }
  return "";
}

function readRows(value: unknown): Array<{ key: string; values: Record<string, TableCellValue> }> {
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

function readColumns(value: unknown): Array<{ key: string; label: string }> {
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

function readOptions(value: unknown) {
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

function readAction(value: unknown): ButtonAction | null {
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

function readSelectedOptionValue(node: ErpNode) {
  const options = readOptions(node.props.options);
  return options.find((option) => option.selected)?.value || "";
}

function getFieldInitialValue(node: ErpNode) {
  return readString(node.props.value, readSelectedOptionValue(node));
}

function collectInitialFormState(nodes: ErpNode[]) {
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

function findSubmitAction(nodes: ErpNode[]): ButtonAction | null {
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

function buildDefaultSubmitAction(node: ErpNode): ButtonAction | null {
  const target = readString(node.props.action);
  if (!target) return null;

  return {
    type: "submit_form",
    target,
    method: readString(node.props.method, "POST").toUpperCase() || "POST",
    onSuccess: "reload_page",
  };
}

function resolveDebugFlag(debug?: boolean) {
  if (typeof debug === "boolean") return debug;
  if (DEBUG_RENDER) return true;
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("erpDebug") === "1" || params.get("erpDocumentDebug") === "1" || window.localStorage.getItem("erpDocumentDebug") === "1";
}

function isAbsoluteExternalUrl(value: string) {
  return /^[a-z]+:\/\//i.test(value) || value.startsWith("//");
}

function isTrustedApiTarget(value: string) {
  return value.startsWith("/api/");
}

function isTrustedRelativeTarget(value: string) {
  return value.startsWith("/") && !isAbsoluteExternalUrl(value);
}

function normalizeActionMethod(value: string) {
  const method = readString(value, "GET").toUpperCase();
  if (method === "GET" || method === "POST") return method;
  throw new ApiError(`Unsupported action method: ${method || "unknown"}`, 400, "INVALID_ACTION_METHOD");
}

function buildRouteTarget(action: ButtonAction) {
  const route = readString(action.targetRoute || action.target);
  if (!route) {
    throw new ApiError("Navigation target is missing.", 400, "INVALID_ACTION");
  }
  if (!isTrustedRelativeTarget(route)) {
    throw new ApiError("External navigation targets are blocked.", 400, "UNTRUSTED_ROUTE");
  }

  if (!action.queryParams || Object.keys(action.queryParams).length === 0) {
    return route;
  }

  const [pathname, existingQuery = ""] = route.split("?", 2);
  const params = new URLSearchParams(existingQuery);
  Object.entries(action.queryParams).forEach(([key, value]) => {
    if (!key) return;
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function assertSafeAction(action: ButtonAction) {
  const method = normalizeActionMethod(action.method);

  if (action.type === "navigate") {
    buildRouteTarget(action);
    return { ...action, method };
  }

  const target = readString(action.target);
  if (!target) {
    throw new ApiError("Action target is missing.", 400, "INVALID_ACTION");
  }

  if (isAbsoluteExternalUrl(target)) {
    throw new ApiError("External action targets are blocked.", 400, "UNTRUSTED_TARGET");
  }

  if (action.type === "api_call" && !isTrustedApiTarget(target)) {
    throw new ApiError("API calls must target /api/* endpoints.", 400, "UNTRUSTED_API_TARGET");
  }

  if (!isTrustedRelativeTarget(target)) {
    throw new ApiError("Only internal ERP endpoints are allowed.", 400, "UNTRUSTED_TARGET");
  }

  return {
    ...action,
    target,
    method,
  };
}

function formatActionError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Request failed.";
}

function ContainerRenderer({ node, renderChildren }: NodeRendererProps) {
  const title = readString(node.props.title);
  const sectionClasses =
    "space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-xl p-5 shadow-sm";

  return (
    <section data-page-contrast="true" className={`space-y-4 ${sectionClasses}`}>
      {title ? <h3 data-page-contrast="true" className="page-contrast-fg text-lg font-bold">{title}</h3> : null}
      <div className="space-y-4">{renderChildren(node.children)}</div>
    </section>
  );
}

function rawString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function looksLikeInternalFormTitle(rawTitle: string, displayTitle: string) {
  const normalizedRaw = rawTitle.toLowerCase().replace(/[\s_-]+/g, "");
  const normalizedDisplay = displayTitle.toLowerCase().replace(/[\s_-]+/g, "");

  if (!normalizedRaw && !normalizedDisplay) return false;
  if (normalizedRaw.startsWith("frm") || normalizedDisplay.startsWith("frm")) return true;
  if ((normalizedRaw.startsWith("form") || normalizedDisplay.startsWith("form")) && !displayTitle.includes(" ")) {
    return true;
  }
  return false;
}

function readDisplayFormTitle(node: ErpNode) {
  const title = readString(node.props.title);
  if (!title) return "";

  const rawTitle = rawString(node.props.title);
  if (looksLikeInternalFormTitle(rawTitle, title)) {
    return "";
  }

  return title;
}

function isSingleNestedFormWrapper(node: ErpNode) {
  return Array.isArray(node.children) && node.children.length === 1 && node.children[0]?.type === "form";
}

function looksLikeImplementationDump(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const codeMarkers =
    normalized.match(
      /(function\s+[a-z0-9_]+\s*\(|\$\(|\$.post\(|\$.ajax\(|document\.getelementbyid|window\.open|serializearray|json\.stringify|closest\(|prop\(|val\(|html\(|css\(|\bvar\s+[a-z0-9_]+\b|\breturn\b|\bif\s*\(|\belse\b|=>|===|!==|\/\*)/gi
    ) || [];
  const symbolHits = (normalized.match(/[{};]/g) || []).length;

  return codeMarkers.length >= 4 || (codeMarkers.length >= 2 && normalized.length > 120) || (codeMarkers.length >= 1 && symbolHits >= 6);
}

function TextRenderer({ node }: NodeRendererProps) {
  const text = readString(node.props.text);
  if (!text || looksLikeImplementationDump(text)) return null;

  return <p data-page-contrast="true" className="page-contrast-fg text-sm leading-6">{text}</p>;
}

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

function TableRenderer({ node }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);
  const title = readString(node.props.title);
  const columns = readColumns(node.props.columns);
  const rows = readRows(node.props.rows);

  if (columns.length === 0 || rows.length === 0) {
    if (actionHandler?.debugEnabled) {
      console.warn("[ERP document] Table schema mismatch", node);
    }
    return null;
  }

  const singleMessage = readSingleMessage(columns, rows);
  if (singleMessage) {
    return (
      <div data-page-contrast="true" className="page-contrast-fg rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] px-4 py-4 text-sm font-medium leading-6 shadow-sm">
        {singleMessage}
      </div>
    );
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

function FormRenderer({ node, renderChildren }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);
  const title = readDisplayFormTitle(node);
  const [values, setValues] = useState<FormValues>(() => collectInitialFormState(node.children));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitAction = useMemo(() => findSubmitAction(node.children) || buildDefaultSubmitAction(node), [node]);

  useEffect(() => {
    setValues(collectInitialFormState(node.children));
    setSubmitting(false);
    setError("");
  }, [node]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((current) => {
      if (current[name] === value) return current;
      return { ...current, [name]: value };
    });
  }, []);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const submit = useCallback(async () => {
    if (!submitAction || !actionHandler) return;

    clearError();
    actionHandler.clearGlobalError();

    try {
      await actionHandler.handleAction(submitAction, {
        node,
        formState: values,
        setPending: setSubmitting,
        setError,
      });
    } catch {
      return;
    }
  }, [actionHandler, clearError, node, submitAction, values]);

  const contextValue = useMemo<FormContextValue>(
    () => ({
      values,
      setValue,
      submitting,
      error,
      clearError,
      setError,
      submit,
    }),
    [clearError, error, setValue, submit, submitting, values]
  );

  if (!title && Array.isArray(node.children) && node.children.length === 0) {
    return null;
  }

  if (!title && isSingleNestedFormWrapper(node)) {
    return <div className="space-y-4">{renderChildren(node.children)}</div>;
  }

  return (
    <FormContext.Provider value={contextValue}>
      <form
        data-page-contrast="true"
        className="space-y-4 rounded-2xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] backdrop-blur-xl p-5 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {title ? <h3 data-page-contrast="true" className="page-contrast-fg text-lg font-bold">{title}</h3> : null}
        <div className="space-y-4">{renderChildren(node.children)}</div>
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      </form>
    </FormContext.Provider>
  );
}

function FieldRenderer({ node }: NodeRendererProps) {
  const form = useContext(FormContext);
  const actionHandler = useContext(ActionHandlerContext);
  const label = readString(node.props.label || node.props.name, "Field");
  const name = readString(node.props.name);
  const inputType = readString(node.props.inputType, "text").toLowerCase();
  const value = getFieldInitialValue(node);
  const placeholder = readString(node.props.placeholder);
  const required = readBoolean(node.props.required);
  const disabled = readBoolean(node.props.disabled) || form?.submitting === true;
  const readOnly = readBoolean(node.props.readOnly);
  const options = readOptions(node.props.options);
  const boundForm = form && name ? form : null;
  const isBound = Boolean(boundForm);
  const currentValue = boundForm ? boundForm.values[name] ?? value : value;

  useEffect(() => {
    if (form && !name && actionHandler?.debugEnabled) {
      console.warn("[ERP document] Field inside form is missing name", node);
    }
  }, [actionHandler?.debugEnabled, form, name, node]);

  const handleChange = useCallback(
    (nextValue: string) => {
      if (!form || !name) return;
      form.clearError();
      form.setValue(name, nextValue);
    },
    [form, name]
  );

  if (inputType === "hidden") {
    return <input type="hidden" name={name || undefined} value={currentValue} readOnly />;
  }

  if (inputType === "select" && options.length > 0) {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
        <select
          name={name || undefined}
          value={isBound ? currentValue : undefined}
          defaultValue={isBound ? undefined : value}
          disabled={disabled}
          onChange={(event) => handleChange(event.currentTarget.value)}
          className="rounded border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-white text-[var(--comp-text-primary)] px-3 py-2"
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={`${node.id}-${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (inputType === "textarea") {
    return (
      <label className="flex flex-col gap-2 text-sm">
        <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
        <textarea
          name={name || undefined}
          value={isBound ? currentValue : undefined}
          defaultValue={isBound ? undefined : value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => handleChange(event.currentTarget.value)}
          className="min-h-24 rounded border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-white text-[var(--comp-text-primary)] px-3 py-2"
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span data-page-contrast="true" className="page-contrast-fg font-medium">{label}</span>
      <input
        type={inputType || "text"}
        name={name || undefined}
        value={isBound ? currentValue : undefined}
        defaultValue={isBound ? undefined : value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => handleChange(event.currentTarget.value)}
        className="rounded border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-white text-[var(--comp-text-primary)] px-3 py-2"
      />
    </label>
  );
}

function ButtonRenderer({ node }: NodeRendererProps) {
  const form = useContext(FormContext);
  const actionHandler = useContext(ActionHandlerContext);
  const label = readString(node.props.label, "Button");
  const inputType = readString(node.props.inputType, "button").toLowerCase();
  const disabled = readBoolean(node.props.disabled);
  let action = readAction(node.props.action);

  if (!action && inputType === "submit" && form) {
    action = { type: "submit_form", target: "", method: "POST", onSuccess: "reload_page" };
  }

  const actionType = readString(action?.type);
  const actionTarget = readString(action?.targetRoute || action?.target);
  const hasRunnableAction =
    actionType === "submit_form"
      ? Boolean(form || actionTarget)
      : actionType === "navigate" || actionType === "api_call"
        ? Boolean(actionTarget)
        : false;
  const isPending = actionHandler?.pendingNodeId === node.id || (form?.submitting === true && actionType === "submit_form");
  const actionHint =
    !hasRunnableAction
      ? "This action is unavailable in the current ERP snapshot."
      : actionType === "submit_form"
        ? "Submits this form"
        : actionType === "navigate"
          ? `Navigates to ${actionTarget || "linked page"}`
          : actionType === "api_call"
            ? `Calls ${actionTarget || "ERP endpoint"}`
            : "";

  useEffect(() => {
    if (!actionHandler?.debugEnabled) return;
    if (node.props.action && !action) {
      console.warn("[ERP document] Button action schema mismatch", node);
      return;
    }
    if (action && !actionTarget && action.type !== "navigate") {
      console.warn("[ERP document] Button action is missing target", node);
    }
  }, [action, actionHandler?.debugEnabled, actionTarget, node]);

  const onClick = useCallback(async () => {
    if (!action || !actionHandler) return;

    form?.clearError();
    actionHandler.clearGlobalError();

    if (action.type === "submit_form" && form) {
      await form.submit();
      return;
    }

    try {
      await actionHandler.handleAction(action, {
        node,
        formState: form?.values,
        setError: form?.setError,
      });
    } catch {
      return;
    }
  }, [action, actionHandler, form, node]);

  return (
    <button
      type={inputType === "submit" ? "submit" : "button"}
      disabled={disabled || isPending || !hasRunnableAction}
      title={actionHint || undefined}
      data-action-type={actionType || undefined}
      data-action-target={actionTarget || undefined}
      onClick={(event) => {
        if (!action || !hasRunnableAction) return;
        event.preventDefault();
        void onClick();
      }}
      className="rounded bg-[var(--comp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {isPending ? "Loading..." : label}
    </button>
  );
}

const registry: Record<ErpNodeType, (props: NodeRendererProps) => ReactNode> = {
  container: ContainerRenderer,
  text: TextRenderer,
  table: TableRenderer,
  form: FormRenderer,
  field: FieldRenderer,
  button: ButtonRenderer,
};

function UnsupportedBlock({ node, renderChildren }: NodeRendererProps) {
  const actionHandler = useContext(ActionHandlerContext);

  useEffect(() => {
    if (!actionHandler?.debugEnabled) return;
    console.warn("[ERP document] Unsupported node rendered as placeholder", node);
  }, [actionHandler?.debugEnabled, node]);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-4">
      <div className="text-sm text-[var(--text-secondary)]">Unsupported content.</div>
      {actionHandler?.debugEnabled ? (
        <div className="mt-2 space-y-2 text-xs text-gray-500">
          <div>
            <span className="font-semibold">PROPS: </span>
            <span>{Object.keys(node.props || {}).length} props</span>
          </div>
          <pre className="text-xs overflow-auto max-h-40 rounded bg-gray-100 p-2">
            {JSON.stringify(node.props, null, 2)}
          </pre>
          <div>
            <span className="font-semibold">CHILDREN: </span>
            <span>
              {Array.isArray(node.children)
                ? `${node.children.length} nodes`
                : "-"}
            </span>
          </div>
        </div>
      ) : null}
      {Array.isArray(node.children) && node.children.length > 0 ? (
        <div className="space-y-3">{renderChildren(node.children)}</div>
      ) : null}
    </div>
  );
}

/**
 * Safely renders a single value for debug display.
 * Objects → JSON.stringify, primitives → String(), never raw object interpolation.
 */
function safeDebugValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function DocumentNode({ node }: { node: ErpNode }) {
  const actionHandler = useContext(ActionHandlerContext);
  const safeNode =
    node && typeof node === "object"
      ? {
        ...node,
        props: isRecord(node.props) ? node.props : {},
        children: Array.isArray(node.children) ? node.children.filter(Boolean) : [],
      }
      : {
        id: "erp-invalid-node",
        type: "text" as const,
        props: { text: "Unsupported content." },
        children: [],
      };
  const Renderer = registry[safeNode.type];

  if (!Renderer) {
    if (actionHandler?.debugEnabled) {
      console.warn("[ERP document] Unrenderable node", safeNode);
    }
    return (
      <UnsupportedBlock
        node={safeNode}
        renderChildren={(children) => children.map((child) => <DocumentNode key={child.id} node={child} />)}
      />
    );
  }

  return (
    <>
      <Renderer
        node={safeNode}
        renderChildren={(children) => children.map((child) => <DocumentNode key={child.id} node={child} />)}
      />
      {actionHandler?.debugEnabled ? (
        <details className="mt-1 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-gray-600">
            🔍 {safeNode.type} #{safeNode.id} —{" "}
            <span className="text-gray-500">
              {Object.keys(safeNode.props).length} props
            </span>
            {" / "}
            <span className="text-gray-500">
              {Array.isArray(safeNode.children)
                ? `${safeNode.children.length} children`
                : "-"}
            </span>
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
            {safeDebugValue(safeNode.props)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

export function renderNode(node: ErpNode): ReactNode {
  return <DocumentNode node={node} />;
}

export default function ErpDocumentRenderer({
  document,
  debug,
  refreshDocument,
}: {
  document: ErpDocument;
  debug?: boolean;
  refreshDocument?: () => Promise<ErpDocument | null>;
}) {
  const navigate = useNavigate();
  const [activeDocument, setActiveDocument] = useState(document);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  const debugEnabled = resolveDebugFlag(debug);

  useEffect(() => {
    setActiveDocument(document);
  }, [document]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.info("[ERP document] Parsed document", activeDocument);
  }, [activeDocument, debugEnabled]);

  const clearGlobalError = useCallback(() => {
    setGlobalError("");
  }, []);

  const handleAction = useCallback(
    async (action: ButtonAction, context: ActionExecutionContext) => {
      if (debugEnabled) {
        console.info("[ERP document] Action triggered", {
          action,
          nodeId: context.node.id,
          formState: context.formState || {},
        });
      }

      clearGlobalError();
      context.setError?.("");
      context.setPending?.(true);
      setPendingNodeId(context.node.id);

      try {
        const safeAction = assertSafeAction(action);

        if (safeAction.type === "navigate") {
          navigate(buildRouteTarget(safeAction));
          return null;
        }

        if (safeAction.type === "submit_form" || safeAction.type === "api_call") {
          const response = await sendErpDocumentRequest({
            url: safeAction.target,
            method: safeAction.method,
            data: context.formState || {},
          });

          if (debugEnabled) {
            console.info("[ERP document] Action response", {
              action: safeAction,
              nodeId: context.node.id,
              response,
            });
          }

          const nextStep = safeAction.onSuccess || "reload_page";
          if (nextStep !== "no_update" && refreshDocument) {
            const refreshedDocument = await refreshDocument();
            if (refreshedDocument) {
              setActiveDocument((currentDocument) => {
                if (nextStep === "update_section" && currentDocument?.root) {
                  return {
                    ...currentDocument,
                    title: refreshedDocument.title || currentDocument.title,
                    root: {
                      ...currentDocument.root,
                      children: Array.isArray(refreshedDocument.root?.children)
                        ? refreshedDocument.root.children
                        : currentDocument.root.children,
                    },
                  };
                }
                return refreshedDocument;
              });
            }
          }

          return response;
        }

        if (debugEnabled) {
          console.warn("[ERP document] Unsupported action", safeAction);
        }
        return null;
      } catch (error) {
        const message = formatActionError(error);
        if (context.setError) {
          context.setError(message);
        } else {
          setGlobalError(message);
        }

        if (debugEnabled) {
          console.error("[ERP document] Action failed", {
            action,
            nodeId: context.node.id,
            error,
          });
        }

        throw error;
      } finally {
        context.setPending?.(false);
        setPendingNodeId((current) => (current === context.node.id ? null : current));
      }
    },
    [clearGlobalError, debugEnabled, navigate, refreshDocument]
  );

  const actionContextValue = useMemo<ActionHandlerContextValue>(
    () => ({
      debugEnabled,
      pendingNodeId,
      globalError,
      clearGlobalError,
      handleAction,
    }),
    [clearGlobalError, debugEnabled, globalError, handleAction, pendingNodeId]
  );

  return (
    <ActionHandlerContext.Provider value={actionContextValue}>
      <div className="space-y-4 pb-6">
        {globalError ? (
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-3 text-sm text-[var(--error)]">{globalError}</div>
        ) : null}
        <DocumentNode node={activeDocument.root} />
      </div>
    </ActionHandlerContext.Provider>
  );
}
