# Backend Audit: University-ERP
Generated: 2026-05-30

---

## 1. Academic / ERP Core

### API Endpoints (55)

#### Auth (authRoutes.js)
GET `/captcha`, `/auth/captcha` — fetch captcha + bootstrap login form
POST `/login`, `/auth/login` — login with username, password, captcha
POST `/dev/login`, `/auth/dev-login` — dev-mode login (skips captcha)
POST `/forgot`, `/auth/forgot` — initiate or complete password reset
POST `/logout`, `/auth/logout` — clear session cookie
GET `/profile`, `/auth/profile` — get cached or refetch ERP profile

#### Attendance (attendanceRoutes.js)
POST `/attendance/mark` — submit 7-char attendance code

#### Conference (erpV2Routes.js)
GET `/v2/erp/page/:category/:page`, `/v2/erp/page/:pageKey` — fetch ERP page
POST `/v2/erp/batch` — batch-fetch multiple ERP pages
GET `/v2/erp/ui/:category/:page`, `/v2/erp/ui/:pageKey` — get UI hints
GET `/v2/erp/schema/:category/:page`, `/v2/erp/schema/:pageKey` — get render schema
POST `/v2/erp/action/execute` — execute registered ERP action

#### Legacy Scrape (scrapeRoutes.js)
GET `/scrape/:pageKey`, `/scrape/:category/:page` — scrape ERP page
GET `/scrape/examination/earlier-internal-marks/semester/:semester`
GET `/:category/:page`, `/:pageKey` — backward-compat legacy scrape

#### End-Semester Feedback (feedbackRoutes.js)
GET `/feedback/end-semester/status`
GET `/feedback/end-semester/templates/random`
POST `/feedback/end-semester/submit`

#### Content Management (contentRoutes.js)
POST `/content/admin/verify` — verify admin password
GET `/content` — list content with filters
POST `/content` — create content (admin)
GET `/content/admin/workflow` — lifecycle workflow spec
POST `/content/bulk/preview`, `/content/bulk/execute` — bulk lifecycle
GET `/content/:id` — get single content
PUT `/content/:id` — update content (admin)
GET `/content/:id/history` — audit history
PATCH `/content/:id/lifecycle` — transition lifecycle
DELETE `/content/:id` — soft-delete
GET `/content/:id/resources` — list attached resources
POST `/content/:id/resources` — add resource (admin)

#### Resources / Learning Materials (resourceRoutes.js)
POST `/uploads` — file upload
GET `/resources/catalog` — learning material catalog
GET `/resources/subjects` — subjects for year + course
GET `/resources/library` — material library
GET `/resources/admin/items` — admin list
POST `/resources/items` — admin create material
PUT `/resources/items/:contentId` — admin update
DELETE `/resources/items/:contentId` — admin delete
GET `/resources/items/:contentId/history` — admin audit history
PATCH `/resources/items/:contentId/lifecycle` — admin lifecycle
POST `/resources/admin/items/bulk-preview`, `/bulk-execute`
POST `/resources/recommendations` — student submit recommendation
GET `/resources/recommendations` — admin list
PATCH `/resources/recommendations/:contentId` — admin approve/reject

### Database Tables

`content` (contentStore.js) — unified store: id, type, title, description, category, dates, metadata_json, lifecycle_state, version, deleted_at, last_actor, timestamps
`resources` (contentStore.js) — attachments: id, content_id, kind, title, url_or_path, mime_type, size_bytes, created_at
`content_audit` (contentStore.js) — audit log: id, content_id, action, actor_id, actor_role, reason, before_json, after_json, diff_json, created_at

### Key Services

| Service | File | What it does |
|---------|------|-------------|
| ErpAggregationService | erpAggregationService.js | Orchestrates ERP data: cache-first/live-first, circuit breaker, semaphore concurrency, Redis locking, request coalescing, stale-refresh |
| erpClient | erpClient.js | Playwright HTTP client for SRM ERP: captcha fetch, login, profile, attendance code submission, generic endpoint calls with HTML parsing |
| ErpLiveService | erpLiveService.js | High-level live-scraping: resolves targets from scrapeTargets.js, calls endpoints concurrently, assembles grouped results, special handlers for profile, CGPA, earlier marks |
| ErpCacheStore | erpCacheStore.js | TTL-based cache (InMemory Map or Redis), returns null for expired/missing |
| erpPayloadNormalizer | erpPayloadNormalizer.js | Post-processes scraped HTML: removes duplicate headers, fixes shifted columns, repairs attendance percentages, produces tableFingerprints |
| ContentStore | contentStore.js | SQLite CRUD: lifecycle state machine (draft→review→published→archived→deleted), soft-delete, audit trail, bulk transitions, learning material queries |
| cgpaSummary | cgpaSummary.js | Extracts CGPA from raw HTML via cheerio heuristics |

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

