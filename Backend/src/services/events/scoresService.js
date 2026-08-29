/**
 * scoresService — real per-user competition and team scores.
 *
 * Reads the actual SQLite-backed stores (registrations, submissions, evaluations,
 * event teams, persistent teams) and returns a 0–100 score plus a per-dimension
 * breakdown. The breakdown is what the UI surfaces, not the headline number —
 * the headline is just the sum.
 *
 * Two public functions:
 *   - computeCompetitionScore({ competitionStore, eventsStore, userId, now })
 *   - computeTeamScore({ competitionStore, persistentTeamStore, userId, now })
 *
 * Both are pure given their inputs; no side effects, no I/O beyond the stores.
 */

const MAX_RUNTIME_DAYS_LOOKBACK = 365;

const POINTS = {
  COMPETITION: {
    PARTICIPATION_MAX: 20,
    SUBMISSION_PROGRESS_MAX: 30,
    EVALUATION_MAX: 30,
    RECENCY_MAX: 20,
  },
  TEAM: {
    LEADERSHIP_MAX: 40,
    ROSTER_MAX: 30,
    BREADTH_MAX: 30,
  },
};

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeJsonParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function bandForScore(value, max) {
  const pct = max > 0 ? value / max : 0;
  if (pct >= 0.8) return "excellent";
  if (pct >= 0.55) return "strong";
  if (pct >= 0.25) return "building";
  if (pct > 0) return "starting";
  return "none";
}

function bandLabel(band) {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "building":
      return "Building";
    case "starting":
      return "Getting started";
    default:
      return "No activity yet";
  }
}

function safeIsoMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// ─── Competition Score ────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {object} args.competitionStore  - createCompetitionStore() instance
 * @param {object} args.eventsStore       - EventsStore instance (for registrations)
 * @param {string} args.userId            - authenticated regNo
 * @param {Date}   [args.now]             - injectable for tests
 */
