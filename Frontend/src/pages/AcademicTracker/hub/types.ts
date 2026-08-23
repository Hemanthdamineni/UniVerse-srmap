export type Tab = "overview" | "history" | "planner" | "risks" | "action";

export const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Where am I?" },
  { key: "history", label: "What did I do?" },
  { key: "planner", label: "What if..." },
  { key: "risks", label: "Where am I vulnerable?" },
  { key: "action", label: "What now?" },
];

export interface OverviewData {
  completedCredits: number;
  requiredCredits: number;
  currentCgpa: string;
  progressPercent: number;
  semesters: Array<{ semester: number; label: string; credits: number; sgpa: string; status: string }>;
  attendancePct: string;
  subjectsAtRisk: number;
  careerReadiness?: unknown;
  snapshot?: unknown;
  history?: unknown[];
}

export interface InsightsData {
  gpaTrend: Array<{ semester: string; sgpa: number }>;
  categoryPerformance: Array<{ category: string; subjects: number; avgGrade: string; avgGpa: number }>;
  highlights: Array<{ label: string; value: string }>;
  recommendations: Array<{ title: string; description: string; type: string }>;
  overview: { progressPercent: number; attendancePct: string };
  careerReadiness?: unknown;
  snapshot?: unknown;
  history?: unknown[];
  recommendationEvents?: unknown[];
}

export interface UnifiedData {
  actionPlan: Array<{ id: string; title: string; description: string; domain: string; priority: string; confidence: number; reasons: string[]; inputsUsed: string[] }>;
  academicSignals: {
    currentCgpa: string;
    progressPercent: number;
    attendancePct: string;
    subjectsAtRisk: number;
    recommendations: Array<{ title: string; description: string; type: string }>;
  };
  opportunityRecommendations: Array<{
    id: string; title: string; type: string; organization: string; deadline: string;
    matchedSkills: string[]; missingSkills: string[]; confidence: number;
    eligibility: { eligible: boolean; branch: string; year: string };
    reasons: string[];
  }>;
  nextSkills: Array<{ id: string; skill: string; title: string; opportunityDemand: number; gapLevel: string; confidence: number; reasons: string[] }>;
  atsScore?: { score: number; hasResume: boolean; suggestions: string[] };
  profileGraph?: { nodes: Array<{ id: string; type: string; label: string; status: string; value: string; confidence: number }> };
}

export interface HistoryData {
  semesters: Array<{
    semesterNo: string;
    subjects: Array<{
      semesterNo: string; monthYear: string; subjectCode: string;
      subjectName: string; credit: string; grade: string; gradePoints: string;
      result: string; attempt: string;
    }>;
  }>;
}

export function computeSgpa(history: HistoryData["semesters"]): Record<string, { sgpa: number; credits: number }> {
  const result: Record<string, { sgpa: number; credits: number }> = {};
  for (const sem of history) {
    const semesterNo = sem.semesterNo;
    if (!semesterNo) continue;
    let points = 0;
    let credits = 0;
    for (const subject of sem.subjects) {
      const credit = parseFloat(subject.credit) || 0;
      const gp = parseFloat(subject.gradePoints) || 0;
      points += gp * credit;
      credits += credit;
    }
    result[semesterNo] = {
      sgpa: credits > 0 ? Math.round((points / credits) * 100) / 100 : 0,
      credits,
    };
  }
  return result;
}

export type KpiItem = { label: string; value: string; trend?: number; trendLabel?: string; subtitle?: string };

export type QuickAction = (route: string) => void;
