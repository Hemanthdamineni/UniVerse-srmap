const { randomUUID } = require("crypto");
const {
  ERP_CACHE_FRESH_TTL_MS,
  ERP_CACHE_STALE_TTL_MS,
  ERP_DISTRIBUTED_LOCK_TTL_MS,
  ERP_CIRCUIT_REDIS_TTL_MS,
  ERP_CIRCUIT_FAILURE_THRESHOLD,
  ERP_CIRCUIT_COOLDOWN_MS,
} = require("../../config/env");
const { setCircuitState } = require("../metricsService");
const { normalizeKey, sleep } = require("./helpers");

const circuitAndCacheMethods = {
  async getCircuitState(pageKey) {
    const key = normalizeKey(pageKey);

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.circuitKeyFor(key));
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            failures: Number(parsed.failures || 0),
            openUntilMs: Number(parsed.openUntilMs || 0),
          };
        }
      } catch {
        // Degrade to in-memory state.
      }
    }

    return this.circuitByPage.get(key) || { failures: 0, openUntilMs: 0 };
  },

  async saveCircuitState(pageKey, state) {
    const key = normalizeKey(pageKey);
    this.circuitByPage.set(key, state);
    setCircuitState({ pageKey: key, isOpen: Number(state.openUntilMs || 0) > Date.now() });

    if (this.redisClient) {
      try {
        const ttlSec = Math.max(1, Math.ceil(ERP_CIRCUIT_REDIS_TTL_MS / 1000));
        await this.redisClient.set(this.circuitKeyFor(key), JSON.stringify(state), {
          EX: ttlSec,
        });
      } catch {
        // Degrade to in-memory state.
      }
    }
  },

  async clearCircuitState(pageKey) {
    const key = normalizeKey(pageKey);
    this.circuitByPage.delete(key);
    setCircuitState({ pageKey: key, isOpen: false });
    if (this.redisClient) {
      try {
        await this.redisClient.del(this.circuitKeyFor(key));
      } catch {
        // No-op
      }
    }
  },

  async markCircuitSuccess(pageKey) {
    await this.clearCircuitState(pageKey);
  },

  async markCircuitFailure(pageKey) {
    const key = normalizeKey(pageKey);
    const prev = await this.getCircuitState(key);
    const failures = Number(prev.failures || 0) + 1;

    const next = {
      failures,
      openUntilMs:
        failures >= ERP_CIRCUIT_FAILURE_THRESHOLD
          ? Date.now() + ERP_CIRCUIT_COOLDOWN_MS
          : Number(prev.openUntilMs || 0),
    };

    await this.saveCircuitState(key, next);
  },

  async canCallLive(pageKey) {
    const circuit = await this.getCircuitState(pageKey);
    if (!circuit.openUntilMs) return true;
    return Date.now() >= circuit.openUntilMs;
  },

  async acquireDistributedLock(lockKey) {
    if (!this.lockEnabled) return null;

    const token = randomUUID();
    const start = Date.now();
    const maxWaitMs = Math.max(500, Math.min(2500, Math.floor(ERP_DISTRIBUTED_LOCK_TTL_MS / 2)));

    while (Date.now() - start < maxWaitMs) {
      try {
        const result = await this.redisClient.set(lockKey, token, {
          NX: true,
          PX: Math.max(1000, ERP_DISTRIBUTED_LOCK_TTL_MS),
        });
        if (result === "OK") {
          return token;
        }
      } catch {
        return null;
      }

      await sleep(60);
    }

    const error = new Error("Upstream request coalescing lock timeout");
    error.status = 503;
    error.code = "LOCK_TIMEOUT";
    throw error;
  },

  async releaseDistributedLock(lockKey, token) {
    if (!this.lockEnabled || !token) return;
    try {
      const current = await this.redisClient.get(lockKey);
      if (current === token) {
        await this.redisClient.del(lockKey);
      }
    } catch {
      // Best effort only.
    }
  },

  async readCacheEntry(cacheKey) {
    return this.cacheStore.get(cacheKey);
  },

  async getOrRunInflight(inflightKey, loader) {
    if (this.inflightByKey.has(inflightKey)) {
      return this.inflightByKey.get(inflightKey);
    }

    const promise = (async () => {
      try {
        return await loader();
      } finally {
        this.inflightByKey.delete(inflightKey);
      }
    })();

    this.inflightByKey.set(inflightKey, promise);
    return promise;
  },

  async writeCache(cacheKey, pageKey, data) {
    const fetchedAtMs = Date.now();
    const staleAtMs = fetchedAtMs + ERP_CACHE_FRESH_TTL_MS;
    const expiresAtMs = fetchedAtMs + ERP_CACHE_STALE_TTL_MS;

    const entry = {
      pageKey,
      data,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      staleAt: staleAtMs,
      expiresAt: expiresAtMs,
    };

    await this.cacheStore.set(cacheKey, entry, ERP_CACHE_STALE_TTL_MS);
    return entry;
  },
};

module.exports = { circuitAndCacheMethods };
