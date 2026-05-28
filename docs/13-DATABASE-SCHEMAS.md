# 13 — Database Schemas

## Overview

The system uses **10 SQLite databases** + 2 JSON file stores + 1 in-memory store + 1 Redis cache. All SQLite databases use `node:sqlite` (`DatabaseSync`) with `PRAGMA busy_timeout = 5000` and `PRAGMA foreign_keys = ON`.

---

## 13.1 Career Database (`career.db`)

16 tables + 1 FTS5 virtual table. Managed by `CareerStore` in `Backend/src/services/careerStore.js`.

### Table: `career_opportunities`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `type` | TEXT | NOT NULL, CHECK(IN 'job','internship','hackathon','competition','fellowship','workshop') | Opportunity type |
| `title` | TEXT | NOT NULL | Opportunity title |
| `company` | TEXT | | Company name |
| `organizer` | TEXT | | Organizer (for hackathons/etc.) |
| `description` | TEXT | | Long description |
| `shortDescription` | TEXT | | Short blurb |
| `requirements` | TEXT | | Requirements text |
| `skills` | TEXT | DEFAULT '[]' | JSON array of skills |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `location` | TEXT | | Location |
| `mode` | TEXT | CHECK(IN 'remote','onsite','hybrid','online','offline') | Work mode |
| `isPanIndia` | INTEGER | DEFAULT 0 | Pan-India eligibility |
| `eligibleBranches` | TEXT | DEFAULT '[]' | JSON array of branches |
| `eligibleYears` | TEXT | DEFAULT '[]' | JSON array of years |
| `minCGPA` | REAL | | Minimum CGPA requirement |
| `stipend` | TEXT | | Stipend description |
| `prize` | TEXT | | Prize description |
| `isFree` | INTEGER | DEFAULT 1 | Free to participate |
| `postedAt` | TEXT | | Posted date ISO |
| `deadline` | TEXT | | Application deadline ISO |
| `startDate` | TEXT | | Start date ISO |
| `duration` | TEXT | | Duration description |
| `source` | TEXT | NOT NULL | Source identifier (internshala, devfolio, etc.) |
| `sourceUrl` | TEXT | NOT NULL, UNIQUE | Original source URL |
| `sources` | TEXT | DEFAULT '[]' | JSON array of all source URLs |
| `fingerprint` | TEXT | | SHA-256 dedup fingerprint |
| `applyUrl` | TEXT | | Application URL |
| `viewCount` | INTEGER | DEFAULT 0 | View count |
| `bookmarkCount` | INTEGER | DEFAULT 0 | Bookmark count |
| `applyCount` | INTEGER | DEFAULT 0 | Apply count |
| `relevanceScore` | REAL | DEFAULT 0 | ML relevance score |
| `isActive` | INTEGER | DEFAULT 1 | Active flag |
| `isVerified` | INTEGER | DEFAULT 0 | Verified by admin |
| `isFeatured` | INTEGER | DEFAULT 0 | Featured/pinned |
| `moderationState` | INTEGER | DEFAULT 0 | Moderation state |
| `scrapedAt` | TEXT | NOT NULL | Scrape timestamp |
| `updatedAt` | TEXT | | Last update |
| `status` | TEXT | DEFAULT 'active' | Lifecycle status |
| `expiredAt` | TEXT | | Automatic expiry timestamp |
| `archivedAt` | TEXT | | Archive timestamp |

**Indexes:** `type`, `deadline`, `isActive`, `source`, `postedAt DESC`, `relevanceScore DESC`, `fingerprint`, `(deadline, isActive)`.

### Table: `career_bookmarks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `opportunityId` | TEXT | NOT NULL, PK | FK to career_opportunities |
| `userId` | TEXT | NOT NULL, PK | User register number |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `career_applications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `opportunityId` | TEXT | NOT NULL | FK to career_opportunities |
| `userId` | TEXT | NOT NULL | User register number |
| `status` | TEXT | DEFAULT 'applied' | Application status |
| `appliedAt` | TEXT | NOT NULL | Applied timestamp |
| `notes` | TEXT | | User notes |
| `updatedAt` | TEXT | | Last update |

**Index:** `userId`.

### Table: `career_flags`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `opportunityId` | TEXT | NOT NULL | FK to career_opportunities |
| `userId` | TEXT | NOT NULL | Flagging user |
| `reason` | TEXT | | Flag reason |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (opportunityId, userId) | | One flag per user per opp |

### Table: `career_dismissals`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `opportunityId` | TEXT | NOT NULL, PK | FK to career_opportunities |
| `userId` | TEXT | NOT NULL, PK | User register number |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `career_views`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `opportunityId` | TEXT | NOT NULL, PK | FK to career_opportunities |
| `userId` | TEXT | NOT NULL, PK | User register number |
| `viewedAt` | TEXT | NOT NULL | Timestamp |

### Table: `career_submissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submittedBy` | TEXT | NOT NULL | User register number |
| `status` | TEXT | DEFAULT 'pending' | `pending`, `approved`, `rejected` |
| `reviewedAt` | TEXT | | Review timestamp |
| `reviewedBy` | TEXT | | Reviewer register number |
| `reviewReason` | TEXT | | Review notes |
| `publishedOpportunityId` | TEXT | | FK if approved into career_opportunities |
| `fingerprint` | TEXT | | Dedup fingerprint |
| `type` | TEXT | NOT NULL | Opportunity type |
| `title` | TEXT | NOT NULL | Opportunity title |
| `company` | TEXT | | Company |
| `organizer` | TEXT | | Organizer |
| `description` | TEXT | | Description |
| `skills` | TEXT | DEFAULT '[]' | JSON array |
| `tags` | TEXT | DEFAULT '[]' | JSON array |
| `location` | TEXT | | Location |
| `mode` | TEXT | | Work mode |
| `eligibleBranches` | TEXT | DEFAULT '[]' | JSON array |
| `eligibleYears` | TEXT | DEFAULT '[]' | JSON array |
| `stipend` | TEXT | | Stipend |
| `prize` | TEXT | | Prize |
| `deadline` | TEXT | | Deadline ISO |
| `startDate` | TEXT | | Start date ISO |
| `applyUrl` | TEXT | NOT NULL | Application URL |
| `createdAt` | TEXT | NOT NULL | Submission timestamp |

**Indexes:** `(status, createdAt DESC)`, `(submittedBy, createdAt DESC)`, `fingerprint`.

### Table: `career_submission_audit`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submissionId` | TEXT | NOT NULL | FK to career_submissions |
| `action` | TEXT | NOT NULL | Audit action |
| `actorId` | TEXT | NOT NULL | Actor register number |
| `fromStatus` | TEXT | | Previous status |
| `toStatus` | TEXT | | New status |
| `reason` | TEXT | | Reason |
| `metadata` | TEXT | DEFAULT '{}' | JSON metadata |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Index:** `(submissionId, createdAt DESC)`.