### API Endpoints (70)

#### Events CRUD (eventsRoutes.js)
GET `/events` — list with filters (query, category, department, status, visibility, type, dates, myEvents, registered, createdBy)
GET `/events/calendar` — calendar-formatted list
GET `/events/my-registrations`, `/events/my-registered` — current user's registrations
GET `/events/my-created` — current user's created events
GET `/events/analytics` — aggregates (totals, popular, trend, avg feedback)
GET `/events/notifications` — user notifications
POST `/events/notifications/reminders` — create reminders
PATCH `/events/notifications/:id/read` — mark read
POST `/events` — create event
POST `/events/bulk-action` — bulk publish/unpublish/delete
GET `/events/:eventId` — single event detail (with registrations, feedback, gallery, check-ins)
PUT `/events/:eventId` — update event
PUT `/events/:eventId/co-organizers` — update co-organizers
DELETE `/events/:eventId` — delete
POST `/events/:eventId/duplicate` — duplicate as draft
PATCH `/events/:eventId/status` — transition status
PATCH `/events/:eventId/approval` — approve/reject
POST `/events/:eventId/register` — register user
POST `/events/:eventId/cancel-registration` — cancel with reason
DELETE `/events/:eventId/register` — cancel (default reason)
POST `/events/:eventId/check-in` — check in via code
GET `/events/:eventId/attendees.csv` — CSV export
POST `/events/:eventId/messages` — bulk message attendees
POST `/events/:eventId/feedback` — submit feedback
POST `/events/:eventId/gallery` — add gallery photo
GET `/events/:eventId/ical` — iCal export

#### Competitions (competitionRoutes.js)
GET `/competitions/:eventId/config` — config with rounds
GET `/competitions/:eventId/my-role` — user role/permissions
GET `/competitions/:eventId/roles` — list roles
POST `/competitions/:eventId/roles` — assign role
DELETE `/competitions/:eventId/roles/:regNo` — remove role
GET `/competitions/:eventId/certificate-template` — template config
PUT `/competitions/:eventId/certificate-template` — save template
POST `/competitions/:eventId/certificate-template/image` — upload image
GET `/competitions/:eventId/analytics` — registrations, round stats
POST `/competitions/:eventId/rounds/:roundId/submit` — submit file/link
GET `/competitions/:eventId/rounds/:roundId/my-submission` — my latest
GET `/competitions/:eventId/rounds/:roundId/my-result` — my result
GET `/competitions/:eventId/rounds/:roundId/submissions` — all submissions (evaluators+)
PUT `/competitions/:eventId/rounds/:roundId/submissions/:id/evaluate` — evaluate
GET `/competitions/:eventId/rounds/:roundId/submissions/:id/evaluations` — get evaluations
PUT `/competitions/:eventId/rounds/:roundId/submissions/:id/flag` — flag/unflag
POST `/competitions/:eventId/rounds/:roundId/shortlist` — apply shortlist
POST `/competitions/:eventId/rounds/:roundId/publish` — publish results
GET `/competitions/:eventId/rounds/:roundId/leaderboard` — leaderboard
POST `/competitions/:eventId/rounds/:roundId/certificates/generate` — generate PDFs
GET `/competitions/:eventId/rounds/:roundId/certificates/me` — my cert metadata
GET `/competitions/:eventId/rounds/:roundId/certificates/me/download` — download PDF
POST `/competitions/reminders/run` — process deadline reminders
POST `/competitions/:eventId/announce` — send announcement
POST `/competitions/:eventId/teams` — create team
GET `/competitions/:eventId/teams/my-team` — get my team
POST `/competitions/:eventId/teams/:teamId/invite` — invite member
DELETE `/competitions/:eventId/teams/:teamId/invite/:regNo` — cancel invite
PUT `/competitions/:eventId/teams/:teamId/leader` — transfer leadership
DELETE `/competitions/:eventId/teams/:teamId/members/me` — leave team
DELETE `/competitions/:eventId/teams/:teamId` — delete team
POST `/competitions/:eventId/invitations/:id/accept` — accept invite
POST `/competitions/:eventId/invitations/:id/decline` — decline invite
GET `/competitions/:eventId/invitations/my-invitations` — pending invites