function computeCompetitionScore({
  competitionStore,
  eventsStore,
  userId,
  now = new Date(),
}) {
  if (!userId) {
    return emptyCompetitionScore();
  }

  const userIdStr = String(userId);
  const registrations = (eventsStore?.registrationsByUser?.get(userIdStr) || []).filter(
    (r) => r.status === "registered"
  );

  // 1. Participation: distinct active competitions registered for.
  const INACTIVE_STATUSES = new Set([
    "completed",
    "archived",
    "cancelled",
    "closed",
    "registration-closed",
  ]);
  const activeRegistrations = registrations.filter((r) => {
    const event = eventsStore?.events?.find?.((e) => e.id === r.eventId);
    if (!event) return true;
    return !INACTIVE_STATUSES.has(event.status);
  });
  const participationCount = activeRegistrations.length;
  const participationPoints = clamp(
    participationCount * 5,
    0,
    POINTS.COMPETITION.PARTICIPATION_MAX
  );

  // 2. Submission progress: across all active competition events, what fraction
  //    of rounds have a real submission from this user (or their team)?
  let totalRounds = 0;
  let roundsWithSubmission = 0;
  let hasAnyEvaluatedSubmission = false;
  let hasAnyShortlisted = false;
  let hasAnyPublishedResults = false;
  let lastSubmissionMs = null;
  let lastRegistrationMs = null;

  for (const reg of activeRegistrations) {
    const event = (eventsStore?.events || []).find((e) => e.id === reg.eventId);
    if (!event) continue;
    let config;
    try {
      // getCompetitionConfig reads the canonical rounds from SQL (including
      // `resultsPublished` which is updated by publishResults, separate from
      // the event JSON snapshot).
      config = competitionStore.getCompetitionConfig(event.id);
    } catch {
      config = safeJsonParse(event.competitionConfig, null);
    }
    if (!config || !config.isCompetition) continue;
    const rounds = Array.isArray(config.rounds) ? config.rounds : [];
    for (const round of rounds) {
      totalRounds += 1;
      try {
        const submission = competitionStore.getActiveSubmission(
          event.id,
          round.roundId,
          userIdStr
        );
        if (submission) {
          roundsWithSubmission += 1;
          const subMs = safeIsoMs(submission.resubmittedAt) || safeIsoMs(submission.submittedAt);
          if (subMs && (lastSubmissionMs === null || subMs > lastSubmissionMs)) {
            lastSubmissionMs = subMs;
          }
          if (typeof submission.totalScore === "number" && submission.totalScore > 0) {
            hasAnyEvaluatedSubmission = true;
          }
          if (submission.shortlisted) {
            hasAnyShortlisted = true;
          }
          if (round.resultsPublished) {
            hasAnyPublishedResults = true;
          }
        }
      } catch {
        // Round not configured in DB yet; skip.
      }
    }
    const regMs = safeIsoMs(reg.registeredAt);
    if (regMs && (lastRegistrationMs === null || regMs > lastRegistrationMs)) {
      lastRegistrationMs = regMs;
    }
  }

  const submissionProgressPct = totalRounds > 0 ? roundsWithSubmission / totalRounds : 0;
  const submissionProgressPoints = clamp(
    Math.round(submissionProgressPct * POINTS.COMPETITION.SUBMISSION_PROGRESS_MAX),
    0,
    POINTS.COMPETITION.SUBMISSION_PROGRESS_MAX
  );

  // 3. Evaluation results: 3 binary signals, capped.
  let evaluationPoints = 0;
  const evaluationSignals = [];
  if (hasAnyEvaluatedSubmission) {
    evaluationPoints += 15;
    evaluationSignals.push("evaluated");
  }
  if (hasAnyShortlisted) {
    evaluationPoints += 10;
    evaluationSignals.push("shortlisted");
  }
  if (hasAnyPublishedResults) {
    evaluationPoints += 5;
    evaluationSignals.push("results-published");
  }
  evaluationPoints = Math.min(evaluationPoints, POINTS.COMPETITION.EVALUATION_MAX);

  // 4. Activity recency: most recent submission OR registration.
  const lastActivityMs =
    lastSubmissionMs !== null
      ? Math.max(lastSubmissionMs, lastRegistrationMs || 0)
      : lastRegistrationMs;
  let recencyPoints = 0;
  let recencyBucket = "none";
  if (lastActivityMs !== null) {
    const days = (now.getTime() - lastActivityMs) / (24 * 60 * 60 * 1000);
    if (days <= 7) {
      recencyPoints = POINTS.COMPETITION.RECENCY_MAX;
      recencyBucket = "this-week";
    } else if (days <= 30) {
      recencyPoints = 12;
      recencyBucket = "this-month";
    } else if (days <= 90) {
      recencyPoints = 6;
      recencyBucket = "this-quarter";
    } else if (days <= MAX_RUNTIME_DAYS_LOOKBACK) {
      recencyPoints = 1;
      recencyBucket = "dormant";
    }
  }

  const total =
    participationPoints +
    submissionProgressPoints +
    evaluationPoints +
    recencyPoints;

  return {
    score: clamp(total),
    dimensions: [
      {
        id: "participation",
        label: "Participation",
        points: participationPoints,
        max: POINTS.COMPETITION.PARTICIPATION_MAX,
        band: bandForScore(participationPoints, POINTS.COMPETITION.PARTICIPATION_MAX),
        summary:
          participationCount === 0
            ? "Register for a competition to start scoring here."
            : `Registered for ${participationCount} active competition${participationCount === 1 ? "" : "s"}.`,
      },
      {
        id: "submission-progress",
        label: "Submission progress",
        points: submissionProgressPoints,
        max: POINTS.COMPETITION.SUBMISSION_PROGRESS_MAX,
        band: bandForScore(submissionProgressPoints, POINTS.COMPETITION.SUBMISSION_PROGRESS_MAX),
        summary: buildSubmissionProgressSummary({
          totalRounds,
          roundsWithSubmission,
        }),
      },
      {
        id: "evaluation",
        label: "Evaluation results",
        points: evaluationPoints,
        max: POINTS.COMPETITION.EVALUATION_MAX,
        band: bandForScore(evaluationPoints, POINTS.COMPETITION.EVALUATION_MAX),
        summary: buildEvaluationSummary({
          hasAnyEvaluatedSubmission,
          hasAnyShortlisted,
          hasAnyPublishedResults,
        }),
      },
      {
        id: "recency",
        label: "Recent activity",
        points: recencyPoints,
        max: POINTS.COMPETITION.RECENCY_MAX,
        band: bandForScore(recencyPoints, POINTS.COMPETITION.RECENCY_MAX),
        summary: buildRecencySummary({
          recencyBucket,
          lastActivityMs,
          now: now.getTime(),
        }),
      },
    ],
    meta: {
      activeRegistrationCount: participationCount,
      totalRounds,
      roundsWithSubmission,
      evaluationSignals,
      lastActivityAt: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
    },
  };
}

