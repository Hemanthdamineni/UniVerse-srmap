# 07 — API Reference

> All routes are mounted under `/api`. Base URL: `http://localhost:5000/api` (dev) or `https://your-domain.com/api` (prod, proxied via Nginx).

---

## 7.1 Common Conventions

### Authentication

Authenticated endpoints require the `erp_session` cookie (set automatically during login):
```
Cookie: erp_session=<uuid>
```

Legacy fallback (being phased out, cutoff: `2026-05-15`):
- Header: `x-session-id: <uuid>`
- Query: `?sessionId=<uuid>`
- Body: `{ "sessionId": "<uuid>" }`

### Admin Authentication

Admin-protected endpoints require a static password via `x-admin-password` header. The admin password is configured at deploy time and shared across all admin users. Admin elevation is per-session via `POST /admin/access/unlock`.

### Response Envelope

**Success:**
```json
{
  "success": true,
  "requestId": "uuid",
  "data": { ... }
}
```

ERP endpoints additionally return:
```json
{
  "success": true,
  "pageKey": "academic/attendance-details",
  "source": "cache-fresh",
  "fetchedAt": "2026-04-06T12:00:00.000Z",
  "staleAt": "2026-04-06T12:01:00.000Z",
  "policyMode": "cached-first",
  "data": { ... },
  "warnings": []
}
```

