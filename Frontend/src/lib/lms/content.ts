// ── contentTypes.ts ──────────────────────────────────────────
export type ResourceCatalogCourse = {
  year: number | null;
  courseCode: string;
  courseName: string;
  subjectCount: number;
  resourceCount: number;
};

export type ResourceCatalogResponse = {
  years: number[];
  selectedYear: number | null;
  courses: ResourceCatalogCourse[];
};

export type ResourceSubjectResponse = {
  year: number;
  courseCode: string;
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
    semester: number | null;
    groups: string[];
    resourceCount: number;
  }>;
};

export type LearningResourceItem = {
  id: string;
  type?: string;
  title: string;
  description: string;
  category?: string;
  lifecycleState?: string;
  version?: number;
  deletedAt?: string | null;
  lastActor?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  resources: Array<{
    id: string;
    contentId: string;
    kind: string;
    title: string;
    urlOrPath: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string;
  }>;
};

export type ResourceLibraryResponse = {
  subject: {
    year: number;
    courseCode: string;
    courseName: string;
    subjectCode: string;
    subjectName: string;
    semester: number | null;
  };
  groups: Array<{
    group: string;
    label: string;
    items: LearningResourceItem[];
  }>;
  totalItems: number;
  totalResources: number;
};

export type ResourceRecommendation = {
  id: string;
  type?: string;
  title: string;
  description: string;
  lifecycleState?: string;
  version?: number;
  metadata?: Record<string, unknown>;
  resources?: Array<{
    id: string;
    kind: string;
    title: string;
    urlOrPath: string;
  }>;
  createdAt?: string;
};

export type ContentWorkflowSpec = {
  states: string[];
  transitions: Array<{
    action: string;
    label: string;
    from: string[];
    to: string;
    requiresReason?: boolean;
  }>;
  permissions: Record<string, string[]>;
  bulkSafety: {
    previewRequired: boolean;
    maxItems: number;
    rollback: string;
  };
};

export type ContentHistoryEntry = {
  id: string;
  contentId: string;
  action: string;
  actorId: string;
  actorRole: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
};

export type ContentBulkPreview = {
  action: string;
  valid: boolean;
  invalidCount: number;
  items: Array<{
    id: string;
    title?: string;
    type?: string;
    currentState?: string;
    nextState?: string;
    valid: boolean;
    reason?: string;
  }>;
};

export type UploadedResource = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

// ── contentFixtures.ts ──────────────────────────────────────────
import type {
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

export const STATIC_ADMIN_LEARNING_ITEM: LearningResourceItem = {
  id: "static-content-os-notes",
  type: "learning_material",
  title: "Operating Systems Revision Notes",
  description: "Scheduler and process lifecycle notes for quick revision.",
  category: "CSE",
  lifecycleState: "published",
  version: 2,
  lastActor: "AP23110010419",
  createdAt: "2026-05-20T09:00:00.000Z",
  updatedAt: "2026-05-26T09:00:00.000Z",
  metadata: {
    year: 2,
    semester: 4,
    courseCode: "CSE",
    courseName: "Computer Science and Engineering",
    subjectCode: "CSE304",
    subjectName: "Operating Systems",
    resourceGroup: "notes",
    visibility: "visible",
    featured: true,
    tags: ["revision", "os"],
  },
  resources: [
    {
      id: "static-content-os-notes-resource",
      contentId: "static-content-os-notes",
      kind: "pdf",
      title: "Operating Systems Revision Notes",
      urlOrPath: "https://example.com/os-notes.pdf",
      createdAt: "2026-05-20T09:00:00.000Z",
    },
  ],
};

export const STATIC_CONTENT_WORKFLOW: ContentWorkflowSpec = {
  states: ["draft", "review", "published", "unpublished", "archived", "deleted"],
  transitions: [
    { action: "submit_review", label: "Submit for review", from: ["draft", "unpublished"], to: "review" },
    { action: "publish", label: "Publish", from: ["draft", "review", "unpublished", "archived"], to: "published" },
    { action: "unpublish", label: "Unpublish", from: ["published", "review"], to: "unpublished", requiresReason: true },
    { action: "archive", label: "Archive", from: ["published", "unpublished", "review", "draft"], to: "archived", requiresReason: true },
    { action: "delete", label: "Delete", from: ["draft", "review", "published", "unpublished", "archived"], to: "deleted", requiresReason: true },
    { action: "restore", label: "Restore", from: ["deleted", "archived"], to: "published", requiresReason: true },
  ],
  permissions: {
    admin: ["create", "edit", "publish", "unpublish", "archive", "delete", "restore", "bulk_preview", "bulk_execute", "history"],
    student: ["recommend_resource"],
  },
  bulkSafety: {
    previewRequired: true,
    maxItems: 200,
    rollback: "Bulk execution runs in one transaction after preview validation.",
  },
};
