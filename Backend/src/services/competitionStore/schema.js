const {
  DEFAULT_MAX_RESUBMISSIONS,
  hasColumn,
  normalizeRound,
  safeJsonParse,
  toFiniteNumber,
} = require("./utils");

module.exports = {
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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_roles (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        regNo TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL,
        assignedBy TEXT NOT NULL,
        assignedAt TEXT NOT NULL,
        UNIQUE (eventId, regNo)
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_event_roles_event ON event_roles(eventId);");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certificate_templates (
        eventId TEXT PRIMARY KEY,
        roundId TEXT,
        templateImagePath TEXT NOT NULL,
        fields TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  },

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
  },

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
  },

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
};
