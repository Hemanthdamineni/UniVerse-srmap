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
