const { log } = require("../../utils/logger");
const { createClient } = require("redis");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

// --- redisClient.js ---
const {
  REDIS_URL,
  REDIS_SENTINEL_URLS,
  REDIS_SENTINEL_MASTER_NAME,
  REDIS_PASSWORD,
} = require("../../config/env");

let sharedClient = null;
let initFailed = false;

async function discoverMasterUrl(createClient, sentinels, masterName, password) {
  for (const sentinel of sentinels) {
    const sentinelUrl = `redis://${sentinel.host}:${sentinel.port}`;
    const probe = createClient({
      url: sentinelUrl,
      password: password || undefined,
      socket: {
        reconnectStrategy: () => false,
      },
    });

    try {
      await probe.connect();
      const response = await probe.sendCommand([
        "SENTINEL",
        "get-master-addr-by-name",
        masterName,
      ]);

      const host = Array.isArray(response) ? String(response[0] || "").trim() : "";
      const port = Array.isArray(response) ? Number(response[1] || 6379) : 6379;
      if (host) {
        return `redis://${host}:${port}`;
      }
    } catch {
      // Try next sentinel endpoint.
    } finally {
      try {
        await probe.quit();
      } catch {
        try {
          await probe.disconnect();
        } catch {
          // No-op
        }
      }
    }
  }

  return "";
}

async function getRedisClient() {
  const hasSentinel = Boolean(String(REDIS_SENTINEL_URLS || "").trim());
  if ((!REDIS_URL && !hasSentinel) || initFailed) return null;
  if (sharedClient) return sharedClient;

  try {
    // Optional dependency: only required when REDIS_URL is configured.
    // eslint-disable-next-line global-require

    const socketOptions = {
      reconnectStrategy: (retries) => {
        if (retries > 20) return new Error("Redis reconnect exhausted");
        return Math.min(1000, retries * 50);
      },
    };

    const sentinelRoots = String(REDIS_SENTINEL_URLS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((entry) => {
        const [host, port] = entry.split(":");
        return {
          host: String(host || "").trim(),
          port: Number(port || 26379),
        };
      })
      .filter((entry) => entry.host);

    const discoveredUrl =
      REDIS_URL ||
      (sentinelRoots.length
        ? await discoverMasterUrl(
            createClient,
            sentinelRoots,
            REDIS_SENTINEL_MASTER_NAME,
            REDIS_PASSWORD
          )
        : "");

    if (!discoveredUrl) {
      throw new Error("Unable to discover Redis master from configured sentinel endpoints");
    }

    const config = {
      url: discoveredUrl,
      password: REDIS_PASSWORD || undefined,
      socket: socketOptions,
    };

    const client = createClient(config);

    client.on("error", (error) => {
      log({ level: "error", msg: "Redis client error", error: error?.message || String(error) });
    });

    await client.connect();
    sharedClient = client;

    log({
      level: "info",
      msg: sentinelRoots.length ? "Redis connected (sentinel)" : "Redis connected",
      sentinelMasterName: sentinelRoots.length ? REDIS_SENTINEL_MASTER_NAME : undefined,
    });

    return sharedClient;
  } catch (error) {
    initFailed = true;
    log({
      level: "error",
      msg: "Redis unavailable. Falling back to in-memory stores.",
      error: error?.message || String(error),
    });
    return null;
  }
}

// --- redisSessionStore.js ---
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

  async delete(sessionId) {
    const id = String(sessionId || "").trim();
    if (id) await this.client.del(this.keyFor(id));
  }

  async size() {
    return -1;
  }
}

// --- sessionStore.js ---
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

  async delete(sessionId) {
    this.sessions.delete(sessionId);
  }

  async size() {
    this.cleanupExpired();
    return this.sessions.size;
  }
}

// --- loginDiagnostics.js ---
const {
  LOGIN_DIAGNOSTICS_DIR,
  LOGIN_DIAGNOSTICS_MAX_ARTIFACTS,
  LOGIN_DIAGNOSTICS_MAX_HTML_CHARS,
} = require("../../config/env");

function createLoginAttemptId() {
  return randomUUID();
}

