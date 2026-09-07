/**
 * studentGraph.ts — client contract for `GET /api/student-graph`.
 *
 * Mirrors `Backend/src/services/core/studentGraphService.js`. One typed,
 * cached, queryable profile per student: identity + academic + skills +
 * activity + derived signals (at-risk subjects, skill gaps, readiness score).
 *
 * Backlog Story 3.1 / Batch B4. This is the data layer Epics 4–7 build on;
 * surfaces should read from here rather than re-deriving from raw ERP pages.
 */

import { requestData } from "./apiClient";

export const STUDENT_GRAPH_CONTRACT = "student-graph-v1";

export type GraphSourceState =
  | "session"
  | "store"
  | "snapshot"
  | "cache"
  | "stale"
  | "unavailable";

export interface StudentGraphIdentity {
  name: string;
  registerNo: string;
  program: string;
  branch: string;
  semester: number | null;
  section: string;
  email: string;
}

export interface AttendanceSubject {
  code: string;
  name: string;
  conducted: number | null;
  present: number | null;
  pct: number | null;
  status: "safe" | "borderline" | "breach" | "unknown";
}

export interface CurriculumSubject {
  code: string;
  name: string;
  credit: number | null;
  semester: number | null;
}

export interface StudentGraphAcademic {
  curriculum: {
    totalCredits: number;
    completedCredits: number | null;
    subjects: CurriculumSubject[];
  } | null;
  attendance: {
    asOf: string;
    overallPct: number | null;
    subjects: AttendanceSubject[];
  } | null;
  results: {
    cgpa: number | null;
    sgpaBySemester: Array<{ semester: number | null; sgpa: number | null }>;
    currentSubjects: Array<{ code: string; grade: string; result: string }>;
  } | null;
}

export interface StudentGraphSkill {
  skill: string;
  source: string;
  confidence: number | null;
}

export interface StudentGraphActivity {
  events: { registered: number; organized: number };
  lms: { resourcesCompleted: number; masteryTopics: number; contributions: number };
  achievements: number;
}

export interface StudentGraphDerived {
  atRiskSubjects: Array<{
    code: string;
    name: string;
    pct: number | null;
    classesToRecover: number | null;
  }>;
  borderlineSubjects: Array<{ code: string; name: string; pct: number | null }>;
  skillGaps: Array<{ skill: string; demand: number | null }>;
  readinessScore: number;
  readinessBreakdown: {
    academic: number;
    skills: number;
    activity: number;
    profile: number;
  };
}

export type PlacementIntent =
  | "placement"
  | "higher-studies"
  | "entrepreneurship"
  | "undecided"
  | "";

export interface StudentConsent {
  derivedSignals: boolean;
  leaderboards: boolean;
  publicProfile: boolean;
}

export interface StudentIntent {
  status: "none" | "skipped" | "complete";
  targetRoles: string[];
  interestAreas: string[];
  skills: string[];
  graduationYear: number | null;
  placementIntent: PlacementIntent;
  onboardedAt?: string | null;
  updatedAt?: string | null;
}

export interface StudentGraph {
  contractVersion: typeof STUDENT_GRAPH_CONTRACT;
  generatedAt: string;
  userId: string;
  warm: boolean;
  identity: StudentGraphIdentity;
  intent: StudentIntent;
  consent: StudentConsent;
  academic: StudentGraphAcademic;
  skills: StudentGraphSkill[];
  activity: StudentGraphActivity;
  derived: StudentGraphDerived;
  sources: Record<
    "identity" | "curriculum" | "attendance" | "results" | "skills" | "activity",
    GraphSourceState
  >;
}

/** Fetch the current student's graph. `recompute` bypasses the server cache. */
export async function getStudentGraph(opts: { recompute?: boolean } = {}): Promise<StudentGraph> {
  const qs = opts.recompute ? "?recompute=1" : "";
  return requestData<StudentGraph>(`/api/student-graph${qs}`);
}

/** Force a rebuild (e.g. right after an ERP refresh completes). */
export async function recomputeStudentGraph(): Promise<StudentGraph> {
  return requestData<StudentGraph>("/api/student-graph/recompute", { method: "POST" });
}

