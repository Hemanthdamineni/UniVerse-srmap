const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_REDIS_PREFIX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_REDIS_PREFIX,
} = require("../config/env");

function extractIp(req) {
  // Express applies the configured trust-proxy policy to req.ip. Parsing an
  // arbitrary X-Forwarded-For value here would let callers choose their own
  // limiter bucket when the backend is reached directly.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// Infra probes run every few seconds from monitors and docker healthchecks;
// counting them would burn limiter budget (and Redis round-trips) for no gain.
const RATE_LIMIT_BYPASS_PATHS = new Set(["/health", "/live", "/ready", "/metrics", "/telemetry"]);

function isBypassedPath(req) {
  return RATE_LIMIT_BYPASS_PATHS.has(req.path);
}

function memoryRateLimiter() {
  const buckets = new Map();
  const MAX_BUCKETS = 10_000;
  let nextSweepAt = 0;

  function sweep(windowStart) {
    for (const [key, entry] of buckets) {
      if (!entry.some((timestamp) => timestamp >= windowStart)) {
        buckets.delete(key);
      }
    }
  }

  return async function memoryLimiter(req, res, next) {
    if (isBypassedPath(req)) {
      return next();
    }

    const now = Date.now();
    const ip = extractIp(req);
    const key = `${RATE_LIMIT_REDIS_PREFIX}:mem:${ip}`;
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    if (now >= nextSweepAt) {
      sweep(windowStart);
      nextSweepAt = now + Math.min(RATE_LIMIT_WINDOW_MS, 60_000);
    }
    if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
      buckets.delete(buckets.keys().next().value);
    }

    const entry = buckets.get(key) || [];
    const recent = entry.filter((timestamp) => timestamp >= windowStart);
    recent.push(now);
    buckets.delete(key);
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
  const fallback = memoryRateLimiter();
  return async function redisLimiter(req, res, next) {
    if (isBypassedPath(req)) {
      return next();
    }

    const ip = extractIp(req);
    const key = `${RATE_LIMIT_REDIS_PREFIX}:${ip}`;
    const ttlSec = Math.max(1, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));

    try {
      // Single Redis round-trip in the steady state: INCR, and only pay a
      // second op when this is the first hit of a fresh window.
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, ttlSec);
      }

      const remaining = Math.max(0, RATE_LIMIT_MAX - count);
      res.setHeader("x-ratelimit-limit", String(RATE_LIMIT_MAX));
      res.setHeader("x-ratelimit-remaining", String(remaining));

      if (count > RATE_LIMIT_MAX) {
        res.setHeader("retry-after", String(ttlSec));
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
      // Preserve throttling during a Redis outage instead of failing open.
      return fallback(req, res, next);
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

// Stricter limiter for credential-touching endpoints. Same shape as the
// global one, but a much smaller budget and its own Redis key namespace.
function createLoginRateLimitMiddleware({ redisClient } = {}) {
  const windowMs = LOGIN_RATE_LIMIT_WINDOW_MS;
  const max = LOGIN_RATE_LIMIT_MAX;
  const prefix = LOGIN_RATE_LIMIT_REDIS_PREFIX;
  const fallbackBuckets = new Map();
  const maxFallbackBuckets = 10_000;
  let nextFallbackSweepAt = 0;

  function fallback(req, res, next) {
    const now = Date.now();
    const ip = extractIp(req);
    const key = `${prefix}:fallback:${ip}`;
    if (now >= nextFallbackSweepAt) {
      for (const [bucketKey, timestamps] of fallbackBuckets) {
        if (!timestamps.some((timestamp) => timestamp >= now - windowMs)) fallbackBuckets.delete(bucketKey);
      }
      nextFallbackSweepAt = now + Math.min(windowMs, 60_000);
    }
    if (!fallbackBuckets.has(key) && fallbackBuckets.size >= maxFallbackBuckets) {
      fallbackBuckets.delete(fallbackBuckets.keys().next().value);
    }
    const recent = (fallbackBuckets.get(key) || []).filter((timestamp) => timestamp >= now - windowMs);
    recent.push(now);
    fallbackBuckets.delete(key);
    fallbackBuckets.set(key, recent);
    res.setHeader("x-ratelimit-limit", String(max));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - recent.length)));
    if (recent.length > max) {
      res.setHeader("retry-after", String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many login attempts. Please wait a minute and try again.", retryable: true },
        requestId: req.requestId || null,
      });
    }
    return next();
  }

  if (redisClient) {
    return async function loginRedisLimiter(req, res, next) {
      const ip = extractIp(req);
      const key = `${prefix}:${ip}`;
      const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));

      try {
        const count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.expire(key, ttlSec);
        }
        const ttl = await redisClient.ttl(key);
        res.setHeader("x-ratelimit-limit", String(max));
        res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - count)));
        res.setHeader("x-ratelimit-reset", String(Math.max(0, ttl)));

        if (count > max) {
          res.setHeader("retry-after", String(Math.max(1, ttl)));
          return res.status(429).json({
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many login attempts. Please wait a minute and try again.",
              retryable: true,
            },
            requestId: req.requestId || null,
          });
        }
      } catch {
        return fallback(req, res, next);
      }

      return next();
    };
  }

  return async function loginMemoryLimiter(req, res, next) {
    return fallback(req, res, next);
  };
}

module.exports = {
  createGlobalRateLimitMiddleware,
  createLoginRateLimitMiddleware,
};
