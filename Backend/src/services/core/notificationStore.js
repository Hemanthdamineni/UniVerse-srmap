/**
 * notificationStore.js — persistence for the notification layer (Batch B8):
 * per-user channel preferences + quiet hours + category mutes, Web Push
 * subscriptions, and a delivery log with retry accounting.
 *
 * One SQLite file (shares the unified-profile DB in practice); pass a private
 * `dbPath` in tests.
 *
 * @module core/notificationStore
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const { randomUUID, createHmac, randomBytes, timingSafeEqual } = require("crypto");

const CHANNELS = ["inApp", "webPush", "email", "nativePush"];
const CATEGORIES = ["academic", "career", "events", "system"];

function nowIso() {
  return new Date().toISOString();
}

function parseJson(text, fallback) {
  try {
    const v = JSON.parse(text);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function defaultPreferences() {
  return {
    channels: { inApp: true, webPush: false, email: false, nativePush: false },
    // Categories a student has explicitly silenced.
    mutedCategories: [],
    // 24h IST clock; null = no quiet hours. Non-critical events are dropped in
    // the window; critical ones (see notificationService) always go through.
    quietHours: null, // e.g. { start: "22:00", end: "07:00" }
  };
}

class NotificationStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id TEXT PRIMARY KEY,
        prefs_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
      CREATE TABLE IF NOT EXISTS native_subscriptions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        platform TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_native_sub_user ON native_subscriptions(user_id);
      CREATE TABLE IF NOT EXISTS notification_delivery_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_key TEXT NOT NULL,
        category TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,          -- delivered | failed | skipped
        detail TEXT,
        attempts INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_deliv_user_time ON notification_delivery_log(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS notification_contact (
        user_id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /* ---------- contact (userId -> email) ---------- */

  rememberContact(userId, email, name = "") {
    if (!userId || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) return;
    this.db
      .prepare(
        `INSERT INTO notification_contact (user_id, email, name, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, name = excluded.name, updated_at = excluded.updated_at`,
      )
      .run(String(userId), String(email).toLowerCase(), String(name || ""), nowIso());
  }

  getContact(userId) {
    if (!userId) return null;
    const row = this.db.prepare("SELECT email, name FROM notification_contact WHERE user_id = ?").get(String(userId));
    return row ? { email: row.email, name: row.name } : null;
  }

  /** Users who could receive an email digest: email channel on, contact known, `system` not muted. */
  digestRecipients() {
    return this.db
      .prepare(
        `SELECT c.user_id AS userId, c.email, c.name, p.prefs_json
         FROM notification_contact c
         JOIN notification_prefs p ON p.user_id = c.user_id
         WHERE c.email IS NOT NULL`,
      )
      .all()
      .map((row) => ({ userId: row.userId, email: row.email, name: row.name, prefs: parseJson(row.prefs_json, {}) }))
      .filter((r) => r.prefs?.channels?.email === true && !(r.prefs.mutedCategories || []).includes("system"));
  }

  /* ---------- one-click unsubscribe tokens ---------- */

  _unsubscribeSecret() {
    if (process.env.EMAIL_UNSUBSCRIBE_SECRET) return process.env.EMAIL_UNSUBSCRIBE_SECRET;
    const row = this.db.prepare("SELECT value FROM notification_meta WHERE key = 'unsub_secret'").get();
    if (row?.value) return row.value;
    const secret = randomBytes(32).toString("hex");
    this.db.prepare("INSERT OR REPLACE INTO notification_meta (key, value) VALUES ('unsub_secret', ?)").run(secret);
    return secret;
  }

  unsubscribeToken(userId) {
    return createHmac("sha256", this._unsubscribeSecret()).update(`email:${userId}`).digest("hex").slice(0, 32);
  }

  verifyUnsubscribe(userId, token) {
    if (!userId || !token) return false;
    const expected = Buffer.from(this.unsubscribeToken(userId));
    const given = Buffer.from(String(token));
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /* ---------- preferences ---------- */

  getPreferences(userId) {
    if (!userId) return defaultPreferences();
    const row = this.db.prepare("SELECT prefs_json FROM notification_prefs WHERE user_id = ?").get(String(userId));
    if (!row) return defaultPreferences();
    const stored = parseJson(row.prefs_json, {});
    const base = defaultPreferences();
    return {
      channels: { ...base.channels, ...(stored.channels || {}) },
      mutedCategories: Array.isArray(stored.mutedCategories)
        ? stored.mutedCategories.filter((c) => CATEGORIES.includes(c))
        : [],
      quietHours: normalizeQuietHours(stored.quietHours),
    };
  }

  updatePreferences(userId, patch = {}) {
    if (!userId) {
      const err = new Error("Authenticated user required");
      err.status = 401;
      throw err;
    }
    const current = this.getPreferences(userId);
    const next = {
      channels: {
        ...current.channels,
        ...Object.fromEntries(
          CHANNELS.filter((c) => c in (patch.channels || {})).map((c) => [c, Boolean(patch.channels[c])]),
        ),
      },
      mutedCategories:
        patch.mutedCategories !== undefined
          ? [...new Set((patch.mutedCategories || []).filter((c) => CATEGORIES.includes(c)))]
          : current.mutedCategories,
      quietHours:
        patch.quietHours !== undefined ? normalizeQuietHours(patch.quietHours) : current.quietHours,
    };
    this.db
      .prepare(
        `INSERT INTO notification_prefs (user_id, prefs_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET prefs_json = excluded.prefs_json, updated_at = excluded.updated_at`,
      )
      .run(String(userId), JSON.stringify(next), nowIso());
    return next;
  }

  /* ---------- push subscriptions ---------- */

  saveSubscription(userId, subscription, userAgent = "") {
    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      const err = new Error("Invalid push subscription");
      err.status = 400;
      throw err;
    }
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           user_agent = excluded.user_agent`,
      )
      .run(
        String(subscription.endpoint),
        String(userId),
        String(subscription.keys.p256dh),
        String(subscription.keys.auth),
        String(userAgent || ""),
        nowIso(),
      );
    return { saved: true };
  }

  deleteSubscription(endpoint) {
    if (!endpoint) return { deleted: 0 };
    const info = this.db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(String(endpoint));
    return { deleted: info.changes };
  }

  listSubscriptions(userId) {
    return this.db
      .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
      .all(String(userId))
      .map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
  }

  hasSubscription(userId) {
    const row = this.db.prepare("SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1").get(String(userId));
    return Boolean(row);
  }

  /* ---------- native (Capacitor) push tokens — Batch B13 ---------- */

  saveNativeToken(userId, token, platform = "") {
    if (!userId || !token) {
      const err = new Error("Invalid native push token");
      err.status = 400;
      throw err;
    }
    this.db
      .prepare(
        `INSERT INTO native_subscriptions (token, user_id, platform, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
      )
      .run(String(token), String(userId), String(platform || ""), nowIso());
    return { saved: true };
  }

  deleteNativeToken(token) {
    if (!token) return { deleted: 0 };
    const info = this.db.prepare("DELETE FROM native_subscriptions WHERE token = ?").run(String(token));
    return { deleted: info.changes };
  }

  listNativeTokens(userId) {
    return this.db
      .prepare("SELECT token, platform FROM native_subscriptions WHERE user_id = ?")
      .all(String(userId))
      .map((r) => ({ token: r.token, platform: r.platform }));
  }

  hasNativeSubscription(userId) {
    return Boolean(this.db.prepare("SELECT 1 FROM native_subscriptions WHERE user_id = ? LIMIT 1").get(String(userId)));
  }

  /* ---------- delivery log ---------- */

  logDelivery({ userId, eventKey, category, channel, status, detail = "", attempts = 1 }) {
    this.db
      .prepare(
        `INSERT INTO notification_delivery_log (id, user_id, event_key, category, channel, status, detail, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), String(userId), eventKey, category, channel, status, String(detail).slice(0, 500), attempts, nowIso());
    // Bound the table.
    this.db
      .prepare("DELETE FROM notification_delivery_log WHERE created_at < ?")
      .run(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  }

  recentDeliveries(userId, limit = 50) {
    return this.db
      .prepare(
        "SELECT event_key, category, channel, status, detail, attempts, created_at FROM notification_delivery_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(String(userId), Math.min(Math.max(Number(limit) || 50, 1), 200));
  }

  /** Count of successful deliveries for a category in the last `windowMs`. */
  deliveredCountSince(userId, category, windowMs) {
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM notification_delivery_log WHERE user_id = ? AND category = ? AND status = 'delivered' AND created_at >= ?",
      )
      .get(String(userId), category, since);
    return Number(row?.n || 0);
  }

  close() {
    this.db.close();
  }
}

function normalizeQuietHours(value) {
  if (!value || typeof value !== "object") return null;
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  const start = String(value.start || "");
  const end = String(value.end || "");
  if (!re.test(start) || !re.test(end)) return null;
  return { start, end };
}

module.exports = { NotificationStore, defaultPreferences, CHANNELS, CATEGORIES };
