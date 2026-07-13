import { ApiError } from "../erp/index";
import { handleSessionAuthFailure, isSessionAuthFailure } from "./session";
import { parseApiErrorBody, parseJsonSafe, requestJson } from "./requestUtils";

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
