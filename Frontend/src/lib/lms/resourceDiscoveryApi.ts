import { buildMultipartForm, isStaticPrototype, requestData, requestMultipart } from "./http";
import { STATIC_LMS_PUBLISHER, STATIC_LMS_RESOURCES } from "./fixtures";
import type {
  LmsCollection,
  LmsModerationAuditEntry,
  LmsModerationQueueResponse,
  LmsPagination,
  LmsResource,
} from "./types";

export async function listLmsResources(params: Record<string, unknown> = {}) {
  if (isStaticPrototype()) {
    const query = String(params.query || "").toLowerCase();
    const subjectCode = String(params.subjectCode || "").toUpperCase();
    const type = String(params.type || "");
    const items = STATIC_LMS_RESOURCES.filter((item) => {
      if (subjectCode && item.subjectCode !== subjectCode) return false;
      if (type && item.type !== type) return false;
      if (query && !`${item.title} ${item.description || ""}`.toLowerCase().includes(query)) return false;
      return item.moderation?.publicEligible !== false;
    });
    return { items, pagination: { page: 1, limit: items.length || 20, total: items.length } };
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return requestData<{ items: LmsResource[]; pagination: LmsPagination }>(`/api/lms/resources?${search.toString()}`);
}

export async function getLmsResource(id: string) {
  if (isStaticPrototype()) {
    const resource = STATIC_LMS_RESOURCES.find((item) => item.id === id) || STATIC_LMS_RESOURCES[0];
    return {
      ...resource,
      comments: [
        {
          id: "comment-static-1",
          resourceId: resource.id,
          userId: "AP23110010001",
          content: "This helped me connect query plans with index choices.",
          helpful: 3,
          createdAt: "2026-05-24T10:00:00.000Z",
        },
      ],
      annotations: [],
      related: STATIC_LMS_RESOURCES.filter((item) => item.id !== resource.id),
    };
  }
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`);
}

export async function createLmsResource(payload: Record<string, unknown>) {
  const hasFile = payload.file instanceof File;
  if (hasFile) {
    return requestMultipart<LmsResource>("/api/lms/resources", buildMultipartForm(payload));
  }
  return requestData<LmsResource>("/api/lms/resources", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLmsResource(id: string, payload: Record<string, unknown>) {
  const hasFile = payload.file instanceof File;
  if (hasFile) {
    return requestMultipart<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`, buildMultipartForm(payload), {
      method: "PUT",
    });
  }
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLmsResource(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/resources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function restoreLmsResource(id: string) {
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

export async function checkLmsDuplicate(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ exact: LmsResource | null; similar: LmsResource[]; hasDuplicate: boolean }>(
    `/api/lms/resources/check-duplicate?${search.toString()}`
  );
}

export async function getPyqBank(subjectCode: string, params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: LmsResource[]; pagination: LmsPagination }>(
    `/api/lms/pyq/${encodeURIComponent(subjectCode)}?${search.toString()}`
  );
}

export async function getUpcomingPyqs() {
  return requestData<LmsResource[]>("/api/lms/pyq/upcoming");
}

export async function listLmsCollections() {
  return requestData<LmsCollection[]>("/api/lms/collections");
}

export async function createLmsCollection(payload: Record<string, unknown>) {
  return requestData<LmsCollection>("/api/lms/collections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLmsCollection(id: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}`);
}

export async function addToLmsCollection(id: string, resourceId: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}/items`, {
    method: "POST",
    body: JSON.stringify({ resourceId }),
  });
}

export async function removeFromLmsCollection(id: string, resourceId: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(resourceId)}`, {
    method: "DELETE",
  });
}