**Error (with FEATURE_ERP_ERROR_ENVELOPE=1):**
```json
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Invalid or expired sessionId.",
    "retryable": false
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Standard Response Headers

| Header | Value |
|--------|-------|
| `x-request-id` | UUID for request tracing |
| `x-erp-source` | `cache-fresh`, `cache-stale`, `live` |
| `x-erp-policy` | `cached-first`, `live-first` |
| `x-ratelimit-limit` | Max requests per window |
| `x-ratelimit-remaining` | Remaining requests |
| `x-ratelimit-reset` | Seconds until window resets |

### Error Codes

| Code | HTTP Status | Retryable | Meaning |
|------|-------------|-----------|---------|
| `BAD_REQUEST` | 400 | No | Missing or invalid parameters |
| `UNAUTHORIZED` | 401 | No | Missing/expired session |
| `SESSION_EXPIRED` | 401 | No | Session TTL exceeded |
| `FORBIDDEN` | 403 | No | Insufficient permissions |
| `NOT_FOUND` | 404 | No | Resource not found |
| `RATE_LIMITED` | 429 | Yes | Too many requests |
| `TIMEOUT` | 408/504 | Yes | ERP request timed out |
| `CIRCUIT_OPEN` | 503 | Yes | ERP temporarily unavailable |
| `UPSTREAM_UNAVAILABLE` | 500+ | Yes | ERP returned error |
| `UPSTREAM_SATURATED` | 503 | Yes | Max concurrent ERP requests reached |
| `INVALID_UPSTREAM_PAYLOAD` | 502 | No | ERP returned login page or invalid data |
| `PAYLOAD_CONTRACT_MISMATCH` | 502 | No | Response missing expected sections |
| `MISSING_ENDPOINT_MAPPING` | 502 | No | No discovery mapping for this menu item |
| `LOCK_TIMEOUT` | 503 | Yes | Distributed lock acquisition failed |
| `UI_MAP_UNAVAILABLE` | 503 | No | UI map not loaded |

---

## 7.2 Authentication

All mounted via `createAuthRoutes({ sessionStore, erpDumpService })`.

### GET `/api/captcha` and `/api/auth/captcha`

Fetch a captcha image from the ERP, creating a pre-authentication session.

**Response:**
```json
{
  "success": true,
  "sessionId": "a1b2c3d4-...",
  "captchaBase64": "data:image/png;base64,...",
  "issuedAt": "2026-04-06T12:00:00.000Z",
  "expiresInMs": 15000,
  "expiresAt": "2026-04-06T12:00:15.000Z",
  "loginAttemptId": "uuid"
}
```

**Side effects:** Sets `erp_session` cookie, creates Playwright storageState session.

### POST `/api/login` and `/api/auth/login`

Authenticate with ERP credentials.

**Request:**
```json
{
  "username": "AP12345678",
  "password": "myPassword",
  "captcha": "abc123",
  "sessionId": "uuid"
}
```

**Success:**
```json
{
  "success": true,
  "sessionId": "a1b2c3d4-...",
  "profileData": {
    "TableContent": {
      "Student Name": "John Doe",
      "Register No.": "AP12345678",
      "Program / Section": "B.Tech CSE / A"
    }
  },
  "profileStatus": "ready",
  "loginAttemptId": "uuid"
}
```

**Errors:** `BAD_REQUEST` (missing fields), `UNAUTHORIZED` (invalid credentials/captcha).

### POST `/api/dev/login` and `/api/auth/dev-login`

Development-only login bypass. Returns 404 in production.

**Request:**
```json
{
  "username": "AP12345678"
}
```

**Response:** Same shape as real login but with `demo: true`.

### POST `/api/forgot` and `/api/auth/forgot`

Password reset workflow. Two modes selected via `type` field.

**Initiate (type=initiate):**
```json
{
  "type": "initiate",
  "username": "AP12345678",
  "captcha": "abc123",
  "sessionId": "uuid"
}
```
Response: `{ "success": true, "sessionId": "...", "message": "OTP sent successfully." }`

**Change (type=change):**
```json
{
  "type": "change",
  "username": "AP12345678",
  "otp": "123456",
  "newPassword": "newSecurePass123"
}
```
Response: `{ "success": true, "message": "Password changed successfully." }`

### POST `/api/logout` and `/api/auth/logout`

Clear session and cookies. Returns `{ "success": true }`.

### GET `/api/profile` and `/api/auth/profile`

Fetch or refresh the current user's profile.

**Response:** Raw profile data object with `TableContent` key-value pairs fetched from ERP. Falls back to stored session profile if fetch fails (non-SESSION_EXPIRED errors).

---

## 7.3 Admin Access

All mounted via `createAdminRoutes({ sessionStore })`.

### GET `/api/admin/access/status`

Returns current admin elevation state.

```json
{
  "registerNo": "AP12345678",
  "potentialAdmin": true,
  "isAdmin": false
}
```

### POST `/api/admin/access/unlock`

Elevate the current session to admin. Requires `potentialAdmin` to be true.

**Response:** `{ "isAdmin": true }`

**Error:** 403 if not a potential admin account.

### POST `/api/admin/access/disable`

Disable admin elevation for the current session.

**Response:** `{ "isAdmin": false }`

---

## 7.4 ERP Data (V2)

All mounted via `createErpV2Routes({ erpAggregationService, uiMapStore, actionExecutor })`. Only enabled when `FEATURE_ERP_V2_API=1`.

### GET `/api/v2/erp/page/:category/:page` and `/api/v2/erp/page/:pageKey`

Fetch a single ERP page. The `:pageKey` variant accepts a dotted path like `academic/attendance-details`.

**Query params:** `mode` — override fetch mode (`cached-first` or `live-first`).

### POST `/api/v2/erp/batch`

**Primary data-fetching endpoint.** Fetch multiple ERP pages in one request.

**Request:**
```json
{
  "pageKeys": [
    "academic/attendance-details",
    "academic/od-ml-details",
    "academic/student-attendance"
  ],
  "mode": "cached-first"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "academic/attendance-details": {
      "success": true,
      "pageKey": "academic/attendance-details",
      "source": "cache-fresh",
      "meta": {
        "normalizationRules": [],
        "issues": [],
        "targets": [{ "dropdown": "Academic", "subitem": "Attendance Details" }],
        "financePaidIntegrity": { ... }
      },
      "data": { "Academic": { "Attendance Details": { ... } } }
    },
    "academic/od-ml-details": {
      "success": false,
      "pageKey": "academic/od-ml-details",
      "error": "...",
      "status": "...",
      "code": "SESSION_EXPIRED"
    }
  }
}
```

Each page result includes `success`, `pageKey`, `source` (`cache-fresh`, `cache-stale`, `live`), `data`, and optional `meta`. Failed pages return `{ success: false, pageKey, error, status, code }`.

### GET `/api/v2/erp/ui/:category/:page` and `/api/v2/erp/ui/:pageKey`

Get UI enhancement hints (forms, actions) for an ERP page.

```json
{
  "success": true,
  "pageKey": "examination/exam-registration",
  "sections": [
    {
      "sourcePageKey": "examination/exam-registration",
      "forms": [{ "id": "form1", "fields": [...], "method": "POST" }],
      "actions": [{ "id": "submit", "label": "Register", "kind": "submit" }]
    }
  ]
}
```

**Errors:** `UI_MAP_UNAVAILABLE` (503) if UI map not loaded.

### GET `/api/v2/erp/schema/:category/:page` and `/api/v2/erp/schema/:pageKey`

Get render schema blocks for a page (tells frontend how to lay out data).

**Errors:** `UI_MAP_UNAVAILABLE` (503) if UI map not loaded.

### POST `/api/v2/erp/action/execute`

Execute an ERP form action (submit registration, etc.).

**Request:**
```json
{
  "pageKey": "examination/exam-registration",
  "actionId": "submit",
  "payload": { "courseId": "CSE304" },
  "method": "POST",
  "url": "students/transaction/..."
}
```

**Errors:** `ACTION_EXECUTOR_UNAVAILABLE` (503) if executor not configured.

---

## 7.5 ERP Data (V1 / Scrape / Legacy)

All mounted via `createScrapeRoutes({ erpAggregationService, erpLiveService })`.

### GET `/api/scrape/:pageKey` and `/api/scrape/:category/:page`

Same as V2 page endpoint but returns only `data` (no envelope).

### GET `/api/scrape/examination/earlier-internal-marks/semester/:semester`

Fetch internal marks for a specific past semester.

**Params:** `:semester` — positive integer (1, 2, 3, ...).

**Errors:** `UPSTREAM_UNAVAILABLE` (503) if `erpLiveService` not available.

### GET `/api/:category/:page` and `/:pageKey`

Catch-all backward-compatible scrape endpoints (same handler as `/scrape/...`).

---

## 7.6 External/Static Data

All mounted via `createExternalRoutes({ externalDataStore })`.

### GET `/api/external/:category/:page` and `/api/external/:pageKey`

Read static data from the external SQLite database (e.g. academic calendar, notice board). No authentication required.

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Errors:** 404 if no data configured for the given page key.

---

## 7.7 Events

All mounted via `createEventsRoutes({ eventsStore, sessionStore, competitionStore, adminPassword })`. All endpoints require authentication.

### GET `/api/events`

List events with filters.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Full-text search |
| `category` | string | Category filter |
| `department` | string | Department filter |
| `status` | string | `draft`, `published`, `cancelled`, `completed` |
| `visibility` | string | Visibility filter |
| `type` | string | Event type |
| `startDate` | ISO string | Range start |
| `endDate` | ISO string | Range end |
| `myEvents` | `"true"` | Only events created by current user |
| `registered` | `"true"` | Only events registered by current user |
| `createdBy` | string | Filter by creator register number |

### GET `/api/events/calendar`

Returns events as calendar entries (id, title, start, end, extendedProps).

**Query params:** `startDate`, `endDate`, `status` (default: `published`), `department`.

### GET `/api/events/my-registrations` and `/api/events/my-registered`

List events the current user is registered for.

### GET `/api/events/my-created`

List events created by the current user.

### GET `/api/events/analytics`

Event analytics (admin/organizer). Returns aggregate stats.

### GET `/api/events/notifications`

List event notifications for the current user.

### POST `/api/events/notifications/reminders`

Trigger reminder notification generation (scans upcoming events).

### PATCH `/api/events/notifications/:notificationId/read`

Mark a notification as read.

### POST `/api/events`

Create an event.

**Body:** Full event object with optional `competitionConfig` (triggers competition store check).

### POST `/api/events/bulk-action`

Bulk action on events.

**Body:** `{ "eventIds": [...], "action": "publish" }`

### GET `/api/events/:eventId`

Get event details.

### PUT `/api/events/:eventId`

Update event (creator or admin).

### PUT `/api/events/:eventId/co-organizers`

Update co-organizer list.

**Body:** `{ "coOrganizers": ["AP12345678", "AP23456789"] }`

### DELETE `/api/events/:eventId`

Delete event (creator or admin). Returns `{ "deleted": true, "eventId": "..." }`.

### POST `/api/events/:eventId/duplicate`

Duplicate an event (creator only).

### PATCH `/api/events/:eventId/status`

Transition event lifecycle status.

**Body:** `{ "status": "published" }`

### PATCH `/api/events/:eventId/approval`

Approve/reject an event (admin/organizer).

**Body:** `{ "approved": true, "notes": "Looks good" }`

### POST `/api/events/:eventId/register`

Register for an event.

### POST `/api/events/:eventId/cancel-registration`

Cancel registration with an optional reason.

### DELETE `/api/events/:eventId/register`

Cancel registration (alternative to the POST variant).

### POST `/api/events/:eventId/check-in`

Check into an event.

**Body:** `{ "code": "ABC123" }`

### GET `/api/events/:eventId/attendees.csv`

Download attendee list as CSV (organizer only). Sets `Content-Type: text/csv`.

### POST `/api/events/:eventId/messages`

Send bulk message to attendees (organizer only).

**Body:** `{ "subject": "...", "message": "..." }`

### POST `/api/events/:eventId/feedback`

Submit event feedback.

**Body:** `{ "rating": 5, "comments": "...", "answers": [...] }`

### POST `/api/events/:eventId/gallery`

Add a gallery photo to the event.

**Body:** `{ "url": "...", "caption": "..." }`

### GET `/api/events/:eventId/ical`

Download iCal file for the event. Sets `Content-Type: text/calendar`.

---

## 7.8 Competitions

All mounted via `createCompetitionRoutes({ competitionStore, sessionStore, adminPassword, submissionsDir })`. All endpoints require authentication. Some require organizer/admin roles.

### GET `/api/competitions/:eventId/config`

Get competition configuration for an event.

### GET `/api/competitions/:eventId/my-role`

Get the current user's role in the competition.

### GET `/api/competitions/:eventId/roles`

List all roles for the competition.

### POST `/api/competitions/:eventId/roles`

Assign a role to a user.

**Body:** `{ "regNo": "AP12345678", "role": "judge" }`

### DELETE `/api/competitions/:eventId/roles/:regNo`

Remove a role assignment.

### GET `/api/competitions/:eventId/certificate-template`

Get the certificate template configuration.

**Query:** `roundId` — filter by round.

### PUT `/api/competitions/:eventId/certificate-template`

Save/update certificate template.

### POST `/api/competitions/:eventId/certificate-template/image`

Upload a certificate template image (multipart, max 10MB).

### GET `/api/competitions/:eventId/analytics`

Get competition analytics.

### POST `/api/competitions/:eventId/rounds/:roundId/submit`

Submit to a competition round. Multipart with optional file upload (max 25MB).

**Fields:** `type` (`file`|`link`), `file`, `linkUrl`, `description`.

### GET `/api/competitions/:eventId/rounds/:roundId/my-submission`

Get the current user's submission for a round.

### GET `/api/competitions/:eventId/rounds/:roundId/my-result`

Get the current user's result for a round.

### GET `/api/competitions/:eventId/rounds/:roundId/submissions`

List all submissions for a round (judge/organizer).

### PUT `/api/competitions/:eventId/rounds/:roundId/submissions/:id/evaluate`

Evaluate a submission.

**Body:** `{ "score": 85, "feedback": "Good work" }`

### GET `/api/competitions/:eventId/rounds/:roundId/submissions/:id/evaluations`

Get all evaluations for a submission.

### PUT `/api/competitions/:eventId/rounds/:roundId/submissions/:id/flag`

Flag a submission for review.

### POST `/api/competitions/:eventId/rounds/:roundId/shortlist`

Apply shortlisting logic.

**Body:** `{ "mode": "topN", "value": 10 }`

### POST `/api/competitions/:eventId/rounds/:roundId/publish`

Publish round results.

### GET `/api/competitions/:eventId/rounds/:roundId/leaderboard`

Get the competition leaderboard for a round. Returns `[]` if not yet published (403 suppressed).

### POST `/api/competitions/:eventId/rounds/:roundId/certificates/generate`

Generate certificates for a round.

### GET `/api/competitions/:eventId/rounds/:roundId/certificates/me`

Get the current user's certificate info. Returns `null` if 404.

### GET `/api/competitions/:eventId/rounds/:roundId/certificates/me/download`

Download the current user's certificate as a file.

### POST `/api/competitions/reminders/run`

Trigger deadline reminder processing. Requires `admin` or `event_coordinator` role.

### POST `/api/competitions/:eventId/announce`

Send an organizer announcement.

### POST `/api/competitions/:eventId/teams`

Create a team for a team-based competition.

**Body:** `{ "name": "Team Alpha" }`

### GET `/api/competitions/:eventId/teams/my-team`

Get the current user's team.

### POST `/api/competitions/:eventId/teams/:teamId/invite`

Invite a member to the team.

**Body:** `{ "inviteeRegisterNumber": "AP12345678" }`

### DELETE `/api/competitions/:eventId/teams/:teamId/invite/:inviteeRegisterNumber`

Cancel a pending invitation.

### PUT `/api/competitions/:eventId/teams/:teamId/leader`

Transfer team leadership.

**Body:** `{ "newLeaderId": "AP87654321" }`

### DELETE `/api/competitions/:eventId/teams/:teamId/members/me`

Leave a team.

### DELETE `/api/competitions/:eventId/teams/:teamId`

Delete a team (leader only).

### POST `/api/competitions/:eventId/invitations/:invitationId/accept`

Accept a team invitation.

### POST `/api/competitions/:eventId/invitations/:invitationId/decline`

Decline a team invitation.

### GET `/api/competitions/:eventId/invitations/my-invitations`

List the current user's pending team invitations.

---

## 7.9 Campus Feedback

All mounted via `createCampusFeedbackRoutes({ campusFeedbackStore, sessionStore, adminPassword })`. All endpoints require authentication.

### GET `/api/campus-feedback/governance`

Returns the official/unofficial ownership contract.

```json
{
  "official": {
    "label": "Official ERP feedback",
    "owner": "University ERP workflow",
    "routeNamespace": "/api/feedback/end-semester",
    "editableThroughCampusModeration": false
  },
  "unofficial": {
    "label": "Unofficial campus feedback",
    "owner": "Campus community feedback with admin moderation",
    "routeNamespace": "/api/campus-feedback",
    "statuses": ["pending", "approved", "rejected"]
  }
}
```

### GET `/api/campus-feedback/:type/options`

List feedback targets for `events`, `hostel-mess`, or `transport`. Admins see inactive targets.

### POST `/api/campus-feedback/:type/options`

Create a feedback target (admin only).

**Body:** `{ "label": "Route 1, Campus to City Center" }`

### POST `/api/campus-feedback/:type/submissions`

Submit feedback.

**Body:**
```json
{
  "targetId": "route-1",
  "targetLabel": "Route 1",
  "ratings": { "Safety": 4, "Punctuality": 3 },
  "comment": "Driver was careful today.",
  "displayMode": "anonymous"
}
```

**Response:**
```json
{
  "id": "uuid",
  "type": "transport",
  "targetLabel": "Route 1",
  "ratings": { "Safety": 4, "Punctuality": 3 },
  "status": "pending",
  "governance": { "owner": "Campus community feedback", "routeNamespace": "/api/campus-feedback" }
}
```

Duplicate/spam guard: repeated submissions by the same user for the same target within the throttle window return HTTP 429.

### POST `/api/campus-feedback/:type/legacy-import`

Import up to 50 legacy browser-local feedback entries.

```json
{
  "entries": [
    {
      "targetLabel": "Tech Fest",
      "ratings": { "Experience": 5 },
      "comment": "Migrated from the old local form.",
      "submittedAt": "2026-05-20T08:00:00.000Z"
    }
  ]
}
```

### GET `/api/campus-feedback/me/submissions`

List the current user's feedback submissions. Optional query: `type`, `limit`, `offset`.

### GET `/api/campus-feedback/admin/submissions`

List moderation queue (admin only). Queries: `type`, `status`, `limit`, `offset`.

### PATCH `/api/campus-feedback/admin/submissions/:feedbackId`

Moderate a submission (admin only).

**Body:**
```json
{
  "status": "approved",
  "reason": "Constructive and policy compliant"
}
```

---

## 7.10 Career / Opportunities

All mounted via `createCareerRoutes({ careerStore, sessionStore, adminPassword, lmsTrackerService })`. All endpoints require authentication.

### GET `/api/career/permissions`

Returns current user's career moderation permissions.

```json
{ "canModerateSubmissions": false }
```

### GET `/api/career/trending`

Trending opportunities. Query: `limit` (max 50, default 12).

### GET `/api/career/deadline-soon`

Bookmarked opportunities with approaching deadlines. Query: `days` (1–30, default 3).

### GET `/api/career/feed`

Relevance-sorted opportunity feed. Query: `page`, `limit` (default 24).

### GET `/api/career/insights/unified`

(Requires `lmsTrackerService`) Career alias for unified insights contract. See LMS section for response shape.

### GET `/api/career/health`

Scraper health info.

```json
{
  "sources": { "internshala": { "status": "healthy", "lastRun": "..." } },
  "recentRuns": [ ... ]
}
```

### GET `/api/career/stats`

Aggregate career stats.

### GET `/api/career/opportunities`

List/filter opportunities.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `internship`, `job`, `hackathon`, `scholarship`, `fellowship` |
| `skills` | string | Comma-separated skill filter |
| `location` | string | Location filter |
| `mode` | string | `remote`, `onsite`, `hybrid` |
| `query` | string | Full-text search |
| `sort` | string | `relevance`, `deadline`, `posted` |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `isFree` | string | Filter free opportunities |
| `hasStipend` | string | Filter stipend opportunities |
| `expiringWithinDays` | number | Filter by deadline |
| `bookmarkedOnly` | `"true"` | Only bookmarked items |

### POST `/api/career/opportunities`

Create an opportunity (admin only).

### GET `/api/career/opportunities/:id`

Get opportunity details.

### PUT `/api/career/opportunities/:id`

Update an opportunity (admin only).

### DELETE `/api/career/opportunities/:id`

Delete an opportunity (admin only).

### POST `/api/career/opportunities/:id/save`

Save/bookmark an opportunity for the current user.

### DELETE `/api/career/opportunities/:id/save`

Remove saved/bookmark status.

### POST `/api/career/opportunities/:id/bookmark`

Toggle bookmark on an opportunity.

### POST `/api/career/opportunities/:id/dismiss`

Dismiss an opportunity (removes from feed).

### POST `/api/career/opportunities/:id/view`

Track a view of an opportunity.

### POST `/api/career/opportunities/:id/apply`

Track an apply action.

### POST `/api/career/opportunities/:id/flag`

Flag an opportunity for review.

**Body:** `{ "reason": "Expired listing" }`

### GET `/api/career/profile/skill-gaps`

Returns skill gap analysis based on user profile vs. opportunity demand.

### POST `/api/career/profile/resume`

Upload/resume update.

**Body:** `{ "fileName": "resume.pdf" }`

Returns `{ "url": "/uploads/resumes/...", "fileName": "resume.pdf" }`.

### GET `/api/career/profile`

Get the current user's career profile.

### PUT `/api/career/profile`

Update career profile.

**Body:** `{ "bio": "...", "skills": ["React", "Node.js"], "preferredTypes": [...], "preferredLocations": [...] }`

### GET `/api/career/applications`

List the current user's applications.

### POST `/api/career/applications`

Create an application.

**Body:** `{ "opportunityId": "...", "notes": "Applied via portal" }`

### PUT `/api/career/applications/:applicationId`

Update application status.

**Body:** `{ "status": "applied", "notes": "..." }`

### DELETE `/api/career/applications/:applicationId`

Delete an application.

### POST `/api/career/submit`

Submit a student-sourced opportunity.

**Body:**
```json
{
  "type": "internship",
  "title": "Frontend Platform Internship",
  "company": "Acme Labs",
  "applyUrl": "https://careers.example.com/frontend-platform-internship",
  "deadline": "2030-06-30"
}
```

Automatically enters `pending` review. Duplicate active or pending opportunities return HTTP 409.

### GET `/api/career/submit/mine`

List the current user's submissions. Queries: `status`, `page`, `limit`.

### GET `/api/career/submit/pending`

Admin-only review queue. Queries: `status`, `query`, `page`, `limit`.

### POST `/api/career/submit/:submissionId/approve`

Admin-only: approve a submission (legacy endpoint).

**Body:** `{ "reason": "Verified" }`

### PATCH `/api/career/submit/:submissionId`

Admin-only: reasoned review decision.

**Body:** `{ "decision": "approve", "reason": "Verified official careers page." }`

Valid decisions: `approve`, `reject`.

### GET `/api/career/interviews/slots`

List available interview slots.

### POST `/api/career/interviews/slots`

Create an interview slot (admin/mentor).

### PUT `/api/career/interviews/slots/:slotId`

Update an interview slot.

### DELETE `/api/career/interviews/slots/:slotId`

Delete an interview slot.

### GET `/api/career/interviews/bookings`

List interview bookings for the current user.

### POST `/api/career/interviews/bookings`

Book an interview slot.

### DELETE `/api/career/interviews/bookings/:bookingId`

Cancel an interview booking.

### GET `/api/career/alumni`

List alumni directory. Queries: `query`, `batch`.

### POST `/api/career/alumni`

Create an alumni record.

### PUT `/api/career/alumni/:alumniId`

Update an alumni record.

### DELETE `/api/career/alumni/:alumniId`

Delete an alumni record.

### POST `/api/career/alumni/:alumniId/requests`

Request an alumni connection.

---

## 7.11 LMS / Community Learning

All mounted via `createLmsRoutes({ ... lmsStore, lmsTrackerService, recommendationEngine, interactionTracker, ... })`. All endpoints require authentication. Some require admin.

### Tracker & Insights (requires `lmsTrackerService`)

#### GET `/api/lms/tracker/overview`

Learning tracker overview dashboard data.

#### GET `/api/lms/tracker/insights`

Detailed learning insights.

#### GET `/api/lms/tracker/unified-insights`

Cross-domain academic, LMS, resume, and career recommendation intelligence contract.

Payload includes:
- `contractVersion`: `unified-insights-v1`
- `scoringSchema`: dimensions, recommendation shape, eligibility filters, feedback weights
- `profileGraph`: source nodes, signal edges, coverage counts, missing signal labels
- `atsScore`: ATS-like resume score with rubric breakdown, suggestions, confidence
- `nextSkills`: skill recommendations tied to opportunity demand
- `opportunityRecommendations`: eligible opportunities with matched/missing skills
- `actionPlan`: mixed academic/career actions in priority order
- `feedbackLoop`: recent recommendation events for ranking adaptation
- `qualityMonitoring`: offline baseline metrics, coverage rates, latency

#### GET `/api/lms/tracker/history`

Snapshot history. Queries: `type`, `limit`.

#### GET `/api/lms/tracker/recommendation-events`

List recommendation feedback events. Query: `limit`.

#### POST `/api/lms/tracker/recommendation-events`

Record recommendation feedback.

```json
{
  "eventType": "applied",
  "sourceDomain": "unified_insights",
  "recommendationId": "opp-frontend-intern",
  "recommendationTitle": "Frontend Engineering Intern",
  "confidence": 0.72,
  "action": "applied"
}
```

### Resources

#### GET `/api/lms/resources`

List public LMS resources.

**Query params:** `subjectCode`, `semester`, `unit`, `type`, `difficulty`, `tags`, `examYear`, `examType`, `examProven`, `query`, `sort`, `page`, `limit`.

#### GET `/api/lms/resources/check-duplicate`

Check if a resource is a duplicate. Queries: `fileHash`, `title`, `subjectCode`.

#### GET `/api/lms/resources/:id`

Get a single resource. Hidden/removed resources are excluded unless owned by the user or admin.

#### POST `/api/lms/resources`

Create a resource. Multipart with optional file upload (validated against `ACCEPTED_LMS_MIME_TYPES`, max size from `LMS_UPLOAD_MAX_BYTES`). Rate-limited (10 per 5 min).

**Fields:** `file`, `title`, `subjectCode`, `type`, `difficulty`, `tags`, `unit`, `description`, `url`, `noteContent`, `structuredContent`, `examYear`, `examType`, `exportable`, etc.

**Errors:** `LMS_DUPLICATE` (409) if identical file hash exists for the subject.

#### PUT `/api/lms/resources/:id`

Update a resource. Owner or admin only. Same file handling as POST.

#### DELETE `/api/lms/resources/:id`

Soft-delete a resource. Owner or admin only.

#### POST `/api/lms/resources/:id/restore`

Restore a soft-deleted resource. Owner or admin only.

#### POST `/api/lms/resources/bulk`

Admin-only bulk operation.

**Body:** `{ "operation": "hide", "resourceIds": ["id1", "id2"], "payload": {} }`

#### POST `/api/lms/resources/:id/upvote`

Toggle upvote on a resource.

#### POST `/api/lms/resources/:id/bookmark`

Toggle bookmark on a resource.

#### POST `/api/lms/resources/:id/flag`

Flag a resource for moderation.

**Body:** `{ "reason": "Needs citation review" }`

#### POST `/api/lms/resources/:id/mark-outdated`

Mark a resource as outdated.

**Body:** `{ "reason": "Outdated syllabus" }`

#### POST `/api/lms/resources/:id/rate`

Rate a resource.

**Body:** `{ "rating": 4, "review": "Good material", "dimensionTags": ["clear", "comprehensive"] }`

#### POST `/api/lms/resources/:id/view`

Track a resource view.

**Body:** `{ "timeSpentMs": 120000, "metadata": {} }`

### Comments

#### GET `/api/lms/resources/:id/comments`

List comments on a resource.

#### POST `/api/lms/resources/:id/comments`

Add a comment. Rate-limited (20 per 5 min).

**Body:** `{ "content": "Great resource!" }`

#### POST `/api/lms/comments/:id/helpful`

Toggle the "helpful" marker on a comment.

### Annotations

#### GET `/api/lms/resources/:id/annotations`

Get user's annotations for a resource.

#### POST `/api/lms/resources/:id/annotations`

Save an annotation.

**Body:** `{ "content": { ... } }`

#### DELETE `/api/lms/annotations/:id`

Delete an annotation.

### Question Bank & PYQs

#### GET `/api/lms/pyq/upcoming`

Get upcoming exam PYQs for the user.

#### GET `/api/lms/pyq/:subjectCode`

Get PYQ bank for a subject. Queries: `examYear`, `examType`, `page`, `limit`, `sort`.

#### GET `/api/lms/question-bank`

List question bank. Queries: `subjectCode`, `unit`, `difficulty`, `page`, `limit`.

#### POST `/api/lms/question-bank`

Add a question.

#### POST `/api/lms/question-bank/:id/upvote`

Upvote a question.

#### GET `/api/lms/question-bank/build-quiz`

Build a quiz from the question bank.

**Query params:** `subjectCode`, `unit`, `count`, `difficulty`.

### Resource Requests

#### GET `/api/lms/requests`

List resource requests. Queries: `subjectCode`, `status`, `page`, `limit`.

#### POST `/api/lms/requests`

Create a resource request. Rate-limited (10 per 10 min).

#### POST `/api/lms/requests/:id/upvote`

Upvote a request.

#### POST `/api/lms/requests/:id/fulfill`

Mark a request as fulfilled.

**Body:** `{ "resourceId": "..." }`

#### DELETE `/api/lms/requests/:id`

Close/delete a request. Owner or admin only.

### Exam Feedback

#### GET `/api/lms/exam-feedback/pending`

Get pending exam feedback items (fetches from ERP).

#### POST `/api/lms/exam-feedback`

Submit exam feedback.

**Body:** `{ "feedbackItems": [...] }`

### Quiz Attempts

#### POST `/api/lms/resources/:id/quiz-attempt`

Record a quiz attempt.

**Body:** `{ "score": 8, "total": 10, "answers": [...], "timeTakenMs": 300000 }`

#### GET `/api/lms/resources/:id/quiz-attempts`

Get user's quiz attempts for a resource.

### Collections

#### GET `/api/lms/collections`

List user's collections.

#### POST `/api/lms/collections`

Create a collection.

**Body:** `{ "name": "My Collection", "description": "...", "isPublic": false }`

#### GET `/api/lms/collections/:id`

Get a collection.

#### POST `/api/lms/collections/:id/items`

Add a resource to a collection.

**Body:** `{ "resourceId": "..." }`

#### DELETE `/api/lms/collections/:id/items/:resourceId`

Remove a resource from a collection.

### Guides

#### GET `/api/lms/guides`

List study guides. Queries: `subjectCode`, `includeDrafts`.

#### POST `/api/lms/guides`

Create a guide.

#### GET `/api/lms/guides/:id`

Get a guide.

#### PUT `/api/lms/guides/:id`

Update a guide.

#### DELETE `/api/lms/guides/:id`

Delete a guide.

#### POST `/api/lms/guides/:id/sections`

Add a section to a guide.

#### PUT `/api/lms/guides/:id/sections/:sid`

Update a guide section.

#### POST `/api/lms/guides/:id/sections/:sid/read`

Mark a guide section as read.

#### POST `/api/lms/guides/:id/upvote`

Toggle upvote on a guide.

#### GET `/api/lms/guides/:id/export`

Export a guide as PDF. Returns `application/pdf` download.

### Roadmaps

#### GET `/api/lms/roadmaps`

List learning roadmaps. Query: `includeDrafts`.

#### POST `/api/lms/roadmaps`

Create a roadmap.

#### GET `/api/lms/roadmaps/:id`

Get a roadmap.

#### DELETE `/api/lms/roadmaps/:id`

Delete a roadmap.

#### POST `/api/lms/roadmaps/:id/nodes`

Add a node to a roadmap.

#### POST `/api/lms/roadmaps/:id/edges`

Add an edge between nodes.

**Body:** `{ "fromNodeId": "...", "toNodeId": "..." }`

#### POST `/api/lms/roadmaps/:id/nodes/:nid/complete`

Mark a roadmap node as complete.

### Recommendations & Explore

#### GET `/api/lms/recommendations/next-step`

Get "next step" recommendations based on a resource. Query: `resourceId`.

#### GET `/api/lms/recommendations`

Get personalized recommendations. Queries: `subjectCode`, `type`, `limit`.

#### GET `/api/lms/explore

