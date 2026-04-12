const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_REDIS_PREFIX,
} = require("../config/env");

function extractIp(req) {
  const forwarded = String(req.header("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || "unknown";
}

function memoryRateLimiter() {
  const buckets = new Map();

  return async function memoryLimiter(req, res, next) {
    const now = Date.now();
    const ip = extractIp(req);
    const key = `${RATE_LIMIT_REDIS_PREFIX}:mem:${ip}`;
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const entry = buckets.get(key) || [];
    const recent = entry.filter((timestamp) => timestamp >= windowStart);
    recent.push(now);
    buckets.set(key, recent);

    res.setHeader("x-ratelimit-limit", String(RATE_LIMIT_MAX));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, RATE_LIMIT_MAX - recent.length)));

    if (recent.length > RATE_LIMIT_MAX) {
      const retryAfterSec = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
      res.setHeader("retry-after", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please retry later.",
          retryable: true,
        },
        requestId: req.requestId || null,
      });
    }

    return next();
  };
}

function redisRateLimiter(redisClient) {
  return async function redisLimiter(req, res, next) {
    const ip = extractIp(req);
    const key = `${RATE_LIMIT_REDIS_PREFIX}:${ip}`;
    const ttlSec = Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));

    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSec);
      }

      const ttl = await redisClient.ttl(key);
      const remaining = Math.max(0, RATE_LIMIT_MAX - count);
      res.setHeader("x-ratelimit-limit", String(RATE_LIMIT_MAX));
      res.setHeader("x-ratelimit-remaining", String(remaining));
      res.setHeader("x-ratelimit-reset", String(Math.max(0, ttl)));

      if (count > RATE_LIMIT_MAX) {
        res.setHeader("retry-after", String(Math.max(1, ttl)));
        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please retry later.",
            retryable: true,
          },
          requestId: req.requestId || null,
        });
      }
    } catch {
      // Degrade to allow requests if Redis limiter is unavailable.
    }

    return next();
  };
}

function createGlobalRateLimitMiddleware({ redisClient }) {
  if (redisClient) {
    return redisRateLimiter(redisClient);
  }
  return memoryRateLimiter();
}

module.exports = {
  createGlobalRateLimitMiddleware,
};
