const { nowIso, randomId, toSafeString } = require("./lmsUtils");

class LmsFeatureFlagService {
  constructor({ lmsStore }) {
    this.lmsStore = lmsStore;
  }

  async listFlags() {
    return this.lmsStore.listFeatureFlags();
  }

  async setFlag({ key, enabled, rolloutType = "global", rolloutValue = "", description = "", updatedBy = "" }) {
    return this.lmsStore.upsertFeatureFlag({
      key,
      enabled,
      rolloutType,
      rolloutValue,
      description,
      updatedBy,
      updatedAt: nowIso(),
    });
  }

  async isEnabled(key, { userId = "" } = {}) {
    const flag = await this.lmsStore.getFeatureFlag(key);
    if (!flag || !flag.enabled) return false;

    if (flag.rolloutType === "global") return true;

    if (flag.rolloutType === "percentage") {
      const percentage = Number.parseInt(String(flag.rolloutValue || "0"), 10);
      const bucket = this.computeBucket(`${key}:${userId || "guest"}`);
      return bucket < Math.max(0, Math.min(100, percentage));
    }

    if (flag.rolloutType === "cohort") {
      const allowed = String(flag.rolloutValue || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      return allowed.includes(userId);
    }

    return false;
  }

  async assignExperiment({ experimentKey, userId }) {
    const normalizedExperimentKey = toSafeString(experimentKey);
    const normalizedUserId = toSafeString(userId);
    if (!normalizedExperimentKey || !normalizedUserId) {
      return null;
    }

    const existing = await this.lmsStore.getExperimentAssignment(normalizedExperimentKey, normalizedUserId);
    if (existing) return existing;

    const variant = this.computeBucket(`${normalizedExperimentKey}:${normalizedUserId}`) < 50 ? "A" : "B";
    return this.lmsStore.assignExperiment({
      id: randomId("exp"),
      experimentKey: normalizedExperimentKey,
      userId: normalizedUserId,
      variant,
      assignedAt: nowIso(),
    });
  }

  computeBucket(value) {
    let total = 0;
    for (const char of String(value)) {
      total = (total + char.charCodeAt(0) * 17) % 100;
    }
    return total;
  }
}

module.exports = {
  LmsFeatureFlagService,
};
