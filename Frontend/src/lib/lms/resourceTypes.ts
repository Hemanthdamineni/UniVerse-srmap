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
