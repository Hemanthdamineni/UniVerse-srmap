import {
  getSessionId,
  handleSessionAuthFailure,
  isSessionAuthFailure,
} from "../../../lib/session";
import type { ExternalPagePayload, KeyLoadResult } from "./types";
import { isRecord } from "./valueUtils";

export async function loadErpKey(pageKey: string): Promise<KeyLoadResult> {
  const liveResponse = await fetchJson(buildApiPath("/api/scrape", pageKey));
  return {
    pageKey,
    source: "live",
    payload: liveResponse,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadExternalPage(pageKey: string): Promise<ExternalPagePayload> {
  const payload = await fetchJson(buildApiPath("/api/external", pageKey), {
    nonJsonMessage: "External service returned non-JSON response",
  });

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new Error("Invalid external payload format");
  }

  const data = payload.data;
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    title: typeof data.title === "string" ? data.title : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    items: items
      .filter(isRecord)
      .map((item) => ({
        label: typeof item.label === "string" ? item.label : undefined,
        value: typeof item.value === "string" ? item.value : undefined,
      })),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

async function fetchJson(
  path: string,
  options: {
    nonJsonMessage?: string;
  } = {}
): Promise<unknown> {
  const sessionId = getSessionId();
  const url = sessionId && !path.includes("/api/external") ? `${path}?sessionId=${encodeURIComponent(sessionId)}` : path;

  const response = await fetch(url, {
    credentials: "include",
  });

  const parsed = await parseJsonResponse(response, options.nonJsonMessage);

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, parsed)) {
      handleSessionAuthFailure();
    }
    const errorMessage = extractErrorMessage(parsed) || `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  if (isRecord(parsed) && parsed.success === false) {
    const errorMessage = extractErrorMessage(parsed) || "Request failed";
    throw new Error(errorMessage);
  }

  return parsed;
}

async function parseJsonResponse(response: Response, nonJsonMessage = "Service returned non-JSON response") {
  const raw = await response.text();
  const trimmed = raw.trim();
  const contentType = response.headers.get("content-type") || "";

  const isLikelyJson =
    contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (!isLikelyJson) {
    throw new Error(nonJsonMessage);
  }

  try {
    return trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(nonJsonMessage);
  }
}

function extractErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const candidates = [value.error, value.message, value.details]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return candidates[0] || null;
}

function buildApiPath(basePath: string, pageKey: string) {
  const [category, page] = pageKey.split("/");
  if (!page) {
    return `${basePath}/${encodeURIComponent(category)}`;
  }
  return `${basePath}/${encodeURIComponent(category)}/${encodeURIComponent(page)}`;
}
