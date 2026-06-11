const schemaMethods = {
  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        location TEXT,
        metadata_json TEXT,
        lifecycle_state TEXT DEFAULT 'published',
        version INTEGER DEFAULT 1,
        deleted_at TEXT,
        last_actor TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        url_or_path TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER,
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_audit (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT DEFAULT 'admin',
        reason TEXT DEFAULT '',
        before_json TEXT,
        after_json TEXT,
        diff_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
      )
    `);

    const contentColumns = this.db.prepare("PRAGMA table_info(content)").all();
    const columnNames = new Set(contentColumns.map((column) => String(column?.name || "")));
    const addColumn = (name, ddl) => {
      if (!columnNames.has(name)) this.db.exec(`ALTER TABLE content ADD COLUMN ${ddl}`);
    };
    addColumn("metadata_json", "metadata_json TEXT");
    addColumn("lifecycle_state", "lifecycle_state TEXT DEFAULT 'published'");
    addColumn("version", "version INTEGER DEFAULT 1");
    addColumn("deleted_at", "deleted_at TEXT");
    addColumn("last_actor", "last_actor TEXT");
    this.db.exec("UPDATE content SET lifecycle_state = 'published' WHERE lifecycle_state IS NULL OR lifecycle_state = ''");
    this.db.exec("UPDATE content SET version = 1 WHERE version IS NULL OR version < 1");

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
      CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
      CREATE INDEX IF NOT EXISTS idx_content_state ON content(lifecycle_state);
      CREATE INDEX IF NOT EXISTS idx_content_audit_content_time ON content_audit(content_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_resources_content_id ON resources(content_id);
    `);
  },
};

module.exports = { schemaMethods };
