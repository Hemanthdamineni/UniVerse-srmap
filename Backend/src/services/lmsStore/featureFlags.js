const { nowIso, toBooleanInteger } = require("../lmsUtils");

module.exports = {
  listFeatureFlags() {
    return this.db.prepare("SELECT * FROM lms_feature_flags ORDER BY key ASC").all();
  },

  getFeatureFlag(key) {
    return this.db.prepare("SELECT * FROM lms_feature_flags WHERE key = ?").get(key);
  },

  upsertFeatureFlag({ key, enabled, rolloutType, rolloutValue, description, updatedBy, updatedAt }) {
    this.db.prepare(
      `
        INSERT INTO lms_feature_flags (key, enabled, rolloutType, rolloutValue, description, updatedBy, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          enabled = excluded.enabled,
          rolloutType = excluded.rolloutType,
          rolloutValue = excluded.rolloutValue,
          description = excluded.description,
          updatedBy = excluded.updatedBy,
          updatedAt = excluded.updatedAt
      `
    ).run(key, toBooleanInteger(enabled), rolloutType, rolloutValue, description, updatedBy, updatedAt);
    return this.getFeatureFlag(key);
  },

  getExperimentAssignment(experimentKey, userId) {
    return this.db
      .prepare("SELECT * FROM lms_experiments WHERE experimentKey = ? AND userId = ?")
      .get(experimentKey, userId);
  },

  assignExperiment({ experimentKey, userId, variant, assignedAt }) {
    this.db.prepare(
      `
        INSERT INTO lms_experiments (experimentKey, userId, variant, assignedAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(userId, experimentKey) DO UPDATE SET
          variant = excluded.variant,
          assignedAt = excluded.assignedAt
      `
    ).run(experimentKey, userId, variant, assignedAt);
    return this.getExperimentAssignment(experimentKey, userId);
  },

  logShadowRanking({ userId, resourceId, algorithmKey, shadowScore, displayedScore }) {
    this.db.prepare(
      `
        INSERT INTO lms_ranking_shadow (userId, resourceId, algorithmKey, shadowScore, displayedScore, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, resourceId, algorithmKey) DO UPDATE SET
          shadowScore = excluded.shadowScore,
          displayedScore = excluded.displayedScore,
          createdAt = excluded.createdAt
      `
    ).run(userId, resourceId, algorithmKey, shadowScore, displayedScore, nowIso());
  }
};
