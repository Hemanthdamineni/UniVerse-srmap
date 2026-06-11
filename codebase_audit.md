# Backend Audit: University-ERP

Generated: 2026-05-30

---

## 2026-05-31 Backend Refactor Update

The backend maintainability phase is complete for the planned service and route splits. All files under `Backend/src` are now below the 500 LOC target; the largest backend source file is currently `Backend/src/services/lmsMigrations/baseSchemaSql.js` at 487 LOC.

Completed facade/module splits:
- `lmsStore.js`, `careerStore.js`, `erpClient.js`, `competitionStore.js`, `eventsStore.js`, `lmsTrackerService.js`
- `contentStore.js`, `erpAggregationService.js`, `helpdeskStore.js`, `erpDocumentBuilder.js`
- `campusFeedbackStore.js`, `erpPayloadNormalizer.js`, `erpActionExecutor.js`, `lmsMigrations.js`, `erpUiMapStore.js`
- `routes/lmsRoutes.js`

Verification:
- `rg --files Backend/src | rg '\.js$' | xargs -n 1 node --check` passed.
- `cd Backend && npm test` passed outside the sandbox: 127 tests, 127 passing.
- Non-escalated backend route tests can fail in this environment because the sandbox blocks local `127.0.0.1` server binding; the same tests passed when run with the required bind permission.

Interesting findings fixed during the backend phase:
- LMS moderation audit and tracker recommendation-event queries needed deterministic ordering for same-millisecond writes. They now sort by timestamp and `rowid`, which removed intermittent test failures under fast parallel execution.
- `erpDocumentBuilder` still had debug `console.warn`/`console.log` output in sanitizer paths. Those logs were removed while preserving the object-leak blanking behavior.
- The safest extraction pattern for the CommonJS services was a thin compatibility facade plus domain modules attached to the existing exported class/prototype shape. That kept route and test imports stable while cutting the file sizes down.

---

## 1. Academic / ERP Core

### API Endpoints

