/**
 * competitionsApi.ts — Competition platform API with cache integration.
 *
 * All functions use credentials: 'include' via requestData/requestMultipart.
 * 401 → handleSessionAuthFailure()
 * 403 → PermissionError (typed, distinguishable from generic errors)
 * All write functions invalidate relevant cache entries on success.
 */

import { requestData, requestMultipart } from './apiClient';
import { handleSessionAuthFailure } from './session';
import { eventCache } from './eventCache';

// ─── Error Types ─────────────────────────────────────────────────────────────

export class PermissionError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitionRound {
  roundId: string;
  title: string;
  type: string;
  startTime: string | null;
  submissionDeadline: string;
  instructions: string;
  submissionTypes: ('file' | 'link')[];
  maxFileSizeMb: number;
  maxResubmissions: number;
  evaluationCriteria: { label: string; maxScore: number }[];
  shortlistCount: number | null;
  shortlistThreshold: number | null;
  requiresShortlistFromRound: string | null;
  resultsPublished: boolean;
}

export interface CompetitionConfig {
  isCompetition: true;
  submissionScope: 'individual' | 'team';
  rounds: CompetitionRound[];
}

export interface BackendPermissions {
  canEdit: boolean;
  canEvaluate: boolean;
  canShortlist: boolean;
}

export interface Submission {
  id: string;
  eventId: string;
  roundId: string;
  submittedBy: string;
  type: 'file' | 'link';
  filePath?: string;
  linkUrl?: string;
  description?: string;
  submittedAt: string;
  resubmissionCount: number;
  criteriaScores?: Record<string, number>;
  totalScore?: number;
  remarks?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  decision?: 'selected' | 'rejected' | 'pending' | null;
  shortlisted: boolean;
  flagged: boolean;
  flagReason?: string;
}

// ─── Safe fetch wrapper ───────────────────────────────────────────────────────

async function safeFetch<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof Error) {
      const msg = err.message ?? '';
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        handleSessionAuthFailure();
      }
      if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('Permission')) {
        throw new PermissionError(msg);
      }
    }
    throw err;
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getCompetitionConfig(eventId: string): Promise<CompetitionConfig | null> {
  const key = `config:${eventId}`;
  const cached = eventCache.get<CompetitionConfig | null>(key);
  if (cached !== null) return cached;

  try {
    const data = await safeFetch(() =>
      requestData<CompetitionConfig>(`/api/competitions/${encodeURIComponent(eventId)}/config`)
    );
    eventCache.set(key, data, 120_000);
    return data;
  } catch {
    return null;
  }
}

export async function getMySubmission(eventId: string, roundId: string): Promise<Submission | null> {
  const key = `my-submission:${eventId}:${roundId}`;
  const cached = eventCache.get<Submission | null>(key);
  if (cached !== null) return cached;

  try {
    const data = await safeFetch(() =>
      requestData<Submission | null>(
        `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/my-submission`
      )
    );
    eventCache.set(key, data, 30_000);
    return data;
  } catch {
    return null;
  }
}

export async function getMyResult(eventId: string, roundId: string): Promise<Submission | null> {
  return safeFetch(() =>
    requestData<Submission | null>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/my-result`
    )
  );
}

export async function submitWork(eventId: string, roundId: string, formData: FormData): Promise<Submission> {
  const result = await safeFetch(() =>
    requestMultipart<Submission>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submit`,
      formData
    )
  );
  // Invalidate caches on success
  eventCache.invalidate(`my-submission:${eventId}:${roundId}`);
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
  return result;
}

export async function getSubmissionsForRound(eventId: string, roundId: string): Promise<Submission[]> {
  const key = `submissions:${eventId}:${roundId}`;
  const cached = eventCache.get<Submission[]>(key);
  if (cached !== null) return cached;

  const data = await safeFetch(() =>
    requestData<Submission[]>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions`
    )
  );
  eventCache.set(key, data, 20_000);
  return data;
}

export async function evaluateSubmission(
  eventId: string,
  roundId: string,
  submissionId: string,
  payload: {
    criteriaScores: Record<string, number>;
    totalScore: number;
    remarks: string;
    decision: string;
  }
): Promise<Submission> {
  const result = await safeFetch(() =>
    requestData<Submission>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/evaluate`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  );
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
  return result;
}

export async function flagSubmission(
  eventId: string,
  roundId: string,
  submissionId: string,
  payload: { flagged: boolean; flagReason?: string }
): Promise<void> {
  await safeFetch(() =>
    requestData<Submission>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/flag`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  );
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
}

export async function applyShortlist(
  eventId: string,
  roundId: string,
  payload: { mode: 'topN' | 'threshold'; value: number }
): Promise<{ shortlistedCount: number; evaluatedCount: number }> {
  const result = await safeFetch(() =>
    requestData<{ shortlistedCount: number; evaluatedCount: number }>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/shortlist`,
      { method: 'POST', body: JSON.stringify(payload) }
    )
  );
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
  eventCache.invalidate(`event:${eventId}`);
  return result;
}

export async function publishResults(eventId: string, roundId: string): Promise<void> {
  await safeFetch(() =>
    requestData<{ published: boolean }>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/publish`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  );
  eventCache.invalidate(`event:${eventId}`);
  eventCache.invalidate(`config:${eventId}`);
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
}

export async function getLeaderboard(eventId: string, roundId: string): Promise<Submission[]> {
  return safeFetch(() =>
    requestData<Submission[]>(
      `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/leaderboard`
    )
  );
}

export async function getCompetitionAnalytics(eventId: string) {
  return safeFetch(() =>
    requestData<{
      registrations: number;
      rounds: Array<{
        roundId: string;
        title: string;
        submissions: number;
        submissionRate: number;
        evaluationCompletion: number;
        averageTimeToEvaluateMs: number | null;
      }>;
    }>(`/api/competitions/${encodeURIComponent(eventId)}/analytics`)
  );
}
