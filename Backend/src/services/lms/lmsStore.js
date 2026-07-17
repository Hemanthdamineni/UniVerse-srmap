const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { nowIso, toBooleanInteger, parseJson, randomId, toSafeString, toNullableString, assertCondition, toInteger, ensureArray, clamp, stringifyJson, normalizeUnit, normalizeTagList, toNullableInteger, startOfDayIso, addDaysIso, QUESTION_DIFFICULTIES, RESOURCE_TYPES, DIFFICULTY_LEVELS, EXAM_TYPES, ROADMAP_NODE_TYPES, ensureObject } = require("./lmsUtils");
const { runLmsMigrations } = require("./lmsMigrations");

// --- collections.js ---

const collectionsMethods = {
  createCollection(userId, name, description, isPublic) {
    const id = randomId("col");
    this.db.prepare(
      "INSERT INTO lms_collections (id, userId, name, description, isPublic, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, userId, toSafeString(name), toNullableString(description), toBooleanInteger(isPublic), nowIso());
    return this.getCollection(id, userId);
  },

  listCollections(userId) {
    return this.db
      .prepare(
        `
          SELECT *
          FROM lms_collections
          WHERE userId = ? OR isPublic = 1
          ORDER BY createdAt DESC
        `
      )
      .all(userId);
  },

  getCollection(id, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(id);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(
      collection.userId === userId || Number(collection.isPublic || 0) === 1,
      403,
      "You cannot view this collection",
      "LMS_FORBIDDEN"
    );
    const items = this.db
      .prepare(
        `
          SELECT r.*
          FROM lms_collection_items ci
          JOIN lms_resources r ON r.id = ci.resourceId
          WHERE ci.collectionId = ?
          ORDER BY ci.addedAt DESC
        `
      )
      .all(id)
      .map((row) => this.mapResource(row));
    return { ...collection, items };
  },

  addToCollection(collectionId, resourceId, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(collectionId);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(collection.userId === userId, 403, "You cannot modify this collection", "LMS_FORBIDDEN");
    this.db.prepare(
      "INSERT OR IGNORE INTO lms_collection_items (collectionId, resourceId, addedAt) VALUES (?, ?, ?)"
    ).run(collectionId, resourceId, nowIso());
    return this.getCollection(collectionId, userId);
  },

  removeFromCollection(collectionId, resourceId, userId) {
    const collection = this.db.prepare("SELECT * FROM lms_collections WHERE id = ?").get(collectionId);
    assertCondition(collection, 404, "Collection not found", "LMS_NOT_FOUND");
    assertCondition(collection.userId === userId, 403, "You cannot modify this collection", "LMS_FORBIDDEN");
    this.db.prepare("DELETE FROM lms_collection_items WHERE collectionId = ? AND resourceId = ?").run(
      collectionId,
      resourceId
    );
    return this.getCollection(collectionId, userId);
  }
};

// --- community.js ---

const communityMethods = {
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

// --- featureFlags.js ---
const featureFlagMethods = {
  listFeatureFlags() {
    return this.db.prepare("SELECT * FROM lms_feature_flags ORDER BY key ASC").all();
  },

  getFeatureFlag(key) {
    return this.db.prepare("SELECT * FROM lms_feature_flags WHERE key = ?").get(key);
  },

  upsertFeatureFlag({ key, enabled, rolloutType, rolloutValue, description, updatedBy, updatedAt }) {
    this.db.prepare(
      `
        INSERT INTO lms_feature_flags (key, enabled, rolloutType, rolloutValue, description, updatedBy, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          enabled = excluded.enabled,
          rolloutType = excluded.rolloutType,
          rolloutValue = excluded.rolloutValue,
          description = excluded.description,
          updatedBy = excluded.updatedBy,
          updatedAt = excluded.updatedAt
      `
    ).run(key, toBooleanInteger(enabled), rolloutType, rolloutValue, description, updatedBy, updatedAt);
    return this.getFeatureFlag(key);
  },

  getExperimentAssignment(experimentKey, userId) {
    return this.db
      .prepare("SELECT * FROM lms_experiments WHERE experimentKey = ? AND userId = ?")
      .get(experimentKey, userId);
  },

  assignExperiment({ experimentKey, userId, variant, assignedAt }) {
    this.db.prepare(
      `
        INSERT INTO lms_experiments (experimentKey, userId, variant, assignedAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(userId, experimentKey) DO UPDATE SET
          variant = excluded.variant,
          assignedAt = excluded.assignedAt
      `
    ).run(experimentKey, userId, variant, assignedAt);
    return this.getExperimentAssignment(experimentKey, userId);
  },

  logShadowRanking({ userId, resourceId, algorithmKey, shadowScore, displayedScore }) {
    this.db.prepare(
      `
        INSERT INTO lms_ranking_shadow (userId, resourceId, algorithmKey, shadowScore, displayedScore, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId, algorithmKey) DO UPDATE SET
          shadowScore = excluded.shadowScore,
          displayedScore = excluded.displayedScore,
          createdAt = excluded.createdAt
      `
    ).run(userId, resourceId, algorithmKey, shadowScore, displayedScore, nowIso());
  }
};

// --- guides.js ---

const guideMethods = {
  listGuideSections(guideId) {
    return this.db
      .prepare("SELECT * FROM lms_guide_sections WHERE guideId = ? ORDER BY position ASC")
      .all(guideId);
  },

  getGuideProgressRow(userId, guideId) {
    const row = this.db
      .prepare("SELECT * FROM lms_guide_progress WHERE userId = ? AND guideId = ?")
      .get(userId, guideId);
    return row
      ? {
          ...row,
          readSections: parseJson(row.readSections, []),
        }
      : null;
  },

  hasEntityUpvote(entityType, entityId, userId) {
    const tableName = entityType === "guide" ? "lms_guide_upvotes" : "lms_roadmap_upvotes";
    this.db.exec(
      `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          entityId TEXT NOT NULL,
          userId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          PRIMARY KEY (entityId, userId)
        )
      `
    );
    return Boolean(this.db.prepare(`SELECT 1 FROM ${tableName} WHERE entityId = ? AND userId = ?`).get(entityId, userId));
  },

  toggleEntityUpvote(entityType, entityId, userId) {
    const tableName = entityType === "guide" ? "lms_guide_upvotes" : "lms_roadmap_upvotes";
    const targetTable = entityType === "guide" ? "lms_guides" : "lms_roadmaps";
    this.db.exec(
      `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          entityId TEXT NOT NULL,
          userId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          PRIMARY KEY (entityId, userId)
        )
      `
    );
    const existing = this.db.prepare(`SELECT 1 FROM ${tableName} WHERE entityId = ? AND userId = ?`).get(entityId, userId);
    if (existing) {
      this.db.prepare(`DELETE FROM ${tableName} WHERE entityId = ? AND userId = ?`).run(entityId, userId);
      this.db.prepare(`UPDATE ${targetTable} SET upvotes = MAX(0, upvotes - 1) WHERE id = ?`).run(entityId);
      return { active: false };
    }
    this.db.prepare(`INSERT INTO ${tableName} (entityId, userId, createdAt) VALUES (?, ?, ?)`).run(
      entityId,
      userId,
      nowIso()
    );
    this.db.prepare(`UPDATE ${targetTable} SET upvotes = upvotes + 1 WHERE id = ?`).run(entityId);
    return { active: true };
  },

  createGuide(userId, payload) {
    const id = randomId("guide");
    const tags = normalizeTagList(payload.tags);
    this.db.prepare(
      `
        INSERT INTO lms_guides
        (id, title, description, authorId, subjectCode, subjectName, semester, unit, unitNormalized, tags, difficulty, exportable, published, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      toSafeString(payload.title),
      toNullableString(payload.description),
      userId,
      toSafeString(payload.subjectCode).toUpperCase(),
      toSafeString(payload.subjectName),
      toSafeString(payload.semester),
      toSafeString(payload.unit),
      normalizeUnit(payload.unit),
      stringifyJson(tags, "[]"),
      toNullableString(payload.difficulty),
      payload.exportable === undefined ? 1 : toBooleanInteger(Boolean(payload.exportable)),
      payload.published ? 1 : 0,
      nowIso()
    );
    const sections = ensureArray(payload.sections);
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      this.db.prepare(
        "INSERT INTO lms_guide_sections (id, guideId, title, content, position) VALUES (?, ?, ?, ?, ?)"
      ).run(randomId("gsec"), id, toSafeString(section.title), toSafeString(section.content), index + 1);
    }
    return this.getGuide(id, userId);
  },

  getGuideRow(id) {
    return this.db.prepare("SELECT * FROM lms_guides WHERE id = ?").get(id);
  },

  createGuideVersion(guideId, createdBy) {
    const guide = this.getGuideRow(guideId);
    if (!guide) return null;
    const row = this.db
      .prepare("SELECT COALESCE(MAX(versionNumber), 0) AS maxVersion FROM lms_guide_versions WHERE guideId = ?")
      .get(guideId);
    const versionNumber = Number(row?.maxVersion || 0) + 1;
    const snapshot = {
      ...this.mapGuide(guide, true),
    };
    this.db.prepare(
      `
        INSERT INTO lms_guide_versions (id, guideId, versionNumber, snapshot, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(randomId("guidever"), guideId, versionNumber, stringifyJson(snapshot, "{}"), createdBy, nowIso());
    return versionNumber;
  },

  listGuides(filters = {}, { userId = "" } = {}) {
    const params = [];
    const where = ["isDeleted = 0"];
    if (!filters.includeDrafts) where.push("published = 1");
    if (filters.subjectCode) {
      where.push("subjectCode = ?");
      params.push(toSafeString(filters.subjectCode).toUpperCase());
    }
    const rows = this.db
      .prepare(`SELECT * FROM lms_guides WHERE ${where.join(" AND ")} ORDER BY qualityScore DESC, createdAt DESC`)
      .all(...params);
    return rows.map((row) => this.mapGuide(row, false, userId));
  },

  getGuide(id, userId = "", { isAdmin = false } = {}) {
    const guide = this.getGuideRow(id);
    assertCondition(guide, 404, "Guide not found", "LMS_NOT_FOUND");
    assertCondition(
      Number(guide.isDeleted || 0) === 0 || guide.authorId === userId || isAdmin,
      404,
      "Guide not found",
      "LMS_NOT_FOUND"
    );
    return this.mapGuide(guide, true, userId);
  },

  deleteGuide(id, userId, { isAdmin = false } = {}) {
    const guide = this.getGuideRow(id);
    assertCondition(guide, 404, "Guide not found", "LMS_NOT_FOUND");
    assertCondition(isAdmin || guide.authorId === userId, 403, "You cannot delete this guide", "LMS_FORBIDDEN");
    const timestamp = nowIso();
    this.db
      .prepare("UPDATE lms_guides SET isDeleted = 1, deletedAt = ?, deletedBy = ?, updatedAt = ? WHERE id = ?")
      .run(timestamp, userId, timestamp, id);
    return { deleted: true, id };
  },

  updateGuide(id, userId, payload, { isAdmin = false } = {}) {
    const guide = this.getGuideRow(id);
    assertCondition(guide, 404, "Guide not found", "LMS_NOT_FOUND");
    assertCondition(isAdmin || guide.authorId === userId, 403, "You cannot edit this guide", "LMS_FORBIDDEN");
    const merged = {
      ...guide,
      ...payload,
    };
    this.withTransaction(() => {
      this.createGuideVersion(id, userId);
      this.db.prepare(
        `
          UPDATE lms_guides
          SET title = ?, description = ?, subjectCode = ?, subjectName = ?, semester = ?, unit = ?, unitNormalized = ?,
              tags = ?, difficulty = ?, exportable = ?, published = ?, updatedAt = ?
          WHERE id = ?
        `
      ).run(
        toSafeString(merged.title),
        toNullableString(merged.description),
        toSafeString(merged.subjectCode).toUpperCase(),
        toSafeString(merged.subjectName),
        toSafeString(merged.semester),
        toSafeString(merged.unit),
        normalizeUnit(merged.unit),
        stringifyJson(normalizeTagList(merged.tags), "[]"),
        toNullableString(merged.difficulty),
        merged.exportable === undefined ? 1 : toBooleanInteger(Boolean(merged.exportable)),
        merged.published ? 1 : 0,
        nowIso(),
        id
      );
      if (Array.isArray(payload.sections)) {
        this.db.prepare("DELETE FROM lms_guide_sections WHERE guideId = ?").run(id);
        for (let index = 0; index < payload.sections.length; index += 1) {
          const section = payload.sections[index];
          this.db.prepare(
            "INSERT INTO lms_guide_sections (id, guideId, title, content, position) VALUES (?, ?, ?, ?, ?)"
          ).run(randomId("gsec"), id, toSafeString(section.title), toSafeString(section.content), index + 1);
        }
      }
    });
    return this.getGuide(id, userId);
  },

  addGuideSection(guideId, userId, payload) {
    const guide = this.getGuideRow(guideId);
    assertCondition(guide, 404, "Guide not found", "LMS_NOT_FOUND");
    assertCondition(guide.authorId === userId, 403, "You cannot edit this guide", "LMS_FORBIDDEN");
    const row = this.db
      .prepare("SELECT COALESCE(MAX(position), 0) AS maxPosition FROM lms_guide_sections WHERE guideId = ?")
      .get(guideId);
    const id = randomId("gsec");
    this.db.prepare(
      "INSERT INTO lms_guide_sections (id, guideId, title, content, position) VALUES (?, ?, ?, ?, ?)"
    ).run(id, guideId, toSafeString(payload.title), toSafeString(payload.content), Number(row?.maxPosition || 0) + 1);
    return this.getGuide(guideId, userId);
  },

  updateGuideSection(guideId, sectionId, userId, payload) {
    const guide = this.getGuideRow(guideId);
    assertCondition(guide, 404, "Guide not found", "LMS_NOT_FOUND");
    assertCondition(guide.authorId === userId, 403, "You cannot edit this guide", "LMS_FORBIDDEN");
    this.db.prepare("UPDATE lms_guide_sections SET title = ?, content = ? WHERE id = ? AND guideId = ?").run(
      toSafeString(payload.title),
      toSafeString(payload.content),
      sectionId,
      guideId
    );
    return this.getGuide(guideId, userId);
  },

  markGuideSectionRead(guideId, sectionId, userId) {
    const current = this.getGuideProgressRow(userId, guideId) || {
      readSections: [],
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    const readSections = [...new Set([...ensureArray(current.readSections), sectionId])];
    this.db.prepare(
      `
        INSERT INTO lms_guide_progress (userId, guideId, readSections, startedAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, guideId) DO UPDATE SET readSections = excluded.readSections, updatedAt = excluded.updatedAt
      `
    ).run(userId, guideId, stringifyJson(readSections, "[]"), current.startedAt, nowIso());
    return this.getGuide(guideId, userId);
  }
};

// --- learningDiscovery.js ---

const learningDiscoveryMethods = {
  listRecommendationCandidates({ userId = "", filters = {}, limit = 30 }) {
    const items = this.getResources(
      {
        ...filters,
        recommendable: true,
        limit,
        page: 1,
      },
      { userId }
    ).items;
    return items.map((item) => {
      const interaction = userId
        ? this.db
            .prepare(
              "SELECT action, createdAt FROM lms_user_interactions WHERE userId = ? AND resourceId = ? ORDER BY createdAt DESC LIMIT 1"
            )
            .get(userId, item.id)
        : null;
      return {
        ...item,
        userInteraction: interaction || null,
        userEnrolled: Boolean(userId && this.db.prepare("SELECT 1 FROM lms_progress WHERE userId = ? AND resourceId = ?").get(userId, item.id)),
      };
    });
  },

  getExplore(userId) {
    const trending = this.db
      .prepare(
        `
          SELECT r.*, COUNT(ix.id) AS recentInteractions
          FROM lms_resources r
          LEFT JOIN lms_user_interactions ix
            ON ix.resourceId = r.id AND ix.createdAt >= datetime('now', '-7 days')
          WHERE r.isDeleted = 0 AND r.moderationState < 2
          GROUP BY r.id
          ORDER BY recentInteractions DESC, r.qualityScore DESC
          LIMIT 8
        `
      )
      .all()
      .map((row) => this.attachResourceUserState(this.mapResource(row), userId));
    const topRated = this.getResources({ sort: "quality", limit: 8, page: 1 }, { userId }).items;
    const examReady = this.db
      .prepare(
        "SELECT * FROM lms_resources WHERE isDeleted = 0 AND moderationState < 2 AND examProvenScore > 2.0 ORDER BY examProvenScore DESC LIMIT 8"
      )
      .all()
      .map((row) => this.attachResourceUserState(this.mapResource(row), userId));
    return { trending, topRated, examReady };
  },

  getSubjectOverview(subjectCode, userId) {
    const resources = this.getResources({ subjectCode, limit: 200, page: 1 }, { userId }).items;
    const byUnit = new Map();
    for (const resource of resources) {
      const bucket = byUnit.get(resource.unitNormalized) || [];
      bucket.push(resource);
      byUnit.set(resource.unitNormalized, bucket);
    }
    const topByUnit = Array.from(byUnit.entries()).map(([unitNormalized, items]) => ({
      unitNormalized,
      unit: items[0]?.unit || unitNormalized,
      topResource: items.sort((left, right) => right.qualityScore - left.qualityScore)[0] || null,
    }));
    const requests = this.getRequests({ subjectCode, status: "open", limit: 20, page: 1 }).items;
    const topicMastery = this.db
      .prepare(
        `
          SELECT tm.*, t.label
          FROM lms_topic_mastery tm
          JOIN lms_topics t ON t.id = tm.topicId
          WHERE tm.userId = ? AND t.subjectCode = ?
          ORDER BY t.label ASC
        `
      )
      .all(userId, toSafeString(subjectCode).toUpperCase());
    return {
      subjectCode: toSafeString(subjectCode).toUpperCase(),
      topByUnit,
      examProven: resources.filter((item) => Number(item.examProvenScore || 0) > 2).slice(0, 8),
      openRequests: requests,
      topicMastery,
      studyingCount: this.getCurrentlyStudyingCount(subjectCode),
    };
  },

  getTopicGraph(subjectCode) {
    const topics = this.db.prepare("SELECT * FROM lms_topics WHERE subjectCode = ? ORDER BY label ASC").all(
      toSafeString(subjectCode).toUpperCase()
    );
    const prerequisites = this.db
      .prepare(
        `
          SELECT tp.topicId, tp.prerequisiteId, t1.label AS topicLabel, t2.label AS prerequisiteLabel
          FROM lms_topic_prerequisites tp
          JOIN lms_topics t1 ON t1.id = tp.topicId
          JOIN lms_topics t2 ON t2.id = tp.prerequisiteId
          WHERE t1.subjectCode = ?
        `
      )
      .all(toSafeString(subjectCode).toUpperCase());
    return { topics: topics.map((row) => ({ ...row, crossSubjectLinks: parseJson(row.crossSubjectLinks, []) })), prerequisites };
  },

  getCurrentlyStudyingCount(subjectCode) {
    const row = this.db
      .prepare(
        `
          SELECT COUNT(DISTINCT ix.userId) AS total
          FROM lms_user_interactions ix
          JOIN lms_resources r ON r.id = ix.resourceId
          WHERE r.subjectCode = ? AND ix.createdAt >= datetime('now', '-1 day')
        `
      )
      .get(toSafeString(subjectCode).toUpperCase());
    return toInteger(row?.total, 0);
  },

  getWeeklyLeaderboard() {
    const resourceRows = this.db
      .prepare(
        `
          SELECT uploadedBy AS userId, COUNT(*) AS uploads
          FROM lms_resources
          WHERE uploadedAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY uploadedBy
        `
      )
      .all();
    const guideRows = this.db
      .prepare(
        `
          SELECT authorId AS userId, COUNT(*) AS guidesPublished
          FROM lms_guides
          WHERE createdAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY authorId
        `
      )
      .all();
    const roadmapRows = this.db
      .prepare(
        `
          SELECT authorId AS userId, COUNT(*) AS roadmapsPublished
          FROM lms_roadmaps
          WHERE createdAt >= datetime('now', '-7 days') AND isDeleted = 0
          GROUP BY authorId
        `
      )
      .all();
    const points = new Map();
    const merge = (userId, field, value) => {
      const existing = points.get(userId) || { userId, uploads: 0, guidesPublished: 0, roadmapsPublished: 0, score: 0 };
      existing[field] = Number(value || 0);
      existing.score = existing.uploads * 1 + existing.guidesPublished * 5 + existing.roadmapsPublished * 10;
      points.set(userId, existing);
    };
    for (const row of resourceRows) merge(row.userId, "uploads", row.uploads);
    for (const row of guideRows) merge(row.userId, "guidesPublished", row.guidesPublished);
    for (const row of roadmapRows) merge(row.userId, "roadmapsPublished", row.roadmapsPublished);
    return Array.from(points.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  },

  getProgressSummary(userId) {
    const rows = this.db
      .prepare(
        `
          SELECT p.*, r.subjectCode, r.subjectName, r.title
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ?
          ORDER BY p.updatedAt DESC
        `
      )
      .all(userId);
    const completed = rows.filter((row) => row.status === "completed").length;
    const started = rows.length;
    const perSubject = new Map();
    for (const row of rows) {
      const bucket = perSubject.get(row.subjectCode) || { subjectCode: row.subjectCode, subjectName: row.subjectName, started: 0, completed: 0 };
      bucket.started += 1;
      if (row.status === "completed") bucket.completed += 1;
      perSubject.set(row.subjectCode, bucket);
    }
    return {
      started,
      completed,
      completionRate: started > 0 ? Number(((completed / started) * 100).toFixed(2)) : 0,
      subjects: Array.from(perSubject.values()),
    };
  },

  getProgressForSubject(userId, subjectCode) {
    return this.db
      .prepare(
        `
          SELECT p.*, r.title, r.type, r.unit, r.subjectName
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ? AND r.subjectCode = ?
          ORDER BY p.updatedAt DESC
        `
      )
      .all(userId, toSafeString(subjectCode).toUpperCase());
  },

  getMastery(userId) {
    return this.db
      .prepare(
        `
          SELECT tm.*, t.label, t.subjectCode
          FROM lms_topic_mastery tm
          JOIN lms_topics t ON t.id = tm.topicId
          WHERE tm.userId = ?
          ORDER BY t.subjectCode ASC, t.label ASC
        `
      )
      .all(userId);
  },

  generateLearningSession(userId, durationMinutes) {
    const dueItems = this.getRevisionQueue(userId).slice(0, 2);
    const recommendations = this.listRecommendationCandidates({ userId, limit: 10 });
    const resources = recommendations.slice(0, 2);
    return {
      durationMinutes: toInteger(durationMinutes, 30),
      revision: dueItems,
      resources,
      totalEstimatedMinutes: resources.reduce((sum, item) => sum + Number(item.estimatedMinutes || 5), 0),
    };
  },

  getUserContributions(userId) {
    return {
      resources: this.db.prepare("SELECT * FROM lms_resources WHERE uploadedBy = ? ORDER BY uploadedAt DESC").all(userId).map((row) => this.mapResource(row)),
      guides: this.db.prepare("SELECT * FROM lms_guides WHERE authorId = ? ORDER BY createdAt DESC").all(userId).map((row) => this.mapGuide(row, false, userId)),
      roadmaps: this.db.prepare("SELECT * FROM lms_roadmaps WHERE authorId = ? ORDER BY createdAt DESC").all(userId).map((row) => this.mapRoadmap(row, false, userId)),
    };
  },

  getBookmarkedResources(userId) {
    return this.db
      .prepare(
        `
          SELECT r.*
          FROM lms_bookmarks b
          JOIN lms_resources r ON r.id = b.resourceId
          WHERE b.userId = ?
          ORDER BY b.createdAt DESC
        `
      )
      .all(userId)
      .map((row) => this.mapResource(row));
  },

  getActivity(userId) {
    return this.db
      .prepare("SELECT * FROM lms_user_interactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 100")
      .all(userId)
      .map((row) => ({ ...row, metadata: parseJson(row.metadata, {}) }));
  },

  getUserRequests(userId) {
    return this.db.prepare("SELECT * FROM lms_requests WHERE userId = ? ORDER BY createdAt DESC").all(userId);
  },

  getContributorProfile(userId) {
    const contributions = this.getUserContributions(userId);
    const summary = this.getPublisherSummary(userId);
    const resourceCount = contributions.resources.length;
    const guideCount = contributions.guides.length;
    const roadmapCount = contributions.roadmaps.length;
    return {
      userId,
      displayName: summary.displayName,
      trust: summary,
      totals: {
        resources: resourceCount,
        guides: guideCount,
        roadmaps: roadmapCount,
      },
      recentResources: contributions.resources.slice(0, 5),
      contributions,
    };
  }
};

// --- learningProgress.js ---

const learningProgressMethods = {
  markProgress(userId, resourceId, status, timeSpentMs = 0) {
    assertCondition(["started", "completed"].includes(status), 400, "Invalid progress status", "LMS_VALIDATION");
    const completedAt = status === "completed" ? nowIso() : null;
    this.db.prepare(
      `
        INSERT INTO lms_progress (userId, resourceId, status, completedAt, timeSpentMs, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId) DO UPDATE SET
          status = excluded.status,
          completedAt = excluded.completedAt,
          timeSpentMs = excluded.timeSpentMs,
          updatedAt = excluded.updatedAt
      `
    ).run(userId, resourceId, status, completedAt, toInteger(timeSpentMs, 0), nowIso());
    this.recordActivity(userId);
    return this.db.prepare("SELECT * FROM lms_progress WHERE userId = ? AND resourceId = ?").get(userId, resourceId);
  },

  getContinueLearning(userId) {
    const row = this.db
      .prepare(
        `
          SELECT r.*, p.updatedAt AS progressUpdatedAt
          FROM lms_progress p
          JOIN lms_resources r ON r.id = p.resourceId
          WHERE p.userId = ? AND p.status = 'started'
          ORDER BY p.updatedAt DESC
          LIMIT 1
        `
      )
      .get(userId);
    return row ? this.mapResource(row) : null;
  },

  updateTopicMastery(userId, topicId, quizScore = 0, interactionScore = 0, revisionScore = 0) {
    const current = this.db
      .prepare("SELECT * FROM lms_topic_mastery WHERE userId = ? AND topicId = ?")
      .get(userId, topicId) || {
      mastery: 0,
      quizScore: 0,
      interactionScore: 0,
      revisionScore: 0,
    };
    const nextQuiz = quizScore !== undefined ? Number(quizScore || current.quizScore || 0) : Number(current.quizScore || 0);
    const nextInteraction = interactionScore !== undefined
      ? Number(interactionScore || current.interactionScore || 0)
      : Number(current.interactionScore || 0);
    const nextRevision = revisionScore !== undefined
      ? Number(revisionScore || current.revisionScore || 0)
      : Number(current.revisionScore || 0);
    const mastery = clamp(nextQuiz * 0.5 + nextInteraction * 0.25 + nextRevision * 0.25, 0, 1);
    this.db.prepare(
      `
        INSERT INTO lms_topic_mastery (userId, topicId, mastery, quizScore, interactionScore, revisionScore, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, topicId) DO UPDATE SET
          mastery = excluded.mastery,
          quizScore = excluded.quizScore,
          interactionScore = excluded.interactionScore,
          revisionScore = excluded.revisionScore,
          lastUpdated = excluded.lastUpdated
      `
    ).run(userId, topicId, mastery, nextQuiz, nextInteraction, nextRevision, nowIso());
    return this.db
      .prepare("SELECT * FROM lms_topic_mastery WHERE userId = ? AND topicId = ?")
      .get(userId, topicId);
  },

  getRevisionQueue(userId) {
    return this.db
      .prepare(
        `
          SELECT rq.*, r.title, r.subjectCode, r.subjectName, r.type, r.estimatedMinutes
          FROM lms_revision_queue rq
          JOIN lms_resources r ON r.id = rq.resourceId
          WHERE rq.userId = ? AND r.isDeleted = 0
          ORDER BY rq.dueDate ASC
        `
      )
      .all(userId);
  },

  updateRevisionSchedule(userId, resourceId, score) {
    const current = this.db
      .prepare("SELECT * FROM lms_revision_queue WHERE userId = ? AND resourceId = ?")
      .get(userId, resourceId) || {
      interval: 1,
      repetition: 0,
    };
    const next = this.revisionScheduler.getNextRevision({
      previousInterval: current.interval,
      previousRepetition: current.repetition,
      score,
    });
    this.db.prepare(
      `
        INSERT INTO lms_revision_queue (userId, resourceId, dueDate, interval, repetition)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId) DO UPDATE SET
          dueDate = excluded.dueDate,
          interval = excluded.interval,
          repetition = excluded.repetition
      `
    ).run(userId, resourceId, next.dueDate, next.interval, next.repetition);
    return this.getRevisionQueue(userId);
  },

  submitRevisionReview(userId, resourceId, score) {
    const queue = this.updateRevisionSchedule(userId, resourceId, score);
    const topics = this.getTopicsForResource(resourceId);
    for (const topic of topics) {
      this.updateTopicMastery(userId, topic.id, undefined, undefined, clamp(Number(score || 0) / 100, 0, 1));
    }
    this.recordActivity(userId);
    return queue;
  },

  recordActivity(userId, activityDate = new Date()) {
    const today = startOfDayIso(activityDate);
    const current = this.db.prepare("SELECT * FROM lms_streaks WHERE userId = ?").get(userId);
    if (!current) {
      this.db.prepare(
        "INSERT INTO lms_streaks (userId, currentStreak, longestStreak, lastActivityDate) VALUES (?, 1, 1, ?)"
      ).run(userId, today);
      return { userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today };
    }
    if (current.lastActivityDate === today) return current;
    const yesterday = addDaysIso(today, -1);
    const currentStreak = current.lastActivityDate === yesterday ? Number(current.currentStreak || 0) + 1 : 1;
    const longestStreak = Math.max(Number(current.longestStreak || 0), currentStreak);
    this.db.prepare(
      "UPDATE lms_streaks SET currentStreak = ?, longestStreak = ?, lastActivityDate = ? WHERE userId = ?"
    ).run(currentStreak, longestStreak, today, userId);
    return { userId, currentStreak, longestStreak, lastActivityDate: today };
  },

  getStreak(userId) {
    return this.db.prepare("SELECT * FROM lms_streaks WHERE userId = ?").get(userId) || {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
    };
  },

  recordQuizAttempt(resourceId, userId, payload) {
    const answers = ensureArray(payload.answers);
    const questionIds = this.db
      .prepare("SELECT questionId FROM lms_quiz_questions WHERE resourceId = ? ORDER BY position ASC")
      .all(resourceId)
      .map((row) => row.questionId);
    const questions = questionIds.map((questionId) => this.getQuestionBankItem(questionId)).filter(Boolean);
    let score = 0;
    questions.forEach((question, index) => {
      if (Number(answers[index]) === Number(question.correctIndex)) {
        score += 1;
      }
    });
    const maxScore = Math.max(1, questions.length);
    const percentage = Number(((score / maxScore) * 100).toFixed(2));
    const id = randomId("attempt");
    this.db.prepare(
      `
        INSERT INTO lms_quiz_attempts (id, resourceId, userId, answers, score, maxScore, percentage, mode, timeTakenMs, completedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      resourceId,
      userId,
      stringifyJson(answers, "[]"),
      score,
      maxScore,
      percentage,
      toSafeString(payload.mode || "practice"),
      toNullableInteger(payload.timeTakenMs),
      nowIso()
    );
    this.recomputeResourceEffectiveness(resourceId);
    this.markProgress(userId, resourceId, "completed", toInteger(payload.timeTakenMs, 0));
    const topics = this.getTopicsForResource(resourceId);
    for (const topic of topics) {
      this.updateTopicMastery(userId, topic.id, clamp(percentage / 100, 0, 1));
    }
    this.updateRevisionSchedule(userId, resourceId, percentage);
    return this.db.prepare("SELECT * FROM lms_quiz_attempts WHERE id = ?").get(id);
  },

  getQuizAttempts(resourceId, userId) {
    return this.db
      .prepare("SELECT * FROM lms_quiz_attempts WHERE resourceId = ? AND userId = ? ORDER BY completedAt DESC")
      .all(resourceId, userId)
      .map((row) => ({ ...row, answers: parseJson(row.answers, []) }));
  },

  applyInteractionEffects({ userId, resourceId, action, timeSpentMs = 0 }) {
    if (action === "view") {
      this.db.prepare("UPDATE lms_resources SET viewCount = viewCount + 1 WHERE id = ?").run(resourceId);
      this.markProgress(userId, resourceId, "started", timeSpentMs);
    }
    if (action === "complete") {
      this.markProgress(userId, resourceId, "completed", timeSpentMs);
    }
    if (action === "bookmark") {
      this.toggleBookmark(resourceId, userId);
    }
    if (action === "upvote") {
      this.toggleUpvote(resourceId, userId);
    }
  },

  insertInteractionBatch(events) {
    this.withTransaction(() => {
      for (const event of events) {
        this.db.prepare(
          `
            INSERT OR IGNORE INTO lms_user_interactions
            (id, userId, resourceId, guideId, roadmapId, action, timeSpentMs, metadata, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          event.id,
          event.userId,
          toNullableString(event.resourceId),
          toNullableString(event.guideId),
          toNullableString(event.roadmapId),
          toSafeString(event.action),
          toNullableInteger(event.timeSpentMs),
          typeof event.metadata === "string" ? event.metadata : stringifyJson(event.metadata || {}, "{}"),
          event.createdAt || nowIso()
        );
      }
    });
    return events.length;
  }
};

// --- moderation.js ---

const MODERATION_LABELS = {
  0: "Clear",
  1: "Flagged for review",
  2: "Hidden pending review",
  3: "Removed by moderation",
};

const MODERATION_DECISIONS = new Set(["approve", "hide", "remove", "restore"]);

const moderationMethods = {
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

// --- questionBank.js ---

const questionBankMethods = {
  addQuestion(userId, payload) {
    const difficulty = toSafeString(payload.difficulty).toLowerCase();
    if (difficulty) {
      assertCondition(
        QUESTION_DIFFICULTIES.has(difficulty),
        400,
        "Invalid question difficulty",
        "LMS_INVALID_DIFFICULTY"
      );
    }
    const id = randomId("qb");
    this.db.prepare(
      `
        INSERT INTO lms_question_bank
        (id, subjectCode, unit, unitNormalized, topicId, question, options, correctIndex, explanation, difficulty, contributedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      toSafeString(payload.subjectCode).toUpperCase(),
      toNullableString(payload.unit),
      payload.unit ? normalizeUnit(payload.unit) : null,
      toNullableString(payload.topicId),
      toSafeString(payload.question),
      stringifyJson(ensureArray(payload.options), "[]"),
      clamp(toInteger(payload.correctIndex, 0), 0, Math.max(0, ensureArray(payload.options).length - 1)),
      toNullableString(payload.explanation),
      difficulty || null,
      userId,
      nowIso()
    );
    return this.getQuestionBankItem(id);
  },

  getQuestionBankItem(id) {
    const row = this.db.prepare("SELECT * FROM lms_question_bank WHERE id = ?").get(id);
    if (!row) return null;
    return { ...row, options: parseJson(row.options, []) };
  },

  getQuestionBank(subjectCode, filters = {}) {
    const params = [toSafeString(subjectCode).toUpperCase()];
    const where = ["subjectCode = ?"];
    if (filters.unit) {
      where.push("unitNormalized = ?");
      params.push(normalizeUnit(filters.unit));
    }
    if (filters.difficulty) {
      where.push("difficulty = ?");
      params.push(toSafeString(filters.difficulty).toLowerCase());
    }
    const page = Math.max(1, toInteger(filters.page, 1));
    const limit = clamp(toInteger(filters.limit, 20), 1, 50);
    params.push(limit, (page - 1) * limit);
    const rows = this.db
      .prepare(
        `SELECT * FROM lms_question_bank WHERE ${where.join(" AND ")} ORDER BY upvotes DESC, createdAt DESC LIMIT ? OFFSET ?`
      )
      .all(...params);
    return { items: rows.map((row) => ({ ...row, options: parseJson(row.options, []) })), pagination: { page, limit } };
  },

  upvoteQuestion(questionId) {
    this.db.prepare("UPDATE lms_question_bank SET upvotes = upvotes + 1 WHERE id = ?").run(questionId);
    return this.getQuestionBankItem(questionId);
  },

  buildQuizFromBank(subjectCode, unit, count = 10, difficulty = "") {
    const rows = this.getQuestionBank(subjectCode, {
      unit,
      difficulty,
      limit: count,
      page: 1,
    }).items;
    assertCondition(rows.length > 0, 404, "No questions available", "LMS_NOT_FOUND");
    return {
      questions: rows.slice(0, count),
      count: rows.slice(0, count).length,
    };
  }
};

// --- resourceInput.js ---

function normalizeTitle(value) {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const resourceInputMethods = {
  checkDuplicate({ fileHash = "", title = "", subjectCode = "", excludeId = "" }) {
    const exact = fileHash
      ? this.db
          .prepare(
            `
              SELECT id, title, subjectCode, uploadedBy, uploadedAt
              FROM lms_resources
              WHERE fileHash = ? AND isDeleted = 0 AND (? = '' OR id != ?)
              LIMIT 1
            `
          )
          .get(fileHash, excludeId, excludeId)
      : null;

    const normalized = normalizeTitle(title);
    const similar = normalized
      ? this.db
          .prepare(
            `
              SELECT id, title, subjectCode, uploadedBy, uploadedAt
              FROM lms_resources
              WHERE lower(title) = ? AND subjectCode = ? AND isDeleted = 0 AND (? = '' OR id != ?)
              ORDER BY uploadedAt DESC
              LIMIT 5
            `
          )
          .all(normalized, subjectCode, excludeId, excludeId)
      : [];

    return {
      exact: exact || null,
      similar,
      hasDuplicate: Boolean(exact) || similar.length > 0,
    };
  },

  normalizeResourceInput(payload) {
    const type = toSafeString(payload.type).toLowerCase();
    assertCondition(RESOURCE_TYPES.has(type), 400, "Invalid resource type", "LMS_INVALID_TYPE");
    const difficulty = toSafeString(payload.difficulty).toLowerCase();
    if (difficulty) {
      assertCondition(
        DIFFICULTY_LEVELS.has(difficulty),
        400,
        "Invalid difficulty",
        "LMS_INVALID_DIFFICULTY"
      );
    }
    const examType = toSafeString(payload.examType).toLowerCase();
    if (examType) {
      assertCondition(EXAM_TYPES.has(examType), 400, "Invalid exam type", "LMS_INVALID_EXAM_TYPE");
    }

    return {
      type,
      title: toSafeString(payload.title),
      description: toNullableString(payload.description),
      difficulty: difficulty || null,
      semester: toSafeString(payload.semester),
      subjectCode: toSafeString(payload.subjectCode).toUpperCase(),
      subjectName: toSafeString(payload.subjectName),
      unit: toSafeString(payload.unit),
      unitNormalized: normalizeUnit(payload.unit),
      tags: normalizeTagList(payload.tags),
      url: toNullableString(payload.url),
      filePath: toNullableString(payload.filePath),
      fileSize: toNullableInteger(payload.fileSize),
      fileHash: toNullableString(payload.fileHash),
      mimeType: toNullableString(payload.mimeType),
      noteContent: toNullableString(payload.noteContent),
      structuredContent: payload.structuredContent === undefined || payload.structuredContent === null
        ? null
        : typeof payload.structuredContent === "string"
          ? payload.structuredContent
          : stringifyJson(payload.structuredContent, "{}"),
      examYear: toNullableString(payload.examYear),
      examType: examType || null,
      examMonth: toNullableString(payload.examMonth),
      exportable: payload.exportable === undefined ? 1 : toBooleanInteger(Boolean(payload.exportable)),
      validForSemester: toNullableString(payload.validForSemester),
      estimatedMinutes: toNullableInteger(payload.estimatedMinutes),
      renderType: toNullableString(payload.renderType),
    };
  },
};

// --- resources.js ---

const resourceMethods = {
  createResource(userId, payload) {
    const normalized = this.normalizeResourceInput(payload);
    assertCondition(normalized.title, 400, "title is required", "LMS_VALIDATION");
    assertCondition(normalized.semester, 400, "semester is required", "LMS_VALIDATION");
    assertCondition(normalized.subjectCode, 400, "subjectCode is required", "LMS_VALIDATION");
    assertCondition(normalized.subjectName, 400, "subjectName is required", "LMS_VALIDATION");
    assertCondition(normalized.unit, 400, "unit is required", "LMS_VALIDATION");

    const id = randomId("res");
    const uploadedAt = nowIso();

    this.withTransaction(() => {
      this.db.prepare(
        `
          INSERT INTO lms_resources (
            id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
            tags, uploadedBy, uploadedAt, updatedAt, url, filePath, fileSize, fileHash, mimeType,
            noteContent, structuredContent, examYear, examType, examMonth, exportable, validForSemester,
            estimatedMinutes, renderType
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        id,
        normalized.type,
        normalized.title,
        normalized.description,
        normalized.difficulty,
        normalized.semester,
        normalized.subjectCode,
        normalized.subjectName,
        normalized.unit,
        normalized.unitNormalized,
        stringifyJson(normalized.tags, "[]"),
        userId,
        uploadedAt,
        normalized.url,
        normalized.filePath,
        normalized.fileSize,
        normalized.fileHash,
        normalized.mimeType,
        normalized.noteContent,
        normalized.structuredContent,
        normalized.examYear,
        normalized.examType,
        normalized.examMonth,
        normalized.exportable,
        normalized.validForSemester,
        normalized.estimatedMinutes,
        normalized.renderType
      );
      this.ensureTopicsForTags({
        resourceId: id,
        subjectCode: normalized.subjectCode,
        tags: normalized.tags,
      });
      this.syncResourceSearchIndex(id);
      if (normalized.fileSize) {
        this.updateUserStorage(userId, normalized.fileSize);
      }
    });

    return this.getResource(id, userId, { includeHiddenOwn: true });
  },

  getResourceRow(id) {
    return this.db.prepare("SELECT * FROM lms_resources WHERE id = ?").get(id);
  },

  createResourceVersion(resourceId, createdBy) {
    const current = this.getResourceRow(resourceId);
    if (!current) return null;
    const row = this.db
      .prepare(
        "SELECT COALESCE(MAX(versionNumber), 0) AS maxVersion FROM lms_resource_versions WHERE resourceId = ?"
      )
      .get(resourceId);
    const versionNumber = Number(row?.maxVersion || 0) + 1;
    this.db.prepare(
      `
        INSERT INTO lms_resource_versions (id, resourceId, versionNumber, snapshot, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(randomId("resver"), resourceId, versionNumber, stringifyJson(this.mapResource(current), "{}"), createdBy, nowIso());
    return versionNumber;
  },

  updateResource(id, userId, payload, { isAdmin = false } = {}) {
    const existing = this.getResourceRow(id);
    assertCondition(existing, 404, "Resource not found", "LMS_NOT_FOUND");
    assertCondition(
      isAdmin || existing.uploadedBy === userId,
      403,
      "You cannot edit this resource",
      "LMS_FORBIDDEN"
    );

    const merged = this.normalizeResourceInput({
      ...existing,
      ...payload,
    });

    this.withTransaction(() => {
      this.createResourceVersion(id, userId);
      this.db.prepare(
        `
          UPDATE lms_resources
          SET title = ?, description = ?, difficulty = ?, semester = ?, subjectCode = ?, subjectName = ?, unit = ?,
              unitNormalized = ?, tags = ?, updatedAt = ?, url = ?, filePath = ?, fileSize = ?, fileHash = ?,
              mimeType = ?, noteContent = ?, structuredContent = ?, examYear = ?, examType = ?, examMonth = ?,
              exportable = ?, validForSemester = ?, estimatedMinutes = ?, renderType = ?, isDeleted = 0,
              deletedAt = NULL, deletedBy = NULL
          WHERE id = ?
        `
      ).run(
        merged.title,
        merged.description,
        merged.difficulty,
        merged.semester,
        merged.subjectCode,
        merged.subjectName,
        merged.unit,
        merged.unitNormalized,
        stringifyJson(merged.tags, "[]"),
        nowIso(),
        merged.url,
        merged.filePath,
        merged.fileSize,
        merged.fileHash,
        merged.mimeType,
        merged.noteContent,
        merged.structuredContent,
        merged.examYear,
        merged.examType,
        merged.examMonth,
        merged.exportable,
        merged.validForSemester,
        merged.estimatedMinutes,
        merged.renderType,
        id
      );
      this.ensureTopicsForTags({ resourceId: id, subjectCode: merged.subjectCode, tags: merged.tags });
      this.syncResourceSearchIndex(id);
    });

    return this.getResource(id, userId, { includeHiddenOwn: true });
  },

  deleteResource(id, userId, { isAdmin = false } = {}) {
    const resource = this.getResourceRow(id);
    assertCondition(resource, 404, "Resource not found", "LMS_NOT_FOUND");
    assertCondition(
      isAdmin || resource.uploadedBy === userId,
      403,
      "You cannot delete this resource",
      "LMS_FORBIDDEN"
    );
    this.db
      .prepare("UPDATE lms_resources SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?")
      .run(nowIso(), userId, id);
    // Decrement user storage quota so totalBytes doesn't inflate over time
    // as resources are created and soft-deleted.
    if (resource.fileSize) {
      this.updateUserStorage(resource.uploadedBy, -(resource.fileSize));
    }
    this.syncResourceSearchIndex(id);
    return { deleted: true, id };
  },

  restoreResource(id, userId, { isAdmin = false } = {}) {
    const resource = this.getResourceRow(id);
    assertCondition(resource, 404, "Resource not found", "LMS_NOT_FOUND");
    assertCondition(
      isAdmin || resource.uploadedBy === userId,
      403,
      "You cannot restore this resource",
      "LMS_FORBIDDEN"
    );
    this.db
      .prepare("UPDATE lms_resources SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?")
      .run(id);
    // Restore storage quota that was decremented on soft-delete.
    if (resource.fileSize) {
      this.updateUserStorage(resource.uploadedBy, resource.fileSize);
    }
    this.syncResourceSearchIndex(id);
    return this.getResource(id, userId, { includeHiddenOwn: true });
  },

  purgeResource(id) {
    const resource = this.getResourceRow(id);
    if (!resource) return { deleted: false, id };
    this.withTransaction(() => {
      this.db.prepare("DELETE FROM lms_resources WHERE id = ?").run(id);
      this.db.prepare("DELETE FROM lms_search WHERE rowid = (SELECT rowid FROM lms_resources WHERE id = ?)").run(id);
    });
    return { deleted: true, id };
  },

  bulkResourceOperation(userId, operation, resourceIds, payload = {}, { isAdmin = false } = {}) {
    const ids = ensureArray(resourceIds).map((id) => toSafeString(id)).filter(Boolean);
    assertCondition(ids.length > 0, 400, "resourceIds[] is required", "LMS_VALIDATION");
    const results = [];
    this.withTransaction(() => {
      for (const resourceId of ids) {
        if (operation === "delete") {
          results.push(this.deleteResource(resourceId, userId, { isAdmin }));
          continue;
        }
        if (operation === "tag") {
          const resource = this.getResourceRow(resourceId);
          if (!resource) continue;
          const tags = normalizeTagList(payload.tags);
          this.db.prepare("UPDATE lms_resources SET tags = ?, updatedAt = ? WHERE id = ?").run(
            stringifyJson(tags, "[]"),
            nowIso(),
            resourceId
          );
          this.ensureTopicsForTags({ resourceId, subjectCode: resource.subjectCode, tags });
          this.syncResourceSearchIndex(resourceId);
          results.push({ id: resourceId, updated: true });
          continue;
        }
        if (operation === "moderation") {
          const resource = this.getResourceRow(resourceId);
          if (!resource) continue;
          const previousState = toInteger(resource.moderationState, 0);
          const nextState = clamp(toInteger(payload.moderationState, 0), 0, 3);
          const reason = toSafeString(payload.flagReason || payload.reason || "Bulk moderation decision");
          this.db
            .prepare(
              `
                UPDATE lms_flags
                SET status = 'resolved', resolvedAt = ?, resolvedBy = ?
                WHERE resourceId = ? AND COALESCE(status, 'open') = 'open'
              `
            )
            .run(nowIso(), userId, resourceId);
          this.db
            .prepare("UPDATE lms_resources SET flagCount = 0, moderationState = ?, flagReason = ?, updatedAt = ? WHERE id = ?")
            .run(nextState, reason, nowIso(), resourceId);
          this.recordResourceModerationAudit(resourceId, {
            action: "bulk_moderation",
            actorId: userId,
            fromState: previousState,
            toState: nextState,
            reason,
            metadata: { operation },
          });
          this.syncResourceSearchIndex(resourceId);
          results.push({ id: resourceId, updated: true, moderationState: nextState });
        }
      }
    });
    return { operation, count: results.length, results };
  },

  getResources(filters = {}, { userId = "" } = {}) {
    const query = this.buildResourceListQuery(filters);
    const countQuery = this.buildResourceListQuery(filters, { countOnly: true });
    const rows = this.db.prepare(query.sql).all(...query.params);
    const total = Number(this.db.prepare(countQuery.sql).get(...countQuery.params)?.total || 0);
    return {
      items: rows.map((row) => this.attachResourceUserState(this.mapResource(row), userId)),
      pagination: {
        page: Math.max(1, toInteger(filters.page, 1)),
        limit: clamp(toInteger(filters.limit, 20), 1, 50),
        total,
      },
    };
  },

  getPyqBank(subjectCode, filters = {}, { userId = "" } = {}) {
    return this.getResources(
      {
        ...filters,
        subjectCode,
        type: "pyq",
      },
      { userId }
    );
  },

  getUpcomingExamPyqs(userId) {
    const subjectCodes = [
      ...new Set(
        this.db
          .prepare(
            `
              SELECT DISTINCT r.subjectCode
              FROM lms_progress p
              JOIN lms_resources r ON r.id = p.resourceId
              WHERE p.userId = ?
            `
          )
          .all(userId)
          .map((row) => row.subjectCode)
      ),
    ];
    const results = [];
    for (const subjectCode of subjectCodes) {
      results.push(...this.getPyqBank(subjectCode, { limit: 5, page: 1, sort: "recent" }, { userId }).items);
    }
    return results.slice(0, 10);
  },

  attachResourceUserState(resource, userId) {
    if (!resource) return null;
    if (!userId) return resource;
    const upvote = this.db
      .prepare("SELECT 1 FROM lms_upvotes WHERE resourceId = ? AND userId = ?")
      .get(resource.id, userId);
    const bookmark = this.db
      .prepare("SELECT 1 FROM lms_bookmarks WHERE resourceId = ? AND userId = ?")
      .get(resource.id, userId);
    const outdated = this.db
      .prepare("SELECT 1 FROM lms_outdated_marks WHERE resourceId = ? AND userId = ?")
      .get(resource.id, userId);
    const rating = this.db
      .prepare("SELECT rating, review, dimensionTags FROM lms_ratings WHERE resourceId = ? AND userId = ?")
      .get(resource.id, userId);
    return {
      ...resource,
      userUpvoted: Boolean(upvote),
      userBookmarked: Boolean(bookmark),
      userMarkedOutdated: Boolean(outdated),
      userRating: rating
        ? {
            rating: rating.rating,
            review: rating.review,
            dimensionTags: parseJson(rating.dimensionTags, []),
          }
        : null,
    };
  },

  getResource(id, userId = "", { includeHiddenOwn = false, isAdmin = false } = {}) {
    const resource = this.getResourceRow(id);
    assertCondition(resource, 404, "Resource not found", "LMS_NOT_FOUND");
    const isOwner = resource.uploadedBy === userId;
    const canViewHidden = isAdmin || (includeHiddenOwn && isOwner);
    assertCondition(
      Number(resource.isDeleted || 0) === 0 || canViewHidden,
      404,
      "Resource not found",
      "LMS_NOT_FOUND"
    );
    assertCondition(
      Number(resource.moderationState || 0) < 2 || canViewHidden,
      404,
      "Resource not found",
      "LMS_NOT_FOUND"
    );
    const mapped = this.attachResourceUserState(this.mapResource(resource), userId);
    return {
      ...mapped,
      comments: this.listComments(id, userId),
      annotations: userId ? this.getAnnotations(userId, id) : [],
      related: this.getResources(
        {
          subjectCode: resource.subjectCode,
          unit: resource.unitNormalized,
          limit: 6,
          sort: "quality",
        },
        { userId }
      ).items.filter((item) => item.id !== id),
    };
  },

  toggleUpvote(resourceId, userId) {
    const existing = this.db
      .prepare("SELECT 1 FROM lms_upvotes WHERE resourceId = ? AND userId = ?")
      .get(resourceId, userId);
    if (existing) {
      this.db.prepare("DELETE FROM lms_upvotes WHERE resourceId = ? AND userId = ?").run(resourceId, userId);
      this.db.prepare("UPDATE lms_resources SET upvotes = MAX(0, upvotes - 1) WHERE id = ?").run(resourceId);
      this.recomputeQualityScore(resourceId);
      return { active: false };
    }
    this.db.prepare("INSERT INTO lms_upvotes (resourceId, userId, createdAt) VALUES (?, ?, ?)").run(
      resourceId,
      userId,
      nowIso()
    );
    this.db.prepare("UPDATE lms_resources SET upvotes = upvotes + 1 WHERE id = ?").run(resourceId);
    this.recomputeQualityScore(resourceId);
    return { active: true };
  },

  toggleBookmark(resourceId, userId) {
    const existing = this.db
      .prepare("SELECT 1 FROM lms_bookmarks WHERE resourceId = ? AND userId = ?")
      .get(resourceId, userId);
    if (existing) {
      this.db.prepare("DELETE FROM lms_bookmarks WHERE resourceId = ? AND userId = ?").run(resourceId, userId);
      this.db.prepare("UPDATE lms_resources SET bookmarkCount = MAX(0, bookmarkCount - 1) WHERE id = ?").run(
        resourceId
      );
      this.recomputeQualityScore(resourceId);
      return { active: false };
    }
    this.db.prepare("INSERT INTO lms_bookmarks (resourceId, userId, createdAt) VALUES (?, ?, ?)").run(
      resourceId,
      userId,
      nowIso()
    );
    this.db.prepare("UPDATE lms_resources SET bookmarkCount = bookmarkCount + 1 WHERE id = ?").run(resourceId);
    this.recomputeQualityScore(resourceId);
    return { active: true };
  }
};

// --- resourceSearch.js ---

const resourceSearchMethods = {
  createSearchIndex() {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS lms_search USING fts5(
        title, description, tags,
        content='lms_resources',
        content_rowid='rowid'
      )
    `);
  },

  isSearchIndexError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("lms_search") ||
      message.includes("database disk image is malformed")
    );
  },

  rebuildSearchIndex() {
    this.db.exec("DROP TABLE IF EXISTS lms_search");
    this.createSearchIndex();
    const rows = this.db
      .prepare(
        `
          SELECT rowid, title, description, tags
          FROM lms_resources
          WHERE isDeleted = 0 AND moderationState < 2
        `
      )
      .all();
    const insert = this.db.prepare(
      "INSERT INTO lms_search (rowid, title, description, tags) VALUES (?, ?, ?, ?)"
    );
    for (const row of rows) {
      insert.run(row.rowid, row.title, row.description || "", row.tags || "[]");
    }
  },

  syncResourceSearchIndexOnce(resourceId) {
    const row = this.db
      .prepare(
        `
          SELECT rowid, title, description, tags, isDeleted, moderationState
          FROM lms_resources
          WHERE id = ?
        `
      )
      .get(resourceId);
    this.createSearchIndex();
    if (!row || Number(row.isDeleted || 0) === 1 || Number(row.moderationState || 0) >= 2) {
      this.rebuildSearchIndex();
      return;
    }
    this.db.prepare("DELETE FROM lms_search WHERE rowid = ?").run(row.rowid);
    this.db.prepare(
      "INSERT INTO lms_search (rowid, title, description, tags) VALUES (?, ?, ?, ?)"
    ).run(row.rowid, row.title, row.description || "", row.tags || "[]");
  },

  syncResourceSearchIndex(resourceId) {
    try {
      this.syncResourceSearchIndexOnce(resourceId);
    } catch (error) {
      if (!this.isSearchIndexError(error)) {
        throw error;
      }
      this.rebuildSearchIndex();
      this.syncResourceSearchIndexOnce(resourceId);
    }
  },

  buildResourceListQuery(filters = {}, { countOnly = false } = {}) {
    const params = [];
    const where = ["r.isDeleted = 0"];
    const sortMap = {
      quality: "r.qualityScore DESC, r.uploadedAt DESC",
      recent: "r.uploadedAt DESC",
      popular: "r.upvotes DESC, r.viewCount DESC",
      effective: "r.effectivenessScore DESC, r.qualityScore DESC",
      exam_proven: "r.examProvenScore DESC, r.qualityScore DESC",
    };

    if (filters.subjectCode) {
      where.push("r.subjectCode = ?");
      params.push(toSafeString(filters.subjectCode).toUpperCase());
    }
    if (filters.semester) {
      where.push("r.semester = ?");
      params.push(toSafeString(filters.semester));
    }
    if (filters.unit) {
      where.push("r.unitNormalized = ?");
      params.push(normalizeUnit(filters.unit));
    }
    if (filters.type) {
      where.push("r.type = ?");
      params.push(toSafeString(filters.type).toLowerCase());
    }
    if (filters.difficulty) {
      where.push("r.difficulty = ?");
      params.push(toSafeString(filters.difficulty).toLowerCase());
    }
    if (filters.examYear) {
      where.push("r.examYear = ?");
      params.push(toSafeString(filters.examYear));
    }
    if (filters.examType) {
      where.push("r.examType = ?");
      params.push(toSafeString(filters.examType).toLowerCase());
    }
    if (filters.examProven) {
      where.push("r.examProvenScore > 2.0");
    }
    if (filters.query) {
      const pattern = `%${toSafeString(filters.query).toLowerCase()}%`;
      where.push("(lower(r.title) LIKE ? OR lower(COALESCE(r.description, '')) LIKE ? OR lower(COALESCE(r.tags, '')) LIKE ?)");
      params.push(pattern, pattern, pattern);
    }
    const tags = normalizeTagList(filters.tags);
    for (const tag of tags) {
      where.push("lower(r.tags) LIKE ?");
      params.push(`%${tag.toLowerCase()}%`);
    }

    if (filters.recommendable) {
      where.push("r.moderationState = 0", "r.flagCount = 0");
    } else {
      where.push("r.moderationState < 2");
    }

    if (countOnly) {
      return {
        sql: `SELECT COUNT(*) AS total FROM lms_resources r WHERE ${where.join(" AND ")}`,
        params,
      };
    }

    const page = Math.max(1, toInteger(filters.page, 1));
    const limit = clamp(toInteger(filters.limit, 20), 1, 50);
    params.push(limit, (page - 1) * limit);
    return {
      sql: `
        SELECT r.*
        FROM lms_resources r
        WHERE ${where.join(" AND ")}
        ORDER BY ${sortMap[toSafeString(filters.sort)] || sortMap.quality}
        LIMIT ? OFFSET ?
      `,
      params,
    };
  },
};

// --- roadmaps.js ---

const roadmapMethods = {
  createRoadmap(userId, payload) {
    const id = randomId("roadmap");
    this.db.prepare(
      `
        INSERT INTO lms_roadmaps
        (id, title, description, skill, authorId, difficulty, estimatedHours, published, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      toSafeString(payload.title),
      toNullableString(payload.description),
      toSafeString(payload.skill),
      userId,
      toNullableString(payload.difficulty),
      toNullableInteger(payload.estimatedHours),
      payload.published ? 1 : 0,
      nowIso()
    );
    return this.getRoadmap(id, userId);
  },

  getRoadmapRow(id) {
    return this.db.prepare("SELECT * FROM lms_roadmaps WHERE id = ?").get(id);
  },

  listRoadmapNodes(roadmapId) {
    return this.db
      .prepare("SELECT * FROM lms_roadmap_nodes WHERE roadmapId = ? ORDER BY position ASC")
      .all(roadmapId);
  },

  listRoadmapEdges(roadmapId) {
    return this.db.prepare("SELECT * FROM lms_roadmap_edges WHERE roadmapId = ?").all(roadmapId);
  },

  getRoadmapProgressRow(userId, roadmapId) {
    const row = this.db
      .prepare("SELECT * FROM lms_roadmap_progress WHERE userId = ? AND roadmapId = ?")
      .get(userId, roadmapId);
    return row
      ? {
          ...row,
          completedNodes: parseJson(row.completedNodes, []),
        }
      : null;
  },

  listRoadmaps({ userId = "", includeDrafts = false } = {}) {
    const rows = this.db
      .prepare(`SELECT * FROM lms_roadmaps WHERE isDeleted = 0 ${includeDrafts ? "" : "AND published = 1"} ORDER BY qualityScore DESC, createdAt DESC`)
      .all();
    return rows.map((row) => this.mapRoadmap(row, false, userId));
  },

  getRoadmap(id, userId = "", { isAdmin = false } = {}) {
    const roadmap = this.getRoadmapRow(id);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(
      Number(roadmap.isDeleted || 0) === 0 || roadmap.authorId === userId || isAdmin,
      404,
      "Roadmap not found",
      "LMS_NOT_FOUND"
    );
    return this.mapRoadmap(roadmap, true, userId);
  },

  deleteRoadmap(id, userId, { isAdmin = false } = {}) {
    const roadmap = this.getRoadmapRow(id);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(isAdmin || roadmap.authorId === userId, 403, "You cannot delete this roadmap", "LMS_FORBIDDEN");
    const timestamp = nowIso();
    this.db
      .prepare("UPDATE lms_roadmaps SET isDeleted = 1, deletedAt = ?, deletedBy = ?, updatedAt = ? WHERE id = ?")
      .run(timestamp, userId, timestamp, id);
    return { deleted: true, id };
  },

  addRoadmapNode(roadmapId, userId, payload) {
    const roadmap = this.getRoadmapRow(roadmapId);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(roadmap.authorId === userId, 403, "You cannot edit this roadmap", "LMS_FORBIDDEN");
    const nodeType = toSafeString(payload.nodeType).toLowerCase();
    assertCondition(ROADMAP_NODE_TYPES.has(nodeType), 400, "Invalid nodeType", "LMS_VALIDATION");
    const row = this.db
      .prepare("SELECT COALESCE(MAX(position), 0) AS maxPosition FROM lms_roadmap_nodes WHERE roadmapId = ?")
      .get(roadmapId);
    const id = randomId("rnode");
    this.db.prepare(
      `
        INSERT INTO lms_roadmap_nodes
        (id, roadmapId, title, description, nodeType, resourceId, position, isOptional)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      roadmapId,
      toSafeString(payload.title),
      toNullableString(payload.description),
      nodeType,
      toNullableString(payload.resourceId),
      Number(row?.maxPosition || 0) + 1,
      payload.isOptional ? 1 : 0
    );
    return this.getRoadmap(roadmapId, userId);
  },

  addRoadmapEdge(roadmapId, userId, fromNodeId, toNodeId) {
    const roadmap = this.getRoadmapRow(roadmapId);
    assertCondition(roadmap, 404, "Roadmap not found", "LMS_NOT_FOUND");
    assertCondition(roadmap.authorId === userId, 403, "You cannot edit this roadmap", "LMS_FORBIDDEN");
    // Cycle detection: check if adding fromNodeId -> toNodeId would create a cycle
    const cycleExists = this.db.prepare(`
      WITH RECURSIVE path(n) AS (
        SELECT ?
        UNION
        SELECT e.fromNodeId FROM lms_roadmap_edges e JOIN path p ON e.toNodeId = p.n
        WHERE e.roadmapId = ?
      )
      SELECT 1 FROM path WHERE n = ?
    `).get(toNodeId, roadmapId, fromNodeId);
    if (cycleExists) {
      const error = new Error("Adding this edge would create a cycle");
      error.status = 409;
      throw error;
    }
    this.db.prepare(
      "INSERT OR IGNORE INTO lms_roadmap_edges (roadmapId, fromNodeId, toNodeId) VALUES (?, ?, ?)"
    ).run(roadmapId, fromNodeId, toNodeId);
    return this.getRoadmap(roadmapId, userId);
  },

  markRoadmapNodeComplete(roadmapId, nodeId, userId) {
    const current = this.getRoadmapProgressRow(userId, roadmapId) || {
      completedNodes: [],
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    const completedNodes = [...new Set([...ensureArray(current.completedNodes), nodeId])];
    this.db.prepare(
      `
        INSERT INTO lms_roadmap_progress (userId, roadmapId, completedNodes, startedAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(userId, roadmapId) DO UPDATE SET completedNodes = excluded.completedNodes, updatedAt = excluded.updatedAt
      `
    ).run(userId, roadmapId, stringifyJson(completedNodes, "[]"), current.startedAt, nowIso());
    return this.getRoadmap(roadmapId, userId);
  }
};

// --- userState.js ---

const userStateMethods = {
  getUserStorageRow(userId) {
    const row = this.db.prepare("SELECT * FROM lms_user_storage WHERE userId = ?").get(userId);
    if (row) return row;
    this.db.prepare("INSERT INTO lms_user_storage (userId, totalBytes) VALUES (?, 0)").run(userId);
    return { userId, totalBytes: 0 };
  },

  updateUserStorage(userId, deltaBytes) {
    const current = this.getUserStorageRow(userId);
    const totalBytes = Math.max(0, Number(current.totalBytes || 0) + Number(deltaBytes || 0));
    this.db.prepare("UPDATE lms_user_storage SET totalBytes = ? WHERE userId = ?").run(totalBytes, userId);
    return totalBytes;
  },

  getPublisherSummary(userId) {
    const normalizedUserId = toSafeString(userId);
    if (!normalizedUserId) {
      return {
        userId: "",
        displayName: "Legacy contributor",
        contributionCount: 0,
        approvedCount: 0,
        flaggedCount: 0,
        hiddenCount: 0,
        qualityAverage: 0,
        upvoteTotal: 0,
        trustScore: 35,
        lastPublishedAt: null,
      };
    }

    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS contributionCount,
            SUM(CASE WHEN isDeleted = 0 AND moderationState < 2 THEN 1 ELSE 0 END) AS approvedCount,
            SUM(CASE WHEN flagCount > 0 THEN 1 ELSE 0 END) AS flaggedCount,
            SUM(CASE WHEN moderationState >= 2 OR isDeleted = 1 THEN 1 ELSE 0 END) AS hiddenCount,
            COALESCE(AVG(qualityScore), 0) AS qualityAverage,
            COALESCE(SUM(upvotes), 0) AS upvoteTotal,
            MAX(uploadedAt) AS lastPublishedAt
          FROM lms_resources
          WHERE uploadedBy = ?
        `
      )
      .get(normalizedUserId);
    const contributionCount = toInteger(row?.contributionCount, 0);
    const approvedCount = toInteger(row?.approvedCount, 0);
    const flaggedCount = toInteger(row?.flaggedCount, 0);
    const hiddenCount = toInteger(row?.hiddenCount, 0);
    const qualityAverage = Number(Number(row?.qualityAverage || 0).toFixed(2));
    const upvoteTotal = toInteger(row?.upvoteTotal, 0);
    const trustScore = Math.round(
      clamp(
        50 +
          approvedCount * 7 +
          Math.min(qualityAverage, 10) * 3 +
          Math.min(upvoteTotal, 50) * 0.5 -
          flaggedCount * 8 -
          hiddenCount * 15,
        0,
        100
      )
    );

    return {
      userId: normalizedUserId,
      displayName: normalizedUserId,
      contributionCount,
      approvedCount,
      flaggedCount,
      hiddenCount,
      qualityAverage,
      upvoteTotal,
      trustScore,
      lastPublishedAt: row?.lastPublishedAt || null,
    };
  },

  getUserPreferences(userId) {
    let row = this.db.prepare("SELECT * FROM lms_user_preferences WHERE userId = ?").get(userId);
    if (!row) {
      const created = {
        userId,
        subjectWeights: "{}",
        typeWeights: "{}",
        difficultyPref: "any",
        topicWeights: "{}",
        explorationRate: 0.2,
        lastUpdated: nowIso(),
      };
      this.db.prepare(
        `
          INSERT INTO lms_user_preferences
          (userId, subjectWeights, typeWeights, difficultyPref, topicWeights, explorationRate, lastUpdated)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        created.userId,
        created.subjectWeights,
        created.typeWeights,
        created.difficultyPref,
        created.topicWeights,
        created.explorationRate,
        created.lastUpdated
      );
      row = created;
    }
    return row;
  },

  updateUserPreferences(userId, patch) {
    const current = this.getUserPreferences(userId);
    const nextSubjectWeights = ensureObject(parseJson(current.subjectWeights, {}));
    const nextTypeWeights = ensureObject(parseJson(current.typeWeights, {}));
    const nextTopicWeights = ensureObject(parseJson(current.topicWeights, {}));

    if (patch.subjectCode) {
      nextSubjectWeights[patch.subjectCode] = clamp(Number(nextSubjectWeights[patch.subjectCode] || 0.5), 0, 1);
    }
    if (patch.type) {
      nextTypeWeights[patch.type] = clamp(Number(nextTypeWeights[patch.type] || 0.5), 0, 1);
    }
    if (patch.subjectWeights && typeof patch.subjectWeights === "object" && !Array.isArray(patch.subjectWeights)) {
      Object.assign(nextSubjectWeights, patch.subjectWeights);
    }
    if (patch.typeWeights && typeof patch.typeWeights === "object" && !Array.isArray(patch.typeWeights)) {
      Object.assign(nextTypeWeights, patch.typeWeights);
    }
    if (patch.topicWeights && typeof patch.topicWeights === "object" && !Array.isArray(patch.topicWeights)) {
      Object.assign(nextTopicWeights, patch.topicWeights);
    }

    const explorationRate = patch.explorationRate !== undefined
      ? clamp(Number(patch.explorationRate || 0.2), 0, 1)
      : Number(current.explorationRate || 0.2);

    this.db.prepare(
      `
        UPDATE lms_user_preferences
        SET subjectWeights = ?, typeWeights = ?, topicWeights = ?, difficultyPref = ?, explorationRate = ?, lastUpdated = ?
        WHERE userId = ?
      `
    ).run(
      stringifyJson(nextSubjectWeights, "{}"),
      stringifyJson(nextTypeWeights, "{}"),
      stringifyJson(nextTopicWeights, "{}"),
      toSafeString(patch.difficultyPref || current.difficultyPref || "any") || "any",
      explorationRate,
      nowIso(),
      userId
    );
    return this.getUserPreferences(userId);
  },

  getTopicMasteryMap(userId) {
    const rows = this.db.prepare("SELECT topicId, mastery FROM lms_topic_mastery WHERE userId = ?").all(userId);
    return Object.fromEntries(rows.map((row) => [row.topicId, Number(row.mastery || 0)]));
  },

  getTopicsForResource(resourceId) {
    return this.db
      .prepare(
        `
          SELECT t.id, t.label, t.subjectCode, t.description, t.crossSubjectLinks
          FROM lms_resource_topics rt
          JOIN lms_topics t ON t.id = rt.topicId
          WHERE rt.resourceId = ?
          ORDER BY t.label ASC
        `
      )
      .all(resourceId)
      .map((row) => ({
        ...row,
        crossSubjectLinks: parseJson(row.crossSubjectLinks, []),
      }));
  },

  ensureTopicsForTags({ resourceId, subjectCode, tags }) {
    const normalizedTags = normalizeTagList(tags);
    this.db.prepare("DELETE FROM lms_resource_topics WHERE resourceId = ?").run(resourceId);
    for (const tag of normalizedTags) {
      let topic = this.db.prepare("SELECT * FROM lms_topics WHERE label = ?").get(tag);
      if (!topic) {
        const id = randomId("topic");
        this.db.prepare(
          `
            INSERT INTO lms_topics (id, label, subjectCode, description, crossSubjectLinks)
            VALUES (?, ?, ?, '', '[]')
          `
        ).run(id, tag, subjectCode);
        topic = { id, label: tag, subjectCode };
      }
      this.db.prepare(
        "INSERT OR IGNORE INTO lms_resource_topics (resourceId, topicId) VALUES (?, ?)"
      ).run(resourceId, topic.id);
    }
  }
};

// --- class ---
class LmsStore {
  constructor({ dbPath, filesDir, moderationService, revisionScheduler }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });
    this.filesDir = filesDir;
    this.moderationService = moderationService;
    this.revisionScheduler = revisionScheduler;
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    runLmsMigrations(this.db);
  }

  withTransaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  mapResource(row) {
    if (!row) return null;
    const moderation = this.buildModerationSummary(row);
    return {
      ...row,
      tags: parseJson(row.tags, []),
      structuredContent: parseJson(row.structuredContent, null),
      topics: this.getTopicsForResource(row.id),
      publisher: this.getPublisherSummary(row.uploadedBy),
      moderation,
    };
  }

  mapGuide(row, includeSections = false, userId = "") {
    if (!row) return null;
    const guide = {
      ...row,
      tags: parseJson(row.tags, []),
      sections: includeSections ? this.listGuideSections(row.id) : [],
      userProgress: userId ? this.getGuideProgressRow(userId, row.id) : null,
      userUpvoted: userId ? this.hasEntityUpvote("guide", row.id, userId) : false,
    };
    return guide;
  }

  mapRoadmap(row, includeNodes = false, userId = "") {
    if (!row) return null;
    return {
      ...row,
      nodes: includeNodes ? this.listRoadmapNodes(row.id) : [],
      edges: includeNodes ? this.listRoadmapEdges(row.id) : [],
      userProgress: userId ? this.getRoadmapProgressRow(userId, row.id) : null,
    };
  }

}

Object.assign(
  LmsStore.prototype,
  collectionsMethods,
  communityMethods,
  featureFlagMethods,
  guideMethods,
  learningDiscoveryMethods,
  learningProgressMethods,
  resourceInputMethods,
  resourceSearchMethods,
  resourceMethods,
  moderationMethods,
  questionBankMethods,
  roadmapMethods,
  userStateMethods
);

module.exports = {
  LmsStore,
};
