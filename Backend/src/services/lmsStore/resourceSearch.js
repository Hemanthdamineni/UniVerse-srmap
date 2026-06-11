const {
  toSafeString,
  toInteger,
  normalizeUnit,
  normalizeTagList,
  clamp,
} = require("../lmsUtils");

module.exports = {
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
