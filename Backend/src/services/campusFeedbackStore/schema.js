const schemaMethods = {
  _ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campus_feedback_options (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_by_user_id TEXT,
        created_by_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(type, label)
      );

      CREATE TABLE IF NOT EXISTS campus_feedback_entries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT,
        target_label TEXT NOT NULL,
        ratings_json TEXT NOT NULL,
        comment TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_by_email TEXT,
        department TEXT,
        display_mode TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        moderation_reason TEXT,
        moderated_by_user_id TEXT,
        moderated_by_name TEXT,
        moderated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(dedupe_key)
      );

      CREATE TABLE IF NOT EXISTS campus_feedback_audit (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        reason TEXT,
        actor_user_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(feedback_id) REFERENCES campus_feedback_entries(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_owner
        ON campus_feedback_entries(created_by_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_status
        ON campus_feedback_entries(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campus_feedback_entries_type
        ON campus_feedback_entries(type, updated_at DESC);
    `);
  },
};

module.exports = { schemaMethods };
