const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { EXTERNAL_PAGE_SEED_DATA } = require("../data/externalSeedData");

class ExternalDataStore {
  constructor(dbPath) {
    const dirPath = path.dirname(dbPath);
    fs.mkdirSync(dirPath, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.ensureSchema();
    this.seedMissing(EXTERNAL_PAGE_SEED_DATA);
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS external_pages (
        page_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  seedMissing(seedData) {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO external_pages (page_key, title, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let inserted = 0;
    for (const [pageKey, payload] of Object.entries(seedData)) {
      const result = insert.run(pageKey, toTitle(pageKey), JSON.stringify(payload), now);
      inserted += Number(result.changes || 0);
    }

    return inserted;
  }

  upsertAll(seedData) {
    const upsert = this.db.prepare(`
      INSERT INTO external_pages (page_key, title, payload_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(page_key) DO UPDATE SET
        title = excluded.title,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();
    let affected = 0;
    for (const [pageKey, payload] of Object.entries(seedData)) {
      const result = upsert.run(pageKey, toTitle(pageKey), JSON.stringify(payload), now);
      affected += Number(result.changes || 0);
    }

    return affected;
  }

  clearAll() {
    const result = this.db.prepare("DELETE FROM external_pages").run();
    return Number(result.changes || 0);
  }

  countPages() {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM external_pages").get();
    return Number(row?.count || 0);
  }

  getPage(pageKey) {
    const safePageKey = String(pageKey || "").trim();
    if (!safePageKey) return null;

    let row = null;
    try {
      row = this.db
        .prepare(
          "SELECT page_key, title, payload_json, updated_at FROM external_pages WHERE page_key = ?"
        )
        .get(safePageKey);
    } catch (error) {
      throw new Error(`SQLite read failure for "${safePageKey}"`);
    }

    if (!row) return null;

    let payload = {};
    try {
      payload = JSON.parse(row.payload_json);
    } catch (_error) {
      payload = { summary: "Failed to parse payload", items: [] };
    }

    return {
      pageKey: row.page_key,
      title: row.title,
      source: "sqlite",
      updatedAt: row.updated_at,
      ...payload,
    };
  }

  ping() {
    try {
      const row = this.db.prepare("SELECT 1 AS ok").get();
      return Number(row?.ok || 0) === 1;
    } catch {
      return false;
    }
  }
}

function toTitle(pageKey) {
  return pageKey
    .split("/")
    .join(" / ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

module.exports = {
  ExternalDataStore,
  EXTERNAL_PAGE_SEED_DATA,
};
