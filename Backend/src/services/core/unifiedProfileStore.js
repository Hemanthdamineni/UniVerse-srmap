const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { DatabaseSync } = require("node:sqlite");

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSkill(skill) {
  return String(skill || "").trim();
}

function normalizeKeyword(value) {
  return String(value || "").trim().toLowerCase();
}

function clampScore(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function addKeyword(target, value) {
  const normalized = normalizeKeyword(value);
  if (normalized) target.add(normalized);
}

function normalizeVisibility(value, fallback = "private") {
  const normalized = String(value || "").trim().toLowerCase();
  const allowed = new Set([
    "private",
    "platform_personalization",
    "campus",
    "organizers",
    "mentors",
    "employers",
    "public",
  ]);
  return allowed.has(normalized) ? normalized : fallback;
}

function defaultPrivacySettings() {
  return {
    inferredSkills: "platform_personalization",
    achievements: "private",
    careerReadiness: "private",
    lmsActivity: "private",
    resume: "private",
    eventParticipation: "private",
  };
}

class UnifiedProfileStore {
  constructor({ dbPath, lmsStore = null, careerStore = null, eventsStore = null, competitionStore = null }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.lmsStore = lmsStore;
    this.careerStore = careerStore;
    this.eventsStore = eventsStore;
    this.competitionStore = competitionStore;
    this._ensureSchema();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS unified_profile_snapshots (
        userId TEXT PRIMARY KEY,
        profileJson TEXT NOT NULL,
        computedAt TEXT NOT NULL,
        version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS student_signal_ledger (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        domain TEXT NOT NULL,
        signalType TEXT NOT NULL,
        signalRefId TEXT,
        strength REAL DEFAULT 1,
        visibility TEXT DEFAULT 'private',
        metadata TEXT DEFAULT '{}',
        occurredAt TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_signal_user_domain
        ON student_signal_ledger(userId, domain, occurredAt DESC);
      CREATE INDEX IF NOT EXISTS idx_signal_type
        ON student_signal_ledger(signalType, occurredAt DESC);

      CREATE TABLE IF NOT EXISTS student_skills (
        userId TEXT NOT NULL,
        skill TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL DEFAULT 0,
        evidenceRefs TEXT DEFAULT '[]',
        visibility TEXT DEFAULT 'private',
        updatedAt TEXT NOT NULL,
        PRIMARY KEY(userId, skill, source)
      );

      CREATE TABLE IF NOT EXISTS student_achievements (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        sourceDomain TEXT NOT NULL,
        sourceRefId TEXT,
        verificationState TEXT DEFAULT 'verified',
        skills TEXT DEFAULT '[]',
        visibility TEXT DEFAULT 'private',
        achievedAt TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_achievements_user
        ON student_achievements(userId, achievedAt DESC, createdAt DESC);

      CREATE TABLE IF NOT EXISTS profile_privacy_settings (
        userId TEXT PRIMARY KEY,
        settingsJson TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recommendation_impressions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        domain TEXT NOT NULL,
        itemType TEXT NOT NULL,
        itemId TEXT NOT NULL,
        score REAL,
        reasons TEXT DEFAULT '[]',
        surface TEXT NOT NULL,
        shownAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recommendation_feedback (
        id TEXT PRIMARY KEY,
        impressionId TEXT,
        userId TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        createdAt TEXT NOT NULL
      );
    `);
  }

  _ensureAuthenticated(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  }

  getPrivacySettings(user) {
    this._ensureAuthenticated(user);
    const row = this.db
      .prepare("SELECT settingsJson FROM profile_privacy_settings WHERE userId = ?")
      .get(user.userId);
    return {
      ...defaultPrivacySettings(),
      ...parseJson(row?.settingsJson, {}),
    };
  }

  updatePrivacySettings(user, updates = {}) {
    this._ensureAuthenticated(user);
    const now = nowIso();
    const current = this.getPrivacySettings(user);
    const next = { ...current };
    for (const [key, value] of Object.entries(updates || {})) {
      if (Object.hasOwn(defaultPrivacySettings(), key)) {
        next[key] = normalizeVisibility(value, current[key]);
      }
    }
    this.db
      .prepare(
        `INSERT INTO profile_privacy_settings (userId, settingsJson, updatedAt)
         VALUES (?, ?, ?)
         ON CONFLICT(userId) DO UPDATE SET
           settingsJson = excluded.settingsJson,
           updatedAt = excluded.updatedAt`
      )
      .run(user.userId, JSON.stringify(next), now);
    return next;
  }

  recordSignal({ userId, domain, signalType, signalRefId = "", strength = 1, visibility = "private", metadata = {}, occurredAt = nowIso() }) {
    const id = randomUUID();
    const createdAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO student_signal_ledger (
          id, userId, domain, signalType, signalRefId, strength, visibility, metadata, occurredAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        String(userId || ""),
        String(domain || "platform"),
        String(signalType || "activity"),
        String(signalRefId || ""),
        Number(strength || 1),
        normalizeVisibility(visibility),
        JSON.stringify(metadata || {}),
        occurredAt,
        createdAt
      );
    return { id, userId, domain, signalType, signalRefId, strength, visibility, metadata, occurredAt, createdAt };
  }

  listSignals(user, { domain = "", limit = 100 } = {}) {
    this._ensureAuthenticated(user);
    const cappedLimit = Math.min(Math.max(Number(limit || 100), 1), 250);
    const rows = domain
      ? this.db
          .prepare(
            `SELECT * FROM student_signal_ledger
             WHERE userId = ? AND domain = ?
             ORDER BY occurredAt DESC
             LIMIT ?`
          )
          .all(user.userId, String(domain), cappedLimit)
      : this.db
          .prepare(
            `SELECT * FROM student_signal_ledger
             WHERE userId = ?
             ORDER BY occurredAt DESC
             LIMIT ?`
          )
          .all(user.userId, cappedLimit);
    return rows.map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
  }

  upsertSkill({ userId, skill, source = "manual", confidence = 0.5, evidenceRefs = [], visibility = "private" }) {
    const normalizedSkill = normalizeSkill(skill);
    if (!normalizedSkill) return null;
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO student_skills (
          userId, skill, source, confidence, evidenceRefs, visibility, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, skill, source) DO UPDATE SET
          confidence = excluded.confidence,
          evidenceRefs = excluded.evidenceRefs,
          visibility = excluded.visibility,
          updatedAt = excluded.updatedAt`
      )
      .run(
        userId,
        normalizedSkill,
        source,
        Math.max(0, Math.min(1, Number(confidence || 0))),
        JSON.stringify(ensureArray(evidenceRefs)),
        normalizeVisibility(visibility),
        now
      );
    return { userId, skill: normalizedSkill, source, confidence, evidenceRefs, visibility, updatedAt: now };
  }

  listSkills(user) {
    this._ensureAuthenticated(user);
    this._syncCareerSkills(user);
    const rows = this.db
      .prepare("SELECT * FROM student_skills WHERE userId = ? ORDER BY confidence DESC, skill ASC")
      .all(user.userId);
    return rows.map((row) => ({ ...row, evidenceRefs: parseJson(row.evidenceRefs, []) }));
  }

  updateSkillVisibility(user, skill, visibility) {
    this._ensureAuthenticated(user);
    const normalized = normalizeSkill(skill);
    const nextVisibility = normalizeVisibility(visibility);
    const result = this.db
      .prepare("UPDATE student_skills SET visibility = ?, updatedAt = ? WHERE userId = ? AND lower(skill) = lower(?)")
      .run(nextVisibility, nowIso(), user.userId, normalized);
    if (!result.changes) {
      this.upsertSkill({
        userId: user.userId,
        skill: normalized,
        source: "manual",
        confidence: 0.4,
        visibility: nextVisibility,
      });
    }
    return this.listSkills(user).filter((item) => item.skill.toLowerCase() === normalized.toLowerCase());
  }

  _syncCareerSkills(user) {
    if (!this.careerStore?.getProfile) return;
    try {
      const profile = this.careerStore.getProfile(user);
      for (const skill of ensureArray(profile.skills)) {
        const existing = this.db
          .prepare(
            `SELECT visibility FROM student_skills
             WHERE userId = ? AND lower(skill) = lower(?) AND source = 'career_profile'`
          )
          .get(user.userId, skill);
        this.upsertSkill({
          userId: user.userId,
          skill,
          source: "career_profile",
          confidence: 0.8,
          evidenceRefs: ["career_profile"],
          visibility: existing?.visibility || "private",
        });
      }
    } catch {
      // Profile aggregation should degrade gracefully when a domain store is unavailable.
    }
  }

  upsertAchievement({
    userId,
    type,
    title,
    description = "",
    sourceDomain,
    sourceRefId = "",
    verificationState = "verified",
    skills = [],
    visibility = "private",
    achievedAt = "",
  }) {
    const existing = sourceRefId
      ? this.db
          .prepare(
            `SELECT id FROM student_achievements
             WHERE userId = ? AND sourceDomain = ? AND sourceRefId = ? AND type = ?`
          )
          .get(userId, sourceDomain, sourceRefId, type)
      : null;
    const id = existing?.id || randomUUID();
    const createdAt = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE student_achievements SET
            title = ?, description = ?, verificationState = ?, skills = ?, visibility = ?, achievedAt = ?
           WHERE id = ?`
        )
        .run(
          String(title || ""),
          String(description || ""),
          String(verificationState || "verified"),
          JSON.stringify(ensureArray(skills)),
          normalizeVisibility(visibility),
          achievedAt || createdAt,
          id
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO student_achievements (
            id, userId, type, title, description, sourceDomain, sourceRefId,
            verificationState, skills, visibility, achievedAt, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          userId,
          String(type || "achievement"),
          String(title || ""),
          String(description || ""),
          String(sourceDomain || "platform"),
          String(sourceRefId || ""),
          String(verificationState || "verified"),
          JSON.stringify(ensureArray(skills)),
          normalizeVisibility(visibility),
          achievedAt || createdAt,
          createdAt
        );
    }
    return this.getAchievementById(userId, id);
  }

  getAchievementById(userId, id) {
    const row = this.db
      .prepare("SELECT * FROM student_achievements WHERE userId = ? AND id = ?")
      .get(userId, id);
    return row ? { ...row, skills: parseJson(row.skills, []) } : null;
  }

  listAchievements(user) {
    this._ensureAuthenticated(user);
    const rows = this.db
      .prepare("SELECT * FROM student_achievements WHERE userId = ? ORDER BY COALESCE(achievedAt, createdAt) DESC")
      .all(user.userId);
    return rows.map((row) => ({ ...row, skills: parseJson(row.skills, []) }));
  }

  _listPublicSkills(userId, allowedVisibility) {
    const rows = this.db
      .prepare(
        `SELECT * FROM student_skills
         WHERE userId = ? AND visibility IN (${allowedVisibility.map(() => "?").join(",")})
         ORDER BY confidence DESC, skill ASC`
      )
      .all(userId, ...allowedVisibility);
    return rows.map((row) => ({ ...row, evidenceRefs: parseJson(row.evidenceRefs, []) }));
  }

  _listPublicAchievements(userId, allowedVisibility) {
    const rows = this.db
      .prepare(
        `SELECT * FROM student_achievements
         WHERE userId = ? AND visibility IN (${allowedVisibility.map(() => "?").join(",")})
         ORDER BY COALESCE(achievedAt, createdAt) DESC`
      )
      .all(userId, ...allowedVisibility);
    return rows.map((row) => ({ ...row, skills: parseJson(row.skills, []) }));
  }

  _getSnapshotUser(userId) {
    const row = this.db
      .prepare("SELECT profileJson FROM unified_profile_snapshots WHERE userId = ?")
      .get(userId);
    const snapshot = parseJson(row?.profileJson, null);
    return snapshot?.user || {};
  }

  getPublicCareerProfile(userId, { audience = "public" } = {}) {
    const ownerId = String(userId || "").trim();
    if (!ownerId) {
      const error = new Error("Profile user ID is required");
      error.status = 400;
      throw error;
    }

    const normalizedAudience = audience === "employers" ? "employers" : "public";
    const allowedVisibility = normalizedAudience === "employers"
      ? ["public", "employers"]
      : ["public"];
    const syntheticUser = { userId: ownerId, role: "student" };

    this._syncCareerSkills(syntheticUser);
    this.syncEventAchievements(syntheticUser);

    const career = this._getCareerProfile(syntheticUser);
    const profile = career.profile || {};
    const snapshotUser = this._getSnapshotUser(ownerId);
    const privacy = this.getPrivacySettings(syntheticUser);
    const skillMap = new Map();
    for (const skill of this._listPublicSkills(ownerId, allowedVisibility)) {
      skillMap.set(`${skill.skill.toLowerCase()}:${skill.source}`, skill);
    }
    if (allowedVisibility.includes(privacy.inferredSkills)) {
      for (const skill of ensureArray(profile.skills)) {
        const normalized = normalizeSkill(skill);
        if (!normalized) continue;
        const key = `${normalized.toLowerCase()}:career_profile`;
        if (!skillMap.has(key)) {
          skillMap.set(key, {
            userId: ownerId,
            skill: normalized,
            source: "career_profile",
            confidence: 0.8,
            evidenceRefs: ["career_profile"],
            visibility: privacy.inferredSkills,
            updatedAt: profile.updatedAt || nowIso(),
          });
        }
      }
    }
    const skills = Array.from(skillMap.values()).sort((left, right) => {
      const confidenceDelta = Number(right.confidence || 0) - Number(left.confidence || 0);
      return confidenceDelta || left.skill.localeCompare(right.skill);
    });
    const achievements = this._listPublicAchievements(ownerId, allowedVisibility);
    const links = {
      linkedinUrl: profile.linkedinUrl || "",
      githubUrl: profile.githubUrl || "",
      portfolioUrl: profile.portfolioUrl || "",
    };

    return {
      contractVersion: "career-public-profile-v1",
      audience: normalizedAudience,
      user: {
        userId: ownerId,
        name: snapshotUser.name || profile.name || ownerId,
        department: snapshotUser.department || "",
        branch: snapshotUser.branch || "",
        year: snapshotUser.year ?? null,
      },
      headline: profile.bio || `${snapshotUser.branch || "Student"} career profile`,
      bio: profile.bio || "",
      links,
      skills,
      achievements,
      stats: {
        visibleSkillCount: skills.length,
        visibleAchievementCount: achievements.length,
        profileCompleteness: career.available ? this._scoreCareerProfileCompleteness(profile) : 0,
      },
      updatedAt: profile.updatedAt || nowIso(),
    };
  }

  updateAchievementVisibility(user, achievementId, visibility) {
    this._ensureAuthenticated(user);
    const nextVisibility = normalizeVisibility(visibility);
    const result = this.db
      .prepare("UPDATE student_achievements SET visibility = ? WHERE userId = ? AND id = ?")
      .run(nextVisibility, user.userId, achievementId);
    if (!result.changes) {
      const error = new Error("Achievement not found");
      error.status = 404;
      throw error;
    }
    return this.getAchievementById(user.userId, achievementId);
  }

  syncEventAchievements(user) {
    this._ensureAuthenticated(user);
    const synced = [];
    if (!this.eventsStore) return { synced };

    const registrations = ensureArray(this.eventsStore.registrationsByUser?.get(user.userId));
    for (const registration of registrations) {
      if (!["registered", "attended", "checked_in"].includes(String(registration.status || "").toLowerCase())) {
        continue;
      }
      const event = this.eventsStore.eventById?.get(registration.eventId);
      if (!event) continue;
      synced.push(
        this.upsertAchievement({
          userId: user.userId,
          type: "event_participation",
          title: `Participated in ${event.title}`,
          description: String(event.description || ""),
          sourceDomain: "events",
          sourceRefId: event.id,
          verificationState: "verified",
          skills: ensureArray(event.tags),
          visibility: "private",
          achievedAt: registration.checkedInAt || registration.registeredAt || event.startAt,
        })
      );
    }

    const created = ensureArray(this.eventsStore.events).filter((event) => event.createdByUserId === user.userId);
    for (const event of created) {
      synced.push(
        this.upsertAchievement({
          userId: user.userId,
          type: "event_organizer",
          title: `Organized ${event.title}`,
          description: String(event.description || ""),
          sourceDomain: "events",
          sourceRefId: `${event.id}:organizer`,
          verificationState: "verified",
          skills: ["Leadership", ...ensureArray(event.tags)],
          visibility: "private",
          achievedAt: event.startAt || event.createdAt,
        })
      );
    }

    if (this.competitionStore?.db) {
      const rows = [];
      try {
        rows.push(
          ...this.competitionStore.db
            .prepare(
              `SELECT s.*, r.title AS roundTitle, r.resultsPublished
               FROM submissions s
               JOIN rounds r ON r.eventId = s.eventId AND r.roundId = s.roundId
               WHERE s.submittedBy = ? AND r.resultsPublished = 1`
            )
            .all(user.userId)
        );
        rows.push(
          ...this.competitionStore.db
            .prepare(
              `SELECT s.*, r.title AS roundTitle, r.resultsPublished, t.name AS teamName
               FROM submissions s
               JOIN rounds r ON r.eventId = s.eventId AND r.roundId = s.roundId
               JOIN teams t ON t.id = s.teamId
               JOIN json_each(t.members) member ON member.value = ?
               WHERE r.resultsPublished = 1`
            )
            .all(user.userId)
        );
      } catch {
        rows.length = 0;
      }
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const event = this.eventsStore.eventById?.get(row.eventId);
        const selected = Number(row.shortlisted || 0) === 1 || String(row.decision || "").toLowerCase() === "selected";
        synced.push(
          this.upsertAchievement({
            userId: user.userId,
            type: selected ? "competition_shortlist" : "competition_submission",
            title: selected
              ? `Shortlisted in ${event?.title || "competition"}`
              : `Submitted for ${event?.title || "competition"}`,
            description: [
              row.roundTitle || row.roundId,
              row.teamName ? `Team: ${row.teamName}` : "",
              row.totalScore !== null && row.totalScore !== undefined ? `Score: ${row.totalScore}` : "",
            ].filter(Boolean).join(" | "),
            sourceDomain: "events",
            sourceRefId: `${row.eventId}:${row.roundId}:${row.id}`,
            verificationState: "verified",
            skills: ["Competition", ...(selected ? ["Achievement"] : []), ...ensureArray(event?.tags)],
            visibility: "private",
            achievedAt: row.evaluatedAt || row.submittedAt,
          })
        );
      }
    }

    return { synced };
  }

  buildUnifiedProfile(user, { recompute = true } = {}) {
    this._ensureAuthenticated(user);
    if (recompute) {
      this._syncCareerSkills(user);
      this.syncEventAchievements(user);
    }

    const privacy = this.getPrivacySettings(user);
    const career = this._getCareerProfile(user);
    const lms = this._getLmsSummary(user);
    const events = this._getEventsSummary(user);
    const skills = this.listSkills(user);
    const achievements = this.listAchievements(user);
    const signals = this.listSignals(user, { limit: 25 });
    const profile = {
      contractVersion: "unified-profile-v1",
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        branch: user.branch,
        year: user.year,
      },
      privacy,
      career,
      lms,
      events,
      skills,
      achievements,
      signals,
      computedAt: nowIso(),
    };

    this.db
      .prepare(
        `INSERT INTO unified_profile_snapshots (userId, profileJson, computedAt, version)
         VALUES (?, ?, ?, 1)
         ON CONFLICT(userId) DO UPDATE SET
           profileJson = excluded.profileJson,
           computedAt = excluded.computedAt,
           version = unified_profile_snapshots.version + 1`
      )
      .run(user.userId, JSON.stringify(profile), profile.computedAt);

    return profile;
  }

  _getCareerProfile(user) {
    if (!this.careerStore?.getProfile) return { available: false };
    try {
      const profile = this.careerStore.getProfile(user);
      const skillGaps = this.careerStore.getSkillGaps ? this.careerStore.getSkillGaps(user) : [];
      return {
        available: true,
        profile,
        skillGaps,
        completeness: this._scoreCareerProfileCompleteness(profile),
      };
    } catch (error) {
      return { available: false, error: error?.message || "Career profile unavailable" };
    }
  }

  _scoreCareerProfileCompleteness(profile = {}) {
    let score = 0;
    if (ensureArray(profile.skills).length >= 3) score += 20;
    if (profile.bio) score += 15;
    if (profile.resumeUrl || profile.resumeFileName) score += 20;
    if (profile.linkedinUrl) score += 10;
    if (profile.githubUrl || profile.portfolioUrl) score += 10;
    if (ensureArray(profile.preferredTypes).length) score += 10;
    if (profile.cgpa) score += 10;
    if (ensureArray(profile.preferredLocations).length) score += 5;
    return Math.min(100, score);
  }

  _getLmsSummary(user) {
    if (!this.lmsStore) return { available: false };
    try {
      return {
        available: true,
        progress: this.lmsStore.getProgressSummary ? this.lmsStore.getProgressSummary(user.userId) : null,
        contributions: this.lmsStore.getUserContributions ? this._summarizeContributions(this.lmsStore.getUserContributions(user.userId)) : null,
        mastery: this.lmsStore.getMastery ? this.lmsStore.getMastery(user.userId).slice(0, 20) : [],
      };
    } catch (error) {
      return { available: false, error: error?.message || "LMS summary unavailable" };
    }
  }

  _summarizeContributions(contributions = {}) {
    return {
      resources: ensureArray(contributions.resources).length,
      guides: ensureArray(contributions.guides).length,
      roadmaps: ensureArray(contributions.roadmaps).length,
    };
  }

  _getEventsSummary(user) {
    if (!this.eventsStore) return { available: false };
    try {
      const registrations = ensureArray(this.eventsStore.registrationsByUser?.get(user.userId));
      const created = ensureArray(this.eventsStore.events).filter((event) => event.createdByUserId === user.userId);
      return {
        available: true,
        registeredCount: registrations.length,
        organizedCount: created.length,
        registrations: registrations.slice(0, 10),
        organized: created.slice(0, 10).map((event) => ({ id: event.id, title: event.title, startAt: event.startAt })),
      };
    } catch (error) {
      return { available: false, error: error?.message || "Events summary unavailable" };
    }
  }

  getRecommendations(user, { domain = "home", limit = 12, surface = "home" } = {}) {
    this._ensureAuthenticated(user);
    const cappedLimit = Math.min(Math.max(Number(limit || 12), 1), 50);
    const domains = domain === "home" ? ["lms", "career", "events"] : [domain];
    const items = [];
    if (domains.includes("lms")) items.push(...this._lmsRecommendations(user));
    if (domains.includes("career")) items.push(...this._careerRecommendations(user));
    if (domains.includes("events")) items.push(...this._eventRecommendations(user));

    const ranked = items
      .sort((left, right) => right.score - left.score)
      .slice(0, cappedLimit)
      .map((item) => this._recordRecommendationImpression(user, item, surface));

    return {
      contractVersion: "recommendations-v1",
      domain,
      items: ranked,
      generatedAt: nowIso(),
    };
  }

  _lmsRecommendations(user) {
    if (!this.lmsStore?.listRecommendationCandidates) return [];
    try {
      return this.lmsStore
        .listRecommendationCandidates({
          userId: user.userId,
          filters: user.branch ? { query: user.branch } : {},
          limit: 8,
        })
        .slice(0, 6)
        .map((resource) => ({
          domain: "lms",
          itemType: "resource",
          itemId: resource.id,
          title: resource.title,
          score: Math.min(1, 0.45 + Number(resource.qualityScore || 0) / 10),
          label: "Recommended resource",
          reasons: ["Matches your learning context", "Ranked by LMS quality and engagement"],
          risks: resource.isOutdated ? ["Resource may be outdated"] : [],
          missing: [],
          href: `/resources/${resource.id}`,
        }));
    } catch {
      return [];
    }
  }

  _careerRecommendations(user) {
    if (!this.careerStore?.getOpportunities) return [];
    try {
      const profile = this._getCareerProfile(user).profile || {};
      const skills = new Set(ensureArray(profile.skills).map((skill) => String(skill).toLowerCase()));
      return this.careerStore
        .getOpportunities({ user, sort: "relevance", limit: 10 })
        .slice(0, 6)
        .map((opportunity) => {
          const required = ensureArray(opportunity.skills);
          const matched = required.filter((skill) => skills.has(String(skill).toLowerCase()));
          const score = Math.min(1, 0.35 + (required.length ? matched.length / required.length : 0.25) * 0.5);
          return {
            domain: "career",
            itemType: "opportunity",
            itemId: opportunity.id,
            title: opportunity.title,
            score,
            label: score >= 0.75 ? "Strong opportunity match" : "Opportunity to review",
            reasons: [
              matched.length ? `Matches ${matched.length} listed skill${matched.length === 1 ? "" : "s"}` : "Eligible opportunity from career feed",
              opportunity.deadline ? `Deadline: ${opportunity.deadline}` : "Active opportunity",
            ],
            risks: [],
            missing: required.filter((skill) => !skills.has(String(skill).toLowerCase())).slice(0, 4),
            href: `/career/opportunities/${opportunity.id}`,
          };
        });
    } catch {
      return [];
    }
  }

  _eventRecommendations(user) {
    if (!this.eventsStore?.listEvents) return [];
    try {
      const career = this._getCareerProfile(user);
      const careerProfile = career.profile || {};
      const skillKeywords = new Set();
      const gapKeywords = new Set();
      const academicKeywords = new Set();
      const historyCategories = new Set();
      const historyTags = new Set();

      for (const item of this.listSkills(user)) addKeyword(skillKeywords, item.skill);
      for (const skill of ensureArray(careerProfile.skills)) addKeyword(skillKeywords, skill);
      for (const interest of ensureArray(careerProfile.interests)) addKeyword(skillKeywords, interest);
      for (const gap of ensureArray(career.skillGaps)) addKeyword(gapKeywords, typeof gap === "string" ? gap : gap?.skill);
      addKeyword(academicKeywords, user.department);
      addKeyword(academicKeywords, user.branch);

      const registrations = ensureArray(this.eventsStore.registrationsByUser?.get(user.userId));
      const registeredEventIds = new Set(registrations.map((item) => String(item.eventId || "")));
      for (const registration of registrations) {
        const event = this.eventsStore.eventById?.get?.(registration.eventId);
        if (!event) continue;
        addKeyword(historyCategories, event.category);
        for (const tag of ensureArray(event.tags)) addKeyword(historyTags, tag);
      }

      return this.eventsStore
        .listEvents({ user, filters: { type: "upcoming" } })
        .slice(0, 8)
        .map((event) => {
          const tags = ensureArray(event.tags);
          const eventText = [
            event.title,
            event.description,
            event.category,
            event.department,
            event.eligibility,
            ...tags,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const matchingSkills = [...skillKeywords].filter((keyword) => eventText.includes(keyword));
          const matchingGaps = [...gapKeywords].filter((keyword) => eventText.includes(keyword));
          const academicMatch = [...academicKeywords].some((keyword) => keyword && eventText.includes(keyword));
          const historyMatch =
            historyCategories.has(normalizeKeyword(event.category)) ||
            tags.some((tag) => historyTags.has(normalizeKeyword(tag)));
          const isRegistered = Boolean(event.myRegistration) || registeredEventIds.has(String(event.id));
          const startsInHours = event.startAt
            ? (new Date(event.startAt).getTime() - Date.now()) / 3_600_000
            : Number.POSITIVE_INFINITY;
          const deadlineInHours = event.registrationDeadline
            ? (new Date(event.registrationDeadline).getTime() - Date.now()) / 3_600_000
            : startsInHours;
          const urgencyBoost = deadlineInHours > 0 && deadlineInHours <= 168 ? 0.06 : 0;
          const competitionBoost = event.competitionConfig ? 0.1 : 0;
          const featuredBoost = event.featured ? 0.08 : 0;
          const skillScore = Math.min(1, matchingSkills.length / 3);
          const gapScore = Math.min(1, matchingGaps.length / 2);
          const score = clampScore(
            0.28 +
              skillScore * 0.24 +
              gapScore * 0.16 +
              (academicMatch ? 0.14 : 0) +
              (historyMatch ? 0.12 : 0) +
              competitionBoost +
              featuredBoost +
              urgencyBoost +
              (isRegistered ? 0.04 : 0)
          );
          const reasons = [
            matchingSkills.length ? `Matches skills: ${matchingSkills.slice(0, 3).join(", ")}` : "",
            matchingGaps.length ? `Builds career gaps: ${matchingGaps.slice(0, 2).join(", ")}` : "",
            academicMatch ? "Aligned with your academic context" : "",
            historyMatch ? "Similar to events you joined before" : "",
            event.competitionConfig ? "Competition experience can strengthen your profile" : "",
            urgencyBoost ? "Registration window is closing soon" : "",
            !matchingSkills.length && !matchingGaps.length && !academicMatch && !historyMatch
              ? "Upcoming campus event"
              : "",
          ].filter(Boolean);
          return {
            domain: "events",
            itemType: event.competitionConfig ? "competition" : "event",
            itemId: event.id,
            title: event.title,
            score,
            label: isRegistered
              ? "Registered event to follow"
              : event.competitionConfig
                ? "Competition match"
                : "Event match",
            reasons: reasons.slice(0, 4),
            risks: isRegistered ? [] : ["Registration may be required"],
            missing: [],
            href: `/events/${event.id}`,
          };
        })
        .sort((left, right) => right.score - left.score);
    } catch {
      return [];
    }
  }

  _recordRecommendationImpression(user, item, surface) {
    const id = randomUUID();
    const shownAt = nowIso();
    this.db
      .prepare(
        `INSERT INTO recommendation_impressions (
          id, userId, domain, itemType, itemId, score, reasons, surface, shownAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        user.userId,
        item.domain,
        item.itemType,
        item.itemId,
        Number(item.score || 0),
        JSON.stringify(ensureArray(item.reasons)),
        surface,
        shownAt
      );
    return { ...item, impressionId: id, shownAt };
  }

  recordRecommendationFeedback(user, { impressionId = "", action, metadata = {} }) {
    this._ensureAuthenticated(user);
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO recommendation_feedback (
          id, impressionId, userId, action, metadata, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, String(impressionId || ""), user.userId, String(action || "unknown"), JSON.stringify(metadata || {}), nowIso());
    return { id, impressionId, action, recorded: true };
  }
}

module.exports = {
  UnifiedProfileStore,
  defaultPrivacySettings,
};
