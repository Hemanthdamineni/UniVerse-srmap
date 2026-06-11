const { randomUUID } = require("crypto");
const { FEEDBACK_TYPES, FIXED_OPTIONS } = require("./constants");
const { nowIso, toSafeString, ensureArray, normalizeType } = require("./utils");

const optionMethods = {
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
  },

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
  },
};

module.exports = { optionMethods };
