/**
 * scoring.ts — client-side fallback helpers used while the real
 * /api/scores/me endpoint is in flight. The authoritative numbers
 * come from the backend; these functions only render the same shape
 * from data already loaded on the page so the UI never flashes zeros.
 */
import type { EventSummary, PersistentTeam, Team } from "./competitionsApi";

interface TeamScoreInputs {
  activeTeams: Array<{ event: EventSummary; team: Team }>;
  persistentTeams: PersistentTeam[];
  currentRegNo: string;
}

interface CompetitionScoreInputs {
  events: EventSummary[];
  now?: Date;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function computeTeamScore({
  activeTeams,
  persistentTeams,
  currentRegNo,
}: TeamScoreInputs): { score: number; dimensions: { id: string; label: string; points: number; max: number; band: string; summary: string }[]; meta: Record<string, unknown> } {
  const eventTeamCount = activeTeams.length;
  const eventTeamPoints = Math.min(eventTeamCount, 3) * 30;

  const ledPersistent = persistentTeams.filter(
    (team) => team.leaderRegNo === currentRegNo,
  );
  const memberPersistent = persistentTeams.filter(
    (team) => team.leaderRegNo !== currentRegNo,
  );
  const persistentPoints = ledPersistent.length * 25 + memberPersistent.length * 10;

  const filledRosters = activeTeams.filter(({ team }) =>
    team.members.some((member) => member.status === "accepted"),
  );
  const rosterPoints = Math.min(filledRosters.length, 3) * 5;

  const crossEngagement = eventTeamCount > 0 && persistentTeams.length > 0 ? 5 : 0;

  const score = clampScore(eventTeamPoints + persistentPoints + rosterPoints + crossEngagement);

  return {
    score,
    dimensions: [
      {
        id: "leadership",
        label: "Leadership",
        points: Math.min(eventTeamCount * 15 + ledPersistent.length * 10 + memberPersistent.length * 5, 40),
        max: 40,
        band: "none",
        summary: "",
      },
      {
        id: "roster",
        label: "Roster health",
        points: rosterPoints,
        max: 30,
        band: "none",
        summary: "",
      },
      {
        id: "breadth",
        label: "Engagement breadth",
        points: Math.min(eventTeamCount, 5) * 5 + Math.min(persistentTeams.length, 3) * 5,
        max: 30,
        band: "none",
        summary: "",
      },
    ],
    meta: {},
  };
}

export function computeCompetitionScore({
  events,
  now = new Date(),
}: CompetitionScoreInputs): { score: number; dimensions: { id: string; label: string; points: number; max: number; band: string; summary: string }[]; meta: Record<string, unknown> } {
  const active = events.filter((event) => !["completed", "archived"].includes(event.status));
  const completed = events.filter((event) =>
    ["completed", "results-published"].includes(event.status),
  );

  const participationPoints = Math.min(active.length, 4) * 5;
  const completedResultsPoints = Math.min(completed.length, 3) * 5;
  const score = clampScore(participationPoints + completedResultsPoints + (active.length > 0 ? 20 : 0));

  return {
    score,
    dimensions: [
      {
        id: "participation",
        label: "Participation",
        points: Math.min(active.length, 4) * 5,
        max: 20,
        band: "none",
        summary: "",
      },
      {
        id: "submission-progress",
        label: "Submission progress",
        points: 0,
        max: 30,
        band: "none",
        summary: "",
      },
      {
        id: "evaluation",
        label: "Evaluation results",
        points: 0,
        max: 30,
        band: "none",
        summary: "",
      },
      {
        id: "recency",
        label: "Recent activity",
        points: active.length > 0 ? 20 : 0,
        max: 20,
        band: "none",
        summary: "",
      },
    ],
    meta: { now: now.toISOString() },
  };
}
