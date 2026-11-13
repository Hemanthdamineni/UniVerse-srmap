import { requestData } from "../core/apiClient";

/** Content item shape returned by `/api/intranet/*`. */
export type IntranetItem = {
  id: string;
  sourceKey: string;
  contentType: string;
  audience: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  publishedAt?: string | null;
  eventStart?: string | null;
  eventEnd?: string | null;
  deadline?: string | null;
  department?: string | null;
  tags?: string[];
  sourceUrl: string;
  canonicalUrl?: string | null;
  documentLinks?: Array<{ url: string; label?: string }>;
  isActive?: boolean;
};

export type IntranetListResponse = {
  items: IntranetItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Recent shared intranet content for the dashboard feed.
 * Backend route: GET /api/intranet/feed
 */
export async function getIntranetFeed(limit = 15): Promise<IntranetItem[]> {
  const payload = await requestData<IntranetItem[] | { feed?: IntranetItem[] }>(
    `/api/intranet/feed?limit=${encodeURIComponent(String(limit))}`
  );
  if (Array.isArray(payload)) return payload;
  return payload?.feed ?? [];
}

/**
 * Paginated/filtered intranet content by content type.
 * Backend route: GET /api/intranet/items
 */
export async function listIntranetItems(query: Record<string, string> = {}): Promise<IntranetListResponse> {
  const params = new URLSearchParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestData<IntranetListResponse>(`/api/intranet/items${suffix}`);
}

/** Backend route: GET /api/intranet/items/:id */
export async function getIntranetItem(id: string): Promise<IntranetItem> {
  return requestData<IntranetItem>(`/api/intranet/items/${encodeURIComponent(id)}`);
}