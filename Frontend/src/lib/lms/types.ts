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

const STATIC_ADMIN_LEARNING_ITEM: LearningResourceItem = {
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

const STATIC_CONTENT_WORKFLOW: ContentWorkflowSpec = {
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

export type LmsTrackerSnapshotSummary = {
  id: string;
  snapshotType: string;
  createdAt: string;
  inputsHash: string;
  sourceStatus: Record<string, boolean>;
  summary: {
    currentCgpa?: string;
    progressPercent?: number | null;
    subjectsAtRisk?: number | null;
    careerAvailable?: boolean;
  };
};

export type LmsTrackerRecommendationEvent = {
  id: string;
  userId?: string;
  eventType: string;
  recommendationId: string;
  recommendationTitle: string;
  sourceDomain: string;
  confidence: number;
  payload?: Record<string, unknown>;
  createdAt: string;
};

const STATIC_CAREER_READINESS: CareerReadiness = {
  available: true,
  profileCompleteness: {
    score: 72,
    completed: ["Skills listed", "Opportunity preferences"],
    missing: ["Upload a current resume.", "Add a focused career summary."],
    breakdown: [
      { key: "skills", label: "Skills listed", score: 25, max: 25 },
      { key: "resume", label: "Resume uploaded", score: 0, max: 20 },
      { key: "preferences", label: "Opportunity preferences", score: 25, max: 25 },
    ],
  },
  resumeScore: {
    score: 58,
    hasResume: false,
    breakdown: [
      { label: "Resume file", score: 0, max: 25 },
      { label: "Skills evidence", score: 20, max: 25 },
      { label: "Profile completeness", score: 18, max: 25 },
      { label: "Academic signal", score: 20, max: 25 },
    ],
    suggestions: ["Upload a current resume before applying.", "Add more role-specific skills to improve matching."],
  },
  skillGaps: [
    {
      skill: "Node.js",
      opportunityCount: 4,
      gapLevel: "missing",
      reason: "Node.js appears in 4 active opportunity matches but is not in the profile.",
    },
    {
      skill: "Docker",
      opportunityCount: 2,
      gapLevel: "missing",
      reason: "Docker appears in 2 active opportunity matches but is not in the profile.",
    },
  ],
  recommendedOpportunities: [
    {
      id: "opp-frontend-intern",
      title: "Frontend Engineering Intern",
      type: "internship",
      organization: "Acme Labs",
      deadline: "2026-06-30",
      matchedSkills: ["React", "SQL"],
      missingSkills: ["Node.js"],
      confidence: 0.72,
      reasons: ["Matches 2 profile skills.", "Missing skills to close: Node.js."],
      inputsUsed: ["careerProfile.skills", "careerOpportunities.skills", "careerEligibility"],
    },
  ],
  nextActions: [
    "Upload a resume before applying to recommended roles.",
    "Start with Node.js; it maps to 4 active opportunity matches.",
    "Review Frontend Engineering Intern and decide whether to save or apply.",
  ],
  inputsUsed: {
    careerProfile: true,
    skillGaps: 2,
    opportunities: 1,
    applications: 0,
    academicSignals: ["currentCgpa", "progressPercent", "attendancePct", "subjectsAtRisk"],
  },
};

const STATIC_TRACKER_SNAPSHOT: LmsTrackerSnapshotSummary = {
  id: "static-tracker-snapshot",
  snapshotType: "overview",
  createdAt: new Date("2026-05-26T03:30:00.000Z").toISOString(),
  inputsHash: "static-fixture",
  sourceStatus: {
    examMarks: true,
    currentResults: true,
    attendance: true,
    cgpa: true,
    careerStore: true,
  },
  summary: {
    currentCgpa: "8.20",
    progressPercent: 60,
    subjectsAtRisk: 1,
    careerAvailable: true,
  },
};

const STATIC_RECOMMENDATION_EVENTS: LmsTrackerRecommendationEvent[] = [
  {
    id: "static-rec-event-1",
    eventType: "generated",
    recommendationId: "opp-frontend-intern",
    recommendationTitle: "Frontend Engineering Intern",
    sourceDomain: "career_readiness",
    confidence: 0.72,
    createdAt: new Date("2026-05-26T03:31:00.000Z").toISOString(),
  },
];

const STATIC_UNIFIED_INSIGHTS: UnifiedInsights = {
  contractVersion: "unified-insights-v1",
  generatedAt: new Date("2026-05-26T03:35:00.000Z").toISOString(),
  scoringSchema: {
    contractVersion: "unified-insights-v1",
    dimensions: ["academicRisk", "resumeQuality", "opportunityFit", "skillDemand", "feedbackAdaptation"],
    eligibilityFilters: ["activeOpportunity", "moderationClear", "branchEligible", "yearEligible", "notDismissed"],
  },
  profileGraph: {
    nodes: [
      {
        id: "academic",
        type: "source",
        label: "Academic Record",
        status: "ready",
        value: "8.20 CGPA",
        confidence: 0.86,
        inputsUsed: ["cgpa", "semesterResults", "attendance"],
      },
      {
        id: "lms",
        type: "source",
        label: "LMS Engagement",
        status: "ready",
        value: "1 ranked resource",
        confidence: 0.78,
        inputsUsed: ["lmsRecommendations", "topicMastery", "resourceEngagement"],
      },
      {
        id: "resume",
        type: "source",
        label: "Resume",
        status: "missing",
        value: "58% ATS score",
        confidence: 0.56,
        inputsUsed: ["resumeFile", "careerProfile", "academicSignals"],
      },
      {
        id: "skills",
        type: "profile",
        label: "Skill Profile",
        status: "sparse",
        value: "2 skills",
        confidence: 0.42,
        inputsUsed: ["careerProfile.skills", "careerSkillGaps"],
      },
      {
        id: "feedback",
        type: "behavior",
        label: "Recommendation Feedback",
        status: "ready",
        value: "1 event",
        confidence: 0.72,
        inputsUsed: ["recommendationEvents"],
      },
    ],
    edges: [
      { from: "academic", to: "resume", signal: "CGPA and progress influence ATS rubric." },
      { from: "lms", to: "skills", signal: "LMS ranking informs the next learning action." },
    ],
    coverage: {
      readySignals: 3,
      totalSignals: 5,
      missingSignals: ["Resume"],
    },
  },
  atsScore: {
    score: 58,
    hasResume: false,
    confidence: 0.56,
    rubric: [
      { label: "Resume file", score: 0, max: 25, reason: "Resume file needs improvement before high-fit applications." },
      { label: "Skills evidence", score: 20, max: 25, reason: "Skills evidence needs improvement before high-fit applications." },
      { label: "Profile completeness", score: 18, max: 25, reason: "Profile completeness needs improvement before high-fit applications." },
      { label: "Academic signal", score: 20, max: 25, reason: "Academic signal needs improvement before high-fit applications." },
    ],
    suggestions: ["Upload a current resume before applying.", "Add more role-specific skills to improve matching."],
    inputsUsed: ["careerProfile", "resumeMetadata", "academicSignals"],
  },
  academicSignals: {
    currentCgpa: "8.20",
    progressPercent: 60,
    attendancePct: "80.0",
    subjectsAtRisk: 1,
    recommendations: [
      {
        title: "Attendance Warning",
        description: "1 subject is below the 75% attendance line. Prioritize those classes first.",
        type: "warning",
      },
    ],
  },
  nextSkills: [
    {
      id: "skill-node-js",
      skill: "Node.js",
      title: "Build Node.js",
      opportunityDemand: 4,
      gapLevel: "missing",
      confidence: 0.68,
      feedbackBoost: 0,
      reasons: [
        "Node.js appears in 4 active opportunity match(es).",
        "Node.js appears in 4 active opportunity matches but is not in the profile.",
        "Use LMS resource: Node.js Service Patterns.",
      ],
      inputsUsed: ["careerSkillGaps", "activeOpportunityDemand", "lmsRecommendations", "recommendationEvents"],
    },
    {
      id: "skill-docker",
      skill: "Docker",
      title: "Build Docker",
      opportunityDemand: 2,
      gapLevel: "missing",
      confidence: 0.57,
      feedbackBoost: 0,
      reasons: [
        "Docker appears in 2 active opportunity match(es).",
        "Docker appears in 2 active opportunity matches but is not in the profile.",
      ],
      inputsUsed: ["careerSkillGaps", "activeOpportunityDemand", "lmsRecommendations", "recommendationEvents"],
    },
  ],
  opportunityRecommendations: [
    {
      id: "opp-frontend-intern",
      title: "Frontend Engineering Intern",
      type: "internship",
      organization: "Acme Labs",
      deadline: "2026-06-30",
      matchedSkills: ["React", "SQL"],
      missingSkills: ["Node.js"],
      confidence: 0.72,
      feedbackBoost: 0,
      eligibility: {
        eligible: true,
        branch: "computer science",
        year: "3",
        filtersApplied: ["activeOpportunity", "branchEligible", "yearEligible", "moderationClear"],
      },
      reasons: ["Matches 2 profile skills.", "Missing skills to close: Node.js."],
      inputsUsed: ["careerProfile.skills", "careerOpportunities.skills", "careerEligibility", "recommendationEvents"],
    },
  ],
  actionPlan: [
    {
      id: "action-attendance-risk",
      domain: "academic",
      priority: "high",
      title: "Recover attendance risk",
      description: "1 subject is below the attendance safety line.",
      confidence: 0.9,
      reasons: ["Attendance below threshold blocks exam eligibility and should be resolved first."],
      inputsUsed: ["attendanceRecords"],
    },
    {
      id: "action-skill-node-js",
      domain: "career",
      priority: "high",
      title: "Build Node.js",
      description: "4 active opportunity match(es) need this skill.",
      confidence: 0.68,
      reasons: ["Node.js appears in 4 active opportunity match(es)."],
      inputsUsed: ["careerSkillGaps", "activeOpportunityDemand"],
    },
  ],
  feedbackLoop: {
    recentEvents: STATIC_RECOMMENDATION_EVENTS,
    generatedEvents: [],
    adaptiveSignals: 1,
    modelInfluence: "Prior clicks, saves, applies, and dismissals adjust confidence in later rankings.",
  },
  lmsSignals: {
    recommendations: [
      {
        id: "res-node",
        title: "Node.js Service Patterns",
        confidence: 0.81,
        recommendationScore: 0.72,
        reasons: [{ label: "Targets topics with room to improve", weight: 0.7 }],
        inputsUsed: { algorithmKey: "ranking-v2" },
      },
    ],
  },
  qualityMonitoring: {
    baseline: "offline-fixture-v1",
    measuredLatencyMs: 28,
    metrics: {
      recommendationCount: 5,
      explainabilityCoverage: 1,
      eligibleOpportunityRate: 1,
      profileSignalCoverage: 0.6,
      feedbackEventCount: 1,
    },
    thresholds: {
      explainabilityCoverage: 1,
      eligibleOpportunityRate: 1,
      profileSignalCoverage: 0.5,
      recommendationApiP95Ms: 400,
    },
    dashboardCards: [
      { label: "Explainability", value: "100%" },
      { label: "Eligible opportunities", value: "100%" },
      { label: "Feedback events", value: "1" },
    ],
  },
  sourceStatus: {
    examMarks: true,
    currentResults: true,
    attendance: true,
    cgpa: true,
    careerStore: true,
  },
  responseTimeMs: 28,
  snapshot: { ...STATIC_TRACKER_SNAPSHOT, snapshotType: "unified-insights" },
  history: [{ ...STATIC_TRACKER_SNAPSHOT, snapshotType: "unified-insights" }],
};

export type CareerReadiness = {
  available: boolean;
  profileCompleteness: {
    score: number;
    completed: string[];
    missing: string[];
    breakdown: Array<{ key: string; label: string; score: number; max: number }>;
  };
  resumeScore: {
    score: number;
    hasResume: boolean;
    breakdown: Array<{ label: string; score: number; max: number }>;
    suggestions: string[];
  };
  skillGaps: Array<{
    skill: string;
    opportunityCount: number;
    gapLevel: string;
    reason: string;
  }>;
  recommendedOpportunities: Array<{
    id: string;
    title: string;
    type: string;
    organization: string;
    deadline: string;
    matchedSkills: string[];
    missingSkills: string[];
    confidence: number;
    reasons: string[];
    inputsUsed: string[];
  }>;
  nextActions: string[];
  inputsUsed: {
    careerProfile: boolean;
    skillGaps: number;
    opportunities: number;
    applications: number;
    academicSignals: string[];
  };
  error?: string;
};

export type UnifiedInsights = {
  contractVersion: string;
  generatedAt: string;
  scoringSchema: Record<string, unknown>;
  profileGraph: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      status: string;
      value: string;
      confidence: number;
      inputsUsed: string[];
    }>;
    edges: Array<{ from: string; to: string; signal: string }>;
    coverage: {
      readySignals: number;
      totalSignals: number;
      missingSignals: string[];
    };
  };
  atsScore: {
    score: number;
    hasResume: boolean;
    confidence: number;
    rubric: Array<{ label: string; score: number; max: number; reason: string }>;
    suggestions: string[];
    inputsUsed: string[];
  };
  academicSignals: {
    currentCgpa: string;
    progressPercent: number;
    attendancePct: string;
    subjectsAtRisk: number;
    recommendations: Array<{ title: string; description: string; type: string }>;
  };
  nextSkills: Array<{
    id: string;
    skill: string;
    title: string;
    opportunityDemand: number;
    gapLevel: string;
    confidence: number;
    feedbackBoost: number;
    reasons: string[];
    inputsUsed: string[];
  }>;
  opportunityRecommendations: Array<{
    id: string;
    title: string;
    type: string;
    organization: string;
    deadline: string;
    matchedSkills: string[];
    missingSkills: string[];
    confidence: number;
    feedbackBoost: number;
    eligibility: {
      eligible: boolean;
      branch: string;
      year: string;
      filtersApplied: string[];
    };
    reasons: string[];
    inputsUsed: string[];
  }>;
  actionPlan: Array<{
    id: string;
    domain: string;
    priority: string;
    title: string;
    description: string;
    confidence: number;
    reasons: string[];
    inputsUsed: string[];
  }>;
  feedbackLoop: {
    recentEvents: LmsTrackerRecommendationEvent[];
    generatedEvents?: LmsTrackerRecommendationEvent[];
    adaptiveSignals: number;
    modelInfluence: string;
  };
  lmsSignals: {
    recommendations: Array<{
      id: string;
      title: string;
      confidence: number;
      recommendationScore: number | null;
      reasons: unknown[];
      inputsUsed: Record<string, unknown>;
    }>;
  };
  qualityMonitoring: {
    baseline: string;
    measuredLatencyMs: number;
    metrics: {
      recommendationCount: number;
      explainabilityCoverage: number;
      eligibleOpportunityRate: number;
      profileSignalCoverage: number;
      feedbackEventCount: number;
    };
    thresholds: Record<string, number>;
    dashboardCards: Array<{ label: string; value: string }>;
  };
  sourceStatus: Record<string, boolean>;
  responseTimeMs: number;
  snapshot?: LmsTrackerSnapshotSummary | null;
  history?: LmsTrackerSnapshotSummary[];
};

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

const STATIC_LMS_PUBLISHER: LmsPublisherSummary = {
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

const STATIC_LMS_RESOURCES: LmsResource[] = [
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

function appendValue(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
}

function buildMultipartForm(values: Record<string, unknown>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    appendValue(formData, key, value);
  }
  return formData;
}
