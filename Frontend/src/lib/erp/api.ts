import { handleSessionAuthFailure, isSessionAuthFailure } from "../core/session";
import { isStaticPrototype, loadStaticErpSupplementalJson, minimalStaticErpPageResponse, resolveStaticErpBatch } from "../core/prototype";

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

  if (isStaticPrototype()) {
    return resolveStaticErpBatch(normalizedPageKeys);
  }

  const payload = await requestJson<{ success?: boolean; data?: ErpBatchResponse }>("/api/v2/erp/batch", {
    method: "POST",
    body: JSON.stringify({ pageKeys: normalizedPageKeys }),
  });

  return payload?.data || {};
}

export async function executeErpAction(payload: {
  pageKey: string;
  actionId: string;
  actionPayload?: Record<string, unknown>;
  method?: string;
  url?: string;
  sessionId?: string;
}): Promise<ErpActionExecuteResponse> {
  if (isStaticPrototype()) {
    return {
      success: true,
      pageKey: payload.pageKey,
      actionId: payload.actionId,
      status: 200,
      method: String(payload.method || "POST").toUpperCase() || "POST",
      url: String(payload.url || "/api/v2/erp/action/execute"),
      message: "Static prototype: action not executed against a live server.",
    };
  }

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