| Method | Path | File:Line | Description |
|--------|------|-----------|-------------|
| GET | `/v2/erp/page/:category/:page` | erpV2Routes.js:48 | Fetch an ERP page by category and page name |
| GET | `/v2/erp/page/:pageKey` | erpV2Routes.js:53 | Fetch an ERP page by combined key |
| POST | `/v2/erp/batch` | erpV2Routes.js:57 | Batch-fetch multiple ERP pages |
| GET | `/v2/erp/ui/:category/:page` | erpV2Routes.js:78 | Get UI hints (field labels, layout metadata) |
| GET | `/v2/erp/ui/:pageKey` | erpV2Routes.js:90 | Get UI hints by combined key |
| GET | `/v2/erp/schema/:category/:page` | erpV2Routes.js:101 | Get render schema |
| GET | `/v2/erp/schema/:pageKey` | erpV2Routes.js:113 | Get render schema by combined key |
| POST | `/v2/erp/action/execute` | erpV2Routes.js:124 | Execute registered ERP action |
| POST | `/attendance/mark` | attendanceRoutes.js:11 | Submit 7-char attendance code |
| GET | `/captcha` | authRoutes.js:84 | Fetch captcha image + bootstrap form |
| GET | `/auth/captcha` | authRoutes.js:85 | Alias for /captcha |
| POST | `/login` | authRoutes.js:153 | Login with username, password, captcha |
| POST | `/auth/login` | authRoutes.js:154 | Alias for /login |
| POST | `/dev/login` | authRoutes.js:197 | Dev login (skips captcha) |
| POST | `/auth/dev-login` | authRoutes.js:198 | Alias for /dev/login |
| POST | `/forgot` | authRoutes.js:292 | Initiate or complete password reset |
| POST | `/auth/forgot` | authRoutes.js:293 | Alias for /forgot |
| POST | `/logout` | authRoutes.js:300 | Clear session cookie |
| POST | `/auth/logout` | authRoutes.js:301 | Alias for /logout |
| GET | `/profile` | authRoutes.js:356 | Get cached or refetch ERP profile |
| GET | `/auth/profile` | authRoutes.js:357 | Alias for /profile |
| GET | `/scrape/:pageKey` | scrapeRoutes.js:36 | Scrape ERP page by key |
| GET | `/scrape/:category/:page` | scrapeRoutes.js:40 | Scrape by category and page |
| GET | `/scrape/examination/earlier-internal-marks/semester/:semester` | scrapeRoutes.js:45 | Scrape earlier internal marks for semester |
| GET | `/:category/:page` | scrapeRoutes.js:87 | Backward-compat legacy scrape |
| GET | `/:pageKey` | scrapeRoutes.js:92 | Backward-compat scrape |
| GET | `/feedback/end-semester/status` | feedbackRoutes.js:12 | Get end-semester feedback status |
| GET | `/feedback/end-semester/templates/random` | feedbackRoutes.js:25 | Get random feedback template |
| POST | `/feedback/end-semester/submit` | feedbackRoutes.js:34 | Submit end-semester feedback |
| POST | `/content/admin/verify` | contentRoutes.js:31 | Verify admin password |
| GET | `/content` | contentRoutes.js:36 | List content with filters |
| POST | `/content` | contentRoutes.js:48 | Create content (admin) |
| GET | `/content/admin/workflow` | contentRoutes.js:53 | Get lifecycle workflow spec |
| POST | `/content/bulk/preview` | contentRoutes.js:58 | Preview bulk lifecycle |
| POST | `/content/bulk/execute` | contentRoutes.js:66 | Execute bulk lifecycle |
| GET | `/content/:id` | contentRoutes.js:78 | Get single content item |
| PUT | `/content/:id` | contentRoutes.js:90 | Update content (admin) |
| GET | `/content/:id/history` | contentRoutes.js:98 | Get audit history |
| PATCH | `/content/:id/lifecycle` | contentRoutes.js:103 | Transition lifecycle state |
| DELETE | `/content/:id` | contentRoutes.js:115 | Soft-delete content |
| GET | `/content/:id/resources` | contentRoutes.js:120 | List resources for content |
| POST | `/content/:id/resources` | contentRoutes.js:130 | Add resource to content (admin) |
| POST | `/uploads` | resourceRoutes.js:56 | Upload file (returns URL) |
| GET | `/resources/catalog` | resourceRoutes.js:74 | Get learning material catalog |
| GET | `/resources/subjects` | resourceRoutes.js:90 | Get subjects for year + course |
| GET | `/resources/library` | resourceRoutes.js:109 | Get learning material library |
| GET | `/resources/admin/items` | resourceRoutes.js:132 | Admin list materials |
| POST | `/resources/items` | resourceRoutes.js:171 | Admin create material |
| PUT | `/resources/items/:contentId` | resourceRoutes.js:191 | Admin update material |
| DELETE | `/resources/items/:contentId` | resourceRoutes.js:211 | Admin delete material |
| GET | `/resources/items/:contentId/history` | resourceRoutes.js:221 | Admin get audit history |
| PATCH | `/resources/items/:contentId/lifecycle` | resourceRoutes.js:232 | Admin transition lifecycle |
| POST | `/resources/admin/items/bulk-preview` | resourceRoutes.js:252 | Admin preview bulk |
| POST | `/resources/admin/items/bulk-execute` | resourceRoutes.js:264 | Admin execute bulk |
| POST | `/resources/recommendations` | resourceRoutes.js:281 | Submit recommendation |
| GET | `/resources/recommendations` | resourceRoutes.js:336 | Admin list recommendations |
| PATCH | `/resources/recommendations/:contentId` | resourceRoutes.js:352 | Admin approve/reject recommendation |

### Database Tables

| Table | File | Fields | Description |
|-------|------|--------|-------------|
| `content` | contentStore.js:249 | id, type, title, description, category, start_date, end_date, location, metadata_json, lifecycle_state, version, deleted_at, last_actor, created_at, updated_at | Unified content store |
| `resources` | contentStore.js:269 | id, content_id, kind, title, url_or_path, mime_type, size_bytes, created_at | Content attachments |
| `content_audit` | contentStore.js:283 | id, content_id, action, actor_id, actor_role, reason, before_json, after_json, diff_json, created_at | Audit log |

### Key Services

> File references below are the original audit baseline. The 2026-05-31 backend update above records the completed service splits and current verification status.

