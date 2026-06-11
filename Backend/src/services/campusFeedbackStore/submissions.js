const { randomUUID } = require("crypto");
const { log } = require("../../utils/logger");
const { MODERATION_STATUS, SPAM_WINDOW_MS } = require("./constants");
const {
  nowIso,
  toSafeString,
  ensureArray,
  normalizeType,
  normalizeRatings,
  buildDedupeKey,
} = require("./utils");

const submissionMethods = {
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
  },

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
  },
};

module.exports = { submissionMethods };
