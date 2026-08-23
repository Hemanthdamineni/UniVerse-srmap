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
import { isStaticPrototype } from '../core/prototype';
import { getCurrentRegNo } from '../core/identity';
import { eventCache } from './eventCache';
import {
  getPrototypeEventTeam,
  isPrototypeEventRegistered,
  savePrototypeEventTeam,
  setPrototypeEventRegistration,
  getPrototypeEventInvitations,
  deletePrototypeEventTeam,
  getPrototypePersistentTeams,
  getPrototypePersistentTeam,
  savePrototypePersistentTeam,
  deletePrototypePersistentTeam,
  getPrototypeTeamInvitations,
  savePrototypeTeamInvitation,
  updatePrototypeTeamInvitationStatus,
  deletePrototypeTeamInvitation,
} from './prototypeEventState';

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
  /** Backend stores dates in startAt/endAt */
  startAt: string;
  endAt: string;
  /** startDate/endDate are derived aliases used in display logic */
  startDate: string;
  endDate: string;
  /** Backend stores location as object { physical, virtual, mapUrl } */
  location: string | { physical?: string; virtual?: string; mapUrl?: string };
  department: string;
  maxCapacity: number | null;
  /** Backend field is registeredCount */
  registeredCount: number;
  /** registrationCount is an alias used in some display logic */
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

