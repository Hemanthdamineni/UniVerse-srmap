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

export async function getPendingExamFeedback() {
  if (isStaticPrototype()) return [];
  return requestData<LmsResource[]>("/api/lms/exam-feedback/pending");
}

export async function submitExamFeedback(feedbackItems: Array<{ resourceId: string; helpful: boolean }>) {
  return requestData<{ submitted: number }>("/api/lms/exam-feedback", {
    method: "POST",
    body: JSON.stringify({ feedbackItems }),
  });
}

export async function submitQuizAttempt(resourceId: string, payload: Record<string, unknown>) {
  return requestData(`/api/lms/resources/${encodeURIComponent(resourceId)}/quiz-attempt`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQuizAttempts(resourceId: string) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/resources/${encodeURIComponent(resourceId)}/quiz-attempts`);
}

export async function listQuestionBank(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: Array<Record<string, unknown>>; pagination: LmsPagination }>(
    `/api/lms/question-bank?${search.toString()}`
  );
}

export async function createQuestionBankItem(payload: Record<string, unknown>) {
  return requestData<Record<string, unknown>>("/api/lms/question-bank", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function upvoteQuestionBankItem(id: string) {
  return requestData<Record<string, unknown>>(`/api/lms/question-bank/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function buildQuizFromQuestionBank(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ questions: Array<Record<string, unknown>>; count: number }>(
    `/api/lms/question-bank/build-quiz?${search.toString()}`
  );
}
