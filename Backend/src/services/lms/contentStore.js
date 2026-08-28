const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("crypto");

// --- utils.js (utility) ---

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNullableInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function toNullableIsoDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${fieldName}`);
    error.status = 400;
    throw error;
  }
  return date.toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 3 || value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeMetadataValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return undefined;

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const sanitized = sanitizeMetadataValue(entry, depth + 1);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result;
}

function parseMetadataJson(value) {
  const raw = toSafeString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeContentType(value) {
  const type = toSafeString(value);
  if (!CONTENT_TYPES.has(type)) {
    const error = new Error("Invalid type. Use event, learning_material, announcement, or page.");
    error.status = 400;
    throw error;
  }
  return type;
}

function normalizeLifecycleState(value, fallback = "published") {
  const state = toSafeString(value || fallback).toLowerCase();
  if (!CONTENT_LIFECYCLE_STATES.has(state)) {
    const error = new Error("Invalid lifecycle state.");
    error.status = 400;
    throw error;
  }
  return state;
}

function normalizeActor(actor = {}) {
  if (typeof actor === "string") {
    return { actorId: toSafeString(actor) || "admin", actorRole: "admin" };
  }
  return {
    actorId: toSafeString(actor.actorId || actor.userId || actor.registerNo) || "admin",
    actorRole: toSafeString(actor.actorRole || actor.role) || "admin",
  };
}

function stableJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value ?? null);
}

function calculateDiff(before, after) {
  const previous = before || {};
  const next = after || {};
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));
  const changes = {};
  for (const key of keys) {
    if (JSON.stringify(previous[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
      changes[key] = {
        before: previous[key] ?? null,
        after: next[key] ?? null,
      };
    }
  }
  return changes;
}

function normalizeMetadata(type, metadata) {
  if (metadata === undefined) return undefined;
  if (metadata === null || metadata === "") return null;
  if (!isPlainObject(metadata)) {
    const error = new Error("metadata must be an object when provided");
    error.status = 400;
    throw error;
  }

  const sanitized = sanitizeMetadataValue(metadata);
  const normalized = isPlainObject(sanitized) ? { ...sanitized } : {};

  if (normalized.year !== undefined) {
    normalized.year = toNullableInteger(normalized.year);
  }
  if (normalized.semester !== undefined) {
    normalized.semester = toNullableInteger(normalized.semester);
  }
  if (normalized.courseCode !== undefined) {
    normalized.courseCode = toSafeString(normalized.courseCode).toUpperCase();
  }
  if (normalized.courseName !== undefined) {
    normalized.courseName = toSafeString(normalized.courseName);
  }
  if (normalized.subjectCode !== undefined) {
    normalized.subjectCode = toSafeString(normalized.subjectCode).toUpperCase();
  }
  if (normalized.subjectName !== undefined) {
    normalized.subjectName = toSafeString(normalized.subjectName);
  }
  if (normalized.resourceGroup !== undefined) {
    normalized.resourceGroup = toSafeString(normalized.resourceGroup).toLowerCase();
  }
  if (normalized.tags !== undefined) {
    normalized.tags = Array.isArray(normalized.tags)
      ? normalized.tags.map((entry) => toSafeString(entry)).filter(Boolean)
      : [];
  }

  if (
    type === "learning_material" &&
    normalized.resourceGroup &&
    !LEARNING_MATERIAL_GROUPS.has(normalized.resourceGroup)
  ) {
    const error = new Error(
      "metadata.resourceGroup must be one of pyq-mid, pyq-sem, slides, notes, links, videos, or roadmaps."
    );
    error.status = 400;
    throw error;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function detectResourceKind(resource) {
  const explicitKind = toSafeString(resource.kind).toLowerCase();
  if (RESOURCE_KINDS.has(explicitKind)) return explicitKind;

  const mime = toSafeString(resource.mime_type || resource.mimeType).toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("powerpoint") || mime.includes("presentation")) return "ppt";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("msword") || mime.includes("officedocument.wordprocessingml")) return "doc";

  const url = toSafeString(resource.url_or_path || resource.url).toLowerCase();
  if (url.endsWith(".pdf")) return "pdf";
  if (url.endsWith(".ppt") || url.endsWith(".pptx")) return "ppt";
  if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(url)) return "image";
  if (/\.(mp4|mov|webm|mkv)(\?|$)/.test(url)) return "video";
  if (/\.(doc|docx|rtf)(\?|$)/.test(url)) return "doc";
  return "link";
}

function looksLikeAbsoluteUrl(value) {
  return /^(https?:)?\/\//i.test(toSafeString(value));
}

function inferTypeFromPageKey(pageKey) {
  const key = toSafeString(pageKey).toLowerCase();
  if (key.startsWith("events/")) return "event";
  if (key.startsWith("resources/")) return "learning_material";
  if (key.includes("announcement") || key.includes("notification")) return "announcement";
  return "page";
}

function toPageTitle(pageKey) {
  return toSafeString(pageKey)
    .split("/")
    .join(" / ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

// --- constants.js (utility) ---
const CONTENT_TYPES = new Set(["event", "learning_material", "announcement", "page"]);
const RESOURCE_KINDS = new Set(["pdf", "ppt", "image", "video", "link", "doc"]);
const LEARNING_MATERIAL_GROUPS = new Set(["pyq-mid", "pyq-sem", "slides", "notes", "links", "videos", "roadmaps"]);
const CONTENT_LIFECYCLE_STATES = new Set(["draft", "review", "published", "unpublished", "archived", "deleted"]);
const CONTENT_TRANSITIONS = {
  submit_review: { from: ["draft", "unpublished"], to: "review", label: "Submit for review" },
  publish: { from: ["draft", "review", "unpublished", "archived"], to: "published", label: "Publish" },
  unpublish: { from: ["published", "review"], to: "unpublished", label: "Unpublish" },
  archive: { from: ["published", "unpublished", "review", "draft"], to: "archived", label: "Archive" },
  delete: { from: ["draft", "review", "published", "unpublished", "archived"], to: "deleted", label: "Delete" },
  restore: { from: ["deleted", "archived"], to: "published", label: "Restore" },
};
const LEARNING_MATERIAL_GROUP_LABELS = {
  "pyq-mid": "PYQ Mid",
  "pyq-sem": "PYQ Semester",
  slides: "Slides",
  notes: "Notes",
  links: "Links",
  videos: "Videos",
  roadmaps: "Roadmaps",
};

// --- schema.js ---
const schemaMethods = {
  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        location TEXT,
        metadata_json TEXT,
        lifecycle_state TEXT DEFAULT 'published',
        version INTEGER DEFAULT 1,
        deleted_at TEXT,
        last_actor TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url_or_path TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_audit (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT DEFAULT 'admin',
        reason TEXT DEFAULT '',
        before_json TEXT,
        after_json TEXT,
        diff_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
      )
    `);

    const contentColumns = this.db.prepare("PRAGMA table_info(content)").all();
    const columnNames = new Set(contentColumns.map((column) => String(column?.name || "")));
    const addColumn = (name, ddl) => {
      if (!columnNames.has(name)) this.db.exec(`ALTER TABLE content ADD COLUMN ${ddl}`);
    };
    addColumn("metadata_json", "metadata_json TEXT");
    addColumn("lifecycle_state", "lifecycle_state TEXT DEFAULT 'published'");
    addColumn("version", "version INTEGER DEFAULT 1");
    addColumn("deleted_at", "deleted_at TEXT");
    addColumn("last_actor", "last_actor TEXT");
    this.db.exec("UPDATE content SET lifecycle_state = 'published' WHERE lifecycle_state IS NULL OR lifecycle_state = ''");
    this.db.exec("UPDATE content SET version = 1 WHERE version IS NULL OR version < 1");

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
      CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
      CREATE INDEX IF NOT EXISTS idx_content_state ON content(lifecycle_state);
      CREATE INDEX IF NOT EXISTS idx_content_audit_content_time ON content_audit(content_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resources_content_id ON resources(content_id);
    `);
  },
};

// --- contentRecords.js ---

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

// --- auditLifecycle.js ---

const auditLifecycleMethods = {
  _recordAudit({ contentId, action, actor, reason = "", before = null, after = null }) {
    const auditId = randomUUID();
    const normalizedActor = normalizeActor(actor);
    this.db
      .prepare(
        `
          INSERT INTO content_audit (
            id, content_id, action, actor_id, actor_role, reason,
            before_json, after_json, diff_json, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        auditId,
        contentId,
        toSafeString(action),
        normalizedActor.actorId,
        normalizedActor.actorRole,
        toSafeString(reason),
        stableJson(before),
        stableJson(after),
        stableJson(calculateDiff(before, after)),
        nowIso()
      );
    return auditId;
  },

  listContentHistory(id, { limit = 25 } = {}) {
    const contentId = toSafeString(id);
    if (!contentId) return [];
    const lim = Math.max(1, Math.min(100, Number.parseInt(String(limit || ""), 10) || 25));
    return this.db
      .prepare(
        `
          SELECT id, content_id AS contentId, action, actor_id AS actorId, actor_role AS actorRole,
                 reason, before_json AS beforeJson, after_json AS afterJson, diff_json AS diffJson, created_at AS createdAt
          FROM content_audit
          WHERE content_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `
      )
      .all(contentId, lim)
      .map((row) => ({
        id: row.id,
        contentId: row.contentId,
        action: row.action,
        actorId: row.actorId,
        actorRole: row.actorRole,
        reason: row.reason || "",
        before: parseMetadataJson(row.beforeJson) || JSON.parse(row.beforeJson || "null"),
        after: parseMetadataJson(row.afterJson) || JSON.parse(row.afterJson || "null"),
        diff: parseMetadataJson(row.diffJson) || JSON.parse(row.diffJson || "{}"),
        createdAt: row.createdAt,
      }));
  },

  getWorkflowSpec() {
    return {
      states: Array.from(CONTENT_LIFECYCLE_STATES),
      transitions: Object.entries(CONTENT_TRANSITIONS).map(([action, config]) => ({
        action,
        label: config.label,
        from: config.from,
        to: config.to,
        requiresReason: ["archive", "delete", "restore", "unpublish"].includes(action),
      })),
      permissions: {
        admin: ["create", "edit", ...Object.keys(CONTENT_TRANSITIONS), "bulk_preview", "bulk_execute", "history"],
        student: ["recommend_resource"],
      },
      bulkSafety: {
        previewRequired: true,
        maxItems: 200,
        rollback: "Bulk execution runs in one SQLite transaction after preview validation.",
      },
    };
  },

  _resolveRestoreState(contentId) {
    const lastDelete = this.listContentHistory(contentId, { limit: 20 }).find((entry) =>
      ["delete", "archive"].includes(entry.action)
    );
    const previousState = toSafeString(lastDelete?.before?.lifecycleState);
    return CONTENT_LIFECYCLE_STATES.has(previousState) && !["deleted", "archived"].includes(previousState)
      ? previousState
      : "published";
  },

  _previewTransition(content, action) {
    const transition = CONTENT_TRANSITIONS[action];
    if (!transition) {
      return { valid: false, reason: "Unsupported lifecycle action." };
    }
    if (!transition.from.includes(content.lifecycleState)) {
      return {
        valid: false,
        reason: `${action} is not allowed from ${content.lifecycleState}.`,
      };
    }
    return {
      valid: true,
      from: content.lifecycleState,
      to: action === "restore" ? this._resolveRestoreState(content.id) : transition.to,
      reason: "",
    };
  },

  previewBulkLifecycle({ ids = [], action } = {}) {
    const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(toSafeString).filter(Boolean)));
    if (!normalizedIds.length) {
      const error = new Error("At least one content id is required.");
      error.status = 400;
      throw error;
    }
    if (normalizedIds.length > 200) {
      const error = new Error("Bulk operations are limited to 200 items.");
      error.status = 400;
      throw error;
    }

    const items = normalizedIds.map((id) => {
      const content = this.getContent(id, { includeDeleted: true });
      if (!content) {
        return { id, valid: false, reason: "Content not found." };
      }
      const preview = this._previewTransition(content, toSafeString(action));
      return {
        id,
        title: content.title,
        type: content.type,
        currentState: content.lifecycleState,
        nextState: preview.to || content.lifecycleState,
        valid: preview.valid,
        reason: preview.reason,
      };
    });

    return {
      action: toSafeString(action),
      valid: items.every((item) => item.valid),
      items,
      invalidCount: items.filter((item) => !item.valid).length,
    };
  },

  transitionContent(id, { action, reason = "" } = {}, actor = {}) {
    const contentId = toSafeString(id);
    const existing = this.getContent(contentId, { includeDeleted: true });
    if (!existing) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }
    const normalizedAction = toSafeString(action).toLowerCase();
    const preview = this._previewTransition(existing, normalizedAction);
    if (!preview.valid) {
      const error = new Error(preview.reason || "Invalid lifecycle transition.");
      error.status = 400;
      throw error;
    }
    const normalizedActor = normalizeActor(actor);
    const nextState = preview.to;
    const now = nowIso();
    this.db
      .prepare(
        `
          UPDATE content
          SET lifecycle_state = ?, deleted_at = ?, version = ?, last_actor = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        nextState,
        nextState === "deleted" ? now : null,
        Number(existing.version || 1) + 1,
        normalizedActor.actorId,
        now,
        existing.id
      );
    const updated = this.getContent(existing.id, { includeDeleted: true });
    const auditId = this._recordAudit({
      contentId: existing.id,
      action: normalizedAction,
      actor: normalizedActor,
      reason: reason || `${CONTENT_TRANSITIONS[normalizedAction].label} content`,
      before: existing,
      after: updated,
    });
    return {
      ...updated,
      auditId,
    };
  },

  bulkTransitionContent({ ids = [], action, reason = "" } = {}, actor = {}) {
    const preview = this.previewBulkLifecycle({ ids, action });
    if (!preview.valid) {
      const error = new Error("Bulk preview has invalid items. Fix the selection before executing.");
      error.status = 400;
      error.preview = preview;
      throw error;
    }

    const results = [];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of preview.items) {
        results.push(this.transitionContent(item.id, { action, reason }, actor));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return {
      action: toSafeString(action),
      updated: results.length,
      items: results,
    };
  },

  deleteContent(id, actor = {}) {
    const updated = this.transitionContent(id, { action: "delete", reason: "Soft delete requested" }, actor);
    return { deleted: true, id: updated.id, lifecycleState: updated.lifecycleState, auditId: updated.auditId };
  },

  deleteContentIfExists(id) {
    const contentId = toSafeString(id);
    if (!contentId) return false;
    const result = this.db.prepare("DELETE FROM content WHERE id = ?").run(contentId);
    return Number(result.changes || 0) > 0;
  },
};

// --- resources.js ---

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

// --- learningMaterials.js ---
const learningMaterialMethods = {
  getLearningMaterialCatalog({ year } = {}) {
    const normalizedYear = toNullableInteger(year);
    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const visibility = toSafeString(item.metadata?.visibility).toLowerCase();
      return visibility !== "hidden";
    });
    const years = Array.from(
      new Set(
        items
          .map((item) => Number(item.metadata?.year || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    ).sort((left, right) => left - right);

    const filtered = items.filter((item) => {
      if (!item.metadata || !item.metadata.courseCode || !item.metadata.subjectCode) return false;
      if (normalizedYear !== null && Number(item.metadata.year || 0) !== normalizedYear) return false;
      return true;
    });

    const buckets = filtered.reduce((acc, item) => {
      const metadata = item.metadata || {};
      const key = `${metadata.year || ""}::${metadata.courseCode}`;
      if (!acc.has(key)) {
        acc.set(key, {
          year: Number(metadata.year || 0) || null,
          courseCode: metadata.courseCode,
          courseName: metadata.courseName || metadata.courseCode,
          subjectCodes: new Set(),
          resourceCount: 0,
        });
      }

      const bucket = acc.get(key);
      bucket.subjectCodes.add(metadata.subjectCode);
      bucket.resourceCount += Number(item.resourceCount || 0);
      return acc;
    }, new Map());

    const courses = Array.from(buckets.values())
      .map((bucket) => ({
        year: bucket.year,
        courseCode: bucket.courseCode,
        courseName: bucket.courseName,
        subjectCount: bucket.subjectCodes.size,
        resourceCount: bucket.resourceCount,
      }))
      .sort((left, right) =>
        String(left.courseName || left.courseCode).localeCompare(String(right.courseName || right.courseCode))
      );

    return {
      years,
      selectedYear: normalizedYear,
      courses,
    };
  },

  getLearningMaterialSubjects({ year, courseCode } = {}) {
    const normalizedYear = toNullableInteger(year);
    const normalizedCourseCode = toSafeString(courseCode).toUpperCase();

    if (normalizedYear === null || !normalizedCourseCode) {
      const error = new Error("year and courseCode are required");
      error.status = 400;
      throw error;
    }

    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const metadata = item.metadata || {};
      const visibility = toSafeString(metadata.visibility).toLowerCase();
      if (visibility === "hidden") return false;
      return Number(metadata.year || 0) === normalizedYear && metadata.courseCode === normalizedCourseCode;
    });

    const buckets = items.reduce((acc, item) => {
      const metadata = item.metadata || {};
      if (!metadata.subjectCode) return acc;
      if (!acc.has(metadata.subjectCode)) {
        acc.set(metadata.subjectCode, {
          subjectCode: metadata.subjectCode,
          subjectName: metadata.subjectName || metadata.subjectCode,
          semester: metadata.semester || null,
          groups: new Set(),
          resourceCount: 0,
        });
      }

      const bucket = acc.get(metadata.subjectCode);
      if (metadata.resourceGroup) bucket.groups.add(metadata.resourceGroup);
      bucket.resourceCount += Number(item.resourceCount || 0);
      return acc;
    }, new Map());

    const subjects = Array.from(buckets.values())
      .map((bucket) => ({
        subjectCode: bucket.subjectCode,
        subjectName: bucket.subjectName,
        semester: bucket.semester,
        groups: Array.from(bucket.groups).sort(),
        resourceCount: bucket.resourceCount,
      }))
      .sort((left, right) => String(left.subjectName).localeCompare(String(right.subjectName)));

    return {
      year: normalizedYear,
      courseCode: normalizedCourseCode,
      subjects,
    };
  },

  getLearningMaterialLibrary({ year, courseCode, subjectCode, query } = {}) {
    const normalizedYear = toNullableInteger(year);
    const normalizedCourseCode = toSafeString(courseCode).toUpperCase();
    const normalizedSubjectCode = toSafeString(subjectCode).toUpperCase();
    const normalizedQuery = toSafeString(query).toLowerCase();

    if (normalizedYear === null || !normalizedCourseCode || !normalizedSubjectCode) {
      const error = new Error("year, courseCode, and subjectCode are required");
      error.status = 400;
      throw error;
    }

    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const metadata = item.metadata || {};
      const visibility = toSafeString(metadata.visibility).toLowerCase();
      if (visibility === "hidden") return false;
      if (Number(metadata.year || 0) !== normalizedYear) return false;
      if (metadata.courseCode !== normalizedCourseCode) return false;
      if (metadata.subjectCode !== normalizedSubjectCode) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        item.title,
        item.description,
        metadata.subjectName,
        metadata.courseName,
        ...(Array.isArray(metadata.tags) ? metadata.tags : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const buckets = items.reduce((acc, item) => {
      const metadata = item.metadata || {};
      const groupKey = metadata.resourceGroup || "links";
      if (!acc.has(groupKey)) {
        acc.set(groupKey, {
          group: groupKey,
          label: LEARNING_MATERIAL_GROUP_LABELS[groupKey] || groupKey,
          items: [],
        });
      }

      acc.get(groupKey).items.push({
        id: item.id,
        title: item.title,
        description: item.description || "",
        metadata,
        resources: this.listResources(item.id),
      });
      return acc;
    }, new Map());

    const groups = Array.from(buckets.values()).sort((left, right) => left.label.localeCompare(right.label));
    const firstItem = items[0] || null;

    return {
      subject: firstItem
        ? {
            year: Number(firstItem.metadata?.year || 0) || normalizedYear,
            courseCode: firstItem.metadata?.courseCode || normalizedCourseCode,
            courseName: firstItem.metadata?.courseName || normalizedCourseCode,
            subjectCode: firstItem.metadata?.subjectCode || normalizedSubjectCode,
            subjectName: firstItem.metadata?.subjectName || normalizedSubjectCode,
            semester: firstItem.metadata?.semester || null,
          }
        : {
            year: normalizedYear,
            courseCode: normalizedCourseCode,
            courseName: normalizedCourseCode,
            subjectCode: normalizedSubjectCode,
            subjectName: normalizedSubjectCode,
            semester: null,
          },
      groups,
      totalItems: items.length,
      totalResources: groups.reduce(
        (sum, group) =>
          sum +
          group.items.reduce(
            (itemSum, item) => itemSum + (Array.isArray(item.resources) ? item.resources.length : 0),
            0
          ),
        0
      ),
    };
  },
};

// --- seeding.js ---

const seedingMethods = {
  seedExternalPages(seedData) {
    let inserted = 0;
    for (const [pageKey, payload] of Object.entries(seedData || {})) {
      const id = `external:${pageKey}`;
      if (this.getContent(id)) continue;

      const baseResources = [];

      if (Array.isArray(payload?.resources)) {
        for (const resource of payload.resources) {
          const url = toSafeString(resource?.url_or_path || resource?.url);
          if (!url) continue;
          baseResources.push({
            kind: detectResourceKind(resource),
            title: toSafeString(resource?.title) || "Resource",
            url_or_path: url,
            mime_type: toSafeString(resource?.mime_type || resource?.mimeType) || null,
            size_bytes: toNullableInteger(resource?.size_bytes || resource?.sizeBytes),
          });
        }
      }

      if (Array.isArray(payload?.items)) {
        for (const item of payload.items) {
          const value = toSafeString(item?.value);
          if (!looksLikeAbsoluteUrl(value)) continue;
          baseResources.push({
            kind: "link",
            title: toSafeString(item?.label) || "Reference Link",
            url_or_path: value,
            mime_type: null,
            size_bytes: null,
          });
        }
      }

      this.upsertContent({
        id,
        type: inferTypeFromPageKey(pageKey),
        title: toSafeString(payload?.title) || toPageTitle(pageKey),
        description: toSafeString(payload?.summary),
        category: pageKey,
        startDate: null,
        endDate: null,
        location: "",
        resources: baseResources,
      });
      inserted += 1;
    }
    return inserted;
  },

  seedEvents(events) {
    let inserted = 0;
    for (const event of Array.isArray(events) ? events : []) {
      const id = toSafeString(event?.id);
      if (!id || this.getContent(id)) continue;

      const resources = [];
      for (const attachment of Array.isArray(event?.attachments) ? event.attachments : []) {
        const url = toSafeString(attachment?.url || attachment?.url_or_path);
        if (!url) continue;
        resources.push({
          kind: detectResourceKind(attachment),
          title: toSafeString(attachment?.name || attachment?.title) || "Attachment",
          url_or_path: url,
          mime_type: toSafeString(attachment?.mime_type || attachment?.mimeType) || null,
          size_bytes: toNullableInteger(attachment?.size_bytes || attachment?.sizeBytes),
        });
      }

      const coverImageUrl = toSafeString(event?.coverImageUrl);
      if (coverImageUrl) {
        resources.push({
          kind: "image",
          title: "Cover Image",
          url_or_path: coverImageUrl,
          mime_type: null,
          size_bytes: null,
        });
      }

      this.upsertContent({
        id,
        type: "event",
        title: toSafeString(event?.title) || "Untitled Event",
        description: toSafeString(event?.description),
        category: toSafeString(event?.category),
        startDate: event?.startAt || null,
        endDate: event?.endAt || null,
        location: toSafeString(event?.location?.physical),
        resources,
      });
      inserted += 1;
    }
    return inserted;
  },
};

// --- class ---

class ContentStore {
  constructor(dbPath) {
    const dirPath = path.dirname(dbPath);
    fs.mkdirSync(dirPath, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.ensureSchema();
  }
}

Object.assign(
  ContentStore.prototype,
  schemaMethods,
  contentRecordMethods,
  auditLifecycleMethods,
  resourceMethods,
  learningMaterialMethods,
  seedingMethods
);

module.exports = {
  ContentStore,
  CONTENT_TYPES: Array.from(CONTENT_TYPES),
  RESOURCE_KINDS: Array.from(RESOURCE_KINDS),
  LEARNING_MATERIAL_GROUPS: Array.from(LEARNING_MATERIAL_GROUPS),
};
