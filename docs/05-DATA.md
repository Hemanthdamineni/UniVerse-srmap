# 05 — Data

> Where the platform's state lives. Three layers: 14 SQLite databases
> (the primary store), Redis (transient state — sessions, cache, locks,
> circuit), and a directory tree for files. This doc lists each
> database, its tables, and the relevant Redis namespaces and file
> paths. For how data flows through the system, see
> **[02 — Architecture](./02-ARCHITECTURE.md)**.

## 5.1 SQLite databases

All 14 SQLite DBs are WAL-mode files under `Backend/data/`. Every
store applies the same pragma block on construction:

```js
this.db.exec("PRAGMA journal_mode = WAL");
this.db.exec("PRAGMA foreign_keys = ON");
this.db.exec("PRAGMA busy_timeout = 5000");
```

The WAL pragma is verified by `Backend/test/walPragmas.test.js` for
the 7 stores that originally had it missing.

| # | DB file | Env var | Store module | Purpose |
|---|---------|---------|--------------|---------|
| 1 | `content.sqlite` | `CONTENT_DB_PATH` | `lms/contentStore.js` | Unified content store (pages, resources, audit) |
| 2 | `events.sqlite` | `EVENTS_DB_PATH` | `events/eventsStore.js` | Events (state per user) |
| 3 | `lms.sqlite` | `LMS_DB_PATH` | `lms/lmsStore.js` | LMS resources, guides, roadmaps, quizzes, PYQs (versioned migrations via `lmsMigrations.js`) |
| 4 | `career.sqlite` | `CAREER_DB_PATH` | `career/careerStore.js` | Career opportunities, applications, bookmarks, resume versions |
| 5 | `helpdesk.sqlite` | `HELPDESK_DB_PATH` | `campus/helpdeskStore.js` | Helpdesk tickets, FAQs, audit trail |
| 6 | `campus-feedback.sqlite` | `CAMPUS_FEEDBACK_DB_PATH` | `campus/campusFeedbackStore.js` | Campus feedback form definitions, entries, audit |
| 7 | `external-pages.sqlite` | `EXTERNAL_DB_PATH` | `campus/feedbackServices.js` | Static / external pages with a redirect + SEO template |
| 8 | `lms-tracker.sqlite` | `LMS_TRACKER_DB_PATH` | `lms/lmsTrackerStore.js` | LMS interaction tracking (every resource view) |
| 9 | `unified-profile.sqlite` | `UNIFIED_PROFILE_DB_PATH` | `core/unifiedProfileStore.js` | Unified student profile, signal ledger, recommendations |
| 10 | `companion-analytics.sqlite` | `COMPANION_ANALYTICS_DB_PATH` | `career/careerServices.js` | Companion platform analytics events |
| 11 | `erp-attendance-snapshots.sqlite` | `ERP_ATTENDANCE_SNAPSHOTS_DB_PATH` | `erp/attendanceSnapshotStore.js` | Daily attendance snapshots |
| 12 | `vacant-rooms.sqlite` | `VACANT_ROOMS_DB_PATH` | `erp/vacantRoomStore.js` | Vacant-room cache per day + slot |
| 13 | `persistent-teams.sqlite` | `PERSISTENT_TEAMS_DB_PATH` | `events/persistentTeamStore.js` | Persistent team registry (cross-event teams) |
| 14 | `hostel-buddy.sqlite` | `HOSTEL_BUDDY_DB_PATH` | `campus/hostelBuddyStore.js` | Hostel buddy finder entries |

The lms-tracker, unified-profile, companion-analytics, persistent-team
and hostel-buddy databases were added in waves after the initial
release — see the commit history (`feat(lms-tracker): ...`,
`feat(profile): ...`).

### 5.1.1 Per-database schema

For brevity, only the table names and the key columns are listed here.
For the full column-by-column schema, see the source `CREATE TABLE`
statements in each store module.

#### `content.sqlite` — `Backend/src/services/lms/contentStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `content` | Pages and resources | `id`, `slug`, `title`, `body`, `lifecycle_state` (`draft`/`published`/`archived`), `version`, `createdBy`, `updatedAt` |
| `resources` | File-backed resources | `id`, `contentId`, `path`, `mimeType`, `size` |
| `content_audit` | Who changed what when | `id`, `contentId`, `action`, `actorId`, `at` |

