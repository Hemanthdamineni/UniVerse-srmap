const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_MAX_RESUBMISSIONS = 5;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isAllowedSubmissionMime(mimeType = "") {
  const allowed = new Set([
    "application/pdf",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
  ]);
  return allowed.has(String(mimeType || "").toLowerCase());
}

function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeRound(roundLike) {
  if (!roundLike || typeof roundLike !== "object") return null;
  const round = { ...roundLike };
  round.roundId = String(round.roundId || "").trim();
  if (!round.roundId) return null;
  round.maxResubmissions = Math.max(
    1,
    toFiniteNumber(round.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS)
  );
  round.maxFileSizeMb = Math.max(1, toFiniteNumber(round.maxFileSizeMb, 25));
  round.resultsPublished = Boolean(round.resultsPublished);
  round.submissionTypes = Array.isArray(round.submissionTypes)
    ? round.submissionTypes.map((item) => String(item))
    : ["file", "link"];
  round.evaluationCriteria = Array.isArray(round.evaluationCriteria)
    ? round.evaluationCriteria.map((criterion) => ({
        label: String(criterion?.label || "").trim(),
        maxScore: Math.max(0, toFiniteNumber(criterion?.maxScore, 0)),
      }))
    : [];
  return round;
}

function isRoundOpen(round) {
  const start = new Date(round?.startTime || "").getTime();
  if (!Number.isFinite(start)) return true;
  return Date.now() >= start;
}

function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

