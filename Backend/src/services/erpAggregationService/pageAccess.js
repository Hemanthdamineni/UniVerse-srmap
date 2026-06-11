const { normalizeKey } = require("./helpers");

const pageAccessMethods = {
  async getPage({ pageKey, sessionId, modeOverride = "" }) {
    const normalizedPageKey = normalizeKey(pageKey);
    if (!normalizedPageKey) {
      const error = new Error("pageKey is required");
      error.status = 400;
      error.code = "BAD_REQUEST";
      throw error;
    }

    const policyMode = this.getEffectivePolicyMode(normalizedPageKey, modeOverride);

    const userKey = await this.resolveUserKey(sessionId);
    const cacheKey = this.cacheKeyFor(userKey, normalizedPageKey);

    const cached = await this.fromCache({
      pageKey: normalizedPageKey,
      policyMode,
      cacheKey,
    });

    if (policyMode === "cached-first") {
      if (cached?.source === "cache-fresh") {
        return cached;
      }

      if (cached?.source === "cache-stale") {
        this.triggerBackgroundRefresh({
          pageKey: normalizedPageKey,
          sessionId,
          policyMode,
          cacheKey,
        });
        return cached;
      }

      try {
        return await this.fetchLive({
          pageKey: normalizedPageKey,
          sessionId,
          policyMode,
          cacheKey,
        });
      } catch (liveError) {
        throw liveError;
      }
    }

    try {
      return await this.fetchLive({
        pageKey: normalizedPageKey,
        sessionId,
        policyMode,
        cacheKey,
      });
    } catch (liveError) {
      if (liveError.status === 401) throw liveError;

      if (cached) {
        return {
          ...cached,
          warnings: [
            ...(cached.warnings || []),
            `Live ERP failed: ${liveError.message || "Unknown live source error"}`,
          ],
        };
      }

      throw liveError;
    }
  },

  async getBatch({ pageKeys, sessionId, modeOverride = "" }) {
    const list = Array.isArray(pageKeys) ? pageKeys.map(normalizeKey).filter(Boolean) : [];

    if (!list.length) {
      const error = new Error("pageKeys[] is required");
      error.status = 400;
      error.code = "BAD_REQUEST";
      throw error;
    }

    const entries = await Promise.all(
      list.map(async (pageKey) => {
        try {
          const payload = await this.getPage({
            pageKey,
            sessionId,
            modeOverride,
          });
          return [pageKey, payload];
        } catch (error) {
          return [
            pageKey,
            {
              success: false,
              pageKey,
              error: error.message || "Unknown error",
              status: error.status || 500,
              code: error.code || "INTERNAL_ERROR",
            },
          ];
        }
      })
    );

    return Object.fromEntries(entries);
  },
};

module.exports = { pageAccessMethods };
