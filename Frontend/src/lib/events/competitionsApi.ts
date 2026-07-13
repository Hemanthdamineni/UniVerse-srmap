/**
 * competitionsApi.ts — Competition platform API layer.
 *
 * Single source of truth for all competition platform types and API functions.
 * Uses credentials: 'include' via requestData/requestMultipart.
 * 401 → handleSessionAuthFailure()
 * 403 → PermissionError (typed, distinguishable from generic errors)
 * All write functions invalidate relevant cache entries on success.
 */

import { requestData, requestMultipart } from '../core/apiClient';
import { handleSessionAuthFailure } from '../core/session';
import { eventCache } from './eventCache';

// ─── Error Types ─────────────────────────────────────────────────────────────

class PermissionError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
  }
}

// ─── Identity ─────────────────────────────────────────────────────────────────

export type RegNo = string; // e.g. "AP21110010"

export type EventRole =
  | 'owner'
  | 'co-organizer'
  | 'manager'
  | 'judge'
  | 'participant'
  | 'visitor';

export interface MyRoleResponse {
  regNo: RegNo;
  role: EventRole;
  permissions: {
    canEdit: boolean;
    canEvaluate: boolean;
    canShortlist: boolean;
    canManageRoles: boolean;
    canViewAllSubmissions: boolean;
  };
}

// ─── Competition Config ───────────────────────────────────────────────────────

export interface EvaluationCriterion {
  label: string;
  maxScore: number;
}

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
  evaluationCriteria: EvaluationCriterion[];
  shortlistCount: number | null;
  shortlistThreshold: number | null;
  requiresShortlistFromRound: string | null;
  resultsPublished: boolean;
  shortlistAppliedAt: string | null;
  resultsPublishedAt: string | null;
}

export interface CompetitionConfig {
  isCompetition: true;
  submissionScope: 'individual' | 'team';
  rounds: CompetitionRound[];
  maxTeamSize?: number;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  status: string;
  visibility: string;
  startDate: string;
  endDate: string;
  location: string;
  department: string;
  maxCapacity: number | null;
  registrationCount: number;
  createdBy: RegNo;
  prizes: string | null;
  eligibility: string | null;
  isCompetition: boolean;
  competitionConfig: CompetitionConfig | null;
  posterImagePath: string | null;
}

export interface EventDetail extends EventSummary {
  rules: string | null;
  faq: { question: string; answer: string }[] | null;
  coOrganizers: RegNo[];
  myRegistration: { registeredAt: string; status: string } | null;
  myRole: MyRoleResponse | null;
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  regNo: RegNo;
  name: string;
  joinedAt: string;
  status: 'pending' | 'accepted';
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  leaderId?: RegNo;
  leaderRegNo: RegNo;
  members: TeamMember[];
  memberRegNos?: RegNo[];
  createdAt: string;
}

export interface TeamRecruitmentPost {
  id: string;
  eventId: string;
  teamId: string;
  createdBy: RegNo;
  status: 'open' | 'closed';
  neededSkills: string[];
  description: string;
  openSlots: number;
  createdAt: string;
  updatedAt: string;
  team: Team;
}

