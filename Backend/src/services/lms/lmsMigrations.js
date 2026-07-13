const { nowIso } = require("./lmsUtils");

// --- moderationAuditSql.js (utility) ---
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

// --- baseSchemaSql.js (utility) ---
const CREATE_LMS_BASE_SCHEMA_SQL = `
      CREATE TABLE IF NOT EXISTS lms_resources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('link','file','note','quiz','flashcard','pyq')),
        title TEXT NOT NULL,
        description TEXT,
        difficulty TEXT CHECK(difficulty IN ('beginner','intermediate','advanced')),
        semester TEXT NOT NULL,
        subjectCode TEXT NOT NULL,
        subjectName TEXT NOT NULL,
        unit TEXT NOT NULL,
        unitNormalized TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        uploadedBy TEXT NOT NULL,
        uploadedAt TEXT NOT NULL,
        updatedAt TEXT,
        url TEXT,
        filePath TEXT,
        fileSize INTEGER,
        fileHash TEXT,
        mimeType TEXT,
        noteContent TEXT,
        structuredContent TEXT,
        examYear TEXT,
        examType TEXT CHECK(examType IN ('mid-semester','end-semester','supplementary','model') OR examType IS NULL),
        examMonth TEXT,
        exportable INTEGER DEFAULT 1,
        validForSemester TEXT,
        estimatedMinutes INTEGER,
        viewCount INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        bookmarkCount INTEGER DEFAULT 0,
        commentCount INTEGER DEFAULT 0,
        qualityScore REAL DEFAULT 0,
        effectivenessScore REAL DEFAULT 0,
        examProvenScore REAL DEFAULT 0,
        renderType TEXT,
        outdatedCount INTEGER DEFAULT 0,
        isOutdated INTEGER DEFAULT 0,
        flagCount INTEGER DEFAULT 0,
        moderationState INTEGER DEFAULT 0,
        flagReason TEXT,
        verified INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_upvotes (
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (resourceId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_bookmarks (
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (resourceId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_flags (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        reason TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE (resourceId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_outdated_marks (
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        reason TEXT,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (resourceId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_comments (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        content TEXT NOT NULL,
        helpful INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_comment_helpful (
        commentId TEXT NOT NULL,
        userId TEXT NOT NULL,
        PRIMARY KEY (commentId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_ratings (
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        review TEXT,
        dimensionTags TEXT DEFAULT '[]',
        createdAt TEXT NOT NULL,
        PRIMARY KEY (resourceId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_annotations (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_collections (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        isPublic INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_collection_items (
        collectionId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        addedAt TEXT NOT NULL,
        PRIMARY KEY (collectionId, resourceId)
      );

      CREATE TABLE IF NOT EXISTS lms_requests (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        subjectCode TEXT NOT NULL,
        subjectName TEXT NOT NULL,
        semester TEXT NOT NULL,
        unit TEXT,
        title TEXT NOT NULL,
        description TEXT,
        resourceType TEXT,
        status TEXT DEFAULT 'open',
        fulfilledBy TEXT,
        fulfilledResourceId TEXT,
        upvotes INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT,
        FOREIGN KEY(fulfilledResourceId) REFERENCES lms_resources(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS lms_request_upvotes (
        requestId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (requestId, userId)
      );

      CREATE TABLE IF NOT EXISTS lms_exam_feedback (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        subjectCode TEXT NOT NULL,
        semester TEXT NOT NULL,
        helpful INTEGER NOT NULL CHECK(helpful IN (0, 1)),
        createdAt TEXT NOT NULL,
        UNIQUE (userId, resourceId, semester)
      );

      CREATE TABLE IF NOT EXISTS lms_guides (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        authorId TEXT NOT NULL,
        subjectCode TEXT NOT NULL,
        subjectName TEXT NOT NULL,
        semester TEXT NOT NULL,
        unit TEXT NOT NULL,
        unitNormalized TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        difficulty TEXT,
        viewCount INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        qualityScore REAL DEFAULT 0,
        moderationState INTEGER DEFAULT 0,
        exportable INTEGER DEFAULT 1,
        published INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_guide_sections (
        id TEXT PRIMARY KEY,
        guideId TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY(guideId) REFERENCES lms_guides(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lms_guide_progress (
        userId TEXT NOT NULL,
        guideId TEXT NOT NULL,
        readSections TEXT DEFAULT '[]',
        startedAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, guideId)
      );

      CREATE TABLE IF NOT EXISTS lms_roadmaps (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        skill TEXT NOT NULL,
        authorId TEXT NOT NULL,
        difficulty TEXT,
        estimatedHours INTEGER,
        viewCount INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        qualityScore REAL DEFAULT 0,
        published INTEGER DEFAULT 0,
        moderationState INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        deletedAt TEXT,
        deletedBy TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_roadmap_nodes (
        id TEXT PRIMARY KEY,
        roadmapId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        nodeType TEXT NOT NULL CHECK(nodeType IN ('concept','resource','quiz','milestone')),
        resourceId TEXT,
        position INTEGER NOT NULL,
        isOptional INTEGER DEFAULT 0,
        FOREIGN KEY(roadmapId) REFERENCES lms_roadmaps(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lms_roadmap_edges (
        roadmapId TEXT NOT NULL,
        fromNodeId TEXT NOT NULL,
        toNodeId TEXT NOT NULL,
        PRIMARY KEY (roadmapId, fromNodeId, toNodeId)
      );

      CREATE TABLE IF NOT EXISTS lms_roadmap_progress (
        userId TEXT NOT NULL,
        roadmapId TEXT NOT NULL,
        completedNodes TEXT DEFAULT '[]',
        startedAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, roadmapId)
      );

      CREATE TABLE IF NOT EXISTS lms_topics (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL UNIQUE,
        subjectCode TEXT,
        description TEXT,
        crossSubjectLinks TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS lms_resource_topics (
        resourceId TEXT NOT NULL,
        topicId TEXT NOT NULL,
        PRIMARY KEY (resourceId, topicId)
      );

      CREATE TABLE IF NOT EXISTS lms_topic_prerequisites (
        topicId TEXT NOT NULL,
        prerequisiteId TEXT NOT NULL,
        PRIMARY KEY (topicId, prerequisiteId)
      );

      CREATE TABLE IF NOT EXISTS lms_question_bank (
        id TEXT PRIMARY KEY,
        subjectCode TEXT NOT NULL,
        unit TEXT,
        unitNormalized TEXT,
        topicId TEXT,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        correctIndex INTEGER NOT NULL,
        explanation TEXT,
        difficulty TEXT CHECK(difficulty IN ('easy','medium','hard')),
        contributedBy TEXT NOT NULL,
        usageCount INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_quiz_questions (
        resourceId TEXT NOT NULL,
        questionId TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (resourceId, questionId)
      );

      CREATE TABLE IF NOT EXISTS lms_progress (
        userId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('started','completed')),
        completedAt TEXT,
        timeSpentMs INTEGER DEFAULT 0,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, resourceId)
      );

      CREATE TABLE IF NOT EXISTS lms_topic_mastery (
        userId TEXT NOT NULL,
        topicId TEXT NOT NULL,
        mastery REAL DEFAULT 0,
        quizScore REAL DEFAULT 0,
        interactionScore REAL DEFAULT 0,
        revisionScore REAL DEFAULT 0,
        lastUpdated TEXT NOT NULL,
        PRIMARY KEY (userId, topicId)
      );

      CREATE TABLE IF NOT EXISTS lms_subject_mastery (
        userId TEXT NOT NULL,
        subjectCode TEXT NOT NULL,
        mastery REAL DEFAULT 0,
        lastUpdated TEXT NOT NULL,
        PRIMARY KEY (userId, subjectCode)
      );

      CREATE TABLE IF NOT EXISTS lms_quiz_attempts (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        userId TEXT NOT NULL,
        answers TEXT NOT NULL,
        score REAL NOT NULL,
        maxScore REAL NOT NULL,
        percentage REAL NOT NULL,
        mode TEXT DEFAULT 'practice',
        timeTakenMs INTEGER,
        completedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_revision_queue (
        userId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        dueDate TEXT NOT NULL,
        interval INTEGER DEFAULT 1,
        repetition INTEGER DEFAULT 0,
        PRIMARY KEY (userId, resourceId)
      );

      CREATE TABLE IF NOT EXISTS lms_streaks (
        userId TEXT PRIMARY KEY,
        currentStreak INTEGER DEFAULT 0,
        longestStreak INTEGER DEFAULT 0,
        lastActivityDate TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_user_interactions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        resourceId TEXT,
        guideId TEXT,
        roadmapId TEXT,
        action TEXT NOT NULL,
        timeSpentMs INTEGER,
        metadata TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_user_preferences (
        userId TEXT PRIMARY KEY,
        subjectWeights TEXT DEFAULT '{}',
        typeWeights TEXT DEFAULT '{}',
        difficultyPref TEXT DEFAULT 'any',
        topicWeights TEXT DEFAULT '{}',
        explorationRate REAL DEFAULT 0.2,
        lastUpdated TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_resource_effectiveness (
        resourceId TEXT PRIMARY KEY,
        successRate REAL DEFAULT 0,
        completionRate REAL DEFAULT 0,
        avgTimeSpentMs INTEGER DEFAULT 0,
        sampleSize INTEGER DEFAULT 0,
        lastUpdated TEXT
      );

      CREATE TABLE IF NOT EXISTS lms_user_storage (
        userId TEXT PRIMARY KEY,
        totalBytes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS lms_resource_versions (
        id TEXT PRIMARY KEY,
        resourceId TEXT NOT NULL,
        versionNumber INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(resourceId, versionNumber)
      );

      CREATE TABLE IF NOT EXISTS lms_guide_versions (
        id TEXT PRIMARY KEY,
        guideId TEXT NOT NULL,
        versionNumber INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(guideId, versionNumber)
      );

      CREATE TABLE IF NOT EXISTS lms_ranking_shadow (
        userId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        algorithmKey TEXT NOT NULL,
        shadowScore REAL NOT NULL,
        displayedScore REAL,
        createdAt TEXT NOT NULL,
        PRIMARY KEY (userId, resourceId, algorithmKey)
      );

      CREATE TABLE IF NOT EXISTS lms_feature_flags (
        key TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        rolloutType TEXT NOT NULL DEFAULT 'global',
        rolloutValue TEXT,
        description TEXT,
        updatedBy TEXT,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lms_experiments (
        userId TEXT NOT NULL,
        experimentKey TEXT NOT NULL,
        variant TEXT NOT NULL,
        assignedAt TEXT NOT NULL,
        PRIMARY KEY (userId, experimentKey)
      );

      CREATE TABLE IF NOT EXISTS lms_schema_version (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        version INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_lms_subject ON lms_resources(subjectCode);
      CREATE INDEX IF NOT EXISTS idx_lms_semester ON lms_resources(semester);
      CREATE INDEX IF NOT EXISTS idx_lms_type ON lms_resources(type);
      CREATE INDEX IF NOT EXISTS idx_lms_unit ON lms_resources(unitNormalized);
      CREATE INDEX IF NOT EXISTS idx_lms_uploader ON lms_resources(uploadedBy);
      CREATE INDEX IF NOT EXISTS idx_lms_quality ON lms_resources(qualityScore DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_created ON lms_resources(uploadedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_popular ON lms_resources(upvotes DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_moderation ON lms_resources(moderationState);
      CREATE INDEX IF NOT EXISTS idx_lms_hash ON lms_resources(fileHash);
      CREATE INDEX IF NOT EXISTS idx_lms_deleted ON lms_resources(isDeleted);
      CREATE INDEX IF NOT EXISTS idx_lms_pyq ON lms_resources(subjectCode, examYear) WHERE type = 'pyq';
      CREATE INDEX IF NOT EXISTS idx_lms_annotations ON lms_annotations(userId, resourceId);
      CREATE INDEX IF NOT EXISTS idx_lms_requests_subject ON lms_requests(subjectCode, status);
      CREATE INDEX IF NOT EXISTS idx_lms_requests_user ON lms_requests(userId);
      CREATE INDEX IF NOT EXISTS idx_lms_exam_fb_resource ON lms_exam_feedback(resourceId);
      CREATE INDEX IF NOT EXISTS idx_lms_exam_fb_subject ON lms_exam_feedback(subjectCode, semester);
      CREATE INDEX IF NOT EXISTS idx_lms_qbank_subject ON lms_question_bank(subjectCode);
      CREATE INDEX IF NOT EXISTS idx_lms_qbank_unit ON lms_question_bank(unitNormalized);
      CREATE INDEX IF NOT EXISTS idx_lms_ix_user ON lms_user_interactions(userId);
      CREATE INDEX IF NOT EXISTS idx_lms_ix_resource ON lms_user_interactions(resourceId);
      CREATE INDEX IF NOT EXISTS idx_lms_ix_created ON lms_user_interactions(createdAt);
      CREATE INDEX IF NOT EXISTS idx_lms_guides_subject ON lms_guides(subjectCode, published, isDeleted);
      CREATE INDEX IF NOT EXISTS idx_lms_roadmaps_author ON lms_roadmaps(authorId, published, isDeleted);
      CREATE INDEX IF NOT EXISTS idx_lms_progress_user ON lms_progress(userId, updatedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_lms_revision_due ON lms_revision_queue(userId, dueDate);
      CREATE INDEX IF NOT EXISTS idx_lms_topic_subject ON lms_topics(subjectCode);
      CREATE INDEX IF NOT EXISTS idx_lms_shadow_algorithm ON lms_ranking_shadow(algorithmKey, createdAt);

      CREATE VIRTUAL TABLE IF NOT EXISTS lms_search USING fts5(
        title, description, tags,
        content='lms_resources',
        content_rowid='rowid'
      );
    `;