class CompetitionStore {
  constructor({ eventsStore, dbPath, submissionsDir }) {
    this.eventsStore = eventsStore;
    this.dbPath = path.resolve(dbPath);
    this.submissionsDir = submissionsDir || path.join(path.dirname(this.dbPath), "submissions");
    this.certificatesDir = path.join(path.dirname(this.dbPath), "certificates");

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.mkdirSync(this.submissionsDir, { recursive: true });
    fs.mkdirSync(this.certificatesDir, { recursive: true });

    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
    this._migrateRoundsFromJson();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        roundId TEXT NOT NULL,
        submittedBy TEXT NOT NULL,
        type TEXT NOT NULL,
        filePath TEXT,
        linkUrl TEXT,
        description TEXT,
        submittedAt TEXT NOT NULL,
        resubmittedAt TEXT,
        resubmissionCount INTEGER DEFAULT 0,
        criteriaScores TEXT,
        totalScore REAL,
        remarks TEXT,
        evaluatedBy TEXT,
        evaluatedAt TEXT,
        decision TEXT,
        shortlisted INTEGER DEFAULT 0,
        flagged INTEGER DEFAULT 0,
        flagReason TEXT,
        UNIQUE (eventId, roundId, submittedBy, resubmissionCount)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_submissions_event_round ON submissions(eventId, roundId);"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_submissions_submittedBy ON submissions(submittedBy);"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(eventId, roundId, totalScore DESC);"
    );
    if (!hasColumn(this.db, "submissions", "teamId")) {
      this.db.exec("ALTER TABLE submissions ADD COLUMN teamId TEXT;");
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        roundId TEXT NOT NULL,
        title TEXT,
        type TEXT,
        startTime TEXT,
        submissionDeadline TEXT,
        instructions TEXT,
        submissionTypes TEXT,
        maxFileSizeMb REAL,
        maxResubmissions INTEGER,
        evaluationCriteria TEXT,
        shortlistCount INTEGER,
        shortlistThreshold REAL,
        requiresShortlistFromRound TEXT,
        resultsPublished INTEGER DEFAULT 0,
        UNIQUE (eventId, roundId)
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_rounds_eventId ON rounds(eventId);");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        name TEXT NOT NULL,
        leaderId TEXT NOT NULL,
        members TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_teams_eventId ON teams(eventId);");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id TEXT PRIMARY KEY,
        teamId TEXT NOT NULL,
        eventId TEXT NOT NULL,
        invitedBy TEXT NOT NULL,
        inviteeRegisterNumber TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        UNIQUE (teamId, inviteeRegisterNumber)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_invitations_invitee_status ON team_invitations(inviteeRegisterNumber, status);"
    );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        submissionId TEXT NOT NULL,
        eventId TEXT NOT NULL,
        roundId TEXT NOT NULL,
        evaluatorId TEXT NOT NULL,
        criteriaScores TEXT NOT NULL,
        totalScore REAL NOT NULL,
        remarks TEXT,
        decision TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE (submissionId, evaluatorId)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON evaluations(submissionId);"
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_evaluations_round ON evaluations(eventId, roundId);"
    );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reminder_marks (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        roundId TEXT NOT NULL,
        userId TEXT NOT NULL,
        marker TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE (eventId, roundId, userId, marker)
      );
    `);
  }

  _getEventOrThrow(eventId) {
    const event = this.eventsStore.eventById?.get(eventId);
    if (!event) {
      const error = new Error("Event not found");
      error.status = 404;
      throw error;
    }
    return event;
  }

  _getCompetitionConfig(event) {
    const parsed = safeJsonParse(event.competitionConfig, event.competitionConfig || {});
    if (!parsed || !parsed.isCompetition) {
      const error = new Error("Competition config not found");
      error.status = 400;
      throw error;
    }
    const rounds = Array.isArray(parsed.rounds)
      ? parsed.rounds.map(normalizeRound).filter(Boolean)
      : [];
    return { ...parsed, rounds };
  }

  _setCompetitionConfig(eventId, config) {
    const event = this._getEventOrThrow(eventId);
    event.competitionConfig = JSON.stringify(config);
    event.updatedAt = nowIso();
    this.eventsStore._persistAll();
  }

  _migrateRoundsFromJson() {
    const events = Array.isArray(this.eventsStore.events)
      ? this.eventsStore.events
      : Array.from(this.eventsStore.eventById?.values?.() || []);
    for (const event of events) {
      let config;
      try {
        config = this._getCompetitionConfig(event);
      } catch {
        continue;
      }
      const rounds = Array.isArray(config.rounds) ? config.rounds : [];
      for (const rawRound of rounds) {
        const round = normalizeRound(rawRound);
        if (!round) continue;
        this.db
          .prepare(
            `INSERT OR IGNORE INTO rounds (
              id, eventId, roundId, title, type, startTime, submissionDeadline, instructions,
              submissionTypes, maxFileSizeMb, maxResubmissions, evaluationCriteria,
              shortlistCount, shortlistThreshold, requiresShortlistFromRound, resultsPublished
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            `${event.id}:${round.roundId}`,
            event.id,
            round.roundId,
            String(round.title || ""),
            String(round.type || "submission"),
            String(round.startTime || ""),
            String(round.submissionDeadline || ""),
            String(round.instructions || ""),
            JSON.stringify(Array.isArray(round.submissionTypes) ? round.submissionTypes : ["file", "link"]),
            toFiniteNumber(round.maxFileSizeMb, 25),
            Math.max(1, toFiniteNumber(round.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS)),
            JSON.stringify(Array.isArray(round.evaluationCriteria) ? round.evaluationCriteria : []),
            round.shortlistCount === null || round.shortlistCount === undefined
              ? null
              : Math.floor(toFiniteNumber(round.shortlistCount, 0)),
            round.shortlistThreshold === null || round.shortlistThreshold === undefined
              ? null
              : toFiniteNumber(round.shortlistThreshold, 0),
            round.requiresShortlistFromRound ? String(round.requiresShortlistFromRound) : null,
            round.resultsPublished ? 1 : 0
          );
      }
    }
  }

  _syncEventRoundsFromConfig(event) {
    let config;
    try {
      config = this._getCompetitionConfig(event);
    } catch {
      return;
    }
    const rounds = Array.isArray(config.rounds) ? config.rounds : [];
    for (const rawRound of rounds) {
      const round = normalizeRound(rawRound);
      if (!round) continue;
      this.db
        .prepare(
          `INSERT OR IGNORE INTO rounds (
            id, eventId, roundId, title, type, startTime, submissionDeadline, instructions,
            submissionTypes, maxFileSizeMb, maxResubmissions, evaluationCriteria,
            shortlistCount, shortlistThreshold, requiresShortlistFromRound, resultsPublished
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          `${event.id}:${round.roundId}`,
          event.id,
          round.roundId,
          String(round.title || ""),
          String(round.type || "submission"),
          String(round.startTime || ""),
          String(round.submissionDeadline || ""),
          String(round.instructions || ""),
          JSON.stringify(Array.isArray(round.submissionTypes) ? round.submissionTypes : ["file", "link"]),
          toFiniteNumber(round.maxFileSizeMb, 25),
          Math.max(1, toFiniteNumber(round.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS)),
          JSON.stringify(Array.isArray(round.evaluationCriteria) ? round.evaluationCriteria : []),
          round.shortlistCount === null || round.shortlistCount === undefined
            ? null
            : Math.floor(toFiniteNumber(round.shortlistCount, 0)),
          round.shortlistThreshold === null || round.shortlistThreshold === undefined
            ? null
            : toFiniteNumber(round.shortlistThreshold, 0),
          round.requiresShortlistFromRound ? String(round.requiresShortlistFromRound) : null,
          round.resultsPublished ? 1 : 0
        );
    }
  }

  _deserializeRound(row) {
    return normalizeRound({
      roundId: row.roundId,
      title: row.title,
      type: row.type,
      startTime: row.startTime,
      submissionDeadline: row.submissionDeadline,
      instructions: row.instructions,
      submissionTypes: safeJsonParse(row.submissionTypes, ["file", "link"]),
      maxFileSizeMb: toFiniteNumber(row.maxFileSizeMb, 25),
      maxResubmissions: Math.max(1, toFiniteNumber(row.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS)),
      evaluationCriteria: safeJsonParse(row.evaluationCriteria, []),
      shortlistCount:
        row.shortlistCount === null || row.shortlistCount === undefined
          ? null
          : Math.floor(toFiniteNumber(row.shortlistCount, 0)),
      shortlistThreshold:
        row.shortlistThreshold === null || row.shortlistThreshold === undefined
          ? null
          : toFiniteNumber(row.shortlistThreshold, 0),
      requiresShortlistFromRound: row.requiresShortlistFromRound || null,
      resultsPublished: Boolean(row.resultsPublished),
    });
  }

  _getRoundOrThrow(eventId, roundId) {
    const event = this._getEventOrThrow(eventId);
    this._syncEventRoundsFromConfig(event);
    this._getCompetitionConfig(event);
    const row = this.db
      .prepare("SELECT * FROM rounds WHERE eventId = ? AND roundId = ?")
      .get(eventId, roundId);
    const round = row ? this._deserializeRound(row) : null;
    if (!round) {
      const error = new Error("Round not found");
      error.status = 404;
      throw error;
    }
    return { event, round };
  }

  _ensureCanManageEvent(user, event) {
    const coOrganizers = Array.isArray(event.coOrganizers) ? event.coOrganizers.map(String) : [];
    const allowed =
      event.createdByUserId === user.userId ||
      coOrganizers.includes(user.userId) ||
      ["admin", "event_coordinator"].includes(user.role);
    if (!allowed) {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    }
  }

  _ensureRegistered(eventId, userId) {
    const registration = (this.eventsStore.registrationsByEvent.get(eventId) || []).find(
      (item) => item.userId === userId && item.status === "registered"
    );
    if (!registration) {
      const error = new Error("You are not registered for this event");
      error.status = 403;
      throw error;
    }
    return registration;
  }

  _getSubmissionScope(event) {
    const config = this._getCompetitionConfig(event);
    return String(config.submissionScope || "individual");
  }

  _getMaxTeamSize(event) {
    const config = this._getCompetitionConfig(event);
    return Math.max(1, Math.floor(toFiniteNumber(config.maxTeamSize, 4)));
  }

  _requireTeamScopedEvent(event) {
    if (this._getSubmissionScope(event) !== "team") {
      const error = new Error("This competition does not support team submissions");
      error.status = 400;
      throw error;
    }
  }

  _hydrateTeam(row) {
    return row
      ? {
          ...row,
          members: Array.isArray(row.members) ? row.members : safeJsonParse(row.members, []),
        }
      : null;
  }

  getMyTeam(eventId, userId) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    const row = this.db
      .prepare(
        `SELECT t.*
         FROM teams t, json_each(t.members) m
         WHERE t.eventId = ? AND m.value = ?
         LIMIT 1`
      )
      .get(eventId, userId);
    return this._hydrateTeam(row);
  }

  createTeam(eventId, userId, { name }) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    this._ensureRegistered(eventId, userId);
    const trimmedName = String(name || "").trim();
    if (!trimmedName || trimmedName.length > 100) {
      const error = new Error("Team name must be between 1 and 100 characters");
      error.status = 400;
      throw error;
    }
    if (this.getMyTeam(eventId, userId)) {
      const error = new Error("You are already in a team for this event");
      error.status = 409;
      throw error;
    }
    const team = {
      id: randomUUID(),
      eventId,
      name: trimmedName,
      leaderId: userId,
      members: [userId],
      createdAt: nowIso(),
    };
    this.db
      .prepare("INSERT INTO teams (id, eventId, name, leaderId, members, createdAt) VALUES (?, ?, ?, ?, ?, ?)")
      .run(team.id, team.eventId, team.name, team.leaderId, JSON.stringify(team.members), team.createdAt);
    return team;
  }

  inviteMember(eventId, teamId, leaderId, { inviteeRegisterNumber }) {
    const event = this._getEventOrThrow(eventId);
    this._requireTeamScopedEvent(event);
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can send invitations");
      error.status = 403;
      throw error;
    }
    const invitee = String(inviteeRegisterNumber || "").trim();
    if (!invitee) {
      const error = new Error("Invitee register number is required");
      error.status = 400;
      throw error;
    }
    const registration = (this.eventsStore.registrationsByEvent.get(eventId) || []).find(
      (item) => item.userId === invitee && item.status === "registered"
    );
    if (!registration) {
      const error = new Error("Invitee is not registered for this event");
      error.status = 404;
      throw error;
    }
    if (this.getMyTeam(eventId, invitee)) {
      const error = new Error("Invitee is already in a team for this event");
      error.status = 409;
      throw error;
    }
    if (team.members.length >= this._getMaxTeamSize(event)) {
      const error = new Error("Team is already at maximum size");
      error.status = 409;
      throw error;
    }
    const invitation = {
      id: randomUUID(),
      teamId: team.id,
      eventId,
      invitedBy: leaderId,
      inviteeRegisterNumber: invitee,
      status: "pending",
      createdAt: nowIso(),
    };
    try {
      this.db
        .prepare(
          "INSERT INTO team_invitations (id, teamId, eventId, invitedBy, inviteeRegisterNumber, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          invitation.id,
          invitation.teamId,
          invitation.eventId,
          invitation.invitedBy,
          invitation.inviteeRegisterNumber,
          invitation.status,
          invitation.createdAt
        );
    } catch {
      const error = new Error("Invitation already sent to this participant");
      error.status = 409;
      throw error;
    }
    this.eventsStore._pushNotification(invitee, {
      type: "team_invitation",
      title: "Team invitation",
      message: `You have been invited to join team ${team.name} for ${event.title}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return invitation;
  }

  cancelInvitation(eventId, teamId, leaderId, inviteeRegisterNumber) {
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can cancel invitations");
      error.status = 403;
      throw error;
    }
    this.db
      .prepare(
        "UPDATE team_invitations SET status = 'cancelled' WHERE teamId = ? AND eventId = ? AND inviteeRegisterNumber = ? AND status = 'pending'"
      )
      .run(teamId, eventId, String(inviteeRegisterNumber || ""));
    return { cancelled: true };
  }

  acceptInvitation(eventId, invitationId, userId) {
    const invitation = this.db
      .prepare("SELECT * FROM team_invitations WHERE id = ? AND eventId = ?")
      .get(invitationId, eventId);
    if (!invitation || invitation.inviteeRegisterNumber !== userId) {
      const error = new Error("Invitation not found");
      error.status = 404;
      throw error;
    }
    if (invitation.status !== "pending") {
      const error = new Error("Invitation is no longer pending");
      error.status = 409;
      throw error;
    }
    if (this.getMyTeam(eventId, userId)) {
      const error = new Error("You are already in a team for this event");
      error.status = 409;
      throw error;
    }
    const team = this._hydrateTeam(this.db.prepare("SELECT * FROM teams WHERE id = ?").get(invitation.teamId));
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    const event = this._getEventOrThrow(eventId);
    if (team.members.length >= this._getMaxTeamSize(event)) {
      const error = new Error("Team is already at maximum size");
      error.status = 409;
      throw error;
    }
    const members = Array.from(new Set([...team.members, userId]));
    this.db.prepare("UPDATE team_invitations SET status = 'accepted' WHERE id = ?").run(invitationId);
    this.db.prepare("UPDATE teams SET members = ? WHERE id = ?").run(JSON.stringify(members), team.id);
    this.eventsStore._pushNotification(team.leaderId, {
      type: "team_member_joined",
      title: "Member joined team",
      message: `${userId} has joined your team ${team.name}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return { accepted: true };
  }

  declineInvitation(eventId, invitationId, userId) {
    const invitation = this.db
      .prepare("SELECT * FROM team_invitations WHERE id = ? AND eventId = ?")
      .get(invitationId, eventId);
    if (!invitation || invitation.inviteeRegisterNumber !== userId) {
      const error = new Error("Invitation not found");
      error.status = 404;
      throw error;
    }
    if (invitation.status !== "pending") {
      const error = new Error("Invitation is no longer pending");
      error.status = 409;
      throw error;
    }
    this.db.prepare("UPDATE team_invitations SET status = 'declined' WHERE id = ?").run(invitationId);
    return { declined: true };
  }

  transferLeadership(eventId, teamId, currentLeaderId, newLeaderId) {
    const event = this._getEventOrThrow(eventId);
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== currentLeaderId) {
      const error = new Error("Only the team leader can transfer leadership");
      error.status = 403;
      throw error;
    }
    if (!team.members.includes(newLeaderId)) {
      const error = new Error("New leader must already be a team member");
      error.status = 400;
      throw error;
    }
    this.db.prepare("UPDATE teams SET leaderId = ? WHERE id = ?").run(newLeaderId, team.id);
    this.eventsStore._pushNotification(newLeaderId, {
      type: "team_leader_transfer",
      title: "Leadership transferred",
      message: `You are now the leader of team ${team.name} for ${event.title}.`,
      eventId,
    });
    this.eventsStore._persistAll();
    return { transferred: true };
  }

  leaveTeam(eventId, userId) {
    const team = this.getMyTeam(eventId, userId);
    if (!team) {
      const error = new Error("You are not in a team for this event");
      error.status = 404;
      throw error;
    }
    if (team.leaderId === userId) {
      const error = new Error("Team leader cannot leave without transferring leadership first");
      error.status = 403;
      throw error;
    }
    const hasSubmission = this.db
      .prepare("SELECT id FROM submissions WHERE eventId = ? AND teamId = ? LIMIT 1")
      .get(eventId, team.id);
    if (hasSubmission) {
      const error = new Error("Cannot leave team after a submission has been made");
      error.status = 409;
      throw error;
    }
    const members = team.members.filter((item) => item !== userId);
    this.db.prepare("UPDATE teams SET members = ? WHERE id = ?").run(JSON.stringify(members), team.id);
    return { left: true };
  }

  deleteTeam(eventId, teamId, leaderId) {
    const team = this._hydrateTeam(
      this.db.prepare("SELECT * FROM teams WHERE id = ? AND eventId = ?").get(teamId, eventId)
    );
    if (!team) {
      const error = new Error("Team not found");
      error.status = 404;
      throw error;
    }
    if (team.leaderId !== leaderId) {
      const error = new Error("Only the team leader can delete the team");
      error.status = 403;
      throw error;
    }
    const hasSubmission = this.db
      .prepare("SELECT id FROM submissions WHERE eventId = ? AND teamId = ? LIMIT 1")
      .get(eventId, team.id);
    if (hasSubmission) {
      const error = new Error("Cannot delete team after a submission has been made");
      error.status = 409;
      throw error;
    }
    this.db.prepare("DELETE FROM team_invitations WHERE teamId = ?").run(team.id);
    this.db.prepare("DELETE FROM teams WHERE id = ?").run(team.id);
    return { deleted: true };
  }

  getMyInvitations(eventId, userId) {
    const rows = this.db
      .prepare(
        `SELECT ti.*, t.name AS teamName
         FROM team_invitations ti
         JOIN teams t ON t.id = ti.teamId
         WHERE ti.eventId = ? AND ti.inviteeRegisterNumber = ? AND ti.status = 'pending'`
      )
      .all(eventId, userId);
    return rows;
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  _hydrateSubmission(row) {
    return {
      ...row,
      criteriaScores: safeJsonParse(row.criteriaScores, {}),
      shortlisted: Boolean(row.shortlisted),
      flagged: Boolean(row.flagged),
    };
  }

  _getEvaluations(submissionId) {
    const rows = this.db
      .prepare("SELECT * FROM evaluations WHERE submissionId = ? ORDER BY updatedAt DESC")
      .all(submissionId);
    return rows.map((row) => ({
      ...row,
      criteriaScores: safeJsonParse(row.criteriaScores, {}),
    }));
  }

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
  }

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

  getSubmissionsForRound(eventId, roundId, user) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensureCanManageEvent(user, event);
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
  }

  evaluateSubmission(submissionId, user, payload) {
    const submission = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
    if (!submission) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    const { event } = this._getRoundOrThrow(submission.eventId, submission.roundId);
    this._ensureCanManageEvent(user, event);
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
  }

  flagSubmission(submissionId, user, payload) {
    const submission = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId);
    if (!submission) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    const { event } = this._getRoundOrThrow(submission.eventId, submission.roundId);
    this._ensureCanManageEvent(user, event);
    const flagged = Boolean(payload.flagged);
    this.db
      .prepare("UPDATE submissions SET flagged = ?, flagReason = ? WHERE id = ?")
      .run(flagged ? 1 : 0, flagged ? String(payload.flagReason || "") : "", submissionId);
    return this._hydrateSubmission(this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId));
  }

  applyShortlist(eventId, roundId, user, { mode, value }) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensureCanManageEvent(user, event);
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
  }

  publishResults(eventId, roundId, user) {
    const { event, round } = this._getRoundOrThrow(eventId, roundId);
    this._ensureCanManageEvent(user, event);
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
  }

  sendOrganizerAnnouncement(eventId, user, payload) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    this._getCompetitionConfig(event);
    const subject = String(payload?.subject || "").trim();
    const message = String(payload?.message || "").trim();
    if (!subject || !message) {
      const error = new Error("Subject and message are required.");
      error.status = 400;
      throw error;
    }
    const notifications = this.eventsStore.sendBulkMessage(eventId, { user, subject, message });
    return { sentCount: Array.isArray(notifications) ? notifications.length : 0 };
  }

  getCompetitionConfig(eventId) {
    const event = this._getEventOrThrow(eventId);
    this._syncEventRoundsFromConfig(event);
    const config = this._getCompetitionConfig(event);
    const rounds = this.db
      .prepare("SELECT * FROM rounds WHERE eventId = ? ORDER BY roundId ASC")
      .all(eventId)
      .map((row) => this._deserializeRound(row));
    return {
      ...config,
      rounds,
      maxTeamSize: Math.max(1, Math.floor(toFiniteNumber(config.maxTeamSize, 4))),
    };
  }

  getSubmissionEvaluations(eventId, roundId, submissionId, user) {
    const { event } = this._getRoundOrThrow(eventId, roundId);
    this._ensureCanManageEvent(user, event);
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
  }

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

  getCompetitionAnalytics(eventId, user) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    const config = this.getCompetitionConfig(eventId);
    const registrations = (this.eventsStore.registrationsByEvent.get(eventId) || []).filter(
      (item) => item.status === "registered"
    );
    const regCount = registrations.length;
    const rounds = (config.rounds || []).map((round) => {
      const submissions = this.db
        .prepare("SELECT * FROM submissions WHERE eventId = ? AND roundId = ?")
        .all(eventId, round.roundId);
      const latestKey = new Set();
      for (const submission of submissions) {
        const identity = submission.teamId || submission.submittedBy;
        const key = `${identity}:${submission.resubmissionCount}`;
        latestKey.add(key);
      }
      const submittedCount = latestKey.size;
      const evaluatedCount = submissions.filter((item) => typeof item.totalScore === "number").length;
      const evalTimes = submissions
        .filter((item) => item.evaluatedAt && item.submittedAt)
        .map((item) => Math.max(0, new Date(item.evaluatedAt).getTime() - new Date(item.submittedAt).getTime()));
      const avgTimeMs = evalTimes.length
        ? Math.round(evalTimes.reduce((sum, value) => sum + value, 0) / evalTimes.length)
        : null;
      return {
        roundId: round.roundId,
        title: round.title || round.roundId,
        submissions: submittedCount,
        submissionRate: regCount > 0 ? Number(((submittedCount / regCount) * 100).toFixed(2)) : 0,
        evaluationCompletion:
          submittedCount > 0 ? Number(((evaluatedCount / submittedCount) * 100).toFixed(2)) : 0,
        averageTimeToEvaluateMs: avgTimeMs,
      };
    });
    return {
      registrations: regCount,
      rounds,
    };
  }

  processDeadlineReminders() {
    const now = Date.now();
    const events = Array.from(this.eventsStore.eventById?.values?.() || []);
    let sent = 0;
    for (const event of events) {
      let config;
      try {
        config = this.getCompetitionConfig(event.id);
      } catch {
        continue;
      }
      const registrations = (this.eventsStore.registrationsByEvent.get(event.id) || []).filter(
        (item) => item.status === "registered"
      );
      for (const round of config.rounds || []) {
        const deadlineMs = new Date(round.submissionDeadline || "").getTime();
        if (!Number.isFinite(deadlineMs)) continue;
        const diff = deadlineMs - now;
        const windows = [
          { marker: "24h", min: 23 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 + 5 * 60 * 1000 },
          { marker: "1h", min: 50 * 60 * 1000, max: 60 * 60 * 1000 + 5 * 60 * 1000 },
        ];
        for (const window of windows) {
          if (diff < window.min || diff > window.max) continue;
          for (const registration of registrations) {
            const userId = registration.userId;
            const already = this.db
              .prepare(
                "SELECT id FROM reminder_marks WHERE eventId = ? AND roundId = ? AND userId = ? AND marker = ?"
              )
              .get(event.id, round.roundId, userId, window.marker);
            if (already) continue;
            this.db
              .prepare(
                "INSERT INTO reminder_marks (id, eventId, roundId, userId, marker, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
              )
              .run(randomUUID(), event.id, round.roundId, userId, window.marker, nowIso());
            this.eventsStore._pushNotification(userId, {
              type: "competition_deadline_reminder",
              title: window.marker === "24h" ? "Submission deadline tomorrow" : "Submission closes in 1 hour",
              message:
                window.marker === "24h"
                  ? `Reminder: ${round.title || round.roundId} submission deadline is tomorrow.`
                  : `Final reminder: ${round.title || round.roundId} closes in 1 hour.`,
              eventId: event.id,
            });
            sent += 1;
          }
        }
      }
    }
    if (sent > 0) this.eventsStore._persistAll();
    return { sent };
  }

  _buildSimplePdf(lines) {
    const body = lines.map((line) => String(line || "").replace(/[()]/g, "")).join("\\n");
    const stream = `BT /F1 18 Tf 70 760 Td (${body}) Tj ET`;
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${object}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  generateCertificates(eventId, roundId, user) {
    const event = this._getEventOrThrow(eventId);
    this._ensureCanManageEvent(user, event);
    const leaderboard = this.getLeaderboard(eventId, roundId);
    const generated = [];
    for (const row of leaderboard) {
      const recipients = row.teamMembers?.length ? row.teamMembers : [row.submittedBy];
      for (const recipient of recipients) {
        const fileName = `${eventId}_${roundId}_${recipient}.pdf`;
        const filePath = path.join(this.certificatesDir, fileName);
        const buffer = this._buildSimplePdf([
          "Certificate of Participation",
          `Participant: ${recipient}`,
          `Competition: ${event.title}`,
          `Round: ${roundId}`,
          `Result: ${row.decision || "participated"}`,
          `Score: ${row.totalScore ?? "N/A"}`,
          `Rank: ${row.rank}`,
        ]);
        fs.writeFileSync(filePath, buffer);
        generated.push({
          userId: recipient,
          fileName,
          filePath: `certificates/${fileName}`,
        });
      }
    }
    return { generatedCount: generated.length, certificates: generated };
  }

  getMyCertificate(eventId, roundId, userId) {
    const fileName = `${eventId}_${roundId}_${userId}.pdf`;
    const fullPath = path.join(this.certificatesDir, fileName);
    if (!fs.existsSync(fullPath)) {
      const error = new Error("Certificate not found");
      error.status = 404;
      throw error;
    }
    return { fileName, filePath: `certificates/${fileName}` };
  }
}

function createCompetitionStore(args) {
  return new CompetitionStore(args);
}

module.exports = {
  CompetitionStore,
  createCompetitionStore,
  isAllowedSubmissionMime,
};