### Table: `career_scraper_runs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `source` | TEXT | NOT NULL | Source name |
| `startedAt` | TEXT | NOT NULL | Start timestamp |
| `completedAt` | TEXT | | Completion timestamp |
| `status` | TEXT | DEFAULT 'running' | `running`, `completed`, `failed` |
| `newCount` | INTEGER | DEFAULT 0 | New opportunities found |
| `updatedCount` | INTEGER | DEFAULT 0 | Updated opportunities |
| `expiredCount` | INTEGER | DEFAULT 0 | Expired opportunities |
| `errorMessage` | TEXT | | Error if failed |
| `durationMs` | INTEGER | | Run duration in ms |

### Table: `career_source_health`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `source` | TEXT | PK | Source name |
| `lastSuccess` | TEXT | | Last successful run ISO |
| `lastAttempt` | TEXT | | Last attempt ISO |
| `consecutiveFails` | INTEGER | DEFAULT 0 | Consecutive failure count |
| `isBlocked` | INTEGER | DEFAULT 0 | Circuit breaker state |
| `notes` | TEXT | | Notes |

### Table: `career_profiles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | PK | User register number |
| `skills` | TEXT | DEFAULT '[]' | JSON array |
| `preferredTypes` | TEXT | DEFAULT '[]' | JSON array |
| `preferredLocations` | TEXT | DEFAULT '[]' | JSON array |
| `minStipend` | TEXT | | Minimum stipend expectation |
| `cgpa` | REAL | | CGPA |
| `bio` | TEXT | | Bio |
| `linkedinUrl` | TEXT | | LinkedIn URL |
| `githubUrl` | TEXT | | GitHub URL |
| `portfolioUrl` | TEXT | | Portfolio URL |
| `resumeUrl` | TEXT | | Resume URL |
| `resumeFileName` | TEXT | | Resume filename |
| `updatedAt` | TEXT | NOT NULL | Last update |

### Table: `career_skill_gaps`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User register number |
| `skill` | TEXT | NOT NULL, PK | Skill name |
| `opportunityCount` | INTEGER | DEFAULT 0 | Number of opportunities requiring this skill |
| `updatedAt` | TEXT | NOT NULL | Last update |

### Table: `career_alumni`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | Alumni user ID |
| `name` | TEXT | NOT NULL | Full name |
| `email` | TEXT | NOT NULL | Email |
| `batch` | TEXT | NOT NULL | Graduation batch/year |
| `branch` | TEXT | NOT NULL | Branch/department |
| `company` | TEXT | | Current company |
| `position` | TEXT | | Current position |
| `location` | TEXT | | Location |
| `linkedinUrl` | TEXT | | LinkedIn profile |
| `bio` | TEXT | | Bio |
| `skills` | TEXT | DEFAULT '[]' | JSON array |
| `isAvailableForMentoring` | INTEGER | DEFAULT 0 | Mentoring availability |
| `createdAt` | TEXT | NOT NULL | Creation timestamp |
| `updatedAt` | TEXT | NOT NULL | Last update |

### Table: `career_interview_slots`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `interviewerId` | TEXT | NOT NULL | Interviewer user ID |
| `interviewerName` | TEXT | NOT NULL | Interviewer display name |
| `date` | TEXT | NOT NULL | Slot date ISO |
| `startTime` | TEXT | NOT NULL | Start time ISO |
| `endTime` | TEXT | NOT NULL | End time ISO |
| `duration` | INTEGER | NOT NULL | Duration in minutes |
| `type` | TEXT | NOT NULL, CHECK(IN 'mock','technical','behavioral','system_design') | Interview type |
| `isBooked` | INTEGER | DEFAULT 0 | Booking status |
| `bookedBy` | TEXT | | Booked by user ID |
| `bookedByName` | TEXT | | Booked by display name |
| `notes` | TEXT | | Slot notes |
| `createdAt` | TEXT | NOT NULL | Creation timestamp |
| `updatedAt` | TEXT | NOT NULL | Last update |

### Table: `career_interview_bookings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `slotId` | TEXT | NOT NULL | FK to career_interview_slots |
| `studentId` | TEXT | NOT NULL | Student user ID |
| `studentName` | TEXT | NOT NULL | Student display name |
| `interviewerId` | TEXT | NOT NULL | Interviewer user ID |
| `interviewerName` | TEXT | NOT NULL | Interviewer display name |
| `date` | TEXT | NOT NULL | Booking date ISO |
| `startTime` | TEXT | NOT NULL | Start time ISO |
| `endTime` | TEXT | NOT NULL | End time ISO |
| `type` | TEXT | NOT NULL | Interview type |
| `status` | TEXT | DEFAULT 'confirmed', CHECK(IN 'confirmed','completed','cancelled','no_show') | Booking status |
| `notes` | TEXT | | Notes |
| `feedback` | TEXT | | Interview feedback |
| `rating` | INTEGER | | Rating 1-5 |
| `createdAt` | TEXT | NOT NULL | Creation timestamp |
| `updatedAt` | TEXT | NOT NULL | Last update |

**Foreign key:** `slotId → career_interview_slots(id)`.

### Table: `career_notification_log`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User register number |
| `kind` | TEXT | NOT NULL, PK | Notification kind |
| `refKey` | TEXT | NOT NULL, PK | Reference key (opportunity ID, etc.) |
| `sentDay` | TEXT | NOT NULL, PK | Date string (YYYY-MM-DD) |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Virtual Table: `career_search` (FTS5)

