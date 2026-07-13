/**
 * eventUserState.ts — Single source of truth for user role and round state.
 *
 * Use getEventUserState() in every page that needs role or submission awareness.
 * This eliminates the 6+ places that currently each compute isOrganizer from scratch.
 *
 * Critical invariant: no page or component computes isOrganizer, canSubmit, or
 * submissionState independently — always read from EventUserState.
 *
 * Identity is always RegNo (e.g. "AP21110010"). Never numeric ID or UUID.
 */

import type { EventDetail as CampusEventDetail, CompetitionConfig as CampusCompetitionConfig, CompetitionRound as CampusCompetitionRound } from '../campus/campusApi';
import type { EventDetail as CompEventDetail, CompetitionConfig as CompCompetitionConfig, CompetitionRound as CompCompetitionRound, MyRoleResponse, EventRole } from './competitionsApi';
import { getEventPhase, type EventPhase } from './eventPhase';

// Accept either campusApi or competitionsApi event detail shape
type AnyEventDetail = CampusEventDetail | CompEventDetail;
type AnyCompetitionConfig = CampusCompetitionConfig | CompCompetitionConfig | null;
type AnyCompetitionRound = CampusCompetitionRound | CompCompetitionRound;

export interface RoundUserState {
  roundId: string;
  roundTitle: string;
  canSubmit: boolean;
  canViewResults: boolean;
  submissionState: 'none' | 'submitted' | 'locked' | 'evaluated' | 'published';
  isShortlisted: boolean;
  isBlocked: boolean; // true if gated by prior round shortlist
  blockReason?: string;
}

export interface EventUserState {
  role: EventRole;
  canEdit: boolean;      // Backend-driven flag — trust this over local computation
  canEvaluate: boolean;  // Backend-driven flag
  canShortlist: boolean; // Backend-driven flag
  canManageRoles: boolean; // Backend-driven flag
  canViewAllSubmissions: boolean; // Backend-driven flag
  permissions: MyRoleResponse['permissions'] | null;
  phase: EventPhase;
  currentRound: AnyCompetitionRound | null; // the round open for submission right now
  roundStates: RoundUserState[];
}

export interface BackendPermissions {
  canEdit: boolean;
  canEvaluate: boolean;
  canShortlist: boolean;
  canManageRoles?: boolean;
  canViewAllSubmissions?: boolean;
}

interface SubmissionLike {
  criteriaScores?: Record<string, number> | null;
  shortlisted?: boolean;
}

/**
 * Computes the full user state for an event.
 *
 * @param event         - Event detail from either campusApi or competitionsApi
 * @param config        - Competition config if the event is a competition
 * @param userId        - Current user's registration number (RegNo)
 * @param submissions   - Map of roundId → user's submission (or null)
 * @param permissions   - Backend-driven permissions from getMyRole()
 * @param myRole        - Full MyRoleResponse from getMyRole() (if available)
 */