function buildSubmissionProgressSummary({ totalRounds, roundsWithSubmission }) {
  if (totalRounds === 0) {
    return "No open rounds to submit to yet.";
  }
  if (roundsWithSubmission === 0) {
    return `0 of ${totalRounds} round${totalRounds === 1 ? "" : "s"} submitted. Make your first submission to score here.`;
  }
  const remaining = totalRounds - roundsWithSubmission;
  if (remaining === 0) {
    return `All ${totalRounds} round${totalRounds === 1 ? "" : "s"} submitted — full marks.`;
  }
  return `${roundsWithSubmission} of ${totalRounds} round${totalRounds === 1 ? "" : "s"} submitted. ${remaining} remaining.`;
}

function buildEvaluationSummary({
  hasAnyEvaluatedSubmission,
  hasAnyShortlisted,
  hasAnyPublishedResults,
}) {
  if (hasAnyPublishedResults) {
    return "Results have been published for at least one of your submissions.";
  }
  if (hasAnyShortlisted) {
    return "Shortlisted in at least one round — strong work.";
  }
  if (hasAnyEvaluatedSubmission) {
    return "Judges have scored your work — keep an eye out for shortlists.";
  }
  return "No evaluations yet. Scores appear once judges review submissions.";
}

function buildRecencySummary({ recencyBucket, lastActivityMs, now }) {
  if (recencyBucket === "this-week" && lastActivityMs) {
    const days = Math.max(0, Math.floor((now - lastActivityMs) / (24 * 60 * 60 * 1000)));
    return `Active in the last ${days === 0 ? "day" : `${days} day${days === 1 ? "" : "s"}`}.`;
  }
  if (recencyBucket === "this-month") {
    return "Active this month — keep the momentum.";
  }
  if (recencyBucket === "this-quarter") {
    return "Last activity was within the last 3 months. Re-engage to refresh your score.";
  }
  if (recencyBucket === "dormant") {
    return "No activity in over a year.";
  }
  return "No activity recorded yet.";
}

function emptyCompetitionScore() {
  return {
    score: 0,
    dimensions: [
      {
        id: "participation",
        label: "Participation",
        points: 0,
        max: POINTS.COMPETITION.PARTICIPATION_MAX,
        band: "none",
        summary: "Sign in and register for a competition to start scoring.",
      },
      {
        id: "submission-progress",
        label: "Submission progress",
        points: 0,
        max: POINTS.COMPETITION.SUBMISSION_PROGRESS_MAX,
        band: "none",
        summary: "No rounds available yet.",
      },
      {
        id: "evaluation",
        label: "Evaluation results",
        points: 0,
        max: POINTS.COMPETITION.EVALUATION_MAX,
        band: "none",
        summary: "No evaluations yet.",
      },
      {
        id: "recency",
        label: "Recent activity",
        points: 0,
        max: POINTS.COMPETITION.RECENCY_MAX,
        band: "none",
        summary: "No activity recorded yet.",
      },
    ],
    meta: {
      activeRegistrationCount: 0,
      totalRounds: 0,
      roundsWithSubmission: 0,
      evaluationSignals: [],
      lastActivityAt: null,
    },
  };
}

// ─── Team Score ───────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {object} args.competitionStore     - for event-scoped teams
 * @param {object} args.persistentTeamStore  - for cross-event squads
 * @param {string} args.userId               - authenticated regNo
 * @param {Date}   [args.now]
 */