function toCookieNames(storageState) {
  const cookies = Array.isArray(storageState?.cookies) ? storageState.cookies : [];
  return Array.from(
    new Set(
      cookies
        .map((cookie) => String(cookie?.name || "").trim())
        .filter(Boolean)
    )
  ).sort();
}

function truncate(value, maxChars = LOGIN_DIAGNOSTICS_MAX_HTML_CHARS) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[truncated ${text.length - maxChars} chars]`;
}

function redactSensitiveText(value, secrets = []) {
  let text = String(value || "");

  for (const secret of secrets) {
    const normalized = String(secret || "").trim();
    if (!normalized) continue;
    text = text.split(normalized).join("[redacted]");
  }

  text = text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "[redacted-uuid]"
  );
  text = text.replace(/\b\d{8,}\b/g, "[redacted-id]");
  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[redacted-email]"
  );

  return truncate(text);
}

function sanitizeArtifactPayload(value, secrets = [], depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return redactSensitiveText(value, secrets);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return String(value);
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: redactSensitiveText(value.message || String(value), secrets),
      code: value.code || undefined,
      status: value.status || undefined,
    };
  }
  if (depth >= 5) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeArtifactPayload(entry, secrets, depth + 1));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      const sanitized = sanitizeArtifactPayload(nested, secrets, depth + 1);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }
  return redactSensitiveText(String(value), secrets);
}

function ensureDiagnosticsDir() {
  fs.mkdirSync(LOGIN_DIAGNOSTICS_DIR, { recursive: true });
}

function rotateArtifacts() {
  try {
    ensureDiagnosticsDir();
    const files = fs
      .readdirSync(LOGIN_DIAGNOSTICS_DIR)
      .map((name) => {
        const filePath = path.join(LOGIN_DIAGNOSTICS_DIR, name);
        const stats = fs.statSync(filePath);
        return { name, filePath, mtimeMs: stats.mtimeMs, isFile: stats.isFile() };
      })
      .filter((entry) => entry.isFile)
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    for (const stale of files.slice(Math.max(0, LOGIN_DIAGNOSTICS_MAX_ARTIFACTS))) {
      fs.unlinkSync(stale.filePath);
    }
  } catch {
    // Diagnostics should never block auth.
  }
}

function writeLoginAttemptArtifact({ loginAttemptId, stage, classifier, payload, secrets = [] }) {
  try {
    ensureDiagnosticsDir();
    rotateArtifacts();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${loginAttemptId}-${stage}.json`;
    const filePath = path.join(LOGIN_DIAGNOSTICS_DIR, fileName);
    const sanitized = sanitizeArtifactPayload(
      {
        loginAttemptId,
        stage,
        classifier,
        capturedAt: new Date().toISOString(),
        payload,
      },
      secrets
    );
    fs.writeFileSync(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    return filePath;
  } catch {
    return "";
  }
}

function createLoginAttemptTrace({ loginAttemptId, sessionId = "", secrets = [] }) {
  const traceId = String(loginAttemptId || createLoginAttemptId()).trim() || createLoginAttemptId();
  const traceSecrets = Array.from(new Set([sessionId, ...secrets].filter(Boolean)));

  function recordStage({
    stage,
    startedAt,
    classifier = "",
    httpStatus = 0,
    finalUrl = "",
    storageStateBefore = null,
    storageStateAfter = null,
    error = null,
    artifactPayload = null,
  }) {
    const artifactPath = artifactPayload
      ? writeLoginAttemptArtifact({
          loginAttemptId: traceId,
          stage,
          classifier,
          payload: artifactPayload,
          secrets: traceSecrets,
        })
      : "";

    log({
      level: error ? "warn" : "info",
      msg: "ERP login stage",
      loginAttemptId: traceId,
      stage,
      durationMs: startedAt ? Number((Date.now() - startedAt).toFixed(2)) : undefined,
      classifier: classifier || undefined,
      httpStatus: httpStatus || undefined,
      finalUrl: finalUrl || undefined,
      cookieNamesBefore: toCookieNames(storageStateBefore),
      cookieNamesAfter: toCookieNames(storageStateAfter),
      artifactPath: artifactPath || undefined,
      errorCode: error?.code || undefined,
      errorMessage: error?.message || undefined,
    });

    return artifactPath;
  }

  function finish({ outcome, statusCode, errorCode = "", profileStatus = "", classifier = "" }) {
    log({
      level: outcome === "success" ? "info" : "warn",
      msg: "ERP login summary",
      loginAttemptId: traceId,
      outcome,
      statusCode: statusCode || undefined,
      errorCode: errorCode || undefined,
      profileStatus: profileStatus || undefined,
      classifier: classifier || undefined,
    });
  }

  return {
    loginAttemptId: traceId,
    recordStage,
    finish,
  };
}

