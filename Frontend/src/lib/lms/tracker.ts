// ── trackerTypes.ts ──────────────────────────────────────────
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

// ── trackerFixtures.ts ──────────────────────────────────────────
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

export const STATIC_CAREER_READINESS: CareerReadiness = {
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

export const STATIC_TRACKER_SNAPSHOT: LmsTrackerSnapshotSummary = {
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

export const STATIC_RECOMMENDATION_EVENTS: LmsTrackerRecommendationEvent[] = [
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

export const STATIC_UNIFIED_INSIGHTS: UnifiedInsights = {
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