```sql
CREATE VIRTUAL TABLE career_search USING fts5(
  title, description, skills, tags, company, organizer,
  content='career_opportunities',
  content_rowid='rowid'
);
```

---

## 13.2 LMS Database (`lms.db`)

~40 tables across 2 migration versions. Managed by `LmsStore` in `Backend/src/services/lmsStore.js` with migrations in `Backend/src/services/lmsMigrations.js`.

### Table: `lms_resources`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `type` | TEXT | NOT NULL, CHECK(IN 'link','file','note','quiz','flashcard','pyq') | Resource type |
| `title` | TEXT | NOT NULL | Title |
| `description` | TEXT | | Description |
| `difficulty` | TEXT | CHECK(IN 'beginner','intermediate','advanced') | Difficulty level |
| `semester` | TEXT | NOT NULL | Semester |
| `subjectCode` | TEXT | NOT NULL | Subject code |
| `subjectName` | TEXT | NOT NULL | Subject name |
| `unit` | TEXT | NOT NULL | Unit number/name |
| `unitNormalized` | TEXT | NOT NULL | Normalized unit key |
| `tags` | TEXT | DEFAULT '[]' | JSON array of tags |
| `uploadedBy` | TEXT | NOT NULL | Uploader user ID |
| `uploadedAt` | TEXT | NOT NULL | Upload timestamp |
| `updatedAt` | TEXT | | Last update |
| `url` | TEXT | | External URL (for type='link') |
| `filePath` | TEXT | | Local file path |
| `fileSize` | INTEGER | | File size in bytes |
| `fileHash` | TEXT | | SHA-256 file hash |
| `mimeType` | TEXT | | MIME type |
| `noteContent` | TEXT | | Markdown note content |
| `structuredContent` | TEXT | | JSON structured content |
| `examYear` | TEXT | | Exam year |
| `examType` | TEXT | CHECK(IN 'mid-semester','end-semester','supplementary','model') | Exam type |
| `examMonth` | TEXT | | Exam month |
| `exportable` | INTEGER | DEFAULT 1 | Allow PDF export |
| `validForSemester` | TEXT | | Semester validity |
| `estimatedMinutes` | INTEGER | | Estimated reading time |
| `viewCount` | INTEGER | DEFAULT 0 | View count |
| `upvotes` | INTEGER | DEFAULT 0 | Upvote count |
| `bookmarkCount` | INTEGER | DEFAULT 0 | Bookmark count |
| `commentCount` | INTEGER | DEFAULT 0 | Comment count |
| `qualityScore` | REAL | DEFAULT 0 | Quality score (0-1) |
| `effectivenessScore` | REAL | DEFAULT 0 | Learning effectiveness score |
| `examProvenScore` | REAL | DEFAULT 0 | Exam relevance score |
| `renderType` | TEXT | | Render hint for frontend |
| `outdatedCount` | INTEGER | DEFAULT 0 | Outdated mark count |
| `isOutdated` | INTEGER | DEFAULT 0 | Outdated flag |
| `flagCount` | INTEGER | DEFAULT 0 | Flag count |
| `moderationState` | INTEGER | DEFAULT 0 | 0=visible, 1=hidden, 2=removed |
| `flagReason` | TEXT | | Most recent flag reason |
| `verified` | INTEGER | DEFAULT 0 | Verified by admin |
| `isDeleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deletedAt` | TEXT | | Deletion timestamp |
| `deletedBy` | TEXT | | Deleter user ID |

**Indexes:** `subjectCode`, `semester`, `type`, `unitNormalized`, `uploadedBy`, `qualityScore DESC`, `uploadedAt DESC`, `upvotes DESC`, `moderationState`, `fileHash`, `isDeleted`, `(subjectCode, examYear) WHERE type = 'pyq'`.

### Table: `lms_upvotes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `userId` | TEXT | NOT NULL, PK | User ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_bookmarks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `userId` | TEXT | NOT NULL, PK | User ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_flags`

Version 1 columns:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `userId` | TEXT | NOT NULL | Flagging user |
| `reason` | TEXT | | Reason |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (resourceId, userId) | | One flag per user per resource |

Version 2 additions:

| `status` | TEXT | DEFAULT 'open' | `open`, `resolved` |
| `resolvedAt` | TEXT | | Resolution timestamp |
| `resolvedBy` | TEXT | | Resolver user ID |

**Indexes:** `(resourceId, status)`, `(userId, createdAt)`.

### Table: `lms_outdated_marks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `userId` | TEXT | NOT NULL, PK | User ID |
| `reason` | TEXT | | Reason |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_comments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `userId` | TEXT | NOT NULL | Commenter user ID |
| `content` | TEXT | NOT NULL | Comment body |
| `helpful` | INTEGER | DEFAULT 0 | Helpful count |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | | Last edit |

### Table: `lms_comment_helpful`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `commentId` | TEXT | NOT NULL, PK | FK to lms_comments |
| `userId` | TEXT | NOT NULL, PK | User ID |

### Table: `lms_ratings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `userId` | TEXT | NOT NULL, PK | User ID |
| `rating` | INTEGER | NOT NULL, CHECK(1-5) | Rating 1-5 |
| `review` | TEXT | | Review text |
| `dimensionTags` | TEXT | DEFAULT '[]' | JSON array |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_annotations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | User ID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `content` | TEXT | NOT NULL | Annotation content |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | | Last edit |

**Index:** `(userId, resourceId)`.

