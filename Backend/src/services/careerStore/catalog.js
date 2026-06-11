const {
  nowIso,
  toSafeString,
  careerSearchMatchExpression,
  clampCareerPageLimit,
  clampCareerPage,
} = require("./utils");

module.exports = {
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
