# Internal Events & Competition Platform — Final System Plan v2

> Version: 2.0 — Final (Revised)
> Base System: University ERP Companion Platform v2.0.0
> Scope: Extending the existing `eventsStore` into a full competition execution platform

---

## 1. Resolved Architectural Decisions

### 1.1 Organizer Identity & Abuse Prevention

Every user authenticates via SRM ERP. All accounts are real students with traceable register numbers — the platform is not anonymous. This is the primary spam deterrent.

Additional controls added:

- **Rate limit on event creation:** Max 3 active (non-archived) competitions per user at any time. Enforced at the API level. Attempting to create a 4th returns `429` with message "You already have 3 active competitions."
- **Soft visibility gate:** Events have a `visibility` field: `"creator-only"` (draft), `"registered"` (published but unlisted), `"public"` (listed for all). New competitions default to `"creator-only"`. The creator manually promotes to `"public"` when ready. No admin approval required — the gate is self-service but adds deliberate friction against accidental spam.
- No "Verified Organizer" badge system — unnecessary for an internal university platform.
- Co-organizers are supported: a JSON array of register numbers on the competition record who share full organizer access.

---

### 1.2 File Storage

All uploaded submission files are stored on the filesystem, mirroring the existing events gallery pattern:

```
Backend/data/submissions/{eventId}/{roundId}/{userId}/
  └── submission_{timestamp}.{ext}
```

- Served via the existing Nginx `/files/` static route
- Max file size: **25MB per submission**
- Allowed MIME types (validated server-side via `multer` fileFilter, not just extension):


| Extension | MIME Type                                                                   |
| --------- | --------------------------------------------------------------------------- |
| `.pdf`    | `application/pdf`                                                           |
| `.zip`    | `application/zip`                                                           |
| `.docx`   | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`   |
| `.pptx`   | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.txt`    | `text/plain`                                                                |
| `.md`     | `text/markdown`, `text/plain`                                               |


- On resubmission: previous file is retained on disk (not deleted). New file becomes active. History is preserved.
- `multer` is the only new backend dependency.

---

### 1.3 Individual vs. Team Submissions

Phase 1 and Phase 2: **individual submissions only.**

This is a deliberate scope boundary, not a deferral. Teams require invitation flows, acceptance states, and shared submission ownership — a subsystem on their own. Phase 3 adds teams properly. Until then, team-based contests should have one member designated as submitter.

---

### 1.4 Evaluation Model

**Single evaluator per submission.** One organizer or co-organizer reviews and scores each submission.

Evaluation data is stored directly on the submission row. Importantly, scores are stored **both as a per-criteria breakdown and as a precomputed total**:

```json
criteriaScores: { "innovation": 8, "implementation": 7, "presentation": 9 }
totalScore: 24
```

`criteriaScores` is a JSON column. `totalScore` is a flat numeric column used for all sorting, ranking, and shortlisting operations. The total is computed at write time (when the organizer saves the evaluation), not recalculated on read.

Why this matters: the round config defines `evaluationCriteria: [{ label, maxScore }]`, so the criteria are known at design time. Storing them as a JSON breakdown allows organizers to see where each submission scored strongly or weakly, without adding a separate evaluations table. This must be in the initial schema — retrofitting after submissions exist is painful.

Panel judging (multiple evaluators per submission) is Phase 4.

To prevent conflict of interest: if `req.session.username === submission.submittedBy`, the evaluate endpoint returns `403 FORBIDDEN`.

---

### 1.5 Result Visibility — Complete Specification

Results are **never automatically visible** after evaluation. An organizer must explicitly publish results per round via the "Publish Results" action.

Each round has a `resultsPublished: boolean` field (default `false`).

The complete visibility matrix — enforced at the **API level** (the `GET /my-submission` endpoint strips fields based on `resultsPublished`, not left to frontend judgment):