// --- migrationDefinitions.js ---
const MIGRATIONS = [
  {
    version: 1,
    name: "create_lms_base_schema",
    sql: CREATE_LMS_BASE_SCHEMA_SQL,
  },
  {
    version: 2,
    name: "add_lms_resource_moderation_audit",
    sql: ADD_LMS_RESOURCE_MODERATION_AUDIT_SQL,
  },
];

// --- class ---
function getCurrentVersion(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS lms_schema_version (id INTEGER PRIMARY KEY CHECK(id = 1), version INTEGER NOT NULL, updatedAt TEXT NOT NULL)"
  );
  const row = db.prepare("SELECT version FROM lms_schema_version WHERE id = 1").get();
  return Number(row?.version || 0);
}

function setCurrentVersion(db, version) {
  db.prepare(
    `
      INSERT INTO lms_schema_version (id, version, updatedAt)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET version = excluded.version, updatedAt = excluded.updatedAt
    `
  ).run(version, nowIso());
}

function runLmsMigrations(db) {
  const currentVersion = getCurrentVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (left, right) => left.version - right.version
  );

  if (!pending.length) return currentVersion;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const migration of pending) {
      db.exec(migration.sql);
      setCurrentVersion(db, migration.version);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return pending[pending.length - 1].version;
}

module.exports = {
  MIGRATIONS,
  runLmsMigrations,
};
