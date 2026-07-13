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

export async function toggleResourceUpvote(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/resources/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function toggleResourceBookmark(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/resources/${encodeURIComponent(id)}/bookmark`, {
    method: "POST",
  });
}

export async function flagLmsResource(id: string, reason: string) {
  if (isStaticPrototype()) {
    return {
      flagCount: 1,
      moderationState: 1,
      moderation: {
        state: 1,
        label: "Flagged for review",
        flagCount: 1,
        flagReason: reason,
        publicEligible: true,
        searchEligible: true,
        recommendationEligible: false,
        needsReview: true,
      },
    };
  }
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function markLmsResourceOutdated(id: string, reason: string) {
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/mark-outdated`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function rateLmsResource(id: string, payload: { rating: number; review?: string; dimensionTags?: string[] }) {
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}/rate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recordLmsResourceView(id: string, payload: { timeSpentMs?: number; metadata?: Record<string, unknown> } = {}) {
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/view`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLmsComments(id: string) {
  return requestData<LmsComment[]>(`/api/lms/resources/${encodeURIComponent(id)}/comments`);
}

export async function postLmsComment(id: string, content: string) {
  return requestData<LmsComment[]>(`/api/lms/resources/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function toggleCommentHelpful(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/comments/${encodeURIComponent(id)}/helpful`, {
    method: "POST",
  });
}

export async function getLmsAnnotations(resourceId: string) {
  return requestData<LmsAnnotation[]>(`/api/lms/resources/${encodeURIComponent(resourceId)}/annotations`);
}

export async function saveLmsAnnotation(resourceId: string, content: string) {
  return requestData<LmsAnnotation[]>(`/api/lms/resources/${encodeURIComponent(resourceId)}/annotations`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function deleteLmsAnnotation(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/annotations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listLmsRequests(params: Record<string, unknown> = {}) {
  if (isStaticPrototype()) {
    return { items: [], pagination: { page: 1, limit: Number(params.limit || 20), total: 0 } };
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: LmsRequest[]; pagination: LmsPagination }>(`/api/lms/requests?${search.toString()}`);
}

export async function createLmsRequest(payload: Record<string, unknown>) {
  return requestData<LmsRequest>("/api/lms/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function upvoteLmsRequest(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/requests/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function fulfillLmsRequest(id: string, resourceId: string) {
  return requestData<LmsRequest>(`/api/lms/requests/${encodeURIComponent(id)}/fulfill`, {
    method: "POST",
    body: JSON.stringify({ resourceId }),
  });
}

export async function closeLmsRequest(id: string) {
  return requestData<LmsRequest>(`/api/lms/requests/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
