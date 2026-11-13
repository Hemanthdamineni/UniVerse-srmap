const { DatabaseSync } = require("node:sqlite");
const { randomUUID, createHash } = require("crypto");
const path = require("path");
const fs = require("fs");

// ── Utilities ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseJsonField(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function clampLimit(limit, max = 50) {
  const n = Number.parseInt(String(limit ?? 20), 10);
  if (!Number.isFinite(n)) return 20;
  return Math.min(max, Math.max(1, n));
}

function clampPage(page) {
  const n = Number.parseInt(String(page ?? 1), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS intranet_items (
    id              TEXT PRIMARY KEY,
    source_key      TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    audience        TEXT NOT NULL DEFAULT 'shared',
    title           TEXT NOT NULL,
    summary         TEXT,
    body            TEXT,
    published_at    TEXT,
    effective_at    TEXT,
    expires_at      TEXT,
    event_start     TEXT,
    event_end       TEXT,
    deadline        TEXT,
    department      TEXT,
    programme       TEXT,
    semester        TEXT,
    tags            TEXT,
    source_url      TEXT NOT NULL,
    canonical_url   TEXT,
    document_links  TEXT,
    attachments     TEXT,
    content_hash    TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    extraction_status TEXT DEFAULT 'ok',
    first_seen_at   TEXT NOT NULL,
    last_seen_at    TEXT NOT NULL,
    last_verified_at TEXT,
    last_modified_at TEXT,
    metadata        TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_intranet_source_key
    ON intranet_items(source_key);
  CREATE INDEX IF NOT EXISTS idx_intranet_content_type
    ON intranet_items(content_type);
  CREATE INDEX IF NOT EXISTS idx_intranet_audience
    ON intranet_items(audience);
  CREATE INDEX IF NOT EXISTS idx_intranet_is_active
    ON intranet_items(is_active);
  CREATE INDEX IF NOT EXISTS idx_intranet_published_at
    ON intranet_items(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_intranet_source_url
    ON intranet_items(source_url);
  CREATE INDEX IF NOT EXISTS idx_intranet_event_start
    ON intranet_items(event_start);

  -- Full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS intranet_items_fts USING fts5(
    id UNINDEXED,
    title,
    summary,
    body,
    department,
    tags,
    content='intranet_items',
    content_rowid='rowid'
  );

  -- FTS triggers to keep in sync
  CREATE TRIGGER IF NOT EXISTS intranet_items_fts_insert
    AFTER INSERT ON intranet_items BEGIN
      INSERT INTO intranet_items_fts(rowid, id, title, summary, body, department, tags)
      VALUES (new.rowid, new.id, new.title, new.summary, new.body, new.department, new.tags);
    END;

  CREATE TRIGGER IF NOT EXISTS intranet_items_fts_delete
    AFTER DELETE ON intranet_items BEGIN
      INSERT INTO intranet_items_fts(intranet_items_fts, rowid, id, title, summary, body, department, tags)
      VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.body, old.department, old.tags);
    END;

  CREATE TRIGGER IF NOT EXISTS intranet_items_fts_update
    AFTER UPDATE ON intranet_items BEGIN
      INSERT INTO intranet_items_fts(intranet_items_fts, rowid, id, title, summary, body, department, tags)
      VALUES ('delete', old.rowid, old.id, old.title, old.summary, old.body, old.department, old.tags);
      INSERT INTO intranet_items_fts(rowid, id, title, summary, body, department, tags)
      VALUES (new.rowid, new.id, new.title, new.summary, new.body, new.department, new.tags);
    END;

  -- Scraper run log (may already exist from Python side)
  CREATE TABLE IF NOT EXISTS intranet_scraper_runs (
    id              TEXT PRIMARY KEY,
    source          TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    completed_at    TEXT,
    status          TEXT DEFAULT 'running',
    items_new       INTEGER DEFAULT 0,
    items_updated   INTEGER DEFAULT 0,
    items_unchanged INTEGER DEFAULT 0,
    items_expired   INTEGER DEFAULT 0,
    error_message   TEXT,
    duration_ms     INTEGER,
    was_complete    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS intranet_source_health (
    source              TEXT PRIMARY KEY,
    last_success        TEXT,
    last_attempt        TEXT,
    consecutive_fails   INTEGER DEFAULT 0,
    is_blocked          INTEGER DEFAULT 0,
    notes               TEXT
  );

  CREATE TABLE IF NOT EXISTS intranet_auth_log (
    id              TEXT PRIMARY KEY,
    attempted_at    TEXT NOT NULL,
    success         INTEGER NOT NULL,
    failure_reason  TEXT
  );
`;

// ── Row → API serialization ───────────────────────────────────────────────────

function rowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceKey: row.source_key,
    contentType: row.content_type,
    audience: row.audience,
    title: row.title,
    summary: row.summary || null,
    body: row.body || null,
    publishedAt: row.published_at || null,
    effectiveAt: row.effective_at || null,
    expiresAt: row.expires_at || null,
    eventStart: row.event_start || null,
    eventEnd: row.event_end || null,
    deadline: row.deadline || null,
    department: row.department || null,
    programme: row.programme || null,
    semester: row.semester || null,
    tags: parseJsonField(row.tags) || [],
    sourceUrl: row.source_url,
    canonicalUrl: row.canonical_url || row.source_url,
    documentLinks: parseJsonField(row.document_links) || [],
    isActive: Boolean(row.is_active),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastVerifiedAt: row.last_verified_at || null,
    lastModifiedAt: row.last_modified_at || null,
    metadata: parseJsonField(row.metadata) || null,
  };
}

// ── IntranetStore ─────────────────────────────────────────────────────────────

class IntranetStore {
  constructor(dbPath) {
    this._dbPath = dbPath;
    this._db = null;
    this._ensureSchema();
  }

  _db_or_throw() {
    if (!this._db) throw new Error("IntranetStore: database not initialized");
    return this._db;
  }

  _ensureSchema() {
    fs.mkdirSync(path.dirname(this._dbPath), { recursive: true });
    this._db = new DatabaseSync(this._dbPath);
    const db = this._db;
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA synchronous=NORMAL");
    db.exec("PRAGMA busy_timeout=5000");
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(SCHEMA_SQL);
  }

  // ── List / search ────────────────────────────────────────────────────────

  listItems({
    contentType = null,
    audience = null,
    department = null,
    sourceKey = null,
    isActive = true,
    query = null,
    limit = 20,
    page = 1,
    orderBy = "published_at",
    includeBody = false,
  } = {}) {
    const db = this._db_or_throw();
    const safeLimit = clampLimit(limit);
    const safePage = clampPage(page);
    const offset = (safePage - 1) * safeLimit;

    const bodyField = includeBody ? ", i.body" : "";

    // If FTS query provided, use FTS5 search
    if (query && toSafeString(query).trim()) {
      return this._searchItems({ query, contentType, audience, department, sourceKey,
                                 isActive, limit: safeLimit, offset, includeBody });
    }

    const conditions = [];
    const params = {};
    if (isActive !== null) { conditions.push("i.is_active = :isActive"); params.isActive = isActive ? 1 : 0; }
    if (contentType) { conditions.push("i.content_type = :contentType"); params.contentType = contentType; }
    if (audience) { conditions.push("i.audience = :audience"); params.audience = audience; }
    if (department) { conditions.push("i.department = :department"); params.department = department; }
    if (sourceKey) { conditions.push("i.source_key = :sourceKey"); params.sourceKey = sourceKey; }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeOrderBy = ["published_at", "event_start", "last_seen_at", "first_seen_at"].includes(orderBy)
      ? orderBy : "published_at";

    const sql = `
      SELECT i.id, i.source_key, i.content_type, i.audience,
             i.title, i.summary${bodyField}, i.published_at, i.effective_at,
             i.expires_at, i.event_start, i.event_end, i.deadline,
             i.department, i.programme, i.semester, i.tags,
             i.source_url, i.canonical_url, i.document_links,
             i.is_active, i.first_seen_at, i.last_seen_at, i.last_verified_at,
             i.last_modified_at, i.metadata
      FROM intranet_items i
      ${where}
      ORDER BY i.${safeOrderBy} DESC NULLS LAST
      LIMIT :limit OFFSET :offset
    `;

    const countSql = `SELECT COUNT(*) as total FROM intranet_items i ${where}`;

    const rows = db.prepare(sql).all({ ...params, limit: safeLimit, offset });
    const { total } = db.prepare(countSql).get(params);

    return {
      items: rows.map(rowToApi),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  _searchItems({ query, contentType, audience, department, sourceKey, isActive,
                  limit, offset, includeBody }) {
    const db = this._db_or_throw();
    const bodyField = includeBody ? ", i.body" : "";

    // Build FTS match expression
    const terms = toSafeString(query)
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ""))
      .filter((t) => t.length >= 2)
      .slice(0, 8);

    if (!terms.length) {
      return this.listItems({ contentType, audience, department, sourceKey, isActive,
                              limit, page: 1, includeBody });
    }

    const matchExpr = terms.map((t) => `${t}*`).join(" AND ");

    const conditions = [];
    const params = { matchExpr };
    if (isActive !== null) { conditions.push("i.is_active = :isActive"); params.isActive = isActive ? 1 : 0; }
    if (contentType) { conditions.push("i.content_type = :contentType"); params.contentType = contentType; }
    if (audience) { conditions.push("i.audience = :audience"); params.audience = audience; }
    if (department) { conditions.push("i.department = :department"); params.department = department; }
    if (sourceKey) { conditions.push("i.source_key = :sourceKey"); params.sourceKey = sourceKey; }

    const extraWhere = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT i.id, i.source_key, i.content_type, i.audience,
             i.title, i.summary${bodyField}, i.published_at, i.effective_at,
             i.expires_at, i.event_start, i.event_end, i.deadline,
             i.department, i.programme, i.semester, i.tags,
             i.source_url, i.canonical_url, i.document_links,
             i.is_active, i.first_seen_at, i.last_seen_at, i.last_verified_at,
             i.last_modified_at, i.metadata
      FROM intranet_items i
      JOIN intranet_items_fts fts ON fts.id = i.id
      WHERE fts.intranet_items_fts MATCH :matchExpr ${extraWhere}
      ORDER BY rank
      LIMIT :limit OFFSET :offset
    `;

    try {
      const rows = db.prepare(sql).all({ ...params, limit, offset });
      return {
        items: rows.map(rowToApi),
        total: rows.length,  // FTS count is expensive; return what we got
        page: 1,
        limit,
        totalPages: null,
      };
    } catch (err) {
      // FTS query syntax error — fall back to plain list
      return this.listItems({ contentType, audience, department, sourceKey, isActive,
                              limit, page: 1, includeBody });
    }
  }

  getItem(id) {
    const db = this._db_or_throw();
    const row = db.prepare("SELECT * FROM intranet_items WHERE id = ?").get(id);
    return rowToApi(row);
  }

  // ── Convenience queries for API endpoints ────────────────────────────────

  getRecentAnnouncements(limit = 10) {
    return this.listItems({
      contentType: null,
      audience: "shared",
      isActive: true,
      limit,
      orderBy: "published_at",
    });
  }

  getUpcomingEvents(limit = 20) {
    const db = this._db_or_throw();
    const now = nowIso().slice(0, 10); // date portion
    const rows = db.prepare(`
      SELECT * FROM intranet_items
      WHERE content_type = 'event'
        AND is_active = 1
        AND (event_start >= :now OR event_end >= :now)
      ORDER BY event_start ASC NULLS LAST
      LIMIT :limit
    `).all({ now, limit });
    return rows.map(rowToApi);
  }

  getBySourceKey(sourceKey, { limit = 50, page = 1 } = {}) {
    return this.listItems({ sourceKey, limit, page });
  }

  // ── Dashboard feed ───────────────────────────────────────────────────────

  getDashboardFeed({ limit = 15 } = {}) {
    /**
     * Returns a combined feed of recent shared content, suitable for the
     * dashboard. Mixes announcements, news, and events, sorted by recency.
     */
    const db = this._db_or_throw();
    const rows = db.prepare(`
      SELECT id, source_key, content_type, audience, title, summary,
             published_at, event_start, source_url, canonical_url, department,
             tags, is_active, first_seen_at, last_seen_at, metadata
      FROM intranet_items
      WHERE is_active = 1
        AND audience = 'shared'
        AND content_type IN ('announcement', 'news', 'event', 'circular', 'notice')
      ORDER BY COALESCE(published_at, first_seen_at) DESC NULLS LAST
      LIMIT :limit
    `).all({ limit });
    return rows.map(rowToApi);
  }

  // ── Operational status ───────────────────────────────────────────────────

  getOperationalStatus() {
    const db = this._db_or_throw();

    const lastRun = db.prepare(
      "SELECT * FROM intranet_scraper_runs ORDER BY started_at DESC LIMIT 1"
    ).get();
    const lastSuccess = db.prepare(
      "SELECT * FROM intranet_scraper_runs WHERE status='ok' ORDER BY started_at DESC LIMIT 1"
    ).get();
    const sourceHealth = db.prepare(
      "SELECT * FROM intranet_source_health"
    ).all();
    const itemCounts = db.prepare(`
      SELECT content_type, COUNT(*) as count
      FROM intranet_items WHERE is_active = 1
      GROUP BY content_type
    `).all();
    const totalActive = db.prepare(
      "SELECT COUNT(*) as count FROM intranet_items WHERE is_active = 1"
    ).get();
    const lastAuth = db.prepare(
      "SELECT * FROM intranet_auth_log ORDER BY attempted_at DESC LIMIT 1"
    ).get();

    return {
      lastRun: lastRun || null,
      lastSuccess: lastSuccess || null,
      sources: sourceHealth,
      itemCounts: Object.fromEntries(itemCounts.map((r) => [r.content_type, r.count])),
      totalActiveItems: totalActive?.count || 0,
      lastAuth: lastAuth || null,
    };
  }

  // ── Admin: manual status reset ───────────────────────────────────────────

  resetCircuitBreaker(sourceKey) {
    const db = this._db_or_throw();
    db.prepare(
      "UPDATE intranet_source_health SET is_blocked=0, consecutive_fails=0 WHERE source=?"
    ).run(sourceKey);
  }

  close() {
    try {
      this._db?.close();
    } catch {
      // ignore
    }
    this._db = null;
  }

  getHealth() {
    return {
      dbPath: this._dbPath,
      open: Boolean(this._db),
    };
  }
}

module.exports = { IntranetStore };
