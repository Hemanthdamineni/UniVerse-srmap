# LMS Domain — Final Unified System Plan
> **Version:** 6.0 — Final, Complete
> **Base System:** University ERP Companion Platform v2.0.0
> **Module Type:** Platform-native, ERP-informed, Self-improving
> **Last Updated:** April 11, 2026

---

## 0. Philosophy & Core Principles

The LMS is not a file repository. It is a peer-to-peer adaptive learning ecosystem built on top of your existing platform.

**Seven non-negotiable principles:**

1. **Peer-first** — Any authenticated student can contribute. No admin bottleneck, no faculty gating.
2. **ERP-informed, not ERP-dependent** — Subject/semester data comes from the ERP curriculum transformer. The LMS itself does not depend on ERP being live.
3. **Pipeline-guarded** — All LMS data entering the frontend passes through schema-validated models. No raw object leakage.
4. **Behavior-driven intelligence** — The system improves by observing user interactions. Starts with heuristics, evolves toward adaptive recommendations.
5. **No AI training pipelines** — Intelligence comes from scoring, heuristics, feedback loops, and bandit-style exploration. No LLMs, no model training, no GPUs.
6. **Incrementally shippable** — Each phase delivers complete usable value on its own.
7. **University-context aware** — Features like PYQ tagging, exam-outcome feedback, and ERP cross-linking leverage the specific SRM AP context that no external LMS can replicate.

---

## 1. System Layers

```
┌───────────────────────────────────────────────────────────────────┐
│  Layer 7: University Context (PYQ, exam feedback, ERP crosslinks) │
├───────────────────────────────────────────────────────────────────┤
│  Layer 6: Self-Improvement (interaction tracking, bandit ML)      │
├───────────────────────────────────────────────────────────────────┤
│  Layer 5: Adaptation (mastery, knowledge graph, gap detection)    │
├───────────────────────────────────────────────────────────────────┤
│  Layer 4: Retention (progress, streaks, revision, sessions)       │
├───────────────────────────────────────────────────────────────────┤
│  Layer 3: Intelligence (recommendations, quality, trending)       │
├───────────────────────────────────────────────────────────────────┤
│  Layer 2: Structure (roadmaps, guides, topic graph, units)        │
├───────────────────────────────────────────────────────────────────┤
│  Layer 1: Content (resources, files, links, quizzes, cards)       │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Academic Hierarchy

```
Semester (from ERP curriculum transformer)
  └── Subject (subjectCode + subjectName from ERP)
        └── Unit (free text, normalized on backend)
              └── Topic (tag-level, many-to-many)
                    └── Resource (any type)