#### Campus Feedback (campusFeedbackRoutes.js)
GET `/campus-feedback/governance` — governance metadata
GET `/campus-feedback/:type/options` — feedback target options
POST `/campus-feedback/:type/options` — create option (admin)
POST `/campus-feedback/:type/submissions` — submit feedback
POST `/campus-feedback/:type/legacy-import` — bulk-import legacy
GET `/campus-feedback/me/submissions` — my submissions
GET `/campus-feedback/admin/submissions` — all submissions (admin)
PATCH `/campus-feedback/admin/submissions/:id` — moderate (admin)

### Database Tables (12)

**events_state** (eventsStore.js, key-value) — stores 6 entity types as JSON: events, registrations, notifications, feedback, gallery, checkIns

**competitionStore.js** — 8 dedicated tables:
- `submissions` — id, eventId, roundId, submittedBy, type, filePath, linkUrl, description, submittedAt, resubmittedAt, resubmissionCount, criteriaScores, totalScore, remarks, evaluatedBy, evaluatedAt, decision, shortlisted, flagged, flagReason, teamId
- `rounds` — id, eventId, roundId, title, type, startTime, submissionDeadline, instructions, submissionTypes, maxFileSizeMb, maxResubmissions, evaluationCriteria, shortlistCount, shortlistThreshold, requiresShortlistFromRound, resultsPublished
- `teams` — id, eventId, name, leaderId, members (JSON)
- `team_invitations` — id, teamId, eventId, invitedBy, inviteeRegisterNumber, status
- `evaluations` — id, submissionId, eventId, roundId, evaluatorId, criteriaScores (JSON), totalScore, remarks, decision
- `reminder_marks` — id, eventId, roundId, userId, marker (dedup)
- `event_roles` — id, eventId, regNo, name, role, assignedBy
- `certificate_templates` — eventId, roundId, templateImagePath, fields (JSON)

**campusFeedbackStore.js** — 3 tables:
- `campus_feedback_options` — id, type, label, active, creator info
- `campus_feedback_entries` — id, type, target_id, target_label, ratings_json, comment, status, creator info, dedupe_key, moderation fields
- `campus_feedback_audit` — id, feedback_id, action, from_status, to_status, reason, actor info

### Key Services

| Service | What it does |
|---------|-------------|
| EventsStore | Full lifecycle: CRUD, recurrence, registration, check-in, notifications, feedback, gallery, bulk actions, approval workflow, CSV/iCal export, analytics, calendar generation |
| CompetitionStore | Competition sub-system: rounds config, submissions (file/link), evaluation with criteria scoring, shortlisting, leaderboard, result publishing, certificate PDF generation, deadline reminders, team management (create/invite/accept/decline/transfer/leave/delete), role-based access control, custom role assignments |
| CampusFeedbackStore | Feedback option CRUD (admin), submission with ratings/comment/deduplication (throttled), legacy import, moderation workflow (approve/reject with audit trail), governance metadata |

---

## 3. LMS (Learning Management System)

### API Endpoints (88)

#### Tracker (6 endpoints)
GET `/lms/tracker/overview` — CGPA, attendance, credits
GET `/lms/tracker/insights` — GPA trend, category performance, recommendations
GET `/lms/tracker/unified-insights` — cross-domain (academic + career + LMS)
GET `/lms/tracker/history` — snapshot history by type
GET/POST `/lms/tracker/recommendation-events` — list/record

#### Resources CRUD (8 endpoints)
GET `/lms/resources` — list/filter with pagination
GET `/lms/resources/check-duplicate` — check file/title duplicate
GET/POST `/lms/resources/:id` — get/create
PUT/DELETE `/lms/resources/:id` — update/soft-delete
POST `/lms/resources/:id/restore` — restore deleted
POST `/lms/resources/bulk` — admin bulk operation

#### Interactions (6 endpoints)
POST `/lms/resources/:id/upvote` — toggle upvote
POST `/lms/resources/:id/bookmark` — toggle bookmark
POST `/lms/resources/:id/flag` — flag/report
POST `/lms/resources/:id/mark-outdated` — mark outdated
POST `/lms/resources/:id/rate` — rate with review + dimension tags
POST `/lms/resources/:id/view` — track view

