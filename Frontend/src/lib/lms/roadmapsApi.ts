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

export async function listRoadmaps(params: Record<string, unknown> = {}) {
  if (isStaticPrototype()) {
    return [
      {
        id: "roadmap-static-career",
        title: "Frontend Internship Readiness",
        description: "A focused path from React fundamentals to portfolio-ready project work.",
        skill: "React",
        authorId: "static",
        difficulty: "intermediate",
        estimatedHours: 12,
        viewCount: 0,
        upvotes: 0,
        qualityScore: 8,
        published: 1,
        nodes: [
          { id: "rn-1", roadmapId: "roadmap-static-career", title: "Start here", description: "Introduction", nodeType: "concept", position: 1 },
          { id: "rn-2", roadmapId: "roadmap-static-career", title: "Components & props", description: "Build composable UI.", nodeType: "concept", position: 2 },
        ],
        edges: [{ id: "re-1", roadmapId: "roadmap-static-career", fromNodeId: "rn-1", toNodeId: "rn-2" }],
        userProgress: null,
      },
    ] as unknown as LmsRoadmap[];
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsRoadmap[]>(`/api/lms/roadmaps?${search.toString()}`);
}

export async function getRoadmapRecommendations(params: Record<string, unknown> = {}) {
  const limit = Number(params.limit || 6);
  if (isStaticPrototype()) {
    return [
      {
        id: "roadmap-static-career",
        title: "Frontend Internship Readiness",
        description: "A focused path from React fundamentals to portfolio-ready project work.",
        skill: "React",
        authorId: "static",
        difficulty: "intermediate",
        estimatedHours: 12,
        viewCount: 0,
        upvotes: 0,
        qualityScore: 8,
        published: 1,
        nodes: [],
        edges: [],
        userProgress: null,
        recommendationScore: 0.82,
        confidence: 0.9,
        reasons: [
          { code: "skillGapMatch", label: "Targets a career skill gap", weight: 1 },
          { code: "nodeCoverage", label: "Has structured milestones", weight: 0.8 },
        ],
        inputsUsed: { algorithmKey: "roadmap-ranking-v1-cross-domain" },
        rankingPolicy: { algorithmKey: "roadmap-ranking-v1-cross-domain" },
      },
    ].slice(0, limit) as LmsRoadmap[];
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsRoadmap[]>(`/api/lms/recommendations/roadmaps?${search.toString()}`);
}

export async function createRoadmap(payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>("/api/lms/roadmaps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRoadmap(id: string) {
  if (isStaticPrototype()) {
    const roadmaps = await listRoadmaps();
    return roadmaps.find((roadmap) => roadmap.id === id) || roadmaps[0];
  }
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