export interface TeamMatchCandidate {
  userId: RegNo;
  name: string;
  department: string;
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
  reasons: string[];
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  eventId: string;
  roundId: string;
  submittedBy: RegNo;
  teamId: string | null;
  type: 'file' | 'link';
  filePath: string | null;
  linkUrl: string | null;
  description: string | null;
  submittedAt: string;
  resubmissionCount: number;
  criteriaScores: Record<string, number> | null;
  totalScore: number | null;
  remarks: string | null;
  evaluatedBy: RegNo | null;
  evaluatedAt: string | null;
  decision: 'selected' | 'rejected' | 'pending' | null;
  shortlisted: boolean;
  flagged: boolean;
  flagReason: string | null;
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export interface CertificateField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface CertificateTemplate {
  id: string;
  eventId: string;
  roundId: string | null;
  templateImagePath: string;
  fields: CertificateField[];
  createdAt: string;
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface EventRoleAssignment {
  regNo: RegNo;
  name: string;
  role: Exclude<EventRole, 'participant' | 'visitor'>;
  assignedAt: string;
  assignedBy: RegNo;
}

// ─── Backend Permissions (legacy compat) ──────────────────────────────────────

export interface BackendPermissions {
  canEdit: boolean;
  canEvaluate: boolean;
  canShortlist: boolean;
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

// ─── URL helpers ──────────────────────────────────────────────────────────────

const enc = encodeURIComponent;
const eventsBase = '/api/events';
const compBase = (eventId: string) => `/api/competitions/${enc(eventId)}`;
const roundBase = (eventId: string, roundId: string) =>
  `${compBase(eventId)}/rounds/${enc(roundId)}`;

// ─── Role ─────────────────────────────────────────────────────────────────────

export async function getMyRole(eventId: string): Promise<MyRoleResponse> {
  return safeFetch(() => requestData<MyRoleResponse>(`${compBase(eventId)}/my-role`));
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvent(eventId: string): Promise<EventDetail> {
  const cacheKey = `event:${eventId}`;
  const cached = eventCache.get<EventDetail>(cacheKey);
  if (cached) return cached;

  const data = await safeFetch(() =>
    requestData<EventDetail>(`${eventsBase}/${enc(eventId)}`)
  );
  eventCache.set(cacheKey, data, 60_000);
  return data;
}

export async function createEvent(data: Partial<EventDetail>): Promise<EventDetail> {
  const result = await safeFetch(() =>
    requestData<EventDetail>(eventsBase, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  );
  eventCache.invalidatePrefix('events-list');
  return result;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await safeFetch(() =>
    requestData<{ deleted: boolean }>(`${eventsBase}/${enc(eventId)}`, {
      method: 'DELETE',
    })
  );
  eventCache.invalidate(`event:${eventId}`);
  eventCache.invalidatePrefix('events-list');
}

export async function getMyRegisteredEvents(): Promise<EventSummary[]> {
  return safeFetch(() =>
    requestData<EventSummary[]>(`${eventsBase}?registered=true`)
  );
}

export async function registerForEvent(eventId: string): Promise<void> {
  await safeFetch(() =>
    requestData<Record<string, unknown>>(`${eventsBase}/${enc(eventId)}/register`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  );
  eventCache.invalidate(`event:${eventId}`);
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(eventId: string, name: string): Promise<Team> {
  const result = await safeFetch(() =>
    requestData<Team>(`${compBase(eventId)}/teams`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  );
  eventCache.invalidate(`team:${eventId}`);
  return result;
}

export async function getMyTeam(eventId: string): Promise<Team | null> {
  const cacheKey = `team:${eventId}`;
  const cached = eventCache.get<Team | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await safeFetch(() =>
      requestData<Team | null>(`${compBase(eventId)}/teams/my-team`)
    );
    eventCache.set(cacheKey, data, 30_000);
    return data;
  } catch {
    return null;
  }
}

export async function inviteMember(
  eventId: string,
  teamId: string,
  regNo: RegNo
): Promise<void> {
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}/invite`,
      { method: 'POST', body: JSON.stringify({ inviteeRegisterNumber: regNo }) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function acceptInvite(eventId: string, invitationId: string): Promise<void> {
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/invitations/${enc(invitationId)}/accept`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function getEventTeams(eventId: string): Promise<Team[]> {
  return safeFetch(() =>
    requestData<Team[]>(`${compBase(eventId)}/teams`)
  );
}

export async function getTeamRecruitmentBoard(eventId: string): Promise<TeamRecruitmentPost[]> {
  return safeFetch(() =>
    requestData<TeamRecruitmentPost[]>(`${compBase(eventId)}/teams/recruitment`)
  );
}

export async function upsertTeamRecruitmentPost(
  eventId: string,
  payload: { neededSkills: string[]; description?: string; openSlots?: number; status?: 'open' | 'closed' }
): Promise<TeamRecruitmentPost> {
  const result = await safeFetch(() =>
    requestData<TeamRecruitmentPost>(`${compBase(eventId)}/teams/recruitment`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  );
  eventCache.invalidate(`team:${eventId}`);
  return result;
}

export async function getTeamMatches(eventId: string): Promise<TeamMatchCandidate[]> {
  return safeFetch(() =>
    requestData<TeamMatchCandidate[]>(`${compBase(eventId)}/teams/matches`)
  );
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function getMySubmission(
  eventId: string,
  roundId: string
): Promise<Submission | null> {
  const cacheKey = `my-submission:${eventId}:${roundId}`;
  const cached = eventCache.get<Submission | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await safeFetch(() =>
      requestData<Submission | null>(`${roundBase(eventId, roundId)}/my-submission`)
    );
    eventCache.set(cacheKey, data, 30_000);
    return data;
  } catch {
    return null;
  }
}

export async function getCompetitionConfig(
  eventId: string
): Promise<CompetitionConfig | null> {
  const cacheKey = `config:${eventId}`;
  const cached = eventCache.get<CompetitionConfig | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await safeFetch(() =>
      requestData<CompetitionConfig>(`${compBase(eventId)}/config`)
    );
    eventCache.set(cacheKey, data, 120_000);
    return data;
  } catch {
    return null;
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

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
    }>(`${compBase(eventId)}/analytics`)
  );
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export async function getCertificateTemplate(
  eventId: string,
  roundId?: string
): Promise<CertificateTemplate | null> {
  const qs = roundId ? `?roundId=${enc(roundId)}` : '';
  try {
    return await safeFetch(() =>
      requestData<CertificateTemplate>(`${compBase(eventId)}/certificate-template${qs}`)
    );
  } catch {
    return null;
  }
}

export async function saveCertificateTemplate(
  eventId: string,
  data: Partial<CertificateTemplate>
): Promise<CertificateTemplate> {
  return safeFetch(() =>
    requestData<CertificateTemplate>(`${compBase(eventId)}/certificate-template`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  );
}

export async function uploadCertificateTemplateImage(
  eventId: string,
  file: File
): Promise<{ path: string }> {
  const formData = new FormData();
  formData.set('file', file);
  return safeFetch(() =>
    requestMultipart<{ path: string }>(`${compBase(eventId)}/certificate-template/image`, formData)
  );
}

export async function downloadMyCertificate(
  eventId: string,
  roundId: string
): Promise<Blob> {
  const response = await fetch(`${roundBase(eventId, roundId)}/certificates/me/download`, {
    credentials: 'include',
  });
  if (!response.ok) {
    if (response.status === 401) handleSessionAuthFailure();
    if (response.status === 403) throw new PermissionError('Cannot download certificate');
    throw new Error(`Failed to download certificate: ${response.status}`);
  }
  return response.blob();
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function getEventRoles(eventId: string): Promise<EventRoleAssignment[]> {
  return safeFetch(() =>
    requestData<EventRoleAssignment[]>(`${compBase(eventId)}/roles`)
  );
}

export async function assignRole(
  eventId: string,
  regNo: RegNo,
  role: EventRoleAssignment['role']
): Promise<EventRoleAssignment> {
  const result = await safeFetch(() =>
    requestData<EventRoleAssignment>(`${compBase(eventId)}/roles`, {
      method: 'POST',
      body: JSON.stringify({ regNo, role }),
    })
  );
  eventCache.invalidate(`event:${eventId}`);
  return result;
}

export async function removeRole(eventId: string, regNo: RegNo): Promise<void> {
  await safeFetch(() =>
    requestData<{ removed: boolean }>(`${compBase(eventId)}/roles/${enc(regNo)}`, {
      method: 'DELETE',
    })
  );
  eventCache.invalidate(`event:${eventId}`);
}

// ─── Announcements ────────────────────────────────────────────────────────────
