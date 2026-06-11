const { randomUUID } = require("crypto");
const {
  CONTENT_LIFECYCLE_STATES,
  CONTENT_TRANSITIONS,
} = require("./constants");
const {
  nowIso,
  toSafeString,
  parseMetadataJson,
  normalizeActor,
  stableJson,
  calculateDiff,
} = require("./utils");

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

module.exports = { auditLifecycleMethods };
