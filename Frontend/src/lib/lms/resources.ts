// ── resourceTypes.ts ──────────────────────────────────────────
export type LmsPagination = {
  page: number;
  limit: number;
  total?: number;
};

export type LmsTopic = {
  id: string;
  label: string;
  subjectCode?: string | null;
  description?: string | null;
  crossSubjectLinks?: Array<{
    topicId: string;
    subjectCode: string;
    relation: string;
  }>;
};

export type LmsComment = {
  id: string;
  resourceId: string;
  userId: string;
  content: string;
  helpful: number;
  createdAt: string;
  updatedAt?: string | null;
  userHelpful?: boolean;
};

export type LmsAnnotation = {
  id: string;
  userId: string;
  resourceId: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type LmsPublisherSummary = {
  userId: string;
  displayName: string;
  contributionCount: number;
  approvedCount: number;
  flaggedCount: number;
  hiddenCount: number;
  qualityAverage: number;
  upvoteTotal: number;
  trustScore: number;
  lastPublishedAt?: string | null;
};

export type LmsModerationSummary = {
  state: number;
  label: string;
  flagCount: number;
  flagReason?: string | null;
  publicEligible: boolean;
  searchEligible: boolean;
  recommendationEligible: boolean;
  needsReview: boolean;
};

export type LmsRecommendationReason = {
  code: string;
  label: string;
  weight: number;
};

export type LmsResourceFlag = {
  id: string;
  resourceId: string;
  userId: string;
  reason?: string | null;
  createdAt: string;
  status: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
};

export type LmsModerationAuditEntry = {
  id: string;
  resourceId: string;
  action: string;
  actorId: string;
  fromState?: number | null;
  toState?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type QuestionBankItem = {
  id: string;
  subjectCode: string;
  unit?: string | null;
  unitNormalized?: string | null;
  topicId?: string | null;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
  difficulty?: string | null;
  contributedBy: string;
  createdAt: string;
  upvotes?: number;
};

export type LmsResource = {
  id: string;
  type: "link" | "file" | "note" | "quiz" | "flashcard" | "pyq";
  title: string;
  description?: string | null;
  difficulty?: string | null;
  semester: string;
  subjectCode: string;
  subjectName: string;
  unit: string;
  unitNormalized: string;
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string | null;
  url?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  mimeType?: string | null;
  noteContent?: string | null;
  structuredContent?: Record<string, unknown> | null;
  examYear?: string | null;
  examType?: string | null;
  examMonth?: string | null;
  exportable?: number;
  validForSemester?: string | null;
  estimatedMinutes?: number | null;
  viewCount: number;
  upvotes: number;
  bookmarkCount: number;
  commentCount: number;
  qualityScore: number;
  effectivenessScore: number;
  examProvenScore: number;
  renderType?: string | null;
  outdatedCount?: number;
  isOutdated?: number;
  flagCount?: number;
  moderationState?: number;
  flagReason?: string | null;
  verified?: number;
  publisher?: LmsPublisherSummary;
  moderation?: LmsModerationSummary;
  recommendationScore?: number;
  confidence?: number;
  reasons?: LmsRecommendationReason[];
  inputsUsed?: Record<string, unknown>;
  rankingPolicy?: {
    algorithmKey: string;
    eligible: boolean;
    filters: string[];
  };
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
  userUpvoted?: boolean;
  userBookmarked?: boolean;
  userMarkedOutdated?: boolean;
  userRating?: {
    rating: number;
    review?: string | null;
    dimensionTags?: string[];
  } | null;
  comments?: LmsComment[];
  annotations?: LmsAnnotation[];
  related?: LmsResource[];
  topics?: LmsTopic[];
  flags?: LmsResourceFlag[];
  audit?: LmsModerationAuditEntry[];
};

export type LmsGuideSection = {
  id: string;
  guideId: string;
  title: string;
  content: string;
  position: number;
};

export type LmsGuide = {
  id: string;
  title: string;
  description?: string | null;
  authorId: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  unit: string;
  unitNormalized: string;
  tags: string[];
  difficulty?: string | null;
  viewCount: number;
  upvotes: number;
  qualityScore: number;
  exportable: number;
  published: number;
  sections: LmsGuideSection[];
  userProgress?: {
    readSections: string[];
    startedAt: string;
    updatedAt: string;
  } | null;
  userUpvoted?: boolean;
};

export type LmsRoadmapNode = {
  id: string;
  roadmapId: string;
  title: string;
  description?: string | null;
  nodeType: "concept" | "resource" | "quiz" | "milestone";
  resourceId?: string | null;
  position: number;
  isOptional: number;
};

export type LmsRoadmap = {
  id: string;
  title: string;
  description?: string | null;
  skill: string;
  authorId: string;
  difficulty?: string | null;
  estimatedHours?: number | null;
  viewCount: number;
  upvotes: number;
  qualityScore: number;
  published: number;
  nodes: LmsRoadmapNode[];
  edges: Array<{ roadmapId: string; fromNodeId: string; toNodeId: string }>;
  userProgress?: {
    completedNodes: string[];
    startedAt: string;
    updatedAt: string;
  } | null;
  recommendationScore?: number;
  confidence?: number;
  reasons?: LmsRecommendationReason[];
  inputsUsed?: Record<string, unknown>;
  rankingPolicy?: Record<string, unknown>;
};

export type LmsRequest = {
  id: string;
  userId: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  unit?: string | null;
  title: string;
  description?: string | null;
  resourceType?: string | null;
  status: string;
  fulfilledBy?: string | null;
  fulfilledResourceId?: string | null;
  upvotes: number;
  createdAt: string;
  updatedAt?: string | null;
};

export type LmsCollection = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isPublic: number;
  createdAt: string;
  itemCount?: number;
  items?: LmsResource[];
};

export type LmsModerationQueueResponse = {
  items: LmsResource[];
  counts: {
    total: number;
    flagged: number;
    hidden: number;
    removed: number;
    visible: number;
  };
  pagination: LmsPagination;
};

// ── resourceFixtures.ts ──────────────────────────────────────────
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
  UnifiedInsights
} from "./types";

