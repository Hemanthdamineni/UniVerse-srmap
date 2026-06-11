const { randomUUID } = require("crypto");
const {
  nowIso,
  toSafeString,
  normalizeOpportunityType,
  normalizeStringList,
  createOpportunityFingerprint,
  clampCareerPageLimit,
  clampCareerPage,
} = require("./utils");

module.exports = {
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