#### Comments (3 endpoints)
GET/POST `/lms/resources/:id/comments` — list/add
POST `/lms/comments/:id/helpful` — toggle helpful

#### Annotations (3 endpoints)
GET/POST `/lms/resources/:id/annotations` — get/save
DELETE `/lms/annotations/:id` — delete

#### PYQ (2 endpoints)
GET `/lms/pyq/upcoming` — PYQs for enrolled subjects
GET `/lms/pyq/:subjectCode` — PYQ bank for subject

#### Requests (5 endpoints)
GET/POST `/lms/requests` — list/create
POST `/lms/requests/:id/upvote` — upvote request
POST `/lms/requests/:id/fulfill` — mark fulfilled
DELETE `/lms/requests/:id` — close/delete

#### Exam Feedback (2 endpoints)
GET `/lms/exam-feedback/pending` — pending feedback
POST `/lms/exam-feedback` — submit

#### Quiz (2 endpoints)
POST `/lms/resources/:id/quiz-attempt` — record attempt
GET `/lms/resources/:id/quiz-attempts` — user's attempts

#### Question Bank (4 endpoints)
GET/POST `/lms/question-bank` — list/add
POST `/lms/question-bank/:id/upvote` — upvote
GET `/lms/question-bank/build-quiz` — build quiz

#### Collections (5 endpoints)
GET/POST `/lms/collections` — list/create
GET `/lms/collections/:id` — get with items
POST `/lms/collections/:id/items` — add resource
DELETE `/lms/collections/:id/items/:resourceId` — remove

#### Guides (12 endpoints)
GET/POST `/lms/guides` — list/create
GET/PUT/DELETE `/lms/guides/:id` — get/update/delete
POST `/lms/guides/:id/sections` — add section
PUT `/lms/guides/:id/sections/:sid` — update section
POST `/lms/guides/:id/sections/:sid/read` — mark read
POST `/lms/guides/:id/upvote` — toggle upvote
GET `/lms/guides/:id/export` — export PDF

#### Roadmaps (8 endpoints)
GET/POST `/lms/roadmaps` — list/create
GET/DELETE `/lms/roadmaps/:id` — get/delete
POST `/lms/roadmaps/:id/nodes` — add node
POST `/lms/roadmaps/:id/edges` — add edge
POST `/lms/roadmaps/:id/nodes/:nid/complete` — mark complete

#### Recommendations (2 endpoints)
GET `/lms/recommendations/next-step` — quick next-step
GET `/lms/recommendations` — personalized

#### Explore (1 endpoint)
GET `/lms/explore` — trending, top-rated, exam-ready

#### Subjects (2 endpoints)
GET `/lms/subjects/:code/overview` — unit breakdown
GET `/lms/subjects/:code/presence` — count studying

#### Topics (1 endpoint)
GET `/lms/topics/graph` — prerequisite graph

#### Leaderboard (1 endpoint)
GET `/lms/leaderboard/weekly`

#### Progress/Mastery (4 endpoints)
GET `/lms/progress` — overall progress
GET `/lms/progress/:subjectCode` — subject progress
GET `/lms/mastery` — topic mastery map
GET `/lms/continue` — continue-learning resource

#### Revision (2 endpoints)
GET `/lms/revision` — revision queue
POST `/lms/revision/:resourceId/review` — submit review score

#### Streak (1 endpoint)
GET `/lms/streak`

#### Session (1 endpoint)
POST `/lms/session/generate` — generate learning session plan

#### My Data (5 endpoints)
GET `/lms/me/contributions` — contributed resources/guides/roadmaps
GET `/lms/me/bookmarks` — bookmarked resources
GET `/lms/me/activity` — recent activity
GET `/lms/me/requests` — resource requests
GET `/lms/me/export/:guideId` — export own guide as PDF

#### Preferences (1 endpoint)
PUT `/lms/me/preferences`

#### Contributors (1 endpoint)
GET `/lms/contributors/:userId` — profile with trust score

#### Admin (4 endpoints)
GET `/lms/admin/resource-flags` — moderation queue
PATCH `/lms/admin/resources/:id/moderation` — moderate
GET `/lms/admin/flags` — list feature flags
PUT `/lms/admin/flags/:key` — update flag

### Database Tables (45)

