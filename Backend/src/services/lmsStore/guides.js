const {
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  ensureArray,
  parseJson,
  stringifyJson,
  normalizeUnit,
  normalizeTagList,
  assertCondition,
  toBooleanInteger,
} = require("../lmsUtils");

module.exports = {
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
