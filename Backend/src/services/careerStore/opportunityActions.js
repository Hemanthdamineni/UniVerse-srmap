const { randomUUID } = require("crypto");
const {
  APPLICATION_STATUSES,
  nowIso,
  toSafeString,
  normalizeOpportunityType,
  normalizeStringList,
  createOpportunityFingerprint,
} = require("./utils");

module.exports = {
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
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = bookmarkCount - 1 WHERE id = ?")
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
      this.db.prepare("UPDATE career_opportunities SET bookmarkCount = bookmarkCount - 1 WHERE id = ?")
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

  trackApply(opportunityId, userId) {
    this._ensureActiveOpportunityId(opportunityId);
    this.db.prepare("UPDATE career_opportunities SET applyCount = applyCount + 1 WHERE id = ?").run(opportunityId);
    return { tracked: true };
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