### Table: `lms_collections`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | Owner user ID |
| `name` | TEXT | NOT NULL | Collection name |
| `description` | TEXT | | Description |
| `isPublic` | INTEGER | DEFAULT 0 | Public visibility |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_collection_items`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `collectionId` | TEXT | NOT NULL, PK | FK to lms_collections |
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `addedAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_requests`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | Requester user ID |
| `subjectCode` | TEXT | NOT NULL | Subject code |
| `subjectName` | TEXT | NOT NULL | Subject name |
| `semester` | TEXT | NOT NULL | Semester |
| `unit` | TEXT | | Unit |
| `title` | TEXT | NOT NULL | Request title |
| `description` | TEXT | | Description |
| `resourceType` | TEXT | | Requested resource type |
| `status` | TEXT | DEFAULT 'open' | `open`, `fulfilled`, `closed` |
| `fulfilledBy` | TEXT | | Fulfiller user ID |
| `fulfilledResourceId` | TEXT | | FK to lms_resources |
| `upvotes` | INTEGER | DEFAULT 0 | Upvote count |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | | Last update |

**Foreign key:** `fulfilledResourceId → lms_resources(id) ON DELETE SET NULL`.  
**Indexes:** `(subjectCode, status)`, `userId`.

### Table: `lms_request_upvotes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `requestId` | TEXT | NOT NULL, PK | FK to lms_requests |
| `userId` | TEXT | NOT NULL, PK | User ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_exam_feedback`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | User ID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `subjectCode` | TEXT | NOT NULL | Subject code |
| `semester` | TEXT | NOT NULL | Semester |
| `helpful` | INTEGER | NOT NULL, CHECK(0/1) | Was helpful for exam? |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (userId, resourceId, semester) | | One per user/resource/semester |

**Indexes:** `resourceId`, `(subjectCode, semester)`.

### Table: `lms_guides`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `title` | TEXT | NOT NULL | Guide title |
| `description` | TEXT | | Description |
| `authorId` | TEXT | NOT NULL | Author user ID |
| `subjectCode` | TEXT | NOT NULL | Subject code |
| `subjectName` | TEXT | NOT NULL | Subject name |
| `semester` | TEXT | NOT NULL | Semester |
| `unit` | TEXT | NOT NULL | Unit |
| `unitNormalized` | TEXT | NOT NULL | Normalized unit |
| `tags` | TEXT | DEFAULT '[]' | JSON array |
| `difficulty` | TEXT | | Difficulty |
| `viewCount` | INTEGER | DEFAULT 0 | View count |
| `upvotes` | INTEGER | DEFAULT 0 | Upvote count |
| `qualityScore` | REAL | DEFAULT 0 | Quality score |
| `moderationState` | INTEGER | DEFAULT 0 | 0=visible, 1=hidden, 2=removed |
| `exportable` | INTEGER | DEFAULT 1 | Allow PDF export |
| `published` | INTEGER | DEFAULT 0 | Published flag |
| `isDeleted` | INTEGER | DEFAULT 0 | Soft delete |
| `deletedAt` | TEXT | | Deletion timestamp |
| `deletedBy` | TEXT | | Deleter user ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | | Last update |

**Index:** `(subjectCode, published, isDeleted)`.

### Table: `lms_guide_sections`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `guideId` | TEXT | NOT NULL | FK to lms_guides ON DELETE CASCADE |
| `title` | TEXT | NOT NULL | Section title |
| `content` | TEXT | NOT NULL | Section content (markdown) |
| `position` | INTEGER | NOT NULL | Ordering |

### Table: `lms_guide_progress`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `guideId` | TEXT | NOT NULL, PK | FK to lms_guides |
| `readSections` | TEXT | DEFAULT '[]' | JSON array of read section IDs |
| `startedAt` | TEXT | NOT NULL | Start timestamp |
| `updatedAt` | TEXT | NOT NULL | Last activity |

### Table: `lms_roadmaps`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `title` | TEXT | NOT NULL | Roadmap title |
| `description` | TEXT | | Description |
| `skill` | TEXT | NOT NULL | Target skill |
| `authorId` | TEXT | NOT NULL | Author user ID |
| `difficulty` | TEXT | | Difficulty |
| `estimatedHours` | INTEGER | | Estimated total hours |
| `viewCount` | INTEGER | DEFAULT 0 | View count |
| `upvotes` | INTEGER | DEFAULT 0 | Upvote count |
| `qualityScore` | REAL | DEFAULT 0 | Quality score |
| `published` | INTEGER | DEFAULT 0 | Published flag |
| `moderationState` | INTEGER | DEFAULT 0 | Moderation state |
| `isDeleted` | INTEGER | DEFAULT 0 | Soft delete |
| `deletedAt` | TEXT | | Deletion timestamp |
| `deletedBy` | TEXT | | Deleter user ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | | Last update |

**Index:** `(authorId, published, isDeleted)`.

### Table: `lms_roadmap_nodes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `roadmapId` | TEXT | NOT NULL | FK to lms_roadmaps ON DELETE CASCADE |
| `title` | TEXT | NOT NULL | Node title |
| `description` | TEXT | | Description |
| `nodeType` | TEXT | NOT NULL, CHECK(IN 'concept','resource','quiz','milestone') | Node type |
| `resourceId` | TEXT | | FK to lms_resources |
| `position` | INTEGER | NOT NULL | Ordering |
| `isOptional` | INTEGER | DEFAULT 0 | Optional flag |

### Table: `lms_roadmap_edges`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `roadmapId` | TEXT | NOT NULL, PK | FK to lms_roadmaps |
| `fromNodeId` | TEXT | NOT NULL, PK | FK to lms_roadmap_nodes |
| `toNodeId` | TEXT | NOT NULL, PK | FK to lms_roadmap_nodes |

### Table: `lms_roadmap_progress`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `roadmapId` | TEXT | NOT NULL, PK | FK to lms_roadmaps |
| `completedNodes` | TEXT | DEFAULT '[]' | JSON array of completed node IDs |
| `startedAt` | TEXT | NOT NULL | Start timestamp |
| `updatedAt` | TEXT | NOT NULL | Last activity |

### Table: `lms_topics`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `label` | TEXT | NOT NULL, UNIQUE | Topic label |
| `subjectCode` | TEXT | | Related subject |
| `description` | TEXT | | Description |
| `crossSubjectLinks` | TEXT | DEFAULT '[]' | JSON array of related subject codes |

**Index:** `subjectCode`.

### Table: `lms_resource_topics`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `topicId` | TEXT | NOT NULL, PK | FK to lms_topics |

### Table: `lms_topic_prerequisites`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `topicId` | TEXT | NOT NULL, PK | FK to lms_topics |
| `prerequisiteId` | TEXT | NOT NULL, PK | FK to lms_topics |

