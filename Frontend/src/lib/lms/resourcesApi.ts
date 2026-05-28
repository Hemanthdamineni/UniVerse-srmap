import { buildMultipartForm, isStaticPrototype, requestData, requestMultipart } from "./http";
import {
  STATIC_ADMIN_LEARNING_ITEM,
  STATIC_CAREER_READINESS,
  STATIC_CONTENT_WORKFLOW,
  STATIC_LMS_PUBLISHER,
  STATIC_LMS_RESOURCES,
  STATIC_RECOMMENDATION_EVENTS,
  STATIC_TRACKER_SNAPSHOT,
  STATIC_UNIFIED_INSIGHTS,
} from "./fixtures";
import type {
  ResourceCatalogCourse,
  ResourceCatalogResponse,
  ResourceSubjectResponse,
  LearningResourceItem,
  ResourceLibraryResponse,
  ResourceRecommendation,
  ContentWorkflowSpec,
  ContentHistoryEntry,
  ContentBulkPreview,
  UploadedResource,
  LmsTrackerSnapshotSummary,
  LmsTrackerRecommendationEvent,
  CareerReadiness,
  UnifiedInsights,
  LmsPagination,
  LmsTopic,
  LmsComment,
  LmsAnnotation,
  LmsPublisherSummary,
  LmsModerationSummary,
  LmsRecommendationReason,
  LmsResourceFlag,
  LmsModerationAuditEntry,
  LmsResource,
  LmsGuideSection,
  LmsGuide,
  LmsRoadmapNode,
  LmsRoadmap,
  LmsRequest,
  LmsCollection,
  LmsModerationQueueResponse
} from "./types";

export async function getLearningMaterialCatalog(year?: number | null) {
  if (isStaticPrototype()) {
    return {
      years: [2],
      selectedYear: year || 2,
      courses: [
        {
          year: 2,
          courseCode: "CSE",
          courseName: "Computer Science and Engineering",
          subjectCount: 1,
          resourceCount: 1,
        },
      ],
    };
  }
  const query = year ? `?year=${encodeURIComponent(String(year))}` : "";
  return requestData<ResourceCatalogResponse>(`/api/resources/catalog${query}`);
}

export async function getLearningMaterialSubjects(year: number, courseCode: string) {
  if (isStaticPrototype()) {
    return {
      year,
      courseCode,
      subjects: [
        {
          subjectCode: "CSE304",
          subjectName: "Operating Systems",
          semester: 4,
          groups: ["notes"],
          resourceCount: 1,
        },
      ],
    };
  }
  return requestData<ResourceSubjectResponse>(
    `/api/resources/subjects?year=${encodeURIComponent(String(year))}&courseCode=${encodeURIComponent(courseCode)}`
  );
}

export async function getLearningMaterialLibrary(payload: {
  year: number;
  courseCode: string;
  subjectCode: string;
  query?: string;
}) {
  if (isStaticPrototype()) {
    return {
      subject: {
        year: payload.year,
        courseCode: payload.courseCode,
        courseName: "Computer Science and Engineering",
        subjectCode: payload.subjectCode,
        subjectName: "Operating Systems",
        semester: 4,
      },
      groups: [
        {
          group: "notes",
          label: "Notes",
          items: [STATIC_ADMIN_LEARNING_ITEM],
        },
      ],
      totalItems: 1,
      totalResources: 1,
    };
  }
  const params = new URLSearchParams({
    year: String(payload.year),
    courseCode: payload.courseCode,
    subjectCode: payload.subjectCode,
  });
  if (payload.query?.trim()) params.set("query", payload.query.trim());
  return requestData<ResourceLibraryResponse>(`/api/resources/library?${params.toString()}`);
}

export async function listAdminLearningMaterialItems(filters: Record<string, string>, headers?: HeadersInit) {
  if (isStaticPrototype()) return { items: [STATIC_ADMIN_LEARNING_ITEM] };
  const params = new URLSearchParams(filters);
  return requestData<{ items: Array<LearningResourceItem & { createdAt?: string; updatedAt?: string }> }>(
    `/api/resources/admin/items?${params.toString()}`,
    { headers }
  );
}