`lms_resources` — core resource: 40+ columns covering all metadata
`lms_upvotes`, `lms_bookmarks`, `lms_flags`, `lms_outdated_marks`
`lms_comments`, `lms_comment_helpful`, `lms_ratings`, `lms_annotations`
`lms_collections`, `lms_collection_items`
`lms_requests`, `lms_request_upvotes`
`lms_exam_feedback`
`lms_guides`, `lms_guide_sections`, `lms_guide_progress`
`lms_roadmaps`, `lms_roadmap_nodes`, `lms_roadmap_edges`, `lms_roadmap_progress`
`lms_topics`, `lms_resource_topics`, `lms_topic_prerequisites`
`lms_question_bank`, `lms_quiz_questions`
`lms_progress`, `lms_topic_mastery`, `lms_subject_mastery`
`lms_quiz_attempts`
`lms_revision_queue`
`lms_streaks`
`lms_user_interactions`, `lms_user_preferences`
`lms_resource_effectiveness`, `lms_user_storage`
`lms_resource_versions`, `lms_guide_versions`
`lms_ranking_shadow`
`lms_feature_flags`, `lms_experiments`
`lms_schema_version`
`lms_search` (FTS5 virtual)
`lms_resource_moderation_audit`
`lms_tracker_snapshots`, `lms_tracker_recommendation_events`

### Key Services (12)

| Service | What it does |
|---------|-------------|
| LmsStore | ~120 methods across 4 files (lmsStore.js, resources.js, moderation.js, resourceSearch.js). CRUD for all LMS entities, search indexing, moderation, quality scoring |
| LmsRecommendationEngine | 8-signal multi-factor scorer (subject match, type preference, quality, engagement, recency, effectiveness, topic gap, exam proven). 20% random exploration. Shadow ranking + preference adaptation |
| LmsModerationService | Computes moderation state (0-3) from flag count thresholds (1, 2, 5+) |
| LmsRevisionScheduler | Spaced repetition: fixed intervals [1, 3, 7, 14, 30] days. <60% score resets to day 1 |
| LmsInteractionTracker | Orchestrates event recording, applies side-effects (views, progress, bookmarks, upvotes), feeds recommendation engine, records streaks |
| LmsInteractionQueue | In-memory batching queue. Flushes on batch size or periodic interval. Dead-letter after max retries |
| LmsDuplicateDetector | SHA-256 file hash + normalized title for exact and similar duplicate checking |
| LmsExamFeedbackService | Determines pending resources by fetching user's current semester from ERP, then querying unreviewed resources |
| LmsReadingTimeEstimator | Estimates by type: notes 200wpm, quizzes 2min/q, flashcards 0.75min/card, PDFs 2min/MB, YouTube 8min, default 5min |
| LmsFeatureFlagService | Global/percentage/cohort rollout. Deterministic bucket for percentage rollouts. A/B experiment assignment |
| LmsTrackerService | High-level insight computation: GPA trend, category performance, attendance risk, career readiness, skill gaps, opportunity fit, ATS score, unified profile graph, action plans. ~1390 lines |
| LmsTrackerStore | Persistence for tracker snapshots and recommendation events (2 tables) |

### MIME Types Allowed

`.pdf`, `.zip`, `.docx`, `.pptx`, `.txt`, `.md`, `.png`, `.jpg`/`.jpeg`

---

## 4. Career Portal

### API Endpoints (42)

#### General (7 endpoints)
GET `/career/permissions` — check user permissions
GET `/career/trending` — trending opportunities (7d velocity)
GET `/career/deadline-soon` — bookmarked opps expiring within N days
GET `/career/feed` — personalized relevance-sorted feed
GET `/career/insights/unified` — unified LMS insights
GET `/career/health` — scraper health + recent runs
GET `/career/stats` — aggregate stats (by type, source, totals)

#### Opportunities CRUD (12 endpoints)
GET/POST `/career/opportunities` — list/create
GET/PUT/DELETE `/career/opportunities/:id` — get/update/delete
POST `/career/opportunities/:id/save` — bookmark
DELETE `/career/opportunities/:id/save` — unbookmark
POST `/career/opportunities/:id/bookmark` — toggle bookmark
POST `/career/opportunities/:id/dismiss` — dismiss from feed
POST `/career/opportunities/:id/view` — track view
POST `/career/opportunities/:id/apply` — track apply click
POST `/career/opportunities/:id/flag` — flag inappropriate

