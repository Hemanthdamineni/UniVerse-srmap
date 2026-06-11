import { isStaticPrototype, requestData, requestMultipart } from "./http";
import { STATIC_ADMIN_LEARNING_ITEM, STATIC_CONTENT_WORKFLOW } from "./fixtures";
import type {
  ContentBulkPreview,
  ContentHistoryEntry,
  ContentWorkflowSpec,
  LearningResourceItem,
  ResourceCatalogResponse,
  ResourceLibraryResponse,
  ResourceRecommendation,
  ResourceSubjectResponse,
  UploadedResource,
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
