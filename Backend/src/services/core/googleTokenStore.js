/**
 * googleTokenStore.js — encrypted-at-rest Google tokens + the set of calendar
 * events we created per user (Batch B10).
 *
 * Tokens are AES-256-GCM encrypted with a key from GOOGLE_TOKEN_ENC_KEY (hex,
 * 32 bytes) or an auto-persisted random key (dev). `synced_items` lets
 * disconnect / re-sync remove exactly the events we own.
 *
 * @module core/googleTokenStore
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const { createCipheriv, createDecipheriv, randomBytes } = require("crypto");

function nowIso() {
  return new Date().toISOString();
}

class GoogleTokenStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS google_tokens (
        user_id TEXT PRIMARY KEY,
        access_enc TEXT,
        refresh_enc TEXT,
        expires_at TEXT,
        scope TEXT,
        calendar_id TEXT,
        connected_at TEXT NOT NULL,
        last_sync_at TEXT,
        last_sync_status TEXT
      );
      CREATE TABLE IF NOT EXISTS google_synced_items (
        user_id TEXT NOT NULL,
        erp_key TEXT NOT NULL,        -- stable id we assign (e.g. "tt:monday:2")
        event_id TEXT NOT NULL,       -- Google Calendar event id
        kind TEXT NOT NULL,          -- 'timetable' | 'deadline'
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, erp_key)
      );
      CREATE TABLE IF NOT EXISTS google_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    this._key = this._resolveKey();
  }

  _resolveKey() {
    const fromEnv = process.env.GOOGLE_TOKEN_ENC_KEY;
    if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)) return Buffer.from(fromEnv, "hex");
    const row = this.db.prepare("SELECT value FROM google_meta WHERE key = 'enc_key'").get();
    if (row?.value) return Buffer.from(row.value, "hex");
    const key = randomBytes(32);
    this.db.prepare("INSERT OR REPLACE INTO google_meta (key, value) VALUES ('enc_key', ?)").run(key.toString("hex"));
    return key;
  }

  _encrypt(plain) {
    if (plain == null) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this._key, iv);
    const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
  }

  _decrypt(blob) {
    if (!blob) return null;
    try {
      const [ivB, tagB, ctB] = String(blob).split(".");
      const decipher = createDecipheriv("aes-256-gcm", this._key, Buffer.from(ivB, "base64"));
      decipher.setAuthTag(Buffer.from(tagB, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }

  /* ---------- tokens ---------- */

  save(userId, { accessToken, refreshToken, expiresAt, scope, calendarId } = {}) {
    if (!userId) throw Object.assign(new Error("userId required"), { status: 400 });
    const existing = this._row(userId);
    this.db
      .prepare(
        `INSERT INTO google_tokens (user_id, access_enc, refresh_enc, expires_at, scope, calendar_id, connected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           access_enc = excluded.access_enc,
           refresh_enc = COALESCE(excluded.refresh_enc, google_tokens.refresh_enc),
           expires_at = excluded.expires_at,
           scope = COALESCE(excluded.scope, google_tokens.scope),
           calendar_id = COALESCE(excluded.calendar_id, google_tokens.calendar_id)`,
      )
      .run(
        String(userId),
        this._encrypt(accessToken),
        refreshToken ? this._encrypt(refreshToken) : null,
        expiresAt || null,
        scope || null,
        calendarId || existing?.calendar_id || null,
        existing?.connected_at || nowIso(),
      );
    return this.get(userId);
  }

  _row(userId) {
    return this.db.prepare("SELECT * FROM google_tokens WHERE user_id = ?").get(String(userId));
  }

  get(userId) {
    const row = this._row(userId);
    if (!row) return null;
    return {
      userId: row.user_id,
      accessToken: this._decrypt(row.access_enc),
      refreshToken: this._decrypt(row.refresh_enc),
      expiresAt: row.expires_at,
      scope: row.scope,
      calendarId: row.calendar_id,
      connectedAt: row.connected_at,
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
    };
  }

  isConnected(userId) {
    return Boolean(this._row(userId));
  }

  setCalendarId(userId, calendarId) {
    this.db.prepare("UPDATE google_tokens SET calendar_id = ? WHERE user_id = ?").run(calendarId, String(userId));
  }

  recordSync(userId, status) {
    this.db
      .prepare("UPDATE google_tokens SET last_sync_at = ?, last_sync_status = ? WHERE user_id = ?")
      .run(nowIso(), String(status).slice(0, 200), String(userId));
  }

  delete(userId) {
    this.db.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(String(userId));
    this.db.prepare("DELETE FROM google_synced_items WHERE user_id = ?").run(String(userId));
  }

  listConnectedUserIds() {
    return this.db.prepare("SELECT user_id FROM google_tokens").all().map((r) => r.user_id);
  }

  /* ---------- synced items ---------- */

  getSyncedItem(userId, erpKey) {
    return this.db
      .prepare("SELECT event_id, kind FROM google_synced_items WHERE user_id = ? AND erp_key = ?")
      .get(String(userId), erpKey);
  }

  putSyncedItem(userId, erpKey, eventId, kind) {
    this.db
      .prepare(
        `INSERT INTO google_synced_items (user_id, erp_key, event_id, kind, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, erp_key) DO UPDATE SET event_id = excluded.event_id, updated_at = excluded.updated_at`,
      )
      .run(String(userId), erpKey, eventId, kind, nowIso());
  }

  listSyncedItems(userId, kind = null) {
    const rows = kind
      ? this.db.prepare("SELECT erp_key, event_id, kind FROM google_synced_items WHERE user_id = ? AND kind = ?").all(String(userId), kind)
      : this.db.prepare("SELECT erp_key, event_id, kind FROM google_synced_items WHERE user_id = ?").all(String(userId));
    return rows;
  }

  deleteSyncedItem(userId, erpKey) {
    this.db.prepare("DELETE FROM google_synced_items WHERE user_id = ? AND erp_key = ?").run(String(userId), erpKey);
  }

  close() {
    this.db.close();
  }
}

module.exports = { GoogleTokenStore };