export function getEventUserState(
  event: AnyEventDetail,
  config: AnyCompetitionConfig,
  userId: string,
  submissions: Record<string, SubmissionLike | null>,
  permissions?: BackendPermissions,
  myRole?: MyRoleResponse | null,
): EventUserState {
  // Determine role — prefer API-driven myRole if available
  let role: EventRole;

  if (myRole) {
    role = myRole.role;
  } else {
    // Fallback: derive from event data when API role is unavailable
    const coOrgs: string[] = Array.isArray((event as Record<string, unknown>).coOrganizers)
      ? ((event as Record<string, unknown>).coOrganizers as string[])
      : [];
    // Safely read createdBy / createdByUserId — either may be undefined
    const rawCreatedBy = (event as Record<string, unknown>).createdBy;
    const rawCreatedByUserId = (event as Record<string, unknown>).createdByUserId;
    const createdByField = (
      (typeof rawCreatedBy === 'string' && rawCreatedBy.trim()) ||
      (typeof rawCreatedByUserId === 'string' && rawCreatedByUserId.trim()) ||
      ''
    ).toUpperCase();
    const normalizedUserId = userId.trim().toUpperCase();

    const isOrganizer =
      (createdByField !== '' && createdByField === normalizedUserId) ||
      coOrgs.map((c) => c.trim().toUpperCase()).includes(normalizedUserId) ||
      Boolean(permissions?.canEdit);
    const isRegistered = Boolean((event as Record<string, unknown>).myRegistration);

    role = isOrganizer ? 'owner' : isRegistered ? 'participant' : 'visitor';
  }

  const phase = getEventPhase(event as CampusEventDetail);

  // Backend-driven permissions take precedence
  const canEdit = myRole?.permissions?.canEdit ?? permissions?.canEdit ?? (role === 'owner' || role === 'co-organizer');
  const canEvaluate = myRole?.permissions?.canEvaluate ?? permissions?.canEvaluate ?? (role === 'owner' || role === 'co-organizer' || role === 'judge');
  const canShortlist = myRole?.permissions?.canShortlist ?? permissions?.canShortlist ?? (role === 'owner' || role === 'co-organizer');
  const canManageRoles = myRole?.permissions?.canManageRoles ?? permissions?.canManageRoles ?? (role === 'owner');
  const canViewAllSubmissions = myRole?.permissions?.canViewAllSubmissions ?? permissions?.canViewAllSubmissions ?? canEdit;

  const fullPermissions: MyRoleResponse['permissions'] | null = myRole?.permissions ?? null;

  const rounds: AnyCompetitionRound[] = config?.rounds ?? [];
  const now = new Date();

  const shortlistedRoundIds = new Set<string>();
  const roundStates: RoundUserState[] = rounds.map((round) => {
    const sub = submissions[round.roundId];
    const deadlineStr = (round as Record<string, unknown>).submissionDeadline as string | undefined;
    const deadline = deadlineStr ? new Date(deadlineStr) : null;
    const deadlinePassed = deadline ? deadline <= now : false;

    // Gating check
    const priorRoundId = round.requiresShortlistFromRound ?? null;
    const isBlocked = Boolean(priorRoundId && !shortlistedRoundIds.has(priorRoundId));

    // Submission state
    let submissionState: RoundUserState['submissionState'] = 'none';
    const resultsPublished = Boolean((round as Record<string, unknown>).resultsPublished);

    if (sub) {
      if (resultsPublished) submissionState = 'published';
      else if (sub.criteriaScores) submissionState = 'evaluated';
      else if (deadlinePassed) submissionState = 'locked';
      else submissionState = 'submitted';
    } else if (deadlinePassed) {
      submissionState = 'locked';
    }

    const isShortlisted = sub?.shortlisted ?? false;
    if (isShortlisted) shortlistedRoundIds.add(round.roundId);

    const canSubmit =
      (role === 'participant') &&
      !deadlinePassed &&
      !isBlocked &&
      !resultsPublished;

    const priorRoundTitle = priorRoundId
      ? rounds.find((r) => r.roundId === priorRoundId)?.title ?? 'previous round'
      : '';

    return {
      roundId: round.roundId,
      roundTitle: round.title,
      canSubmit,
      canViewResults: resultsPublished,
      submissionState,
      isShortlisted,
      isBlocked,
      blockReason: isBlocked
        ? `Requires shortlist from ${priorRoundTitle}`
        : undefined,
    };
  });

  const currentRound =
    rounds.find((r) => {
      const dl = (r as Record<string, unknown>).submissionDeadline as string | undefined;
      return dl && new Date(dl) > now;
    }) ?? null;

  return {
    role,
    canEdit,
    canEvaluate,
    canShortlist,
    canManageRoles,
    canViewAllSubmissions,
    permissions: fullPermissions,
    phase,
    currentRound,
    roundStates,
  };
}
