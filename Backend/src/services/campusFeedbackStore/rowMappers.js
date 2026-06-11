const { randomUUID } = require("crypto");
const {
  FEEDBACK_TYPES,
  MODERATION_STATUS,
  TYPE_LABELS,
  FIXED_OPTIONS,
} = require("./constants");
const {
  nowIso,
  toSafeString,
  ensureArray,
  parseJson,
} = require("./utils");

const rowMapperMethods = {
  _ensureAuthenticatedUser(user) {
    if (!user || !user.userId || user.role === "guest") {
      const error = new Error("Authentication required");
      error.status = 401;
      throw error;
    }
  },

  _ensureAdmin(user) {
    if (!user || user.role !== "admin") {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  },

  _rowToOption(row) {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

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
  },

  _getOption(type, optionId) {
    if (!optionId) return null;
    const fixed = ensureArray(FIXED_OPTIONS[type]).find((option) => option.id === optionId);
    if (fixed) return fixed;
    const row = this.db
      .prepare("SELECT * FROM campus_feedback_options WHERE type = ? AND id = ?")
      .get(type, optionId);
    return row ? this._rowToOption(row) : null;
  },

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
  },

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
  },

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
  },

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
  },
};

module.exports = { rowMapperMethods };