export async function getRecommendations(params: Record<string, unknown> = {}) {
  if (isStaticPrototype()) {
    const limit = Number(params.limit || 12);
    return STATIC_LMS_RESOURCES.filter((item) => item.moderation?.recommendationEligible !== false).slice(0, limit);
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsResource[]>(`/api/lms/recommendations?${search.toString()}`);
}

export async function getNextStepRecommendation(resourceId: string) {
  return requestData<LmsResource[]>(`/api/lms/recommendations/next-step?resourceId=${encodeURIComponent(resourceId)}`);
}

export async function getExploreData() {
  if (isStaticPrototype()) {
    return {
      trending: STATIC_LMS_RESOURCES,
      topRated: STATIC_LMS_RESOURCES,
      examReady: STATIC_LMS_RESOURCES.filter((item) => Number(item.examProvenScore || 0) > 1),
    };
  }
  return requestData<{
    trending: LmsResource[];
    topRated: LmsResource[];
    examReady: LmsResource[];
  }>("/api/lms/explore");
}

export async function getSubjectOverview(subjectCode: string) {
  return requestData<Record<string, unknown>>(`/api/lms/subjects/${encodeURIComponent(subjectCode)}/overview`);
}

export async function getSubjectPresence(subjectCode: string) {
  return requestData<{ subjectCode: string; count: number }>(`/api/lms/subjects/${encodeURIComponent(subjectCode)}/presence`);
}

export async function getTopicGraph(subjectCode: string) {
  return requestData<Record<string, unknown>>(`/api/lms/topics/graph?subjectCode=${encodeURIComponent(subjectCode)}`);
}

export async function getContributorProfile(userId: string) {
  if (isStaticPrototype()) {
    const resources = STATIC_LMS_RESOURCES.filter((item) => item.uploadedBy === userId);
    const trust = resources[0]?.publisher || STATIC_LMS_PUBLISHER;
    return {
      userId,
      displayName: trust.displayName,
      trust,
      totals: { resources: resources.length, guides: 0, roadmaps: 0 },
      recentResources: resources,
      contributions: { resources, guides: [], roadmaps: [] },
    };
  }
  return requestData<Record<string, unknown>>(`/api/lms/contributors/${encodeURIComponent(userId)}`);
}

export async function getLmsResourceModerationQueue(params: Record<string, unknown> = {}, headers?: HeadersInit) {
  if (isStaticPrototype()) {
    const items = STATIC_LMS_RESOURCES.filter((item) => item.moderation?.needsReview);
    return {
      items,
      counts: { total: items.length, flagged: items.length, hidden: 0, removed: 0, visible: items.length },
      pagination: { page: 1, limit: items.length || 25, total: items.length },
    };
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsModerationQueueResponse>(`/api/lms/admin/resource-flags?${search.toString()}`, { headers });
}

export async function moderateLmsResource(
  id: string,
  payload: { decision: "approve" | "hide" | "remove" | "restore"; reason: string },
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    return {
      resource: {
        ...(STATIC_LMS_RESOURCES.find((item) => item.id === id) || STATIC_LMS_RESOURCES[0]),
        moderationState: payload.decision === "hide" ? 2 : payload.decision === "remove" ? 3 : 0,
        flagCount: 0,
        moderation: {
          state: payload.decision === "hide" ? 2 : payload.decision === "remove" ? 3 : 0,
          label: payload.decision,
          flagCount: 0,
          flagReason: payload.reason,
          publicEligible: payload.decision === "approve" || payload.decision === "restore",
          searchEligible: payload.decision === "approve" || payload.decision === "restore",
          recommendationEligible: payload.decision === "approve" || payload.decision === "restore",
          needsReview: false,
        },
      },
      audit: [
        {
          id: "audit-static-decision",
          resourceId: id,
          action: `decision_${payload.decision}`,
          actorId: "AP23110010419",
          reason: payload.reason,
          createdAt: new Date("2026-05-26T04:10:00.000Z").toISOString(),
        },
      ],
    };
  }
  return requestData<{ resource: LmsResource; audit: LmsModerationAuditEntry[] }>(
    `/api/lms/admin/resources/${encodeURIComponent(id)}/moderation`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    }
  );
}