export interface TeamInvitation {
  id: string;
  eventId: string;
  teamId: string;
  teamName: string;
  inviteeRegisterNumber: RegNo;
  inviterRegisterNumber: RegNo;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

// ─── Persistent Teams ───────────────────────────────────────────────────────────

export interface PersistentTeam {
  id: string;
  name: string;
  leaderRegNo: RegNo;
  members: TeamMember[];
  createdAt: string;
}

export interface PersistentTeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  inviteeRegisterNumber: RegNo;
  inviterRegisterNumber: RegNo;
  eventId?: string; // Optional - if set, this is for event registration
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
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
  if (isStaticPrototype()) {
    const regNo = getCurrentRegNo() || 'STATIC-STUDENT';
    const registered = isPrototypeEventRegistered(eventId);
    return {
      regNo,
      role: registered ? 'participant' : 'visitor',
      permissions: {
        canEdit: false,
        canEvaluate: false,
        canShortlist: false,
        canManageRoles: false,
        canViewAllSubmissions: false,
      },
    };
  }
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
  if (isStaticPrototype()) {
    setPrototypeEventRegistration(eventId, true);
    eventCache.invalidate(`event:${eventId}`);
    return;
  }
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
  if (isStaticPrototype()) {
    const regNo = getCurrentRegNo() || 'STATIC-STUDENT';
    const now = new Date().toISOString();
    const team: Team = {
      id: `static-team-${eventId}`,
      eventId,
      name,
      leaderRegNo: regNo,
      members: [{ regNo, name: 'Prototype Student', joinedAt: now, status: 'accepted' }],
      createdAt: now,
    };
    savePrototypeEventTeam(team);
    eventCache.invalidate(`team:${eventId}`);
    return team;
  }
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
  if (isStaticPrototype()) return getPrototypeEventTeam(eventId);
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
  if (isStaticPrototype()) {
    const team = getPrototypeEventTeam(eventId);
    if (!team || team.id !== teamId) throw new Error('Create a team before inviting a member.');
    if (!team.members.some((member) => member.regNo === regNo)) {
      team.members.push({ regNo, name: regNo, joinedAt: new Date().toISOString(), status: 'pending' });
      savePrototypeEventTeam(team);
    }
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}/invite`,
      { method: 'POST', body: JSON.stringify({ inviteeRegisterNumber: regNo }) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function acceptInvite(eventId: string, invitationId: string): Promise<void> {
  if (isStaticPrototype()) {
    // In prototype mode, just invalidate cache - UI will re-fetch
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/invitations/${enc(invitationId)}/accept`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function declineInvitation(eventId: string, invitationId: string): Promise<void> {
  if (isStaticPrototype()) {
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/invitations/${enc(invitationId)}/decline`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function getMyInvitations(eventId: string): Promise<TeamInvitation[]> {
  if (isStaticPrototype()) {
    return getPrototypeEventInvitations(eventId);
  }
  return safeFetch(() =>
    requestData<TeamInvitation[]>(`${compBase(eventId)}/invitations/my-invitations`)
  );
}

export async function leaveTeam(eventId: string, teamId: string): Promise<void> {
  if (isStaticPrototype()) {
    const team = getPrototypeEventTeam(eventId);
    if (team && team.id === teamId) {
      const currentRegNo = getCurrentRegNo();
      if (team.leaderRegNo === currentRegNo) {
        throw new Error('Team leader cannot leave without transferring leadership first.');
      }
      team.members = team.members.filter(m => m.regNo !== currentRegNo);
      savePrototypeEventTeam(team);
    }
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}/members/me`,
      { method: 'DELETE' }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function deleteTeam(eventId: string, teamId: string): Promise<void> {
  if (isStaticPrototype()) {
    deletePrototypeEventTeam(eventId);
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}`,
      { method: 'DELETE' }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function transferLeadership(eventId: string, teamId: string, newLeaderId: RegNo): Promise<void> {
  if (isStaticPrototype()) {
    const team = getPrototypeEventTeam(eventId);
    if (team && team.id === teamId) {
      const currentRegNo = getCurrentRegNo();
      if (team.leaderRegNo !== currentRegNo) {
        throw new Error('Only the team leader can transfer leadership.');
      }
      if (!team.members.some(m => m.regNo === newLeaderId && m.status === 'accepted')) {
        throw new Error('New leader must already be an accepted team member.');
      }
      team.leaderRegNo = newLeaderId;
      savePrototypeEventTeam(team);
    }
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}/leader`,
      { method: 'PUT', body: JSON.stringify({ newLeaderId }) }
    )
  );
  eventCache.invalidate(`team:${eventId}`);
}

export async function cancelInvitation(eventId: string, teamId: string, inviteeRegisterNumber: RegNo): Promise<void> {
  if (isStaticPrototype()) {
    const team = getPrototypeEventTeam(eventId);
    if (team && team.id === teamId) {
      const currentRegNo = getCurrentRegNo();
      if (team.leaderRegNo !== currentRegNo) {
        throw new Error('Only the team leader can cancel invitations.');
      }
      team.members = team.members.filter(m => m.regNo !== inviteeRegisterNumber);
      savePrototypeEventTeam(team);
    }
    eventCache.invalidate(`team:${eventId}`);
    return;
  }
  await safeFetch(() =>
    requestData<Record<string, unknown>>(
      `${compBase(eventId)}/teams/${enc(teamId)}/invite/${enc(inviteeRegisterNumber)}`,
      { method: 'DELETE' }
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

// ─── Persistent Teams ─────────────────────────────────────────────────────────

export async function getMyPersistentTeams(): Promise<PersistentTeam[]> {
  if (isStaticPrototype()) {
    const { getPrototypePersistentTeams } = await import('./prototypeEventState');
    return getPrototypePersistentTeams();
  }
  return safeFetch(() =>
    requestData<PersistentTeam[]>(`/api/teams/persistent`)
  );
}

export async function createPersistentTeam(
  name: string,
  inviteRegNos: string[]
): Promise<PersistentTeam> {
  const currentRegNo = getCurrentRegNo();
  if (isStaticPrototype()) {
    const { savePrototypePersistentTeam } = await import('./prototypeEventState');
    const team: PersistentTeam = {
      id: `persistent-team-${Date.now()}`,
      name,
      leaderRegNo: currentRegNo ?? '',
      members: [
        { regNo: currentRegNo ?? '', name: currentRegNo ?? '', joinedAt: new Date().toISOString(), status: 'accepted' as const },
        ...inviteRegNos.map(regNo => ({ regNo, name: regNo, joinedAt: new Date().toISOString(), status: 'pending' as const }))
      ],
      createdAt: new Date().toISOString(),
    };
    savePrototypePersistentTeam(team);

    // Create invitations for invited members
    const { savePrototypeTeamInvitation } = await import('./prototypeEventState');
    for (const regNo of inviteRegNos) {
      savePrototypeTeamInvitation({
        id: `invite-${Date.now()}-${regNo}`,
        teamId: team.id,
        teamName: team.name,
        inviteeRegisterNumber: regNo,
        inviterRegisterNumber: currentRegNo ?? '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
    return team;
  }
  const result = await safeFetch(() =>
    requestData<PersistentTeam>(`/api/teams/persistent`, {
      method: 'POST',
      body: JSON.stringify({ name, inviteRegNos }),
    })
  );
  // TODO: invalidate persistent teams cache
  return result;
}

export async function deletePersistentTeam(teamId: string): Promise<void> {
  if (isStaticPrototype()) {
    const { deletePrototypePersistentTeam } = await import('./prototypeEventState');
    return deletePrototypePersistentTeam(teamId);
  }
  await safeFetch(() =>
    requestData<void>(`/api/teams/persistent/${teamId}`, {
      method: 'DELETE',
    })
  );
  // TODO: invalidate persistent teams cache
}

export async function inviteToPersistentTeam(
  teamId: string,
  inviteRegNos: string[]
): Promise<PersistentTeamInvitation[]> {
  const currentRegNo = getCurrentRegNo();
  if (isStaticPrototype()) {
    const { savePrototypeTeamInvitation } = await import('./prototypeEventState');
    const { getPrototypePersistentTeam } = await import('./prototypeEventState');
    const team = getPrototypePersistentTeam(teamId);
    if (!team) throw new Error('Team not found');
    const invitations: PersistentTeamInvitation[] = [];
    for (const regNo of inviteRegNos) {
      const invitation: PersistentTeamInvitation = {
        id: `invite-${Date.now()}-${regNo}`,
        teamId,
        teamName: team.name,
        inviteeRegisterNumber: regNo,
        inviterRegisterNumber: currentRegNo ?? '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      savePrototypeTeamInvitation(invitation);
      invitations.push(invitation);
    }
    return invitations;
  }
  const result = await safeFetch(() =>
    requestData<PersistentTeamInvitation[]>(`/api/teams/persistent/${teamId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ inviteRegNos }),
    })
  );
  // TODO: invalidate cache
  return result;
}

export async function getMyPersistentTeamInvitations(): Promise<PersistentTeamInvitation[]> {
  if (isStaticPrototype()) {
    const { getPrototypeTeamInvitations } = await import('./prototypeEventState');
    const { getCurrentRegNo } = await import('../core/identity');
    const regNo = getCurrentRegNo();
    return regNo ? getPrototypeTeamInvitations(regNo) : [];
  }
  return safeFetch(() =>
    requestData<PersistentTeamInvitation[]>(`/api/teams/persistent/invitations`)
  );
}

export async function respondToPersistentTeamInvitation(
  invitationId: string,
  accept: boolean
): Promise<void> {
  if (isStaticPrototype()) {
    const { updatePrototypeTeamInvitationStatus, getPrototypeTeamInvitations, getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('./prototypeEventState');
    const { getCurrentRegNo } = await import('../core/identity');
    const regNo = getCurrentRegNo();
    if (!regNo) return;
    const invitations = getPrototypeTeamInvitations(regNo);
    const invitation = invitations.find(inv => inv.id === invitationId);
    if (!invitation) return;
    updatePrototypeTeamInvitationStatus(regNo, invitation.teamId, accept ? 'accepted' : 'declined');

    // If accepted, add to team members
    if (accept) {
      const { getPrototypePersistentTeam, savePrototypePersistentTeam } = await import('./prototypeEventState');
      const team = getPrototypePersistentTeam(invitation.teamId);
      if (team) {
        const memberExists = team.members.some(m => m.regNo === regNo);
        if (!memberExists) {
          team.members.push({ regNo, name: regNo, joinedAt: new Date().toISOString(), status: 'accepted' });
          savePrototypePersistentTeam(team);
        }
      }
    }
    return;
  }
  await safeFetch(() =>
    requestData<void>(`/api/teams/persistent/invitations/${invitationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ accept }),
    })
  );
  // TODO: invalidate cache
}

export async function cancelPersistentTeamInvitation(
  teamId: string,
  inviteeRegNo: string
): Promise<void> {
  if (isStaticPrototype()) {
    const { deletePrototypeTeamInvitation } = await import('./prototypeEventState');
    const { getCurrentRegNo } = await import('../core/identity');
    const regNo = getCurrentRegNo();
    if (!regNo) return;
    deletePrototypeTeamInvitation(inviteeRegNo, teamId);
    return;
  }
  await safeFetch(() =>
    requestData<void>(`/api/teams/persistent/${teamId}/invitations/${encodeURIComponent(inviteeRegNo)}`, {
      method: 'DELETE',
    })
  );
  // TODO: invalidate cache
}

// ─── Announcements ────────────────────────────────────────────────────────────