#### `events.sqlite` — `Backend/src/services/events/eventsStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `events_state` | Per-user event state (registered, interested, etc.) | `id`, `userId`, `eventId`, `state`, `createdAt` |
| (and 4 other tables for event lifecycle, reminders, registrations) | | |

#### `lms.sqlite` — `Backend/src/services/lms/lmsStore.js` (3000 LOC, ~12 tables)

| Table | Purpose |
|-------|---------|
| `lms_resources` | Resource metadata (kind: `video`, `pdf`, `link`, `article`, ...) |
| `lms_collections` | User-organized buckets of resources |
| `lms_collection_items` | Many-to-many |
| `lms_guides` | Long-form tutorials |
| `lms_roadmaps` | Ordered learning sequences |
| `lms_quizzes` | Quiz metadata |
| `lms_quiz_questions` + `lms_quiz_attempts` + `lms_quiz_responses` | Quiz schema + state |
| `lms_pyq_papers` | Previous-year question papers |
| `lms_search` | FTS5 virtual table for full-text search |
| `lms_subject_hubs` | Subject-scoped resource collections |
| `lms_request_board` + `lms_request_responses` | Student request board |

#### `career.sqlite` — `Backend/src/services/career/careerStore.js` (2500 LOC, ~12 tables)

| Table | Purpose |
|-------|---------|
| `career_opportunities` | Job listings (title, company, location, salary, type, ...) |
| `career_bookmarks` | Saved opportunities per user |
| `career_applications` | Apply-to-this-job records |
| `career_flags` | User-flagged (broken link, expired, etc.) |
| `career_dismissals` | "Don't show me this again" |
| `career_views` | Per-user view history (for dedup + recommendation) |
| `career_submissions` + `career_submission_audit` | Self-submitted opportunities + audit |
| `career_scraper_runs` | Every supervisor run (start, end, source count) |
| `career_source_health` | Per-source health (last_success, last_failure, status) |
| `career_profiles` | Student career profile (skills, bio, links) |
| `resume_versions` | Resume parse versions |
| `career_skill_gaps` | Per-user skill gap analysis |
| `career_search` | FTS5 virtual table |

#### `helpdesk.sqlite` — `Backend/src/services/campus/helpdeskStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `helpdesk_state` | Tickets + replies + audit, all in one JSON blob per ticket (the prod-readiness audit flagged this for god-file risk; the split plan is in `docs/14-PROD-READINESS-CHECKLIST.md`) | `id`, `userId`, `category`, `priority`, `subject`, `body`, `status`, `replies`, `auditTrail`, `slaDueAt` |

The helpdesk store keeps tickets as JSON blobs to support flexible
schema (different categories have different fields). The split plan
is documented in `14-PROD-READINESS-CHECKLIST.md`.

#### `campus-feedback.sqlite` — `Backend/src/services/campus/campusFeedbackStore.js`

| Table | Purpose |
|-------|---------|
| `campus_feedback_options` | Form definition (questions, types, options) |
| `campus_feedback_entries` | Submitted responses |
| `campus_feedback_audit` | Edit history |

#### `external-pages.sqlite` — `Backend/src/services/campus/feedbackServices.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `external_pages` | Static-ish pages with a redirect target + SEO template | `id`, `slug`, `title`, `template`, `targetUrl`, `metaTitle`, `metaDescription` |

#### `lms-tracker.sqlite` — `Backend/src/services/lms/lmsTrackerStore.js`

| Table | Purpose |
|-------|---------|
| `lms_tracker_snapshots` | Per-user per-day resource engagement |
| `lms_tracker_recommendation_events` | When the recommendation engine served a card |

#### `unified-profile.sqlite` — `Backend/src/services/core/unifiedProfileStore.js`

| Table | Purpose |
|-------|---------|
| `unified_profile_snapshots` | Point-in-time profile snapshots |
| `student_signal_ledger` | Append-only event log (the inputs to the recommendation engine) |
| `student_skills` | Skill inventory per user |
| `student_achievements` | Awards, certifications, etc. |
| `profile_privacy_settings` | Per-field visibility (public / private / friends) |
| `recommendation_impressions` | Log of what the recommendation engine surfaced |