| Service | File | Description |
|---------|------|-------------|
| ErpAggregationService | erpAggregationService.js | Orchestrates ERP data with cache-first/live-first, circuit breaker, semaphore, Redis lock, request coalescing, stale-refresh |
| erpClient | erpClient.js | Playwright HTTP client for SRM ERP: captcha, login, profile, attendance, generic endpoints |
| ErpLiveService | erpLiveService.js | High-level live-scraping with concurrency, grouped results, special handlers |
| ErpCacheStore | erpCacheStore.js | TTL-based cache (in-memory Map or Redis) |
| erpPayloadNormalizer | erpPayloadNormalizer.js | Post-processes scraped HTML into normalized tables |
| ContentStore | contentStore.js | SQLite CRUD with lifecycle, soft-delete, audit, learning material queries |
| cgpaSummary | cgpaSummary.js | Extracts CGPA from HTML via cheerio |

### Scraped ERP Page Keys

Academic: time-table, attendance-details, student-wise-subjects, course-registration, od-ml-details, student-attendance, minor-program-registration, cgpa-summary, sap-scholarships
Examination: current-semester-results, earlier-internal-marks, exam-mark-details, internal-mark-details, exam-registration
Finance: fee-due-details, fee-paid-details, payment-acknowledgment, online-payment-verification, bank-account-details
Hostel: room-details, hostel-layout-faqs, hostel-refund-policy, hostel-booking
Transport: transport-faqs, transport-registration, registration-acknowledgment, transport-refund-policy
SAP: attachments, details, feedback, sap-process, withdraw
Other: event-attendance, end-semester-feedback, mobile-verification, announcements, settings, logout, dashboard, profile

---