export const STATIC_LMS_PUBLISHER: LmsPublisherSummary = {
  userId: "AP23110010234",
  displayName: "AP23110010234",
  contributionCount: 12,
  approvedCount: 11,
  flaggedCount: 1,
  hiddenCount: 0,
  qualityAverage: 8.4,
  upvoteTotal: 86,
  trustScore: 91,
  lastPublishedAt: "2026-05-23T08:10:00.000Z",
};

export const STATIC_LMS_RESOURCES: LmsResource[] = [
  {
    id: "lms-res-indexing",
    type: "note",
    title: "Database indexing guide",
    description: "A compact guide to index selection, query plans, and common exam patterns.",
    difficulty: "intermediate",
    semester: "6",
    subjectCode: "CSE301",
    subjectName: "Database Systems",
    unit: "Query Optimization",
    unitNormalized: "query-optimization",
    tags: ["indexes", "sql", "query-plans"],
    uploadedBy: STATIC_LMS_PUBLISHER.userId,
    uploadedAt: "2026-05-23T08:10:00.000Z",
    viewCount: 420,
    upvotes: 48,
    bookmarkCount: 31,
    commentCount: 6,
    qualityScore: 8.8,
    effectivenessScore: 3.7,
    examProvenScore: 2.9,
    estimatedMinutes: 12,
    renderType: "note",
    noteContent: "Use selective indexes and verify plans before optimizing.",
    moderationState: 0,
    flagCount: 0,
    publisher: STATIC_LMS_PUBLISHER,
    moderation: {
      state: 0,
      label: "Clear",
      flagCount: 0,
      publicEligible: true,
      searchEligible: true,
      recommendationEligible: true,
      needsReview: false,
    },
    confidence: 0.86,
    recommendationScore: 0.74,
    reasons: [
      { code: "subjectMatch", label: "Matches your subject focus", weight: 1 },
      { code: "engagementScore", label: "High community engagement", weight: 0.82 },
      { code: "qualityScore", label: "Strong learner quality signals", weight: 0.88 },
    ],
    inputsUsed: {
      algorithmKey: "ranking-v2",
      factors: { subjectMatch: 1, engagementScore: 0.82, qualityScore: 0.88 },
      moderationState: 0,
      flagCount: 0,
      publisherTrustScore: STATIC_LMS_PUBLISHER.trustScore,
    },
    rankingPolicy: {
      algorithmKey: "ranking-v2",
      eligible: true,
      filters: ["not_deleted", "moderation_clear", "no_open_flags"],
    },
    topics: [{ id: "topic-indexes", label: "Indexes", subjectCode: "CSE301" }],
  },
  {
    id: "lms-res-normalization",
    type: "note",
    title: "Normalization checklist",
    description: "A student-contributed checklist for decompositions and normal forms.",
    difficulty: "beginner",
    semester: "6",
    subjectCode: "CSE301",
    subjectName: "Database Systems",
    unit: "Normalization",
    unitNormalized: "normalization",
    tags: ["normalization", "dbms"],
    uploadedBy: "AP23110010555",
    uploadedAt: "2026-05-20T09:30:00.000Z",
    viewCount: 128,
    upvotes: 11,
    bookmarkCount: 8,
    commentCount: 2,
    qualityScore: 5.9,
    effectivenessScore: 1.6,
    examProvenScore: 1.2,
    estimatedMinutes: 8,
    moderationState: 1,
    flagCount: 1,
    flagReason: "Needs citation review",
    publisher: {
      userId: "AP23110010555",
      displayName: "AP23110010555",
      contributionCount: 3,
      approvedCount: 2,
      flaggedCount: 1,
      hiddenCount: 0,
      qualityAverage: 5.6,
      upvoteTotal: 19,
      trustScore: 64,
      lastPublishedAt: "2026-05-20T09:30:00.000Z",
    },
    moderation: {
      state: 1,
      label: "Flagged for review",
      flagCount: 1,
      flagReason: "Needs citation review",
      publicEligible: true,
      searchEligible: true,
      recommendationEligible: false,
      needsReview: true,
    },
    flags: [
      {
        id: "flag-normalization-1",
        resourceId: "lms-res-normalization",
        userId: "AP23110010001",
        reason: "Needs citation review",
        status: "open",
        createdAt: "2026-05-25T08:00:00.000Z",
      },
    ],
    audit: [
      {
        id: "audit-normalization-1",
        resourceId: "lms-res-normalization",
        action: "reported",
        actorId: "AP23110010001",
        fromState: 0,
        toState: 1,
        reason: "Needs citation review",
        createdAt: "2026-05-25T08:00:00.000Z",
      },
    ],
    topics: [{ id: "topic-normalization", label: "Normalization", subjectCode: "CSE301" }],
  },
];
