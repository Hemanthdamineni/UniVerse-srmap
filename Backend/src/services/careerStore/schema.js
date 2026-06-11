const { randomUUID } = require("crypto");
const { nowIso } = require("./utils");

module.exports = {
  _migrateFtsToRowidModel() {
    try {
      const row = this.db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='career_search'")
        .get();
      const needsRebuild =
        !row ||
        (typeof row.sql === "string" && /content_rowid\s*=\s*['"]id['"]/i.test(row.sql));
      if (!needsRebuild) return;
      this.db.exec(`
        DROP TRIGGER IF EXISTS career_opportunities_ai;
        DROP TRIGGER IF EXISTS career_opportunities_ad;
        DROP TRIGGER IF EXISTS career_opportunities_au;
        DROP TABLE IF EXISTS career_search;
      `);
    } catch {
      // ignore migration errors on empty/partial DB
    }
  },

  _rebuildCareerSearchFts() {
    try {
      const has = this.db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='career_search'")
        .get();
      if (!has) return;
      this.db.exec("DELETE FROM career_search");
      this.db.exec(`
        INSERT INTO career_search(rowid, title, description, skills, tags, company, organizer)
        SELECT rowid, title, description, skills, tags, company, organizer FROM career_opportunities
      `);
    } catch {
      // ignore if FTS not yet created
    }
  },

  _migrateSkillGapsGapLevel() {
    try {
      this.db.exec("ALTER TABLE career_skill_gaps ADD COLUMN gapLevel TEXT DEFAULT 'missing'");
    } catch {
      // column already exists
    }
  },

  _migrateCareerOpportunitiesLifecycle() {
    try {
      this.db.exec("ALTER TABLE career_opportunities ADD COLUMN status TEXT DEFAULT 'active'");
    } catch {}
    try {
      this.db.exec("ALTER TABLE career_opportunities ADD COLUMN expiredAt TEXT");
    } catch {}
    try {
      this.db.exec("ALTER TABLE career_opportunities ADD COLUMN archivedAt TEXT");
    } catch {}
  },

  _migrateCareerSubmissionGovernance() {
    for (const statement of [
      "ALTER TABLE career_submissions ADD COLUMN reviewedBy TEXT",
      "ALTER TABLE career_submissions ADD COLUMN reviewReason TEXT",
      "ALTER TABLE career_submissions ADD COLUMN publishedOpportunityId TEXT",
      "ALTER TABLE career_submissions ADD COLUMN fingerprint TEXT",
    ]) {
      try {
        this.db.exec(statement);
      } catch {}
    }
  },

  _ensureSchema() {
    this._migrateFtsToRowidModel();
    this._migrateCareerOpportunitiesLifecycle();
    this._migrateSkillGapsGapLevel();
    this._migrateCareerSubmissionGovernance();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS career_opportunities (
        id              TEXT PRIMARY KEY,
        type            TEXT NOT NULL CHECK(type IN ('job','internship','hackathon','competition','fellowship','workshop')),
        title           TEXT NOT NULL,
        company         TEXT,
        organizer       TEXT,
        description     TEXT,
        shortDescription TEXT,
        requirements    TEXT,
        skills          TEXT DEFAULT '[]',
        tags            TEXT DEFAULT '[]',
        location        TEXT,
        mode            TEXT CHECK(mode IN ('remote','onsite','hybrid','online','offline')),
        isPanIndia      INTEGER DEFAULT 0,
        eligibleBranches TEXT DEFAULT '[]',
        eligibleYears    TEXT DEFAULT '[]',
        minCGPA         REAL,
        stipend         TEXT,
        prize           TEXT,
        isFree          INTEGER DEFAULT 1,
        postedAt        TEXT,
        deadline        TEXT,
        startDate       TEXT,
        duration        TEXT,
        source          TEXT NOT NULL,
        sourceUrl       TEXT NOT NULL UNIQUE,
        sources         TEXT DEFAULT '[]',
        fingerprint     TEXT,
        applyUrl        TEXT,
        viewCount       INTEGER DEFAULT 0,
        bookmarkCount   INTEGER DEFAULT 0,
        applyCount      INTEGER DEFAULT 0,
        relevanceScore  REAL DEFAULT 0,
        isActive        INTEGER DEFAULT 1,
        isVerified      INTEGER DEFAULT 0,
        isFeatured      INTEGER DEFAULT 0,
        moderationState INTEGER DEFAULT 0,
        scrapedAt       TEXT NOT NULL,
        updatedAt       TEXT,
        status          TEXT DEFAULT 'active',
        expiredAt       TEXT,
        archivedAt      TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_career_type        ON career_opportunities(type);
      CREATE INDEX IF NOT EXISTS idx_career_deadline    ON career_opportunities(deadline);
      CREATE INDEX IF NOT EXISTS idx_career_active      ON career_opportunities(isActive);
      CREATE INDEX IF NOT EXISTS idx_career_source      ON career_opportunities(source);
      CREATE INDEX IF NOT EXISTS idx_career_posted      ON career_opportunities(postedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_career_relevance   ON career_opportunities(relevanceScore DESC);
      CREATE INDEX IF NOT EXISTS idx_career_fingerprint ON career_opportunities(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_career_deadline_active ON career_opportunities(deadline, isActive);

      CREATE TABLE IF NOT EXISTS career_bookmarks (
        opportunityId  TEXT NOT NULL,
        userId         TEXT NOT NULL,
        createdAt      TEXT NOT NULL,
        PRIMARY KEY (opportunityId, userId)
      );

      CREATE TABLE IF NOT EXISTS career_applications (
        id             TEXT PRIMARY KEY,
        opportunityId  TEXT NOT NULL,
        userId         TEXT NOT NULL,
        status         TEXT DEFAULT 'applied',
        appliedAt      TEXT NOT NULL,
        notes          TEXT,
        updatedAt      TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_career_apps_user ON career_applications(userId);

      CREATE TABLE IF NOT EXISTS career_flags (
        id             TEXT PRIMARY KEY,
        opportunityId  TEXT NOT NULL,
        userId         TEXT NOT NULL,
        reason         TEXT,
        createdAt      TEXT NOT NULL,
        UNIQUE (opportunityId, userId)
      );

      CREATE TABLE IF NOT EXISTS career_dismissals (
        opportunityId  TEXT NOT NULL,
        userId         TEXT NOT NULL,
        createdAt      TEXT NOT NULL,
        PRIMARY KEY (opportunityId, userId)
      );

      CREATE TABLE IF NOT EXISTS career_views (
        opportunityId  TEXT NOT NULL,
        userId         TEXT NOT NULL,
        viewedAt       TEXT NOT NULL,
        PRIMARY KEY (opportunityId, userId)
      );

      CREATE TABLE IF NOT EXISTS career_submissions (
        id             TEXT PRIMARY KEY,
        submittedBy    TEXT NOT NULL,
        status         TEXT DEFAULT 'pending',
        reviewedAt     TEXT,
        reviewedBy     TEXT,
        reviewReason   TEXT,
        publishedOpportunityId TEXT,
        fingerprint    TEXT,
        type           TEXT NOT NULL,
        title          TEXT NOT NULL,
        company        TEXT,
        organizer      TEXT,
        description    TEXT,
        skills         TEXT DEFAULT '[]',
        tags           TEXT DEFAULT '[]',
        location       TEXT,
        mode           TEXT,
        eligibleBranches TEXT DEFAULT '[]',
        eligibleYears  TEXT DEFAULT '[]',
        stipend        TEXT,
        prize          TEXT,
        deadline       TEXT,
        startDate      TEXT,
        applyUrl       TEXT NOT NULL,
        createdAt      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_submission_audit (
        id             TEXT PRIMARY KEY,
        submissionId   TEXT NOT NULL,
        action         TEXT NOT NULL,
        actorId        TEXT NOT NULL,
        fromStatus     TEXT,
        toStatus       TEXT,
        reason         TEXT,
        metadata       TEXT DEFAULT '{}',
        createdAt      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_career_submissions_status_created ON career_submissions(status, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_career_submissions_submitter ON career_submissions(submittedBy, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_career_submissions_fingerprint ON career_submissions(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_career_submission_audit_submission ON career_submission_audit(submissionId, createdAt DESC);

      CREATE TABLE IF NOT EXISTS career_scraper_runs (
        id             TEXT PRIMARY KEY,
        source         TEXT NOT NULL,
        startedAt      TEXT NOT NULL,
        completedAt    TEXT,
        status         TEXT DEFAULT 'running',
        newCount       INTEGER DEFAULT 0,
        updatedCount   INTEGER DEFAULT 0,
        expiredCount   INTEGER DEFAULT 0,
        errorMessage   TEXT,
        durationMs     INTEGER
      );

      CREATE TABLE IF NOT EXISTS career_source_health (
        source              TEXT PRIMARY KEY,
        lastSuccess         TEXT,
        lastAttempt         TEXT,
        consecutiveFails    INTEGER DEFAULT 0,
        isBlocked           INTEGER DEFAULT 0,
        notes               TEXT
      );

      CREATE TABLE IF NOT EXISTS career_profiles (
        userId              TEXT PRIMARY KEY,
        skills              TEXT DEFAULT '[]',
        preferredTypes      TEXT DEFAULT '[]',
        preferredLocations  TEXT DEFAULT '[]',
        minStipend          TEXT,
        cgpa                REAL,
        bio                 TEXT,
        linkedinUrl         TEXT,
        githubUrl           TEXT,
        portfolioUrl        TEXT,
        resumeUrl           TEXT,
        resumeFileName      TEXT,
        updatedAt           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_skill_gaps (
        userId              TEXT NOT NULL,
        skill               TEXT NOT NULL,
        opportunityCount    INTEGER DEFAULT 0,
        updatedAt           TEXT NOT NULL,
        PRIMARY KEY (userId, skill)
      );

      CREATE TABLE IF NOT EXISTS career_alumni (
        id                  TEXT PRIMARY KEY,
        userId              TEXT NOT NULL,
        name                TEXT NOT NULL,
        email               TEXT NOT NULL,
        batch               TEXT NOT NULL,
        branch              TEXT NOT NULL,
        company             TEXT,
        position            TEXT,
        location            TEXT,
        linkedinUrl         TEXT,
        bio                 TEXT,
        skills              TEXT DEFAULT '[]',
        isAvailableForMentoring INTEGER DEFAULT 0,
        createdAt           TEXT NOT NULL,
        updatedAt           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_interview_slots (
        id                  TEXT PRIMARY KEY,
        interviewerId       TEXT NOT NULL,
        interviewerName     TEXT NOT NULL,
        date                TEXT NOT NULL,
        startTime           TEXT NOT NULL,
        endTime             TEXT NOT NULL,
        duration            INTEGER NOT NULL,
        type                TEXT NOT NULL CHECK(type IN ('mock','technical','behavioral','system_design')),
        isBooked            INTEGER DEFAULT 0,
        bookedBy            TEXT,
        bookedByName        TEXT,
        notes               TEXT,
        createdAt           TEXT NOT NULL,
        updatedAt           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_interview_bookings (
        id                  TEXT PRIMARY KEY,
        slotId              TEXT NOT NULL,
        studentId           TEXT NOT NULL,
        studentName         TEXT NOT NULL,
        interviewerId       TEXT NOT NULL,
        interviewerName     TEXT NOT NULL,
        date                TEXT NOT NULL,
        startTime           TEXT NOT NULL,
        endTime             TEXT NOT NULL,
        type                TEXT NOT NULL,
        status              TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed','completed','cancelled','no_show')),
        notes               TEXT,
        feedback            TEXT,
        rating              INTEGER,
        createdAt           TEXT NOT NULL,
        updatedAt           TEXT NOT NULL,
        FOREIGN KEY (slotId) REFERENCES career_interview_slots(id)
      );

      CREATE TABLE IF NOT EXISTS career_notification_log (
        userId   TEXT NOT NULL,
        kind     TEXT NOT NULL,
        refKey   TEXT NOT NULL,
        sentDay  TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (userId, kind, refKey, sentDay)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS career_search USING fts5(
        title, description, skills, tags, company, organizer,
        content='career_opportunities'
      );

      CREATE TRIGGER IF NOT EXISTS career_opportunities_ai AFTER INSERT ON career_opportunities BEGIN
        INSERT INTO career_search(rowid, title, description, skills, tags, company, organizer)
        VALUES (new.rowid, new.title, new.description, new.skills, new.tags, new.company, new.organizer);
      END;
      CREATE TRIGGER IF NOT EXISTS career_opportunities_ad AFTER DELETE ON career_opportunities BEGIN
        INSERT INTO career_search(career_search, rowid, title, description, skills, tags, company, organizer)
        VALUES('delete', old.rowid, old.title, old.description, old.skills, old.tags, old.company, old.organizer);
      END;
      CREATE TRIGGER IF NOT EXISTS career_opportunities_au AFTER UPDATE ON career_opportunities BEGIN
        INSERT INTO career_search(career_search, rowid, title, description, skills, tags, company, organizer)
        VALUES('delete', old.rowid, old.title, old.description, old.skills, old.tags, old.company, old.organizer);
        INSERT INTO career_search(rowid, title, description, skills, tags, company, organizer)
        VALUES (new.rowid, new.title, new.description, new.skills, new.tags, new.company, new.organizer);
      END;
    `);
  },

  _seedDefaultsIfNeeded() {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM career_opportunities").get();
    if (row.count === 0) {
      const now = nowIso();
      const insert = this.db.prepare(`
        INSERT INTO career_opportunities (
          id, type, title, company, organizer, description, shortDescription,
          skills, tags, source, sourceUrl, applyUrl, scrapedAt, updatedAt,
          isActive, isVerified, isFeatured, postedAt, deadline
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const defaultOpps = [
        {
          id: randomUUID(),
          type: "internship",
          title: "Research Internship in Applied AI",
          company: "SRM Research Lab",
          description: "Work with faculty mentors on applied ML systems and model evaluation pipelines.",
          skills: JSON.stringify(["Python", "Machine Learning"]),
          tags: JSON.stringify(["Research", "AI"]),
          source: "manual",
          sourceUrl: "https://example.edu/research-ai",
          applyUrl: "https://example.edu/apply-ai",
          postedAt: now,
          deadline: "2026-05-12T23:59:59Z",
        },
        {
          id: randomUUID(),
          type: "workshop",
          title: "Campus Hiring Bootcamp",
          organizer: "Career Cell",
          description: "Resume reviews, mock interviews, and recruiter Q&A for final-year students.",
          skills: JSON.stringify(["Soft Skills", "Interview Prep"]),
          tags: JSON.stringify(["Placement", "Bootcamp"]),
          source: "manual",
          sourceUrl: "https://example.edu/bootcamp",
          applyUrl: "https://example.edu/apply-bootcamp",
          postedAt: now,
          deadline: "2026-04-25T23:59:59Z",
        },
      ];

      for (const opp of defaultOpps) {
        insert.run(
          opp.id,
          opp.type,
          opp.title,
          opp.company || null,
          opp.organizer || null,
          opp.description,
          opp.description.substring(0, 200),
          opp.skills,
          opp.tags,
          opp.source,
          opp.sourceUrl,
          opp.applyUrl,
          now,
          now,
          1,
          1,
          0,
          opp.postedAt,
          opp.deadline
        );
      }
      
    }
  }
};
