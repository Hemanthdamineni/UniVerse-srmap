/**
 * scoring.ts — client-side fallback helpers used while the real
 * /api/scores/me endpoint is in flight. The authoritative numbers
 * come from the backend; these functions only render the same shape
 * from data already loaded on the page so the UI never flashes zeros.
 *
 * The return type is the same `ScoreBreakdown` shape the backend
 * emits, so consumers (ScoreCard, MyActivityPage, EventWorkflowPages)
 * can pass the fallback directly without per-call reshaping.
 */
import type { EventSummary, PersistentTeam, Team } from "./competitionsApi";
import type { ScoreBand, ScoreBreakdown, ScoreDimension } from "./competitionsApi";
import type { EventSummary as CampusEventSummary } from "../campus/campusApi";

interface TeamScoreInputs {
  // The `event` shape is intentionally loose: pages feed it from
  // either the campusApi (EventWorkflowPages) or the competitionsApi
  // (older callers). The scoring only reads `status`, so we accept
  // a structural minimum.
  activeTeams: Array<{
    event: { id: string; status: string };
    team: { members: Array<{ status: string }> };
  }>;
  persistentTeams: Array<{ leaderRegNo: string }>;
  currentRegNo: string;
}

// Event shape consumed by the scoring functions. The pages feed
// this from either the campusApi (EventWorkflowPages, MyActivityPage)
// or the competitionsApi. The two EventSummary types differ in
// whether `type` and a few other fields are required, so we use a
// structural minimum that covers both. The scoring functions only
// read `status`.
type ScorableEvent = {
  id: string;
  status: string;
  type?: string;
};

interface CompetitionScoreInputs {
  events: ScorableEvent[];
  now?: Date;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

// Band assignment helper. The fallback always lands in the lowest band
// (we don't have enough info from the in-page data to compute a real
// band); the live endpoint emits the real band.
const bandForPoints = (points: number, max: number): ScoreBand => {
  if (max <= 0) return "none";
  const ratio = points / max;
  if (ratio >= 0.85) return "excellent";
  if (ratio >= 0.65) return "strong";
  if (ratio >= 0.4) return "building";
  if (ratio > 0) return "starting";
  return "none";
};

// bandLabel humanizes the band for display.
const bandLabelFor = (band: ScoreBand): string => {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "building":
      return "Building";
    case "starting":
      return "Getting started";
    case "none":
    default:
      return "No data yet";
  }
};

const buildDimension = (
  id: string,
  label: string,
  points: number,
  max: number,
  summary: string
): ScoreDimension => {
  const band = bandForPoints(points, max);
  return {
    id,
    label,
    points,
    max,
    band,
    bandLabel: bandLabelFor(band),
    progressPct: max > 0 ? Math.round((points / max) * 100) : 0,
    summary,
  };
};

export function computeTeamScore({
  activeTeams,
  persistentTeams,
  currentRegNo,
}: TeamScoreInputs): ScoreBreakdown {
  const eventTeamCount = activeTeams.length;
  const eventTeamPoints = Math.min(eventTeamCount, 3) * 30;

  const ledPersistent = persistentTeams.filter(
    (team) => team.leaderRegNo === currentRegNo
  );
  const memberPersistent = persistentTeams.filter(
    (team) => team.leaderRegNo !== currentRegNo
  );
  const persistentPoints = ledPersistent.length * 25 + memberPersistent.length * 10;

  const filledRosters = activeTeams.filter(({ team }) =>
    team.members.some((member) => member.status === "accepted")
  );
  const rosterPoints = Math.min(filledRosters.length, 3) * 5;

  const crossEngagement = eventTeamCount > 0 && persistentTeams.length > 0 ? 5 : 0;

  const score = clampScore(
    eventTeamPoints + persistentPoints + rosterPoints + crossEngagement
  );

  const leadershipPoints = Math.min(
    eventTeamCount * 15 + ledPersistent.length * 10 + memberPersistent.length * 5,
    40
  );
  const breadthPoints =
    Math.min(eventTeamCount, 5) * 5 + Math.min(persistentTeams.length, 3) * 5;

  return {
    score,
    headlineBand: score >= 65 ? "strong" : "building",
    dimensions: [
      buildDimension(
        "leadership",
        "Leadership",
        leadershipPoints,
        40,
        leadershipPoints > 0
          ? `Active in ${eventTeamCount} event team${eventTeamCount === 1 ? "" : "s"} and ${persistentTeams.length} persistent squad${persistentTeams.length === 1 ? "" : "s"}.`
          : "Lead or join a team to start earning leadership points."
      ),
      buildDimension(
        "roster",
        "Roster health",
        rosterPoints,
        30,
        rosterPoints > 0
          ? `${filledRosters.length} of your ${eventTeamCount} event team${eventTeamCount === 1 ? " has" : "s have"} accepted members.`
          : "Accepted members on your teams boost roster health."
      ),
      buildDimension(
        "breadth",
        "Engagement breadth",
        breadthPoints,
        30,
        breadthPoints > 0
          ? "You span event teams and persistent squads — that's the breadth signal."
          : "Diversify across event teams and persistent squads for a higher score."
      ),
    ],
    meta: { kind: "team-fallback" },
  };
}

export function computeCompetitionScore({
  events,
  now = new Date(),
}: CompetitionScoreInputs): ScoreBreakdown {
  const active = events.filter(
    (event) => !["completed", "archived"].includes(event.status)
  );
  const completed = events.filter((event) =>
    ["completed", "results-published"].includes(event.status)
  );

  const participationPoints = Math.min(active.length, 4) * 5;
  const completedResultsPoints = Math.min(completed.length, 3) * 5;
  const activityBonus = active.length > 0 ? 20 : 0;
  const score = clampScore(
    participationPoints + completedResultsPoints + activityBonus
  );

  return {
    score,
    headlineBand: score >= 65 ? "strong" : "building",
    dimensions: [
      buildDimension(
        "participation",
        "Participation",
        participationPoints,
        20,
        active.length > 0
          ? `Active in ${active.length} competition${active.length === 1 ? "" : "s"}.`
          : "Register for a competition to start earning participation points."
      ),
      buildDimension(
        "submission-progress",
        "Submission progress",
        0,
        30,
        "Submission progress is computed from the live endpoint — the fallback shows 0 until it loads."
      ),
      buildDimension(
        "evaluation",
        "Evaluation results",
        completedResultsPoints,
        30,
        completedResultsPoints > 0
          ? `${completed.length} competition${completed.length === 1 ? "" : "s"} reached the results stage.`
          : "Reaching the results stage of a competition unlocks evaluation points."
      ),
      buildDimension(
        "recency",
        "Recent activity",
        activityBonus,
        20,
        activityBonus > 0
          ? "You have an active competition right now — recency is at its cap."
          : "No active competition at the moment."
      ),
    ],
    meta: { kind: "competition-fallback", now: now.toISOString() },
  };
}
