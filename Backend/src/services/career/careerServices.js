const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { normalizeText, normalizeSubitem } = require("../../utils/text");

// --- careerCache.js ---
/**
 * Phase 6 — optional Redis JSON cache for career hot paths.
 * Degrades cleanly when redisClient is null or commands fail.
 */
function createCareerCache(redisClient, { prefix = "career:cache:", ttlSec = 90 } = {}) {
  const effectiveTtl = Math.max(5, Number(ttlSec) || 90);

  async function getJson(key) {
    if (!redisClient || typeof redisClient.get !== "function") return null;
    try {
      const raw = await redisClient.get(`${prefix}${key}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function setJson(key, value) {
    if (!redisClient || typeof redisClient.set !== "function") return;
    try {
      await redisClient.set(`${prefix}${key}`, JSON.stringify(value), { EX: effectiveTtl });
    } catch {
      // ignore
    }
  }

  async function delKey(key) {
    if (!redisClient || typeof redisClient.del !== "function") return;
    try {
      await redisClient.del(`${prefix}${key}`);
    } catch {
      // ignore
    }
  }

  async function invalidateCommon() {
    await delKey("stats");
    await delKey("health");
    await delKey("trending");
  }

  async function invalidateUserFeed(userId) {
    await delKey(`feed:${userId}`);
  }

  return { getJson, setJson, delKey, invalidateCommon, invalidateUserFeed };
}

// --- careerNotifier.js ---
/**
 * Phase 5 — career notifications via EventsStore (in-app).
 * Idempotent per (user, kind, ref, UTC day) using career_notification_log.
 */

function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function runCareerNotificationCycle({ careerStore, eventsStore, now = new Date() } = {}) {
  if (!careerStore || !eventsStore || typeof eventsStore.pushCareerNotification !== "function") {
    return { deadlineSent: 0, digestSent: 0 };
  }

  const day = utcDay(now);
  let deadlineSent = 0;
  let digestSent = 0;

  const deadlineRows = careerStore.getBookmarkDeadlineReminderCandidates(3);
  for (const row of deadlineRows) {
    if (careerStore.hasCareerNotificationLog(row.userId, "deadline_soon", row.opportunityId, day)) {
      continue;
    }
    eventsStore.pushCareerNotification(row.userId, {
      type: "career_deadline_soon",
      title: "Application deadline approaching",
      message: `"${row.title}" closes soon. Review your bookmarks in the Career portal.`,
      channel: ["in-app"],
    });
    careerStore.recordCareerNotificationLog(row.userId, "deadline_soon", row.opportunityId, day);
    deadlineSent += 1;
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const digestRows = careerStore.getSkillMatchDigestRows(since);
  for (const row of digestRows) {
    if (!row.userId || !row.count) continue;
    if (careerStore.hasCareerNotificationLog(row.userId, "skill_digest", "daily", day)) {
      continue;
    }
    eventsStore.pushCareerNotification(row.userId, {
      type: "career_skill_digest",
      title: "New opportunities matched your skills",
      message: `${row.count} new listing(s) in the last day may fit your career profile. Open Career → Personalized feed.`,
      channel: ["in-app"],
    });
    careerStore.recordCareerNotificationLog(row.userId, "skill_digest", "daily", day);
    digestSent += 1;
  }

  return { deadlineSent, digestSent };
}

// --- careerRelevanceEngine.js ---
/**
 * Phase 4 - Career Relevance Engine
 * Handles user-specific scoring for opportunities.
 */

class CareerRelevanceEngine {
  /**
   * Compute a personalized score for an opportunity based on user context and profile.
   * Max score: 100
   */
  static computePersonalizedScore(opportunity, userContext, profile) {
    let score = 0;

    // 1. Skill Match (Max 40 pts)
    const oppSkills = new Set((opportunity.skills || []).map(s => s.toLowerCase()));
    const userSkills = new Set((profile?.skills || []).map(s => s.toLowerCase()));
    
    if (oppSkills.size > 0) {
      let matchCount = 0;
      oppSkills.forEach(skill => {
        if (userSkills.has(skill)) matchCount++;
      });
      score += (matchCount / oppSkills.size) * 40;
    } else {
      score += 20; // Default if no skills listed
    }

    // 2. Branch Match (Max 20 pts)
    const eligibleBranches = new Set((opportunity.eligibleBranches || []).map(b => b.toLowerCase()));
    const userBranch = (userContext.branch || "").toLowerCase();
    
    if (eligibleBranches.size === 0 || eligibleBranches.has(userBranch) || eligibleBranches.has("all")) {
      score += 20;
    }

    // 3. Year Match (Max 20 pts)
    const eligibleYears = new Set(opportunity.eligibleYears || []);
    const userYear = Number.parseInt(String(userContext.year ?? ""), 10);

    if (!Number.isFinite(userYear)) {
      score += 10;
    } else if (eligibleYears.size === 0 || eligibleYears.has(userYear)) {
      score += 20;
    }

    // 4. Preference Match (Max 20 pts)
    const preferredTypes = new Set((profile?.preferredTypes || []).map(t => t.toLowerCase()));
    const preferredLocations = new Set((profile?.preferredLocations || []).map(l => l.toLowerCase()));
    
    if (preferredTypes.size > 0 && preferredTypes.has(opportunity.type.toLowerCase())) {
      score += 10;
    } else if (preferredTypes.size === 0) {
      score += 5;
    }

    if (preferredLocations.size > 0) {
      const oppLoc = (opportunity.location || "").toLowerCase();
      const oppMode = (opportunity.mode || "").toLowerCase();
      
      let locMatch = false;
      preferredLocations.forEach(loc => {
        if (oppLoc.includes(loc) || (loc === "remote" && oppMode === "remote")) {
          locMatch = true;
        }
      });
      
      if (locMatch) score += 10;
    } else {
      score += 5;
    }

    const base = Number(opportunity.relevanceScore);
    const baseBoost = Number.isFinite(base) ? Math.min(15, base * 0.15) : 0;
    return Math.min(100, Math.round(score + baseBoost));
  }

  /**
   * Get skill match details for UI display.
   */
  static getSkillMatchInfo(opportunity, profile) {
    const oppSkills = (opportunity.skills || []);
    const userSkills = new Set((profile?.skills || []).map(s => s.toLowerCase()));
    
    const matched = oppSkills.filter(s => userSkills.has(s.toLowerCase()));
    const missing = oppSkills.filter(s => !userSkills.has(s.toLowerCase()));
    
    return {
      matched,
      missing,
      percent: oppSkills.length > 0 ? Math.round((matched.length / oppSkills.length) * 100) : 100
    };
  }
}

// --- companionAnalyticsStore.js ---
const ALLOWED_EVENT_PATTERN = /^[a-z][a-z0-9_:.:-]{1,96}$/i;
const MAX_PROPERTY_BYTES = 8 * 1024;

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, max = 255) {
  return String(value || "").trim().slice(0, max);
}

function safeJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_PROPERTY_BYTES) {
    return JSON.stringify({ truncated: true });
  }
  return json;
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeDate(value, fallback) {
  const date = new Date(value || fallback || nowIso());
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function classifyEvent(eventName) {
  const name = safeString(eventName, 100);
  if (name.includes("recommendation")) return "recommendation";
  if (name.includes("resume") || name.includes("career") || name.includes("opportunity")) return "career";
  if (name.includes("lms") || name.includes("roadmap") || name.includes("exam_prep")) return "lms";
  if (name.includes("team") || name.includes("event") || name.includes("submission") || name.includes("leaderboard")) return "events";
  if (name.includes("profile")) return "profile";
  return "platform";
}

class CompanionAnalyticsStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this._ensureSchema();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS companion_analytics_events (
        id TEXT PRIMARY KEY,
        eventName TEXT NOT NULL,
        category TEXT NOT NULL,
        userId TEXT,
        role TEXT,
        route TEXT,
        sessionId TEXT,
        propertiesJson TEXT NOT NULL,
        occurredAt TEXT NOT NULL,
        receivedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_companion_analytics_event_time
        ON companion_analytics_events(eventName, occurredAt DESC);

      CREATE INDEX IF NOT EXISTS idx_companion_analytics_category_time
        ON companion_analytics_events(category, occurredAt DESC);

      CREATE INDEX IF NOT EXISTS idx_companion_analytics_user_time
        ON companion_analytics_events(userId, occurredAt DESC);
    `);
  }

  recordEvent(payload = {}, context = {}) {
    const eventName = safeString(payload.event || payload.eventName, 100);
    if (!ALLOWED_EVENT_PATTERN.test(eventName)) {
      const error = new Error("Invalid analytics event name");
      error.status = 400;
      throw error;
    }
    const propertiesJson = safeJson(payload.properties || {});
    const occurredAt = normalizeDate(payload.occurredAt, nowIso());
    const receivedAt = nowIso();
    const record = {
      id: randomUUID(),
      eventName,
      category: classifyEvent(eventName),
      userId: safeString(context.userId || payload.userId, 80) || null,
      role: safeString(context.role || payload.role, 40) || null,
      route: safeString(payload.route || payload.properties?.route, 180) || null,
      sessionId: safeString(context.sessionId || payload.sessionId, 120) || null,
      propertiesJson,
      occurredAt,
      receivedAt,
    };
    this.db
      .prepare(
        `INSERT INTO companion_analytics_events (
          id, eventName, category, userId, role, route, sessionId, propertiesJson, occurredAt, receivedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.eventName,
        record.category,
        record.userId,
        record.role,
        record.route,
        record.sessionId,
        record.propertiesJson,
        record.occurredAt,
        record.receivedAt
      );
    return this._publicEvent(record);
  }

  _publicEvent(row) {
    return {
      id: row.id,
      eventName: row.eventName,
      category: row.category,
      userId: row.userId,
      role: row.role,
      route: row.route,
      properties: parseJson(row.propertiesJson, {}),
      occurredAt: row.occurredAt,
      receivedAt: row.receivedAt,
    };
  }

  getReport({ days = 30, limit = 20 } = {}) {
    const windowDays = Math.min(Math.max(Number(days || 30), 1), 180);
    const cappedLimit = Math.min(Math.max(Number(limit || 20), 1), 100);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    const totals = this.db
      .prepare(
        `SELECT
          COUNT(*) AS totalEvents,
          COUNT(DISTINCT COALESCE(userId, sessionId, 'anonymous')) AS activeActors,
          COUNT(DISTINCT sessionId) AS sessions,
          MIN(occurredAt) AS firstEventAt,
          MAX(occurredAt) AS lastEventAt
        FROM companion_analytics_events
        WHERE occurredAt >= ?`
      )
      .get(since);

    const byCategory = this.db
      .prepare(
        `SELECT category, COUNT(*) AS count
         FROM companion_analytics_events
         WHERE occurredAt >= ?
         GROUP BY category
         ORDER BY count DESC, category ASC`
      )
      .all(since);

    const topEvents = this.db
      .prepare(
        `SELECT eventName, category, COUNT(*) AS count, COUNT(DISTINCT COALESCE(userId, sessionId, 'anonymous')) AS actors
         FROM companion_analytics_events
         WHERE occurredAt >= ?
         GROUP BY eventName, category
         ORDER BY count DESC, eventName ASC
         LIMIT ?`
      )
      .all(since, cappedLimit);

    const recommendation = this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN eventName LIKE '%recommendations_viewed%' THEN 1 ELSE 0 END) AS impressions,
          SUM(CASE WHEN eventName LIKE '%recommendation_clicked%' THEN 1 ELSE 0 END) AS clicks
         FROM companion_analytics_events
         WHERE occurredAt >= ?`
      )
      .get(since);

    const funnel = this.db
      .prepare(
        `SELECT eventName, COUNT(*) AS count
         FROM companion_analytics_events
         WHERE occurredAt >= ?
           AND eventName IN (
             'resume_analyzed',
             'resume_skills_synced',
             'opportunity_fit_viewed',
             'career_achievements_synced',
             'events_recommendations_viewed',
             'events_recommendation_clicked',
             'lms_exam_prep_recommendations_viewed',
             'lms_roadmap_recommendations_viewed',
             'team_recruitment_posted'
           )
         GROUP BY eventName
         ORDER BY count DESC, eventName ASC`
      )
      .all(since);

    const recent = this.db
      .prepare(
        `SELECT *
         FROM companion_analytics_events
         WHERE occurredAt >= ?
         ORDER BY occurredAt DESC
         LIMIT ?`
      )
      .all(since, Math.min(cappedLimit, 25))
      .map((row) => this._publicEvent(row));

    const impressions = Number(recommendation?.impressions || 0);
    const clicks = Number(recommendation?.clicks || 0);

    return {
      contractVersion: "companion-analytics-report-v1",
      windowDays,
      generatedAt: nowIso(),
      totals: {
        totalEvents: Number(totals?.totalEvents || 0),
        activeActors: Number(totals?.activeActors || 0),
        sessions: Number(totals?.sessions || 0),
        firstEventAt: totals?.firstEventAt || null,
        lastEventAt: totals?.lastEventAt || null,
      },
      recommendationCtr: {
        impressions,
        clicks,
        rate: impressions ? Number((clicks / impressions).toFixed(4)) : 0,
      },
      byCategory: byCategory.map((row) => ({ category: row.category, count: Number(row.count || 0) })),
      topEvents: topEvents.map((row) => ({
        eventName: row.eventName,
        category: row.category,
        count: Number(row.count || 0),
        actors: Number(row.actors || 0),
      })),
      funnel: funnel.map((row) => ({ eventName: row.eventName, count: Number(row.count || 0) })),
      recent,
    };
  }
}

// --- discoveryRepository.js ---
class DiscoveryRepository {
  constructor(fileCandidates = []) {
    this.fileCandidates = fileCandidates;
    this.filePath = null;
    this.raw = null;
    this.byKey = new Map();
    this.byDropdown = new Map();
    this.reload();
  }

  findFile() {
    return this.fileCandidates.find((filePath) => fs.existsSync(filePath)) || null;
  }

  reload() {
    this.filePath = this.findFile();
    this.raw = null;
    this.byKey = new Map();
    this.byDropdown = new Map();

    if (!this.filePath) return;

    this.raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    const resolvedItems = Array.isArray(this.raw.resolvedItems)
      ? this.raw.resolvedItems
      : [];

    for (const item of resolvedItems) {
      const dropdownKey = normalizeText(item.dropdown);
      const subitemKey = normalizeSubitem(item.subitem);
      const mapKey = `${dropdownKey}::${subitemKey}`;

      this.byKey.set(mapKey, item);
      if (!this.byDropdown.has(dropdownKey)) {
        this.byDropdown.set(dropdownKey, []);
      }
      this.byDropdown.get(dropdownKey).push(item);
    }
  }

  resolveEndpoint(dropdown, subitem) {
    const dropdownKey = normalizeText(dropdown);
    const subitemKey = normalizeSubitem(subitem);

    const direct = this.byKey.get(`${dropdownKey}::${subitemKey}`);
    if (direct) return direct.endpoint;

    const candidates = this.byDropdown.get(dropdownKey) || [];
    if (!candidates.length) return null;

    if (!subitemKey) {
      const announcementsLike = candidates.find((item) =>
        normalizeSubitem(item.subitem).includes("announcement")
      );
      return (announcementsLike || candidates[0]).endpoint;
    }

    const exact = candidates.find(
      (item) => normalizeSubitem(item.subitem) === subitemKey
    );
    if (exact) return exact.endpoint;

    const fuzzy = candidates.find((item) => {
      const candidateSubitem = normalizeSubitem(item.subitem);
      return candidateSubitem.includes(subitemKey) || subitemKey.includes(candidateSubitem);
    });

    return fuzzy ? fuzzy.endpoint : null;
  }

  resolveHelperFunction(name) {
    const helperFunctions = this.raw?.functionMappings?.helperFunctions;
    if (!helperFunctions || typeof helperFunctions !== "object") return null;
    const key = String(name || "").trim();
    if (!key) return null;
    return helperFunctions[key] || null;
  }

  getHealth() {
    return {
      loaded: Boolean(this.raw),
      filePath: this.filePath,
      generatedAt: this.raw?.generatedAt || null,
      totalResolvedItems: Array.isArray(this.raw?.resolvedItems)
        ? this.raw.resolvedItems.length
        : 0,
    };
  }
}

module.exports = {
  createCareerCache,
  runCareerNotificationCycle,
  utcDay,
  CareerRelevanceEngine,
  CompanionAnalyticsStore,
  classifyEvent,
  DiscoveryRepository,
};