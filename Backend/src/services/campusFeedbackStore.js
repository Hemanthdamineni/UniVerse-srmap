const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { log } = require("../utils/logger");

const FEEDBACK_TYPES = {
  EVENTS: "events",
  HOSTEL_MESS: "hostel_mess",
  TRANSPORT: "transport",
};

const MODERATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const TYPE_LABELS = {
  [FEEDBACK_TYPES.EVENTS]: "Events Feedback",
  [FEEDBACK_TYPES.HOSTEL_MESS]: "Hostel & Mess Feedback",
  [FEEDBACK_TYPES.TRANSPORT]: "Transport Feedback",
};

const FIXED_OPTIONS = {
  [FEEDBACK_TYPES.HOSTEL_MESS]: [
    { id: "hostel-mess-services", label: "Hostel and mess services", active: true },
  ],
};

const SPAM_WINDOW_MS = 10 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeType(type) {
  const normalized = toSafeString(type).toLowerCase().replace(/-/g, "_");
  if (Object.values(FEEDBACK_TYPES).includes(normalized)) return normalized;
  const error = new Error("Unsupported campus feedback type");
  error.status = 400;
  throw error;
}

function normalizeStatus(status) {
  const normalized = toSafeString(status).toLowerCase();
  if (Object.values(MODERATION_STATUS).includes(normalized)) return normalized;
  const error = new Error("Unsupported moderation status");
  error.status = 400;
  throw error;
}

function normalizePagination({ limit, offset } = {}) {
  const normalizedLimit = Number(limit);
  const normalizedOffset = Number(offset);
  return {
    limit:
      Number.isFinite(normalizedLimit) && normalizedLimit > 0
        ? Math.min(Math.floor(normalizedLimit), 100)
        : 50,
    offset:
      Number.isFinite(normalizedOffset) && normalizedOffset > 0
        ? Math.floor(normalizedOffset)
        : 0,
  };
}

function normalizeRatings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("ratings object is required");
    error.status = 400;
    throw error;
  }

  const ratings = {};
  for (const [key, rawRating] of Object.entries(value)) {
    const label = toSafeString(key);
    const rating = Number(rawRating);
    if (!label) continue;
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      const error = new Error("ratings must be numbers between 0 and 5");
      error.status = 400;
      throw error;
    }
    ratings[label] = Math.round(rating);
  }

  if (!Object.values(ratings).some((rating) => rating > 0)) {
    const error = new Error("At least one rating is required");
    error.status = 400;
    throw error;
  }

  return ratings;
}

function buildDedupeKey({ type, targetLabel, userId, ratings, comment }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type,
        targetLabel: toSafeString(targetLabel).toLowerCase(),
        userId: toSafeString(userId).toLowerCase(),
        ratings,
        comment: toSafeString(comment).toLowerCase(),
      })
    )
    .digest("hex");
}

class CampusFeedbackStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campus_feedback_options (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_by_user_id TEXT,
        created_by_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(type, label)
      );

      CREATE TABLE IF NOT EXISTS campus_feedback_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT,
        target_label TEXT NOT NULL,
        ratings_json TEXT NOT NULL,
        comment TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_by_email TEXT,
        department TEXT,
        display_mode TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        moderation_reason TEXT,
        moderated_by_user_id TEXT,
        moderated_by_name TEXT,
        moderated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(dedupe_key)
      );

      CREATE TABLE IF NOT EXISTS campus_feedback_audit (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        reason TEXT,
        actor_user_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(feedback_id) REFERENCES campus_feedback_entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_owner
        ON campus_feedback_entries(created_by_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_status
        ON campus_feedback_entries(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_type
        ON campus_feedback_entries(type, updated_at DESC);
    `);
  }

  _ensureAuthenticatedUser(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  }

  _ensureAdmin(user) {
    if (!user || user.role !== "admin") {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  }

  _rowToOption(row) {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _rowToEntry(row, { includeActor = false, audit = [] } = {}) {
    const entry = {
      id: row.id,
      type: row.type,
      typeLabel: TYPE_LABELS[row.type] || row.type,
      targetId: row.target_id || "",
      targetLabel: row.target_label,
      ratings: parseJson(row.ratings_json, {}),
      comment: row.comment,
      status: row.status,
      displayMode: row.display_mode,
      moderationReason: row.moderation_reason || "",
      moderatedByName: row.moderated_by_name || "",
      moderatedAt: row.moderated_at || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      governance: {
        owner: "Campus community feedback",
        routeNamespace: "/api/campus-feedback",
        retentionPolicy: "Stored for operational review and retained until moderation/archive policy removes it.",
      },
    };

    if (includeActor) {
      entry.createdBy = {
        userId: row.created_by_user_id,
        name: row.created_by_name,
        email: row.created_by_email || "",
        department: row.department || "",
        displayName: row.display_mode === "anonymous" ? "Anonymous student" : row.created_by_name,
      };
      entry.audit = audit;
    }

    return entry;
  }

  _getOption(type, optionId) {
    if (!optionId) return null;
    const fixed = ensureArray(FIXED_OPTIONS[type]).find((option) => option.id === optionId);
    if (fixed) return fixed;
    const row = this.db
      .prepare("SELECT * FROM campus_feedback_options WHERE type = ? AND id = ?")
      .get(type, optionId);
    return row ? this._rowToOption(row) : null;
  }

  _listAudit(feedbackId) {
    return this.db
      .prepare(
        `SELECT * FROM campus_feedback_audit
         WHERE feedback_id = ?
         ORDER BY created_at DESC`
      )
      .all(feedbackId)
      .map((row) => ({
        id: row.id,
        action: row.action,
        fromStatus: row.from_status || "",
        toStatus: row.to_status || "",
        reason: row.reason || "",
        actorName: row.actor_name,
        actorRole: row.actor_role,
        createdAt: row.created_at,
      }));
  }

  _listAuditByFeedbackIds(feedbackIds) {
    const ids = ensureArray(feedbackIds).filter(Boolean);
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT * FROM campus_feedback_audit
         WHERE feedback_id IN (${placeholders})
         ORDER BY created_at DESC`
      )
      .all(...ids);

    const auditByFeedbackId = new Map(ids.map((id) => [id, []]));
    for (const row of rows) {
      const audit = {
        id: row.id,
        action: row.action,
        fromStatus: row.from_status || "",
        toStatus: row.to_status || "",
        reason: row.reason || "",
        actorName: row.actor_name,
        actorRole: row.actor_role,
        createdAt: row.created_at,
      };
      auditByFeedbackId.get(row.feedback_id)?.push(audit);
    }
    return auditByFeedbackId;
  }

  _insertAudit({ feedbackId, action, fromStatus = "", toStatus = "", reason = "", user }) {
    this.db
      .prepare(
        `INSERT INTO campus_feedback_audit (
          id, feedback_id, action, from_status, to_status, reason,
          actor_user_id, actor_name, actor_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        feedbackId,
        action,
        fromStatus,
        toStatus,
        reason,
        user.userId,
        user.name,
        user.role,
        nowIso()
      );
  }

  getGovernance() {
    return {
      official: {
        label: "Official ERP feedback",
        owner: "University ERP workflow",
        routeNamespace: "/api/feedback/end-semester",
        editableThroughCampusModeration: false,
      },
      unofficial: {
        label: "Unofficial campus feedback",
        owner: "Campus community feedback with admin moderation",
        routeNamespace: "/api/campus-feedback",
        statuses: Object.values(MODERATION_STATUS),
        retentionPolicy:
          "Entries retain internal actor identity for abuse prevention while student-facing display can stay anonymous.",
      },
    };
  }

  listOptions(typeValue, { includeInactive = false } = {}) {
    const type = normalizeType(typeValue);
    const rows = this.db
      .prepare(
        `SELECT * FROM campus_feedback_options
         WHERE type = ? ${includeInactive ? "" : "AND active = 1"}
         ORDER BY label COLLATE NOCASE ASC`
      )
      .all(type)
      .map((row) => this._rowToOption(row));

    const fixed = ensureArray(FIXED_OPTIONS[type]).filter((option) => includeInactive || option.active);
    return {
      type,
      items: [...fixed, ...rows],
      governance: this.getGovernance().unofficial,
    };
  }

  createOption(typeValue, payload, { user }) {
    this._ensureAdmin(user);
    const type = normalizeType(typeValue);
    if (type === FEEDBACK_TYPES.HOSTEL_MESS) {
      const error = new Error("Hostel & mess feedback uses a fixed service target");
      error.status = 400;
      throw error;
    }

    const label = toSafeString(payload?.label || payload?.name);
    if (!label) {
      const error = new Error("label is required");
      error.status = 400;
      throw error;
    }

    const createdAt = nowIso();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO campus_feedback_options (
          id, type, label, active, created_by_user_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(type, label) DO UPDATE SET
          active = 1,
          updated_at = excluded.updated_at`
      )
      .run(id, type, label, 1, user.userId, user.name, createdAt, createdAt);

    const row = this.db
      .prepare("SELECT * FROM campus_feedback_options WHERE type = ? AND label = ?")
      .get(type, label);
    return this._rowToOption(row);
  }

  submitFeedback(typeValue, payload, { user }) {
    this._ensureAuthenticatedUser(user);
    const type = normalizeType(typeValue);
    const ratings = normalizeRatings(payload?.ratings);
    const comment = toSafeString(payload?.comment);
    if (comment.length > 1000) {
      const error = new Error("comment must be 1000 characters or fewer");
      error.status = 400;
      throw error;
    }

    const targetId = toSafeString(payload?.targetId);
    const option = this._getOption(type, targetId);
    const targetLabel = toSafeString(payload?.targetLabel || option?.label);
    if (!targetLabel) {
      const error = new Error("targetLabel or a valid targetId is required");
      error.status = 400;
      throw error;
    }

    const recent = this.db
      .prepare(
        `SELECT created_at FROM campus_feedback_entries
         WHERE type = ? AND target_label = ? AND created_by_user_id = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(type, targetLabel, user.userId);
    if (recent && Date.now() - new Date(recent.created_at).getTime() < SPAM_WINDOW_MS) {
      const error = new Error("Please wait before submitting feedback for the same target again");
      error.status = 429;
      error.code = "FEEDBACK_THROTTLED";
      throw error;
    }

    const createdAt = nowIso();
    const dedupeKey = buildDedupeKey({
      type,
      targetLabel,
      userId: user.userId,
      ratings,
      comment,
    });
    const id = randomUUID();

    try {
      this.db
        .prepare(
          `INSERT INTO campus_feedback_entries (
            id, type, target_id, target_label, ratings_json, comment, status,
            created_by_user_id, created_by_name, created_by_email, department,
            display_mode, dedupe_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          type,
          option?.id || targetId || "",
          targetLabel,
          JSON.stringify(ratings),
          comment,
          MODERATION_STATUS.PENDING,
          user.userId,
          user.name,
          user.email || "",
          user.department || "",
          payload?.displayMode === "named" ? "named" : "anonymous",
          dedupeKey,
          createdAt,
          createdAt
        );
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) {
        const existing = this.db
          .prepare("SELECT * FROM campus_feedback_entries WHERE dedupe_key = ?")
          .get(dedupeKey);
        if (existing) return this._rowToEntry(existing);
      }
      throw error;
    }

    this._insertAudit({
      feedbackId: id,
      action: "submitted",
      toStatus: MODERATION_STATUS.PENDING,
      reason: "Student submitted unofficial campus feedback",
      user,
    });

    log({
      msg: "Campus feedback submitted",
      feedbackId: id,
      type,
      status: MODERATION_STATUS.PENDING,
      targetLabel,
      actorUserId: user.userId,
    });

    const row = this.db.prepare("SELECT * FROM campus_feedback_entries WHERE id = ?").get(id);
    return this._rowToEntry(row);
  }

  importLegacyFeedback(typeValue, payload, { user }) {
    this._ensureAuthenticatedUser(user);
    const type = normalizeType(typeValue);
    const entries = ensureArray(payload?.entries).slice(0, 50);
    const imported = [];
    const skipped = [];

    for (const legacyEntry of entries) {
      try {
        const ratings = normalizeRatings(legacyEntry?.ratings);
        const comment = toSafeString(legacyEntry?.comment);
        const targetLabel = toSafeString(legacyEntry?.targetLabel);
        if (!targetLabel) {
          skipped.push({ reason: "missing targetLabel" });
          continue;
        }

        const dedupeKey = buildDedupeKey({
          type,
          targetLabel,
          userId: user.userId,
          ratings,
          comment,
        });
        const existing = this.db
          .prepare("SELECT * FROM campus_feedback_entries WHERE dedupe_key = ?")
          .get(dedupeKey);
        if (existing) {
          imported.push(this._rowToEntry(existing));
          continue;
        }

        const createdDate = new Date(legacyEntry?.submittedAt || "");
        const createdAt = Number.isNaN(createdDate.getTime()) ? nowIso() : createdDate.toISOString();
        const id = randomUUID();
        this.db
          .prepare(
            `INSERT INTO campus_feedback_entries (
              id, type, target_id, target_label, ratings_json, comment, status,
              created_by_user_id, created_by_name, created_by_email, department,
              display_mode, dedupe_key, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            type,
            toSafeString(legacyEntry?.targetId),
            targetLabel,
            JSON.stringify(ratings),
            comment,
            MODERATION_STATUS.PENDING,
            user.userId,
            user.name,
            user.email || "",
            user.department || "",
            legacyEntry?.displayMode === "named" ? "named" : "anonymous",
            dedupeKey,
            createdAt,
            nowIso()
          );

        this._insertAudit({
          feedbackId: id,
          action: "legacy_imported",
          toStatus: MODERATION_STATUS.PENDING,
          reason: "Migrated from legacy browser-local unofficial feedback",
          user,
        });

        const row = this.db.prepare("SELECT * FROM campus_feedback_entries WHERE id = ?").get(id);
        imported.push(this._rowToEntry(row));
      } catch (error) {
        skipped.push({ reason: error?.message || "invalid legacy entry" });
      }
    }

    log({
      msg: "Campus feedback legacy import completed",
      type,
      importedCount: imported.length,
      skippedCount: skipped.length,
      actorUserId: user.userId,
    });

    return {
      imported,
      skipped,
      counts: {
        imported: imported.length,
        skipped: skipped.length,
      },
    };
  }

  listMine({ user, type: typeValue = "", limit, offset } = {}) {
    this._ensureAuthenticatedUser(user);
    const type = typeValue ? normalizeType(typeValue) : "";
    const pagination = normalizePagination({ limit, offset });
    const params = type ? [user.userId, type] : [user.userId];
    const rows = this.db
      .prepare(
        `SELECT * FROM campus_feedback_entries
         WHERE created_by_user_id = ?
         ${type ? "AND type = ?" : ""}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pagination.limit, pagination.offset);

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM campus_feedback_entries
         WHERE created_by_user_id = ?
         ${type ? "AND type = ?" : ""}`
      )
      .get(...params);

    return {
      items: rows.map((row) => this._rowToEntry(row)),
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total: Number(totalRow?.count || 0),
      },
      governance: this.getGovernance().unofficial,
    };
  }

  listAdmin({ user, type: typeValue = "", status: statusValue = "", limit, offset } = {}) {
    this._ensureAdmin(user);
    const type = typeValue ? normalizeType(typeValue) : "";
    const status = statusValue ? normalizeStatus(statusValue) : "";
    const pagination = normalizePagination({ limit, offset });
    const params = [];
    const clauses = [];
    if (type) {
      clauses.push("type = ?");
      params.push(type);
    }
    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM campus_feedback_entries
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, pagination.limit, pagination.offset);

    const filteredTotalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM campus_feedback_entries
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}`
      )
      .get(...params);

    const countsRows = this.db
      .prepare("SELECT status, COUNT(*) AS count FROM campus_feedback_entries GROUP BY status")
      .all();
    const counts = Object.fromEntries(Object.values(MODERATION_STATUS).map((statusKey) => [statusKey, 0]));
    for (const row of countsRows) counts[row.status] = Number(row.count || 0);
    const auditByFeedbackId = this._listAuditByFeedbackIds(rows.map((row) => row.id));

    return {
      items: rows.map((row) =>
        this._rowToEntry(row, {
          includeActor: true,
          audit: auditByFeedbackId.get(row.id) || [],
        })
      ),
      counts: {
        total: Object.values(counts).reduce((sum, value) => sum + value, 0),
        ...counts,
      },
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total: Number(filteredTotalRow?.count || 0),
      },
      governance: this.getGovernance().unofficial,
    };
  }

  moderate(feedbackId, payload, { user }) {
    this._ensureAdmin(user);
    const id = toSafeString(feedbackId);
    const row = this.db.prepare("SELECT * FROM campus_feedback_entries WHERE id = ?").get(id);
    if (!row) {
      const error = new Error("Campus feedback entry not found");
      error.status = 404;
      throw error;
    }

    const nextStatus = normalizeStatus(payload?.status);
    if (nextStatus === MODERATION_STATUS.PENDING) {
      const error = new Error("Moderation decision must approve or reject the entry");
      error.status = 400;
      throw error;
    }

    const reason = toSafeString(payload?.reason);
    if (!reason) {
      const error = new Error("reason is required for moderation decisions");
      error.status = 400;
      throw error;
    }

    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE campus_feedback_entries SET
          status = ?,
          moderation_reason = ?,
          moderated_by_user_id = ?,
          moderated_by_name = ?,
          moderated_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(nextStatus, reason, user.userId, user.name, updatedAt, updatedAt, id);

    this._insertAudit({
      feedbackId: id,
      action: "moderated",
      fromStatus: row.status,
      toStatus: nextStatus,
      reason,
      user,
    });

    log({
      msg: "Campus feedback moderated",
      feedbackId: id,
      fromStatus: row.status,
      toStatus: nextStatus,
      actorUserId: user.userId,
    });

    const updated = this.db.prepare("SELECT * FROM campus_feedback_entries WHERE id = ?").get(id);
    return this._rowToEntry(updated, { includeActor: true, audit: this._listAudit(id) });
  }
}

module.exports = {
  CampusFeedbackStore,
  FEEDBACK_TYPES,
  MODERATION_STATUS,
};
