const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("crypto");
const {
  canonicalizeSkill,
  canonicalizeSkills,
  isKnownSkill,
  CANONICAL_SKILLS,
} = require("../../utils/skillNames");
const { parseResume } = require("./resumeParse");

// --- utils.js (utility) ---
function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const APPLICATION_STATUSES = new Set([
  "interested",
  "applied",
  "under_review",
  "shortlisted",
  "interviewed",
  "offered",
  "accepted",
  "rejected",
  "withdrawn",
]);

const VALID_APPLICATION_TRANSITIONS = {
  interested: ["applied", "withdrawn"],
  applied: ["shortlisted", "rejected", "withdrawn"],
  under_review: ["shortlisted", "rejected", "withdrawn"],
  shortlisted: ["interviewed", "offered", "rejected", "withdrawn"],
  interviewed: ["offered", "rejected", "withdrawn"],
  offered: ["accepted", "rejected", "withdrawn"],
  accepted: ["withdrawn"],
  rejected: [],
  withdrawn: [],
};

const OPPORTUNITY_TYPES = new Set(["job", "internship", "hackathon", "competition", "fellowship", "workshop"]);

/** FTS5 prefix query: space-separated terms become mandatory prefixes (safe tokenization). */
function careerSearchMatchExpression(rawQuery) {
  const terms = toSafeString(rawQuery)
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!terms.length) return "";
  return terms.map((t) => `${t}*`).join(" AND ");
}

function clampCareerPageLimit(limit) {
  const n = Number.parseInt(String(limit), 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, n));
}