#### `companion-analytics.sqlite` — `Backend/src/services/career/careerServices.js`

| Table | Purpose |
|-------|---------|
| `companion_analytics_events` | Clickstream / engagement events (sampled, not all) |

#### `erp-attendance-snapshots.sqlite` — `Backend/src/services/erp/attendanceSnapshotStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `attendance_snapshots` | Daily snapshot of attendance per (user, course, date) | `id`, `userId`, `courseCode`, `date`, `total`, `present`, `absent`, `od`, `ml` |
| `attendance_snapshot_meta` | When the snapshot was taken, what source | `key`, `value` |

#### `vacant-rooms.sqlite` — `Backend/src/services/erp/vacantRoomStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `room_occupancy` | Per-day per-slot vacancy state | `id`, `day`, `slotIndex`, `roomNo`, `status` (`free`/`booked`), `fetchedAt` |

#### `persistent-teams.sqlite` — `Backend/src/services/events/persistentTeamStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `persistent_teams` | Teams that span multiple events | `id`, `name`, `leaderId`, `createdAt` |
| `persistent_team_invitations` | Per-user invitations | `id`, `teamId`, `inviteeRegNo`, `status` |

#### `hostel-buddy.sqlite` — `Backend/src/services/campus/hostelBuddyStore.js`

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `hostel_buddy_blocks` | The 3 hostel blocks (A/B/C, seeded on creation) | `id`, `label`, `active` |
| `hostel_buddy_entries` | Per-student "find roommates" entries | `id`, `userId`, `name`, `department`, `roomNo`, `blockId`, `contactInfo` |

### 5.1.2 Migrations

Only the LMS store uses a real migration runner
(`Backend/src/services/lms/lmsMigrations.js`). Every other store
self-initializes via `_ensureSchema()` + column-existence checks
on construction — if a column is missing, the store runs
`ALTER TABLE … ADD COLUMN …` with a default value. This pattern is
fragile (no version tracking) but works for the small additive
changes the project has needed so far. The prod-readiness ledger
flags this as a debt (D10 follow-up).

## 5.2 Redis namespaces

| Pattern | Owner | TTL | Purpose |
|---------|-------|-----|---------|
| `session:<uuid>` | `core/sessionServices.js` | 30 min | Session data (cookie → userId + profile + flags) |
| `erp:<userKey>:<pageKey>` | `erp/erpAggregationService.js` | 60s fresh, 600s stale | Cached ERP scrape response (JSON) |
| `erp:circuit:<pageKey>` | `erp/erpAggregationService.js` | 5 min | Per-pageKey circuit breaker state (`{ failures, openedAt }`) |
| `erp:<userKey>:<pageKey>:live:lock` | `erp/erpAggregationService.js` | 12 sec | Distributed lock so only one backend scrapes the same page per user at a time |
| `ratelimit:<ip>` | `middleware/rateLimit.js` | 60 sec | Global rate-limit counter (400/min/IP) |
| `ratelimit:login:<ip>` | `middleware/rateLimit.js` | 60 sec | Login-specific rate-limit counter (20/min/IP) |

In-memory fallbacks exist for sessions + rate limits when
`REDIS_URL` is empty (the e2e stack uses this). The cache and
circuit breaker fall back to per-process in-memory stores; a single
process means the cache is a real cache, but multi-process deploys
with no Redis would each have their own cache and circuit.

## 5.3 File layout

```
Backend/data/
├── *.sqlite              # the 14 DBs (above)
├── *.sqlite-shm, *.sqlite-wal  # SQLite WAL sidecars (created at runtime)
├── endpoint-discovery.json  # ERP endpoint discovery output
├── events/                # event-related data
├── uploads/               # LMS / content uploads
├── lms/                   # LMS-specific files
├── certificates/          # event certificates
├── submissions/           # event competition submissions
├── live-page-audit/       # output of the live-page audit tool
├── erp-dump/              # ERP dump snapshots
├── login-attempts/        # login artifact rotation (capped at 20 files)
└── logs/                  # backend.log + rotating logs
```