function computeTeamScore({
  competitionStore,
  persistentTeamStore,
  userId,
  now = new Date(),
}) {
  if (!userId) return emptyTeamScore();
  const userIdStr = String(userId);
  const myEventTeams = [];
  let eventTeamsLed = 0;
  let eventTeamsAsMember = 0;

  const allEvents = competitionStore.eventsStore?.events || [];
  for (const event of allEvents) {
    const config = safeJsonParse(event.competitionConfig, null);
    if (!config || !config.isCompetition || config.submissionScope !== "team") continue;
    let team;
    try {
      team = competitionStore.getMyTeam(event.id, userIdStr);
    } catch {
      continue;
    }
    if (!team) continue;
    const isLeader = team.leaderId === userIdStr || team.leaderRegNo === userIdStr;
    if (isLeader) eventTeamsLed += 1;
    else eventTeamsAsMember += 1;
    const acceptedCount = Array.isArray(team.members)
      ? team.members.filter((m) => (m?.status || "accepted") === "accepted").length
      : 0;
    myEventTeams.push({
      eventId: event.id,
      eventTitle: event.title,
      teamId: team.id,
      teamName: team.name,
      isLeader,
      acceptedCount,
      memberCount: Array.isArray(team.members) ? team.members.length : 0,
      createdAt: team.createdAt,
    });
  }

  const persistentTeams = persistentTeamStore
    ? persistentTeamStore.listMyTeams(userIdStr)
    : [];
  const persistentLed = persistentTeams.filter(
    (t) => String(t.leaderRegNo || "").toUpperCase() === userIdStr.toUpperCase()
  );
  const persistentAsMember = persistentTeams.filter(
    (t) => String(t.leaderRegNo || "").toUpperCase() !== userIdStr.toUpperCase()
  );

  // Dimension 1: Leadership.
  let leadershipPoints = 0;
  leadershipPoints += Math.min(eventTeamsLed, 2) * 15;
  leadershipPoints += Math.max(0, eventTeamsLed - 2) * 8;
  leadershipPoints += Math.min(persistentLed.length, 2) * 10;
  leadershipPoints += Math.max(0, persistentLed.length - 2) * 5;
  leadershipPoints += Math.min(eventTeamsAsMember, 2) * 5;
  leadershipPoints = clamp(leadershipPoints, 0, POINTS.TEAM.LEADERSHIP_MAX);

  // Dimension 2: Roster health.
  let rosterPoints = 0;
  for (const et of myEventTeams) {
    const n = et.acceptedCount;
    if (n <= 1) rosterPoints += 3;
    else if (n === 2) rosterPoints += 6;
    else if (n === 3) rosterPoints += 9;
    else rosterPoints += 10;
  }
  rosterPoints += Math.min(persistentTeams.length, 3) * 4;
  rosterPoints = clamp(rosterPoints, 0, POINTS.TEAM.ROSTER_MAX);

  // Dimension 3: Engagement breadth.
  let breadthPoints = 0;
  breadthPoints += Math.min(myEventTeams.length, 5) * 5;
  breadthPoints += Math.min(persistentTeams.length, 3) * 5;
  breadthPoints = clamp(breadthPoints, 0, POINTS.TEAM.BREADTH_MAX);

  const total = leadershipPoints + rosterPoints + breadthPoints;

  return {
    score: clamp(total),
    dimensions: [
      {
        id: "leadership",
        label: "Leadership",
        points: leadershipPoints,
        max: POINTS.TEAM.LEADERSHIP_MAX,
        band: bandForScore(leadershipPoints, POINTS.TEAM.LEADERSHIP_MAX),
        summary: buildLeadershipSummary({
          eventTeamsLed,
          eventTeamsAsMember,
          persistentLed: persistentLed.length,
          persistentAsMember: persistentAsMember.length,
        }),
      },
      {
        id: "roster",
        label: "Roster health",
        points: rosterPoints,
        max: POINTS.TEAM.ROSTER_MAX,
        band: bandForScore(rosterPoints, POINTS.TEAM.ROSTER_MAX),
        summary: buildRosterSummary({ myEventTeams, persistentTeams }),
      },
      {
        id: "breadth",
        label: "Engagement breadth",
        points: breadthPoints,
        max: POINTS.TEAM.BREADTH_MAX,
        band: bandForScore(breadthPoints, POINTS.TEAM.BREADTH_MAX),
        summary:
          myEventTeams.length === 0 && persistentTeams.length === 0
            ? "Join a team for any event to start scoring here."
            : `Active in ${myEventTeams.length} event team${myEventTeams.length === 1 ? "" : "s"} and ${persistentTeams.length} persistent squad${persistentTeams.length === 1 ? "" : "s"}.`,
      },
    ],
    meta: {
      eventTeamsLed,
      eventTeamsAsMember,
      persistentLed: persistentLed.length,
      persistentAsMember: persistentAsMember.length,
      eventTeamCount: myEventTeams.length,
      persistentTeamCount: persistentTeams.length,
      lastActivityAt: lastTeamActivityMs({ myEventTeams, persistentTeams, now }),
    },
  };
}

