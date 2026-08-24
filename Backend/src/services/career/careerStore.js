const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("crypto");

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
const alumniMethods = {
  listAlumni({ user, query = "", batch = "" }) {
    this._ensureAuthenticatedUser(user);
    let sql = `
      SELECT * FROM career_alumni 
      WHERE 1=1
    `;
    const params = [];

    if (query) {
      sql += " AND (name LIKE ? OR company LIKE ? OR position LIKE ?)";
      const likeQuery = `%${query}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }

    if (batch) {
      sql += " AND batch = ?";
      params.push(batch);
    }

    sql += " ORDER BY name";

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(row => ({
      ...row,
      skills: JSON.parse(row.skills || "[]"),
    }));
  },

  createAlumni(data, user) {
    this._ensureAuthenticatedUser(user);
    const id = randomUUID();
    const now = nowIso();
    
    this.db.prepare(`
      INSERT INTO career_alumni (
        id, userId, name, email, batch, branch, company, position, location,
        linkedinUrl, bio, skills, isAvailableForMentoring, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.userId,
      data.name || "",
      data.email || "",
      data.batch || "",
      data.branch || "",
      data.company || "",
      data.position || "",
      data.location || "",
      data.linkedinUrl || "",
      data.bio || "",
      JSON.stringify(data.skills || []),
      data.isAvailableForMentoring ? 1 : 0,
      now,
      now
    );

    return { id, ...data, createdAt: now, updatedAt: now };
  },

  updateAlumni(id, data, user) {
    this._ensureAuthenticatedUser(user);
    const now = nowIso();
    
    this.db.prepare(`
      UPDATE career_alumni SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        batch = COALESCE(?, batch),
        branch = COALESCE(?, branch),
        company = COALESCE(?, company),
        position = COALESCE(?, position),
        location = COALESCE(?, location),
        linkedinUrl = COALESCE(?, linkedinUrl),
        bio = COALESCE(?, bio),
        skills = COALESCE(?, skills),
        isAvailableForMentoring = COALESCE(?, isAvailableForMentoring),
        updatedAt = ?
      WHERE id = ? AND userId = ?
    `).run(
      data.name,
      data.email,
      data.batch,
      data.branch,
      data.company,
      data.position,
      data.location,
      data.linkedinUrl,
      data.bio,
      data.skills ? JSON.stringify(data.skills) : null,
      data.isAvailableForMentoring !== undefined ? (data.isAvailableForMentoring ? 1 : 0) : null,
      now,
      id,
      user.userId
    );

    return { updated: true };
  },

  deleteAlumni(id, user) {
    this._ensureAuthenticatedUser(user);
    this.db.prepare("DELETE FROM career_alumni WHERE id = ? AND userId = ?").run(id, user.userId);
    return { deleted: true };
  },

  requestAlumniConnection(alumniId, data, user) {
    this._ensureAuthenticatedUser(user);
    // For now, just return success. In a real implementation, this would send a notification
    // or create a connection request record
    return { requested: true };
  }
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
    const userSkillsSet = new Set(userSkills.map(s => s.toLowerCase()));
    const now = nowIso();
    
    // Get all skills required by active opportunities
    const opps = this.db.prepare("SELECT skills FROM career_opportunities WHERE isActive = 1").all();
    const gapMap = new Map();

    for (const opp of opps) {
      const skills = JSON.parse(opp.skills || "[]");
      for (const skill of skills) {
        const skillLower = skill.toLowerCase();
        if (!userSkillsSet.has(skillLower)) {
          gapMap.set(skillLower, (gapMap.get(skillLower) || 0) + 1);
        }
      }
    }

    // Clear old gaps and insert new ones in a single transaction
    const clearStmt = this.db.prepare("DELETE FROM career_skill_gaps WHERE userId = ?");
    const insert = this.db.prepare(`
      INSERT INTO career_skill_gaps (userId, skill, opportunityCount, updatedAt, gapLevel)
      VALUES (?, ?, ?, ?, 'missing')
    `);

    const sortedGaps = Array.from(gapMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    this.db.exec("BEGIN IMMEDIATE");
    try {
      clearStmt.run(userId);
      for (const [skill, count] of sortedGaps) {
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

function textIncludesSkill(textLower, skill) {
  const escaped = String(skill).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(textLower);
}

const resumeMethods = {
  _resumeSkillLexicon() {
    const skills = [...COMMON_SKILLS];
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

  _parseResumeText(text) {
    const extractedText = toSafeString(text).slice(0, 200000);
    const lower = extractedText.toLowerCase();
    const skills = this._resumeSkillLexicon().filter((skill) => textIncludesSkill(lower, skill));
    const links = Array.from(extractedText.matchAll(/https?:\/\/[^\s)]+/gi)).map((match) => match[0]);
    const emails = Array.from(extractedText.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((match) => match[0]);
    const quantifiedImpacts = Array.from(extractedText.matchAll(/(?:\b\d+(?:\.\d+)?%|\b\d+\+?\s+(?:users|students|requests|projects|events|teams|participants|apis|features)\b)/gi)).map((match) => match[0]);
    const lines = extractedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const projectLines = lines.filter((line) => /project|built|developed|created|implemented|designed/i.test(line)).slice(0, 8);
    const experienceLines = lines.filter((line) => /intern|experience|worked|volunteer|lead|organizer|coordinator/i.test(line)).slice(0, 8);
    const certifications = lines.filter((line) => /certification|certified|coursera|nptel|udemy|aws|azure|google/i.test(line)).slice(0, 8);

    return {
      skills,
      links: uniqueStrings(links),
      emails: uniqueStrings(emails),
      quantifiedImpacts: uniqueStrings(quantifiedImpacts),
      projects: projectLines,
      experience: experienceLines,
      certifications,
      wordCount: extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0,
      hasGithub: /github\.com/i.test(extractedText),
      hasLinkedin: /linkedin\.com/i.test(extractedText),
      hasPortfolio: /https?:\/\/(?!.*(?:github|linkedin))/i.test(extractedText),
    };
  },

  _scoreResume(parsed, profile = {}) {
    const rubric = [
      {
        key: "structure",
        label: "Resume structure",
        score: parsed.wordCount >= 120 ? 20 : parsed.wordCount >= 60 ? 12 : 4,
        max: 20,
        reason: parsed.wordCount >= 120 ? "Enough content for evaluation." : "Resume text is short or missing sections.",
      },
      {
        key: "skills",
        label: "Skill coverage",
        score: Math.min(20, parsed.skills.length * 4),
        max: 20,
        reason: parsed.skills.length ? `${parsed.skills.length} skill signals detected.` : "No recognizable skill signals detected.",
      },
      {
        key: "projects",
        label: "Project evidence",
        score: Math.min(15, parsed.projects.length * 5),
        max: 15,
        reason: parsed.projects.length ? "Project or build evidence is present." : "Add concrete project bullets.",
      },
      {
        key: "impact",
        label: "Quantified impact",
        score: Math.min(15, parsed.quantifiedImpacts.length * 5),
        max: 15,
        reason: parsed.quantifiedImpacts.length ? "Impact metrics are visible." : "Quantify outcomes with numbers.",
      },
      {
        key: "links",
        label: "Portfolio links",
        score: Math.min(15, (parsed.hasGithub ? 5 : 0) + (parsed.hasLinkedin ? 5 : 0) + (parsed.hasPortfolio ? 5 : 0)),
        max: 15,
        reason: parsed.links.length ? "Profile or portfolio links are present." : "Add GitHub, LinkedIn, or portfolio links.",
      },
      {
        key: "target",
        label: "Profile alignment",
        score: ensureArray(profile.skills).some((skill) => parsed.skills.map((s) => s.toLowerCase()).includes(String(skill).toLowerCase())) ? 15 : 5,
        max: 15,
        reason: "Compares resume skills with Career profile skills.",
      },
    ];
    const score = rubric.reduce((sum, item) => sum + item.score, 0);
    const suggestions = rubric
      .filter((item) => item.score < item.max * 0.7)
      .map((item) => item.reason)
      .slice(0, 6);
    return { score, rubric, suggestions };
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
    const quality = this._scoreResume(parsed, profile);
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

  analyzeResumeVersion(user, resumeVersionId) {
    const resume = this.getResumeVersion(user, resumeVersionId);
    const profile = this.getProfile(user);
    const analysis = this._scoreResume(resume.parsedJson || {}, profile);
    return { resume, ...analysis };
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

  _ensureSchema() {
    this._migrateFtsToRowidModel();
    this._migrateCareerOpportunitiesLifecycle();
    this._migrateCareerStipendRange();
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
  interviewMethods
);

module.exports = {
  CareerStore,
};
