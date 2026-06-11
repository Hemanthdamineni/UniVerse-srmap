const { randomUUID } = require("crypto");
const { isRoundOpen, nowIso, safeJsonParse, toFiniteNumber } = require("./utils");

module.exports = {
  _getEvaluations(submissionId) {
    const rows = this.db
      .prepare("SELECT * FROM evaluations WHERE submissionId = ? ORDER BY updatedAt DESC")
      .all(submissionId);
    return rows.map((row) => ({
      ...row,
      criteriaScores: safeJsonParse(row.criteriaScores, {}),
    }));
  },

  _recomputeSubmissionAggregate(submissionId) {
    const aggregate = this.db
      .prepare(
        `SELECT
           AVG(totalScore) AS avgScore,
           MIN(createdAt) AS firstEvaluatedAt,
           MAX(updatedAt) AS lastEvaluatedAt,
           COUNT(*) AS count
         FROM evaluations
         WHERE submissionId = ?`
      )
      .get(submissionId);
    const latest = this.db
      .prepare("SELECT evaluatorId, remarks, decision FROM evaluations WHERE submissionId = ? ORDER BY updatedAt DESC LIMIT 1")
      .get(submissionId);
    this.db
      .prepare(
        `UPDATE submissions
         SET totalScore = ?, evaluatedAt = ?, evaluatedBy = ?, remarks = ?, decision = ?
         WHERE id = ?`
      )
      .run(
        aggregate?.count ? toFiniteNumber(aggregate.avgScore, null) : null,
        aggregate?.count ? String(aggregate.lastEvaluatedAt || nowIso()) : null,
        latest?.evaluatorId || null,
        latest?.remarks || "",
        latest?.decision || "pending",
        submissionId
      );
  },

  getSubmissionsForRound(eventId, roundId, user) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensurePermission(user, event, "canViewAllSubmissions");
    const teamScope = this._getSubmissionScope(event) === "team";
    if (!teamScope) {
      const rows = this.db
        .prepare("SELECT * FROM submissions WHERE eventId = ? AND roundId = ? ORDER BY submittedAt ASC")
        .all(eventId, roundId);
      return rows.map((row) => this._hydrateSubmission(row));
    }
    const rows = this.db
      .prepare(
        `SELECT s.*, t.name AS teamName, t.leaderId AS teamLeaderId, t.members AS teamMembers
         FROM submissions s
         LEFT JOIN teams t ON t.id = s.teamId
         WHERE s.eventId = ? AND s.roundId = ?
           AND s.resubmissionCount = (
             SELECT MAX(s2.resubmissionCount) FROM submissions s2
             WHERE s2.eventId = s.eventId AND s2.roundId = s.roundId AND s2.teamId = s.teamId
           )`
      )
      .all(eventId, roundId);
    return rows.map((row) => {
      const hydrated = this._hydrateSubmission(row);
      const members = safeJsonParse(row.teamMembers, []);
      return {
        ...hydrated,
        teamName: row.teamName || null,
        teamLeaderId: row.teamLeaderId || null,
        teamMembers: Array.isArray(members) ? members : [],
        memberCount: Array.isArray(members) ? members.length : 0,
      };
    });
  },

  evaluateSubmission(submissionId, user, payload) {
    const submission = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
    if (!submission) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    const { event } = this._getRoundOrThrow(submission.eventId, submission.roundId);
    this._ensurePermission(user, event, "canEvaluate");
    if (submission.submittedBy === user.userId) {
      const error = new Error("Conflict of interest.");
      error.status = 403;
      throw error;
    }
    const { round } = this._getRoundOrThrow(submission.eventId, submission.roundId);
    const criteriaScores = payload.criteriaScores || {};
    const allowedCriteria = new Map(
      (Array.isArray(round.evaluationCriteria) ? round.evaluationCriteria : [])
        .filter((criterion) => String(criterion?.label || "").trim())
        .map((criterion) => [String(criterion.label), Math.max(0, toFiniteNumber(criterion.maxScore, 0))])
    );
    for (const [label, value] of Object.entries(criteriaScores)) {
      const max = allowedCriteria.get(String(label));
      if (max === undefined) {
        const error = new Error(`Unknown evaluation criterion: ${label}`);
        error.status = 400;
        throw error;
      }
      const score = toFiniteNumber(value, NaN);
      if (!Number.isFinite(score) || score < 0 || score > max) {
        const error = new Error(`Invalid score for ${label}. Must be between 0 and ${max}.`);
        error.status = 400;
        throw error;
      }
    }
    const totalScore = Object.values(criteriaScores).reduce(
      (sum, score) => sum + toFiniteNumber(score, 0),
      0
    );

    const existing = this.db
      .prepare("SELECT id FROM evaluations WHERE submissionId = ? AND evaluatorId = ?")
      .get(submissionId, user.userId);
    const updatedAt = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE evaluations
           SET criteriaScores = ?, totalScore = ?, remarks = ?, decision = ?, updatedAt = ?
           WHERE submissionId = ? AND evaluatorId = ?`
        )
        .run(
          JSON.stringify(criteriaScores),
          totalScore,
          String(payload.remarks || ""),
          payload.decision || "pending",
          updatedAt,
          submissionId,
          user.userId
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO evaluations (
            id, submissionId, eventId, roundId, evaluatorId, criteriaScores, totalScore, remarks, decision, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          submissionId,
          submission.eventId,
          submission.roundId,
          user.userId,
          JSON.stringify(criteriaScores),
          totalScore,
          String(payload.remarks || ""),
          payload.decision || "pending",
          updatedAt,
          updatedAt
        );
    }
    this._recomputeSubmissionAggregate(submissionId);
    const hydrated = this._hydrateSubmission(this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId));
    hydrated.evaluations = this._getEvaluations(submissionId);
    return hydrated;
  },

  flagSubmission(submissionId, user, payload) {
    const submission = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
    if (!submission) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    const { event } = this._getRoundOrThrow(submission.eventId, submission.roundId);
    this._ensurePermission(user, event, "canEvaluate");
    const flagged = Boolean(payload.flagged);
    this.db
      .prepare("UPDATE submissions SET flagged = ?, flagReason = ? WHERE id = ?")
      .run(flagged ? 1 : 0, flagged ? String(payload.flagReason || "") : "", submissionId);
    return this._hydrateSubmission(this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId));
  },

  applyShortlist(eventId, roundId, user, { mode, value }) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensurePermission(user, event, "canShortlist");
    const evaluated = this.db
      .prepare(
        `SELECT * FROM submissions
         WHERE eventId = ? AND roundId = ? AND totalScore IS NOT NULL
         ORDER BY totalScore DESC, submittedAt ASC`
      )
      .all(eventId, roundId)
      .map((row) => this._hydrateSubmission(row));

    const ids = new Set();
    if (mode === "threshold") {
      const threshold = toFiniteNumber(value, 0);
      for (const row of evaluated) {
        if (toFiniteNumber(row.totalScore, 0) >= threshold) ids.add(row.id);
      }
    } else {
      const topN = Math.max(0, Math.floor(toFiniteNumber(value, 0)));
      for (const row of evaluated.slice(0, topN)) ids.add(row.id);
    }

    for (const row of evaluated) {
      const selected = ids.has(row.id);
      this.db
        .prepare("UPDATE submissions SET shortlisted = ?, decision = ? WHERE id = ?")
        .run(selected ? 1 : 0, selected ? "selected" : "rejected", row.id);
    }

    this.db
      .prepare(
        "UPDATE submissions SET decision = COALESCE(decision, 'pending') WHERE eventId = ? AND roundId = ? AND totalScore IS NULL"
      )
      .run(eventId, roundId);

    return {
      shortlistedCount: ids.size,
      evaluatedCount: evaluated.length,
    };
  },

  publishResults(eventId, roundId, user) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    this._ensurePermission(user, event, "canShortlist");
    this.db
      .prepare("UPDATE rounds SET resultsPublished = 1 WHERE eventId = ? AND roundId = ?")
      .run(eventId, roundId);

    const submissions = this.db
      .prepare(
        `SELECT submittedBy, shortlisted, totalScore, teamId
         FROM submissions WHERE eventId = ? AND roundId = ?`
      )
      .all(eventId, roundId);
    const teamScope = this._getSubmissionScope(event) === "team";
    const shortlistedUsers = [];
    for (const item of submissions) {
      let recipients = [item.submittedBy];
      if (teamScope && item.teamId) {
        const team = this._hydrateTeam(this.db.prepare("SELECT * FROM teams WHERE id = ?").get(item.teamId));
        recipients = Array.isArray(team?.members) ? team.members : recipients;
      }
      if (item.shortlisted) {
        shortlistedUsers.push(...recipients);
        for (const recipient of recipients) {
          this.eventsStore._pushNotification(recipient, {
            type: "competition_results_shortlisted",
            title: "You are shortlisted",
            message: `You have been shortlisted for ${round.title || roundId}.`,
            eventId,
          });
        }
      } else if (item.totalScore === null || item.totalScore === undefined) {
        for (const recipient of recipients) {
          this.eventsStore._pushNotification(recipient, {
            type: "competition_results_not_evaluated",
            title: "Results published",
            message: `Results for ${round.title || roundId} were published. Your submission was not evaluated.`,
            eventId,
          });
        }
      } else {
        for (const recipient of recipients) {
          this.eventsStore._pushNotification(recipient, {
            type: "competition_results_published",
            title: "Results published",
            message: `Results for ${round.title || roundId} have been published.`,
            eventId,
          });
        }
      }
    }
    const unlockedRounds = this.db
      .prepare("SELECT * FROM rounds WHERE eventId = ?")
      .all(eventId)
      .map((row) => this._deserializeRound(row))
      .filter(
      (item) =>
        String(item.roundId) !== String(roundId) &&
        String(item.requiresShortlistFromRound || "") === String(roundId) &&
        isRoundOpen(item)
    );
    for (const nextRound of unlockedRounds) {
      for (const userId of shortlistedUsers) {
        this.eventsStore._pushNotification(userId, {
          type: "competition_next_round_open",
          title: "Next round is open",
          message: `You can now submit for ${nextRound.title || nextRound.roundId}.`,
          eventId,
        });
      }
    }
    this.eventsStore._persistAll();
    return { published: true };
  },

  getSubmissionEvaluations(eventId, roundId, submissionId, user) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensurePermission(user, event, "canEvaluate");
    const submission = this.db
      .prepare("SELECT * FROM submissions WHERE id = ? AND eventId = ? AND roundId = ?")
      .get(submissionId, eventId, roundId);
    if (!submission) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    return {
      submission: this._hydrateSubmission(submission),
      evaluations: this._getEvaluations(submissionId),
    };
  },

  getLeaderboard(eventId, roundId) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    if (!round.resultsPublished) {
      const error = new Error("Leaderboard is available only after results are published.");
      error.status = 403;
      throw error;
    }
    const teamScope = this._getSubmissionScope(event) === "team";
    const rows = this.db
      .prepare(
        `SELECT * FROM submissions
         WHERE eventId = ? AND roundId = ? AND totalScore IS NOT NULL
         ORDER BY totalScore DESC, submittedAt ASC`
      )
      .all(eventId, roundId);
    return rows.map((row, index) => {
      const base = this._hydrateSubmission(row);
      if (!teamScope || !row.teamId) {
        return { rank: index + 1, ...base };
      }
      const team = this._hydrateTeam(this.db.prepare("SELECT * FROM teams WHERE id = ?").get(row.teamId));
      return {
        rank: index + 1,
        ...base,
        teamName: team?.name || null,
        teamMembers: Array.isArray(team?.members) ? team.members : [],
        memberCount: Array.isArray(team?.members) ? team.members.length : 0,
      };
    });
  }
};
