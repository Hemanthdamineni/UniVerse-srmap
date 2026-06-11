const { randomUUID } = require("crypto");
const {
  nowIso,
  toSafeString,
  toNullableIsoDate,
  parseMetadataJson,
  normalizeContentType,
  normalizeLifecycleState,
  normalizeActor,
  normalizeMetadata,
} = require("./utils");

const contentRecordMethods = {
  listContent({ type, category, lifecycleState, includeAllStates = false, includeDeleted = false, page = 1, limit = 100 } = {}) {
    const params = [];
    const where = [];

    if (type !== undefined && type !== null && String(type).trim() !== "") {
      where.push("type = ?");
      params.push(normalizeContentType(type));
    }

    if (category !== undefined && category !== null && String(category).trim() !== "") {
      where.push("category = ?");
      params.push(toSafeString(category));
    }

    if (lifecycleState !== undefined && lifecycleState !== null && String(lifecycleState).trim() !== "") {
      where.push("lifecycle_state = ?");
      params.push(normalizeLifecycleState(lifecycleState));
    } else if (!includeAllStates) {
      where.push("lifecycle_state = 'published'");
    } else if (!includeDeleted) {
      where.push("lifecycle_state != 'deleted'");
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const lim = Math.max(1, Math.min(500, Number.parseInt(String(limit || ""), 10) || 100));
    const pg = Math.max(1, Number.parseInt(String(page || ""), 10) || 1);
    const rows = this.db
      .prepare(
        `
          SELECT
            c.id,
            c.type,
            c.title,
            c.description,
            c.category,
            c.start_date AS startDate,
            c.end_date AS endDate,
            c.location,
            c.metadata_json AS metadataJson,
            c.lifecycle_state AS lifecycleState,
            c.version,
            c.deleted_at AS deletedAt,
            c.last_actor AS lastActor,
            c.created_at AS createdAt,
            c.updated_at AS updatedAt,
            COUNT(r.id) AS resourceCount
          FROM content c
          LEFT JOIN resources r ON r.content_id = c.id
          ${whereClause}
          GROUP BY c.id
          ORDER BY c.updated_at DESC, c.created_at DESC
          LIMIT ? OFFSET ?
        `
      )
      .all(...params, lim, (pg - 1) * lim);

    return rows.map((row) => {
      const { metadataJson, ...rest } = row;
      return {
        ...rest,
        metadata: parseMetadataJson(metadataJson),
        version: Number(row.version || 1),
        resourceCount: Number(row.resourceCount || 0),
      };
    });
  },

  getContent(id, { includeDeleted = false } = {}) {
    const contentId = toSafeString(id);
    if (!contentId) return null;
    const whereDeleted = includeDeleted ? "" : "AND lifecycle_state != 'deleted'";
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            type,
            title,
            description,
            category,
            start_date AS startDate,
            end_date AS endDate,
            location,
            metadata_json AS metadataJson,
            lifecycle_state AS lifecycleState,
            version,
            deleted_at AS deletedAt,
            last_actor AS lastActor,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM content
          WHERE id = ? ${whereDeleted}
        `
      )
      .get(contentId);

    if (!row) return null;
    const { metadataJson, ...rest } = row;
    return {
      ...rest,
      metadata: parseMetadataJson(metadataJson),
      version: Number(row.version || 1),
    };
  },

  createContent(payload, options = {}) {
    const createdAt = nowIso();
    const type = normalizeContentType(payload?.type);
    const lifecycleState = normalizeLifecycleState(
      payload?.lifecycleState || payload?.lifecycle_state || (payload?.category === "resource-recommendation" ? "review" : "published")
    );
    const actor = normalizeActor(options.actor);
    const content = {
      id: randomUUID(),
      type,
      title: toSafeString(payload?.title),
      description: toSafeString(payload?.description),
      category: toSafeString(payload?.category),
      startDate: toNullableIsoDate(payload?.startDate, "startDate"),
      endDate: toNullableIsoDate(payload?.endDate, "endDate"),
      location: toSafeString(payload?.location),
      metadata: normalizeMetadata(type, payload?.metadata),
      lifecycleState,
      version: 1,
      deletedAt: null,
      lastActor: actor.actorId,
      createdAt,
      updatedAt: createdAt,
    };

    if (!content.title) {
      const error = new Error("title is required");
      error.status = 400;
      throw error;
    }

    this.db
      .prepare(
        `
          INSERT INTO content (
            id, type, title, description, category, start_date, end_date, location, metadata_json,
            lifecycle_state, version, deleted_at, last_actor, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        content.id,
        content.type,
        content.title,
        content.description,
        content.category,
        content.startDate,
        content.endDate,
        content.location || null,
        content.metadata ? JSON.stringify(content.metadata) : null,
        content.lifecycleState,
        content.version,
        content.deletedAt,
        content.lastActor,
        content.createdAt,
        content.updatedAt
      );

    if (Array.isArray(payload?.resources) && payload.resources.length > 0) {
      this.replaceResources(content.id, payload.resources);
    }

    const created = this.getContent(content.id, { includeDeleted: true });
    this._recordAudit({
      contentId: content.id,
      action: options.action || "create",
      actor,
      reason: options.reason || "Content created",
      before: null,
      after: created,
    });
    return created;
  },

  updateContent(id, payload, options = {}) {
    const existing = this.getContent(id, { includeDeleted: true });
    if (!existing) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }

    const nextType = payload?.type !== undefined ? normalizeContentType(payload.type) : existing.type;
    const actor = normalizeActor(options.actor);
    const next = {
      ...existing,
      type: nextType,
      title: payload?.title !== undefined ? toSafeString(payload.title) : existing.title,
      description:
        payload?.description !== undefined ? toSafeString(payload.description) : (existing.description || ""),
      category: payload?.category !== undefined ? toSafeString(payload.category) : (existing.category || ""),
      startDate:
        payload?.startDate !== undefined ? toNullableIsoDate(payload.startDate, "startDate") : existing.startDate,
      endDate: payload?.endDate !== undefined ? toNullableIsoDate(payload.endDate, "endDate") : existing.endDate,
      location: payload?.location !== undefined ? toSafeString(payload.location) : (existing.location || ""),
      metadata:
        payload && Object.prototype.hasOwnProperty.call(payload, "metadata")
          ? normalizeMetadata(nextType, payload.metadata)
          : (existing.metadata || null),
      lifecycleState:
        payload?.lifecycleState !== undefined
          ? normalizeLifecycleState(payload.lifecycleState)
          : existing.lifecycleState,
      version: Number(existing.version || 1) + 1,
      deletedAt: existing.deletedAt || null,
      lastActor: actor.actorId,
      updatedAt: nowIso(),
    };

    if (!next.title) {
      const error = new Error("title is required");
      error.status = 400;
      throw error;
    }

    this.db
      .prepare(
        `
          UPDATE content
          SET type = ?, title = ?, description = ?, category = ?, start_date = ?, end_date = ?,
              location = ?, metadata_json = ?, lifecycle_state = ?, version = ?,
              deleted_at = ?, last_actor = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        next.type,
        next.title,
        next.description,
        next.category,
        next.startDate,
        next.endDate,
        next.location || null,
        next.metadata ? JSON.stringify(next.metadata) : null,
        next.lifecycleState,
        next.version,
        next.deletedAt,
        next.lastActor,
        next.updatedAt,
        existing.id
      );

    if (payload && Object.prototype.hasOwnProperty.call(payload, "resources")) {
      this.replaceResources(existing.id, Array.isArray(payload.resources) ? payload.resources : []);
    }

    const updated = this.getContent(existing.id, { includeDeleted: true });
    this._recordAudit({
      contentId: existing.id,
      action: options.action || "edit",
      actor,
      reason: options.reason || "Content updated",
      before: existing,
      after: updated,
    });
    return updated;
  },

  upsertContent(payload) {
    const id = toSafeString(payload?.id);
    if (!id) {
      const error = new Error("id is required for upsert");
      error.status = 400;
      throw error;
    }

    const existing = this.getContent(id);
    if (existing) {
      return this.updateContent(id, payload);
    }

    const createdAt = nowIso();
    const type = normalizeContentType(payload?.type);
    const lifecycleState = normalizeLifecycleState(payload?.lifecycleState || payload?.lifecycle_state || "published");
    const content = {
      id,
      type,
      title: toSafeString(payload?.title),
      description: toSafeString(payload?.description),
      category: toSafeString(payload?.category),
      startDate: toNullableIsoDate(payload?.startDate, "startDate"),
      endDate: toNullableIsoDate(payload?.endDate, "endDate"),
      location: toSafeString(payload?.location),
      metadata: normalizeMetadata(type, payload?.metadata),
      lifecycleState,
      version: 1,
      deletedAt: null,
      lastActor: "system",
      createdAt,
      updatedAt: createdAt,
    };

    if (!content.title) {
      const error = new Error("title is required");
      error.status = 400;
      throw error;
    }

    this.db
      .prepare(
        `
          INSERT INTO content (
            id, type, title, description, category, start_date, end_date, location, metadata_json,
            lifecycle_state, version, deleted_at, last_actor, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        content.id,
        content.type,
        content.title,
        content.description,
        content.category,
        content.startDate,
        content.endDate,
        content.location || null,
        content.metadata ? JSON.stringify(content.metadata) : null,
        content.lifecycleState,
        content.version,
        content.deletedAt,
        content.lastActor,
        content.createdAt,
        content.updatedAt
      );

    if (Array.isArray(payload?.resources)) {
      this.replaceResources(content.id, payload.resources);
    }

    const created = this.getContent(content.id, { includeDeleted: true });
    this._recordAudit({
      contentId: content.id,
      action: "upsert_create",
      actor: { actorId: "system", actorRole: "system" },
      reason: "Content seeded or upserted",
      before: null,
      after: created,
    });
    return created;
  },

  ping() {
    try {
      const row = this.db.prepare("SELECT 1 AS ok").get();
      return Number(row?.ok || 0) === 1;
    } catch {
      return false;
    }
  },
};

module.exports = { contentRecordMethods };