Get the explore page (curated content for the user).

### Subjects

#### GET `/api/lms/subjects/:code/overview`

Get a subject overview.

#### GET `/api/lms/subjects/:code/presence`

Get the count of currently-studying users for a subject.

### Topics

#### GET `/api/lms/topics/graph

Get the topic dependency graph. Query: `subjectCode`.

### Leaderboard & Progress

#### GET `/api/lms/leaderboard/weekly`

Weekly contributor leaderboard.

#### GET `/api/lms/progress

Get user's learning progress summary.

#### GET `/api/lms/progress/:subjectCode`

Get progress for a specific subject.

#### GET `/api/lms/mastery

Get user's mastery data.

#### GET `/api/lms/continue

Get "continue learning" items.

#### GET `/api/lms/revision

Get revision queue items.

#### POST `/api/lms/revision/:resourceId/review

Submit a revision review.

**Body:** `{ "score": 3 }`

#### GET `/api/lms/streak

Get user's learning streak.

#### POST `/api/lms/session/generate

Generate a learning session.

**Body:** `{ "durationMinutes": 30 }`

### User Profile & Activity

#### GET `/api/lms/me/contributions

Get user's contributions to the LMS.

#### GET `/api/lms/me/bookmarks

Get user's bookmarked resources.

#### GET `/api/lms/me/activity