```

**Unit normalization rule (enforced on every write):**
- Lowercase, trim whitespace, collapse repeated spaces and hyphens
- Store both `unit` (display) and `unitNormalized` (filter/grouping)

```
"Unit 1 - Introduction" → unitNormalized: "unit 1 introduction"
"UNIT-1"               → unitNormalized: "unit 1"
"Unit 01"              → unitNormalized: "unit 01"
```

---

## 3. Content Types

| Type | Description | Storage |
|------|-------------|---------|
| `link` | External URL | `url` column |
| `file` | Uploaded document | `filePath` (filesystem) |
| `note` | Rich text written in-platform | `noteContent` (text column) |
| `quiz` | Set of questions with answers | `structuredContent` (JSON) |
| `flashcard` | Front/back card deck | `structuredContent` (JSON) |
| `pyq` | Previous Year Question paper | `filePath` + PYQ metadata columns |
| `guide` | Long-form multi-section document | Separate `lms_guides` table |
| `roadmap` | Ordered learning path of nodes | Separate `lms_roadmaps` + `lms_roadmap_nodes` tables |

### PYQ Subtype — Special Fields

PYQs are the single most shared resource type among Indian university students. They get a dedicated subtype with structured metadata stored as extra columns on `lms_resources`:

```
examYear    TEXT    -- e.g., "2024", "2023"
examType    TEXT    -- "mid-semester" | "end-semester" | "supplementary" | "model"
examMonth   TEXT    -- e.g., "November", "April" (optional)
```

Enables: filtering by exam year, a dedicated "PYQ Bank" view per subject, and automatic surfacing of PYQs when ERP semester dates indicate an upcoming exam.

---

## 4. Database Schema (Complete)

**Database:** `Backend/data/lms.sqlite`
Bootstrapped on backend startup. Base tables are created with `IF NOT EXISTS`, then evolved through schema-versioned migrations (`lms_schema_version` + ordered migration runner).

---

### 4.1 Core Resource Table

```sql
CREATE TABLE IF NOT EXISTS lms_resources (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK(type IN ('link','file','note','quiz','flashcard','pyq')),
  title           TEXT NOT NULL,
  description     TEXT,
  difficulty      TEXT CHECK(difficulty IN ('beginner','intermediate','advanced')),

  -- Academic hierarchy
  semester        TEXT NOT NULL,
  subjectCode     TEXT NOT NULL,
  subjectName     TEXT NOT NULL,
  unit            TEXT NOT NULL,
  unitNormalized  TEXT NOT NULL,

  -- Topic tagging (JSON array of strings)
  tags            TEXT DEFAULT '[]',

  -- Authorship
  uploadedBy      TEXT NOT NULL,
  uploadedAt      TEXT NOT NULL,
  updatedAt       TEXT,

  -- Content fields
  url             TEXT,
  filePath        TEXT,
  fileSize        INTEGER,
  fileHash        TEXT,             -- SHA-256 for duplicate detection
  mimeType        TEXT,
  noteContent     TEXT,
  structuredContent TEXT,

  -- PYQ-specific metadata (NULL for non-PYQ types)
  examYear        TEXT,
  examType        TEXT CHECK(examType IN ('mid-semester','end-semester','supplementary','model') OR examType IS NULL),
  examMonth       TEXT,

  -- Visibility and validity
  exportable      INTEGER DEFAULT 1,
  validForSemester TEXT,            -- e.g., "Semester 6 2025-26", NULL = always valid
  estimatedMinutes INTEGER,         -- reading/watch time, computed at upload

  -- Engagement (denormalized for speed)
  viewCount       INTEGER DEFAULT 0,
  upvotes         INTEGER DEFAULT 0,
  bookmarkCount   INTEGER DEFAULT 0,
  commentCount    INTEGER DEFAULT 0,
  qualityScore    REAL DEFAULT 0,
  effectivenessScore REAL DEFAULT 0,
  examProvenScore REAL DEFAULT 0,   -- from post-exam retrospective feedback

  -- Rendering hint
  renderType      TEXT,

  -- Staleness
  outdatedCount   INTEGER DEFAULT 0,
  isOutdated      INTEGER DEFAULT 0, -- 1 when outdatedCount >= 3

  -- Moderation
  flagCount       INTEGER DEFAULT 0,
  moderationState INTEGER DEFAULT 0,
  -- 0=visible, 1=suspicious, 2=hidden, 3=removed
  flagReason      TEXT,

  -- Trust
  verified        INTEGER DEFAULT 0,

  -- Soft delete
  isDeleted       INTEGER DEFAULT 0,
  deletedAt       TEXT,
  deletedBy       TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lms_subject      ON lms_resources(subjectCode);
CREATE INDEX IF NOT EXISTS idx_lms_semester     ON lms_resources(semester);
CREATE INDEX IF NOT EXISTS idx_lms_type         ON lms_resources(type);
CREATE INDEX IF NOT EXISTS idx_lms_unit         ON lms_resources(unitNormalized);
CREATE INDEX IF NOT EXISTS idx_lms_uploader     ON lms_resources(uploadedBy);
CREATE INDEX IF NOT EXISTS idx_lms_quality      ON lms_resources(qualityScore DESC);
CREATE INDEX IF NOT EXISTS idx_lms_created      ON lms_resources(uploadedAt DESC);
CREATE INDEX IF NOT EXISTS idx_lms_popular      ON lms_resources(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_lms_moderation   ON lms_resources(moderationState);
CREATE INDEX IF NOT EXISTS idx_lms_hash         ON lms_resources(fileHash);
CREATE INDEX IF NOT EXISTS idx_lms_pyq          ON lms_resources(subjectCode, examYear) WHERE type = 'pyq';
CREATE INDEX IF NOT EXISTS idx_lms_deleted      ON lms_resources(isDeleted);

-- Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS lms_search USING fts5(
  title, description, tags,
  content='lms_resources',
  content_rowid='rowid'
);
```

---

### 4.2 Engagement Tables

```sql
-- Upvotes
CREATE TABLE IF NOT EXISTS lms_upvotes (
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  createdAt   TEXT NOT NULL,
  PRIMARY KEY (resourceId, userId)
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS lms_bookmarks (
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  createdAt   TEXT NOT NULL,
  PRIMARY KEY (resourceId, userId)
);

-- Flags
CREATE TABLE IF NOT EXISTS lms_flags (
  id          TEXT PRIMARY KEY,
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  reason      TEXT,
  createdAt   TEXT NOT NULL,
  UNIQUE (resourceId, userId)
);

-- Outdated marks (separate from flags — a warning signal, not moderation)
CREATE TABLE IF NOT EXISTS lms_outdated_marks (
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  reason      TEXT,
  createdAt   TEXT NOT NULL,
  PRIMARY KEY (resourceId, userId)
);

-- Comments
CREATE TABLE IF NOT EXISTS lms_comments (
  id          TEXT PRIMARY KEY,
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  content     TEXT NOT NULL,
  helpful     INTEGER DEFAULT 0,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT
);

-- Helpful marks on comments
CREATE TABLE IF NOT EXISTS lms_comment_helpful (
  commentId   TEXT NOT NULL,
  userId      TEXT NOT NULL,
  PRIMARY KEY (commentId, userId)
);

-- Ratings (1-5 with dimension tags)
CREATE TABLE IF NOT EXISTS lms_ratings (
  resourceId    TEXT NOT NULL,
  userId        TEXT NOT NULL,
  rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review        TEXT,
  dimensionTags TEXT DEFAULT '[]',
  -- JSON: ["Exam useful","Explains well","Great examples","Hard to follow","Outdated","Incomplete"]
  createdAt     TEXT NOT NULL,
  PRIMARY KEY (resourceId, userId)
);
```

---

### 4.3 Personal Annotations

Private sticky notes a user attaches to any resource. Like writing in the margins of a textbook. Never visible to others.

```sql
CREATE TABLE IF NOT EXISTS lms_annotations (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  resourceId  TEXT NOT NULL,
  content     TEXT NOT NULL,       -- plain text, max 1000 chars
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT
);

CREATE INDEX IF NOT EXISTS idx_lms_annotations ON lms_annotations(userId, resourceId);
```

---

### 4.4 Collections

```sql
CREATE TABLE IF NOT EXISTS lms_collections (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  isPublic    INTEGER DEFAULT 0,
  createdAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lms_collection_items (
  collectionId TEXT NOT NULL,
  resourceId   TEXT NOT NULL,
  addedAt      TEXT NOT NULL,
  PRIMARY KEY (collectionId, resourceId)
);
```

---

### 4.5 Resource Request Board

Students post requests for content they need. Others fulfill them by uploading. Demand-driven contribution.

```sql
CREATE TABLE IF NOT EXISTS lms_requests (
  id                  TEXT PRIMARY KEY,
  userId              TEXT NOT NULL,
  subjectCode         TEXT NOT NULL,
  subjectName         TEXT NOT NULL,
  semester            TEXT NOT NULL,
  unit                TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  resourceType        TEXT,            -- preferred type hint: 'pyq', 'notes', etc.
  status              TEXT DEFAULT 'open',
  -- 'open' | 'fulfilled' | 'closed'
  fulfilledBy         TEXT,
  fulfilledResourceId TEXT,
  upvotes             INTEGER DEFAULT 0,
  createdAt           TEXT NOT NULL,
  updatedAt           TEXT,
  FOREIGN KEY(fulfilledResourceId) REFERENCES lms_resources(id) ON DELETE SET NULL
);

-- Upvotes on requests (popular unfulfilled requests surface first)
CREATE TABLE IF NOT EXISTS lms_request_upvotes (
  requestId   TEXT NOT NULL,
  userId      TEXT NOT NULL,
  createdAt   TEXT NOT NULL,
  PRIMARY KEY (requestId, userId)
);

CREATE INDEX IF NOT EXISTS idx_lms_requests_subject ON lms_requests(subjectCode, status);
CREATE INDEX IF NOT EXISTS idx_lms_requests_user    ON lms_requests(userId);
```

---

### 4.6 Post-Exam Retrospective Feedback

After ERP semester results are published (detected by `lmsExamFeedbackService.js` polling `current-semester-results`), students are prompted to rate which resources helped them in the exam.

```sql
CREATE TABLE IF NOT EXISTS lms_exam_feedback (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  resourceId  TEXT NOT NULL,
  subjectCode TEXT NOT NULL,
  semester    TEXT NOT NULL,
  helpful     INTEGER NOT NULL CHECK(helpful IN (0, 1)),
  createdAt   TEXT NOT NULL,
  UNIQUE (userId, resourceId, semester)
);

CREATE INDEX IF NOT EXISTS idx_lms_exam_fb_resource ON lms_exam_feedback(resourceId);
CREATE INDEX IF NOT EXISTS idx_lms_exam_fb_subject  ON lms_exam_feedback(subjectCode, semester);
```

**examProvenScore computation:**
```
examProvenScore = (helpfulVotes / totalVotes) * log(1 + totalVotes)
```

Updated after each batch submission. Resources with `examProvenScore > 2.0` display a permanent **"Exam Proven ✓"** badge.

**Detection logic in `lmsExamFeedbackService.js`:**
```javascript
async checkAndTriggerExamFeedback(userId, sessionId) {
  // 1. Fetch ERP current-semester-results via existing batch API
  // 2. If results exist for this semester and feedback not yet collected:
  //    → Set pendingExamFeedback flag in user's session
  //    → Frontend shows feedback prompt on next LMS page load
  // 3. Fetch all resources the user interacted with this semester
  // 4. Return list for ExamFeedbackPage.tsx to display
}
```

---

### 4.7 Guides

```sql
CREATE TABLE IF NOT EXISTS lms_guides (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  authorId       TEXT NOT NULL,
  subjectCode    TEXT NOT NULL,
  subjectName    TEXT NOT NULL,
  semester       TEXT NOT NULL,
  unit           TEXT NOT NULL,
  unitNormalized TEXT NOT NULL,
  tags           TEXT DEFAULT '[]',
  difficulty     TEXT,
  viewCount      INTEGER DEFAULT 0,
  upvotes        INTEGER DEFAULT 0,
  qualityScore   REAL DEFAULT 0,
  moderationState INTEGER DEFAULT 0,
  exportable     INTEGER DEFAULT 1,
  published      INTEGER DEFAULT 0,
  isDeleted      INTEGER DEFAULT 0,
  deletedAt      TEXT,
  deletedBy      TEXT,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT
);

CREATE TABLE IF NOT EXISTS lms_guide_sections (
  id        TEXT PRIMARY KEY,
  guideId   TEXT NOT NULL,
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  position  INTEGER NOT NULL,
  FOREIGN KEY(guideId) REFERENCES lms_guides(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lms_guide_progress (
  userId       TEXT NOT NULL,
  guideId      TEXT NOT NULL,
  readSections TEXT DEFAULT '[]',
  startedAt    TEXT NOT NULL,
  updatedAt    TEXT NOT NULL,
  PRIMARY KEY (userId, guideId)
);
```

---

### 4.8 Roadmaps

```sql
CREATE TABLE IF NOT EXISTS lms_roadmaps (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  skill          TEXT NOT NULL,
  authorId       TEXT NOT NULL,
  difficulty     TEXT,
  estimatedHours INTEGER,
  viewCount      INTEGER DEFAULT 0,
  upvotes        INTEGER DEFAULT 0,
  qualityScore   REAL DEFAULT 0,
  published      INTEGER DEFAULT 0,
  moderationState INTEGER DEFAULT 0,
  isDeleted      INTEGER DEFAULT 0,
  deletedAt      TEXT,
  deletedBy      TEXT,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT
);

CREATE TABLE IF NOT EXISTS lms_roadmap_nodes (
  id          TEXT PRIMARY KEY,
  roadmapId   TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  nodeType    TEXT NOT NULL CHECK(nodeType IN ('concept','resource','quiz','milestone')),
  resourceId  TEXT,
  position    INTEGER NOT NULL,
  isOptional  INTEGER DEFAULT 0,
  FOREIGN KEY(roadmapId) REFERENCES lms_roadmaps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lms_roadmap_edges (
  roadmapId   TEXT NOT NULL,
  fromNodeId  TEXT NOT NULL,
  toNodeId    TEXT NOT NULL,
  PRIMARY KEY (roadmapId, fromNodeId, toNodeId)
);

CREATE TABLE IF NOT EXISTS lms_roadmap_progress (
  userId         TEXT NOT NULL,
  roadmapId      TEXT NOT NULL,
  completedNodes TEXT DEFAULT '[]',
  startedAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL,
  PRIMARY KEY (userId, roadmapId)
);
```

---

### 4.9 Topic / Knowledge Graph

```sql
CREATE TABLE IF NOT EXISTS lms_topics (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL UNIQUE,
  subjectCode       TEXT,
  description       TEXT,
  crossSubjectLinks TEXT DEFAULT '[]'
  -- JSON: [{ topicId, subjectCode, relation: "prerequisite"|"related"|"extends" }]
  -- e.g., OS topics link to Distributed Systems, DBMS links to Data Warehousing
);

CREATE TABLE IF NOT EXISTS lms_resource_topics (
  resourceId  TEXT NOT NULL,
  topicId     TEXT NOT NULL,
  PRIMARY KEY (resourceId, topicId)
);

CREATE TABLE IF NOT EXISTS lms_topic_prerequisites (
  topicId        TEXT NOT NULL,
  prerequisiteId TEXT NOT NULL,
  PRIMARY KEY (topicId, prerequisiteId)
);
```

---

### 4.10 Quiz Question Bank

Individual questions registered in a shared per-subject pool. New quizzes can draw from it, accelerating creation and building a crowd-sourced practice set.

```sql
CREATE TABLE IF NOT EXISTS lms_question_bank (
  id            TEXT PRIMARY KEY,
  subjectCode   TEXT NOT NULL,
  unit          TEXT,
  unitNormalized TEXT,
  topicId       TEXT,
  question      TEXT NOT NULL,
  options       TEXT NOT NULL,        -- JSON array of option strings
  correctIndex  INTEGER NOT NULL,     -- 0-based index into options
  explanation   TEXT,
  difficulty    TEXT CHECK(difficulty IN ('easy','medium','hard')),
  contributedBy TEXT NOT NULL,
  usageCount    INTEGER DEFAULT 0,
  upvotes       INTEGER DEFAULT 0,
  createdAt     TEXT NOT NULL
);

-- Junction: which questions belong to which quiz resource
CREATE TABLE IF NOT EXISTS lms_quiz_questions (
  resourceId  TEXT NOT NULL,
  questionId  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  PRIMARY KEY (resourceId, questionId)
);

CREATE INDEX IF NOT EXISTS idx_lms_qbank_subject ON lms_question_bank(subjectCode);
CREATE INDEX IF NOT EXISTS idx_lms_qbank_unit    ON lms_question_bank(unitNormalized);
```

---

### 4.11 Progress & Mastery

```sql
CREATE TABLE IF NOT EXISTS lms_progress (
  userId      TEXT NOT NULL,
  resourceId  TEXT NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('started','completed')),
  completedAt TEXT,
  timeSpentMs INTEGER DEFAULT 0,
  updatedAt   TEXT NOT NULL,
  PRIMARY KEY (userId, resourceId)
);

CREATE TABLE IF NOT EXISTS lms_topic_mastery (
  userId            TEXT NOT NULL,
  topicId           TEXT NOT NULL,
  mastery           REAL DEFAULT 0,
  quizScore         REAL DEFAULT 0,
  interactionScore  REAL DEFAULT 0,
  revisionScore     REAL DEFAULT 0,
  lastUpdated       TEXT NOT NULL,
  PRIMARY KEY (userId, topicId)
);

CREATE TABLE IF NOT EXISTS lms_subject_mastery (
  userId      TEXT NOT NULL,
  subjectCode TEXT NOT NULL,
  mastery     REAL DEFAULT 0,
  lastUpdated TEXT NOT NULL,
  PRIMARY KEY (userId, subjectCode)
);
```

---

### 4.12 Quiz Attempts

```sql
CREATE TABLE IF NOT EXISTS lms_quiz_attempts (
  id          TEXT PRIMARY KEY,
  resourceId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  answers     TEXT NOT NULL,
  score       REAL NOT NULL,
  maxScore    REAL NOT NULL,
  percentage  REAL NOT NULL,
  mode        TEXT DEFAULT 'practice',  -- 'practice' | 'exam'
  timeTakenMs INTEGER,
  completedAt TEXT NOT NULL
);
```

---

### 4.13 Spaced Repetition

```sql
CREATE TABLE IF NOT EXISTS lms_revision_queue (
  userId      TEXT NOT NULL,
  resourceId  TEXT NOT NULL,
  dueDate     TEXT NOT NULL,
  interval    INTEGER DEFAULT 1,
  repetition  INTEGER DEFAULT 0,
  PRIMARY KEY (userId, resourceId)
);
```

---

### 4.14 Streaks

```sql
CREATE TABLE IF NOT EXISTS lms_streaks (
  userId           TEXT PRIMARY KEY,
  currentStreak    INTEGER DEFAULT 0,
  longestStreak    INTEGER DEFAULT 0,
  lastActivityDate TEXT
);
```

---

### 4.15 ML / Adaptive Layer Tables

```sql
CREATE TABLE IF NOT EXISTS lms_user_interactions (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  resourceId  TEXT,
  guideId     TEXT,
  roadmapId   TEXT,
  action      TEXT NOT NULL,
  -- 'view' | 'click' | 'upvote' | 'bookmark' | 'complete' | 'quiz_pass'
  -- | 'quiz_fail' | 'comment' | 'ignore' | 'skip' | 'annotate'
  -- | 'request_fulfill' | 'exam_feedback_positive' | 'exam_feedback_negative'
  timeSpentMs INTEGER,
  metadata    TEXT,
  createdAt   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lms_ix_user     ON lms_user_interactions(userId);
CREATE INDEX IF NOT EXISTS idx_lms_ix_resource ON lms_user_interactions(resourceId);
CREATE INDEX IF NOT EXISTS idx_lms_ix_created  ON lms_user_interactions(createdAt);

CREATE TABLE IF NOT EXISTS lms_user_preferences (
  userId           TEXT PRIMARY KEY,
  subjectWeights   TEXT DEFAULT '{}',
  typeWeights      TEXT DEFAULT '{}',
  difficultyPref   TEXT DEFAULT 'any',
  topicWeights     TEXT DEFAULT '{}',
  explorationRate  REAL DEFAULT 0.2,
  lastUpdated      TEXT
);

CREATE TABLE IF NOT EXISTS lms_resource_effectiveness (
  resourceId       TEXT PRIMARY KEY,
  successRate      REAL DEFAULT 0,
  completionRate   REAL DEFAULT 0,
  avgTimeSpentMs   INTEGER DEFAULT 0,
  sampleSize       INTEGER DEFAULT 0,
  lastUpdated      TEXT
);

CREATE TABLE IF NOT EXISTS lms_user_storage (
  userId      TEXT PRIMARY KEY,
  totalBytes  INTEGER DEFAULT 0
);
```

---

### 4.16 Versioning, Feature Flags, Experimentation, and Migrations

```sql
-- Resource version history (snapshot before each update)
CREATE TABLE IF NOT EXISTS lms_resource_versions (
  id            TEXT PRIMARY KEY,
  resourceId    TEXT NOT NULL,
  versionNumber INTEGER NOT NULL,
  snapshot      TEXT NOT NULL,      -- JSON snapshot of mutable fields
  createdBy     TEXT NOT NULL,
  createdAt     TEXT NOT NULL,
  UNIQUE(resourceId, versionNumber)
);

-- Guide version history (sections + metadata snapshot)
CREATE TABLE IF NOT EXISTS lms_guide_versions (
  id            TEXT PRIMARY KEY,
  guideId       TEXT NOT NULL,
  versionNumber INTEGER NOT NULL,
  snapshot      TEXT NOT NULL,      -- JSON snapshot including section content
  createdBy     TEXT NOT NULL,
  createdAt     TEXT NOT NULL,
  UNIQUE(guideId, versionNumber)
);

-- Shadow ranking (offline/hidden ranking for safe experiments)
CREATE TABLE IF NOT EXISTS lms_ranking_shadow (
  userId         TEXT NOT NULL,
  resourceId     TEXT NOT NULL,
  algorithmKey   TEXT NOT NULL,      -- e.g. "ranking-v2"
  shadowScore    REAL NOT NULL,
  displayedScore REAL,
  createdAt      TEXT NOT NULL,
  PRIMARY KEY (userId, resourceId, algorithmKey)
);

-- Runtime feature flags (no redeploy required)
CREATE TABLE IF NOT EXISTS lms_feature_flags (
  key           TEXT PRIMARY KEY,
  enabled       INTEGER NOT NULL DEFAULT 0,
  rolloutType   TEXT NOT NULL DEFAULT 'global',
  -- 'global' | 'percentage' | 'cohort'
  rolloutValue  TEXT,
  description   TEXT,
  updatedBy     TEXT,
  updatedAt     TEXT NOT NULL
);

-- Simple A/B assignment per feature
CREATE TABLE IF NOT EXISTS lms_experiments (
  userId        TEXT NOT NULL,
  experimentKey TEXT NOT NULL,
  variant       TEXT NOT NULL,      -- 'A' | 'B'
  assignedAt    TEXT NOT NULL,
  PRIMARY KEY (userId, experimentKey)
);

-- Schema migration state (replaces pure IF NOT EXISTS lifecycle)
CREATE TABLE IF NOT EXISTS lms_schema_version (
  id            INTEGER PRIMARY KEY CHECK(id = 1),
  version       INTEGER NOT NULL,
  updatedAt     TEXT NOT NULL
);
```

---

## 5. File Storage System

**Location:** `Backend/data/lms/{subjectCode}/{type}/{filename}`

**Served via:** Existing Nginx `/files/` route — zero new infrastructure.

**Limits:**
- Max file size: **25 MB per upload**
- Max total storage per user: **200 MB** (soft limit, checked at upload time)
- Max uploads per day per user: **10**

**MIME type validation (server-side `multer` fileFilter, never just extension):**

| Extension | Accepted MIME |
|-----------|--------------|
| `.pdf` | `application/pdf` |
| `.zip` | `application/zip` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.txt` | `text/plain` |
| `.md` | `text/markdown`, `text/plain` |
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |

**Duplicate detection:** SHA-256 hash computed at upload, checked against `fileHash` column. Exact match → blocked with link to existing resource. Same title + same subject → warning shown, upload allowed if user confirms they have a different version.

**On re-upload:** Previous file retained on disk; new file becomes active. History is auditable.

**Abuse controls (in addition to flags):**
- Per-endpoint rate limits (upload, comment, flag, request creation)
- Heuristic block rules (example: `>=10 uploads in 5 minutes` → temporary upload block)
- Cooldown response payload returns unblock time and reason

---

## 6. Smart Rendering System

`renderType` is computed once at save time and stored on the resource row:

| Detection Rule | renderType | Frontend Behavior |
|----------------|------------|-------------------|
| YouTube URL pattern | `youtube` | Embedded `<iframe>` player |
| URL ending `.pdf` | `pdf-link` | In-browser PDF viewer |
| Any other URL | `external` | Preview card + Open button |
| file, PDF MIME | `pdf-file` | PDF.js viewer |
| file, other MIME | `file-download` | Download card + file info |
| `note` type | `note` | Rendered tiptap HTML |
| `quiz` type | `quiz` | Interactive quiz runner |
| `flashcard` type | `flashcard` | Flip-card deck |
| `pyq` type | `pyq` | PDF viewer + PYQ metadata header (year, type, month) |

**Reading time estimation (computed at upload, stored as `estimatedMinutes`):**
- Notes / guides: `wordCount ÷ 200` (average reading speed in wpm)
- PDF files: `pageCount × 2` minutes
- YouTube links: video duration extracted from YouTube oEmbed API (one HTTP GET at upload, no API key required for duration)
- Other links: 5 minutes default

Shown on resource cards as "~8 min read" and on resource detail pages.

---

## 7. Quality & Scoring Systems

### 7.1 Quality Score

```
qualityScore =
  (ratingAvg * log(1 + ratingCount))
  + log(1 + upvotes)
  + (bookmarkCount * 0.5)
  + (examProvenScore * 2.0)   // exam-proven resources weighted heavily
```

Recomputed and stored on every engagement event. Used for sorting and ranking.

### 7.2 Exam Proven Score

```
examProvenScore = (helpfulVotes / totalVotes) * log(1 + totalVotes)
```

Where votes come from `lms_exam_feedback`. Resources with `examProvenScore > 2.0` display a permanent **"Exam Proven ✓"** badge.

### 7.3 Resource Effectiveness Score (Phase 9+)

Tracks whether viewing a resource actually improves quiz performance on related topics. Updated incrementally when a user takes a quiz on the same topic after viewing a resource. This metric is collected early, but only promoted as a ranking factor after enough sample size exists.

### 7.4 Staleness System

Two separate mechanisms — neither removes content:

**Community-driven ("Mark as Outdated"):**
- Any user can click "Mark as Outdated" with optional reason
- Stored in `lms_outdated_marks` (one per user per resource)
- When `outdatedCount >= 3`: `isOutdated = 1` → yellow **"⚠️ May be outdated"** badge displayed
- Creator sees all marks and can acknowledge / update the resource to clear them

**Automatic age warning (system-driven):**
- Resources with `uploadedAt > 2 years ago` AND `viewCount < 10 in last 6 months` → display **"Last active 2+ years ago"** note
- This is a display-only note, not a moderation action

### 7.5 Moderation Thresholds

| Flag Count | moderationState | Visible to |
|------------|-----------------|-----------|
| 0 | 0 (visible) | Everyone |
| 1 | 1 (suspicious) | Everyone + yellow badge |
| 2–3 | 2 (hidden) | Creator only |
| 5+ | 3 (removed) | Nobody |

One flag per user per resource. Creator can see their own hidden resources.

---

## 8. ERP Cross-Linking

This is the feature no external LMS can replicate — LMS content surfaces inside ERP pages at exactly the moment students are thinking about that subject.

### 8.1 Attendance Details Page (`/academic/attendance-details`)

Each subject row in `AttendanceDetailsPage.tsx` gains a small **"📚 Resources"** chip linking to `/resources/browse?subjectCode={code}`. The `subjectCode` already exists in the `AttendanceModel` from the ERP transformer — zero extra backend calls.

### 8.2 Timetable Page (`/academic/timetable`)

Today's class slots in `TimetablePage.tsx` gain a subtle **"Study →"** chip linking to `/resources/subject/{code}`. Implemented by reading `subject.code` from the existing `TimetableModel`.

### 8.3 Dashboard Subject Cards

The dashboard's attendance widget subject cards get an **"LMS"** shortcut button.

### 8.4 Implementation Note

All three cross-links are pure frontend additions — a small `<Link>` component added to three existing files. No new API routes. No backend changes. The LMS browse page already accepts `subjectCode` as a query parameter.

---

## 9. Recommendation Engine

### 9.1 Scoring Formula

```
**Phase 9a (default):**
```
score =
  subjectMatch(user, resource)     * w1
+ typePreference(user, resource)   * w2
+ qualityScore(resource)           * w3
+ recency(resource)                * w4
+ topicGapScore(user, resource)    * w5
+ examProvenScore(resource)        * w6
```

**Phase 9c (after enough data):**
```
score =
  subjectMatch(user, resource)     * w1
+ typePreference(user, resource)   * w2
+ qualityScore(resource)           * w3
+ recency(resource)                * w4
+ effectivenessScore(resource)     * w5  // enabled only when sample size threshold met
+ topicGapScore(user, resource)    * w6
+ examProvenScore(resource)        * w7
```

Initial weights (9a): `[0.28, 0.18, 0.22, 0.12, 0.1, 0.1]`. Per-user, adaptive.

### 9.2 Adaptive Weight Updates

On user **click/engagement:**
```
w_i += learning_rate * (1 - w_i)
```
On **ignore** (shown but not clicked):
```
w_i -= learning_rate * w_i
```
`learning_rate = 0.05`. Weights normalized to sum to 1 after each update.

### 9.3 Bandit-Based Exploration

```
80% of recommendations → highest-scoring known content
20%                    → randomly sampled unseen content
```
If exploration slot is engaged → promoted to 80% pool.

### 9.3.1 A/B Testing Support

Bandit behavior and ranking weight sets can be toggled via `lms_feature_flags`, with stable user assignment stored in `lms_experiments`:
- Group A: baseline ranking
- Group B: candidate ranking

Shadow ranking runs in parallel through `lms_ranking_shadow` and is logged without changing what users see.

### 9.4 Cold Start Profile

On first LMS login, optional onboarding (dismissible):
- Which subjects are you currently studying?
- Preferred format (video / reading / practice)?
- Experience level: beginner / intermediate / advanced?

Profile bootstrapped from answers, refined by behavior.

### 9.5 Request-Driven Boost

When a resource is uploaded to fulfill a request (`fulfilledResourceId` set on an open request), that resource gets a temporary +20% quality score boost for 48 hours — surfacing fulfilled community requests prominently in browse and recommendations.

### 9.6 Recommendation Types

| Type | Algorithm | Where Shown |
|------|-----------|-------------|
| Personalized | Adaptive 7-factor formula | Home, Browse |
| Next Step | Knowledge graph traversal | After completing resource |
| Fill Gap | Low mastery topics | Progress page |
| Related | Same subject + unit + tags | Resource detail |
| Trending | Interaction velocity (7-day window) | Explore page |
| Top Rated | Sorted by qualityScore | Subject overview |
| Exam Ready | High examProvenScore for enrolled subjects | Home (near exam periods) |
| Unfulfilled Requests | Open requests matching user's subjects | Browse, Home |

---

## 10. Progress & Learning Systems

### 10.1 Mastery Model

```
mastery = w1 * normalizedQuizScore
        + w2 * interactionScore
        + w3 * revisionScore
```

Weights adapt over time using same feedback loop as recommendations. Mastery states: Not Started (0–0.3), Learning (0.3–0.6), Proficient (0.6–0.8), Mastered (0.8–1.0).

### 10.2 Knowledge Gap Detection

Triggered when a user accesses topic T with incomplete prerequisite P (mastery < 0.4). Surfaces inline banner: "You may want to review [P] first" with link to top resource for P.

Cross-subject gaps via `crossSubjectLinks` are optional in early rollout and should not block recommendations until sufficient graph coverage exists.

### 10.3 Spaced Repetition (SM-2 Simplified)

```
After 1st review:  1 day
After 2nd:         3 days
After 3rd:         7 days
After 4th:         14 days
After 5th+:        30 days
```
Quiz score < 60% on revision → reset to 1-day interval.

### 10.4 Continue Learning

Tracks most recent incomplete activity per content type — last opened roadmap (first incomplete node), last opened guide (first unread section), last viewed resource in a unit. Shown prominently on LMS home page.

### 10.5 Streaks

Incremented once per calendar day (UTC) on any learning action. Milestone notifications at 3, 7, 14, 30, 60, 100 days.

### 10.6 Learning Sessions

User selects "Study for 30 minutes" or "Study for 1 hour." System generates a session plan:
- 1 concept (highest-gap topic in enrolled subjects)
- 2 resources (best quality for that topic, reading time fits within session)
- 1 quiz from question bank (if available)
- Estimated total time displayed before starting

One new endpoint (`POST /api/lms/session/generate`), no new tables.

### 10.7 Currently Studying Presence

Anonymous count shown on subject pages and resource cards: "🟢 14 students studying this subject today." Computed from `lms_user_interactions` where `createdAt > 24h ago` for that `subjectCode`. Fully anonymous — just a count, no names. One aggregated query, no new tables.

---

## 11. Backend Architecture

### 11.1 New Files

```
Backend/src/
  services/
    lmsStore.js                   ← core LMS data operations
    lmsRecommendationEngine.js    ← scoring + adaptation logic
    lmsInteractionTracker.js      ← async interaction recording
    lmsInteractionQueue.js        ← in-memory queue + batch writer (SQLite-safe)
    lmsModerationService.js       ← flag + outdated processing
    lmsRevisionScheduler.js       ← spaced repetition queue
    lmsExamFeedbackService.js     ← ERP result detection + feedback trigger
    lmsDuplicateDetector.js       ← file hash + title similarity checks
    lmsReadingTimeEstimator.js    ← estimatedMinutes at upload
    lmsMigrations.js              ← migration runner + schema version checks
    lmsFeatureFlagService.js      ← runtime flag + experiment assignment
  routes/
    lmsRoutes.js
  config/
    lmsMimeTypes.js
```

### 11.2 Key lmsStore.js Methods

```javascript
// Resources
createResource(userId, data)
// includes: duplicate check, hash compute, readingTime estimate,
// renderType detection, unit normalization

getResource(id, userId)
// includes: annotation state, bookmark state, upvote state, outdated state

getResources({ subjectCode, semester, unit, type, difficulty,
               tags, examYear, examType, examProven, page, limit, sort })

searchResources(query, filters, page, limit)
updateResource(id, userId, data)  
deleteResource(id, userId)         // soft delete
restoreResource(id, userId)
purgeResource(id, userId)         // admin-only hard delete
bulkResourceOperation(userId, operation, resourceIds, payload)
checkDuplicate(fileHash, title, subjectCode)

// PYQ
getPyqBank(subjectCode, { examYear, examType, page, limit })
getUpcomingExamPyqs(userId)       // for enrolled subjects with approaching exam dates

// Engagement
upvoteResource(resourceId, userId)
bookmarkResource(resourceId, userId)
flagResource(resourceId, userId, reason)
markOutdated(resourceId, userId, reason)
rateResource(resourceId, userId, rating, review, dimensionTags)
commentOnResource(resourceId, userId, content)

// Annotations
saveAnnotation(userId, resourceId, content)
getAnnotations(userId, resourceId)
deleteAnnotation(id, userId)

// Requests
createRequest(userId, data)
getRequests({ subjectCode, status, page, limit })
fulfillRequest(requestId, userId, resourceId)
upvoteRequest(requestId, userId)

// Exam feedback
submitExamFeedback(userId, feedbackItems)     // batch: [{resourceId, helpful}]
getPendingExamFeedback(userId)
recomputeExamProvenScore(resourceId)

// Collections
createCollection(userId, name, description, isPublic)
addToCollection(collectionId, resourceId, userId)
removeFromCollection(collectionId, resourceId, userId)

// Question bank
addQuestion(userId, data)
getQuestionBank(subjectCode, { unit, difficulty, page, limit })
buildQuizFromBank(subjectCode, unit, count, difficulty)

// Progress & mastery
markProgress(userId, resourceId, status)
getContinueLearning(userId)
updateTopicMastery(userId, topicId, quizScore)
getRevisionQueue(userId)
updateRevisionSchedule(userId, resourceId, score)

// Sessions & presence
generateLearningSession(userId, durationMinutes)
getCurrentlyStudyingCount(subjectCode)

// Streaks
recordActivity(userId)
getStreak(userId)

// Storage
checkUserStorageLimit(userId, fileSize)
updateUserStorage(userId, delta)

// Utilities
normalizeUnit(unit)
computeQualityScore(resourceId)
computeReadingTime(type, content, url)
```

### 11.3 Transaction Safety Standard

All multi-step critical writes run in explicit transactions (`BEGIN IMMEDIATE ... COMMIT`, rollback on error). Minimum required flows:
- File upload lifecycle: storage write + hash + metadata + row insert
- Resource update with version snapshot write
- Guide update with section updates + version snapshot write
- Request fulfillment: request state + resource linkage + notification event
- Bulk moderation actions

No partial writes should survive a failed critical operation.

---

## 12. API Reference (Complete)

### Standard Response and Error Envelope

All LMS endpoints return a unified shape:

```json
{ "success": true, "data": { "...": "..." } }
```

```json
{
  "success": false,
  "error": {
    "code": "LMS_RATE_LIMITED",
    "message": "Too many uploads. Please retry after 10 minutes."
  }
}
```

Status code consistency:
- `200/201`: success
- `400`: validation/input error
- `401/403`: auth/authz error
- `404`: not found (or soft-deleted and not owner/admin)
- `409`: conflict (duplicate, stale version)
- `429`: rate limit / abuse protection
- `500`: internal error

### Resources

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/resources` | List/filter with pagination |
| `GET` | `/api/lms/resources/:id` | Single resource with full context |
| `POST` | `/api/lms/resources` | Create (multipart for files, JSON for others) |
| `PUT` | `/api/lms/resources/:id` | Update own resource |
| `DELETE` | `/api/lms/resources/:id` | Soft delete own resource |
| `POST` | `/api/lms/resources/:id/restore` | Restore previously soft-deleted own resource |
| `POST` | `/api/lms/resources/bulk` | Bulk operations (delete, tag, moderation state) |
| `GET` | `/api/lms/resources/check-duplicate` | Pre-upload duplicate check |

**GET /api/lms/resources — query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `subjectCode` | string | Filter by subject |
| `semester` | string | Filter by semester |
| `unit` | string | Filter by unitNormalized |
| `type` | string | Filter by content type (including `pyq`) |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` |
| `tags` | string | Comma-separated tag filter |
| `examYear` | string | PYQ: exam year filter |
| `examType` | string | PYQ: mid-semester, end-semester, etc. |
| `examProven` | boolean | Only exam-proven resources |
| `query` | string | Full-text search |
| `sort` | string | `quality`, `recent`, `popular`, `effective`, `exam_proven` |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Per page (default: 20, max: 50) |

### Engagement

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/lms/resources/:id/upvote` | Toggle upvote |
| `POST` | `/api/lms/resources/:id/bookmark` | Toggle bookmark |
| `POST` | `/api/lms/resources/:id/flag` | Flag with reason |
| `POST` | `/api/lms/resources/:id/mark-outdated` | Mark as outdated |
| `POST` | `/api/lms/resources/:id/rate` | Rate with review + dimension tags |
| `POST` | `/api/lms/resources/:id/view` | Async queued view record |
| `GET` | `/api/lms/resources/:id/comments` | Get comments |
| `POST` | `/api/lms/resources/:id/comments` | Add comment |
| `POST` | `/api/lms/comments/:id/helpful` | Toggle helpful |

### Annotations (Private)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/resources/:id/annotations` | Get own annotations |
| `POST` | `/api/lms/resources/:id/annotations` | Save annotation |
| `DELETE` | `/api/lms/annotations/:id` | Delete annotation |

### PYQ Bank

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/pyq/:subjectCode` | All PYQs for a subject |
| `GET` | `/api/lms/pyq/upcoming` | PYQs for subjects with approaching exams |

### Resource Requests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/requests` | List requests (filterable) |
| `POST` | `/api/lms/requests` | Create request |
| `POST` | `/api/lms/requests/:id/upvote` | Upvote a request |
| `POST` | `/api/lms/requests/:id/fulfill` | Fulfill with a resource |
| `DELETE` | `/api/lms/requests/:id` | Close own request |

### Exam Feedback

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/exam-feedback/pending` | Resources pending feedback for current user |
| `POST` | `/api/lms/exam-feedback` | Submit batch of feedback votes |

### Quiz & Question Bank

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/lms/resources/:id/quiz-attempt` | Submit quiz attempt |
| `GET` | `/api/lms/resources/:id/quiz-attempts` | Own attempt history |
| `GET` | `/api/lms/question-bank` | Browse bank (filterable) |
| `POST` | `/api/lms/question-bank` | Contribute a question |
| `POST` | `/api/lms/question-bank/:id/upvote` | Upvote a question |
| `GET` | `/api/lms/question-bank/build-quiz` | Auto-generate quiz from bank |

### Collections

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/collections` | Own + public collections |
| `POST` | `/api/lms/collections` | Create |
| `GET` | `/api/lms/collections/:id` | Get with resources |
| `POST` | `/api/lms/collections/:id/items` | Add resource |
| `DELETE` | `/api/lms/collections/:id/items/:resourceId` | Remove |

### Guides

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/guides` | List guides |
| `POST` | `/api/lms/guides` | Create |
| `GET` | `/api/lms/guides/:id` | Get with sections + progress |
| `PUT` | `/api/lms/guides/:id` | Update |
| `POST` | `/api/lms/guides/:id/sections` | Add section |
| `PUT` | `/api/lms/guides/:id/sections/:sid` | Update section |
| `POST` | `/api/lms/guides/:id/sections/:sid/read` | Mark section read |
| `POST` | `/api/lms/guides/:id/upvote` | Toggle upvote |
| `GET` | `/api/lms/guides/:id/export` | Export as PDF |

### Roadmaps

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/roadmaps` | List roadmaps |
| `POST` | `/api/lms/roadmaps` | Create |
| `GET` | `/api/lms/roadmaps/:id` | Get with nodes + progress |
| `POST` | `/api/lms/roadmaps/:id/nodes` | Add node |
| `POST` | `/api/lms/roadmaps/:id/edges` | Add edge |
| `POST` | `/api/lms/roadmaps/:id/nodes/:nid/complete` | Mark complete |

### Discovery & Recommendations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/recommendations` | Personalized recommendations |
| `GET` | `/api/lms/recommendations/next-step` | Next step after current resource |
| `GET` | `/api/lms/explore` | Trending, New, Top Rated, Exam Proven sections |
| `GET` | `/api/lms/subjects/:code/overview` | Subject overview with top resources per unit |
| `GET` | `/api/lms/subjects/:code/presence` | Anonymous currently-studying count |
| `GET` | `/api/lms/topics/graph` | Topic prerequisite graph for subject |
| `GET` | `/api/lms/leaderboard/weekly` | Top contributors this week |

### Progress & Learning

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/progress` | Full progress summary |
| `GET` | `/api/lms/progress/:subjectCode` | Per-subject detail |
| `GET` | `/api/lms/mastery` | Topic mastery scores |
| `GET` | `/api/lms/continue` | Continue learning |
| `GET` | `/api/lms/revision` | Today's revision queue |
| `POST` | `/api/lms/revision/:resourceId/review` | Submit revision result |
| `GET` | `/api/lms/streak` | Streak info |
| `POST` | `/api/lms/session/generate` | Generate learning session plan |

### Profile & Contributions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/lms/me/contributions` | Own resources, guides, roadmaps |
| `GET` | `/api/lms/me/bookmarks` | Bookmarked resources |
| `GET` | `/api/lms/me/activity` | Interaction history |
| `GET` | `/api/lms/me/requests` | Own open requests |
| `PUT` | `/api/lms/me/preferences` | Update preferences |
| `GET` | `/api/lms/contributors/:userId` | Public contributor profile |
| `GET` | `/api/lms/me/export/:guideId` | Export own guide as PDF |

---

## 13. Frontend Architecture

### 13.1 Pages (Complete List)

All registered in `erpBlueprints.ts` with `sourceMode: "internal"`.

```
/resources                         → LmsHomePage.tsx
/resources/browse                  → BrowsePage.tsx
/resources/explore                 → ExplorePage.tsx
/resources/add                     → AddResourcePage.tsx
/resources/:id                     → ResourceDetailPage.tsx
/resources/subject/:code           → SubjectOverviewPage.tsx
/resources/subject/:code/pyq       → PYQBankPage.tsx
/resources/guides                  → GuidesListPage.tsx
/resources/guides/:id              → GuideReaderPage.tsx
/resources/guides/new              → GuideEditorPage.tsx
/resources/roadmaps                → RoadmapsListPage.tsx
/resources/roadmaps/:id            → RoadmapViewerPage.tsx
/resources/roadmaps/new            → RoadmapBuilderPage.tsx
/resources/quiz/:id                → QuizModePage.tsx
/resources/flashcards/:id          → FlashcardModePage.tsx
/resources/question-bank           → QuestionBankPage.tsx
/resources/requests                → RequestBoardPage.tsx
/resources/me/contributions        → MyContributionsPage.tsx
/resources/me/bookmarks            → SavedResourcesPage.tsx
/resources/me/collections          → CollectionsPage.tsx
/resources/me/progress             → ProgressPage.tsx
/resources/me/revision             → RevisionQueuePage.tsx
/resources/me/exam-feedback        → ExamFeedbackPage.tsx
```

### 13.2 Key Page Descriptions

**LmsHomePage** (`/resources`)
- Continue Learning section
- Personalized recommendations grid
- Exam Feedback prompt banner (dismissible, shown when results detected from ERP)
- Exam Ready resources strip (near exam periods)
- Today's revision reminder if items are due
- Open requests for user's enrolled subjects
- Streak display
- Quick-access: Browse, PYQ Bank, Request Board, Add Resource

**BrowsePage** (`/resources/browse`)
- Filters: Semester, Subject, Unit, Type (including PYQ), Difficulty, Tags, Exam Year, Exam Type, Exam Proven toggle
- Search bar (LIKE/indexed filtering early, FTS5 in usage-gated phase)
- Sort: Quality, Recent, Popular, Effective, Exam Proven
- Resource cards with reading time chip, outdated warning badge, exam-proven badge
- "Currently studying" count badge when a subject filter is active
- Load More / infinite scroll pagination

**PYQBankPage** (`/resources/subject/:code/pyq`)
- Grouped by exam year (2024, 2023, 2022, ...)
- Filter by exam type (mid-sem, end-sem, supplementary)
- Most downloaded PYQs at top
- Upload PYQ button pre-filling subjectCode and type=pyq

**RequestBoardPage** (`/resources/requests`)
- Open requests sorted by upvote count
- Filter by subject, resource type
- "Post a Request" button
- Fulfilled requests shown with green badge and link to resource
- "My Requests" tab

**ResourceDetailPage** (`/resources/:id`)
- Smart renderer per renderType (YouTube embed, PDF viewer, download card, etc.)
- Reading time estimate displayed
- Resource validity period shown if `validForSemester` is set
- Outdated warning banner if `isOutdated = 1`
- Exam Proven badge if `examProvenScore > 2.0`
- Engagement bar: upvote, bookmark, rate, flag, mark-outdated, share
- Personal Annotations panel (expandable, private, only visible to current user)
- Rating distribution chart + dimension tag frequency counts
- Comments section
- Related resources (same unit + tags)
- Next-step recommendation
- Open requests for same topic (bottom panel)

**QuizModePage** (`/resources/quiz/:id`)
- Mode toggle at top: **Practice Mode** | **Exam Simulation Mode**
- Practice Mode: one question at a time, immediate feedback + explanation shown
- Exam Simulation Mode: countdown timer, all questions accessible, score and explanations only revealed after submission
- Score summary → mastery update + revision schedule update

**QuestionBankPage** (`/resources/question-bank`)
- Browse questions filterable by subject, unit, difficulty
- Upvote individual questions
- Contribute a new question button
- "Build a Quiz from this Bank" — select count + difficulty → auto-generates a quiz resource

**ExamFeedbackPage** (`/resources/me/exam-feedback`)
- Triggered when ERP results are detected for current semester
- Cards for each resource the user interacted with this semester
- Thumbs up / Thumbs down per resource: "Helped in exam" / "Didn't help"
- Progress bar: X of Y rated
- Batch submit
- Skip button (can be done later from LMS home)

**SubjectOverviewPage** (`/resources/subject/:code`)
- "🟢 X students currently studying" badge
- Top resource per unit (by qualityScore)
- Exam Proven resources strip
- PYQ quick-access button (→ PYQBankPage)
- Open requests for this subject
- Topic mastery heatmap (user's mastery per topic in this subject)
- Knowledge gap alerts

### 13.3 ERP Page Modifications (Cross-Linking)

Three existing ERP page components get minimal frontend additions. No backend changes required.

**`AttendanceDetailsPage.tsx`** — Each row in the attendance table gets a small "📚 Resources" chip:
```tsx
<Link to={`/resources/browse?subjectCode=${record.subjectCode}`}>
  📚 Resources
</Link>
```

**`TimetablePage.tsx`** — Today's class slots in the timetable grid get a "Study →" chip:
```tsx
<Link to={`/resources/subject/${subject.code}`}>Study →</Link>
```

**`Dashboard.tsx`** — Subject summary cards in the attendance widget get an LMS button.

### 13.4 Shared Components

```
Frontend/src/components/lms/
  ResourceCard.tsx              ← reading time, badges, outdated warning, exam-proven
  ResourceGrid.tsx              ← responsive grid with pagination
  RenderYoutube.tsx
  RenderPdf.tsx
  RenderExternalLink.tsx
  RenderNote.tsx
  RenderPyq.tsx                 ← PDF viewer + PYQ metadata header (year/type/month)
  RatingStars.tsx
  DimensionTags.tsx
  MasteryBar.tsx
  TopicMasteryHeatmap.tsx
  FlipCard.tsx
  RoadmapGraph.tsx
  StreakCalendar.tsx
  RevisionCard.tsx
  QuizRunner.tsx                ← handles Practice and Exam Simulation modes
  GuideSection.tsx
  ResourceFilterPanel.tsx
  AnnotationPanel.tsx           ← private sticky notes, expandable
  RequestCard.tsx
  ExamFeedbackCard.tsx
  ReadingTimeChip.tsx           ← "~8 min read"
  ExamProvenBadge.tsx           ← "Exam Proven ✓"
  OutdatedWarning.tsx
  CurrentlyStudyingBadge.tsx    ← "🟢 12 students today"
  WeeklyLeaderboard.tsx
  DuplicateWarning.tsx          ← shown on upload when duplicate detected
  ValidityChip.tsx              ← shows validForSemester on resource cards
```

---

## 14. Contributor Reputation System

```
reputation =
  (uploads * 1)
  + (totalUpvotesReceived * 2)
  + (averageRating * 10 * uploadCount)
  + (guidesPublished * 5)
  + (roadmapsPublished * 10)
  + (requestsFulfilled * 8)
  + (examProvenResources * 15)     // exam-proven resources are heavily rewarded
  + (questionsContributed * 3)
```

**Weekly leaderboard:** Top 10 by reputation gain in the past 7 days. Visible on Explore page. Resets weekly. Keeps contribution competitive — early users don't permanently dominate the all-time list.

**Tiers:**

| Score | Tier | Badge |
|-------|------|-------|
| 0–49 | Newcomer | None |
| 50–199 | Contributor | Bronze |
| 200–499 | Active Contributor | Silver |
| 500–999 | Expert | Gold |
| 1000+ | Top Contributor | Platinum |

---

## 15. Feedback & Ratings System

Each resource, guide, and roadmap supports:
- **Star rating** (1–5) with optional written review
- **Dimension tags** (multi-select): `"Explains well"`, `"Exam useful"`, `"Great examples"`, `"Hard to follow"`, `"Outdated"`, `"Incomplete"`, `"Best for beginners"`, `"Practice-heavy"`
- **Post-exam retrospective** (thumbs up/down, separate from star ratings)
- Creator notified on each new rating

---

## 16. Notifications (Using Existing System)

| Trigger | Notification |
|---------|-------------|
| Upvote on your resource | "Your resource got an upvote" |
| New rating on your resource | "New rating on [title]" |
| New comment on your resource | "New comment on [title]" |
| Your resource marked outdated | "Someone marked [title] as outdated" |
| Your open request was fulfilled | "[User] uploaded a resource for your request" |
| You fulfilled someone's request | "Your resource was accepted as a fulfillment" |
| Resource reaches quality threshold | "Your resource is trending!" |
| Resource earns Exam Proven badge | "Your resource earned the Exam Proven badge!" |
| Revision items due today | "X items to revise today" |
| Streak milestone | "You're on a N-day streak!" |
| Knowledge gap detected | "Review [topic] before proceeding" |
| Exam feedback prompt | "Your semester results are in — rate your study resources" |

---

## 17. Search Strategy

**Phase 1:** SQLite `LIKE` across title, description, tags.

**Phase 2:** Keep indexed filtering primary (`subjectCode`, `type`, `unitNormalized`, `uploadedAt`, `qualityScore`) and fallback to `LIKE` when needed.

**Phase 3 (FTS5, usage-gated):**
```sql
SELECT r.*, bm25(lms_search) AS rank
FROM lms_search
JOIN lms_resources r ON r.rowid = lms_search.rowid
WHERE lms_search MATCH 'operating system scheduling'
ORDER BY rank;
```

**Unified search:** Resources + Guides + Roadmaps + Requests all in one endpoint, with result type tabs in the frontend.

**Query suggestions:** Autocomplete from existing tags and topic labels (client-side from first fetch).

**Exam-aware search:** When query matches a subject the user is enrolled in, PYQs for that subject float to the top of results during exam periods.

---

## 18. Caching Strategy

**Phase 1–2:** No cache. Pure SQLite reads.

**Phase 3+ (Redis):**

| Cache Key | TTL | Content |
|-----------|-----|---------|
| `lms:trending:{code}` | 60s | Trending resources per subject |
| `lms:top:{code}:{unit}` | 60s | Top resources per unit |
| `lms:explore` | 30s | Explore page sections |
| `lms:subject:{code}:overview` | 120s | Subject overview |
| `lms:presence:{code}` | 60s | Currently studying count |
| `lms:leaderboard:weekly` | 300s | Weekly contributor leaderboard |

---

## 19. Performance Rules

1. No N+1 queries — all cards come from a single `getResources()` call.
2. Interaction events are buffered through `lmsInteractionQueue.js` (in-memory queue, flush every X ms or on batch size), then batch-inserted into SQLite.
3. `qualityScore`, `examProvenScore`, `effectivenessScore` are denormalized — stored on the row, recomputed on events, never on read.
4. File hash computed once at upload, stored in `fileHash`, never recomputed.
5. `estimatedMinutes` computed once at upload, stored, never recomputed.
6. Indexes on all filter columns and all sort columns.
7. Pagination on all list endpoints (default: 20, max: 50).
8. SQLite runs in WAL mode with configured busy timeout for write-heavy periods.
9. Retention job runs daily: interactions/log-like tables older than 90 days are aggregated or archived.
10. Bulk endpoints process in chunks with transaction boundaries and failure reports.

### 19.1 Queue and Write Path Guardrails

- Default write path for high-frequency interactions: request thread only enqueues; worker flushes asynchronously.
- Flush policy: `every 250-500ms` or `batch size threshold` (whichever first).
- On flush failure: retry with exponential backoff, then write to dead-letter file/table.
- Future-ready: queue adapter can swap from in-memory to Redis without API changes.

### 19.2 Retention Policy (Baseline)

- `lms_user_interactions`: keep raw 90 days, aggregate older into daily summaries.
- Request/attempt/log analytics: keep 180 days raw unless compliance requires longer.
- Version tables: no auto-delete by default; optional compaction per resource/guide keeps latest N + milestone versions.

---

## 20. What Is NOT Being Built

| Item | Reason |
|------|--------|
| AI explanations or summaries | Not in scope; system must be deterministic |
| Auto-generated content | Not in scope |
| Faculty-only access control | Every student can contribute |
| Live collaboration (Google Docs style) | Separate complex subsystem |
| Video hosting | YouTube links with embedded player cover this |
| Real-time chat | Out of scope |
| Payment or premium features | Not applicable |
| Code execution sandbox | Requires separate infrastructure |
| Plagiarism detection algorithms | Community flagging covers this at human level |

---

## 21. Roadmap (Phase-by-Phase)

### Phase 1 — Core LMS

**Goal:** Browse, upload, discover. PYQ support, duplicate detection, ERP cross-links, and staleness system from day one.

**Deliverables:**
- `lms.sqlite` with: `lms_resources`, `lms_upvotes`, `lms_bookmarks`, `lms_flags`, `lms_outdated_marks`, `lms_user_storage`, `lms_ratings`, `lms_schema_version`, `lms_feature_flags` tables
- `lmsStore.js`, `lmsRoutes.js`, `multer` with MIME validation + 25 MB limit
- Migration runner (`lmsMigrations.js`) with incremental schema versions
- PYQ subtype with `examYear`, `examType`, `examMonth`, `fileHash`, `estimatedMinutes`, `exportable`, `validForSemester` columns
- Soft delete semantics on resources (restore supported)
- SHA-256 file hash computation + pre-upload duplicate detection endpoint
- Reading time estimation (`estimatedMinutes`) at upload
- YouTube oEmbed duration fetch for video reading time
- Unit normalization on every write
- `renderType` detection on every save
- Quality score updated on engagement events
- Per-endpoint rate limits + upload/comment abuse heuristics
- Transaction-protected critical write flows
- Moderation thresholds (1 suspicious, 2–3 hidden, 5+ removed)
- Staleness system: "Mark as Outdated" button + automatic age warning display
- ERP cross-links added to `AttendanceDetailsPage.tsx`, `TimetablePage.tsx`, `Dashboard.tsx`
- `BrowsePage.tsx` — all filters including PYQ, exam proven, reading time, outdated badges
- `AddResourcePage.tsx` — all types including PYQ, duplicate warning component, reading time preview
- `ResourceDetailPage.tsx` — smart renderer, outdated banner, annotations panel, exam-proven badge, validity chip
- `PYQBankPage.tsx`
- `MyContributionsPage.tsx`, `SavedResourcesPage.tsx`
- Deletion of the two existing broken pages

---

### Phase 2 — Engagement & Community

**Goal:** Resources feel alive. Comments, collections, annotations, and presence active.

**Deliverables:**
- `lms_comments`, `lms_comment_helpful`, `lms_collections`, `lms_collection_items` tables
- `lms_annotations` table + annotation panel on resource detail page
- Comments + helpful marks
- Collections with public sharing
- Rating dimension tags
- All notification triggers for Phase 1+2 events
- Contributor reputation score + public profile page
- Weekly leaderboard (`GET /api/lms/leaderboard/weekly`)
- "Currently studying" anonymous presence count on subject pages
- `CollectionsPage.tsx`, `ExplorePage.tsx`
- Interaction queue + batch write worker
- Search keeps indexed filters primary; defer FTS5 rollout until query volume justifies it
- `lms_user_interactions` table + async interaction tracker (`lmsInteractionTracker.js`)

---

### Phase 3 — Resource Request Board

**Goal:** Demand-driven content creation loop.

**Deliverables:**
- `lms_requests`, `lms_request_upvotes` tables
- Full request CRUD, upvoting, and fulfillment flow
- Request-fulfillment 48h quality score boost
- Reputation bonus for fulfilling requests
- Notification: requester notified on fulfillment
- `RequestBoardPage.tsx`
- Open requests surfaced on Subject Overview page and LMS Home
- "Related open requests" panel on ResourceDetailPage bottom

---

### Phase 4 — Guides & Roadmaps

**Goal:** Structured long-form learning content.

**Deliverables:**
- `lms_guides`, `lms_guide_sections`, `lms_guide_progress` tables
- `lms_roadmaps`, `lms_roadmap_nodes`, `lms_roadmap_edges`, `lms_roadmap_progress` tables
- `lms_guide_versions`, `lms_resource_versions` tables + rollback endpoints
- Guide CRUD + section management + per-section progress tracking
- Roadmap CRUD + node/edge management + prerequisite graph visualization
- `GuideReaderPage.tsx`, `GuideEditorPage.tsx`
- `RoadmapViewerPage.tsx`, `RoadmapBuilderPage.tsx`
- tiptap rich text editor integration
- `LmsHomePage.tsx` with Continue Learning section
- PDF export for guides (`GET /api/lms/guides/:id/export`)

---

### Phase 5 — Quizzes, Flashcards & Question Bank

**Goal:** Active learning and crowd-sourced practice questions.

**Deliverables:**
- `lms_quiz_attempts` table (with `mode` field for practice vs exam simulation)
- `lms_question_bank`, `lms_quiz_questions` tables
- Quiz builder: manual questions + "build from question bank" mode
- Quiz runner: Practice mode (immediate feedback + explanation) + Exam Simulation mode (timed, no feedback until end)
- Flashcard builder + flip mode with Easy / Hard / Again self-grading
- Question bank: browse, contribute, upvote, auto-build quiz
- `QuizModePage.tsx`, `FlashcardModePage.tsx`, `QuestionBankPage.tsx`
- Post-quiz mastery update hook
- Resource effectiveness score wired to quiz outcomes

---

### Phase 6 — Progress, Mastery & Retention

**Goal:** The system tracks and communicates learning progress.

**Deliverables:**
- `lms_progress`, `lms_topic_mastery`, `lms_subject_mastery`, `lms_streaks` tables
- `lms_topics`, `lms_resource_topics`, `lms_topic_prerequisites` tables (`crossSubjectLinks` optional at rollout)
- Topic mastery model with adaptive weights
- Subject mastery rollup
- Cross-subject knowledge gap detection via `crossSubjectLinks` (enabled behind feature flag after enough graph data)
- Streak system with milestone notifications
- Learning session generator
- `ProgressPage.tsx`, `SubjectOverviewPage.tsx`

---

### Phase 7 — Spaced Repetition & Revision

**Goal:** Users remember what they learn.

**Deliverables:**
- `lms_revision_queue` table
- SM-2 simplified SRS scheduler
- Revision mode: due items surface daily
- Reset on poor performance
- Revision due notifications
- `RevisionQueuePage.tsx`

---

### Phase 8 — Post-Exam Retrospective Feedback

**Goal:** Build the most unique quality signal possible — exam outcome-linked ratings.

**Deliverables:**
- `lms_exam_feedback` table
- `lmsExamFeedbackService.js` — daily poll against ERP `current-semester-results`
- Pending feedback detection and prompt surfacing
- `ExamFeedbackPage.tsx` — batch thumbs up/down UI
- Exam feedback prompt banner on LMS home (dismissible)
- `examProvenScore` computation and update
- "Exam Proven ✓" badge on qualifying resources
- `examProvenScore` added as w7 in recommendation formula
- `GET /api/lms/pyq/upcoming` — surfaces PYQs as exam periods approach

---

### Phase 9 — Recommendations (Static then Adaptive)

**Goal:** Users discover the right content. System improves over time.

**Deliverables:**
- `lms_user_preferences` table
- `lmsRecommendationEngine.js` with phase-gated formula (start simple, then expand)
- Cold-start onboarding flow
- Static recommendations (Phase 9a)
- Adaptive weight updates on click/ignore/complete (Phase 9b)
- Bandit-based 80/20 exploration/exploitation split (feature-flag controlled)
- `lms_resource_effectiveness` wired to quiz outcomes (not primary rank factor until sample threshold)
- A/B assignment + shadow ranking telemetry (`lms_experiments`, `lms_ranking_shadow`)
- All recommendation types: Personalized, Next Step, Fill Gap, Related, Trending, Exam Ready, Unfulfilled Requests

---

### Phase 10 — Analytics & Creator Dashboard

**Goal:** Contributors understand their impact.

**Deliverables:**
- Creator analytics page: views over time, upvotes, ratings, exam proven votes
- Weekly learning report per user (via notifications)
- Platform heatmap: most studied subjects and topics
- Drop-off analysis on guides and roadmaps
- Question bank analytics: most used, most upvoted questions
- Bulk moderation operations UI (bulk delete/tag/state updates)

---

### Phase 11 — Polish, Export & Scale

**Goal:** Platform feels production-complete.

**Deliverables:**
- Redis caching for all hot LMS endpoints
- Unified search across resources + guides + roadmaps + requests (tabbed results)
- `validForSemester` prominently displayed on resource cards
- Exam simulation mode fully polished
- Public user profiles with reputation tier, exam-proven count, contribution history
- PDF export for notes polished and accessible from profile
- Query suggestions autocomplete

---

### Roadmap Execution Guardrail

This plan intentionally separates **foundational reliability** (queueing, transactions, migrations, retention, abuse controls) from **advanced intelligence** (cross-subject graph depth, full-effectiveness ranking, heavy search optimization).  
If real usage data conflicts with assumptions, ship reliability first, delay complex ranking logic, and tune only against observed behavior.

---

## 22. New Dependency

One new backend dependency: **`multer`** (file upload handling with MIME type validation).

Everything else reuses existing platform capabilities: Nginx static serving, existing notification system, existing session/auth, ERP transformer pipeline, SQLite pattern, Redis.

---

## 23. Architecture Fit

```
Browser (React SPA)
  LmsHomePage, BrowsePage, PYQBankPage, RequestBoardPage,
  ExamFeedbackPage, QuestionBankPage, ...
  +
  AttendanceDetailsPage (ERP, now with LMS cross-links)
  TimetablePage (ERP, now with LMS cross-links)
  Dashboard (ERP, now with LMS cross-links)
       │
       │ fetch('/api/lms/...', { credentials: 'include' })
       ▼
Express Backend (:5000)
  lmsRoutes.js
       │
       ▼
  lmsStore.js                   ←→  lms.sqlite
  lmsRecommendationEngine.js
  lmsInteractionTracker.js
  lmsInteractionQueue.js        (batch flush worker)
  lmsModerationService.js
  lmsRevisionScheduler.js
  lmsExamFeedbackService.js     (daily check vs ERP results)
  lmsDuplicateDetector.js
  lmsReadingTimeEstimator.js
  lmsMigrations.js              (schema versioned migrations)
  lmsFeatureFlagService.js      (runtime rollout + A/B assignment)
       │
       ├── ERP curriculum transformer   (subject/semester data)
       ├── ERP current-semester-results (exam feedback trigger)
       ├── ERP timetable + attendance   (cross-link source, frontend only)
       ├── Existing notification system (eventsStore.js)
       ├── Nginx /files/ route          (file serving, no changes)
       └── Redis                        (Phase 11 caching)
```

---

## 24. Decision Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Who can upload | Any authenticated student | Internal platform; accounts are traceable |
| File storage | `Backend/data/lms/` filesystem | Mirrors events gallery; no new infrastructure |
| MIME validation | Server-side `multer` fileFilter | Extension-only check is trivially bypassed |
| Subject source | ERP curriculum transformer | Always accurate; zero maintenance |
| Unit handling | Free text + normalized shadow field | Flexible entry + clean filtering |
| Delete strategy | Soft delete by default (`isDeleted`) | Auditability, rollback, moderation safety |
| Versioning | `lms_resource_versions` + `lms_guide_versions` snapshots | Safe edits + rollback support |
| Transactions | Explicit transaction-wrapped critical flows | Avoid partial write corruption |
| Migrations | `lms_schema_version` + ordered migration runner | Safe schema evolution over time |
| Abuse control | Endpoint rate limits + heuristic temporary blocks | Prevent spam/bot-like behavior beyond flags |
| Moderation | Threshold-based flag states, no admin queue | Simple, sufficient for internal community |
| Outdated marking | Separate from flags | Different semantic: age/accuracy vs abuse |
| Flagging | One per user per resource | Prevents coordinated mass-flagging |
| PYQ as subtype | Dedicated `type='pyq'` with metadata columns | Highest-value resource type for Indian university students |
| Duplicate detection | SHA-256 hash + title similarity warning | Prevents same PDF uploaded 15 times |
| Reading time | Computed once at upload, stored in `estimatedMinutes` | Never recomputed; helps students plan sessions |
| Staleness | Community votes + automatic age warning | Community knows best; automatic as backstop |
| Annotations | Private per-user per-resource, never shared | Personal study tool; like marginalia |
| Request board | Upvote-ranked, fulfillment linked to resource | Demand-driven contribution is more reliable |
| Exam feedback | Detected from ERP results, batch thumbs up/down | Unique ERP integration; creates signal no external LMS can have |
| examProvenScore | Separate from qualityScore, weighted in recommendations | Different semantic meaning; deserves own influence weight |
| ERP cross-links | Pure frontend additions to existing pages | Zero backend cost; maximum discoverability |
| Question bank | Shared per-subject, reusable across quizzes | Accelerates quiz creation; builds crowd-sourced practice pool |
| Cross-subject links | `crossSubjectLinks` JSON on `lms_topics` (feature-flagged initially) | Valuable long-term, non-blocking early |
| Exam simulation mode | UI-only toggle on QuizModePage | No backend schema changes; same attempt model |
| Presence count | Aggregated from interactions, fully anonymous | Social proof; no privacy concerns |
| Weekly leaderboard | 7-day window, not all-time | Keeps contribution competitive; early users don't dominate |
| Pagination | Page-based (page + limit) with total count | Simple to implement and understand |
| Recommendation start | Simple ranking first (`quality + exam signals`), then expand | Avoid noisy early signals and over-tuning |
| Adaptive ML | Feedback loop + bandit, no model training | Self-improving without ops overhead |
| AI features | None | Deterministic system preferred |
| Guides/Roadmaps | Separate tables from resources | Different data shape, different query patterns |
| Mastery model | Weighted formula with adaptive weights | Simple start; improves with behavior signal |
| Spaced repetition | SM-2 simplified | Proven algorithm; simple to implement |
| New dependencies | `multer` only | Minimal footprint |