// --- pagePolicyStore.js ---
const MODES = new Set(["cached-first", "live-first"]);

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeMode(value, fallback = "cached-first") {
  const mode = normalizeKey(value);
  if (MODES.has(mode)) return mode;
  return fallback;
}

class PagePolicyStore {
  constructor(policyPath) {
    this.policyPath = path.resolve(policyPath);
    this.lastLoadedMtimeMs = 0;
    this.lastCheckedAt = 0;
    this.raw = {
      defaultMode: "cached-first",
      liveFirstPrefixes: [],
      cachedFirstPrefixes: [],
      overrides: {},
    };
    this.reload(true);
  }

  safeReadJson() {
    if (!fs.existsSync(this.policyPath)) return null;

    const stat = fs.statSync(this.policyPath);
    const mtimeMs = Number(stat.mtimeMs || 0);

    const body = fs.readFileSync(this.policyPath, "utf8");
    const parsed = JSON.parse(body);

    return {
      parsed,
      mtimeMs,
    };
  }

  reload(force = false) {
    const now = Date.now();
    if (!force && now - this.lastCheckedAt < 1000) return;
    this.lastCheckedAt = now;

    const result = this.safeReadJson();
    if (!result) return;

    if (!force && result.mtimeMs === this.lastLoadedMtimeMs) return;

    const parsed = result.parsed || {};

    const defaultMode = normalizeMode(parsed.defaultMode, "cached-first");

    const liveFirstPrefixes = Array.isArray(parsed.liveFirstPrefixes)
      ? parsed.liveFirstPrefixes.map(normalizeKey).filter(Boolean)
      : [];

    const cachedFirstPrefixes = Array.isArray(parsed.cachedFirstPrefixes)
      ? parsed.cachedFirstPrefixes.map(normalizeKey).filter(Boolean)
      : [];

    const overrides = {};
    if (parsed.overrides && typeof parsed.overrides === "object") {
      for (const [key, mode] of Object.entries(parsed.overrides)) {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) continue;
        overrides[normalizedKey] = normalizeMode(mode, defaultMode);
      }
    }

    this.raw = {
      defaultMode,
      liveFirstPrefixes,
      cachedFirstPrefixes,
      overrides,
    };
    this.lastLoadedMtimeMs = result.mtimeMs;
  }

  resolveMode(pageKey, overrideMode = "") {
    this.reload(false);
    const key = normalizeKey(pageKey);

    if (overrideMode) {
      const normalizedOverride = normalizeMode(overrideMode, "");
      if (normalizedOverride) return normalizedOverride;
    }

    if (!key) return this.raw.defaultMode;

    if (this.raw.overrides[key]) return this.raw.overrides[key];

    if (this.raw.liveFirstPrefixes.some((prefix) => key.startsWith(prefix))) {
      return "live-first";
    }

    if (this.raw.cachedFirstPrefixes.some((prefix) => key.startsWith(prefix))) {
      return "cached-first";
    }

    return this.raw.defaultMode;
  }

  getHealth() {
    this.reload(false);
    return {
      policyPath: this.policyPath,
      lastLoadedMtimeMs: this.lastLoadedMtimeMs,
      defaultMode: this.raw.defaultMode,
      overrideCount: Object.keys(this.raw.overrides).length,
      liveFirstPrefixes: this.raw.liveFirstPrefixes.length,
      cachedFirstPrefixes: this.raw.cachedFirstPrefixes.length,
    };
  }
}

module.exports = {
  getRedisClient,
  RedisSessionStore,
  SessionStore,
  createLoginAttemptId,
  createLoginAttemptTrace,
  redactSensitiveText,
  sanitizeArtifactPayload,
  toCookieNames,
  writeLoginAttemptArtifact,
  PagePolicyStore,
};