Get user's LMS activity.

#### GET `/api/lms/me/requests

Get user's resource requests.

#### PUT `/api/lms/me/preferences

Update user preferences.

#### GET `/api/lms/me/export/:guideId

Export a guide as PDF (same as `/api/lms/guides/:id/export`).

### Contributor Profiles

#### GET `/api/lms/contributors/:userId`

Get a contributor's profile, contribution history, and trust indicators.

### Admin

#### GET `/api/lms/admin/resource-flags`

Admin-only moderation queue. Queries: `state` (`all`, `flagged`, `visible`, `hidden`, `removed`), `query`, `page`, `limit`.

#### PATCH `/api/lms/admin/resources/:id/moderation`

Admin-only moderation decision.

**Body:** `{ "decision": "approve", "reason": "Citations verified." }`

Valid decisions: `approve`, `hide`, `remove`, `restore`.

#### GET `/api/lms/admin/flags`

List feature flags (admin only).

#### PUT `/api/lms/admin/flags/:key`

Update a feature flag (admin only).

**Body:** `{ "enabled": true, "rolloutType": "percentage", "rolloutValue": 50, "description": "..." }`

---

## 7.12 Helpdesk

All mounted via `createHelpdeskRoutes({ helpdeskStore, sessionStore, adminPassword })`. All endpoints require authentication.