| Participant State         | Score | Rank | Criteria Breakdown | Shortlisted | Decision | Remarks |
| ------------------------- | ----- | ---- | ------------------ | ----------- | -------- | ------- |
| Submitted / Under Review  | ❌     | ❌    | ❌                  | ❌           | ❌        | ❌       |
| Evaluated (not published) | ❌     | ❌    | ❌                  | ❌           | ❌        | ❌       |
| Results Published         | ✅     | ✅    | ✅                  | ✅           | ✅        | ✅       |


No partial reveals. `resultsPublished` is the single gate for everything. The API strips all evaluation fields from the response payload when `resultsPublished === false`.

---

### 1.6 Shortlisting Rules

- **Tie-breaking:** If two submissions have equal `totalScore`, the one with the earlier `submittedAt` timestamp ranks higher. This is deterministic and requires no manual intervention.
- **Unevaluated submissions are excluded from shortlisting entirely.** They are not auto-rejected — they remain in a pending state. The organizer is warned before applying a shortlist: "X of Y submissions have been evaluated. Z unevaluated submissions will not be considered and will remain pending."
- Unevaluated submissions pending after results are published are shown to participants as "Not Evaluated."

---

### 1.7 Round Access Control

For multi-round competitions, access to submit in Round N (where N > 1) is gated:

- The submission endpoint checks for a `shortlisted: true` record for `req.session.username` in the previous round (`requiresShortlistFromRound` field on the round config).
- If no such record exists: `403 FORBIDDEN` — "You were not shortlisted for the previous round."
- Round 1 has no gate — any registered participant can submit.

This is a Phase 2 requirement. It is fundamental to multi-round competitions working correctly.

---

### 1.8 Resubmission Limits

Each round has an optional `maxResubmissions` field (default: `5`, configurable by organizer). The submission endpoint counts existing submission rows for `(eventId, roundId, userId)` before accepting a new upload. If the count equals or exceeds `maxResubmissions`, return `429` — "Resubmission limit reached."

The latest submission is always the active one. All previous submissions are retained on disk.

---

## 2. System Architecture

Competitions extend the existing `eventsStore` via an optional `competitionConfig` JSON column on the events table. Competitions inherit all existing event capabilities for free: registration, notifications, iCal export, CSV export, check-in, feedback, gallery, and analytics.

The new surface area is exclusively: **submission → evaluation → shortlisting → result publication.**

### 2.1 Competition Config Shape

```json
{
  "isCompetition": true,
  "submissionScope": "individual",
  "rounds": [
    {
      "roundId": "r1",
      "title": "Round 1 — Preliminary",
      "type": "submission",
      "startTime": "2026-05-01T00:00:00Z",
      "submissionDeadline": "2026-05-10T23:59:59Z",
      "instructions": "Submit a PDF report (max 10 pages).",
      "submissionTypes": ["file", "link"],
      "maxFileSizeMb": 25,
      "maxResubmissions": 5,
      "evaluationCriteria": [
        { "label": "Innovation", "maxScore": 10 },
        { "label": "Implementation", "maxScore": 10 },
        { "label": "Presentation", "maxScore": 10 }
      ],
      "shortlistCount": 20,
      "shortlistThreshold": null,
      "requiresShortlistFromRound": null,
      "resultsPublished": false
    }
  ]
}
```

### 2.2 New Database Table

Added to `events.sqlite` on startup (auto-created):