function clampCareerPage(page) {
  const n = Number.parseInt(String(page), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function normalizeOpportunityType(value) {
  const normalized = toSafeString(value).toLowerCase().replace(/\s+/g, "-");
  if (normalized === "full-time-job") return "job";
  if (!OPPORTUNITY_TYPES.has(normalized)) {
    const error = new Error("Invalid opportunity type");
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toSafeString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => toSafeString(item)).filter(Boolean);
  }
  return [];
}

function createOpportunityFingerprint({ title, company, organizer, applyUrl }) {
  return [title, company || organizer, applyUrl]
    .map((value) => toSafeString(value).toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

// --- alumni.js ---

// The Alumni Connect UI uses `degree` / `role` / `expertise` / `openToConnect`;
// the table columns are `branch` / `position` / `skills` /
// `isAvailableForMentoring`. Translate at this boundary and echo BOTH names on
// the way out so the client can read whichever it expects.
function readAlumniInput(data = {}) {
  const pick = (...vals) => vals.find((v) => v !== undefined);
  const skillsRaw = pick(data.expertise, data.skills);
  return {
    name: data.name,
    email: data.email,
    batch: data.batch,
    branch: pick(data.branch, data.degree),
    company: data.company,
    position: pick(data.position, data.role),
    location: data.location,
    linkedinUrl: data.linkedinUrl,
    instagramUrl: data.instagramUrl,
    portfolioUrl: data.portfolioUrl,
    bio: data.bio,
    skills: Array.isArray(skillsRaw) ? canonicalizeSkills(skillsRaw) : undefined,
    isAvailableForMentoring: pick(data.isAvailableForMentoring, data.openToConnect),
  };
}

function alumniRowToApi(row, { requested = false } = {}) {
  const skills = (() => {
    try {
      return JSON.parse(row.skills || "[]");
    } catch {
      return [];
    }
  })();
  const open = Boolean(row.isAvailableForMentoring);
  return {
    id: row.id,
    userId: row.userId,
    name: row.name || "",
    email: row.email || "",
    batch: row.batch || "",
    branch: row.branch || "",
    degree: row.branch || "",
    company: row.company || "",
    position: row.position || "",
    role: row.position || "",
    location: row.location || "",
    linkedinUrl: row.linkedinUrl || "",
    instagramUrl: row.instagramUrl || "",
    portfolioUrl: row.portfolioUrl || "",
    bio: row.bio || "",
    skills,
    expertise: skills,
    isAvailableForMentoring: open,
    openToConnect: open,
    requested: Boolean(requested),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const alumniMethods = {
  listAlumni({ user, query = "", batch = "" }) {
    this._ensureAuthenticatedUser(user);
    let sql = `
      SELECT a.*,
             (SELECT 1 FROM career_alumni_requests r
                WHERE r.alumniId = a.id AND r.userId = ? AND r.status = 'pending') AS requested
      FROM career_alumni a
      WHERE 1=1
    `;
    const params = [user.userId];

    if (query) {
      sql += " AND (a.name LIKE ? OR a.company LIKE ? OR a.position LIKE ? OR a.branch LIKE ? OR a.skills LIKE ?)";
      const like = `%${query}%`;
      params.push(like, like, like, like, like);
    }
    if (batch) {
      sql += " AND a.batch = ?";
      params.push(batch);
    }
    sql += " ORDER BY a.name";

    return this.db
      .prepare(sql)
      .all(...params)
      .map((row) => alumniRowToApi(row, { requested: row.requested === 1 }));
  },

  createAlumni(data, user) {
    this._ensureAuthenticatedUser(user);
    const id = randomUUID();
    const now = nowIso();
    const input = readAlumniInput(data);

    this.db
      .prepare(
        `INSERT INTO career_alumni (
          id, userId, name, email, batch, branch, company, position, location,
          linkedinUrl, instagramUrl, portfolioUrl, bio, skills, isAvailableForMentoring,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        user.userId,
        input.name || "",
        input.email || "",
        input.batch || "",
        input.branch || "",
        input.company || "",
        input.position || "",
        input.location || "",
        input.linkedinUrl || "",
        input.instagramUrl || "",
        input.portfolioUrl || "",
        input.bio || "",
        JSON.stringify(input.skills || []),
        input.isAvailableForMentoring ? 1 : 0,
        now,
        now,
      );

    return alumniRowToApi(this.db.prepare("SELECT * FROM career_alumni WHERE id = ?").get(id));
  },

  updateAlumni(id, data, user) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    const input = readAlumniInput(data);

    this.db
      .prepare(
        `UPDATE career_alumni SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          batch = COALESCE(?, batch),
          branch = COALESCE(?, branch),
          company = COALESCE(?, company),
          position = COALESCE(?, position),
          location = COALESCE(?, location),
          linkedinUrl = COALESCE(?, linkedinUrl),
          instagramUrl = COALESCE(?, instagramUrl),
          portfolioUrl = COALESCE(?, portfolioUrl),
          bio = COALESCE(?, bio),
          skills = COALESCE(?, skills),
          isAvailableForMentoring = COALESCE(?, isAvailableForMentoring),
          updatedAt = ?
        WHERE id = ? AND userId = ?`,
      )
      .run(
        input.name ?? null,
        input.email ?? null,
        input.batch ?? null,
        input.branch ?? null,
        input.company ?? null,
        input.position ?? null,
        input.location ?? null,
        input.linkedinUrl ?? null,
        input.instagramUrl ?? null,
        input.portfolioUrl ?? null,
        input.bio ?? null,
        input.skills ? JSON.stringify(input.skills) : null,
        input.isAvailableForMentoring === undefined
          ? null
          : input.isAvailableForMentoring
            ? 1
            : 0,
        now,
        id,
        user.userId,
      );

    const row = this.db.prepare("SELECT * FROM career_alumni WHERE id = ?").get(id);
    return row ? alumniRowToApi(row) : { updated: true };
  },

  deleteAlumni(id, user) {
    this._ensureAuthenticatedUser(user);
    this.db.prepare("DELETE FROM career_alumni WHERE id = ? AND userId = ?").run(id, user.userId);
    this.db.prepare("DELETE FROM career_alumni_requests WHERE alumniId = ?").run(id);
    return { deleted: true };
  },

  requestAlumniConnection(alumniId, data, user) {
    this._ensureAuthenticatedUser(user);
    const alumni = this.db.prepare("SELECT id FROM career_alumni WHERE id = ?").get(alumniId);
    if (!alumni) {
      const error = new Error("Alumni profile not found");
      error.status = 404;
      throw error;
    }
    this.db
      .prepare(
        `INSERT INTO career_alumni_requests (id, alumniId, userId, requesterName, message, status, createdAt)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)
         ON CONFLICT(alumniId, userId) DO NOTHING`,
      )
      .run(
        randomUUID(),
        alumniId,
        user.userId,
        toSafeString(user.name),
        String(data?.message || "").slice(0, 500),
        nowIso(),
      );
    return { requested: true };
  },

  listSentAlumniRequests(user) {
    this._ensureAuthenticatedUser(user);
    return this.db
      .prepare(
        `SELECT r.id, r.alumniId, r.message, r.status, r.reviewNote, r.createdAt,
                a.name AS alumniName, a.company AS alumniCompany
         FROM career_alumni_requests r
         JOIN career_alumni a ON a.id = r.alumniId
         WHERE r.userId = ?
         ORDER BY r.createdAt DESC`,
      )
      .all(user.userId);
  },

  getPendingAlumniConnectionRequests() {
    return this.db
      .prepare(
        `SELECT r.id, r.alumniId, r.userId, r.requesterName, r.message, r.status, r.createdAt,
                a.name AS alumniName, a.company AS alumniCompany
         FROM career_alumni_requests r
         JOIN career_alumni a ON a.id = r.alumniId
         WHERE r.status = 'pending'
         ORDER BY r.createdAt DESC`,
      )
      .all();
  },

  reviewAlumniConnectionRequest(requestId, payload = {}, moderatorContext = {}) {
    this._ensureAuthenticatedUser(moderatorContext);
    const request = this.db.prepare("SELECT * FROM career_alumni_requests WHERE id = ?").get(requestId);
    if (!request) {
      const error = new Error("Connection request not found");
      error.status = 404;
      throw error;
    }
    if (request.status !== "pending") {
      const error = new Error("Connection request is not pending review");
      error.status = 400;
      throw error;
    }
    const decision = toSafeString(payload.decision).toLowerCase();
    if (!["accept", "accepted", "decline", "declined"].includes(decision)) {
      const error = new Error("Invalid review decision");
      error.status = 400;
      throw error;
    }
    const nextStatus = decision.startsWith("accept") ? "accepted" : "declined";
    const note = toSafeString(payload.note || payload.reviewNote).slice(0, 500);
    const reviewedBy = toSafeString(moderatorContext.userId) || "admin";
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE career_alumni_requests
         SET status = ?, reviewedAt = ?, reviewedBy = ?, reviewNote = ?
         WHERE id = ?`,
      )
      .run(nextStatus, now, reviewedBy, note, requestId);
    return { ...request, status: nextStatus, reviewedAt: now, reviewedBy, reviewNote: note };
  },

  nominateAlumnus(data = {}, user) {
    this._ensureAuthenticatedUser(user);
    const name = toSafeString(data.name);
    if (name.length < 2) {
      const error = new Error("Name is required");
      error.status = 400;
      throw error;
    }
    const email = toSafeString(data.email);
    const linkedinUrl = toSafeString(data.linkedinUrl);
    if (!email && !linkedinUrl) {
      const error = new Error("Provide an email or LinkedIn URL so the admin can verify this alumnus");
      error.status = 400;
      throw error;
    }
    const skillsRaw = data.expertise || data.skills;
    const expertise = Array.isArray(skillsRaw) ? canonicalizeSkills(skillsRaw) : [];
    const id = randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO career_alumni_nominations (
          id, submittedBy, submitterName, status, name, email, batch, degree, company, role,
          location, linkedinUrl, instagramUrl, portfolioUrl, expertise, relation, note, createdAt
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        user.userId,
        toSafeString(user.name),
        name,
        email,
        toSafeString(data.batch),
        toSafeString(data.degree),
        toSafeString(data.company),
        toSafeString(data.role),
        toSafeString(data.location),
        linkedinUrl,
        toSafeString(data.instagramUrl),
        toSafeString(data.portfolioUrl),
        JSON.stringify(expertise),
        toSafeString(data.relation),
        toSafeString(data.note),
        now,
      );
    return this.db.prepare("SELECT * FROM career_alumni_nominations WHERE id = ?").get(id);
  },

  listMyAlumniNominations(user) {
    this._ensureAuthenticatedUser(user);
    return this.db
      .prepare("SELECT * FROM career_alumni_nominations WHERE submittedBy = ? ORDER BY createdAt DESC")
      .all(user.userId);
  },

  getPendingAlumniNominations() {
    return this.db
      .prepare("SELECT * FROM career_alumni_nominations WHERE status = 'pending' ORDER BY createdAt DESC")
      .all();
  },

  reviewAlumniNomination(nominationId, payload = {}, moderatorContext = {}) {
    this._ensureAuthenticatedUser(moderatorContext);
    const nomination = this.db
      .prepare("SELECT * FROM career_alumni_nominations WHERE id = ?")
      .get(nominationId);
    if (!nomination) {
      const error = new Error("Nomination not found");
      error.status = 404;
      throw error;
    }
    if (nomination.status !== "pending") {
      const error = new Error("Nomination is not pending review");
      error.status = 400;
      throw error;
    }
    const reviewerId = toSafeString(moderatorContext.userId);
    if (reviewerId && reviewerId === String(nomination.submittedBy)) {
      const error = new Error("Reviewer cannot decide their own nomination");
      error.status = 403;
      throw error;
    }
    const decision = toSafeString(payload.decision || payload.status).toLowerCase();
    if (!["approve", "approved", "reject", "rejected"].includes(decision)) {
      const error = new Error("Invalid review decision");
      error.status = 400;
      throw error;
    }
    const reason = toSafeString(payload.reason || payload.reviewReason);
    if (reason.length < 3) {
      const error = new Error("Review reason is required");
      error.status = 400;
      throw error;
    }

    const nextStatus = decision.startsWith("approve") ? "approved" : "rejected";
    let publishedAlumniId = null;
    if (nextStatus === "approved") {
      let expertise = [];
      try {
        expertise = JSON.parse(nomination.expertise || "[]");
      } catch {
        expertise = [];
      }
      const created = this.createAlumni(
        {
          name: nomination.name,
          email: nomination.email,
          batch: nomination.batch,
          degree: nomination.degree,
          company: nomination.company,
          role: nomination.role,
          location: nomination.location,
          linkedinUrl: nomination.linkedinUrl,
          instagramUrl: nomination.instagramUrl,
          portfolioUrl: nomination.portfolioUrl,
          expertise,
          bio: nomination.note || "",
          openToConnect: true,
        },
        moderatorContext,
      );
      publishedAlumniId = created.id;
    }

    const now = nowIso();
    this.db
      .prepare(
        `UPDATE career_alumni_nominations
         SET status = ?, reviewedAt = ?, reviewedBy = ?, reviewReason = ?,
             publishedAlumniId = COALESCE(?, publishedAlumniId)
         WHERE id = ?`,
      )
      .run(nextStatus, now, reviewerId || "admin", reason, publishedAlumniId, nominationId);
    return this.db.prepare("SELECT * FROM career_alumni_nominations WHERE id = ?").get(nominationId);
  },
};

// --- catalog.js ---

const catalogMethods = {
  getOpportunities({
    type,
    skills: skillsParam,
    location,
    mode,
    query,
    sort,
    page = 1,
    limit = 20,
    user,
    isFree: isFreeFilter,
    hasStipend: hasStipendFilter,
    expiringWithinDays,
    bookmarkedOnly,
  }) {
    this._ensureAuthenticatedUser(user);

    const lim = clampCareerPageLimit(limit);
    const pg = clampCareerPage(page);

    let sql = `
      SELECT o.*,
             (SELECT 1 FROM career_bookmarks b WHERE b.opportunityId = o.id AND b.userId = ?) as isBookmarked,
             (SELECT 1 FROM career_applications a WHERE a.opportunityId = o.id AND a.userId = ?) as hasApplied
      FROM career_opportunities o
      WHERE o.isActive = 1 AND o.moderationState = 0
        AND NOT EXISTS (
          SELECT 1 FROM career_dismissals d
          WHERE d.opportunityId = o.id AND d.userId = ?
        )
    `;
    const params = [user.userId, user.userId, user.userId];

    if (bookmarkedOnly) {
      sql += ` AND EXISTS (SELECT 1 FROM career_bookmarks b2 WHERE b2.opportunityId = o.id AND b2.userId = ?)`;
      params.push(user.userId);
    }

    if (type) {
      sql += " AND o.type = ?";
      params.push(type);
    }

    if (mode) {
      sql += " AND o.mode = ?";
      params.push(mode);
    }

    if (location) {
      if (String(location).toLowerCase() === "remote") {
        sql += " AND o.mode = 'remote'";
      } else {
        sql += " AND (o.location LIKE ? OR o.isPanIndia = 1)";
        params.push(`%${location}%`);
      }
    }

    if (isFreeFilter === true || isFreeFilter === "true") {
      sql += " AND o.isFree = 1";
    }

    if (hasStipendFilter === true || hasStipendFilter === "true") {
      sql += ` AND (
        (o.stipend IS NOT NULL AND TRIM(o.stipend) != '')
        OR (o.prize IS NOT NULL AND TRIM(o.prize) != '')
      )`;
    }

    if (skillsParam) {
      const skillList = String(skillsParam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sk of skillList) {
        sql += " AND LOWER(o.skills) LIKE ?";
        params.push(`%${sk.toLowerCase()}%`);
      }
    }

    const branch = toSafeString(user.branch).toLowerCase();
    const userYear = user.year;
    if (branch) {
      sql += ` AND (
        (SELECT COUNT(*) FROM json_each(COALESCE(NULLIF(TRIM(o.eligibleBranches), ''), '[]'))) = 0
        OR EXISTS (
          SELECT 1 FROM json_each(COALESCE(NULLIF(TRIM(o.eligibleBranches), ''), '[]')) je
          WHERE LOWER(TRIM(je.value)) IN (?, 'all', 'any')
        )
      )`;
      params.push(branch);
    }

    if (userYear !== null && userYear !== undefined && String(userYear) !== "") {
      const y = Number.parseInt(String(userYear), 10);
      if (Number.isFinite(y)) {
        sql += ` AND (
          (SELECT COUNT(*) FROM json_each(COALESCE(NULLIF(TRIM(o.eligibleYears), ''), '[]'))) = 0
          OR EXISTS (
            SELECT 1 FROM json_each(COALESCE(NULLIF(TRIM(o.eligibleYears), ''), '[]')) je2
            WHERE CAST(je2.value AS INTEGER) = ?
          )
        )`;
        params.push(y);
      }
    }

    if (query) {
      const raw = String(query).trim();
      const matchExpr = careerSearchMatchExpression(raw);
      if (matchExpr) {
        sql += " AND o.rowid IN (SELECT rowid FROM career_search WHERE career_search MATCH ?)";
        params.push(matchExpr);
      } else {
        const like = `%${raw.toLowerCase().replace(/[%_]/g, "").slice(0, 200)}%`;
        if (like !== "%%") {
          sql += " AND (LOWER(o.title) LIKE ? OR LOWER(IFNULL(o.description,'')) LIKE ? OR LOWER(IFNULL(o.company,'')) LIKE ?)";
          params.push(like, like, like);
        }
      }
    }

    if (expiringWithinDays !== undefined && expiringWithinDays !== null) {
      const d = Number.parseInt(String(expiringWithinDays), 10);
      if (Number.isFinite(d) && d > 0) {
        sql += ` AND o.deadline IS NOT NULL
          AND datetime(o.deadline) > datetime('now')
          AND datetime(o.deadline) <= datetime('now', ?)`;
        params.push(`+${d} days`);
      }
    }

    switch (sort) {
      case "deadline":
        sql += " ORDER BY CASE WHEN o.deadline IS NULL THEN 1 ELSE 0 END, o.deadline ASC";
        break;
      case "recent":
        sql += " ORDER BY CASE WHEN o.postedAt IS NULL THEN 1 ELSE 0 END, o.postedAt DESC";
        break;
      case "popular":
        sql += " ORDER BY o.applyCount DESC, o.viewCount DESC";
        break;
      case "stipend":
        sql +=
          " ORDER BY CASE WHEN o.stipendMax IS NULL THEN 1 ELSE 0 END, o.stipendMax DESC, o.relevanceScore DESC";
        break;
      case "relevance":
      default:
        sql += " ORDER BY o.relevanceScore DESC, CASE WHEN o.postedAt IS NULL THEN 1 ELSE 0 END, o.postedAt DESC";
    }

    sql += " LIMIT ? OFFSET ?";
    params.push(lim, (pg - 1) * lim);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => ({
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      eligibleBranches: JSON.parse(row.eligibleBranches || "[]"),
      eligibleYears: JSON.parse(row.eligibleYears || "[]"),
      isBookmarked: Boolean(row.isBookmarked),
      hasApplied: Boolean(row.hasApplied),
    }));
  },

  /**
   * Paged wrapper around getOpportunities.
   *
   * The catalogue holds tens of thousands of active rows, so the UI has to be
   * able to page through it — returning a bare array capped at the default 20
   * made the rest of the catalogue unreachable. `hasMore` is derived from a
   * full page of results rather than a COUNT(*), which would mean a second scan
   * of a large FTS-joined query on every keystroke.
   */
  getOpportunitiesPage(options) {
    const limit = clampCareerPageLimit(options?.limit);
    const page = clampCareerPage(options?.page);
    const items = this.getOpportunities({ ...options, limit, page });

    return { items, page, limit, hasMore: items.length === limit };
  },

  getDeadlineSoonBookmarked(user, days = 3) {
    this._ensureAuthenticatedUser(user);
    const d = Number.parseInt(String(days), 10);
    const windowDays = Number.isFinite(d) && d > 0 ? d : 3;
    return this.getOpportunities({
      sort: "deadline",
      limit: 50,
      page: 1,
      user,
      bookmarkedOnly: true,
      expiringWithinDays: windowDays,
    });
  },

  getCareerStats() {
    const byType = this.db
      .prepare(
        "SELECT type, COUNT(*) as count FROM career_opportunities WHERE isActive = 1 GROUP BY type"
      )
      .all();
    const bySource = this.db
      .prepare(
        "SELECT source, COUNT(*) as count FROM career_opportunities WHERE isActive = 1 GROUP BY source"
      )
      .all();
    const totalActive = this.db
      .prepare("SELECT COUNT(*) as count FROM career_opportunities WHERE isActive = 1")
      .get().count;
    const totalBookmarks = this.db.prepare("SELECT COUNT(*) as count FROM career_bookmarks").get().count;
    const totalApplications = this.db.prepare("SELECT COUNT(*) as count FROM career_applications").get().count;
    const newThisWeekRow = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM career_opportunities
         WHERE isActive = 1 AND (
           (postedAt IS NOT NULL AND datetime(postedAt) >= datetime('now', '-7 days'))
           OR (scrapedAt IS NOT NULL AND datetime(scrapedAt) >= datetime('now', '-7 days'))
         )`
      )
      .get();
    return {
      byType,
      bySource,
      totalActive,
      totalBookmarks,
      totalApplications,
      newThisWeek: newThisWeekRow.count,
    };
  },

  hasCareerNotificationLog(userId, kind, refKey, sentDay) {
    const row = this.db
      .prepare(
        "SELECT 1 FROM career_notification_log WHERE userId = ? AND kind = ? AND refKey = ? AND sentDay = ?"
      )
      .get(userId, kind, refKey, sentDay);
    return Boolean(row);
  },

  recordCareerNotificationLog(userId, kind, refKey, sentDay) {
    const now = nowIso();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO career_notification_log (userId, kind, refKey, sentDay, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(userId, kind, refKey, sentDay, now);
  },

  getBookmarkDeadlineReminderCandidates(withinDays = 3) {
    const d = Number.parseInt(String(withinDays), 10);
    const days = Number.isFinite(d) && d > 0 ? d : 3;
    return this.db
      .prepare(
        `SELECT DISTINCT b.userId as userId, o.id as opportunityId, o.title as title, o.deadline as deadline
         FROM career_bookmarks b
         JOIN career_opportunities o ON o.id = b.opportunityId
         WHERE o.isActive = 1 AND o.deadline IS NOT NULL
           AND datetime(o.deadline) > datetime('now')
           AND datetime(o.deadline) <= datetime('now', ?)`
      )
      .all(`+${days} days`);
  },

  getSkillMatchDigestRows(sinceIso) {
    const profiles = this.db
      .prepare(
        `SELECT userId, skills FROM career_profiles
         WHERE skills IS NOT NULL AND TRIM(skills) != '' AND skills != '[]'`
      )
      .all();
    const opps = this.db
      .prepare(
        `SELECT id, skills FROM career_opportunities
         WHERE isActive = 1 AND moderationState = 0
           AND datetime(COALESCE(NULLIF(NULLIF(TRIM(postedAt), ''), ''), scrapedAt)) >= datetime(?)`
      )
      .all(sinceIso);

    const rows = [];
    for (const p of profiles) {
      let userSkills;
      try {
        userSkills = new Set(JSON.parse(p.skills || "[]").map((s) => String(s).toLowerCase()));
      } catch {
        continue;
      }
      if (!userSkills.size) continue;
      let count = 0;
      for (const o of opps) {
        let oppSkills;
        try {
          oppSkills = JSON.parse(o.skills || "[]").map((s) => String(s).toLowerCase());
        } catch {
          continue;
        }
        if (oppSkills.some((s) => userSkills.has(s))) count += 1;
      }
      if (count > 0) rows.push({ userId: p.userId, count });
    }
    return rows;
  },

  getTrendingOpportunities(user, limit = 12) {
    this._ensureAuthenticatedUser(user);
    const lim = Math.min(50, Math.max(1, Number.parseInt(String(limit), 10) || 12));
    const rows = this.db
      .prepare(
        `
      SELECT o.*,
        (
          (SELECT COUNT(*) FROM career_views v
           WHERE v.opportunityId = o.id AND datetime(v.viewedAt) >= datetime('now', '-7 days'))
          + 3 * (SELECT COUNT(*) FROM career_bookmarks b
           WHERE b.opportunityId = o.id AND datetime(b.createdAt) >= datetime('now', '-7 days'))
        ) AS trendScore,
             (SELECT 1 FROM career_bookmarks b2 WHERE b2.opportunityId = o.id AND b2.userId = ?) as isBookmarked,
             (SELECT 1 FROM career_applications a WHERE a.opportunityId = o.id AND a.userId = ?) as hasApplied
      FROM career_opportunities o
      WHERE o.isActive = 1 AND o.moderationState = 0
        AND NOT EXISTS (SELECT 1 FROM career_dismissals d WHERE d.opportunityId = o.id AND d.userId = ?)
      ORDER BY trendScore DESC, o.relevanceScore DESC
      LIMIT ?
    `
      )
      .all(user.userId, user.userId, user.userId, lim);

    return rows.map((row) => ({
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      eligibleBranches: JSON.parse(row.eligibleBranches || "[]"),
      eligibleYears: JSON.parse(row.eligibleYears || "[]"),
      isBookmarked: Boolean(row.isBookmarked),
      hasApplied: Boolean(row.hasApplied),
    }));
  },

  getSimilarOpportunities(opportunityId, user, limit = 6) {
    this._ensureAuthenticatedUser(user);
    const base = this.getOpportunity(opportunityId, user);
    if (!base) return [];
    const lim = Math.min(20, Math.max(1, Number.parseInt(String(limit), 10) || 6));
    const rows = this.db
      .prepare(
        `
      SELECT o.*,
             (SELECT 1 FROM career_bookmarks b WHERE b.opportunityId = o.id AND b.userId = ?) as isBookmarked,
             (SELECT 1 FROM career_applications a WHERE a.opportunityId = o.id AND a.userId = ?) as hasApplied
      FROM career_opportunities o
      WHERE o.isActive = 1 AND o.moderationState = 0
        AND o.id != ?
        AND o.type = ?
        AND NOT EXISTS (
          SELECT 1 FROM career_dismissals d WHERE d.opportunityId = o.id AND d.userId = ?
        )
      ORDER BY o.relevanceScore DESC, o.postedAt DESC
      LIMIT ?
    `
      )
      .all(user.userId, user.userId, opportunityId, base.type, user.userId, lim);

    return rows.map((row) => ({
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      eligibleBranches: JSON.parse(row.eligibleBranches || "[]"),
      eligibleYears: JSON.parse(row.eligibleYears || "[]"),
      isBookmarked: Boolean(row.isBookmarked),
      hasApplied: Boolean(row.hasApplied),
    }));
  },

  getOpportunity(id, user) {
    this._ensureAuthenticatedUser(user);
    const sql = `
      SELECT o.*, 
             (SELECT 1 FROM career_bookmarks b WHERE b.opportunityId = o.id AND b.userId = ?) as isBookmarked,
             (SELECT 1 FROM career_applications a WHERE a.opportunityId = o.id AND a.userId = ?) as hasApplied
      FROM career_opportunities o
      WHERE o.id = ? AND o.isActive = 1 AND o.moderationState = 0
    `;
    const row = this.db.prepare(sql).get(user.userId, user.userId, id);
    if (!row) return null;

    return {
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      eligibleBranches: JSON.parse(row.eligibleBranches || "[]"),
      eligibleYears: JSON.parse(row.eligibleYears || "[]"),
      isBookmarked: Boolean(row.isBookmarked),
      hasApplied: Boolean(row.hasApplied)
    };
  }
};

// --- health.js ---
const healthMethods = {
  getScraperHealth() {
    return this.db.prepare("SELECT * FROM career_source_health").all();
  },

  getScraperRuns(limit = 10) {
    return this.db.prepare("SELECT * FROM career_scraper_runs ORDER BY startedAt DESC LIMIT ?").all(limit);
  },

  /** Admin scraper-status view: latest run + breaker state + DB counts per source. */
  getScraperStatus() {
    const health = this.db.prepare("SELECT * FROM career_source_health").all();
    const runs = this.db
      .prepare("SELECT * FROM career_scraper_runs ORDER BY startedAt DESC LIMIT 200")
      .all();
    const counts = this.db
      .prepare(
        `SELECT source,
                COUNT(*) AS total,
                SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS active
         FROM career_opportunities GROUP BY source`
      )
      .all();

    const latestRunBySource = new Map();
    for (const run of runs) {
      if (!latestRunBySource.has(run.source)) latestRunBySource.set(run.source, run);
    }
    const countBySource = new Map(counts.map((c) => [c.source, c]));
    const healthBySource = new Map(health.map((h) => [h.source, h]));

    const sources = [
      ...new Set([
        ...latestRunBySource.keys(),
        ...healthBySource.keys(),
        ...countBySource.keys(),
      ]),
    ]
      .sort()
      .map((source) => {
        const healthRow = healthBySource.get(source);
        const countsRow = countBySource.get(source);
        return {
          source,
          lastRun: latestRunBySource.get(source) || null,
          consecutiveFails: healthRow ? healthRow.consecutiveFails : 0,
          isBlocked: Boolean(healthRow && healthRow.isBlocked),
          lastSuccess: (healthRow && healthRow.lastSuccess) || null,
          lastAttempt: (healthRow && healthRow.lastAttempt) || null,
          notes: (healthRow && healthRow.notes) || "",
          totalOpportunities: countsRow ? countsRow.total : 0,
          activeOpportunities: countsRow ? countsRow.active : 0,
        };
      });

    return { sources, generatedAt: nowIso() };
  }
};

// --- interviews.js ---
const interviewMethods = {
  listInterviewSlots({ user }) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_interview_slots 
      ORDER BY date, startTime
    `).all();

    return rows.map(row => ({
      ...row,
      isBooked: Boolean(row.isBooked),
    }));
  },

  createInterviewSlot(data, user) {
    this._ensureAuthenticatedUser(user);
    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_interview_slots (
        id, interviewerId, interviewerName, date, startTime, endTime, duration,
        type, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.userId,
      user.name || "Unknown",
      data.date,
      data.startTime,
      data.endTime,
      data.duration,
      data.type,
      data.notes || "",
      now,
      now
    );

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  updateInterviewSlot(id, data, user) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    
    this.db.prepare(`
      UPDATE career_interview_slots SET
        date = COALESCE(?, date),
        startTime = COALESCE(?, startTime),
        endTime = COALESCE(?, endTime),
        duration = COALESCE(?, duration),
        type = COALESCE(?, type),
        notes = COALESCE(?, notes),
        updatedAt = ?
      WHERE id = ? AND interviewerId = ?
    `).run(
      data.date,
      data.startTime,
      data.endTime,
      data.duration,
      data.type,
      data.notes,
      now,
      id,
      user.userId
    );

    return { updated: true };
  },

  deleteInterviewSlot(id, user) {
    this._ensureAuthenticatedUser(user);
    this.db.prepare("DELETE FROM career_interview_slots WHERE id = ? AND interviewerId = ?").run(id, user.userId);
    return { deleted: true };
  },

  listInterviewBookings({ user }) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_interview_bookings 
      WHERE studentId = ? OR interviewerId = ?
      ORDER BY date, startTime
    `).all(user.userId, user.userId);

    return rows;
  },

  bookInterviewSlot(data, user) {
    this._ensureAuthenticatedUser(user);
    
    // Check if slot exists and is not booked
    const slot = this.db.prepare("SELECT * FROM career_interview_slots WHERE id = ?").get(data.slotId);
    if (!slot) {
      const error = new Error("Interview slot not found");
      error.status = 404;
      throw error;
    }
    if (slot.isBooked) {
      const error = new Error("Interview slot is already booked");
      error.status = 409;
      throw error;
    }

    const id = randomUUID();
    const now = nowIso();
    
    // Book the slot
    this.db.prepare(`
      INSERT INTO career_interview_bookings (
        id, slotId, studentId, studentName, interviewerId, interviewerName,
        date, startTime, endTime, type, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.slotId,
      user.userId,
      user.name || "Unknown",
      slot.interviewerId,
      slot.interviewerName,
      slot.date,
      slot.startTime,
      slot.endTime,
      slot.type,
      data.notes || "",
      now,
      now
    );

    // Mark slot as booked
    this.db.prepare("UPDATE career_interview_slots SET isBooked = 1, bookedBy = ?, bookedByName = ? WHERE id = ?")
      .run(user.userId, user.name || "Unknown", data.slotId);

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  cancelInterviewBooking(bookingId, user) {
    this._ensureAuthenticatedUser(user);
    
    const booking = this.db.prepare("SELECT * FROM career_interview_bookings WHERE id = ?").get(bookingId);
    if (!booking) {
      const error = new Error("Interview booking not found");
      error.status = 404;
      throw error;
    }
    
    if (booking.studentId !== user.userId && booking.interviewerId !== user.userId) {
      const error = new Error("Not authorized to cancel this booking");
      error.status = 403;
      throw error;
    }

    // Delete booking
    this.db.prepare("DELETE FROM career_interview_bookings WHERE id = ?").run(bookingId);
    
    // Free up the slot
    this.db.prepare("UPDATE career_interview_slots SET isBooked = 0, bookedBy = NULL, bookedByName = NULL WHERE id = ?")
      .run(booking.slotId);

    return { cancelled: true };
  }
};

// --- opportunityActions.js ---

const opportunityActionMethods = {
  createOpportunity(data, user) {
    // Only allow moderators/admin to create opportunities
    if (!user.hasAdminAccess && !user.role?.toLowerCase().includes('moderator')) {
      const error = new Error("Not authorized to create opportunities");
      error.status = 403;
      throw error;
    }

    const title = toSafeString(data.title);
    const type = normalizeOpportunityType(data.type);
    const company = toSafeString(data.company || data.organization);
    const organizer = toSafeString(data.organizer);
    const applyUrl = toSafeString(data.applyUrl || data.link || data.sourceUrl);
    if (!title || !applyUrl || !/^https:\/\//i.test(applyUrl)) {
      const error = new Error("Title and https apply URL are required");
      error.status = 400;
      throw error;
    }
    const fingerprint = createOpportunityFingerprint({ title, company, organizer, applyUrl });
    const duplicate = this.db
      .prepare("SELECT id FROM career_opportunities WHERE sourceUrl = ? OR applyUrl = ? OR fingerprint = ? LIMIT 1")
      .get(applyUrl, applyUrl, fingerprint);
    if (duplicate) {
      const error = new Error("This opportunity already exists in the public catalog");
      error.status = 409;
      error.code = "CAREER_DUPLICATE_OPPORTUNITY";
      throw error;
    }

    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_opportunities (
        id, type, title, company, organizer, description, shortDescription, requirements,
        skills, tags, location, mode, isPanIndia, eligibleBranches, eligibleYears,
        minCGPA, stipend, prize, isFree, postedAt, deadline, startDate, duration,
        source, sourceUrl, applyUrl, fingerprint, scrapedAt, updatedAt, isActive, isVerified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      id,
      type,
      title,
      company || null,
      organizer || null,
      data.description || null,
      data.shortDescription || null,
      data.requirements || null,
      JSON.stringify(normalizeStringList(data.skills)),
      JSON.stringify(normalizeStringList(data.tags)),
      data.location || null,
      data.mode || null,
      data.isPanIndia ? 1 : 0,
      JSON.stringify(normalizeStringList(data.eligibleBranches)),
      JSON.stringify(normalizeStringList(data.eligibleYears)),
      data.minCGPA || null,
      data.stipend || null,
      data.prize || null,
      data.isFree !== false ? 1 : 0,
      data.postedAt || now,
      data.deadline || null,
      data.startDate || null,
      data.duration || null,
      data.source || "manual",
      applyUrl,
      applyUrl,
      fingerprint,
      now,
      now
    );

    return this.getOpportunity(id, user);
  },

  updateOpportunity(id, data, user) {
    // Only allow moderators/admin to update opportunities
    if (!user.hasAdminAccess && !user.role?.toLowerCase().includes('moderator')) {
      const error = new Error("Not authorized to update opportunities");
      error.status = 403;
      throw error;
    }

    const now = nowIso();
    
    this.db.prepare(`
      UPDATE career_opportunities SET
        type = COALESCE(?, type),
        title = COALESCE(?, title),
        company = COALESCE(?, company),
        organizer = COALESCE(?, organizer),
        description = COALESCE(?, description),
        shortDescription = COALESCE(?, shortDescription),
        requirements = COALESCE(?, requirements),
        skills = COALESCE(?, skills),
        tags = COALESCE(?, tags),
        location = COALESCE(?, location),
        mode = COALESCE(?, mode),
        isPanIndia = COALESCE(?, isPanIndia),
        eligibleBranches = COALESCE(?, eligibleBranches),
        eligibleYears = COALESCE(?, eligibleYears),
        minCGPA = COALESCE(?, minCGPA),
        stipend = COALESCE(?, stipend),
        prize = COALESCE(?, prize),
        isFree = COALESCE(?, isFree),
        deadline = COALESCE(?, deadline),
        startDate = COALESCE(?, startDate),
        duration = COALESCE(?, duration),
        sourceUrl = COALESCE(?, sourceUrl),
        applyUrl = COALESCE(?, applyUrl),
        updatedAt = ?
      WHERE id = ?
    `).run(
      data.type,
      data.title,
      data.company,
      data.organizer,
      data.description,
      data.shortDescription,
      data.requirements,
      data.skills ? JSON.stringify(data.skills) : null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.location,
      data.mode,
      data.isPanIndia !== undefined ? (data.isPanIndia ? 1 : 0) : null,
      data.eligibleBranches ? JSON.stringify(data.eligibleBranches) : null,
      data.eligibleYears ? JSON.stringify(data.eligibleYears) : null,
      data.minCGPA,
      data.stipend,
      data.prize,
      data.isFree !== undefined ? (data.isFree ? 1 : 0) : null,
      data.deadline,
      data.startDate,
      data.duration,
      data.sourceUrl,
      data.applyUrl,
      now,
      id
    );

    return { updated: true };
  },

  deleteOpportunity(id, user) {
    // Only allow moderators/admin to delete opportunities
    if (!user.hasAdminAccess && !user.role?.toLowerCase().includes('moderator')) {
      const error = new Error("Not authorized to delete opportunities");
      error.status = 403;
      throw error;
    }

    this.db.prepare("DELETE FROM career_opportunities WHERE id = ?").run(id);
    return { deleted: true };
  },

  saveOpportunity(id, user) {
    this._ensureAuthenticatedUser(user);
    this._ensureActiveOpportunityId(id);
    
    const existing = this.db.prepare("SELECT 1 FROM career_bookmarks WHERE opportunityId = ? AND userId = ?")
      .get(id, user.userId);

    if (!existing) {
      const now = nowIso();
      this.db.prepare("INSERT INTO career_bookmarks (opportunityId, userId, createdAt) VALUES (?, ?, ?)")
        .run(id, user.userId, now);
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = bookmarkCount + 1 WHERE id = ?")
        .run(id);
    }

    return { saved: true };
  },

  unsaveOpportunity(id, user) {
    this._ensureAuthenticatedUser(user);
    
    const existing = this.db.prepare("SELECT 1 FROM career_bookmarks WHERE opportunityId = ? AND userId = ?")
      .get(id, user.userId);

    if (existing) {
      this.db.prepare("DELETE FROM career_bookmarks WHERE opportunityId = ? AND userId = ?")
        .run(id, user.userId);
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = MAX(0, bookmarkCount - 1) WHERE id = ?")
        .run(id);
    }

    return { unsaved: true };
  },

  applyToOpportunity(id, data, user) {
    this._ensureAuthenticatedUser(user);
    this._ensureActiveOpportunityId(id);
    
    // Check if already applied
    const existing = this.db.prepare("SELECT 1 FROM career_applications WHERE opportunityId = ? AND userId = ?")
      .get(id, user.userId);

    if (existing) {
      const error = new Error("Already applied to this opportunity");
      error.status = 409;
      throw error;
    }

    const appId = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_applications (id, opportunityId, userId, appliedAt, notes, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(appId, id, user.userId, now, data.notes || "", now);

    this.db.prepare("UPDATE career_opportunities SET applyCount = applyCount + 1 WHERE id = ?").run(id);

    return { applied: true, id: appId };
  },

  bookmarkOpportunity(opportunityId, userId) {
    this._ensureActiveOpportunityId(opportunityId);
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_bookmarks WHERE opportunityId = ? AND userId = ?")
      .get(opportunityId, userId);

    if (existing) {
      this.db.prepare("DELETE FROM career_bookmarks WHERE opportunityId = ? AND userId = ?")
        .run(opportunityId, userId);
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = MAX(0, bookmarkCount - 1) WHERE id = ?")
        .run(opportunityId);
      return { bookmarked: false };
    } else {
      this.db.prepare("INSERT INTO career_bookmarks (opportunityId, userId, createdAt) VALUES (?, ?, ?)")
        .run(opportunityId, userId, now);
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = bookmarkCount + 1 WHERE id = ?")
        .run(opportunityId);
      return { bookmarked: true };
    }
  },

  dismissOpportunity(opportunityId, userId) {
    this._ensureActiveOpportunityId(opportunityId);
    const now = nowIso();
    this.db.prepare("INSERT OR IGNORE INTO career_dismissals (opportunityId, userId, createdAt) VALUES (?, ?, ?)")
      .run(opportunityId, userId, now);
    return { dismissed: true };
  },

  trackView(opportunityId, userId) {
    this._ensureActiveOpportunityId(opportunityId);
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_views WHERE opportunityId = ? AND userId = ?")
      .get(opportunityId, userId);
    
    if (!existing) {
      this.db.prepare("INSERT INTO career_views (opportunityId, userId, viewedAt) VALUES (?, ?, ?)")
        .run(opportunityId, userId, now);
      this.db.prepare("UPDATE career_opportunities SET viewCount = viewCount + 1 WHERE id = ?")
        .run(opportunityId);
    }
    return { tracked: true };
  },

  trackApply(opportunityId, userId, notes) {
    this._ensureActiveOpportunityId(opportunityId);
    this.db.prepare("UPDATE career_opportunities SET applyCount = applyCount + 1 WHERE id = ?").run(opportunityId);
    if (notes) {
      this.createApplication(userId, opportunityId, notes);
    }
    return { tracked: true, applied: true };
  },

  flagOpportunity(opportunityId, userId, reason) {
    this._ensureActiveOpportunityId(opportunityId);
    const id = randomUUID();
    const now = nowIso();
    this.db.prepare("INSERT OR IGNORE INTO career_flags (id, opportunityId, userId, reason, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(id, opportunityId, userId, reason, now);
    return { flagged: true };
  },

  createApplication(userId, opportunityId, notes) {
    this._ensureActiveOpportunityId(opportunityId);
    const id = randomUUID();
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO career_applications (id, opportunityId, userId, status, appliedAt, notes, updatedAt)
      VALUES (?, ?, ?, 'interested', ?, ?, ?)
    `)
    .run(id, opportunityId, userId, now, notes || "", now);
    return { id, status: 'interested' };
  },

  updateApplicationStatus(id, userId, status, notes) {
    const st = toSafeString(status).toLowerCase();
    if (!APPLICATION_STATUSES.has(st)) {
      const error = new Error("Invalid application status");
      error.status = 400;
      throw error;
    }
    // Validate state transition
    const currentRow = this.db.prepare("SELECT status FROM career_applications WHERE id = ? AND userId = ?").get(id, userId);
    if (currentRow && currentRow.status !== st) {
      const allowed = VALID_APPLICATION_TRANSITIONS[currentRow.status];
      if (!allowed || !allowed.includes(st)) {
        const error = new Error(`Cannot transition from ${currentRow.status} to ${st}`);
        error.status = 409;
        throw error;
      }
    }
    const now = nowIso();
    
    if (st === 'applied') {
      this.db.prepare(`
        UPDATE career_applications 
        SET status = ?, notes = COALESCE(?, notes), updatedAt = ?, appliedAt = ?
        WHERE id = ? AND userId = ?
      `)
      .run(st, notes === undefined ? null : notes, now, now, id, userId);
    } else {
      this.db.prepare(`
        UPDATE career_applications 
        SET status = ?, notes = COALESCE(?, notes), updatedAt = ?
        WHERE id = ? AND userId = ?
      `)
      .run(st, notes === undefined ? null : notes, now, id, userId);
    }
    
    return { updated: true };
  },

  getApplications(userId) {
    const sql = `
      SELECT a.*, COALESCE(o.title, '(Unavailable)') as opportunityTitle, o.company, o.type
      FROM career_applications a
      LEFT JOIN career_opportunities o ON a.opportunityId = o.id
      WHERE a.userId = ?
      ORDER BY a.appliedAt DESC
    `;
    return this.db.prepare(sql).all(userId);
  },

  deleteApplication(id, userId) {
    this.db.prepare("DELETE FROM career_applications WHERE id = ? AND userId = ?")
      .run(id, userId);
    return { deleted: true };
  }
};

// --- profile.js ---
const profileMethods = {
  getProfile(user) {
    this._ensureAuthenticatedUser(user);
    const row = this.db.prepare("SELECT * FROM career_profiles WHERE userId = ?").get(user.userId);
    if (!row) {
      // Return a default profile if not found
      return {
        userId: user.userId,
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        minStipend: "",
        cgpa: null,
        bio: "",
        linkedinUrl: "",
        githubUrl: "",
        portfolioUrl: "",
        resumeUrl: "",
        resumeFileName: "",
        updatedAt: nowIso()
      };
    }

    return {
      ...row,
      skills: JSON.parse(row.skills || "[]"),
      preferredTypes: JSON.parse(row.preferredTypes || "[]"),
      preferredLocations: JSON.parse(row.preferredLocations || "[]")
    };
  },

  updateProfile(user, data) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_profiles WHERE userId = ?").get(user.userId);

    if (existing) {
      this.db.prepare(`
        UPDATE career_profiles SET
          skills = ?,
          preferredTypes = ?,
          preferredLocations = ?,
          minStipend = ?,
          cgpa = ?,
          bio = ?,
          linkedinUrl = ?,
          githubUrl = ?,
          portfolioUrl = ?,
          updatedAt = ?
        WHERE userId = ?
      `).run(
        JSON.stringify(data.skills || []),
        JSON.stringify(data.preferredTypes || []),
        JSON.stringify(data.preferredLocations || []),
        toSafeString(data.minStipend),
        data.cgpa || null,
        toSafeString(data.bio),
        toSafeString(data.linkedinUrl),
        toSafeString(data.githubUrl),
        toSafeString(data.portfolioUrl),
        now,
        user.userId
      );
    } else {
      this.db.prepare(`
        INSERT INTO career_profiles (
          userId, skills, preferredTypes, preferredLocations, minStipend,
          cgpa, bio, linkedinUrl, githubUrl, portfolioUrl, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.userId,
        JSON.stringify(data.skills || []),
        JSON.stringify(data.preferredTypes || []),
        JSON.stringify(data.preferredLocations || []),
        toSafeString(data.minStipend),
        data.cgpa || null,
        toSafeString(data.bio),
        toSafeString(data.linkedinUrl),
        toSafeString(data.githubUrl),
        toSafeString(data.portfolioUrl),
        now
      );
    }

    // Recompute skill gaps after profile update
    this._recomputeSkillGaps(user.userId, data.skills || []);

    return { updated: true };
  },

  updateResume(userId, resumeUrl, resumeFileName) {
    const now = nowIso();
    const existing = this.db.prepare("SELECT 1 FROM career_profiles WHERE userId = ?").get(userId);
    
    if (existing) {
      this.db.prepare(`
        UPDATE career_profiles SET
          resumeUrl = ?,
          resumeFileName = ?,
          updatedAt = ?
        WHERE userId = ?
      `).run(resumeUrl, resumeFileName, now, userId);
    } else {
      this.db.prepare(`
        INSERT INTO career_profiles (
          userId, resumeUrl, resumeFileName, updatedAt
        ) VALUES (?, ?, ?, ?)
      `).run(userId, resumeUrl, resumeFileName, now);
    }
    return { updated: true };
  },

  getSkillGaps(user) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db.prepare(`
      SELECT * FROM career_skill_gaps 
      WHERE userId = ? 
      ORDER BY opportunityCount DESC
    `).all(user.userId);
    return rows;
  },

  _recomputeSkillGaps(userId, userSkills) {
    const now = nowIso();
    // Compare and store canonical skill names so "aws" / "AWS" / "Amazon Web
    // Services" collapse to one gap displayed as "AWS".
    const haveSet = new Set(canonicalizeSkills(userSkills).map((s) => s.toLowerCase()));

    const opps = this.db.prepare("SELECT skills FROM career_opportunities WHERE isActive = 1").all();
    const gapMap = new Map(); // canonical-lowercase -> { skill, count }

    for (const opp of opps) {
      for (const skill of canonicalizeSkills(JSON.parse(opp.skills || "[]"))) {
        const key = skill.toLowerCase();
        if (haveSet.has(key)) continue;
        const entry = gapMap.get(key) || { skill, count: 0 };
        entry.count += 1;
        gapMap.set(key, entry);
      }
    }

    // Clear old gaps and insert new ones in a single transaction
    const clearStmt = this.db.prepare("DELETE FROM career_skill_gaps WHERE userId = ?");
    const insert = this.db.prepare(`
      INSERT INTO career_skill_gaps (userId, skill, opportunityCount, updatedAt, gapLevel)
      VALUES (?, ?, ?, ?, 'missing')
    `);

    const sortedGaps = Array.from(gapMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      clearStmt.run(userId);
      for (const { skill, count } of sortedGaps) {
        insert.run(userId, skill, count, now);
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
};

// --- resume.js ---
const COMMON_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Java",
  "C++",
  "SQL",
  "MongoDB",
  "Docker",
  "Kubernetes",
  "AWS",
  "Git",
  "Linux",
  "Machine Learning",
  "TensorFlow",
  "Data Analysis",
  "Figma",
  "REST API",
  "GraphQL",
  "HTML",
  "CSS",
];

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const clean = toSafeString(value);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function normalizedSet(values) {
  return new Set(ensureArray(values).map((value) => String(value).toLowerCase().trim()).filter(Boolean));
}

const resumeMethods = {
  _resumeSkillLexicon() {
    const skills = [...CANONICAL_SKILLS, ...COMMON_SKILLS];
    try {
      const rows = this.db.prepare("SELECT skills FROM career_opportunities WHERE isActive = 1").all();
      for (const row of rows) {
        skills.push(...parseJson(row.skills, []));
      }
    } catch {
      // Keep parser useful even before opportunities are seeded.
    }
    return uniqueStrings(skills);
  },

  /**
   * Structured résumé parse — thin adapter over `resumeParse.parseResume`,
   * feeding it the live opportunity-skill lexicon so skills required by active
   * listings are matched even when only mentioned in a bullet.
   */
  _parseResumeText(text) {
    return parseResume(text, { lexicon: this._resumeSkillLexicon() });
  },

  /**
   * @param parsed  output of `_parseResumeText`
   * @param ctx     { profileSkills[], skillGaps[{skill,opportunityCount}], preferredTypes[] }
   * Returns { score, rubric, suggestions } where suggestions is an ordered list
   * of { tip, priority, category } — first item is the single biggest win.
   */
  _scoreResume(parsed, ctx = {}) {
    const profileSkills = ensureArray(ctx.profileSkills).map((s) => String(s).toLowerCase());
    const skillGaps = ensureArray(ctx.skillGaps);
    const preferredTypes = ensureArray(ctx.preferredTypes).map((t) => String(t).toLowerCase());

    const sectionCount = ensureArray(parsed.sections).length;
    const skillCount = ensureArray(parsed.skills).length;
    const projectCount = ensureArray(parsed.projects).length;
    const impactCount = ensureArray(parsed.quantifiedImpacts).length;
    const experienceCount = ensureArray(parsed.experience).length;
    const thinEntries = [...ensureArray(parsed.projects), ...ensureArray(parsed.experience)].filter(
      (e) => (e.bulletCount || 0) < 2,
    ).length;
    const resumeSkillsLower = new Set(ensureArray(parsed.skills).map((s) => String(s).toLowerCase()));
    const overlap = profileSkills.filter((s) => resumeSkillsLower.has(s)).length;
    const overlapRatio = profileSkills.length ? overlap / profileSkills.length : 0;
    const missingLinks = [
      parsed.hasGithub ? null : "GitHub",
      parsed.hasLinkedin ? null : "LinkedIn",
      parsed.hasPortfolio ? null : "a portfolio",
    ].filter(Boolean);

    const rubric = [
      {
        key: "structure",
        label: "Resume structure",
        score:
          sectionCount >= 4 && parsed.wordCount >= 150 ? 20
            : sectionCount >= 3 || parsed.wordCount >= 120 ? 13
              : parsed.wordCount >= 60 ? 7
                : 3,
        max: 20,
        reason:
          sectionCount >= 4
            ? `Clear structure — ${sectionCount} standard sections detected.`
            : `Only ${sectionCount} standard section${sectionCount === 1 ? "" : "s"} detected.`,
        tip: "Add clearly labelled sections: Experience, Projects, Skills, Education.",
      },
      {
        key: "skills",
        label: "Skill coverage",
        score: skillCount >= 12 ? 20 : skillCount >= 6 ? 15 : skillCount >= 1 ? 8 : 0,
        max: 20,
        reason: skillCount ? `${skillCount} distinct skills detected.` : "No recognizable skills detected.",
        tip:
          skillCount >= 6
            ? "Group skills under headings (Languages, Frameworks, Tools) for readability."
            : "Add a Technical Skills section listing languages, frameworks and tools.",
      },
      {
        key: "projects",
        label: "Project evidence",
        score: projectCount >= 3 ? 15 : projectCount === 2 ? 11 : projectCount === 1 ? 6 : 0,
        max: 15,
        reason: projectCount
          ? `${projectCount} project${projectCount === 1 ? "" : "s"} detected.`
          : "No projects detected.",
        tip: "Add a Projects section with 2-3 concrete builds and their impact.",
      },
      {
        key: "detail",
        label: "Entry detail",
        score: (() => {
          const entries = projectCount + experienceCount;
          if (!entries) return 0;
          return Math.round(10 * (1 - thinEntries / entries));
        })(),
        max: 10,
        reason: thinEntries
          ? `${thinEntries} project/role${thinEntries === 1 ? "" : "s"} have fewer than 2 bullet points.`
          : "Every project and role has supporting bullets.",
        tip: "Give each project and role at least 2-3 result-oriented bullet points.",
      },
      {
        key: "impact",
        label: "Quantified impact",
        score: Math.min(15, impactCount * 4),
        max: 15,
        reason: impactCount
          ? `${impactCount} quantified outcome${impactCount === 1 ? "" : "s"}.`
          : "No quantified outcomes.",
        tip: "Back up bullets with numbers — %, users served, latency, revenue.",
      },
      {
        key: "links",
        label: "Portfolio links",
        score: Math.min(15, (parsed.hasGithub ? 6 : 0) + (parsed.hasLinkedin ? 6 : 0) + (parsed.hasPortfolio ? 3 : 0)),
        max: 15,
        reason: missingLinks.length
          ? `Missing ${missingLinks.join(", ")} link${missingLinks.length === 1 ? "" : "s"}.`
          : "GitHub, LinkedIn and portfolio links are present.",
        tip: "Add GitHub, LinkedIn and portfolio links to your header.",
      },
      {
        key: "target",
        label: "Profile alignment",
        score: profileSkills.length === 0 ? 10 : overlapRatio >= 0.5 ? 15 : overlapRatio >= 0.25 ? 10 : 5,
        max: 15,
        reason:
          profileSkills.length === 0
            ? "Add skills to your Career profile so we can compare."
            : `${overlap} of your ${profileSkills.length} profile skills appear on the résumé.`,
        tip: "Merge the résumé skills into your Career profile so opportunity matching improves.",
      },
    ];

    // Normalise to /100 (rubric maxes sum to 110 after adding "detail").
    const rawScore = rubric.reduce((sum, item) => sum + item.score, 0);
    const rawMax = rubric.reduce((sum, item) => sum + item.max, 0);
    const score = Math.round((rawScore / rawMax) * 100);

    // Ordered suggestions: rubric gaps by (missed points), then career-fit items.
    const suggestions = rubric
      .filter((item) => item.score < item.max * 0.7)
      .sort((a, b) => b.max - b.score - (a.max - a.score))
      .map((item) => ({
        tip: item.tip,
        category: item.key,
        priority: item.max - item.score >= item.max * 0.6 ? "high" : "medium",
      }));

    const gapMissing = skillGaps
      .map((g) => String(g.skill || ""))
      .filter((s) => s && isKnownSkill(s) && !resumeSkillsLower.has(s.toLowerCase()))
      .map((s) => canonicalizeSkill(s))
      .slice(0, 5);
    if (gapMissing.length) {
      suggestions.unshift({
        tip: `Add ${gapMissing.length} in-demand skill${gapMissing.length === 1 ? "" : "s"} your résumé is missing: ${gapMissing.join(", ")}.`,
        category: "career-fit",
        priority: "high",
      });
    }
    if (experienceCount === 0 && preferredTypes.some((t) => /job|intern/.test(t))) {
      suggestions.push({
        tip: "You're targeting jobs/internships — add a Work Experience section, even for projects, freelance or open-source work.",
        category: "career-fit",
        priority: "medium",
      });
    }
    if (profileSkills.length && skillCount && overlapRatio < 0.3) {
      suggestions.push({
        tip: "Your résumé and Career profile skills barely overlap — use “Merge to Profile” to align them.",
        category: "career-fit",
        priority: "medium",
      });
    }

    return { score, rubric, suggestions: suggestions.slice(0, 6) };
  },

  _mapResumeVersion(row) {
    if (!row) return null;
    return {
      ...row,
      parsedJson: parseJson(row.parsedJson, {}),
      qualityScore: Number(row.qualityScore || 0),
    };
  },

  createResumeVersion(user, payload = {}) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    const extractedText = toSafeString(payload.extractedText || payload.resumeText || payload.text);
    const fileName = toSafeString(payload.fileName) || "uploaded-resume.txt";
    const filePath =
      toSafeString(payload.filePath || payload.resumeUrl) ||
      `/uploads/resumes/${encodeURIComponent(user.userId)}-${Date.now()}-${encodeURIComponent(fileName)}`;
    const mimeType = toSafeString(payload.mimeType) || "text/plain";
    const profile = this.getProfile(user);
    const parsed = this._parseResumeText(extractedText);
    const quality = this._scoreResume(parsed, this._resumeScoreContext(user, profile));
    const id = randomUUID();

    this.db
      .prepare(
        `INSERT INTO resume_versions (
          id, userId, fileName, filePath, mimeType, extractedText, parsedJson, qualityScore, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, user.userId, fileName, filePath, mimeType, extractedText, JSON.stringify(parsed), quality.score, now);

    this.updateResume(user.userId, filePath, fileName);
    return {
      ...this.getResumeVersion(user, id),
      analysis: quality,
    };
  },

  listResumeVersions(user) {
    this._ensureAuthenticatedUser(user);
    return this.db
      .prepare("SELECT * FROM resume_versions WHERE userId = ? ORDER BY createdAt DESC")
      .all(user.userId)
      .map((row) => this._mapResumeVersion(row));
  },

  getResumeVersion(user, resumeVersionId) {
    this._ensureAuthenticatedUser(user);
    const row = this.db
      .prepare("SELECT * FROM resume_versions WHERE id = ? AND userId = ?")
      .get(resumeVersionId, user.userId);
    if (!row) {
      const error = new Error("Resume version not found");
      error.status = 404;
      throw error;
    }
    return this._mapResumeVersion(row);
  },

  getLatestResumeVersion(user) {
    this._ensureAuthenticatedUser(user);
    const row = this.db
      .prepare("SELECT * FROM resume_versions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1")
      .get(user.userId);
    return this._mapResumeVersion(row);
  },

  deleteResumeVersion(user, resumeVersionId) {
    this._ensureAuthenticatedUser(user);
    const row = this.db
      .prepare("SELECT id FROM resume_versions WHERE id = ? AND userId = ?")
      .get(resumeVersionId, user.userId);
    if (!row) {
      const error = new Error("Resume version not found");
      error.status = 404;
      throw error;
    }
    this.db.prepare("DELETE FROM resume_versions WHERE id = ? AND userId = ?").run(resumeVersionId, user.userId);
    // Re-point the profile's résumé pointer at whatever is now newest (or clear it).
    const latest = this.getLatestResumeVersion(user);
    this.updateResume(user.userId, latest?.filePath || "", latest?.fileName || "");
    return { deleted: true, latest: latest || null };
  },

  analyzeResumeVersion(user, resumeVersionId) {
    const resume = this.getResumeVersion(user, resumeVersionId);
    const profile = this.getProfile(user);
    const analysis = this._scoreResume(resume.parsedJson || {}, this._resumeScoreContext(user, profile));
    return { resume, ...analysis };
  },

  _resumeScoreContext(user, profile) {
    let skillGaps = [];
    try {
      skillGaps = this.getSkillGaps(user);
    } catch {
      /* gaps are optional context */
    }
    return {
      profileSkills: ensureArray(profile && profile.skills),
      preferredTypes: ensureArray(profile && profile.preferredTypes),
      skillGaps,
    };
  },

  mergeResumeToProfile(user, resumeVersionId) {
    const resume = this.getResumeVersion(user, resumeVersionId);
    const profile = this.getProfile(user);
    const mergedSkills = uniqueStrings([...ensureArray(profile.skills), ...ensureArray(resume.parsedJson?.skills)]);
    this.updateProfile(user, {
      ...profile,
      skills: mergedSkills,
      linkedinUrl: profile.linkedinUrl || resume.parsedJson?.links?.find((link) => /linkedin\.com/i.test(link)) || "",
      githubUrl: profile.githubUrl || resume.parsedJson?.links?.find((link) => /github\.com/i.test(link)) || "",
    });
    return {
      updated: true,
      profile: this.getProfile(user),
      mergedSkills,
    };
  },

  getOpportunityFit(user, opportunityId, { resumeVersionId = "" } = {}) {
    this._ensureAuthenticatedUser(user);
    const opportunity = this.getOpportunity(opportunityId, user);
    if (!opportunity) {
      const error = new Error("Opportunity not found");
      error.status = 404;
      throw error;
    }

    const profile = this.getProfile(user);
    const resume = resumeVersionId ? this.getResumeVersion(user, resumeVersionId) : this.getLatestResumeVersion(user);
    const profileSkills = normalizedSet(profile.skills);
    const resumeSkills = normalizedSet(resume?.parsedJson?.skills || []);
    const combinedSkills = new Set([...profileSkills, ...resumeSkills]);
    const requiredSkills = ensureArray(opportunity.skills).map((skill) => toSafeString(skill)).filter(Boolean);
    const matchedSkills = requiredSkills.filter((skill) => combinedSkills.has(skill.toLowerCase()));
    const missingSkills = requiredSkills.filter((skill) => !combinedSkills.has(skill.toLowerCase()));

    const branch = toSafeString(user.branch).toLowerCase();
    const eligibleBranches = ensureArray(opportunity.eligibleBranches).map((item) => String(item).toLowerCase());
    const branchEligible =
      eligibleBranches.length === 0 ||
      eligibleBranches.some((item) => item === "all" || item === "any" || item === branch || branch.includes(item) || item.includes(branch));
    const eligibleYears = ensureArray(opportunity.eligibleYears).map((item) => Number.parseInt(String(item), 10)).filter(Number.isFinite);
    const userYear = Number.parseInt(String(user.year || ""), 10);
    const yearEligible = eligibleYears.length === 0 || (Number.isFinite(userYear) && eligibleYears.includes(userYear));
    const eligibilityScore = branchEligible && yearEligible ? 1 : branchEligible || yearEligible ? 0.45 : 0;
    const skillMatchScore = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0.5;
    const resumeQualityScore = resume ? Math.min(1, Number(resume.qualityScore || 0) / 100) : 0;
    const projectEvidence = Math.min(1, ensureArray(resume?.parsedJson?.projects).length / 2);
    const experienceEvidence = Math.min(1, ensureArray(resume?.parsedJson?.experience).length / 2);
    const interestAlignment = ensureArray(profile.preferredTypes).includes(opportunity.type) ? 1 : 0.35;
    const locationModeFit =
      !profile.preferredLocations?.length ||
      ensureArray(profile.preferredLocations).some((location) => {
        const value = String(location).toLowerCase();
        return value === String(opportunity.mode || "").toLowerCase() || String(opportunity.location || "").toLowerCase().includes(value);
      })
        ? 1
        : 0.45;
    const deadlineUrgency = opportunity.deadline && Date.parse(opportunity.deadline) > Date.now() ? 1 : 0.5;

    const score =
      0.25 * eligibilityScore +
      0.25 * skillMatchScore +
      0.15 * resumeQualityScore +
      0.1 * projectEvidence +
      0.08 * experienceEvidence +
      0.07 * interestAlignment +
      0.05 * locationModeFit +
      0.05 * deadlineUrgency;
    const fitScore = Math.round(score * 100);
    const reasons = [
      branchEligible && yearEligible ? "Meets listed branch/year eligibility." : "Eligibility needs review.",
      matchedSkills.length ? `Matches ${matchedSkills.length} required skill${matchedSkills.length === 1 ? "" : "s"}.` : "No required skills matched yet.",
      resume ? `Uses resume version ${resume.fileName}.` : "No resume version uploaded yet.",
      projectEvidence > 0 ? "Project evidence is present." : "Add project evidence to improve fit.",
    ];
    const recommendations = [
      ...(missingSkills.length ? [`Close skill gaps: ${missingSkills.slice(0, 4).join(", ")}.`] : []),
      ...(resume ? [] : ["Upload a resume version for stronger fit scoring."]),
      ...(projectEvidence > 0 ? [] : ["Add project bullets with measurable outcomes."]),
      ...(resumeQualityScore >= 0.7 ? [] : ["Improve resume structure, links, and quantified impact."]),
    ];

    const feedback = {
      fitScore,
      breakdown: {
        eligibilityScore,
        skillMatchScore,
        resumeQualityScore,
        projectEvidence,
        experienceEvidence,
        interestAlignment,
        locationModeFit,
        deadlineUrgency,
      },
      matchedSkills,
      missingSkills,
      eligibility: {
        eligible: branchEligible && yearEligible,
        branchEligible,
        yearEligible,
      },
      reasons,
      recommendations,
      resumeVersionId: resume?.id || null,
      opportunityId,
    };

    if (resume) {
      this.db
        .prepare(
          `INSERT INTO resume_feedback (
            id, resumeVersionId, targetType, targetRefId, score, feedbackJson, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), resume.id, "opportunity", opportunityId, fitScore, JSON.stringify(feedback), nowIso());
    }

    return feedback;
  },
};

// --- savedSearches.js (T4.2.6) ---
const SAVED_SEARCH_LIMIT = 20;
const SAVED_SEARCH_FILTER_KEYS = ["query", "type", "skills", "location", "mode", "isFree", "hasStipend"];

function normalizeSavedFilters(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const key of SAVED_SEARCH_FILTER_KEYS) {
    const v = src[key];
    if (v === undefined || v === null || v === "" || v === false) continue;
    out[key] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function rowToSavedSearch(row) {
  let filters = {};
  try {
    filters = JSON.parse(row.filters || "{}");
  } catch {
    filters = {};
  }
  return {
    id: row.id,
    name: row.name,
    filters,
    alertsEnabled: Boolean(row.alertsEnabled),
    createdAt: row.createdAt,
    lastRunAt: row.lastRunAt || null,
  };
}

const savedSearchMethods = {
  listSavedSearches(user) {
    this._ensureAuthenticatedUser(user);
    return this.db
      .prepare("SELECT * FROM career_saved_searches WHERE userId = ? ORDER BY createdAt DESC")
      .all(user.userId)
      .map(rowToSavedSearch);
  },

  createSavedSearch(user, { name, filters, alertsEnabled = false } = {}) {
    this._ensureAuthenticatedUser(user);
    const cleanName = String(name || "").trim().slice(0, 80);
    if (!cleanName) {
      const e = new Error("A name is required for a saved search");
      e.status = 400;
      throw e;
    }
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM career_saved_searches WHERE userId = ?")
      .get(user.userId).n;
    if (count >= SAVED_SEARCH_LIMIT) {
      const e = new Error(`You can keep up to ${SAVED_SEARCH_LIMIT} saved searches`);
      e.status = 409;
      throw e;
    }
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO career_saved_searches (id, userId, name, filters, alertsEnabled, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, user.userId, cleanName, JSON.stringify(normalizeSavedFilters(filters)), alertsEnabled ? 1 : 0, nowIso());
    return rowToSavedSearch(
      this.db.prepare("SELECT * FROM career_saved_searches WHERE id = ?").get(id),
    );
  },

  updateSavedSearch(user, id, patch = {}) {
    this._ensureAuthenticatedUser(user);
    const row = this.db
      .prepare("SELECT * FROM career_saved_searches WHERE id = ? AND userId = ?")
      .get(id, user.userId);
    if (!row) {
      const e = new Error("Saved search not found");
      e.status = 404;
      throw e;
    }
    const name = patch.name !== undefined ? String(patch.name || "").trim().slice(0, 80) || row.name : row.name;
    const filters =
      patch.filters !== undefined ? JSON.stringify(normalizeSavedFilters(patch.filters)) : row.filters;
    const alertsEnabled =
      patch.alertsEnabled !== undefined ? (patch.alertsEnabled ? 1 : 0) : row.alertsEnabled;
    this.db
      .prepare("UPDATE career_saved_searches SET name = ?, filters = ?, alertsEnabled = ? WHERE id = ?")
      .run(name, filters, alertsEnabled, id);
    return rowToSavedSearch(
      this.db.prepare("SELECT * FROM career_saved_searches WHERE id = ?").get(id),
    );
  },

  deleteSavedSearch(user, id) {
    this._ensureAuthenticatedUser(user);
    const info = this.db
      .prepare("DELETE FROM career_saved_searches WHERE id = ? AND userId = ?")
      .run(id, user.userId);
    return { deleted: info.changes > 0 };
  },

  /**
   * For every alert-enabled saved search, count active opportunities added
   * since its last run that match its filters. Advances `lastRunAt`.
   * @returns {Array<{ userId, searchId, name, count, sampleTitle }>}
   */
  matchSavedSearchAlerts(now = new Date()) {
    const nowStr = now.toISOString();
    const rows = this.db
      .prepare("SELECT * FROM career_saved_searches WHERE alertsEnabled = 1")
      .all();
    const hits = [];

    for (const row of rows) {
      const search = rowToSavedSearch(row);
      const since = search.lastRunAt || search.createdAt;
      const f = search.filters;

      // ISO-8601 strings sort lexicographically, and unlike SQLite's
      // datetime() they keep sub-second precision — so an opportunity added
      // moments after the search was saved still counts.
      let sql = `
        SELECT COUNT(*) AS count, MAX(o.title) AS sampleTitle
        FROM career_opportunities o
        WHERE o.isActive = 1 AND o.moderationState = 0
          AND COALESCE(o.postedAt, o.scrapedAt) > ?
      `;
      const params = [since];

      if (f.type) {
        sql += " AND o.type = ?";
        params.push(String(f.type));
      }
      if (f.query) {
        const raw = String(f.query).trim();
        const matchExpr = careerSearchMatchExpression(raw);
        if (matchExpr) {
          sql += " AND o.rowid IN (SELECT rowid FROM career_search WHERE career_search MATCH ?)";
          params.push(matchExpr);
        } else {
          const like = `%${raw.toLowerCase().replace(/[%_]/g, "").slice(0, 200)}%`;
          sql += " AND (LOWER(o.title) LIKE ? OR LOWER(IFNULL(o.description,'')) LIKE ?)";
          params.push(like, like);
        }
      }
      if (f.location) {
        sql += " AND LOWER(COALESCE(o.location,'')) LIKE ?";
        params.push(`%${String(f.location).toLowerCase()}%`);
      }
      if (f.mode) {
        sql += " AND o.mode = ?";
        params.push(String(f.mode));
      }
      if (f.isFree) sql += " AND o.isFree = 1";
      if (f.hasStipend) sql += " AND o.stipend IS NOT NULL AND TRIM(o.stipend) != ''";
      for (const skill of String(f.skills || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
        sql += " AND LOWER(o.skills) LIKE ?";
        params.push(`%${skill}%`);
      }

      let result;
      try {
        result = this.db.prepare(sql).get(...params);
      } catch {
        result = { count: 0, sampleTitle: null };
      }

      this.db
        .prepare("UPDATE career_saved_searches SET lastRunAt = ? WHERE id = ?")
        .run(nowStr, search.id);

      if (result && result.count > 0) {
        hits.push({
          userId: row.userId,
          searchId: search.id,
          name: search.name,
          count: result.count,
          sampleTitle: result.sampleTitle || null,
        });
      }
    }
    return hits;
  },
};

// --- learningPlans.js (Story 4.3) ---
const LEARNING_PLAN_LIMIT = 30;

function normalizeSkill(raw) {
  return String(raw || "").trim().slice(0, 80);
}

function rowToLearningPlan(row) {
  return {
    id: row.id,
    skill: row.skill,
    status: row.status,
    startedAt: row.startedAt,
    closedAt: row.closedAt || null,
    closedReason: row.closedReason || null,
  };
}

const learningPlanMethods = {
  listLearningPlans(user) {
    this._ensureAuthenticatedUser(user);
    const items = this.db
      .prepare(
        `SELECT * FROM career_learning_plans WHERE userId = ?
         ORDER BY (status = 'active') DESC, COALESCE(closedAt, startedAt) DESC`,
      )
      .all(user.userId)
      .map(rowToLearningPlan);
    return { items, stats: this.learningPlanStats(user) };
  },

  learningPlanStats(user) {
    this._ensureAuthenticatedUser(user);
    const rows = this.db
      .prepare("SELECT status, closedAt FROM career_learning_plans WHERE userId = ?")
      .all(user.userId);
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return {
      active: rows.filter((r) => r.status === "active").length,
      closed: rows.filter((r) => r.status === "closed").length,
      closedThisMonth: rows.filter(
        (r) => r.status === "closed" && String(r.closedAt || "").startsWith(monthPrefix),
      ).length,
    };
  },

  /** Start (or reopen) a plan for a skill. */
  createLearningPlan(user, skillRaw) {
    this._ensureAuthenticatedUser(user);
    const skill = normalizeSkill(skillRaw);
    if (!skill) {
      const e = new Error("A skill is required");
      e.status = 400;
      throw e;
    }
    const existing = this.db
      .prepare("SELECT * FROM career_learning_plans WHERE userId = ? AND LOWER(skill) = LOWER(?)")
      .get(user.userId, skill);
    if (existing) {
      if (existing.status === "closed") {
        this.db
          .prepare(
            "UPDATE career_learning_plans SET status = 'active', startedAt = ?, closedAt = NULL, closedReason = NULL WHERE id = ?",
          )
          .run(nowIso(), existing.id);
      }
      return rowToLearningPlan(
        this.db.prepare("SELECT * FROM career_learning_plans WHERE id = ?").get(existing.id),
      );
    }
    const active = this.db
      .prepare("SELECT COUNT(*) AS n FROM career_learning_plans WHERE userId = ? AND status = 'active'")
      .get(user.userId).n;
    if (active >= LEARNING_PLAN_LIMIT) {
      const e = new Error(`You can have up to ${LEARNING_PLAN_LIMIT} active learning plans`);
      e.status = 409;
      throw e;
    }
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO career_learning_plans (id, userId, skill, status, startedAt) VALUES (?, ?, ?, 'active', ?)",
      )
      .run(id, user.userId, skill, nowIso());
    return rowToLearningPlan(this.db.prepare("SELECT * FROM career_learning_plans WHERE id = ?").get(id));
  },

  setLearningPlanStatus(user, id, status, reason = "manual") {
    this._ensureAuthenticatedUser(user);
    const row = this.db
      .prepare("SELECT * FROM career_learning_plans WHERE id = ? AND userId = ?")
      .get(id, user.userId);
    if (!row) {
      const e = new Error("Learning plan not found");
      e.status = 404;
      throw e;
    }
    if (status === "closed") {
      this.db
        .prepare("UPDATE career_learning_plans SET status = 'closed', closedAt = ?, closedReason = ? WHERE id = ?")
        .run(nowIso(), reason, id);
    } else {
      this.db
        .prepare("UPDATE career_learning_plans SET status = 'active', closedAt = NULL, closedReason = NULL, startedAt = ? WHERE id = ?")
        .run(nowIso(), id);
    }
    return rowToLearningPlan(this.db.prepare("SELECT * FROM career_learning_plans WHERE id = ?").get(id));
  },

  deleteLearningPlan(user, id) {
    this._ensureAuthenticatedUser(user);
    const info = this.db
      .prepare("DELETE FROM career_learning_plans WHERE id = ? AND userId = ?")
      .run(id, user.userId);
    return { deleted: info.changes > 0 };
  },

  /**
   * Close any active plan whose skill the student has since acquired
   * (T4.3.3 — track gap closure). Returns the ids that were auto-closed.
   */
  reconcileLearningPlans(user, acquiredSkills = []) {
    this._ensureAuthenticatedUser(user);
    const have = new Set(
      (Array.isArray(acquiredSkills) ? acquiredSkills : [])
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (have.size === 0) return [];
    const active = this.db
      .prepare("SELECT id, skill FROM career_learning_plans WHERE userId = ? AND status = 'active'")
      .all(user.userId);
    const closed = [];
    for (const plan of active) {
      if (have.has(String(plan.skill).toLowerCase())) {
        this.db
          .prepare("UPDATE career_learning_plans SET status = 'closed', closedAt = ?, closedReason = 'acquired' WHERE id = ?")
          .run(nowIso(), plan.id);
        closed.push(plan.id);
      }
    }
    return closed;
  },
};

// --- schema.js ---
const schemaMethods = {
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

  _migrateCareerStipendRange() {
    // Written by the Python scraper (parse_stipend) as monthly-INR numerics
    // so the career feed can sort/filter by pay.
    for (const statement of [
      "ALTER TABLE career_opportunities ADD COLUMN stipendMin REAL",
      "ALTER TABLE career_opportunities ADD COLUMN stipendMax REAL",
    ]) {
      try {
        this.db.exec(statement);
      } catch {}
    }
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

  _migrateAlumniContactLinks() {
    for (const statement of [
      "ALTER TABLE career_alumni ADD COLUMN instagramUrl TEXT",
      "ALTER TABLE career_alumni ADD COLUMN portfolioUrl TEXT",
    ]) {
      try {
        this.db.exec(statement);
      } catch {}
    }
  },

  _migrateAlumniRequestsGovernance() {
    for (const statement of [
      "ALTER TABLE career_alumni_requests ADD COLUMN requesterName TEXT DEFAULT ''",
      "ALTER TABLE career_alumni_requests ADD COLUMN reviewedAt TEXT",
      "ALTER TABLE career_alumni_requests ADD COLUMN reviewedBy TEXT",
      "ALTER TABLE career_alumni_requests ADD COLUMN reviewNote TEXT",
    ]) {
      try {
        this.db.exec(statement);
      } catch {}
    }
  },

  _ensureSchema() {
    this._migrateFtsToRowidModel();
    this._migrateCareerOpportunitiesLifecycle();
    this._migrateCareerStipendRange();
    this._migrateSkillGapsGapLevel();
    this._migrateCareerSubmissionGovernance();
    this._migrateAlumniContactLinks();
    this._migrateAlumniRequestsGovernance();
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
        stipendMin      REAL,
        stipendMax      REAL,
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

      CREATE TABLE IF NOT EXISTS resume_versions (
        id                  TEXT PRIMARY KEY,
        userId              TEXT NOT NULL,
        fileName            TEXT NOT NULL,
        filePath            TEXT NOT NULL,
        mimeType            TEXT,
        extractedText       TEXT,
        parsedJson          TEXT DEFAULT '{}',
        qualityScore        REAL DEFAULT 0,
        createdAt           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_resume_versions_user_created
        ON resume_versions(userId, createdAt DESC);

      CREATE TABLE IF NOT EXISTS resume_feedback (
        id                  TEXT PRIMARY KEY,
        resumeVersionId     TEXT NOT NULL,
        targetType          TEXT,
        targetRefId         TEXT,
        score               REAL NOT NULL,
        feedbackJson        TEXT DEFAULT '{}',
        createdAt           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_resume_feedback_resume
        ON resume_feedback(resumeVersionId, createdAt DESC);

      CREATE TABLE IF NOT EXISTS career_skill_gaps (
        userId              TEXT NOT NULL,
        skill               TEXT NOT NULL,
        opportunityCount    INTEGER DEFAULT 0,
        gapLevel            TEXT DEFAULT 'missing',
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
        instagramUrl        TEXT,
        portfolioUrl        TEXT,
        bio                 TEXT,
        skills              TEXT DEFAULT '[]',
        isAvailableForMentoring INTEGER DEFAULT 0,
        createdAt           TEXT NOT NULL,
        updatedAt           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS career_alumni_requests (
        id                  TEXT PRIMARY KEY,
        alumniId            TEXT NOT NULL,
        userId              TEXT NOT NULL,
        requesterName       TEXT DEFAULT '',
        message             TEXT DEFAULT '',
        status              TEXT NOT NULL DEFAULT 'pending',
        reviewedAt          TEXT,
        reviewedBy          TEXT,
        reviewNote          TEXT,
        createdAt           TEXT NOT NULL,
        UNIQUE(alumniId, userId)
      );

      CREATE INDEX IF NOT EXISTS idx_alumni_requests_user
        ON career_alumni_requests(userId, createdAt DESC);

      CREATE TABLE IF NOT EXISTS career_alumni_nominations (
        id                  TEXT PRIMARY KEY,
        submittedBy         TEXT NOT NULL,
        submitterName       TEXT DEFAULT '',
        status              TEXT NOT NULL DEFAULT 'pending',
        name                TEXT NOT NULL,
        email               TEXT,
        batch               TEXT,
        degree              TEXT,
        company             TEXT,
        role                TEXT,
        location            TEXT,
        linkedinUrl         TEXT,
        instagramUrl        TEXT,
        portfolioUrl        TEXT,
        expertise           TEXT DEFAULT '[]',
        relation            TEXT,
        note                TEXT,
        reviewedAt          TEXT,
        reviewedBy          TEXT,
        reviewReason        TEXT,
        publishedAlumniId   TEXT,
        createdAt           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alumni_nominations_status
        ON career_alumni_nominations(status, createdAt DESC);

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

      -- T4.2.6 — a student's saved opportunity searches, optionally alerting
      -- when new listings match.
      CREATE TABLE IF NOT EXISTS career_saved_searches (
        id            TEXT PRIMARY KEY,
        userId        TEXT NOT NULL,
        name          TEXT NOT NULL,
        filters       TEXT NOT NULL DEFAULT '{}',
        alertsEnabled INTEGER NOT NULL DEFAULT 0,
        createdAt     TEXT NOT NULL,
        lastRunAt     TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_career_saved_user ON career_saved_searches(userId);

      -- Story 4.3 — "close this gap": a per-skill learning plan the student
      -- opts into, auto-closed once the skill shows up in their profile.
      CREATE TABLE IF NOT EXISTS career_learning_plans (
        id           TEXT PRIMARY KEY,
        userId       TEXT NOT NULL,
        skill        TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'active',
        startedAt    TEXT NOT NULL,
        closedAt     TEXT,
        closedReason TEXT,
        UNIQUE (userId, skill)
      );
      CREATE INDEX IF NOT EXISTS idx_career_plans_user ON career_learning_plans(userId);

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

    this._migrateCanonicalSkillNames();
  },

  /**
   * Rewrite stored skill strings to their canonical display form. Idempotent —
   * `canonicalizeSkill` is a fixed point — so it is safe to run every startup.
   * Repairs rows written before skill canonicalisation existed (e.g. lowercase
   * "aws", "node.js" that the UI then mangled to "Aws" / "Node.Js").
   */
  _migrateCanonicalSkillNames() {
    try {
      const gapRows = this.db.prepare("SELECT rowid, skill FROM career_skill_gaps").all();
      const updateGap = this.db.prepare("UPDATE career_skill_gaps SET skill = ? WHERE rowid = ?");
      for (const row of gapRows) {
        const canonical = canonicalizeSkill(row.skill);
        if (canonical && canonical !== row.skill) updateGap.run(canonical, row.rowid);
      }
    } catch {
      /* table may not exist yet on a fresh DB */
    }
    try {
      const profileRows = this.db.prepare("SELECT userId, skills FROM career_profiles").all();
      const updateProfile = this.db.prepare("UPDATE career_profiles SET skills = ? WHERE userId = ?");
      for (const row of profileRows) {
        let parsed;
        try {
          parsed = JSON.parse(row.skills || "[]");
        } catch {
          parsed = [];
        }
        const canonical = canonicalizeSkills(parsed);
        if (JSON.stringify(canonical) !== JSON.stringify(parsed)) {
          updateProfile.run(JSON.stringify(canonical), row.userId);
        }
      }
    } catch {
      /* best effort */
    }
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

// --- submissions.js ---

const submissionMethods = {
  recordSubmissionAudit(submissionId, { action, actorId, fromStatus, toStatus, reason, metadata = {} }) {
    this.db
      .prepare(
        `
          INSERT INTO career_submission_audit
          (id, submissionId, action, actorId, fromStatus, toStatus, reason, metadata, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        randomUUID(),
        submissionId,
        toSafeString(action),
        toSafeString(actorId) || "system",
        fromStatus || null,
        toStatus || null,
        reason || null,
        JSON.stringify(metadata || {}),
        nowIso()
      );
  },

  getSubmissionAudit(submissionId) {
    return this.db
      .prepare("SELECT * FROM career_submission_audit WHERE submissionId = ? ORDER BY createdAt DESC")
      .all(submissionId)
      .map((row) => ({ ...row, metadata: JSON.parse(row.metadata || "{}") }));
  },

  submitOpportunity(userId, data) {
    if (!data || typeof data !== "object") {
      const error = new Error("Invalid submission payload");
      error.status = 400;
      throw error;
    }
    const applyUrl = toSafeString(data.applyUrl);
    if (!applyUrl || !/^https:\/\//i.test(applyUrl)) {
      const error = new Error("Apply URL must use https://");
      error.status = 400;
      throw error;
    }
    const title = toSafeString(data.title);
    if (title.length < 3) {
      const error = new Error("Title is required");
      error.status = 400;
      throw error;
    }
    const type = normalizeOpportunityType(data.type);
    const company = toSafeString(data.company || data.organization);
    const organizer = toSafeString(data.organizer);
    const fingerprint = createOpportunityFingerprint({ title, company, organizer, applyUrl });
    const duplicateActive = this.db
      .prepare("SELECT id, title FROM career_opportunities WHERE sourceUrl = ? OR applyUrl = ? OR fingerprint = ? LIMIT 1")
      .get(applyUrl, applyUrl, fingerprint);
    if (duplicateActive) {
      const error = new Error("This opportunity already exists in the public catalog");
      error.status = 409;
      error.code = "CAREER_DUPLICATE_OPPORTUNITY";
      error.details = duplicateActive;
      throw error;
    }
    const duplicatePending = this.db
      .prepare(
        "SELECT id, submittedBy, status FROM career_submissions WHERE status = 'pending' AND (applyUrl = ? OR fingerprint = ?) LIMIT 1"
      )
      .get(applyUrl, fingerprint);
    if (duplicatePending) {
      const error = new Error("This opportunity is already pending review");
      error.status = 409;
      error.code = "CAREER_DUPLICATE_SUBMISSION";
      error.details = duplicatePending;
      throw error;
    }

    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_submissions (
        id, submittedBy, status, type, title, company, organizer, description,
        skills, tags, location, mode, eligibleBranches, eligibleYears,
        stipend, prize, deadline, startDate, applyUrl, createdAt, fingerprint
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id, userId, type, title, company || null, organizer || null,
      data.description || null, JSON.stringify(normalizeStringList(data.skills)), JSON.stringify(normalizeStringList(data.tags)),
      data.location || null, data.mode || null, JSON.stringify(normalizeStringList(data.eligibleBranches)),
      JSON.stringify(normalizeStringList(data.eligibleYears)), data.stipend || null, data.prize || null,
      data.deadline || null, data.startDate || null, applyUrl, now, fingerprint
    );
    this.recordSubmissionAudit(id, {
      action: "submitted",
      actorId: userId,
      fromStatus: null,
      toStatus: "pending",
      reason: "Student submission created",
      metadata: { fingerprint },
    });
    return {
      id,
      status: "pending",
      governance: {
        requiresApproval: true,
        owner: "Career opportunities review",
      },
    };
  },

  autoApproveIfValid(submissionId) {
    const sub = this.db.prepare("SELECT * FROM career_submissions WHERE id = ?").get(submissionId);
    if (!sub) return false;

    const hasValidUrl = sub.applyUrl && sub.applyUrl.startsWith("https://");
    const hasFutureDeadline = !sub.deadline || new Date(sub.deadline) > new Date();
    const hasLongTitle = sub.title && sub.title.length > 10;
    
    // Check for duplicate URL in active opportunities
    const duplicate = this.db.prepare("SELECT 1 FROM career_opportunities WHERE sourceUrl = ?").get(sub.applyUrl);

    if (hasValidUrl && hasFutureDeadline && hasLongTitle && !duplicate) {
      this._applyApprovedSubmission(submissionId);
      return true;
    }
    return false;
  },

  _applyApprovedSubmission(submissionId) {
    const sub = this.db.prepare("SELECT * FROM career_submissions WHERE id = ?").get(submissionId);
    if (!sub) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    if (sub.status !== "pending") {
      const error = new Error("Submission is not pending approval");
      error.status = 400;
      throw error;
    }

    const now = nowIso();
    const publishedOpportunityId = randomUUID();
    this.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, organizer, description, shortDescription,
        skills, tags, location, mode, eligibleBranches, eligibleYears,
        stipend, prize, deadline, startDate, source, sourceUrl, applyUrl, fingerprint,
        scrapedAt, updatedAt, isActive, isVerified, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, 1, 1, 0)
    `
      )
      .run(
        publishedOpportunityId,
        sub.type,
        sub.title,
        sub.company,
        sub.organizer,
        sub.description,
        (sub.description || "").substring(0, 200),
        sub.skills,
        sub.tags,
        sub.location,
        sub.mode,
        sub.eligibleBranches,
        sub.eligibleYears,
        sub.stipend,
        sub.prize,
        sub.deadline,
        sub.startDate,
        sub.applyUrl,
        sub.applyUrl,
        sub.fingerprint || createOpportunityFingerprint(sub),
        now,
        now
      );
    return publishedOpportunityId;
  },

  reviewSubmission(submissionId, payload = {}, moderatorContext = {}) {
    const sub = this.db.prepare("SELECT * FROM career_submissions WHERE id = ?").get(submissionId);
    if (!sub) {
      const error = new Error("Submission not found");
      error.status = 404;
      throw error;
    }
    if (sub.status !== "pending") {
      const error = new Error("Submission is not pending review");
      error.status = 400;
      throw error;
    }
    const reviewerId = toSafeString(moderatorContext.userId);
    if (reviewerId && reviewerId === String(sub.submittedBy)) {
      const error = new Error("Reviewer cannot decide their own submission");
      error.status = 403;
      throw error;
    }
    const decision = toSafeString(payload.decision || payload.status).toLowerCase();
    if (!["approve", "approved", "reject", "rejected"].includes(decision)) {
      const error = new Error("Invalid review decision");
      error.status = 400;
      throw error;
    }
    const reason = toSafeString(payload.reason || payload.reviewReason);
    if (reason.length < 3) {
      const error = new Error("Review reason is required");
      error.status = 400;
      throw error;
    }

    const nextStatus = decision.startsWith("approve") ? "approved" : "rejected";
    let publishedOpportunityId = null;
    if (nextStatus === "approved") {
      if (sub.deadline && new Date(sub.deadline) < new Date()) {
        const error = new Error("Expired opportunity submissions require an updated deadline before approval");
        error.status = 400;
        throw error;
      }
      const duplicateActive = this.db
        .prepare("SELECT id, title FROM career_opportunities WHERE sourceUrl = ? OR applyUrl = ? OR fingerprint = ? LIMIT 1")
        .get(sub.applyUrl, sub.applyUrl, sub.fingerprint);
      if (duplicateActive) {
        const error = new Error("This opportunity already exists in the public catalog");
        error.status = 409;
        error.code = "CAREER_DUPLICATE_OPPORTUNITY";
        error.details = duplicateActive;
        throw error;
      }
      publishedOpportunityId = this._applyApprovedSubmission(submissionId);
    }

    const now = nowIso();
    this.db
      .prepare(
        `
          UPDATE career_submissions
          SET status = ?, reviewedAt = ?, reviewedBy = ?, reviewReason = ?, publishedOpportunityId = COALESCE(?, publishedOpportunityId)
          WHERE id = ?
        `
      )
      .run(nextStatus, now, reviewerId || "admin", reason, publishedOpportunityId, submissionId);
    this.recordSubmissionAudit(submissionId, {
      action: nextStatus,
      actorId: reviewerId || "admin",
      fromStatus: sub.status,
      toStatus: nextStatus,
      reason,
      metadata: { publishedOpportunityId },
    });
    return this.getSubmissionById(submissionId);
  },

  approveSubmission(submissionId, moderatorContext, reason = "Approved by reviewer") {
    return this.reviewSubmission(submissionId, { decision: "approve", reason }, moderatorContext);
  },

  getSubmissions({ status = "pending", submittedBy = "", page = 1, limit = 25, query = "" } = {}) {
    const normalizedStatus = toSafeString(status).toLowerCase();
    const where = [];
    const params = [];
    if (normalizedStatus && normalizedStatus !== "all") {
      where.push("status = ?");
      params.push(normalizedStatus);
    }
    if (submittedBy) {
      where.push("submittedBy = ?");
      params.push(submittedBy);
    }
    if (query) {
      where.push("(lower(title) LIKE ? OR lower(COALESCE(company, organizer, '')) LIKE ?)");
      params.push(`%${toSafeString(query).toLowerCase()}%`, `%${toSafeString(query).toLowerCase()}%`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const currentPage = clampCareerPage(page);
    const pageLimit = clampCareerPageLimit(limit);
    const total = Number(this.db.prepare(`SELECT COUNT(*) AS total FROM career_submissions ${clause}`).get(...params)?.total || 0);
    const items = this.db
      .prepare(`SELECT * FROM career_submissions ${clause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
      .all(...params, pageLimit, (currentPage - 1) * pageLimit)
      .map((item) => ({ ...item, audit: this.getSubmissionAudit(item.id) }));
    return { items, pagination: { page: currentPage, limit: pageLimit, total } };
  },

  getPendingSubmissions(options = {}) {
    return this.getSubmissions({ ...options, status: options.status || "pending" });
  },

  getSubmissionById(id) {
    const row = this.db.prepare("SELECT * FROM career_submissions WHERE id = ?").get(id) || null;
    return row ? { ...row, audit: this.getSubmissionAudit(id) } : null;
  }
};

// --- class ---
class CareerStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this._ensureSchema();
    this._seedDefaultsIfNeeded();
    this._rebuildCareerSearchFts();
  }

  /** External-content FTS5 must use the content table INTEGER rowid, not TEXT id. */

  _ensureAuthenticatedUser(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  }

  _ensureAdmin(user) {
    if (!user || user.role !== "admin") {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  }

  _ensureActiveOpportunityId(opportunityId) {
    const row = this.db
      .prepare(
        "SELECT 1 FROM career_opportunities WHERE id = ? AND isActive = 1 AND moderationState = 0"
      )
      .get(opportunityId);
    if (!row) {
      const error = new Error("Opportunity not found");
      error.status = 404;
      throw error;
    }
  }

  // Phase 1+2 Core Methods

  /** Bookmarked opportunities with deadline within the next `days` days (API contract). */

  // Opportunity CRUD operations

  // Student Actions

  // Application Tracker

  // Manual Submissions

  /**
   * Manual moderator approval. Pass moderatorContext for human reviewers; omit for system auto-approve.
   */

  // Health

  // Phase 4 - Profile & Personalization

  // Alumni methods

  // Interview methods

}

Object.assign(
  CareerStore.prototype,
  schemaMethods,
  catalogMethods,
  opportunityActionMethods,
  submissionMethods,
  healthMethods,
  profileMethods,
  resumeMethods,
  alumniMethods,
  interviewMethods,
  savedSearchMethods,
  learningPlanMethods
);

module.exports = {
  CareerStore,
};