### GET `/api/helpdesk/tickets`

List tickets. Students see only their own tickets; admins see all.

**Query params:** `query`, `status`, `queue` (`new`, `in-progress`, `escalated`, `breached`, `resolved`), `category`, `priority`, `owner`, `team`, `limit`, `offset`.

Response includes `counts.queues`, SLA flags, workload summaries, pagination metadata.

### POST `/api/helpdesk/tickets`

Create a ticket.

### PATCH `/api/helpdesk/tickets/bulk`

Admin-only bulk triage (up to 100 tickets).

**Body:** `{ "ticketIds": ["HD-1", "HD-2"], "status": "in-progress", "assignedTeam": "IT Support", "note": "..." }`

### GET `/api/helpdesk/tickets/:ticketId`

Get ticket details.

### PATCH `/api/helpdesk/tickets/:ticketId`

Admin-only ticket update (status, owner, team, resolution).

**Body:** `{ "status": "resolved", "assignedTeam": "IT Support", "ownerName": "Asha Rao", "resolutionSummary": "...", "note": "..." }`

Resolving requires `resolutionSummary`. Reopening resolved requires `note`.

### POST `/api/helpdesk/tickets/:ticketId/escalate`

Escalate a ticket.

**Body:** `{ "reason": "Needs higher-level support" }`

