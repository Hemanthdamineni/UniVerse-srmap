import { ApiError } from "./erpApi";
import { handleSessionAuthFailure, isSessionAuthFailure } from "./session";

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

  if (typeof body.message === "string" && body.message.trim()) {
    return {
      message: body.message,
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

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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

export async function requestData<T>(url: string, init?: RequestInit): Promise<T> {
  const payload = await requestJson<unknown>(url, init);
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function requestMultipart<T>(url: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    body: formData,
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

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
