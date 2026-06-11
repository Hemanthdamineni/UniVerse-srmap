const {
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toInteger,
  ensureArray,
  assertCondition,
  clamp,
} = require("../lmsUtils");

module.exports = {
  listComments(resourceId, userId = "") {
    const rows = this.db
      .prepare(
        `
          SELECT c.*,
                 CASE WHEN ch.userId IS NULL THEN 0 ELSE 1 END AS userHelpful
          FROM lms_comments c
          LEFT JOIN lms_comment_helpful ch
            ON ch.commentId = c.id AND ch.userId = ?
          WHERE c.resourceId = ?
          ORDER BY c.createdAt DESC
        `
      )
      .all(userId || "", resourceId);
    return rows.map((row) => ({ ...row, userHelpful: Boolean(row.userHelpful) }));
  },

  commentOnResource(resourceId, userId, content) {
    const normalizedContent = toSafeString(content);
    assertCondition(normalizedContent, 400, "Comment content is required", "LMS_VALIDATION");
    const id = randomId("comment");
    this.db.prepare(
      "INSERT INTO lms_comments (id, resourceId, userId, content, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(id, resourceId, userId, normalizedContent, nowIso());
    this.db.prepare("UPDATE lms_resources SET commentCount = commentCount + 1 WHERE id = ?").run(resourceId);
    return this.listComments(resourceId, userId);
  },

  toggleCommentHelpful(commentId, userId) {
    const existing = this.db
      .prepare("SELECT 1 FROM lms_comment_helpful WHERE commentId = ? AND userId = ?")
      .get(commentId, userId);
    if (existing) {
      this.db.prepare("DELETE FROM lms_comment_helpful WHERE commentId = ? AND userId = ?").run(commentId, userId);
      this.db.prepare("UPDATE lms_comments SET helpful = MAX(0, helpful - 1) WHERE id = ?").run(commentId);
      return { active: false };
    }
    this.db.prepare("INSERT INTO lms_comment_helpful (commentId, userId) VALUES (?, ?)").run(commentId, userId);
    this.db.prepare("UPDATE lms_comments SET helpful = helpful + 1 WHERE id = ?").run(commentId);
    return { active: true };
  },

  saveAnnotation(userId, resourceId, content) {
    const normalizedContent = toSafeString(content);
    assertCondition(normalizedContent, 400, "Annotation content is required", "LMS_VALIDATION");
    const existing = this.db
      .prepare("SELECT * FROM lms_annotations WHERE userId = ? AND resourceId = ?")
      .get(userId, resourceId);
    if (existing) {
      this.db.prepare("UPDATE lms_annotations SET content = ?, updatedAt = ? WHERE id = ?").run(
        normalizedContent,
        nowIso(),
        existing.id
      );
      return this.getAnnotations(userId, resourceId);
    }
    this.db.prepare(
      "INSERT INTO lms_annotations (id, userId, resourceId, content, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(randomId("ann"), userId, resourceId, normalizedContent, nowIso());
    return this.getAnnotations(userId, resourceId);
  },

  getAnnotations(userId, resourceId) {
    return this.db
      .prepare("SELECT * FROM lms_annotations WHERE userId = ? AND resourceId = ? ORDER BY createdAt DESC")
      .all(userId, resourceId);
  },

  deleteAnnotation(id, userId) {
    this.db.prepare("DELETE FROM lms_annotations WHERE id = ? AND userId = ?").run(id, userId);
    return { deleted: true, id };
  },

  createRequest(userId, payload) {
    const id = randomId("req");
    this.db.prepare(
      `
        INSERT INTO lms_requests
        (id, userId, subjectCode, subjectName, semester, unit, title, description, resourceType, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
      `
    ).run(
      id,
      userId,
      toSafeString(payload.subjectCode).toUpperCase(),
      toSafeString(payload.subjectName),
      toSafeString(payload.semester),
      toNullableString(payload.unit),
      toSafeString(payload.title),
      toNullableString(payload.description),
      toNullableString(payload.resourceType),
      nowIso(),
      nowIso()
    );
    return this.getRequest(id);
  },

  getRequest(id) {
    return this.db.prepare("SELECT * FROM lms_requests WHERE id = ?").get(id);
  },

  getRequests(filters = {}) {
    const params = [];
    const where = [];
    if (filters.subjectCode) {
      where.push("subjectCode = ?");
      params.push(toSafeString(filters.subjectCode).toUpperCase());
    }
    if (filters.status) {
      where.push("status = ?");
      params.push(toSafeString(filters.status));
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const page = Math.max(1, toInteger(filters.page, 1));
    const limit = clamp(toInteger(filters.limit, 20), 1, 50);
    const rows = this.db
      .prepare(
        `SELECT * FROM lms_requests ${whereClause} ORDER BY upvotes DESC, createdAt DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);
    return { items: rows, pagination: { page, limit } };
  },

  upvoteRequest(requestId, userId) {
    const existing = this.db
      .prepare("SELECT 1 FROM lms_request_upvotes WHERE requestId = ? AND userId = ?")
      .get(requestId, userId);
    if (existing) {
      this.db.prepare("DELETE FROM lms_request_upvotes WHERE requestId = ? AND userId = ?").run(requestId, userId);
      this.db.prepare("UPDATE lms_requests SET upvotes = MAX(0, upvotes - 1), updatedAt = ? WHERE id = ?").run(
        nowIso(),
        requestId
      );
      return { active: false };
    }
    this.db.prepare("INSERT INTO lms_request_upvotes (requestId, userId, createdAt) VALUES (?, ?, ?)").run(
      requestId,
      userId,
      nowIso()
    );
    this.db.prepare("UPDATE lms_requests SET upvotes = upvotes + 1, updatedAt = ? WHERE id = ?").run(nowIso(), requestId);
    return { active: true };
  },

  fulfillRequest(requestId, userId, resourceId) {
    this.db.prepare(
      `
        UPDATE lms_requests
        SET status = 'fulfilled', fulfilledBy = ?, fulfilledResourceId = ?, updatedAt = ?
        WHERE id = ?
      `
    ).run(userId, resourceId, nowIso(), requestId);
    return this.getRequest(requestId);
  },

  closeRequest(requestId, userId, { isAdmin = false } = {}) {
    const request = this.getRequest(requestId);
    assertCondition(request, 404, "Request not found", "LMS_NOT_FOUND");
    assertCondition(isAdmin || request.userId === userId, 403, "You cannot close this request", "LMS_FORBIDDEN");
    this.db.prepare("UPDATE lms_requests SET status = 'closed', updatedAt = ? WHERE id = ?").run(nowIso(), requestId);
    return this.getRequest(requestId);
  },

  submitExamFeedback(userId, feedbackItems) {
    const items = ensureArray(feedbackItems);
    this.withTransaction(() => {
      for (const item of items) {
        const resource = this.getResourceRow(item.resourceId);
        if (!resource) continue;
        this.db.prepare(
          `
            INSERT INTO lms_exam_feedback (id, userId, resourceId, subjectCode, semester, helpful, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(userId, resourceId, semester) DO UPDATE SET helpful = excluded.helpful, createdAt = excluded.createdAt
          `
        ).run(
          randomId("ef"),
          userId,
          item.resourceId,
          resource.subjectCode,
          resource.semester,
          item.helpful ? 1 : 0,
          nowIso()
        );
        this.recomputeExamProvenScore(item.resourceId);
      }
    });
    return { submitted: items.length };
  },

  getPendingExamFeedback({ userId, semester = "" }) {
    const params = [userId];
    let semesterClause = "";
    if (semester) {
      semesterClause = "AND r.semester = ?";
      params.push(semester);
    }
    const rows = this.db
      .prepare(
        `
          SELECT DISTINCT r.*
          FROM lms_user_interactions ix
          JOIN lms_resources r ON r.id = ix.resourceId
          WHERE ix.userId = ?
            AND ix.resourceId IS NOT NULL
            ${semesterClause}
            AND NOT EXISTS (
              SELECT 1
              FROM lms_exam_feedback ef
              WHERE ef.userId = ix.userId
                AND ef.resourceId = ix.resourceId
                AND ef.semester = r.semester
            )
          ORDER BY r.subjectCode ASC, r.uploadedAt DESC
        `
      )
      .all(...params);
    return rows.map((row) => this.mapResource(row));
  }
};