### Table: `lms_question_bank`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `subjectCode` | TEXT | NOT NULL | Subject code |
| `unit` | TEXT | | Unit |
| `unitNormalized` | TEXT | | Normalized unit |
| `topicId` | TEXT | | FK to lms_topics |
| `question` | TEXT | NOT NULL | Question text |
| `options` | TEXT | NOT NULL | JSON array of options |
| `correctIndex` | INTEGER | NOT NULL | Index of correct answer |
| `explanation` | TEXT | | Explanation |
| `difficulty` | TEXT | CHECK(IN 'easy','medium','hard') | Difficulty |
| `contributedBy` | TEXT | NOT NULL | Contributor user ID |
| `usageCount` | INTEGER | DEFAULT 0 | Times used in quizzes |
| `upvotes` | INTEGER | DEFAULT 0 | Upvote count |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Indexes:** `subjectCode`, `unitNormalized`.

### Table: `lms_quiz_questions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources (quiz type) |
| `questionId` | TEXT | NOT NULL, PK | FK to lms_question_bank |
| `position` | INTEGER | NOT NULL | Ordering |

### Table: `lms_progress`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `status` | TEXT | NOT NULL, CHECK(IN 'started','completed') | Progress status |
| `completedAt` | TEXT | | Completion timestamp |
| `timeSpentMs` | INTEGER | DEFAULT 0 | Time spent in ms |
| `updatedAt` | TEXT | NOT NULL | Last update |

**Index:** `(userId, updatedAt DESC)`.

### Table: `lms_topic_mastery`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `topicId` | TEXT | NOT NULL, PK | FK to lms_topics |
| `mastery` | REAL | DEFAULT 0 | Composite mastery (0-1) |
| `quizScore` | REAL | DEFAULT 0 | Quiz performance (0-1) |
| `interactionScore` | REAL | DEFAULT 0 | Interaction score (0-1) |
| `revisionScore` | REAL | DEFAULT 0 | Revision score (0-1) |
| `lastUpdated` | TEXT | NOT NULL | Timestamp |

### Table: `lms_subject_mastery`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `subjectCode` | TEXT | NOT NULL, PK | Subject code |
| `mastery` | REAL | DEFAULT 0 | Overall mastery (0-1) |
| `lastUpdated` | TEXT | NOT NULL | Timestamp |

### Table: `lms_quiz_attempts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `userId` | TEXT | NOT NULL | User ID |
| `answers` | TEXT | NOT NULL | JSON array of answers |
| `score` | REAL | NOT NULL | Score achieved |
| `maxScore` | REAL | NOT NULL | Maximum score |
| `percentage` | REAL | NOT NULL | Percentage |
| `mode` | TEXT | DEFAULT 'practice' | `practice`, `exam` |
| `timeTakenMs` | INTEGER | | Time taken in ms |
| `completedAt` | TEXT | NOT NULL | Completion timestamp |

### Table: `lms_revision_queue`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `dueDate` | TEXT | NOT NULL | Next review due date |
| `interval` | INTEGER | DEFAULT 1 | Days between reviews |
| `repetition` | INTEGER | DEFAULT 0 | Repetition count |

**Index:** `(userId, dueDate)`.

### Table: `lms_streaks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | PK | User ID |
| `currentStreak` | INTEGER | DEFAULT 0 | Current consecutive days |
| `longestStreak` | INTEGER | DEFAULT 0 | Longest streak |
| `lastActivityDate` | TEXT | | Last activity date (YYYY-MM-DD) |

### Table: `lms_user_interactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `userId` | TEXT | NOT NULL | User ID |
| `resourceId` | TEXT | | FK to lms_resources |
| `guideId` | TEXT | | FK to lms_guides |
| `roadmapId` | TEXT | | FK to lms_roadmaps |
| `action` | TEXT | NOT NULL | Action type (view, quiz_pass, quiz_fail, etc.) |
| `timeSpentMs` | INTEGER | | Time spent |
| `metadata` | TEXT | | JSON metadata |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Indexes:** `userId`, `resourceId`, `createdAt`.

### Table: `lms_user_preferences`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | PK | User ID |
| `subjectWeights` | TEXT | DEFAULT '{}' | JSON weight map |
| `typeWeights` | TEXT | DEFAULT '{}' | JSON weight map |
| `difficultyPref` | TEXT | DEFAULT 'any' | Preferred difficulty |
| `topicWeights` | TEXT | DEFAULT '{}' | JSON weight map |
| `explorationRate` | REAL | DEFAULT 0.2 | Exploration rate (0-1) |
| `lastUpdated` | TEXT | | Timestamp |

### Table: `lms_resource_effectiveness`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `resourceId` | TEXT | PK | FK to lms_resources |
| `successRate` | REAL | DEFAULT 0 | Success rate (0-1) |
| `completionRate` | REAL | DEFAULT 0 | Completion rate (0-1) |
| `avgTimeSpentMs` | INTEGER | DEFAULT 0 | Average time spent |
| `sampleSize` | INTEGER | DEFAULT 0 | Number of data points |
| `lastUpdated` | TEXT | | Timestamp |

### Table: `lms_user_storage`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | PK | User ID |
| `totalBytes` | INTEGER | DEFAULT 0 | Total bytes used |

### Table: `lms_resource_versions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `versionNumber` | INTEGER | NOT NULL | Version number |
| `snapshot` | TEXT | NOT NULL | JSON snapshot of resource |
| `createdBy` | TEXT | NOT NULL | Editor user ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (resourceId, versionNumber) | | |

### Table: `lms_guide_versions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `guideId` | TEXT | NOT NULL | FK to lms_guides |
| `versionNumber` | INTEGER | NOT NULL | Version number |
| `snapshot` | TEXT | NOT NULL | JSON snapshot |
| `createdBy` | TEXT | NOT NULL | Editor user ID |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (guideId, versionNumber) | | |

### Table: `lms_ranking_shadow`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `resourceId` | TEXT | NOT NULL, PK | FK to lms_resources |
| `algorithmKey` | TEXT | NOT NULL, PK | Algorithm identifier |
| `shadowScore` | REAL | NOT NULL | Shadow score |
| `displayedScore` | REAL | | Actually displayed score |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Index:** `(algorithmKey, createdAt)`.

### Table: `lms_feature_flags`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PK | Flag key |
| `enabled` | INTEGER | NOT NULL DEFAULT 0 | Enabled state |
| `rolloutType` | TEXT | NOT NULL DEFAULT 'global' | `global`, `percentage`, `user_list` |
| `rolloutValue` | TEXT | | Rollout value (percentage or user list) |
| `description` | TEXT | | Description |
| `updatedBy` | TEXT | | Editor user ID |
| `updatedAt` | TEXT | NOT NULL | Timestamp |

