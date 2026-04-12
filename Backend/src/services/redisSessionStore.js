const { randomUUID } = require("crypto");

class RedisSessionStore {
  constructor({ client, ttlMs }) {
    this.client = client;
    this.ttlMs = Math.max(1000, Number(ttlMs) || 30 * 60 * 1000);
  }

  keyFor(sessionId) {
    return `session:${sessionId}`;
  }

  ttlSec() {
    return Math.max(1, Math.ceil(this.ttlMs / 1000));
  }

  async create(storageState) {
    const sessionId = randomUUID();
    const payload = {
      storageState,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      loggedIn: false,
      profileData: null,
      loginBootstrap: null,
      preAuthAttempt: null,
      username: "",
    };

    await this.client.set(this.keyFor(sessionId), JSON.stringify(payload), {
      EX: this.ttlSec(),
    });

    return sessionId;
  }

  async getOrThrow(sessionId) {
    const id = String(sessionId || "").trim();
    if (!id) {
      const error = new Error("Invalid or expired sessionId. Fetch captcha again.");
      error.status = 401;
      throw error;
    }

    const raw = await this.client.get(this.keyFor(id));

    if (!raw) {
      const error = new Error("Invalid or expired sessionId. Fetch captcha again.");
      error.status = 401;
      throw error;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      const error = new Error("Invalid session payload. Fetch captcha again.");
      error.status = 401;
      throw error;
    }

    return payload;
  }

  async update(sessionId, updates) {
    const id = String(sessionId || "").trim();
    const existing = await this.getOrThrow(id);

    const next = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.client.set(this.keyFor(id), JSON.stringify(next), {
      EX: this.ttlSec(),
    });

    return next;
  }

  async size() {
    return -1;
  }
}

module.exports = {
  RedisSessionStore,
};