### POST `/api/helpdesk/tickets/:ticketId/replies`

Add a reply (public or internal note).

### GET `/api/helpdesk/faqs`

List FAQs. Admins see hidden FAQs. Queries: `query`, `category`.

### POST `/api/helpdesk/faqs`

Create an FAQ.

### PUT `/api/helpdesk/faqs/:faqId`

Update an FAQ.

### DELETE `/api/helpdesk/faqs/:faqId`

Delete an FAQ.

---

## 7.13 Content Management

All mounted via `createContentRoutes({ contentStore, adminPassword })`. Create/update/delete/lifecycle endpoints require admin password.

### POST `/api/content/admin/verify`

Verify admin password. Returns `{ "verified": true }`.

### GET `/api/content`

List content items.

**Query params:** `type`, `category`, `lifecycleState`, `includeAllStates`, `includeDeleted`, `page`, `limit`.

### POST `/api/content`

Create content (admin only).

### GET `/api/content/admin/workflow`

Get workflow spec: lifecycle states, transition matrix, role permissions, bulk-operation safety rules.

### POST `/api/content/bulk/preview`

Admin-only: dry-run bulk lifecycle action (no changes).

**Body:** `{ "ids": ["id1", "id2"], "action": "archive" }`

### POST `/api/content/bulk/execute`