```sql
CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  eventId         TEXT NOT NULL,
  roundId         TEXT NOT NULL,
  submittedBy     TEXT NOT NULL,        -- register number
  type            TEXT NOT NULL,        -- 'file' | 'link'
  filePath        TEXT,                 -- relative path under Backend/data/submissions/
  linkUrl         TEXT,
  description     TEXT,                 -- optional, 500 char max
  submittedAt     TEXT NOT NULL,
  resubmittedAt   TEXT,
  resubmissionCount INTEGER DEFAULT 0,
  criteriaScores  TEXT,                 -- JSON: { "Innovation": 8, ... }
  totalScore      REAL,
  remarks         TEXT,
  evaluatedBy     TEXT,
  evaluatedAt     TEXT,
  decision        TEXT,                 -- NULL | 'selected' | 'rejected' | 'pending'
  shortlisted     INTEGER DEFAULT 0,
  flagged         INTEGER DEFAULT 0,
  flagReason      TEXT,
  FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (eventId, roundId, submittedBy, resubmissionCount)
);

CREATE INDEX IF NOT EXISTS idx_submissions_event_round   ON submissions(eventId, roundId);
CREATE INDEX IF NOT EXISTS idx_submissions_submittedBy   ON submissions(submittedBy);
CREATE INDEX IF NOT EXISTS idx_submissions_score         ON submissions(eventId, roundId, totalScore DESC);
```

Existing `events` table gains two new columns:

```sql
ALTER TABLE events ADD COLUMN competitionConfig TEXT;   -- JSON
ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'public';
```

Note: existing events default to `'public'` to maintain backward compatibility.

---

## 3. Event & Competition Lifecycle

### Event States (full, extended)

```
Draft             (creator-only visibility, not listed anywhere)
→ Published       (registered users can see if they have the link)
→ Public          (listed on events page, open for discovery)
→ Ongoing         (event in progress, submissions open)
→ Submission Closed  (deadline passed, evaluation begins)
→ Evaluation         (organizer scoring in progress)
→ Results Published  (participants can see outcomes)
→ Completed
→ Archived
```

Non-competition events skip the Submission Closed → Results Published states.

### Submission States (per submission record)

```
Submitted
→ Resubmitted       (participant uploads again before deadline)
→ Locked            (deadline passed, no more changes accepted)
→ Evaluated         (score + decision recorded by organizer)
→ Published         (resultsPublished = true; visible to participant)
```

Special state for unevaluated after publish:

```
→ Not Evaluated     (round published but this submission was never scored)
```

---

## 4. Feature Layers

### Layer 1 — Discovery (improved)

Extended filters on `GET /api/events`:

- Type: `Workshop`, `Hackathon`, `Case Study`, `Quiz`, `Paper Presentation`, `Cultural`, `Sports`, `Other`
- Mode: `Online`, `Offline`, `Hybrid`
- Status: `Registration Open`, `Ongoing`, `Results Out`
- Competition only: boolean toggle
- Sort by: Deadline nearest, Recently added, Prize pool

Event cards gain:

- Competition badge (if `isCompetition: true`)
- Deadline countdown
- Round count indicator ("3 Rounds")
- Prize pool line (if organizer has set it)

---

### Layer 2 — Event Detail (improved)

For competitions, the event detail page gains structured sections:


| Section     | Content                                  | Storage                               |
| ----------- | ---------------------------------------- | ------------------------------------- |
| Overview    | Description, poster, organizer info      | Existing event fields                 |
| Rounds      | Each round: type, deadline, instructions | `competitionConfig.rounds`            |
| Prizes      | Prize pool description                   | New `prizes` text field on event      |
| Rules       | Competition rules                        | New `rules` text field on event       |
| Timeline    | Key dates table                          | Derived from round deadlines          |
| Eligibility | Who can participate                      | New `eligibility` text field on event |
| Resources   | Attached files                           | Existing content resources system     |
| FAQ         | Accordion of Q&A pairs                   | New `faq` JSON field on event         |


Non-competition events see only Overview and Resources.

---

### Layer 3 — Participation (unchanged)

Registration works exactly as today. No changes to registration logic.

Added to the participant's event view post-registration:

- Current active round and its deadline
- Submission status badge for each round
- CTA: "Submit Work" / "Edit Submission" / "Submission Closed"
- Countdown to deadline

---

### Layer 4 — Submission

**Participant experience:**

The submission page shows:

- Round title and instructions
- Evaluation criteria table (label + max score) — participants know how they are judged before submitting
- Deadline with live countdown
- Submission form:
  - Toggle: File Upload or Link
  - File: drag-and-drop, shows allowed types and max size, progress bar during upload
  - Link: URL input with format validation
  - Description: optional textarea, 500 char max
- After submission: confirmation card showing file name or link, timestamp, resubmission count remaining
- Resubmit button (visible until deadline or limit reached)

**API enforcement (all server-side, not frontend-only):**


| Check                                                              | Response if failed                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `now > round.submissionDeadline`                                   | `403` — Submission deadline has passed                  |
| User not registered for event                                      | `403` — You are not registered for this event           |
| Round requires shortlist from previous round, user not shortlisted | `403` — You were not shortlisted for the previous round |
| Resubmission count >= maxResubmissions                             | `429` — Resubmission limit reached                      |
| File MIME type not in allowed list                                 | `400` — File type not allowed                           |
| File size > maxFileSizeMb                                          | `400` — File exceeds size limit                         |
| User is evaluating own submission                                  | `403` — Conflict of interest                            |


---

### Layer 5 — Evaluation

**Organizer: Submission List**

Route: `/events/:eventId/manage/rounds/:roundId/submissions`

Table columns:

- Register number
- Submitted at
- Resubmission count
- Type (file / link)
- View button
- Evaluation status: Pending / Evaluated / Flagged
- Quick-score badge (shows total score if evaluated)

Summary bar at top:

```
42 submissions total  |  30 evaluated  |  12 pending  |  2 flagged
```

Warning if attempting to shortlist with pending submissions — shown inline, not a blocker.

**Organizer: Evaluation Panel**

Route: `/events/:eventId/manage/rounds/:roundId/submissions/:id/evaluate`

Layout:

- Left panel: submission viewer (PDF embed for PDFs, link opener for links, file download for others)
- Right panel: evaluation form
  - Per-criteria score inputs (label shown, max score shown, numeric input)
  - Total auto-summed and displayed live
  - Remarks textarea
  - Flag toggle with reason field
  - Decision: Selected / Rejected / Undecided
  - Save button

Navigation: Previous / Next submission buttons so the organizer can move through the list without returning to the list page.

---

### Layer 6 — Shortlisting & Results

**Organizer: Shortlist Tool**

Route: `/events/:eventId/manage/rounds/:roundId/shortlist`

Displays:

- All **evaluated** submissions ranked by `totalScore` descending, tie-broken by `submittedAt` ascending
- Clear count: "Showing 30 evaluated submissions. 12 unevaluated submissions are excluded."
- Shortlist mode selector:
  - Top N (number input)
  - Score threshold (minimum score input)
- Live preview: highlighted rows show who would be shortlisted given current setting
- "Apply Shortlist" button:
  - Marks selected rows: `shortlisted = true`, `decision = 'selected'`
  - Marks non-selected evaluated rows: `decision = 'rejected'`
  - Unevaluated rows: `decision = 'pending'` (untouched)
- "Publish Results" button (separate, appears after shortlist is applied):
  - Sets `resultsPublished = true` on the round in `competitionConfig`
  - Fires notifications to all participants (see Layer 8)
  - Round state transitions to `Results Published`

**After publishing:**

Participants receive notification:

- Shortlisted: "You have been shortlisted for [Round Title] of [Event Name]. View your results."
- Not selected: "Results for [Round Title] of [Event Name] have been published."
- Not evaluated: "Results for [Round Title] have been published. Your submission was not evaluated."

---

### Layer 7 — Organizer Dashboard

Route: `/events/:eventId/manage`

**Overview cards:**

- Total registrations
- Submissions received (current round) vs. total registrants
- Evaluations complete vs. total submissions
- Results published: Yes / No per round

**Round management:**

Each round shown as a status card:


| Round State                       | Displayed Status       | Available Actions    |
| --------------------------------- | ---------------------- | -------------------- |
| Before start time                 | Upcoming               | Edit config          |
| Between start and deadline        | Accepting Submissions  | View submissions     |
| After deadline, not all evaluated | Evaluation In Progress | Evaluate, view list  |
| All evaluated, not published      | Ready to Publish       | Open shortlist tool  |
| Published                         | Results Published      | View results, export |


**Participant table:**

- All registrants with submission status per round (✅ submitted / ⏳ pending / ❌ not submitted)
- Export CSV (reuses existing `attendees.csv` pattern, extended with submission status columns)

**Announcements panel:**

- Compose a message broadcast to all registrants
- Reuses existing bulk messaging capability in `eventsStore.js`

**Active competition limit indicator:**

- Shows: "You have 3 active competitions (limit: 3)" if at limit
- Prevents creation of additional competitions from this panel

---

### Layer 8 — Engagement (reuse existing)

All of the following reuse existing `eventsStore.js` capabilities with new trigger points only:


| Trigger                           | Notification                                         |
| --------------------------------- | ---------------------------------------------------- |
| Submission confirmed              | "Your submission for [Round] has been received."     |
| 24h before deadline               | "Reminder: [Round] submission deadline is tomorrow." |
| 1h before deadline                | "Final reminder: [Round] closes in 1 hour."          |
| Results published (shortlisted)   | "You have been shortlisted for [Round]."             |
| Results published (not selected)  | "Results for [Round] have been published."           |
| Round 2 opens (shortlisted users) | "Round 2 is now open for submission."                |


Deadline reminders require a background job (simple `setInterval` or cron-like check on startup). This is a lightweight addition — the notification system itself already exists.

---

## 5. Frontend Routing (Blueprint Integration)

New entries in `erpBlueprints.ts` (`sourceMode: "internal"` throughout):

```typescript
"/events/:eventId/submit/:roundId": {
  heading: "Submit Your Work",
  loadingMessage: "Loading round details...",
}
"/events/:eventId/my-results/:roundId": {
  heading: "Your Results",
  loadingMessage: "Loading your results...",
}
"/events/:eventId/manage": {
  heading: "Manage Competition",
  loadingMessage: "Loading competition data...",
}
"/events/:eventId/manage/rounds/:roundId/submissions": {
  heading: "Submissions",
  loadingMessage: "Loading submissions...",
}
"/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate": {
  heading: "Evaluate Submission",
  loadingMessage: "Loading submission...",
}
"/events/:eventId/manage/rounds/:roundId/shortlist": {
  heading: "Shortlist & Publish",
  loadingMessage: "Loading evaluation data...",
}
```

New page components:

```
Frontend/src/pages/Events/
  ├── SubmissionPage.tsx           ← participant submit / resubmit
  ├── MyResultsPage.tsx            ← participant results view
  ├── OrganizerDashboard.tsx       ← organizer hub with round cards
  ├── SubmissionListPage.tsx       ← organizer: all submissions table
  ├── EvaluationPage.tsx           ← organizer: evaluate one submission
  └── ShortlistPage.tsx            ← organizer: shortlist + publish
```

---

## 6. Backend Changes

### New: `Backend/src/services/competitionStore.js`

Handles all competition-specific DB operations on `events.sqlite`. Wraps `eventsStore` for event record access. Manages `submissions` table directly.

Key methods:

```javascript
// Participant
createSubmission(eventId, roundId, userId, data)       // enforce all API checks
getActiveSubmission(eventId, roundId, userId)           // latest submission for user
getMyResult(eventId, roundId, userId)                   // strips fields if not published

// Organizer
getSubmissionsForRound(eventId, roundId)                // full list with evaluation state
evaluateSubmission(submissionId, { criteriaScores, totalScore, remarks, decision })
flagSubmission(submissionId, { flagged, flagReason })
applyShortlist(eventId, roundId, { mode, value })       // 'topN' | 'threshold'
publishResults(eventId, roundId)                        // sets flag, fires notifications

// Validation helpers
checkRoundAccess(eventId, roundId, userId)              // registration + shortlist gate
checkResubmissionLimit(eventId, roundId, userId)        // count vs maxResubmissions
checkActiveCompetitionCount(userId)                     // enforce max 3 active
```

