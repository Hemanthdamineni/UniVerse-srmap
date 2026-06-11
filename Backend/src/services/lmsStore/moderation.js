const {
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toInteger,
  normalizeTagList,
  parseJson,
  stringifyJson,
  assertCondition,
  clamp,
} = require("../lmsUtils");

const MODERATION_LABELS = {
  0: "Clear",
  1: "Flagged for review",
  2: "Hidden pending review",
  3: "Removed by moderation",
};

const MODERATION_DECISIONS = new Set(["approve", "hide", "remove", "restore"]);

module.exports = {
  buildModerationSummary(row) {
    const state = toInteger(row?.moderationState, 0);
    const flagCount = toInteger(row?.flagCount, 0);
    const isDeleted = Number(row?.isDeleted || 0) === 1;
    return {
      state,
      label: MODERATION_LABELS[state] || MODERATION_LABELS[0],
      flagCount,
      flagReason: row?.flagReason || null,
      publicEligible: !isDeleted && state < 2,
      searchEligible: !isDeleted && state < 2,
      recommendationEligible: !isDeleted && state === 0 && flagCount === 0,
      needsReview: flagCount > 0 || state > 0,
    };
  },

  getResourceFlags(resourceId, { includeResolved = true } = {}) {
    const params = [resourceId];
    const statusClause = includeResolved ? "" : "AND COALESCE(status, 'open') = 'open'";
    return this.db
      .prepare(
        `
          SELECT id, resourceId, userId, reason, createdAt, COALESCE(status, 'open') AS status, resolvedAt, resolvedBy
          FROM lms_flags
          WHERE resourceId = ? ${statusClause}
          ORDER BY createdAt DESC
        `
      )
      .all(...params);
  },

  listResourceModerationAudit(resourceId, limit = 20) {
    return this.db
      .prepare(
        `
          SELECT *
          FROM lms_resource_moderation_audit
          WHERE resourceId = ?
          ORDER BY createdAt DESC, rowid DESC
          LIMIT ?
        `
      )
      .all(resourceId, clamp(toInteger(limit, 20), 1, 100))
      .map((row) => ({
        ...row,
        metadata: parseJson(row.metadata, {}),
      }));
  },

  recordResourceModerationAudit(resourceId, { action, actorId, fromState, toState, reason, metadata = {} }) {
    this.db
      .prepare(
        `
          INSERT INTO lms_resource_moderation_audit
          (id, resourceId, action, actorId, fromState, toState, reason, metadata, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        randomId("modaudit"),
        resourceId,
        toSafeString(action),
        toSafeString(actorId) || "system",
        Number.isFinite(Number(fromState)) ? Number(fromState) : null,
        Number.isFinite(Number(toState)) ? Number(toState) : null,
        toNullableString(reason),
        stringifyJson(metadata, "{}"),
        nowIso()
      );
  },

  recomputeQualityScore(resourceId) {
    const counts = this.db
      .prepare(
        `
          SELECT
            r.upvotes,
            r.bookmarkCount,
            r.examProvenScore,
            COALESCE(AVG(rt.rating), 0) AS ratingAvg,
            COUNT(rt.userId) AS ratingCount
          FROM lms_resources r
          LEFT JOIN lms_ratings rt ON rt.resourceId = r.id
          WHERE r.id = ?
          GROUP BY r.id
        `
      )
      .get(resourceId);
    if (!counts) return 0;
    const score =
      Number(counts.ratingAvg || 0) * Math.log(1 + Number(counts.ratingCount || 0)) +
      Math.log(1 + Number(counts.upvotes || 0)) +
      Number(counts.bookmarkCount || 0) * 0.5 +
      Number(counts.examProvenScore || 0) * 2;
    this.db.prepare("UPDATE lms_resources SET qualityScore = ? WHERE id = ?").run(Number(score.toFixed(4)), resourceId);
    return Number(score.toFixed(4));
  },

  recomputeExamProvenScore(resourceId) {
    const counts = this.db
      .prepare(
        `
          SELECT
            SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) AS helpfulVotes,
            COUNT(*) AS totalVotes
          FROM lms_exam_feedback
          WHERE resourceId = ?
        `
      )
      .get(resourceId);
    const totalVotes = Number(counts?.totalVotes || 0);
    const helpfulVotes = Number(counts?.helpfulVotes || 0);
    const score = totalVotes > 0 ? (helpfulVotes / totalVotes) * Math.log(1 + totalVotes) : 0;
    this.db.prepare("UPDATE lms_resources SET examProvenScore = ? WHERE id = ?").run(Number(score.toFixed(4)), resourceId);
    this.recomputeQualityScore(resourceId);
    return Number(score.toFixed(4));
  },

  recomputeResourceEffectiveness(resourceId) {
    const row = this.db
      .prepare(
        `
          SELECT
            AVG(CASE WHEN percentage >= 60 THEN 1 ELSE 0 END) AS successRate,
            AVG(CASE WHEN percentage >= 100 THEN 1 ELSE 0 END) AS completionRate,
            AVG(COALESCE(timeTakenMs, 0)) AS avgTimeSpentMs,
            COUNT(*) AS sampleSize
          FROM lms_quiz_attempts
          WHERE resourceId = ?
        `
      )
      .get(resourceId);
    const record = {
      resourceId,
      successRate: Number(row?.successRate || 0),
      completionRate: Number(row?.completionRate || 0),
      avgTimeSpentMs: toInteger(row?.avgTimeSpentMs, 0),
      sampleSize: toInteger(row?.sampleSize, 0),
      lastUpdated: nowIso(),
    };
    this.db.prepare(
      `
        INSERT INTO lms_resource_effectiveness
        (resourceId, successRate, completionRate, avgTimeSpentMs, sampleSize, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(resourceId) DO UPDATE SET
          successRate = excluded.successRate,
          completionRate = excluded.completionRate,
          avgTimeSpentMs = excluded.avgTimeSpentMs,
          sampleSize = excluded.sampleSize,
          lastUpdated = excluded.lastUpdated
      `
    ).run(
      record.resourceId,
      record.successRate,
      record.completionRate,
      record.avgTimeSpentMs,
      record.sampleSize,
      record.lastUpdated
    );
    const score = record.sampleSize > 0 ? record.successRate * Math.log(1 + record.sampleSize) : 0;
    this.db.prepare("UPDATE lms_resources SET effectivenessScore = ? WHERE id = ?").run(
      Number(score.toFixed(4)),
      resourceId
    );
    return record;
  },

  recomputeModeration(resourceId) {
    const resource = this.getResourceRow(resourceId);
    if (!resource) return { flagCount: 0, moderationState: 0 };
    const row = this.db
      .prepare("SELECT COUNT(*) AS total FROM lms_flags WHERE resourceId = ? AND COALESCE(status, 'open') = 'open'")
      .get(resourceId);
    const previousState = toInteger(resource.moderationState, 0);
    const flagCount = toInteger(row?.total, 0);
    const moderationState = this.moderationService.computeModerationState(flagCount);
    this.db.prepare("UPDATE lms_resources SET flagCount = ?, moderationState = ? WHERE id = ?").run(
      flagCount,
      moderationState,
      resourceId
    );
    if (previousState !== moderationState && moderationState >= 2) {
      this.recordResourceModerationAudit(resourceId, {
        action: "auto_hidden_by_flags",
        actorId: "system",
        fromState: previousState,
        toState: moderationState,
        reason: `${flagCount} open report(s) crossed moderation threshold`,
        metadata: { flagCount },
      });
    }
    this.syncResourceSearchIndex(resourceId);
    return { flagCount, moderationState };
  },

  recomputeOutdated(resourceId) {
    const row = this.db
      .prepare("SELECT COUNT(*) AS total FROM lms_outdated_marks WHERE resourceId = ?")
      .get(resourceId);
    const outdatedCount = toInteger(row?.total, 0);
    const isOutdated = this.moderationService.isOutdated(outdatedCount);
    this.db.prepare("UPDATE lms_resources SET outdatedCount = ?, isOutdated = ? WHERE id = ?").run(
      outdatedCount,
      isOutdated,
      resourceId
    );
    return { outdatedCount, isOutdated };
  },

  flagResource(resourceId, userId, reason) {
    const resource = this.getResourceRow(resourceId);
    assertCondition(resource && Number(resource.isDeleted || 0) === 0, 404, "Resource not found", "LMS_NOT_FOUND");
    assertCondition(resource.uploadedBy !== userId, 400, "You cannot report your own resource", "LMS_SELF_REPORT");
    const normalizedReason = toSafeString(reason);
    assertCondition(normalizedReason.length >= 3, 400, "Report reason is required", "LMS_VALIDATION");
    const recentFlags = this.db
      .prepare(
        "SELECT COUNT(*) AS total FROM lms_flags WHERE userId = ? AND createdAt >= datetime('now', '-1 day')"
      )
      .get(userId);
    assertCondition(
      toInteger(recentFlags?.total, 0) < 25,
      429,
      "Daily report limit reached. Please retry later.",
      "LMS_FLAG_LIMIT"
    );
    const previousState = toInteger(resource.moderationState, 0);
    this.db.prepare(
      `
        INSERT INTO lms_flags (id, resourceId, userId, reason, createdAt, status, resolvedAt, resolvedBy)
        VALUES (?, ?, ?, ?, ?, 'open', NULL, NULL)
        ON CONFLICT(resourceId, userId) DO UPDATE SET
          reason = excluded.reason,
          status = 'open',
          resolvedAt = NULL,
          resolvedBy = NULL
      `
    ).run(randomId("flag"), resourceId, userId, normalizedReason, nowIso());
    const moderation = this.recomputeModeration(resourceId);
    this.recordResourceModerationAudit(resourceId, {
      action: "reported",
      actorId: userId,
      fromState: previousState,
      toState: moderation.moderationState,
      reason: normalizedReason,
      metadata: { flagCount: moderation.flagCount },
    });
    const updated = this.getResourceRow(resourceId);
    return {
      ...moderation,
      moderation: this.buildModerationSummary(updated),
    };
  },

  moderateResource(resourceId, payload = {}, { userId = "system" } = {}) {
    const resource = this.getResourceRow(resourceId);
    assertCondition(resource, 404, "Resource not found", "LMS_NOT_FOUND");
    const decision = toSafeString(payload.decision || payload.action).toLowerCase();
    assertCondition(MODERATION_DECISIONS.has(decision), 400, "Invalid moderation decision", "LMS_VALIDATION");
    const reason = toSafeString(payload.reason || payload.flagReason);
    assertCondition(reason.length >= 3, 400, "Moderation reason is required", "LMS_VALIDATION");

    const previousState = toInteger(resource.moderationState, 0);
    const nextState = decision === "hide" ? 2 : decision === "remove" ? 3 : 0;
    const now = nowIso();
    this.withTransaction(() => {
      this.db
        .prepare(
          `
            UPDATE lms_flags
            SET status = 'resolved', resolvedAt = ?, resolvedBy = ?
            WHERE resourceId = ? AND COALESCE(status, 'open') = 'open'
          `
        )
        .run(now, userId, resourceId);
      this.db
        .prepare(
          "UPDATE lms_resources SET flagCount = 0, moderationState = ?, flagReason = ?, updatedAt = ? WHERE id = ?"
        )
        .run(nextState, reason, now, resourceId);
      this.recordResourceModerationAudit(resourceId, {
        action: `decision_${decision}`,
        actorId: userId,
        fromState: previousState,
        toState: nextState,
        reason,
        metadata: {
          decision,
          resolvedOpenFlags: toInteger(resource.flagCount, 0),
        },
      });
    });
    this.syncResourceSearchIndex(resourceId);
    return {
      resource: this.getResource(resourceId, userId, { includeHiddenOwn: true, isAdmin: true }),
      audit: this.listResourceModerationAudit(resourceId),
    };
  },

  getResourceModerationQueue(filters = {}) {
    const stateFilter = toSafeString(filters.state || filters.status).toLowerCase();
    const queryText = toSafeString(filters.query).toLowerCase();
    const page = Math.max(1, toInteger(filters.page, 1));
    const limit = clamp(toInteger(filters.limit, 25), 1, 100);
    const params = [];
    const where = ["r.isDeleted = 0", "(r.flagCount > 0 OR r.moderationState > 0)"];

    if (stateFilter && stateFilter !== "all") {
      if (stateFilter === "flagged") where.push("r.flagCount > 0");
      if (stateFilter === "hidden") where.push("r.moderationState = 2");
      if (stateFilter === "removed") where.push("r.moderationState = 3");
      if (stateFilter === "visible") where.push("r.moderationState < 2");
    }
    if (queryText) {
      where.push("(lower(r.title) LIKE ? OR lower(r.subjectCode) LIKE ? OR lower(r.uploadedBy) LIKE ?)");
      params.push(`%${queryText}%`, `%${queryText}%`, `%${queryText}%`);
    }

    const countParams = [...params];
    const total = toInteger(
      this.db
        .prepare(`SELECT COUNT(*) AS total FROM lms_resources r WHERE ${where.join(" AND ")}`)
        .get(...countParams)?.total,
      0
    );
    const rows = this.db
      .prepare(
        `
          SELECT r.*
          FROM lms_resources r
          WHERE ${where.join(" AND ")}
          ORDER BY r.flagCount DESC, r.updatedAt DESC, r.uploadedAt DESC
          LIMIT ? OFFSET ?
        `
      )
      .all(...params, limit, (page - 1) * limit);
    const countsRow = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN flagCount > 0 THEN 1 ELSE 0 END) AS flagged,
            SUM(CASE WHEN moderationState = 2 THEN 1 ELSE 0 END) AS hidden,
            SUM(CASE WHEN moderationState = 3 THEN 1 ELSE 0 END) AS removed,
            SUM(CASE WHEN moderationState < 2 AND flagCount > 0 THEN 1 ELSE 0 END) AS visible
          FROM lms_resources
          WHERE isDeleted = 0 AND (flagCount > 0 OR moderationState > 0)
        `
      )
      .get();
    const items = rows.map((row) => {
      const resource = this.mapResource(row);
      return {
        ...resource,
        flags: this.getResourceFlags(row.id),
        audit: this.listResourceModerationAudit(row.id),
      };
    });

    return {
      items,
      counts: {
        total: toInteger(countsRow?.total, 0),
        flagged: toInteger(countsRow?.flagged, 0),
        hidden: toInteger(countsRow?.hidden, 0),
        removed: toInteger(countsRow?.removed, 0),
        visible: toInteger(countsRow?.visible, 0),
      },
      pagination: { page, limit, total },
    };
  },

  markOutdated(resourceId, userId, reason) {
    this.db.prepare(
      `
        INSERT INTO lms_outdated_marks (resourceId, userId, reason, createdAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(resourceId, userId) DO UPDATE SET reason = excluded.reason
      `
    ).run(resourceId, userId, toNullableString(reason), nowIso());
    return this.recomputeOutdated(resourceId);
  },

  rateResource(resourceId, userId, rating, review, dimensionTags) {
    const normalizedRating = clamp(toInteger(rating, 0), 1, 5);
    this.db.prepare(
      `
        INSERT INTO lms_ratings (resourceId, userId, rating, review, dimensionTags, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(resourceId, userId) DO UPDATE SET
          rating = excluded.rating,
          review = excluded.review,
          dimensionTags = excluded.dimensionTags,
          createdAt = excluded.createdAt
      `
    ).run(resourceId, userId, normalizedRating, toNullableString(review), stringifyJson(normalizeTagList(dimensionTags), "[]"), nowIso());
    this.recomputeQualityScore(resourceId);
    return this.getResource(resourceId, userId, { includeHiddenOwn: true });
  }
};
