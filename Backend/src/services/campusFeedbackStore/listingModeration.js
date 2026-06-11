const { log } = require("../../utils/logger");
const { MODERATION_STATUS } = require("./constants");
const {
  nowIso,
  toSafeString,
  normalizeType,
  normalizeStatus,
  normalizePagination,
} = require("./utils");

const listingModerationMethods = {
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
  },

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
  },

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
  },
};

module.exports = { listingModerationMethods };
