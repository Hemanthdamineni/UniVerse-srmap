/**
 * eventPhase.ts — Canonical event phase mapping.
 *
 * Use getEventPhase() everywhere: event cards, dashboard round cards,
 * filter chips, sticky action bar. Never scatter raw status strings across components.
 */

import type { EventDetail, CompetitionRound } from './campusApi';

export const EVENT_PHASE = {
  UPCOMING: 'UPCOMING',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  LIVE: 'LIVE',
  EVALUATION: 'EVALUATION',
  RESULTS: 'RESULTS',
  COMPLETED: 'COMPLETED',
} as const;

export type EventPhase = typeof EVENT_PHASE[keyof typeof EVENT_PHASE];

export function getEventPhase(event: EventDetail): EventPhase {
  const now = new Date();

  if (event.status === 'archived' || event.status === 'completed') {
    return EVENT_PHASE.COMPLETED;
  }

  const rawConfig = (event as Record<string, unknown>).competitionConfig;
  if (!rawConfig) {
    if (event.status === 'published' || event.status === 'public') {
      return EVENT_PHASE.REGISTRATION_OPEN;
    }
    if (event.status === 'ongoing') return EVENT_PHASE.LIVE;
    return EVENT_PHASE.UPCOMING;
  }

  // Competition phase: derive from rounds
  let config: { rounds: CompetitionRound[] } | null = null;
  try {
    config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig as { rounds: CompetitionRound[] });
  } catch {
    config = null;
  }

  const rounds: CompetitionRound[] = config?.rounds ?? [];
  if (rounds.length === 0) return EVENT_PHASE.REGISTRATION_OPEN;

  const anyPublished = rounds.some((r) => r.resultsPublished);
  const allPublished = rounds.every((r) => r.resultsPublished);
  const anyOpenForSubmission = rounds.some(
    (r) => !r.resultsPublished && r.submissionDeadline && new Date(r.submissionDeadline) > now
  );
  const anyPastDeadline = rounds.some(
    (r) => r.submissionDeadline && new Date(r.submissionDeadline) <= now && !r.resultsPublished
  );

  if (allPublished) return EVENT_PHASE.RESULTS;
  if (anyOpenForSubmission) return EVENT_PHASE.LIVE;
  if (anyPastDeadline) return EVENT_PHASE.EVALUATION;
  if (anyPublished) return EVENT_PHASE.RESULTS;
  return EVENT_PHASE.REGISTRATION_OPEN;
}

/** Phase → display label/color mapping (used in StatusBadge) */
export const PHASE_DISPLAY: Record<EventPhase, { label: string; color: string; pulse: boolean }> = {
  UPCOMING: { label: 'Upcoming', color: '#64748b', pulse: false },
  REGISTRATION_OPEN: { label: 'Registration Open', color: 'var(--status-open-text)', pulse: false },
  LIVE: { label: 'Live', color: 'var(--status-live-text)', pulse: true },
  EVALUATION: { label: 'Evaluation', color: 'var(--status-pending-text)', pulse: false },
  RESULTS: { label: 'Results Out', color: 'var(--comp-accent)', pulse: false },
  COMPLETED: { label: 'Completed', color: 'var(--status-closed-text)', pulse: false },
};
