const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const MAX_SNAPSHOTS_PER_USER = 30;

function todayIso(now = new Date()) {
  // India-time calendar date keeps snapshots aligned with the ERP's day.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/**
 * Persists one per-day attendance snapshot per user so trends can be shown
 * even though the live ERP only exposes current numbers. Snapshots are
 * captured from successful live fetches of the attendance pages.
 */
class AttendanceSnapshotStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance_snapshots (
        user_key TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        records_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_key, snapshot_date)
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance_snapshot_meta (
        user_key TEXT PRIMARY KEY,
        last_page_key TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  /**
   * Records today's snapshot. Accepts the extractor payload for either
   * attendance page shape and normalizes to a compact record list.
   * Returns "stored" | "unchanged" | "ignored".
   */
  record({ userKey, pageKey, records, now = new Date() }) {
    if (!userKey || userKey === "anonymous") return "ignored";
    if (!Array.isArray(records) || records.length === 0) return "ignored";

    const normalized = records
      .map((row) => ({
        subjectCode: String(row.subjectCode || "").trim(),
        subjectDescription: String(row.subjectDescription || "").trim(),
        attendancePercentage: Number.parseFloat(String(row.attendancePercentage ?? "").replace("%", "")) || null,
        classesConducted: Number.parseInt(String(row.classesConducted ?? ""), 10) || null,
        present: Number.parseInt(String(row.present ?? ""), 10) || null,
      }))
      .filter((row) => row.subjectCode && row.attendancePercentage !== null);
    if (normalized.length === 0) return "ignored";

    const date = todayIso(now);
    const serialized = JSON.stringify(normalized);

    const existing = this.db
      .prepare("SELECT records_json FROM attendance_snapshots WHERE user_key = ? AND snapshot_date = ?")
      .get(userKey, date);
    if (existing?.records_json === serialized) return "unchanged";

    this.db
      .prepare(
        `INSERT INTO attendance_snapshots (user_key, snapshot_date, records_json, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_key, snapshot_date) DO UPDATE SET
           records_json = excluded.records_json,
           created_at = excluded.created_at`
      )
      .run(userKey, date, serialized, now.toISOString());

    this.db
      .prepare(
        `INSERT INTO attendance_snapshot_meta (user_key, last_page_key, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_key) DO UPDATE SET
           last_page_key = excluded.last_page_key,
           updated_at = excluded.updated_at`
      )
      .run(userKey, String(pageKey || ""), now.toISOString());

    this.prune(userKey);
    return "stored";
  }

  /** Newest-first daily snapshots with parsed records, oldest last for charting. */
  history(userKey, { limit = MAX_SNAPSHOTS_PER_USER } = {}) {
    if (!userKey) return [];
    const rows = this.db
      .prepare(
        `SELECT snapshot_date, records_json FROM attendance_snapshots
         WHERE user_key = ?
         ORDER BY snapshot_date DESC
         LIMIT ?`
      )
      .all(String(userKey), Math.max(1, Math.min(limit, MAX_SNAPSHOTS_PER_USER)));
    return rows
      .map((row) => ({
        date: row.snapshot_date,
        subjects: JSON.parse(row.records_json),
      }))
      .reverse();
  }

  prune(userKey) {
    this.db
      .prepare(
        `DELETE FROM attendance_snapshots
         WHERE user_key = ? AND snapshot_date NOT IN (
           SELECT snapshot_date FROM attendance_snapshots
           WHERE user_key = ?
           ORDER BY snapshot_date DESC
           LIMIT ${MAX_SNAPSHOTS_PER_USER}
         )`
      )
      .run(userKey, userKey);
  }

  close() {
    try {
      this.db.close();
    } catch {
      // already closed
    }
  }
}

module.exports = {
  AttendanceSnapshotStore,
  todayIso,
};
