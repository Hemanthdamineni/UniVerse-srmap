const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");
const { DatabaseSync } = require("node:sqlite");

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeLimit(value, fallback = 10, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function hashPayload(value) {
  return createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

class LmsTrackerStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this._ensureSchema();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lms_tracker_snapshots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        snapshot_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        inputs_hash TEXT NOT NULL,
        source_status_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_tracker_recommendation_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        recommendation_id TEXT NOT NULL,
        recommendation_title TEXT NOT NULL,
        source_domain TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_lms_tracker_snapshots_user_type_time
        ON lms_tracker_snapshots(user_id, snapshot_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_tracker_recommendations_user_time
        ON lms_tracker_recommendation_events(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_tracker_recommendations_user_item
        ON lms_tracker_recommendation_events(user_id, recommendation_id, event_type);
    `);
  }

  saveSnapshot({ userId, snapshotType, payload, sourceStatus = {} }) {
    const normalizedUserId = toSafeString(userId);
    const normalizedType = toSafeString(snapshotType);
    if (!normalizedUserId || !normalizedType) return null;

    const createdAt = nowIso();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO lms_tracker_snapshots (
          id, user_id, snapshot_type, payload_json, inputs_hash, source_status_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        normalizedUserId,
        normalizedType,
        JSON.stringify(payload || {}),
        hashPayload(payload),
        JSON.stringify(sourceStatus || {}),
        createdAt
      );

    return {
      id,
      userId: normalizedUserId,
      snapshotType: normalizedType,
      inputsHash: hashPayload(payload),
      createdAt,
    };
  }

  listSnapshots(userId, { snapshotType = "", limit = 10 } = {}) {
    const normalizedUserId = toSafeString(userId);
    if (!normalizedUserId) return [];
    const normalizedType = toSafeString(snapshotType);
    const params = [normalizedUserId];
    const clauses = ["user_id = ?"];
    if (normalizedType) {
      clauses.push("snapshot_type = ?");
      params.push(normalizedType);
    }

    return this.db
      .prepare(
        `SELECT * FROM lms_tracker_snapshots
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`
      )
      .all(...params, normalizeLimit(limit))
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        snapshotType: row.snapshot_type,
        payload: parseJson(row.payload_json, {}),
        inputsHash: row.inputs_hash,
        sourceStatus: parseJson(row.source_status_json, {}),
        createdAt: row.created_at,
      }));
  }

  recordRecommendationEvents({
    userId,
    eventType = "generated",
    sourceDomain = "academic_tracker",
    recommendations = [],
  }) {
    const normalizedUserId = toSafeString(userId);
    if (!normalizedUserId) return [];

    const insert = this.db.prepare(
      `INSERT INTO lms_tracker_recommendation_events (
        id, user_id, event_type, recommendation_id, recommendation_title,
        source_domain, confidence, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const created = [];
    const createdAt = nowIso();

    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const recommendation of ensureArray(recommendations)) {
        const title = toSafeString(recommendation.title);
        const recommendationId =
          toSafeString(recommendation.id) ||
          createHash("sha1").update(`${sourceDomain}:${title}`).digest("hex");
        if (!title || !recommendationId) continue;

        const event = {
          id: randomUUID(),
          userId: normalizedUserId,
          eventType: toSafeString(eventType) || "generated",
          recommendationId,
          recommendationTitle: title,
          sourceDomain: toSafeString(sourceDomain) || "academic_tracker",
          confidence: Number.isFinite(Number(recommendation.confidence))
            ? Number(recommendation.confidence)
            : 0,
          payload: recommendation,
          createdAt,
        };
        insert.run(
          event.id,
          event.userId,
          event.eventType,
          event.recommendationId,
          event.recommendationTitle,
          event.sourceDomain,
          event.confidence,
          JSON.stringify(event.payload || {}),
          event.createdAt
        );
        created.push(event);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return created;
  }

  listRecommendationEvents(userId, { limit = 25 } = {}) {
    const normalizedUserId = toSafeString(userId);
    if (!normalizedUserId) return [];
    return this.db
      .prepare(
        `SELECT * FROM lms_tracker_recommendation_events
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`
      )
      .all(normalizedUserId, normalizeLimit(limit, 25, 200))
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        eventType: row.event_type,
        recommendationId: row.recommendation_id,
        recommendationTitle: row.recommendation_title,
        sourceDomain: row.source_domain,
        confidence: Number(row.confidence || 0),
        payload: parseJson(row.payload_json, {}),
        createdAt: row.created_at,
      }));
  }
}

module.exports = {
  LmsTrackerStore,
};
