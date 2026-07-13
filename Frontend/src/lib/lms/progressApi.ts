import { buildMultipartForm, isStaticPrototype, requestData, requestMultipart } from "./http";
import { STATIC_CAREER_READINESS, STATIC_RECOMMENDATION_EVENTS, STATIC_TRACKER_SNAPSHOT, STATIC_UNIFIED_INSIGHTS } from "./tracker";
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

export async function getLmsProgressOverview() {
  if (isStaticPrototype()) {
    return {
      completedCredits: 96,
      requiredCredits: 160,
      currentCgpa: "8.20",
      progressPercent: 60,
      semesters: [
        { semester: 1, label: "Sem 1", credits: 22, sgpa: "8.10", status: "Completed" },
        { semester: 2, label: "Sem 2", credits: 24, sgpa: "7.80", status: "Completed" },
        { semester: 3, label: "Sem 3", credits: 25, sgpa: "8.50", status: "Completed" },
      ],
      attendancePct: "80.0",
      subjectsAtRisk: 1,
      careerReadiness: STATIC_CAREER_READINESS,
      snapshot: { ...STATIC_TRACKER_SNAPSHOT, snapshotType: "overview" },
      history: [{ ...STATIC_TRACKER_SNAPSHOT, snapshotType: "overview" }],
    };
  }
  return requestData<{
    completedCredits: number;
    requiredCredits: number;
    currentCgpa: string;
    progressPercent: number;
    semesters: Array<{
      semester: number;
      label: string;
      credits: number;
      sgpa: string;
      status: string;
    }>;
    attendancePct: string;
    subjectsAtRisk: number;
    careerReadiness?: CareerReadiness;
    snapshot?: LmsTrackerSnapshotSummary | null;
    history?: LmsTrackerSnapshotSummary[];
  }>("/api/lms/tracker/overview");
}

export async function getLmsAcademicInsights() {
  if (isStaticPrototype()) {
    return {
      gpaTrend: [
        { semester: "Sem 1", sgpa: 8.1 },
        { semester: "Sem 2", sgpa: 7.8 },
        { semester: "Sem 3", sgpa: 8.5 },
      ],
      categoryPerformance: [
        { category: "Core Engineering", subjects: 2, avgGrade: "A", avgGpa: 8 },
        { category: "Mathematics", subjects: 1, avgGrade: "B+", avgGpa: 7 },
      ],
      highlights: [
        { label: "Strongest Subject Area", value: "Core Engineering (8.00 GPA)" },
        { label: "Attendance Risk", value: "1 subject(s) below 75%" },
      ],
      recommendations: [
        {
          title: "Attendance Warning",
          description: "1 subject is below the 75% attendance line. Prioritize those classes first.",
          type: "warning",
        },
        {
          title: "Strengthen Mathematics",
          description: "Mathematics is your weakest academic cluster right now.",
          type: "improvement",
        },
      ],
      overview: {
        progressPercent: 60,
        attendancePct: "80.0",
      },
      careerReadiness: STATIC_CAREER_READINESS,
      snapshot: { ...STATIC_TRACKER_SNAPSHOT, snapshotType: "insights" },
      history: [{ ...STATIC_TRACKER_SNAPSHOT, snapshotType: "insights" }],
      recommendationEvents: STATIC_RECOMMENDATION_EVENTS,
    };
  }
  return requestData<{
    gpaTrend: Array<{ semester: string; sgpa: number }>;
    categoryPerformance: Array<{
      category: string;
      subjects: number;
      avgGrade: string;
      avgGpa: number;
    }>;
    highlights: Array<{ label: string; value: string }>;
    recommendations: Array<{ title: string; description: string; type: string }>;
    overview: {
      progressPercent: number;
      attendancePct: string;
    };
    careerReadiness?: CareerReadiness;
    snapshot?: LmsTrackerSnapshotSummary | null;
    history?: LmsTrackerSnapshotSummary[];
    recommendationEvents?: LmsTrackerRecommendationEvent[];
  }>("/api/lms/tracker/insights");
}

export async function getLmsUnifiedInsights() {
  if (isStaticPrototype()) return STATIC_UNIFIED_INSIGHTS;
  return requestData<UnifiedInsights>("/api/lms/tracker/unified-insights");
}

export async function getLmsTrackerHistory(type?: string) {
  if (isStaticPrototype()) {
    return { items: [{ ...STATIC_TRACKER_SNAPSHOT, snapshotType: type || "overview" }] };
  }
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestData<{ items: LmsTrackerSnapshotSummary[] }>(`/api/lms/tracker/history${query}`);
}

export async function getLmsTrackerRecommendationEvents() {
  if (isStaticPrototype()) return { items: STATIC_RECOMMENDATION_EVENTS };
  return requestData<{ items: LmsTrackerRecommendationEvent[] }>("/api/lms/tracker/recommendation-events");
}

export async function recordLmsTrackerRecommendationEvent(payload: {
  eventType: string;
  recommendationId: string;
  recommendationTitle: string;
  sourceDomain: string;
  confidence?: number;
  action?: string;
}) {
  if (isStaticPrototype()) return { items: STATIC_RECOMMENDATION_EVENTS };
  return requestData<{ items: LmsTrackerRecommendationEvent[] }>("/api/lms/tracker/recommendation-events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWeeklyLeaderboard() {
  if (isStaticPrototype()) return [];
  return requestData<Array<Record<string, unknown>>>("/api/lms/leaderboard/weekly");
}

export async function getLmsProgress() {
  return requestData<Record<string, unknown>>("/api/lms/progress");
}

export async function getLmsProgressForSubject(subjectCode: string) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/progress/${encodeURIComponent(subjectCode)}`);
}

export async function getLmsMastery() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/mastery");
}

export async function getContinueLearning() {
  if (isStaticPrototype()) return STATIC_LMS_RESOURCES[0];
  return requestData<LmsResource | null>("/api/lms/continue");
}

export async function getRevisionQueue() {
  if (isStaticPrototype()) return [];
  return requestData<Array<Record<string, unknown>>>("/api/lms/revision");
}

export async function submitRevisionReview(resourceId: string, score: number) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/revision/${encodeURIComponent(resourceId)}/review`, {
    method: "POST",
    body: JSON.stringify({ score }),
  });
}

export async function getLmsStreak() {
  if (isStaticPrototype()) return { currentStreak: 4, longestStreak: 9 };
  return requestData<Record<string, unknown>>("/api/lms/streak");
}

export async function generateLearningSession(durationMinutes: number) {
  return requestData<Record<string, unknown>>("/api/lms/session/generate", {
    method: "POST",
    body: JSON.stringify({ durationMinutes }),
  });
}

export async function getMyContributions() {
  return requestData<Record<string, unknown>>("/api/lms/me/contributions");
}

export async function getMyBookmarks() {
  return requestData<LmsResource[]>("/api/lms/me/bookmarks");
}

export async function getMyActivity() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/me/activity");
}

export async function getMyLmsRequests() {
  return requestData<LmsRequest[]>("/api/lms/me/requests");
}

export async function updateMyLmsPreferences(payload: Record<string, unknown>) {
  return requestData<Record<string, unknown>>("/api/lms/me/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