#### Profile (4 endpoints)
GET/PUT `/career/profile` — get/update
GET `/career/profile/skill-gaps` — skill gap analysis
POST `/career/profile/resume` — upload resume URL

#### Applications (4 endpoints)
GET/POST `/career/applications` — list/create
PUT/DELETE `/career/applications/:id` — update/delete

#### Submissions (6 endpoints)
POST `/career/submit` — submit for review
GET `/career/submit/mine` — my submissions
GET `/career/submit/pending` — admin pending list
POST `/career/submit/:id/approve` — admin approve
PATCH `/career/submit/:id` — admin review/reject

#### Interviews (7 endpoints)
GET/POST `/career/interviews/slots` — list/create
PUT/DELETE `/career/interviews/slots/:id` — update/delete
GET/POST `/career/interviews/bookings` — list/book
DELETE `/career/interviews/bookings/:id` — cancel

#### Alumni (5 endpoints)
GET/POST `/career/alumni` — list/create
PUT/DELETE `/career/alumni/:id` — update/delete
POST `/career/alumni/:id/requests` — request connection

### Database Tables (16 + 1 FTS5)

`career_opportunities` — core: type (job/internship/hackathon/competition/fellowship/workshop), title, company, organizer, description, requirements, skills, tags, location, mode, eligibleBranches, eligibleYears, minCGPA, stipend, prize, deadline, source, sourceUrl, fingerprint, applyUrl, viewCount, bookmarkCount, applyCount, relevanceScore, isActive, isVerified, isFeatured, moderationState, scrapedAt
`career_bookmarks` — opportunityId, userId (composite PK)
`career_applications` — id, opportunityId, userId, status, appliedAt, notes
`career_flags` — id, opportunityId, userId, reason (unique per opp+user)
`career_dismissals` — opportunityId, userId (composite PK)
`career_views` — opportunityId, userId, viewedAt (dedup)
`career_submissions` — student-submitted opportunities awaiting moderation
`career_submission_audit` — audit trail for submission lifecycle
`career_scraper_runs` — source, startedAt, completedAt, status, counts
`career_source_health` — source, lastSuccess, consecutiveFails, isBlocked
`career_profiles` — userId, skills, preferredTypes, preferredLocations, minStipend, cgpa, bio, linkedinUrl, githubUrl, portfolioUrl, resumeUrl
`career_skill_gaps` — userId, skill, opportunityCount (PK userId+skill)
`career_alumni` — id, userId, name, batch, branch, company, position, location, linkedinUrl, skills, isAvailableForMentoring
`career_interview_slots` — id, interviewerId, date, startTime, endTime, duration, type (mock/technical/behavioral/system_design), isBooked
`career_interview_bookings` — id, slotId, studentId, interviewerId, date, type, status, notes, feedback, rating
`career_notification_log` — userId, kind, refKey, sentDay (idempotency PK)
`career_search` — FTS5 virtual table on title, description, skills, tags, company, organizer

### Key Services

| Service | What it does |
|---------|-------------|
| CareerStore (~60 methods) | Core DAO: all CRUD operations, opportunity fingerprint dedup, eligibility gating by branch/year, skill gap analysis, auto-approval rules, FTS5 search |
| CareerCache | Optional Redis JSON cache for hot paths (stats, health, trending, feed). Degrades gracefully. 90s default TTL |
| CareerNotifier | Scheduled cycle: (1) deadline reminders for bookmarked opps within 3 days, (2) daily skill digest for new opps matching user skills. Idempotency via notification_log table |
| CareerRelevanceEngine | Stateless scoring (max 100): Skill Match 0-40, Branch Match 0-20, Year Match 0-20, Preference Match 0-20 + 15% base boost |

### Rate Limiters

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| createCareerSubmitLimiter | 1 hour | 20 | POST /career/submit |
| createCareerReviewLimiter | 1 min | 60 | POST /career/submit/:id/approve |
| createCareerPendingListLimiter | 1 min | 40 | GET /career/submit/pending |

---

## 5. Helpdesk & Feedback

### API Endpoints (14)

#### Helpdesk (11 endpoints)
GET `/helpdesk/tickets` — list with filters (query, status, queue, category, priority, owner, team)
POST `/helpdesk/tickets` — create ticket
PATCH `/helpdesk/tickets/bulk` — bulk update (admin)
GET `/helpdesk/tickets/:ticketId` — get single
PATCH `/helpdesk/tickets/:ticketId` — update (admin)
POST `/helpdesk/tickets/:ticketId/escalate` — escalate
POST `/helpdesk/tickets/:ticketId/replies` — add reply
GET/POST `/helpdesk/faqs` — list/create (admin)
PUT/DELETE `/helpdesk/faqs/:faqId` — update/delete (admin)

