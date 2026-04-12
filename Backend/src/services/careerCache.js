/**
 * Phase 6 — optional Redis JSON cache for career hot paths.
 * Degrades cleanly when redisClient is null or commands fail.
 */
function createCareerCache(redisClient, { prefix = "career:cache:", ttlSec = 90 } = {}) {
  const effectiveTtl = Math.max(5, Number(ttlSec) || 90);

  async function getJson(key) {
    if (!redisClient || typeof redisClient.get !== "function") return null;
    try {
      const raw = await redisClient.get(`${prefix}${key}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function setJson(key, value) {
    if (!redisClient || typeof redisClient.set !== "function") return;
    try {
      await redisClient.set(`${prefix}${key}`, JSON.stringify(value), { EX: effectiveTtl });
    } catch {
      // ignore
    }
  }

  async function delKey(key) {
    if (!redisClient || typeof redisClient.del !== "function") return;
    try {
      await redisClient.del(`${prefix}${key}`);
    } catch {
      // ignore
    }
  }

  async function invalidateCommon() {
    await delKey("stats");
    await delKey("health");
    await delKey("trending");
  }

  async function invalidateUserFeed(userId) {
    await delKey(`feed:${userId}`);
  }

  return { getJson, setJson, delKey, invalidateCommon, invalidateUserFeed };
}

module.exports = {
  createCareerCache,
};
