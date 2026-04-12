/**
 * eventUserState.ts — Single source of truth for user role and round state.
 *
 * Use getEventUserState() in every page that needs role or submission awareness.
 * This eliminates the 6+ places that currently each compute isOrganizer from scratch.
 *
 * Critical invariant: no page or component computes isOrganizer, canSubmit, or
 * submissionState independently — always read from EventUserState.
 */

import type { EventDetail, CompetitionConfig, CompetitionRound } from './campusApi';
import { getEventPhase, type EventPhase } from './eventPhase';

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
  role: 'visitor' | 'participant' | 'organizer';
  canEdit: boolean;      // Backend-driven flag — trust this over local computation
  canEvaluate: boolean;  // Backend-driven flag
  canShortlist: boolean; // Backend-driven flag
  phase: EventPhase;
  currentRound: CompetitionRound | null; // the round open for submission right now
  roundStates: RoundUserState[];
}

export interface BackendPermissions {
  canEdit: boolean;
  canEvaluate: boolean;
  canShortlist: boolean;
}

interface SubmissionLike {
  criteriaScores?: Record<string, number> | null;
  shortlisted?: boolean;
}

export function getEventUserState(
  event: EventDetail,
  config: CompetitionConfig | null,
  userId: string,
  submissions: Record<string, SubmissionLike | null>, // keyed by roundId
  permissions?: BackendPermissions,
): EventUserState {
  // Determine role
  const coOrgs: string[] = Array.isArray(event.coOrganizers)
    ? (event.coOrganizers as string[])
    : [];
  const createdByField =
    (event as Record<string, unknown>).createdBy as string | undefined ??
    (event as Record<string, unknown>).createdByUserId as string | undefined ??
    '';

  const isOrganizer = createdByField === userId || coOrgs.includes(userId) || Boolean(permissions?.canEdit);
  const isRegistered = Boolean(event.myRegistration);
  const role: EventUserState['role'] = isOrganizer
    ? 'organizer'
    : isRegistered
    ? 'participant'
    : 'visitor';

  const phase = getEventPhase(event);

  // Backend-driven permissions take precedence if available
  const canEdit = permissions?.canEdit ?? isOrganizer;
  const canEvaluate = permissions?.canEvaluate ?? isOrganizer;
  const canShortlist = permissions?.canShortlist ?? isOrganizer;

  const rounds = config?.rounds ?? [];
  const now = new Date();

  const shortlistedRoundIds = new Set<string>();
  const roundStates: RoundUserState[] = rounds.map((round) => {
    const sub = submissions[round.roundId];
    const deadline = round.submissionDeadline ? new Date(round.submissionDeadline) : null;
    const deadlinePassed = deadline ? deadline <= now : false;

    // Gating check
    const priorRoundId = round.requiresShortlistFromRound ?? null;
    const isBlocked = Boolean(priorRoundId && !shortlistedRoundIds.has(priorRoundId));

    // Submission state
    let submissionState: RoundUserState['submissionState'] = 'none';
    if (sub) {
      if (round.resultsPublished) submissionState = 'published';
      else if (sub.criteriaScores) submissionState = 'evaluated';
      else if (deadlinePassed) submissionState = 'locked';
      else submissionState = 'submitted';
    } else if (deadlinePassed) {
      submissionState = 'locked';
    }

    const isShortlisted = sub?.shortlisted ?? false;
    if (isShortlisted) shortlistedRoundIds.add(round.roundId);

    const canSubmit =
      role === 'participant' &&
      !deadlinePassed &&
      !isBlocked &&
      !round.resultsPublished;

    const priorRoundTitle = priorRoundId
      ? rounds.find((r) => r.roundId === priorRoundId)?.title ?? 'previous round'
      : '';

    return {
      roundId: round.roundId,
      roundTitle: round.title,
      canSubmit,
      canViewResults: Boolean(round.resultsPublished),
      submissionState,
      isShortlisted,
      isBlocked,
      blockReason: isBlocked
        ? `Requires shortlist from ${priorRoundTitle}`
        : undefined,
    };
  });

  const currentRound =
    rounds.find((r) => r.submissionDeadline && new Date(r.submissionDeadline) > now) ?? null;

  return { role, canEdit, canEvaluate, canShortlist, phase, currentRound, roundStates };
}
