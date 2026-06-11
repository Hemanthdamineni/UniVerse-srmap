const {
  ERP_CACHED_TIMEOUT_MS,
  ERP_LIVE_TIMEOUT_MS,
  FEATURE_ERP_CACHED_FIRST,
} = require("../../config/env");
const { setUpstreamLoad } = require("../metricsService");
const { normalizeKey } = require("./helpers");

const serviceBasicsMethods = {
  getTargetsForPage(pageKey) {
    return Array.isArray(this.scrapeTargets?.[pageKey]) ? this.scrapeTargets[pageKey] : [];
  },

  cacheKeyFor(userKey, pageKey) {
    return `erp:${userKey}:${normalizeKey(pageKey)}`;
  },

  lockKeyFor(cacheKey) {
    return `${cacheKey}:live:lock`;
  },

  circuitKeyFor(pageKey) {
    return `erp:circuit:${normalizeKey(pageKey)}`;
  },

  updateSemaphoreMetrics(policyMode) {
    const stats = this.semaphore.stats();
    setUpstreamLoad({
      className: policyMode,
      inFlight: stats.inFlight,
      queued: stats.queued,
    });
  },

  async resolveUserKey(sessionId) {
    if (!sessionId) return "anonymous";
    try {
      const session = await this.sessionStore.getOrThrow(sessionId);
      const profile = session?.profileData?.TableContent || {};
      const userId =
        String(profile["Register No."] || profile["Student ID"] || profile["StuId"] || "").trim();
      if (userId) return userId.toLowerCase();
      return String(sessionId).trim().toLowerCase();
    } catch {
      return String(sessionId || "anonymous").trim().toLowerCase() || "anonymous";
    }
  },

  isFresh(entry) {
    return Boolean(entry && Number(entry.staleAt) > Date.now());
  },

  isStale(entry) {
    return Boolean(entry && Number(entry.expiresAt) > Date.now());
  },

  getEffectivePolicyMode(pageKey, overrideMode) {
    const resolved = this.pagePolicyStore.resolveMode(pageKey, overrideMode);
    if (!FEATURE_ERP_CACHED_FIRST) {
      return "live-first";
    }

    return resolved;
  },

  getTimeoutMs(policyMode) {
    return policyMode === "live-first" ? ERP_LIVE_TIMEOUT_MS : ERP_CACHED_TIMEOUT_MS;
  },
};

module.exports = { serviceBasicsMethods };
