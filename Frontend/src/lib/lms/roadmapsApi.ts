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

export async function listRoadmaps(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsRoadmap[]>(`/api/lms/roadmaps?${search.toString()}`);
}

export async function createRoadmap(payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>("/api/lms/roadmaps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRoadmap(id: string) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}`);
}

export async function deleteRoadmap(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/roadmaps/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addRoadmapNode(id: string, payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}/nodes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addRoadmapEdge(id: string, payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}/edges`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeRoadmapNode(roadmapId: string, nodeId: string) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(roadmapId)}/nodes/${encodeURIComponent(nodeId)}/complete`, {
    method: "POST",
  });
}
