import { buildMultipartForm, isStaticPrototype, requestData, requestMultipart } from "./http";
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
import { STATIC_ADMIN_LEARNING_ITEM, STATIC_CONTENT_WORKFLOW } from "./content";
import { STATIC_LMS_PUBLISHER, STATIC_LMS_RESOURCES } from "./resources";

const STATIC_GUIDE = {
  id: "guide-normalization",
  authorId: STATIC_LMS_PUBLISHER.userId,
  title: "Normalization study guide",
  description: "Step-by-step normalization practice for database exams.",
  subjectCode: "CSE301",
  subjectName: "Database Systems",
  semester: "6",
  unit: "Normalization",
  tags: ["dbms", "normalization"],
  published: 1,
  sections: [
    {
      id: "gsec-1",
      guideId: "guide-normalization",
      title: "Introduction",
      content: "Start from functional dependencies, then work up to 3NF with worked examples.",
      position: 1,
    },
  ],
  readSections: [],
  upvotes: 4,
  viewCount: 21,
  qualityScore: 3.5,
  createdAt: "2026-05-02T10:00:00.000Z",
  updatedAt: "2026-05-02T10:00:00.000Z",
} as unknown as LmsGuide;

export async function listGuides(params: Record<string, unknown> = {}) {
  if (isStaticPrototype()) {
    return [STATIC_GUIDE];
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsGuide[]>(`/api/lms/guides?${search.toString()}`);
}

export async function createGuide(payload: Record<string, unknown>) {
  return requestData<LmsGuide>("/api/lms/guides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGuide(id: string) {
  if (isStaticPrototype()) {
    return { ...STATIC_GUIDE, id };
  }
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}`);
}

export async function updateGuide(id: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteGuide(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/guides/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addGuideSection(id: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}/sections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateGuideSection(guideId: string, sectionId: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(guideId)}/sections/${encodeURIComponent(sectionId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function markGuideSectionRead(guideId: string, sectionId: string) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(guideId)}/sections/${encodeURIComponent(sectionId)}/read`, {
    method: "POST",
  });
}

export async function toggleGuideUpvote(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/guides/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}
