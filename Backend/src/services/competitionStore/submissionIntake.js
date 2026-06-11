const { randomUUID } = require("crypto");
const {
  DEFAULT_MAX_RESUBMISSIONS,
  isAllowedSubmissionMime,
  nowIso,
  safeJsonParse,
  toFiniteNumber,
} = require("./utils");

module.exports = {
  checkRoundAccess(eventId, roundId, userId) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    this._ensureRegistered(eventId, userId);
    const teamScope = this._getSubmissionScope(event) === "team";
    if (!round.requiresShortlistFromRound) return true;
    const requiredRoundId = String(round.requiresShortlistFromRound);
    this._getRoundOrThrow(eventId, requiredRoundId);
    let shortlisted;
    if (teamScope) {
      const team = this.getMyTeam(eventId, userId);
      if (!team) {
        const error = new Error("You must be in a team to submit for this competition");
        error.status = 403;
        throw error;
      }
      shortlisted = this.db
        .prepare(
          `SELECT id FROM submissions
           WHERE eventId = ? AND roundId = ? AND teamId = ? AND shortlisted = 1
           ORDER BY submittedAt DESC LIMIT 1`
        )
        .get(eventId, requiredRoundId, team.id);
    } else {
      shortlisted = this.db
        .prepare(
          `SELECT id FROM submissions
           WHERE eventId = ? AND roundId = ? AND submittedBy = ? AND shortlisted = 1
           ORDER BY submittedAt DESC LIMIT 1`
        )
        .get(eventId, requiredRoundId, userId);
    }
    if (!shortlisted) {
      const error = new Error(`Round access denied: shortlisted users from "${requiredRoundId}" only.`);
      error.status = 403;
      throw error;
    }
    return true;
  },

  checkResubmissionLimit(eventId, roundId, userId) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    const teamScope = this._getSubmissionScope(event) === "team";
    let row;
    if (teamScope) {
      const team = this.getMyTeam(eventId, userId);
      if (!team) {
        const error = new Error("You must be in a team to submit for this competition");
        error.status = 403;
        throw error;
      }
      row = this.db
        .prepare("SELECT COUNT(*) AS count FROM submissions WHERE eventId = ? AND roundId = ? AND teamId = ?")
        .get(eventId, roundId, team.id);
    } else {
      row = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM submissions WHERE eventId = ? AND roundId = ? AND submittedBy = ?"
        )
        .get(eventId, roundId, userId);
    }
    const max = Math.max(1, toFiniteNumber(round.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS));
    if (Number(row?.count || 0) >= max) {
      const error = new Error("Resubmission limit reached.");
      error.status = 429;
      throw error;
    }
    return true;
  },

  checkActiveCompetitionCount(userId) {
    const activeCount = (this.eventsStore.events || []).filter((event) => {
      if (event.createdByUserId !== userId) return false;
      const parsed = safeJsonParse(event.competitionConfig, event.competitionConfig || {});
      if (!parsed?.isCompetition) return false;
      return event.status !== "archived";
    }).length;
    if (activeCount >= 3) {
      const error = new Error("You already have 3 active competitions.");
      error.status = 429;
      throw error;
    }
    return true;
  },

  createSubmission(eventId, roundId, userId, data) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    this.checkRoundAccess(eventId, roundId, userId);
    const teamScope = this._getSubmissionScope(event) === "team";

    const now = Date.now();
    const deadline = new Date(round.submissionDeadline).getTime();
    if (Number.isFinite(deadline) && now > deadline) {
      const error = new Error("Submission deadline has passed.");
      error.status = 403;
      throw error;
    }

    const type = String(data.type || "").toLowerCase();
    if (!["file", "link"].includes(type)) {
      const error = new Error("Invalid submission type");
      error.status = 400;
      throw error;
    }
    if (!round.submissionTypes.includes(type)) {
      const error = new Error("Submission type not allowed for this round");
      error.status = 400;
      throw error;
    }

    if (type === "file") {
      if (!data.filePath) {
        const error = new Error("Submission file is required");
        error.status = 400;
        throw error;
      }
      if (!isAllowedSubmissionMime(data.mimeType)) {
        const error = new Error("File type not allowed.");
        error.status = 400;
        throw error;
      }
    }

    if (type === "link") {
      try {
        const parsed = new URL(String(data.linkUrl || ""));
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
      } catch {
        const error = new Error("Invalid link URL");
        error.status = 400;
        throw error;
      }
    }

    let team = null;
    if (teamScope) {
      team = this.getMyTeam(eventId, userId);
      if (!team) {
        const error = new Error("You must be in a team to submit for this competition");
        error.status = 403;
        throw error;
      }
      if (team.leaderId !== userId) {
        const error = new Error("Only the team leader can submit on behalf of the team");
        error.status = 403;
        throw error;
      }
    }
    this.checkResubmissionLimit(eventId, roundId, userId);
    const currentCountRow = teamScope
      ? this.db
          .prepare("SELECT COUNT(*) AS count FROM submissions WHERE eventId = ? AND roundId = ? AND teamId = ?")
          .get(eventId, roundId, team.id)
      : this.db
          .prepare(
            "SELECT COUNT(*) AS count FROM submissions WHERE eventId = ? AND roundId = ? AND submittedBy = ?"
          )
          .get(eventId, roundId, userId);
    const resubmissionCount = Number(currentCountRow?.count || 0);
    const submittedAt = nowIso();

    const submission = {
      id: randomUUID(),
      eventId,
      roundId,
      submittedBy: userId,
      teamId: teamScope ? team.id : null,
      type,
      filePath: type === "file" ? String(data.filePath) : null,
      linkUrl: type === "link" ? String(data.linkUrl) : null,
      description: String(data.description || "").slice(0, 500),
      submittedAt,
      resubmittedAt: resubmissionCount > 0 ? submittedAt : null,
      resubmissionCount,
    };

    this.db
      .prepare(
        `INSERT INTO submissions (
          id, eventId, roundId, submittedBy, teamId, type, filePath, linkUrl, description,
          submittedAt, resubmittedAt, resubmissionCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        submission.id,
        submission.eventId,
        submission.roundId,
        submission.submittedBy,
        submission.teamId,
        submission.type,
        submission.filePath,
        submission.linkUrl,
        submission.description,
        submission.submittedAt,
        submission.resubmittedAt,
        submission.resubmissionCount
      );

    this.eventsStore._pushNotification(userId, {
      type: "competition_submission_confirmed",
      title: "Submission received",
      message: `Your submission for ${round.title || round.roundId} has been received.`,
      eventId,
    });
    this.eventsStore._persistAll();

    return submission;
  },

  getActiveSubmission(eventId, roundId, userId) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    const teamScope = this._getSubmissionScope(event) === "team";
    let row;
    if (teamScope) {
      const team = this.getMyTeam(eventId, userId);
      if (!team) return null;
      row = this.db
        .prepare(
          `SELECT * FROM submissions
           WHERE eventId = ? AND roundId = ? AND teamId = ?
           ORDER BY resubmissionCount DESC, submittedAt DESC LIMIT 1`
        )
        .get(eventId, roundId, team.id);
    } else {
      row = this.db
        .prepare(
          `SELECT * FROM submissions
           WHERE eventId = ? AND roundId = ? AND submittedBy = ?
           ORDER BY submittedAt DESC LIMIT 1`
        )
        .get(eventId, roundId, userId);
    }
    if (!row) return null;
    return this._hydrateSubmission(row);
  },

  _hydrateSubmission(row) {
    return {
      ...row,
      criteriaScores: safeJsonParse(row.criteriaScores, {}),
      shortlisted: Boolean(row.shortlisted),
      flagged: Boolean(row.flagged),
    };
  },

  getMyResult(eventId, roundId, userId) {
    const { round } = this._getRoundOrThrow(eventId, roundId);
    const submission = this.getActiveSubmission(eventId, roundId, userId);
    if (!submission) return null;
    if (round.resultsPublished) {
      if (typeof submission.totalScore === "number") {
        const ranked = this.db
          .prepare(
            `SELECT id FROM submissions
             WHERE eventId = ? AND roundId = ? AND totalScore IS NOT NULL
             ORDER BY totalScore DESC, submittedAt ASC`
          )
          .all(eventId, roundId);
        const rankIndex = ranked.findIndex((row) => row.id === submission.id);
        return {
          ...submission,
          rank: rankIndex >= 0 ? rankIndex + 1 : null,
        };
      }
      return { ...submission, rank: null };
    }

    const {
      totalScore,
      criteriaScores,
      remarks,
      evaluatedBy,
      evaluatedAt,
      decision,
      shortlisted,
      flagged,
      flagReason,
      ...rest
    } = submission;
    return rest;
  }
};