### Table: `lms_experiments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `userId` | TEXT | NOT NULL, PK | User ID |
| `experimentKey` | TEXT | NOT NULL, PK | Experiment identifier |
| `variant` | TEXT | NOT NULL | Assigned variant |
| `assignedAt` | TEXT | NOT NULL | Assignment timestamp |

### Table: `lms_schema_version`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, CHECK(id = 1) | Singleton row |
| `version` | INTEGER | NOT NULL | Current schema version |
| `updatedAt` | TEXT | NOT NULL | Last migration timestamp |

### Table: `lms_resource_moderation_audit` (v2)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `resourceId` | TEXT | NOT NULL | FK to lms_resources |
| `action` | TEXT | NOT NULL | Moderation action |
| `actorId` | TEXT | NOT NULL | Admin user ID |
| `fromState` | INTEGER | | Previous moderation state |
| `toState` | INTEGER | | New moderation state |
| `reason` | TEXT | | Reason |
| `metadata` | TEXT | DEFAULT '{}' | JSON metadata |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Index:** `(resourceId, createdAt DESC)`.

### Virtual Table: `lms_search` (FTS5)

```sql
CREATE VIRTUAL TABLE lms_search USING fts5(
  title, description, tags,
  content='lms_resources',
  content_rowid='rowid'
);
```

---

## 13.3 Competition Database (`competitions.db`)

8 tables. Managed by `CompetitionStore` in `Backend/src/services/competitionStore.js`.

### Table: `submissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `eventId` | TEXT | NOT NULL | FK to events |
| `roundId` | TEXT | NOT NULL | Round identifier |
| `submittedBy` | TEXT | NOT NULL | User register number |
| `type` | TEXT | NOT NULL | `file` or `link` |
| `filePath` | TEXT | | Relative file path |
| `linkUrl` | TEXT | | URL submission |
| `description` | TEXT | | Description |
| `submittedAt` | TEXT | NOT NULL | Initial submission |
| `resubmittedAt` | TEXT | | Last resubmission |
| `resubmissionCount` | INTEGER | DEFAULT 0 | Resubmission count |
| `criteriaScores` | TEXT | | JSON criteria scores |
| `totalScore` | REAL | | Aggregate score |
| `remarks` | TEXT | | Evaluator remarks |
| `evaluatedBy` | TEXT | | Evaluator user ID |
| `evaluatedAt` | TEXT | | Evaluation timestamp |
| `decision` | TEXT | | Evaluation decision |
| `shortlisted` | INTEGER | DEFAULT 0 | Shortlist flag |
| `flagged` | INTEGER | DEFAULT 0 | Flagged for review |
| `flagReason` | TEXT | | Flag reason |
| `teamId` | TEXT | | FK to teams (added via ALTER) |
| UNIQUE | (eventId, roundId, submittedBy, resubmissionCount) | | |

**Indexes:** `(eventId, roundId)`, `submittedBy`, `(eventId, roundId, totalScore DESC)`.

### Table: `rounds`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `eventId` | TEXT | NOT NULL | FK to events |
| `roundId` | TEXT | NOT NULL | Round identifier |
| `title` | TEXT | | Round title |
| `type` | TEXT | | Round type |
| `startTime` | TEXT | | Round start ISO |
| `submissionDeadline` | TEXT | | Deadline ISO |
| `instructions` | TEXT | | Instructions HTML/markdown |
| `submissionTypes` | TEXT | | Allowed submission types |
| `maxFileSizeMb` | REAL | | Max file size |
| `maxResubmissions` | INTEGER | | Max resubmissions |
| `evaluationCriteria` | TEXT | | JSON criteria definition |
| `shortlistCount` | INTEGER | | Number to shortlist |
| `shortlistThreshold` | REAL | | Minimum score threshold |
| `requiresShortlistFromRound` | TEXT | | Previous round dependency |
| `resultsPublished` | INTEGER | DEFAULT 0 | Results published flag |
| UNIQUE | (eventId, roundId) | | |

**Index:** `eventId`.

### Table: `teams`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `eventId` | TEXT | NOT NULL | FK to events |
| `name` | TEXT | NOT NULL | Team name |
| `leaderId` | TEXT | NOT NULL | Leader register number |
| `members` | TEXT | NOT NULL | JSON array of member IDs |
| `createdAt` | TEXT | NOT NULL | Timestamp |

**Index:** `eventId`.

### Table: `team_invitations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `teamId` | TEXT | NOT NULL | FK to teams |
| `eventId` | TEXT | NOT NULL | FK to events |
| `invitedBy` | TEXT | NOT NULL | Inviter register number |
| `inviteeRegisterNumber` | TEXT | NOT NULL | Invitee register number |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | `pending`, `accepted`, `declined` |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (teamId, inviteeRegisterNumber) | | |

**Index:** `(inviteeRegisterNumber, status)`.

### Table: `evaluations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `submissionId` | TEXT | NOT NULL | FK to submissions |
| `eventId` | TEXT | NOT NULL | FK to events |
| `roundId` | TEXT | NOT NULL | Round identifier |
| `evaluatorId` | TEXT | NOT NULL | Evaluator user ID |
| `criteriaScores` | TEXT | NOT NULL | JSON criteria scores |
| `totalScore` | REAL | NOT NULL | Total score |
| `remarks` | TEXT | | Remarks |
| `decision` | TEXT | | Decision |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | NOT NULL | Last update |
| UNIQUE | (submissionId, evaluatorId) | | |

**Indexes:** `submissionId`, `(eventId, roundId)`.

### Table: `reminder_marks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `eventId` | TEXT | NOT NULL | FK to events |
| `roundId` | TEXT | NOT NULL | Round identifier |
| `userId` | TEXT | NOT NULL | User ID |
| `marker` | TEXT | NOT NULL | Reminder marker type |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (eventId, roundId, userId, marker) | | |

