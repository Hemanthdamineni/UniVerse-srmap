/**
 * userDirectoryStore.js — a tiny register-number → display-name directory
 * (B3 / T5.4.6).
 *
 * Populated as a side effect of `createUserContextMiddleware`: every
 * authenticated request records its `{ userId, name }`. That's enough for the
 * organizer surfaces that show participant IDs (leaderboards, judge/shortlist
 * lists, competition audit trails) to render names instead — anyone appearing
 * there has necessarily hit an authenticated endpoint.
 *
 * `resolve()` returns `name: null` for an unknown id so the caller can fall
 * back to the raw register number.
 *
 * @module core/userDirectoryStore
 */

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

// Role placeholders that are never a real person's name.
const PLACEHOLDER_NAMES = new Set(["student", "guest", "admin", "unknown", "user"]);

class UserDirectoryStore {
  constructor({ dbPath }) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_directory (
        userId    TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    this._recordStmt = this.db.prepare(`
      INSERT INTO user_directory (userId, name, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt
    `);
  }

  /** Best-effort upsert. No-ops on blank / placeholder names. */
  record(userId, name) {
    const id = String(userId || "").trim();
    const display = String(name || "").trim();
    if (!id || !display || PLACEHOLDER_NAMES.has(display.toLowerCase())) return;
    try {
      this._recordStmt.run(id, display, new Date().toISOString());
    } catch {
      /* the directory is a nicety — never break a request over it */
    }
  }

  /**
   * @param {string[]} ids
   * @returns {Array<{ id: string, name: string | null }>} in the de-duped input order
   */
  resolve(ids) {
    const unique = [
      ...new Set((Array.isArray(ids) ? ids : []).map((v) => String(v || "").trim()).filter(Boolean)),
    ];
    if (unique.length === 0) return [];
    const placeholders = unique.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT userId, name FROM user_directory WHERE userId IN (${placeholders})`)
      .all(...unique);
    const found = new Map(rows.map((r) => [r.userId, r.name]));
    return unique.map((id) => ({ id, name: found.get(id) ?? null }));
  }
}

module.exports = { UserDirectoryStore };