function buildLeadershipSummary({
  eventTeamsLed,
  eventTeamsAsMember,
  persistentLed,
  persistentAsMember,
}) {
  const bits = [];
  if (eventTeamsLed > 0) bits.push(`lead ${eventTeamsLed} event team${eventTeamsLed === 1 ? "" : "s"}`);
  if (eventTeamsAsMember > 0)
    bits.push(`${eventTeamsAsMember} event team${eventTeamsAsMember === 1 ? "" : "s"} as member`);
  if (persistentLed > 0) bits.push(`lead ${persistentLed} persistent squad${persistentLed === 1 ? "" : "s"}`);
  if (persistentAsMember > 0)
    bits.push(`${persistentAsMember} persistent squad${persistentAsMember === 1 ? "" : "s"} as member`);
  if (bits.length === 0) return "Take on a leadership role or join a team to earn points here.";
  const human = bits.length === 1 ? bits[0] : bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1];
  return `You ${human}.`;
}

function buildRosterSummary({ myEventTeams, persistentTeams }) {
  if (myEventTeams.length === 0 && persistentTeams.length === 0) {
    return "No active teams to assess yet.";
  }
  const totalSlots = myEventTeams.reduce((sum, et) => sum + et.acceptedCount, 0);
  const lowTeams = myEventTeams.filter((et) => et.acceptedCount < 2).length;
  if (myEventTeams.length > 0 && lowTeams > 0) {
    return `${totalSlots} accepted member${totalSlots === 1 ? "" : "s"} across teams. ${lowTeams} team${lowTeams === 1 ? "" : "s"} could use more members.`;
  }
  if (myEventTeams.length > 0) {
    return `${totalSlots} accepted member${totalSlots === 1 ? "" : "s"} across ${myEventTeams.length} event team${myEventTeams.length === 1 ? "" : "s"} — rosters look healthy.`;
  }
  return `You are part of ${persistentTeams.length} persistent squad${persistentTeams.length === 1 ? "" : "s"}.`;
}

function lastTeamActivityMs({ myEventTeams, persistentTeams, now }) {
  const candidates = [];
  for (const et of myEventTeams) {
    const ms = safeIsoMs(et.createdAt);
    if (ms) candidates.push(ms);
  }
  for (const t of persistentTeams) {
    const ms = safeIsoMs(t.createdAt);
    if (ms) candidates.push(ms);
  }
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function emptyTeamScore() {
  return {
    score: 0,
    dimensions: [
      {
        id: "leadership",
        label: "Leadership",
        points: 0,
        max: POINTS.TEAM.LEADERSHIP_MAX,
        band: "none",
        summary: "Lead a team to score here.",
      },
      {
        id: "roster",
        label: "Roster health",
        points: 0,
        max: POINTS.TEAM.ROSTER_MAX,
        band: "none",
        summary: "Join a team to score here.",
      },
      {
        id: "breadth",
        label: "Engagement breadth",
        points: 0,
        max: POINTS.TEAM.BREADTH_MAX,
        band: "none",
        summary: "Be in more teams to score here.",
      },
    ],
    meta: {
      eventTeamsLed: 0,
      eventTeamsAsMember: 0,
      persistentLed: 0,
      persistentAsMember: 0,
      eventTeamCount: 0,
      persistentTeamCount: 0,
      lastActivityAt: null,
    },
  };
}

module.exports = {
  computeCompetitionScore,
  computeTeamScore,
  bandLabel,
  POINTS,
};