### Table: `event_roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `eventId` | TEXT | NOT NULL | FK to events |
| `regNo` | TEXT | NOT NULL | User register number |
| `name` | TEXT | | Display name |
| `role` | TEXT | NOT NULL | Role (judge, organizer, coordinator) |
| `assignedBy` | TEXT | NOT NULL | Assigner user ID |
| `assignedAt` | TEXT | NOT NULL | Timestamp |
| UNIQUE | (eventId, regNo) | | |

**Index:** `eventId`.

### Table: `certificate_templates`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `eventId` | TEXT | PK | FK to events |
| `roundId` | TEXT | | Round identifier (NULL = default) |
| `templateImagePath` | TEXT | NOT NULL | Path to template image |
| `fields` | TEXT | NOT NULL | JSON field definitions |
| `createdAt` | TEXT | NOT NULL | Timestamp |
| `updatedAt` | TEXT | NOT NULL | Last update |

---

## 13.4 Content Database (`content.db`)

3 tables. Managed by `ContentStore` in `Backend/src/services/contentStore.js`.

### Table: `content`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `type` | TEXT | NOT NULL | Content type (`page`, `learning_material`, etc.) |
| `title` | TEXT | NOT NULL | Title |
| `description` | TEXT | DEFAULT '' | Description |
| `category` | TEXT | DEFAULT '' | Category |
| `start_date` | TEXT | | Start date |
| `end_date` | TEXT | | End date |
| `location` | TEXT | | Location |
| `metadata_json` | TEXT | | JSON metadata |
| `lifecycle_state` | TEXT | DEFAULT 'published' | `draft`, `review`, `published`, `archived`, `deleted` |
| `version` | INTEGER | DEFAULT 1 | Version counter |
| `deleted_at` | TEXT | | Soft delete timestamp |
| `last_actor` | TEXT | | Last editor identifier |
| `created_at` | TEXT | NOT NULL | Creation timestamp |
| `updated_at` | TEXT | NOT NULL | Last update |

### Table: `resources`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `content_id` | TEXT | NOT NULL | FK to content ON DELETE CASCADE |
| `kind` | TEXT | NOT NULL | Resource kind (`link`, `file`, etc.) |
| `title` | TEXT | NOT NULL | Resource title |
| `url_or_path` | TEXT | NOT NULL | URL or file path |
| `mime_type` | TEXT | | MIME type |
| `size_bytes` | INTEGER | | File size |
| `created_at` | TEXT | NOT NULL | Timestamp |

### Table: `content_audit`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `content_id` | TEXT | NOT NULL | FK to content ON DELETE CASCADE |
| `action` | TEXT | NOT NULL | Audit action |
| `actor_id` | TEXT | NOT NULL | Actor identifier |
| `actor_role` | TEXT | DEFAULT 'admin' | Actor role |
| `reason` | TEXT | DEFAULT '' | Reason |
| `before_json` | TEXT | | Snapshot before change |
| `after_json` | TEXT | | Snapshot after change |
| `diff_json` | TEXT | | Field-level diff |
| `created_at` | TEXT | NOT NULL | Timestamp |

---

## 13.5 Events Database (`events.db`)

Single table, JSON-in-column pattern. Managed by `EventsStore` in `Backend/src/services/eventsStore.js`.

### Table: `events_state`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `state_key` | TEXT | PK | Key name: `events`, `registrations`, `notifications`, `feedback`, `gallery`, `checkIns` |
| `payload_json` | TEXT | NOT NULL | JSON serialized array of state objects |
| `updated_at` | TEXT | NOT NULL | Last write timestamp |

State keys store:
- **events**: Full event objects with all fields (id, title, description, startAt, endAt, category, department, status, visibility, type, recurrence, competitionConfig, etc.)
- **registrations**: Registration records (id, eventId, userId, registeredAt, checkedIn, checkInCode, etc.)
- **notifications**: Notification records (id, userId, eventId, type, title, message, read, createdAt)
- **feedback**: Event feedback entries (id, eventId, userId, rating, comments, answers, createdAt)
- **gallery**: Gallery photo entries (id, eventId, userId, url, caption, createdAt)
- **checkIns**: Check-in records (eventId, userId, timestamp, code, method)

The store also maintains in-memory indexes:
- `eventById: Map<id, event>`
- `registrationsByEvent: Map<eventId, registration[]>`
- `registrationsByUser: Map<userId, registration[]>`
- `feedbackByEvent: Map<eventId, feedback[]>`
- `galleryByEvent: Map<eventId, galleryPhoto[]>`

---

## 13.6 Helpdesk Database (`helpdesk.db`)

Single table, JSON-in-column pattern. Managed by `HelpdeskStore` in `Backend/src/services/helpdeskStore.js`.

### Table: `helpdesk_state`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `state_key` | TEXT | PK | Key name: `tickets`, `replies`, `faqs` |
| `payload_json` | TEXT | NOT NULL | JSON serialized array |
| `updated_at` | TEXT | NOT NULL | Last write timestamp |

State keys store:
- **tickets**: Ticket objects (id, title, description, category, priority, status, queue, assignedTeam, assignedTo, ownerUserId, ownerName, createdByUserId, createdByName, createdAt, updatedAt, slaPolicyHours, slaDueAt, slaBreachedAt, auditTrail, etc.)
- **replies**: Reply objects (id, ticketId, userId, userName, content, visibility, createdAt)
- **faqs**: FAQ objects (id, question, answer, category, tags, visible, createdAt, updatedAt)

---

## 13.7 Campus Feedback Database (`campus_feedback.db`)

3 tables. Managed by `CampusFeedbackStore` in `Backend/src/services/campusFeedbackStore.js`.

### Table: `campus_feedback_options`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `type` | TEXT | NOT NULL | `events`, `hostel-mess`, `transport` |
| `label` | TEXT | NOT NULL | Display label |
| `active` | INTEGER | NOT NULL DEFAULT 1 | Active flag |
| `created_by_user_id` | TEXT | | Creator user ID |
| `created_by_name` | TEXT | | Creator name |
| `created_at` | TEXT | NOT NULL | Timestamp |
| `updated_at` | TEXT | NOT NULL | Last update |
| UNIQUE | (type, label) | | |