### New: `Backend/src/routes/competitionRoutes.js`

Mounted at `/api/competitions` in `app.js`.


| Method | Path                                                                  | Auth        | Purpose                                             |
| ------ | --------------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `POST` | `/api/competitions/:eventId/rounds/:roundId/submit`                   | Participant | Submit (file or link)                               |
| `GET`  | `/api/competitions/:eventId/rounds/:roundId/my-submission`            | Participant | Get own submission (fields stripped if unpublished) |
| `GET`  | `/api/competitions/:eventId/rounds/:roundId/my-result`                | Participant | Get own result (only after publish)                 |
| `GET`  | `/api/competitions/:eventId/rounds/:roundId/submissions`              | Organizer   | List all submissions                                |
| `PUT`  | `/api/competitions/:eventId/rounds/:roundId/submissions/:id/evaluate` | Organizer   | Save evaluation                                     |
| `PUT`  | `/api/competitions/:eventId/rounds/:roundId/submissions/:id/flag`     | Organizer   | Flag / unflag                                       |
| `POST` | `/api/competitions/:eventId/rounds/:roundId/shortlist`                | Organizer   | Apply shortlist                                     |
| `POST` | `/api/competitions/:eventId/rounds/:roundId/publish`                  | Organizer   | Publish results + fire notifications                |
| `GET`  | `/api/competitions/:eventId/config`                                   | Any         | Get competition config (round metadata, no scores)  |


### Modified: `Backend/src/server.js`

```javascript
const competitionStore = createCompetitionStore({ eventsStore, db: eventsDb });
createApp({ ..., competitionStore });
```

### Modified: `Backend/src/app.js`

```javascript
app.use('/api', createCompetitionRoutes({ competitionStore, sessionStore }));
```

---

## 7. What is NOT Being Built

Explicitly out of scope. Do not work on these:


| Item                                           | Reason                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Online quiz / assessment engine                | Separate subsystem requiring question bank, timer, auto-grading |
| Real-time leaderboard during submission phase  | Reveals competitive positioning before evaluation               |
| Code execution / competitive programming judge | Entirely separate infrastructure                                |
| Plagiarism detection                           | Flagging exists; detection is a different product               |
| Team formation and invitations                 | Phase 3 with proper design                                      |
| Panel judging / multi-evaluator                | Phase 4                                                         |
| Payment gateway                                | Out of scope for university-internal platform                   |
| AI recommendations                             | Not defined concretely enough to build                          |
| Admin approval for organizer creation          | Rate limiting + traceability is sufficient for internal use     |


---

## 8. Priority Roadmap

### Phase 1 — Core Loop

**Goal:** One complete end-to-end cycle: single round, individual submission, single evaluator, manually published results.

**Deliverables:**

- `competitionConfig` JSON on events (set during event creation / edit)
- `visibility` field on events with `creator-only` / `public` toggle
- Active competition limit (max 3) enforced at API
- `submissions` table with full schema (including `criteriaScores`, `totalScore`)
- `competitionStore.js` with submit, evaluate, shortlist, publish methods
- `competitionRoutes.js` with all endpoints
- `multer` integration with MIME validation and 25MB limit
- Deadline enforcement at API level (not frontend-only)
- Resubmission counting and limit enforcement
- Conflict-of-interest check (organizer cannot evaluate own submission)
- Result visibility gate in API (strip fields when `resultsPublished = false`)
- `SubmissionPage.tsx` — participant submit form with criteria preview
- `SubmissionListPage.tsx` — organizer submission table with summary bar
- `EvaluationPage.tsx` — per-criteria scoring with prev/next navigation
- `ShortlistPage.tsx` — ranked preview with unevaluated warning, publish button
- `MyResultsPage.tsx` — participant result view (blocked until published)