#### End-Semester Feedback (3 endpoints)
GET `/feedback/end-semester/status` — get status (pending/submitted subjects)
GET `/feedback/end-semester/templates/random` — random template
POST `/feedback/end-semester/submit` — submit for specified subjects

### Database Tables

`helpdesk_state` (helpdeskStore.js, key-value) — stores 3 collections as JSON: tickets, replies, FAQs. Loaded into memory at startup, persisted on every mutation.

**Ticket fields**: id, category, priority (urgent/high/medium/low), subject, description, status (open/in-progress/escalated/resolved), assignedTo, assignedTeam, ownerUserId, ownerName, department, createdAt, updatedAt, resolutionSummary, slaPolicyHours, slaDueAt, slaBreachedAt, statusHistory[], auditTrail[]
**Reply fields**: id, ticketId, message, visibility (public/internal), authorName, authorRole, createdAt
**FAQ fields**: id, question, answer, category, tags[], visible, createdAt, updatedAt

`campus_feedback_options`, `campus_feedback_entries`, `campus_feedback_audit` — shared with Events & Competitions domain (see section 2)

### Key Services

| Service | What it does |
|---------|-------------|
| HelpdeskStore | In-memory + SQLite CRUD: tickets (create, list, get, update, bulk-update, escalate, add reply), FAQs (CRUD). Includes SLA breach detection, queue-state derivation, priority-based sorting, audit trails |
| FeedbackAutomationService (~1390 lines) | Logs into student portal via session store, parses feedback landing page for pending subjects, constructs form payloads (answers + optional comment), submits each subject via AJAX-style POST, returns per-subject results |
| feedbackTemplates.js | 3 utilities: readFeedbackTemplates(), getRandomFeedbackTemplate(), validateFeedbackComment() (11-500 chars) |

**Feedback templates** (5): standardized positive comments about course structure, faculty clarity, pacing, assessment alignment

---

## 6. Admin & Infrastructure

### API Endpoints (10)

GET `/admin/access/status` — current admin status (registerNo, potentialAdmin, isAdmin)
POST `/admin/access/unlock` — elevate to admin (requires potentialAdmin)
POST `/admin/access/disable` — disable admin
POST `/telemetry/frontend` — frontend perf telemetry (gated by feature flag)
GET `/debug/ping` — debug info (dump dir, page count)
GET `/health` — full system health (sessions, discovery, policy, integrity, redis, scraper)
GET `/live` — liveness probe
GET `/ready` — readiness check
GET `/external/:category/:page` — fetch external SQLite data
GET `/external/:pageKey` — fetch external data by flat key

### Config & Middleware

`ADMIN_REGISTER_NUMBERS` (adminUsers.js) — hardcoded Set with 1 entry: "AP23110010419". Also exports normalizeRegisterNo(), extractRegisterNoFromProfile(), isPotentialAdminRegisterNo()

**Middleware**:
- `adminContext.js` — best-effort: attaches req.adminContext with registerNo, potentialAdmin, isElevated flags. Resolves session ID, extracts register number from profile, checks whitelist
- `requestContext.js` — assigns UUID requestId, sets x-request-id header, logs HTTP completion with duration/status/ip/user-agent, records metrics
- `rateLimit.js` — Redis-backed global rate limiter
- `careerRateLimit.js` — 3 career-specific limiters (see Career section)

**Utilities**:
- `adminAccess.js` — hasAdminAccess / assertAdminAccess: multi-source gate checking session elevation first, then x-admin-password header → body → query param
- `apiResponse.js` — standardized response helpers
- `logger.js` — structured logger
- `cookies.js` — session cookie resolvers

---

## Cross-Domain Summary

| Domain | Endpoints | DB Tables | Services |
|--------|-----------|-----------|----------|
| Academic / ERP Core | 55 | 3 | 7 |
| Events & Competitions | 70 | 12 | 3 |
| LMS | 88 | 45 | 12 |
| Career Portal | 42 | 17 | 4 |
| Helpdesk & Feedback | 14 | 4 | 3 |
| Admin & Infrastructure | 10 | 0 | 3 |
| **Total** | **279** | **81** | **32** |
