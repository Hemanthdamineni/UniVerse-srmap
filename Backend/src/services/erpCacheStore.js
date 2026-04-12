class InMemoryErpCacheStore {
  constructor() {
    this.store = new Map();
  }

  async get(cacheKey) {
    const entry = this.store.get(cacheKey);
    if (!entry) return null;

    if (!entry.expiresAt || entry.expiresAt <= Date.now()) {
      this.store.delete(cacheKey);
      return null;
    }

    return entry;
  }

  async set(cacheKey, value, ttlMs) {
    const expiresAt = Date.now() + Math.max(1000, Number(ttlMs) || 1000);
    this.store.set(cacheKey, {
      ...value,
      expiresAt,
    });
  }

  async delete(cacheKey) {
    this.store.delete(cacheKey);
  }

  async size() {
    return this.store.size;
  }
}

class RedisErpCacheStore {
  constructor(client) {
    this.client = client;
  }

  async get(cacheKey) {
    const raw = await this.client.get(cacheKey);
    if (!raw) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    return parsed;
  }

  async set(cacheKey, value, ttlMs) {
    const ttlSec = Math.max(1, Math.ceil((Number(ttlMs) || 1000) / 1000));
    await this.client.set(cacheKey, JSON.stringify(value), { EX: ttlSec });
  }

  async delete(cacheKey) {
    await this.client.del(cacheKey);
  }

  async size() {
    return -1;
  }
}

module.exports = {
  InMemoryErpCacheStore,
  RedisErpCacheStore,
};
