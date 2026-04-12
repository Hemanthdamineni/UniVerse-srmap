const { randomUUID } = require("crypto");

class SessionStore {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session || now - session.updatedAt > this.ttlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async create(storageState) {
    this.cleanupExpired();
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      storageState,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      loggedIn: false,
      profileData: null,
      loginBootstrap: null,
      preAuthAttempt: null,
      username: "",
    });
    return sessionId;
  }

  async getOrThrow(sessionId) {
    this.cleanupExpired();

    if (!sessionId || !this.sessions.has(sessionId)) {
      const error = new Error("Invalid or expired sessionId. Fetch captcha again.");
      error.status = 401;
      throw error;
    }

    return this.sessions.get(sessionId);
  }

  async update(sessionId, updates) {
    const session = await this.getOrThrow(sessionId);
    const next = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };
    this.sessions.set(sessionId, next);
    return next;
  }

  async size() {
    this.cleanupExpired();
    return this.sessions.size;
  }
}

module.exports = {
  SessionStore,
};