### Table: `campus_feedback_entries`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `type` | TEXT | NOT NULL | Feedback type |
| `target_id` | TEXT | | FK to options |
| `target_label` | TEXT | NOT NULL | Target display label |
| `ratings_json` | TEXT | NOT NULL | JSON ratings object |
| `comment` | TEXT | NOT NULL | Comment text |
| `status` | TEXT | NOT NULL | `pending`, `approved`, `rejected` |
| `created_by_user_id` | TEXT | NOT NULL | Submitter user ID |
| `created_by_name` | TEXT | NOT NULL | Submitter name |
| `created_by_email` | TEXT | | Submitter email |
| `department` | TEXT | | Submitter department |
| `display_mode` | TEXT | NOT NULL | `anonymous`, `named` |
| `dedupe_key` | TEXT | NOT NULL | Dedup key |
| `moderation_reason` | TEXT | | Moderation reason |
| `moderated_by_user_id` | TEXT | | Moderator user ID |
| `moderated_by_name` | TEXT | | Moderator name |
| `moderated_at` | TEXT | | Moderation timestamp |
| `created_at` | TEXT | NOT NULL | Submission timestamp |
| `updated_at` | TEXT | NOT NULL | Last update |
| UNIQUE | (dedupe_key) | | |

**Indexes:** `(created_by_user_id, created_at DESC)`, `(status, updated_at DESC)`, `(type, updated_at DESC)`.

### Table: `campus_feedback_audit`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `feedback_id` | TEXT | NOT NULL | FK to campus_feedback_entries ON DELETE CASCADE |
| `action` | TEXT | NOT NULL | Audit action |
| `from_status` | TEXT | | Previous status |
| `to_status` | TEXT | | New status |
| `reason` | TEXT | | Reason |
| `actor_user_id` | TEXT | NOT NULL | Actor user ID |
| `actor_name` | TEXT | NOT NULL | Actor name |
| `actor_role` | TEXT | NOT NULL | Actor role |
| `created_at` | TEXT | NOT NULL | Timestamp |

---

## 13.8 External Data Database (`external.db`)

Single table. Managed by `ExternalDataStore` in `Backend/src/services/externalDataStore.js`.

### Table: `external_pages`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `page_key` | TEXT | PK | Page key (e.g. `academic/calendar`) |
| `title` | TEXT | NOT NULL | Display title |
| `payload_json` | TEXT | NOT NULL | JSON page data |
| `updated_at` | TEXT | NOT NULL | Last update |

Seed data defined in `Backend/src/data/externalSeedData.js`.

---

## 13.9 LMS Tracker Database (`lms_tracker.db`)

2 tables. Managed by `LmsTrackerStore` in `Backend/src/services/lmsTrackerStore.js`.

### Table: `lms_tracker_snapshots`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | NOT NULL | User ID |
| `snapshot_type` | TEXT | NOT NULL | Snapshot type (overview, insights, unified) |
| `payload_json` | TEXT | NOT NULL | Full snapshot payload |
| `inputs_hash` | TEXT | NOT NULL | SHA-256 of input data |
| `source_status_json` | TEXT | NOT NULL | JSON source health |
| `created_at` | TEXT | NOT NULL | Timestamp |

**Index:** `(user_id, snapshot_type, created_at DESC)`.

### Table: `lms_tracker_recommendation_events`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | UUID |
| `user_id` | TEXT | NOT NULL | User ID |
| `event_type` | TEXT | NOT NULL | Event type |
| `recommendation_id` | TEXT | NOT NULL | Recommendation identifier |
| `recommendation_title` | TEXT | NOT NULL | Display title |
| `source_domain` | TEXT | NOT NULL | Source domain |
| `confidence` | REAL | NOT NULL DEFAULT 0 | Confidence score |
| `payload_json` | TEXT | NOT NULL | JSON payload |
| `created_at` | TEXT | NOT NULL | Timestamp |

**Indexes:** `(user_id, created_at DESC)`, `(user_id, recommendation_id, event_type)`.

---

## 13.10 Non-SQLite Stores

### ERP UI Map — JSON File

Managed by `ErpUiMapStore` in `Backend/src/services/erpUiMapStore.js`. Reads a JSON file containing the ERP UI mapping schema (version `2026-03-13`). Not persisted to SQLite.

### Page Policy — JSON File

Managed by `PagePolicyStore` in `Backend/src/services/pagePolicyStore.js`. Reads a JSON file with cache policy configuration:

```json
{
  "defaultMode": "cached-first",
  "liveFirstPrefixes": ["finance/"],
  "cachedFirstPrefixes": [],
  "overrides": {
    "academic/attendance-details": "live-first"
  }
}
```

### Session Store — In-Memory

Managed by `SessionStore` in `Backend/src/services/sessionStore.js`. In-memory `Map<sessionId, session>` with TTL-based expiry. Session object:

```json
{
  "storageState": { "cookies": [], "origins": [] },
  "createdAt": 1743868800000,
  "updatedAt": 1743868800000,
  "loggedIn": false,
  "profileData": null,
  "loginBootstrap": null,
  "preAuthAttempt": null,
  "username": "",
  "adminElevated": false,
  "adminElevatedAt": null
}
```

### ERP Cache — In-Memory or Redis

Two implementations in `Backend/src/services/erpCacheStore.js`:
- **InMemoryErpCacheStore**: `Map<cacheKey, { data, fetchedAt, staleAt, expiresAt }>` with TTL
- **RedisErpCacheStore**: Redis client using `GET`/`SET` with `EX` (TTL in seconds)

---

## 13.11 Database File Locations

| Database | Typical Path | Size Estimate |
|----------|-------------|---------------|
| `career.db` | `Backend/data/career.db` | Large (scraped opportunities) |
| `lms.db` | `Backend/data/lms.db` | Large (resources + interactions) |
| `competitions.db` | `Backend/data/competitions.db` | Medium |
| `content.db` | `Backend/data/content.db` | Small |
| `events.db` | `Backend/data/events.db` | Small |
| `helpdesk.db` | `Backend/data/helpdesk.db` | Small |
| `campus_feedback.db` | `Backend/data/campus_feedback.db` | Small |
| `external.db` | `Backend/data/external.db` | Tiny (seeded static data) |
| `lms_tracker.db` | `Backend/data/lms_tracker.db` | Small |

File locations are configured via environment variables or constructor parameters in `server.js`.
