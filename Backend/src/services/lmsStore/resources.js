const {
  nowIso,
  randomId,
  toSafeString,
  toInteger,
  ensureArray,
  parseJson,
  stringifyJson,
  normalizeTagList,
  assertCondition,
  clamp,
} = require("../lmsUtils");

module.exports = {
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
