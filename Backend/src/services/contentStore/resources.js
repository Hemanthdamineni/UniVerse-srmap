const { randomUUID } = require("crypto");
const { RESOURCE_KINDS } = require("./constants");
const {
  nowIso,
  toSafeString,
  toNullableInteger,
  detectResourceKind,
} = require("./utils");

const resourceMethods = {
  listResources(contentId) {
    const targetId = toSafeString(contentId);
    if (!targetId) return [];

    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            content_id AS contentId,
            kind,
            title,
            url_or_path AS urlOrPath,
            mime_type AS mimeType,
            size_bytes AS sizeBytes,
            created_at AS createdAt
          FROM resources
          WHERE content_id = ?
          ORDER BY created_at DESC
        `
      )
      .all(targetId);

    return rows.map((row) => ({
      ...row,
      sizeBytes: row.sizeBytes === null || row.sizeBytes === undefined ? null : Number(row.sizeBytes),
    }));
  },

  addResource(contentId, payload) {
    const content = this.getContent(contentId);
    if (!content) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }

    const resource = this._normalizeResource(payload);
    this._insertResource(content.id, resource);
    return this.getResource(resource.id);
  },

  replaceResources(contentId, resources) {
    const content = this.getContent(contentId);
    if (!content) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }

    const normalized = (Array.isArray(resources) ? resources : []).map((resource) =>
      this._normalizeResource(resource)
    );

    this.db.prepare("DELETE FROM resources WHERE content_id = ?").run(content.id);
    for (const resource of normalized) {
      this._insertResource(content.id, resource);
    }
    return this.listResources(content.id);
  },

  getResource(resourceId) {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            content_id AS contentId,
            kind,
            title,
            url_or_path AS urlOrPath,
            mime_type AS mimeType,
            size_bytes AS sizeBytes,
            created_at AS createdAt
          FROM resources
          WHERE id = ?
        `
      )
      .get(toSafeString(resourceId));

    if (!row) return null;
    return {
      ...row,
      sizeBytes: row.sizeBytes === null || row.sizeBytes === undefined ? null : Number(row.sizeBytes),
    };
  },

  _normalizeResource(resource) {
    const url = toSafeString(resource?.url_or_path || resource?.url);
    if (!url) {
      const error = new Error("url_or_path is required for resource");
      error.status = 400;
      throw error;
    }

    const title = toSafeString(resource?.title) || "Resource";
    const normalized = {
      id: randomUUID(),
      kind: detectResourceKind(resource),
      title,
      url_or_path: url,
      mime_type: toSafeString(resource?.mime_type || resource?.mimeType) || null,
      size_bytes: toNullableInteger(resource?.size_bytes || resource?.sizeBytes),
      created_at: nowIso(),
    };

    if (!RESOURCE_KINDS.has(normalized.kind)) {
      const error = new Error("Invalid resource kind. Use pdf, ppt, image, video, link, or doc.");
      error.status = 400;
      throw error;
    }

    return normalized;
  },

  _insertResource(contentId, resource) {
    this.db
      .prepare(
        `
          INSERT INTO resources (
            id, content_id, kind, title, url_or_path, mime_type, size_bytes, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        resource.id,
        contentId,
        resource.kind,
        resource.title,
        resource.url_or_path,
        resource.mime_type,
        resource.size_bytes,
        resource.created_at
      );
  },
};

module.exports = { resourceMethods };
