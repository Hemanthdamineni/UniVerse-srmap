import { handleSessionAuthFailure, isSessionAuthFailure } from "./session";

export type ErpNodeType = "container" | "text" | "table" | "form" | "field" | "button";

export type ErpNode = {
  id: string;
  type: ErpNodeType;
  props: Record<string, unknown>;
  children: ErpNode[];
};

export type ErpDocument = {
  title: string;
  root: ErpNode;
};

export type ErpPageResponse = {
  success?: boolean;
  pageKey: string;
  source?: string;
  fetchedAt?: string;
  staleAt?: string | null;
  policyMode?: string;
  warnings?: string[];
  meta?: {
    normalizationRules?: string[];
    issues?: Array<{ sectionKey?: string; tableIndex?: number; message?: string }>;
    targets?: Array<{ dropdown?: string; subitem?: string }>;
  };
  data: unknown;
  document?: ErpDocument;
};

export type ErpSectionRef = {
  sourcePageKey?: string;
  key?: string;
  dropdown?: string;
  subitem?: string;
};

export type ErpAction = {
  id: string;
  label: string;
  kind: string;
  enabled?: boolean;
  disabledReason?: string;
  formRef?: string;
  tableRowIndex?: number;
  payloadDefaults?: Record<string, unknown>;
  controlRef?: {
    functionName?: string;
    args?: Array<string | number>;
  };
  execution?: {
    method?: string;
    url?: string;
    targetId?: number;
    functionName?: string;
    args?: Array<string | number>;
  };
};

export type ErpFieldOption = {
  value: string;
  label: string;
  selected?: boolean;
};

export type ErpFormField = {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  helperText?: string;
  value?: string;
  options?: ErpFieldOption[];
  maxLength?: number;
};

export type ErpForm = {
  id?: string;
  name?: string;
  method?: string;
  action?: string;
  fields?: ErpFormField[];
};

export type ErpUiSection = {
  sourcePageKey?: string;
  key?: string;
  dropdown?: string;
  subitem?: string;
  pageHeading?: string;
  forms?: ErpForm[];
  actions?: ErpAction[];
};

export type ErpUiHintsResponse = {
  success?: boolean;
  pageKey: string;
  sections: ErpUiSection[];
  warnings?: string[];
};

export type ErpSchemaBlock = {
  id: string;
  type: string;
  sourcePageKey?: string;
  title?: string;
  showStatus?: boolean;
  showDescription?: boolean;
  showActions?: boolean;
  visibleWhenEmpty?: boolean;
  listKey?: string;
  section?: ErpSectionRef;
};

export type ErpSchemaResponse = {
  success?: boolean;
  pageKey: string;
  schemaVersion?: string;
  blocks: ErpSchemaBlock[];
  warnings?: string[];
};

export type ErpActionExecuteResponse = {
  success: boolean;
  pageKey: string;
  actionId: string;
  status: number;
  method: string;
  url: string;
  message?: string;
  preview?: string;
  targetRoute?: string;
  html?: string;
  printReady?: boolean;
  contentType?: string;
};

export type ErpPageFailure = {
  success: false;
  pageKey: string;
  error: string;
  status: number;
  code: string;
};

export type ErpBatchPageResult = ErpPageResponse | ErpPageFailure;

export type ErpBatchResponse = Record<string, ErpBatchPageResult>;

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = "UNKNOWN", retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function withPageKeyPath(prefix: string, pageKey: string) {
  return `${prefix}/${encodeURIComponent(pageKey)}`;
}

function parseApiErrorBody(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const body = payload as Record<string, unknown>;
  const errorValue = body.error;

  if (errorValue && typeof errorValue === "object") {
    const errorObject = errorValue as Record<string, unknown>;
    return {
      message: String(errorObject.message || "Request failed"),
      code: String(errorObject.code || "UNKNOWN"),
      retryable: Boolean(errorObject.retryable),
    };
  }

  if (typeof errorValue === "string" && errorValue.trim()) {
    return {
      message: errorValue,
      code: "UNKNOWN",
      retryable: false,
    };
  }

  return null;
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function parseTextSafe(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, payload)) {
      handleSessionAuthFailure();
    }

    const parsed = parseApiErrorBody(payload);
    throw new ApiError(
      parsed?.message || `Request failed with status ${response.status}`,
      response.status,
      parsed?.code || "UNKNOWN",
      parsed?.retryable || false
    );
  }

  return payload as T;
}