Admin-only: execute bulk lifecycle action inside a transaction.

**Body:** `{ "ids": ["id1", "id2"], "action": "archive", "reason": "Semester rollover" }`

### GET `/api/content/:id`

Get content by ID. Query: `includeDeleted`.

### PUT `/api/content/:id`

Update content (admin only).

### GET `/api/content/:id/history`

Admin-only audit history. Query: `limit`.

### PATCH `/api/content/:id/lifecycle`

Admin-only lifecycle transition.

**Body:** `{ "action": "archive", "reason": "Outdated semester material" }`

Valid actions: `submit_review`, `publish`, `unpublish`, `archive`, `delete`, `restore`.

### DELETE `/api/content/:id`

Hard-delete content (admin only).

### GET `/api/content/:id/resources`

List resources attached to content.

### POST `/api/content/:id/resources`

Add a resource to content (admin only).

---

## 7.14 Resources / Learning Materials

All mounted via `createResourceRoutes({ contentStore, sessionStore, adminPassword, uploadsDir })`. All endpoints require authentication. Admin endpoints additionally require `x-admin-password`.

### POST `/api/uploads`

Upload a file (multipart, max 20MB).

**Response:**
```json
{
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 123456,
  "url": "/uploads/uuid-filename.pdf"
}
```

### GET `/api/resources/catalog`

Get learning material catalog. Query: `year`.

### GET `/api/resources/subjects`

Get subject list for learning materials. Queries: `year`, `courseCode`.

### GET `/api/resources/library`

Get the learning material library. Queries: `year`, `courseCode`, `subjectCode`, `query`.

### GET `/api/resources/admin/items`

Admin-only: list all learning material items with full lifecycle states. Queries: `year`, `courseCode`, `subjectCode`, `query`, `lifecycleState`, `includeDeleted`, `page`, `limit`.

### POST `/api/resources/items`

Admin-only: create a learning material item.

### PUT `/api/resources/items/:contentId`

Admin-only: update a learning material item.

### DELETE `/api/resources/items/:contentId`

Admin-only: delete a learning material item.

### GET `/api/resources/items/:contentId/history`

Admin-only: audit history for a learning material item.

### PATCH `/api/resources/items/:contentId/lifecycle`

Admin-only: lifecycle transition for a learning material item.