export async function createLearningMaterialItem(payload: Record<string, unknown>, headers?: HeadersInit) {
  if (isStaticPrototype()) return { ...STATIC_ADMIN_LEARNING_ITEM, ...payload, id: "static-content-created" } as LearningResourceItem;
  return requestData<LearningResourceItem>("/api/resources/items", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function updateLearningMaterialItem(
  contentId: string,
  payload: Record<string, unknown>,
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    return {
      ...STATIC_ADMIN_LEARNING_ITEM,
      ...payload,
      id: contentId,
      version: Number(STATIC_ADMIN_LEARNING_ITEM.version || 1) + 1,
    } as LearningResourceItem;
  }
  return requestData<LearningResourceItem>(`/api/resources/items/${encodeURIComponent(contentId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function deleteLearningMaterialItem(contentId: string, headers?: HeadersInit) {
  if (isStaticPrototype()) return { deleted: true, id: contentId, lifecycleState: "deleted" };
  return requestData<{ deleted: boolean }>(`/api/resources/items/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
    headers,
  });
}

export async function getContentWorkflow(headers?: HeadersInit) {
  if (isStaticPrototype()) return STATIC_CONTENT_WORKFLOW;
  return requestData<ContentWorkflowSpec>("/api/content/admin/workflow", { headers });
}

export async function getLearningMaterialHistory(contentId: string, headers?: HeadersInit) {
  if (isStaticPrototype()) {
    return {
      items: [
        {
          id: "static-audit-1",
          contentId,
          action: "edit",
          actorId: "AP23110010419",
          actorRole: "admin",
          reason: "Title clarified",
          before: { title: "OS Notes", lifecycleState: "published" },
          after: { title: "Operating Systems Revision Notes", lifecycleState: "published" },
          diff: {
            title: { before: "OS Notes", after: "Operating Systems Revision Notes" },
          },
          createdAt: "2026-05-26T09:00:00.000Z",
        },
      ],
    };
  }
  return requestData<{ items: ContentHistoryEntry[] }>(
    `/api/resources/items/${encodeURIComponent(contentId)}/history`,
    { headers }
  );
}

export async function transitionLearningMaterialLifecycle(
  contentId: string,
  payload: { action: string; reason?: string },
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    const nextState =
      payload.action === "archive"
        ? "archived"
        : payload.action === "unpublish"
          ? "unpublished"
          : payload.action === "delete"
            ? "deleted"
            : "published";
    return { ...STATIC_ADMIN_LEARNING_ITEM, id: contentId, lifecycleState: nextState } as LearningResourceItem;
  }
  return requestData<LearningResourceItem>(`/api/resources/items/${encodeURIComponent(contentId)}/lifecycle`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function previewLearningMaterialBulkAction(
  payload: { ids: string[]; action: string },
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    return {
      action: payload.action,
      valid: true,
      invalidCount: 0,
      items: payload.ids.map((id) => ({
        id,
        title: STATIC_ADMIN_LEARNING_ITEM.title,
        type: "learning_material",
        currentState: STATIC_ADMIN_LEARNING_ITEM.lifecycleState,
        nextState: payload.action === "archive" ? "archived" : payload.action === "unpublish" ? "unpublished" : "published",
        valid: true,
      })),
    } satisfies ContentBulkPreview;
  }
  return requestData<ContentBulkPreview>("/api/resources/admin/items/bulk-preview", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function executeLearningMaterialBulkAction(
  payload: { ids: string[]; action: string; reason?: string },
  headers?: HeadersInit
) {
  if (isStaticPrototype()) return { action: payload.action, updated: payload.ids.length, items: payload.ids };
  return requestData<{ action: string; updated: number; items: LearningResourceItem[] }>(
    "/api/resources/admin/items/bulk-execute",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
}

export async function createResourceRecommendation(payload: Record<string, unknown>) {
  if (isStaticPrototype()) {
    return {
      id: "static-resource-recommendation",
      type: "page",
      title: String(payload.title || "Static recommendation"),
      description: String(payload.description || ""),
      lifecycleState: "review",
      version: 1,
      metadata: {
        status: "pending",
        recommenderName: "Static Student",
      },
      resources: [
        {
          id: "static-resource-recommendation-link",
          kind: String(payload.kind || "link"),
          title: String(payload.title || "Static recommendation"),
          urlOrPath: String(payload.url || "https://example.com/resource"),
        },
      ],
      createdAt: "2026-05-26T09:05:00.000Z",
    };
  }
  return requestData<ResourceRecommendation>("/api/resources/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadResourceFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return requestMultipart<UploadedResource>("/api/uploads", form, {
    method: "POST",
  });
}

export async function listResourceRecommendations(headers?: HeadersInit) {
  if (isStaticPrototype()) return { items: [] };
  return requestData<{ items: ResourceRecommendation[] }>("/api/resources/recommendations", {
    headers,
  });
}

export async function reviewResourceRecommendation(
  contentId: string,
  payload: { status: "approved" | "rejected" | "pending"; reviewerNotes?: string },
  headers?: HeadersInit
) {
  return requestData<ResourceRecommendation>(`/api/resources/recommendations/${encodeURIComponent(contentId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

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
