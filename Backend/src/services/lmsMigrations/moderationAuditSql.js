const ADD_LMS_RESOURCE_MODERATION_AUDIT_SQL = `
      ALTER TABLE lms_flags ADD COLUMN status TEXT DEFAULT 'open';
      ALTER TABLE lms_flags ADD COLUMN resolvedAt TEXT;
      ALTER TABLE lms_flags ADD COLUMN resolvedBy TEXT;

      CREATE TABLE IF NOT EXISTS lms_resource_moderation_audit (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        action TEXT NOT NULL,
        actorId TEXT NOT NULL,
        fromState INTEGER,
        toState INTEGER,
        reason TEXT,
        metadata TEXT DEFAULT '{}',
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_lms_flags_resource_status ON lms_flags(resourceId, status);
      CREATE INDEX IF NOT EXISTS idx_lms_flags_user_created ON lms_flags(userId, createdAt);
      CREATE INDEX IF NOT EXISTS idx_lms_moderation_audit_resource ON lms_resource_moderation_audit(resourceId, createdAt DESC);
    `;

module.exports = { ADD_LMS_RESOURCE_MODERATION_AUDIT_SQL };