export async function sendErpDocumentRequest(payload: {
  url: string;
  method?: string;
  data?: Record<string, unknown>;
}): Promise<unknown> {
  const method = String(payload.method || "GET").trim().toUpperCase() || "GET";
  const baseUrl = String(payload.url || "").trim();
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};

  let url = baseUrl;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {},
  };

  if (method === "GET") {
    const search = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      search.set(key, String(value));
    });
    const query = search.toString();
    if (query) {
      url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
    }
  } else if (url.startsWith("/api/")) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(data);
  } else {
    const form = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      form.set(key, String(value));
    });
    init.headers = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
    init.body = form.toString();
  }

  const response = await fetch(url, init);
  const jsonPayload = await parseJsonSafe(response);

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, jsonPayload)) {
      handleSessionAuthFailure();
    }

    const parsed = parseApiErrorBody(jsonPayload);
    throw new ApiError(
      parsed?.message || `Request failed with status ${response.status}`,
      response.status,
      parsed?.code || "UNKNOWN",
      parsed?.retryable || false
    );
  }

  if (jsonPayload !== null) {
    return jsonPayload;
  }

  return parseTextSafe(response);
}

export async function getErpPage(pageKey: string, fallbackSessionId?: string): Promise<ErpPageResponse> {
  try {
    const v2 = await requestJson<ErpPageResponse>(withPageKeyPath("/api/v2/erp/page", pageKey));
    return v2;
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.status !== 404 && apiError.status !== 400) {
      throw apiError;
    }

    const query = fallbackSessionId ? `?sessionId=${encodeURIComponent(fallbackSessionId)}` : "";
    const legacyPayload = await requestJson<unknown>(`/api/${pageKey}${query}`);
    return {
      pageKey,
      source: "legacy",
      data: legacyPayload,
      warnings: ["Loaded via legacy ERP route. V2 schema may be partial."],
    };
  }
}

export async function getErpBatch(pageKeys: string[]): Promise<ErpBatchResponse> {
  const normalizedPageKeys = Array.from(
    new Set(
      pageKeys
        .map((key) => String(key || "").trim())
        .filter(Boolean)
    )
  );

  if (!normalizedPageKeys.length) {
    return {};
  }

  const payload = await requestJson<{ success?: boolean; data?: ErpBatchResponse }>("/api/v2/erp/batch", {
    method: "POST",
    body: JSON.stringify({ pageKeys: normalizedPageKeys }),
  });

  return payload?.data || {};
}

export async function getErpUiHints(pageKey: string): Promise<ErpUiHintsResponse | null> {
  try {
    return await requestJson<ErpUiHintsResponse>(withPageKeyPath("/api/v2/erp/ui", pageKey));
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.status === 404 || apiError.status === 400) return null;
    throw apiError;
  }
}

export async function getErpSchema(pageKey: string): Promise<ErpSchemaResponse | null> {
  try {
    return await requestJson<ErpSchemaResponse>(withPageKeyPath("/api/v2/erp/schema", pageKey));
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.status === 404 || apiError.status === 400) return null;
    throw apiError;
  }
}

export async function executeErpAction(payload: {
  pageKey: string;
  actionId: string;
  actionPayload?: Record<string, unknown>;
  method?: string;
  url?: string;
  sessionId?: string;
}): Promise<ErpActionExecuteResponse> {
  const body = {
    pageKey: payload.pageKey,
    actionId: payload.actionId,
    payload: payload.actionPayload || {},
    ...(payload.method ? { method: payload.method } : {}),
    ...(payload.url ? { url: payload.url } : {}),
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
  };

  return requestJson<ErpActionExecuteResponse>("/api/v2/erp/action/execute", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
