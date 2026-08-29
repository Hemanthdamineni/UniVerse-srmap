// SQLite-backed store for the Hostel Buddy Finder. Each entry
// represents a student's room + contact + block preference; the
// store surfaces:
//   - a fixed list of blocks (read-only, seed data)
//   - per-user "my buddy" (roomNo / blockId / contactInfo)
//   - per-user "matches" (other students in the same room+block)
//
// Schema lives in the SQLite file (WAL mode + foreign_keys=ON),
// no migrations needed because the columns are small and the
// shape has been stable since landing.

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");

const SEED_BLOCKS = [
  { id: "block-a", label: "Block A" },
  { id: "block-b", label: "Block B" },
  { id: "block-c", label: "Block C" },
];

class HostelBuddyStore {
  constructor({ dbPath }) {
    const dirPath = path.dirname(dbPath);
    fs.mkdirSync(dirPath, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this._ensureSchema();
    this._seedBlocks();
  }

  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hostel_buddy_blocks (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS hostel_buddy_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        department TEXT,
        room_no TEXT NOT NULL,
        block_id TEXT NOT NULL,
        contact_info TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id),
        FOREIGN KEY(block_id) REFERENCES hostel_buddy_blocks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_hostel_buddy_entries_lookup
        ON hostel_buddy_entries(block_id, room_no);
    `);
  }

  _seedBlocks() {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO hostel_buddy_blocks (id, label, active) VALUES (?, ?, 1)"
    );
    for (const block of SEED_BLOCKS) {
      insert.run(block.id, block.label);
    }
  }

  listBlocks() {
    const rows = this.db
      .prepare(
        "SELECT id, label, active FROM hostel_buddy_blocks WHERE active = 1 ORDER BY label"
      )
      .all();
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      active: Boolean(row.active),
    }));
  }

  getEntryByUserId(userId) {
    if (!userId) return null;
    const row = this.db
      .prepare(
        `SELECT id, user_id, name, department, room_no, block_id, contact_info, created_at, updated_at
         FROM hostel_buddy_entries WHERE user_id = ?`
      )
      .get(userId);
    if (!row) return null;
    return this._rowToEntry(row);
  }

  upsertEntry({ userId, name, department = null, roomNo, blockId, contactInfo = null }) {
    if (!userId) {
      const error = new Error("userId is required");
      error.status = 400;
      throw error;
    }
    if (!name) {
      const error = new Error("name is required");
      error.status = 400;
      throw error;
    }
    if (!roomNo) {
      const error = new Error("roomNo is required");
      error.status = 400;
      throw error;
    }
    if (!blockId) {
      const error = new Error("blockId is required");
      error.status = 400;
      throw error;
    }
    const block = this.db
      .prepare("SELECT id FROM hostel_buddy_blocks WHERE id = ? AND active = 1")
      .get(blockId);
    if (!block) {
      const error = new Error("blockId does not match an active block");
      error.status = 400;
      throw error;
    }
    const now = new Date().toISOString();
    const existing = this.getEntryByUserId(userId);
    if (existing) {
      this.db
        .prepare(
          `UPDATE hostel_buddy_entries
           SET name = ?, department = ?, room_no = ?, block_id = ?, contact_info = ?, updated_at = ?
           WHERE user_id = ?`
        )
        .run(name, department, roomNo, blockId, contactInfo, now, userId);
    } else {
      this.db
        .prepare(
          `INSERT INTO hostel_buddy_entries
           (id, user_id, name, department, room_no, block_id, contact_info, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(randomUUID(), userId, name, department, roomNo, blockId, contactInfo, now, now);
    }
    return this.getEntryByUserId(userId);
  }

  removeEntry(userId) {
    if (!userId) {
      const error = new Error("userId is required");
      error.status = 400;
      throw error;
    }
    const result = this.db
      .prepare("DELETE FROM hostel_buddy_entries WHERE user_id = ?")
      .run(userId);
    return { removed: result.changes > 0 };
  }

  listMatches({ userId, blockId, roomNo, limit = 50 } = {}) {
    if (!userId || !blockId || !roomNo) return [];
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const rows = this.db
      .prepare(
        `SELECT id, user_id, name, department, room_no, block_id, contact_info, created_at, updated_at
         FROM hostel_buddy_entries
         WHERE block_id = ? AND room_no = ? AND user_id != ?
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(blockId, roomNo, userId, safeLimit);
    return rows.map((row) => this._rowToEntry(row));
  }

  _rowToEntry(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      department: row.department,
      roomNo: row.room_no,
      blockId: row.block_id,
      contactInfo: row.contact_info,
      hasContact: Boolean(row.contact_info && String(row.contact_info).trim()),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = { HostelBuddyStore, HOSTEL_BUDDY_SEED_BLOCKS: SEED_BLOCKS };