## 2. Events & Competitions

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/events` | List events with filters |
| GET | `/events/calendar` | Events for calendar view |
| GET | `/events/my-registrations` | Current user's registrations |
| GET | `/events/my-registered` | Alias |
| GET | `/events/my-created` | Events created by user |
| GET | `/events/analytics` | Aggregate analytics |
| GET | `/events/notifications` | User notifications |
| POST | `/events/notifications/reminders` | Create reminders |
| PATCH | `/events/notifications/:id/read` | Mark notification read |
| POST | `/events` | Create event |
| POST | `/events/bulk-action` | Bulk publish/unpublish/delete |
| GET | `/events/:eventId` | Get event detail |
| PUT | `/events/:eventId` | Update event |
| PUT | `/events/:eventId/co-organizers` | Update co-organizers |
| DELETE | `/events/:eventId` | Delete event |
| POST | `/events/:eventId/duplicate` | Duplicate as draft |
| PATCH | `/events/:eventId/status` | Transition status |
| PATCH | `/events/:eventId/approval` | Approve/reject |
| POST | `/events/:eventId/register` | Register user |
| POST | `/events/:eventId/cancel-registration` | Cancel registration |
| POST | `/events/:eventId/check-in` | Check in attendee |
| GET | `/events/:eventId/attendees.csv` | Export CSV |
| POST | `/events/:eventId/messages` | Bulk message attendees |
| POST | `/events/:eventId/feedback` | Submit feedback |
| POST | `/events/:eventId/gallery` | Add gallery photo |
| GET | `/events/:eventId/ical` | Export iCal |
| GET | `/competitions/:eventId/config` | Competition config with rounds |
| GET | `/competitions/:eventId/my-role` | User role/permissions |
| GET | `/competitions/:eventId/roles` | List roles |
| POST | `/competitions/:eventId/roles` | Assign role |
| DELETE | `/competitions/:eventId/roles/:regNo` | Remove role |
| GET | `/competitions/:eventId/certificate-template` | Get template config |
| PUT | `/competitions/:eventId/certificate-template` | Save template |
| POST | `/competitions/:eventId/certificate-template/image` | Upload template image |
| GET | `/competitions/:eventId/analytics` | Competition analytics |
| POST | `/competitions/:eventId/rounds/:roundId/submit` | Submit for round |
| GET | `/competitions/:eventId/rounds/:roundId/my-submission` | My latest submission |
| GET | `/competitions/:eventId/rounds/:roundId/my-result` | My result |
| GET | `/competitions/:eventId/rounds/:roundId/submissions` | List submissions (evaluators) |
| PUT | `/competitions/:eventId/rounds/:roundId/submissions/:id/evaluate` | Evaluate submission |
| GET | `/competitions/:eventId/rounds/:roundId/submissions/:id/evaluations` | Get evaluations |
| PUT | `/competitions/:eventId/rounds/:roundId/submissions/:id/flag` | Flag/unflag submission |
| POST | `/competitions/:eventId/rounds/:roundId/shortlist` | Apply shortlist |
| POST | `/competitions/:eventId/rounds/:roundId/publish` | Publish results |
| GET | `/competitions/:eventId/rounds/:roundId/leaderboard` | Get leaderboard |
| POST | `/competitions/:eventId/rounds/:roundId/certificates/generate` | Generate PDFs |
| GET | `/competitions/:eventId/rounds/:roundId/certificates/me` | My certificate metadata |
| GET | `/competitions/:eventId/rounds/:roundId/certificates/me/download` | Download PDF |
| POST | `/competitions/reminders/run` | Process reminders |
| POST | `/competitions/:eventId/announce` | Send announcement |
| POST | `/competitions/:eventId/teams` | Create team |
| GET | `/competitions/:eventId/teams/my-team` | Get my team |
| POST | `/competitions/:eventId/teams/:teamId/invite` | Invite member |
| DELETE | `/competitions/:eventId/teams/:teamId/invite/:regNo` | Cancel invitation |
| PUT | `/competitions/:eventId/teams/:teamId/leader` | Transfer leadership |
| DELETE | `/competitions/:eventId/teams/:teamId/members/me` | Leave team |
| DELETE | `/competitions/:eventId/teams/:teamId` | Delete team |
| POST | `/competitions/:eventId/invitations/:id/accept` | Accept invitation |
| POST | `/competitions/:eventId/invitations/:id/decline` | Decline invitation |
| GET | `/competitions/:eventId/invitations/my-invitations` | My pending invitations |
| GET | `/campus-feedback/governance` | Governance metadata |
| GET | `/campus-feedback/:type/options` | Feedback target options |
| POST | `/campus-feedback/:type/options` | Create option (admin) |
| POST | `/campus-feedback/:type/submissions` | Submit feedback |
| POST | `/campus-feedback/:type/legacy-import` | Bulk-import legacy |
| GET | `/campus-feedback/me/submissions` | My submissions |
| GET | `/campus-feedback/admin/submissions` | All submissions (admin) |
| PATCH | `/campus-feedback/admin/submissions/:id` | Moderate entry (admin) |

### Database Tables

| Table | File | Description |
|-------|------|-------------|
| `events_state` | eventsStore.js:150 | Key-value store for 6 entity types |
| `submissions` | competitionStore.js:93 | Competition submissions |
| `rounds` | competitionStore.js:130 | Competition round definitions |
| `teams` | competitionStore.js:151 | Competition teams |
| `team_invitations` | competitionStore.js:162 | Team invitations |
| `evaluations` | competitionStore.js:177 | Per-evaluator scoring |
| `reminder_marks` | competitionStore.js:199 | Reminder dedup |
| `event_roles` | competitionStore.js:210 | Custom role assignments |
| `certificate_templates` | competitionStore.js:223 | Certificate config |
| `campus_feedback_options` | campusFeedbackStore.js:140 | Feedback targets |
| `campus_feedback_entries` | campusFeedbackStore.js:153 | Feedback submissions |
| `campus_feedback_audit` | campusFeedbackStore.js:175 | Moderation audit trail |

### Key Services

| Service | File | Description |
|---------|------|-------------|
| EventsStore | eventsStore.js | Full lifecycle: CRUD, recurrence, registration, check-in, notifications, feedback, gallery, approvals, CSV/iCal, analytics |
| CompetitionStore | competitionStore.js | Rounds, submissions, evaluations, shortlisting, leaderboard, certificates, teams, roles |
| CampusFeedbackStore | campusFeedbackStore.js | Options CRUD, submission with dedup, moderation, governance |

---

## 3. LMS

### API Endpoints (88 total)

Tracker: GET `/lms/tracker/overview`, `/lms/tracker/insights`, `/lms/tracker/unified-insights`, `/lms/tracker/history`, `/lms/tracker/recommendation-events`, POST `/lms/tracker/recommendation-events`

Resources: GET `/lms/resources`, `/lms/resources/check-duplicate`, `/lms/resources/:id`, POST `/lms/resources`, PUT `/lms/resources/:id`, DELETE `/lms/resources/:id`, POST `/lms/resources/:id/restore`, POST `/lms/resources/bulk`

Interactions: POST `/lms/resources/:id/upvote`, `/lms/resources/:id/bookmark`, `/lms/resources/:id/flag`, `/lms/resources/:id/mark-outdated`, `/lms/resources/:id/rate`, `/lms/resources/:id/view`

Comments: GET/POST `/lms/resources/:id/comments`, POST `/lms/comments/:id/helpful`

Annotations: GET/POST `/lms/resources/:id/annotations`, DELETE `/lms/annotations/:id`

PYQ: GET `/lms/pyq/upcoming`, `/lms/pyq/:subjectCode`

Requests: GET/POST `/lms/requests`, POST `/lms/requests/:id/upvote`, POST `/lms/requests/:id/fulfill`, DELETE `/lms/requests/:id`

Exam Feedback: GET `/lms/exam-feedback/pending`, POST `/lms/exam-feedback`

Quiz: POST `/lms/resources/:id/quiz-attempt`, GET `/lms/resources/:id/quiz-attempts`

Question Bank: GET/POST `/lms/question-bank`, POST `/lms/question-bank/:id/upvote`, GET `/lms/question-bank/build-quiz`

Collections: GET/POST `/lms/collections`, GET `/lms/collections/:id`, POST `/lms/collections/:id/items`, DELETE `/lms/collections/:id/items/:resourceId`

Guides: GET/POST `/lms/guides`, GET/PUT/DELETE `/lms/guides/:id`, POST `/lms/guides/:id/sections`, PUT `/lms/guides/:id/sections/:sid`, POST `/lms/guides/:id/sections/:sid/read`, POST `/lms/guides/:id/upvote`, GET `/lms/guides/:id/export`

Roadmaps: GET/POST `/lms/roadmaps`, GET/DELETE `/lms/roadmaps/:id`, POST `/lms/roadmaps/:id/nodes`, POST `/lms/roadmaps/:id/edges`, POST `/lms/roadmaps/:id/nodes/:nid/complete`

Recommendations: GET `/lms/recommendations/next-step`, GET `/lms/recommendations`
Explore: GET `/lms/explore`
Subjects: GET `/lms/subjects/:code/overview`, `/lms/subjects/:code/presence`
Topics: GET `/lms/topics/graph`
Leaderboard: GET `/lms/leaderboard/weekly`

Progress/Mastery: GET `/lms/progress`, `/lms/progress/:subjectCode`, `/lms/mastery`
Continue: GET `/lms/continue`
Revision: GET `/lms/revision`, POST `/lms/revision/:resourceId/review`
Streak: GET `/lms/streak`
Session: POST `/lms/session/generate`

My Data: GET `/lms/me/contributions`, `/lms/me/bookmarks`, `/lms/me/activity`, `/lms/me/requests`, `/lms/me/export/:guideId`
Preferences: PUT `/lms/me/preferences`
Contributors: GET `/lms/contributors/:userId`

Admin: GET `/lms/admin/resource-flags`, PATCH `/lms/admin/resources/:id/moderation`, GET `/lms/admin/flags`, PUT `/lms/admin/flags/:key`

### Database Tables (45 tables)

lms_resources, lms_upvotes, lms_bookmarks, lms_flags, lms_outdated_marks, lms_comments, lms_comment_helpful, lms_ratings, lms_annotations, lms_collections, lms_collection_items, lms_requests, lms_request_upvotes, lms_exam_feedback, lms_guides, lms_guide_sections, lms_guide_progress, lms_roadmaps, lms_roadmap_nodes, lms_roadmap_edges, lms_roadmap_progress, lms_topics, lms_resource_topics, lms_topic_prerequisites, lms_question_bank, lms_quiz_questions, lms_progress, lms_topic_mastery, lms_subject_mastery, lms_quiz_attempts, lms_revision_queue, lms_streaks, lms_user_interactions, lms_user_preferences, lms_resource_effectiveness, lms_user_storage, lms_resource_versions, lms_guide_versions, lms_ranking_shadow, lms_feature_flags, lms_experiments, lms_schema_version, lms_search (FTS5), lms_resource_moderation_audit, lms_tracker_snapshots, lms_tracker_recommendation_events

### Key Services

LmsStore (4 files, ~120 methods), LmsRecommendationEngine (8-signal scorer), LmsModerationService, LmsRevisionScheduler (spaced repetition), LmsInteractionTracker, LmsInteractionQueue, LmsDuplicateDetector, LmsExamFeedbackService, LmsReadingTimeEstimator, LmsFeatureFlagService, LmsTrackerService (~1390 lines), LmsTrackerStore

---

## 4. Career Portal

### API Endpoints (42 total)

GET `/career/permissions`, `/career/trending`, `/career/deadline-soon`, `/career/feed`, `/career/insights/unified`, `/career/health`, `/career/stats`

GET/POST `/career/opportunities`, GET/PUT/DELETE `/career/opportunities/:id`
POST `/career/opportunities/:id/save`, DELETE `/career/opportunities/:id/save`
POST `/career/opportunities/:id/bookmark`, `/dismiss`, `/view`, `/apply`, `/flag`

GET/PUT `/career/profile`, GET `/career/profile/skill-gaps`, POST `/career/profile/resume`

GET/POST `/career/applications`, PUT/DELETE `/career/applications/:id`

POST `/career/submit`, GET `/career/submit/mine`, `/career/submit/pending`
POST `/career/submit/:id/approve`, PATCH `/career/submit/:id`

GET/POST `/career/interviews/slots`, PUT/DELETE `/career/interviews/slots/:id`
GET/POST `/career/interviews/bookings`, DELETE `/career/interviews/bookings/:id`

GET/POST `/career/alumni`, PUT/DELETE `/career/alumni/:id`
POST `/career/alumni/:id/requests`

### Database Tables (16 + 1 FTS5)

career_opportunities, career_bookmarks, career_applications, career_flags, career_dismissals, career_views, career_submissions, career_submission_audit, career_scraper_runs, career_source_health, career_profiles, career_skill_gaps, career_alumni, career_interview_slots, career_interview_bookings, career_notification_log, career_search (FTS5)

### Key Services

CareerStore (~60 methods), CareerCache (Redis), CareerNotifier (deadline reminders + skill digest), CareerRelevanceEngine (skill/branch/year/preference scoring)

### Rate Limiters

Submit: 20/hour, Review: 60/min, Pending list: 40/min

---

## 5. Helpdesk & Feedback

### API Endpoints

GET/POST `/helpdesk/tickets`, PATCH `/helpdesk/tickets/bulk`
GET/PATCH `/helpdesk/tickets/:ticketId`
POST `/helpdesk/tickets/:ticketId/escalate`, `/tickets/:ticketId/replies`
GET/POST `/helpdesk/faqs`, PUT/DELETE `/helpdesk/faqs/:faqId`
GET `/feedback/end-semester/status`, `/feedback/end-semester/templates/random`
POST `/feedback/end-semester/submit`

### Database Tables

helpdesk_state (key-value for tickets, replies, FAQs), campus_feedback_options, campus_feedback_entries, campus_feedback_audit

### Key Services

HelpdeskStore (ticket CRUD, SLA breach, escalation, audit), FeedbackAutomationService (auto-submits via ERP scrape), feedbackTemplates (5 templates)

---

## 6. Admin & Infrastructure

### API Endpoints

GET `/admin/access/status`, POST `/admin/access/unlock`, POST `/admin/access/disable`
POST `/telemetry/frontend`
GET `/debug/ping`, `/health`, `/live`, `/ready`
GET `/external/:category/:page`, `/external/:pageKey`

### Config & Middleware

ADMIN_REGISTER_NUMBERS (1 entry: AP23110010419), adminContext middleware, requestContext middleware (UUID, timing, metrics), hasAdminAccess/assertAdminAccess (session + header + body + query gate), Redis rate limiter

---

## Summary

| Domain | Endpoints | DB Tables | Services |
|--------|-----------|-----------|----------|
| Academic / ERP Core | 55 | 3 | 7 |
| Events & Competitions | 70 | 12 | 3 |
| LMS | 88 | 45 | 12 |
| Career Portal | 42 | 17 | 4 |
| Helpdesk & Feedback | 14 | 4 | 3 |
| Admin & Infrastructure | 10 | 0 | 3 |
| **Total** | **279** | **81** | **32** |