In production, `Backend/data/` is bind-mounted into the container. The
.gitignore excludes everything in this directory except the
`*.sqlite.template` files.

### 5.3.1 File-serving policy

Three URL prefixes expose files:

| URL prefix | Source dir | Cache | Auth |
|------------|-----------|-------|------|
| `/uploads` | `Backend/data/uploads/` | 1h | Required (session cookie) |
| `/files/submissions` | `Backend/data/events/../submissions/` | 7d | None (public) |
| `/files/certificates` | `Backend/data/events/../certificates/` | 7d | None (public) |

The `eventsStore.dataDir` is the source of truth for the
`/files/submissions` and `/files/certificates` paths (the backend
joins `../submissions` and `../certificates` to it). The
`/uploads` auth gate (`ensureAuthenticatedForUploads`) is layered on
top of the global `userContext` middleware so the gate only fires
for `/uploads`.

This split is intentional: `/files/*` are certificate-style
downloads meant to be link-shared (e.g. via email); `/uploads` is
user-private content (LMS resources, etc.) that requires a session.

## 5.4 ERP dump fallback

`Backend/src/services/erp/erpServices.js#resolveLatest()` (a helper
used by `erpAggregationService.getPage` as a fallback when both
cache miss and live scrape fail) resolves the most recent snapshot
in `Backend/data/erp-dump/`. The format is a directory of
per-pageKey JSON files. The snapshot tool is in
`Backend/scripts/create-erp-dump.js` (run with `npm run dump:erp`).

This exists so the platform can serve a coherent snapshot during
upstream-ERP outages without serving stale data from cache. The
snapshot is treated as a hard floor — once a user sees data, that
data doesn't change shape between live and dump.

## 5.5 Backup and restore

The `infra/scripts/setup-backups.sh` script is installed as a nightly
cron entry. It:

1. Snapshots Redis RDB to `BACKUP_DEST/redis-<date>.rdb`
2. Tars + gzips `Backend/data/*.sqlite` (with the WAL/SHM sidecars
   captured via `sqlite3 .backup`) to
   `BACKUP_DEST/sqlite-<date>.tar.gz`
3. Renders the offline ERP dump from cache if needed

The restore procedure is in
`infra/runbooks/backup-restore.md` and follows the **sqlite .backup**
approach (not raw file copy) to guarantee a consistent snapshot
even while the DB is being written. The current setup does NOT
backup the file directories (uploads, certificates, LMS files) — see
prod-readiness ledger D13 for the open task.

## 5.6 Data growth profile

A rough estimate of the steady-state growth (per deployment, per
month, with 1k active users):

- `content.sqlite` — ~5 MB (grows with content volume, ~5KB/page)
- `events.sqlite` — ~2 MB (grows with event volume + per-user state)
- `lms.sqlite` — ~50 MB (grows with resources, ~10KB/resource)
- `career.sqlite` — ~30 MB (grows with opportunity listings + per-user state)
- `helpdesk.sqlite` — ~10 MB (ticket history + audit)
- `lms-tracker.sqlite` — **~1 GB** (one row per resource view; this is
  the biggest growth source — consider an aggressive retention policy
  or a separate analytics sink)
- `unified-profile.sqlite` — ~5 MB (snapshots + signal ledger)
- `companion-analytics.sqlite` — **~500 MB** (event stream)
- Other DBs — ~50 MB combined

Total steady state: ~1.5 GB / month, dominated by the two analytics
streams. The companion-analytics stream is a candidate for
asynchronous offload (e.g. write to S3 with a periodic import).

## 5.7 Schema-change playbook

When you need to add a column to an existing store:

1. Add a `CREATE TABLE IF NOT EXISTS` with the new column in the
   store's `_ensureSchema()`.
2. Add a column-existence check + `ALTER TABLE … ADD COLUMN … DEFAULT
   …` so existing DBs upgrade in place.
3. Add a unit test that constructs a store with a DB that has the
   old schema and verifies the column is created with the right
   default.
4. For the LMS store (which uses `lmsMigrations.js`), add a new
   migration entry.

When you need to remove a column: deprecated, not removed (just
stop writing it; prune later with a migration).