### POST `/api/resources/admin/items/bulk-preview`

Admin-only: preview bulk lifecycle action.

### POST `/api/resources/admin/items/bulk-execute`

Admin-only: execute bulk lifecycle action.

### POST `/api/resources/recommendations`

Student-facing: submit a resource recommendation.

**Body:** `{ "title": "...", "url": "...", "description": "...", "year": 2, "courseCode": "...", "subjectCode": "...", "kind": "link" }`

### GET `/api/resources/recommendations`

Admin-only: list all resource recommendations.

### PATCH `/api/resources/recommendations/:contentId`

Admin-only: review a resource recommendation.

**Body:** `{ "status": "approved", "reviewerNotes": "..." }`

Valid statuses: `approved`, `rejected`, `pending`.

---

## 7.15 Feedback (End-Semester / ERP Official)

All mounted via `createFeedbackRoutes({ feedbackService })`.

### GET `/api/feedback/end-semester/status`

Get end-semester feedback status from ERP. Returns completion status and available subjects.

### GET `/api/feedback/end-semester/templates/random`

Get a random feedback template (used for rating randomization).

### POST `/api/feedback/end-semester/submit`

Submit end-semester feedback to the ERP.

**Body:** `{ "optionNo": "...", "comment": "...", "subjectIds": [...], "requestId": "..." }`

---

## 7.16 Attendance

All mounted via `createAttendanceRoutes({ sessionStore })`.

### POST `/api/attendance/mark`

Submit an attendance code to the ERP.

**Body:** `{ "sessionId": "uuid", "acode": "ABC1234", "dynamiclatdata": "0", "dynamiclonxdata": "0" }`

`acode` must be exactly 7 alphanumeric characters.

**Response:**
```json
{
  "success": true,
  "message": "Attendance request completed",
  "resultstatus": 1,
  "status": "success"
}
```

---

## 7.17 Health & Monitoring

All mounted via `createHealthRoutes({ sessionStore, discoveryRepository, pagePolicyStore, redisClient, externalDataStore, contentStore, integrityService, careerStore })`.

### GET `/api/health`

Comprehensive system health.

```json
{
  "ok": true,
  "now": "2026-04-06T12:00:00.000Z",
  "sessions": 42,
  "discovery": { "loaded": true, "filePath": "...", "itemCount": 36 },
  "policy": { "defaultMode": "cached-first", "overrideCount": 11 },
  "integrity": { "ok": true, "checks": [...] },
  "redis": "configured",
  "career": { "enabled": true, "scraperSources": {...}, "recentRuns": [...] }
}
```

### GET `/api/live`

Simple liveness probe. Always returns `{ "ok": true, "now": "...", "status": "live" }`.

### GET `/api/ready`

Readiness probe. Returns 503 if any dependency is unhealthy.

```json
{
  "ok": true,
  "now": "...",
  "status": "ready",
  "checks": {
    "discoveryLoaded": true,
    "pagePolicyLoaded": true,
    "redisReady": true,
    "externalDbReady": true,
    "contentDbReady": true
  },
  "integrity": { ... }
}
```

---

## 7.18 Metrics

Mounted via `createMetricsRoutes()`.

### GET `/api/metrics`

Prometheus metrics in text format (`text/plain; version=0.0.4`). Content type set by `register.contentType`.

---

## 7.19 Telemetry

Mounted via `createTelemetryRoutes()`.

### POST `/api/telemetry/frontend`

Record frontend performance telemetry. Disabled unless `FEATURE_FRONTEND_PERF_TELEMETRY=1`.

**Body:** Arbitrary performance metrics object.

**Success:** Returns 202 (`{ "success": true, "requestId": "..." }`). Returns 204 (no content) when telemetry is disabled.

---

## 7.20 Debug

Mounted conditionally when `erpDumpService` is available.

### GET `/api/debug/ping`

Debug info endpoint.

```json
{
  "debugMode": true,
  "dumpDir": "/path/to/dumps",
  "pageCount": 42
}
```

---

## 7.21 Endpoint Summary

| Section | Route File | Endpoints | Auth Required | Admin Required |
|---------|-----------|-----------|---------------|----------------|
| 7.2 Authentication | authRoutes.js | 14 (aliased) | Some | No |
| 7.3 Admin Access | adminRoutes.js | 3 | Yes | Yes (unlock) |
| 7.4 ERP Data V2 | erpV2Routes.js | 8 | Yes | No |
| 7.5 ERP Data V1 | scrapeRoutes.js | 5 | Yes | No |
| 7.6 External Data | externalRoutes.js | 2 | No | No |
| 7.7 Events | eventsRoutes.js | 28 | Yes | Some |
| 7.8 Competitions | competitionRoutes.js | 37 | Yes | Some |
| 7.9 Campus Feedback | campusFeedbackRoutes.js | 8 | Yes | Some |
| 7.10 Career | careerRoutes.js | 48 | Yes | Some |
| 7.11 LMS | lmsRoutes.js | 89 | Yes | Some |
| 7.12 Helpdesk | helpdeskRoutes.js | 12 | Yes | Some |
| 7.13 Content | contentRoutes.js | 13 | Some | Most |
| 7.14 Resources | resourceRoutes.js | 16 | Yes | Some |
| 7.15 Feedback | feedbackRoutes.js | 3 | Yes | No |
| 7.16 Attendance | attendanceRoutes.js | 1 | Yes | No |
| 7.17 Health | healthRoutes.js | 3 | No | No |
| 7.18 Metrics | metricsRoutes.js | 1 | No | No |
| 7.19 Telemetry | telemetryRoutes.js | 1 | No | No |
| 7.20 Debug | debugRoutes.js | 1 | No | No |

**Total: ~293 endpoints** (including aliased routes).

---

## 7.22 Static File Servers

| Mount | Source | Description |
|-------|--------|-------------|
| `/files/submissions` | `eventsStore.dataDir/../submissions` | Competition submission files |
| `/files/certificates` | `eventsStore.dataDir/../certificates` | Generated certificate files |
| `/uploads` | `uploadsDir` | General file uploads (resumes, etc.) |