**This phase alone supports:** poster contests, paper submissions, project demos, report submissions.

---

### Phase 2 — Multi-Round & Organizer Dashboard

**Goal:** Multi-round competitions work end-to-end. Organizer has a proper control center.

**Deliverables:**

- Round access control: `requiresShortlistFromRound` enforced at submission endpoint
- Round progression: shortlisted users automatically notified when next round opens
- `OrganizerDashboard.tsx` with overview cards and round status cards
- Extended event detail page: Rounds, Prizes, Rules, Timeline, Eligibility, FAQ sections
- Event listing filters: type, mode, status, competition toggle
- Competition badge and deadline countdown on event cards
- Announcement broadcast from organizer dashboard

---

### Phase 3 — Team Support

**Goal:** Hackathons and team-based contests natively supported.

**New schema:**

```sql
CREATE TABLE teams (
  id       TEXT PRIMARY KEY,
  eventId  TEXT NOT NULL,
  name     TEXT NOT NULL,
  leaderId TEXT NOT NULL,       -- register number
  members  TEXT NOT NULL,       -- JSON array of register numbers
  createdAt TEXT NOT NULL,
  FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
);
```

**Deliverables:**

- Team creation by any registered participant
- Member invitation by register number (accepted in-platform)
- Submission linked to `teamId` instead of individual `userId`
- One submission per team per round (leader submits on behalf of team)
- Team view in organizer submission list
- All team members see the same result on their results page
- Normalize `competitionConfig.rounds` from JSON into a proper `rounds` table (migration included)

---

### Phase 4 — Engagement & Polish

**Goal:** Platform feels complete and high-quality.

**Deliverables:**

- Deadline reminder notifications (24h before, 1h before) via background job
- Leaderboard page per round (visible only after `resultsPublished = true`)
- Analytics: submission rate, evaluation completion %, average time-to-evaluate
- Co-organizer support: add other register numbers to share admin access
- Certificate generation: PDF with participant name, competition name, round, result (using existing PDF skill)
- Panel judging: separate `evaluations` table, one row per evaluator per submission, aggregated total

---

## 9. Decision Log


| Decision                 | Choice                                      | Rationale                                                           |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------- |
| Organizer identity       | Any authenticated student                   | Platform is internal; accounts are traceable                        |
| Spam prevention          | Max 3 active competitions + visibility gate | Simple, enforceable, no approval workflow needed                    |
| File storage             | `Backend/data/submissions/` filesystem      | Mirrors existing events gallery; no new infrastructure              |
| MIME validation          | Server-side via `multer` fileFilter         | Extension-only validation is trivially bypassed                     |
| Submission scope         | Individual only (Phase 1 & 2)               | Teams are a full subsystem; keeping Phase 1 shippable               |
| Evaluation model         | Single evaluator, criteria scores as JSON   | Flexible breakdown without new table; total stored for fast sorting |
| Conflict of interest     | API-level 403 if evaluator = submitter      | Cannot be enforced frontend-only                                    |
| Result visibility        | Manual publish gate, API strips fields      | Single authoritative gate; frontend cannot be trusted               |
| Tie-breaking             | Earlier submission time wins                | Deterministic; no manual decisions                                  |
| Unevaluated in shortlist | Excluded, shown as warning                  | Organizer must be aware; not silently dropped                       |
| Round access control     | Server-side shortlist check                 | Critical for multi-round integrity                                  |
| Resubmission limit       | Configurable per round, default 5           | Prevents spam; organizer can adjust                                 |
| Config storage           | JSON column on events (Phase 1 & 2)         | Fast to implement; normalize in Phase 3                             |
| New dependency           | `multer` only                               | Minimal footprint                                                   |


