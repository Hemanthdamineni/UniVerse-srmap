/**
 * studentIntent.ts — client for the onboarding intent + consent endpoints.
 *
 * Backlog Stories 3.2 / 3.3 (Batch B5). Intent sharpens recommendations;
 * consent gates whether the platform exposes derived signals about the
 * student and whether they appear on leaderboards / a public profile.
 */

import { requestData } from "./apiClient";
import type { StudentConsent, StudentIntent, PlacementIntent } from "./studentGraph";

export type { StudentConsent, StudentIntent, PlacementIntent };

/** The `/intent` endpoint returns intent and consent together in one row. */
export type IntentRecord = StudentIntent & { userId: string; consent: StudentConsent };

export type IntentPatch = Partial<{
  targetRoles: string[];
  interestAreas: string[];
  skills: string[];
  graduationYear: number | null;
  placementIntent: PlacementIntent;
  consent: Partial<StudentConsent>;
  /** Marks onboarding dismissed without answers — still leaves a usable row. */
  skipped: boolean;
  status: "complete";
}>;

export interface ProvenanceRow {
  category: string;
  label: string;
  value: string | number;
  source: string;
}

export interface Provenance {
  generatedAt: string;
  consent: StudentConsent;
  rows: ProvenanceRow[];
}

export const PLACEMENT_INTENT_OPTIONS: Array<{ value: PlacementIntent; label: string }> = [
  { value: "placement", label: "Campus placement" },
  { value: "higher-studies", label: "Higher studies (MS / MTech / MBA)" },
  { value: "entrepreneurship", label: "Start something of my own" },
  { value: "undecided", label: "Still figuring it out" },
];

export function getIntent(): Promise<IntentRecord> {
  return requestData<IntentRecord>("/api/student-graph/intent");
}

export function putIntent(patch: IntentPatch): Promise<IntentRecord> {
  return requestData<IntentRecord>("/api/student-graph/intent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function getProvenance(): Promise<Provenance> {
  return requestData<Provenance>("/api/student-graph/provenance");
}

/** Forget declared intent; derived signals recompute empty. */
export function deleteDerivedData(): Promise<{ cleared: boolean; intent: IntentRecord }> {
  return requestData("/api/student-graph/derived", { method: "DELETE" });
}

