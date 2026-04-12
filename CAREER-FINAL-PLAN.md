# Career Domain — System Plan

> **Version:** 2.0 — Refined, Execution-Focused
> **Base System:** University ERP Companion Platform v2.0.0
> **Last Updated:** April 2026

---

## 0. Philosophy & Core Principles

The Career Portal is an autonomous opportunity discovery and delivery system. It pulls from external platforms on a schedule, normalizes everything into one format, and surfaces relevant opportunities to students — without admin involvement.

**Non-negotiable principles:**

1. **Autonomous by default** — Runs on a schedule. New opportunities appear and expired ones disappear automatically.
2. **ERP-informed** — Branch and year from the student's ERP session filter the feed without them setting anything up manually.
3. **Multi-source, unified output** — All types (jobs, internships, hackathons, competitions) appear in one normalized format.
4. **Python writes, Node.js reads** — Scrapers are Python, delivery is Node.js. They share a SQLite file. No HTTP API between them.
5. **Ships without scrapers** — Phase 1 is fully functional using manual student submissions only.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                PYTHON SCRAPER SERVICE                        │
│                                                             │
│  JobSpy ─────────────────────────────────────────────────┐  │
│  Devfolio (Playwright) ──→ Normalizer → Deduplicator → SQLite │
│                                                             │
│  [Runs every 6 hours via schedule library]                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ Shared file: Backend/data/career.sqlite
                          ▼
┌─────────────────────────────────────────────────────────────┐
│             NODE.JS EXPRESS BACKEND (:5000)                  │
│                                                             │
│  careerRoutes.js → careerStore.js → career.sqlite           │
│                                                             │
│  + ERP session (branch + year auto-detected)                │
│  + Existing auth, notifications, Redis                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP /api/career/*
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  REACT FRONTEND (SPA)                        │
│  Blueprint-driven routing (erpBlueprints.ts)                │
└─────────────────────────────────────────────────────────────┘
```

**Why Python + Node.js via shared SQLite:**
Python scrapers write to `career.sqlite`. Node.js reads from the same file. No network between them. If the Python service is down, Node.js still serves whatever is in the DB.

---

## 2. Opportunity Types


| Type          | Description                                | Sources                              |
| ------------- | ------------------------------------------ | ------------------------------------ |
| `job`         | Full-time employment                       | JobSpy (LinkedIn, Indeed, Glassdoor) |
| `internship`  | Internship positions                       | JobSpy, Internshala (Phase 3+)       |
| `hackathon`   | Team coding competitions                   | Devfolio                             |
| `competition` | Case studies, quizzes, paper presentations | Unstop (Phase 3+)                    |
| `fellowship`  | Research fellowships and programs          | Playwright custom (Phase 4+)         |
| `workshop`    | Skill-building workshops                   | Unstop (Phase 3+)                    |


---

## 3. Database Schema

**Database:** `Backend/data/career.sqlite`
Written by the Python scraper service. Read by the Node.js backend. Schema defined once — never changed between phases.

---

### 3.1 Core Opportunity Table

```sql
CREATE TABLE IF NOT EXISTS career_opportunities (
  id              TEXT PRIMARY KEY,

  -- Classification
  type            TEXT NOT NULL CHECK(type IN ('job','internship','hackathon','competition','fellowship','workshop')),
  title           TEXT NOT NULL,
  company         TEXT,
  organizer       TEXT,

  -- Description
  description     TEXT,
  shortDescription TEXT,             -- first 200 chars, used on cards
  requirements    TEXT,
  skills          TEXT DEFAULT '[]', -- JSON array: ["Python","React"]
  tags            TEXT DEFAULT '[]',

  -- Location & mode
  location        TEXT,
  mode            TEXT CHECK(mode IN ('remote','onsite','hybrid','online','offline')),
  isPanIndia      INTEGER DEFAULT 0,

  -- Eligibility ([] = no restriction = all eligible)
  eligibleBranches TEXT DEFAULT '[]',
  eligibleYears    TEXT DEFAULT '[]',
  minCGPA         REAL,

  -- Compensation
  stipend         TEXT,
  prize           TEXT,
  isFree          INTEGER DEFAULT 1,

  -- Timing
  postedAt        TEXT,
  deadline        TEXT,
  startDate       TEXT,
  duration        TEXT,

  -- Source
  source          TEXT NOT NULL,     -- 'jobspy' | 'devfolio' | 'unstop' | 'manual' | 'playwright'
  sourceUrl       TEXT NOT NULL UNIQUE,
  applyUrl        TEXT,

  -- Engagement
  viewCount       INTEGER DEFAULT 0,
  bookmarkCount   INTEGER DEFAULT 0,
  applyCount      INTEGER DEFAULT 0,
  relevanceScore  REAL DEFAULT 0,    -- base score, computed at scrape time

  -- State
  isActive        INTEGER DEFAULT 1,
  isVerified      INTEGER DEFAULT 0,
  isFeatured      INTEGER DEFAULT 0,
  moderationState INTEGER DEFAULT 0, -- 0=visible, 1=flagged, 2=hidden

  -- Timestamps
  scrapedAt       TEXT NOT NULL,
  updatedAt       TEXT
);

CREATE INDEX IF NOT EXISTS idx_career_type        ON career_opportunities(type);
CREATE INDEX IF NOT EXISTS idx_career_deadline    ON career_opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_career_active      ON career_opportunities(isActive);
CREATE INDEX IF NOT EXISTS idx_career_source      ON career_opportunities(source);
CREATE INDEX IF NOT EXISTS idx_career_posted      ON career_opportunities(postedAt DESC);
CREATE INDEX IF NOT EXISTS idx_career_relevance   ON career_opportunities(relevanceScore DESC);
CREATE INDEX IF NOT EXISTS idx_career_deadline_active ON career_opportunities(deadline, isActive);

CREATE VIRTUAL TABLE IF NOT EXISTS career_search USING fts5(
  title, description, skills, tags, company, organizer,
  content='career_opportunities',
  content_rowid='rowid'
);
```

---

### 3.2 Student Interaction Tables

```sql
CREATE TABLE IF NOT EXISTS career_bookmarks (
  opportunityId  TEXT NOT NULL,
  userId         TEXT NOT NULL,
  createdAt      TEXT NOT NULL,
  PRIMARY KEY (opportunityId, userId)
);

CREATE TABLE IF NOT EXISTS career_applications (
  id             TEXT PRIMARY KEY,
  opportunityId  TEXT NOT NULL,
  userId         TEXT NOT NULL,
  status         TEXT DEFAULT 'applied',
  -- 'applied' | 'under_review' | 'shortlisted' | 'interviewed' | 'offered' | 'rejected' | 'withdrawn'
  appliedAt      TEXT NOT NULL,
  notes          TEXT,
  updatedAt      TEXT
);

CREATE INDEX IF NOT EXISTS idx_career_apps_user ON career_applications(userId);

CREATE TABLE IF NOT EXISTS career_flags (
  id             TEXT PRIMARY KEY,
  opportunityId  TEXT NOT NULL,
  userId         TEXT NOT NULL,
  reason         TEXT,
  createdAt      TEXT NOT NULL,
  UNIQUE (opportunityId, userId)
);

CREATE TABLE IF NOT EXISTS career_dismissals (
  opportunityId  TEXT NOT NULL,
  userId         TEXT NOT NULL,
  createdAt      TEXT NOT NULL,
  PRIMARY KEY (opportunityId, userId)
);

CREATE TABLE IF NOT EXISTS career_views (
  opportunityId  TEXT NOT NULL,
  userId         TEXT NOT NULL,
  viewedAt       TEXT NOT NULL,
  PRIMARY KEY (opportunityId, userId)
);
```

---

### 3.3 Career Profile & Skill Gap (Phase 4+)

```sql
-- Created in Phase 4. Not used before that.
CREATE TABLE IF NOT EXISTS career_profiles (
  userId           TEXT PRIMARY KEY,
  skills           TEXT DEFAULT '[]',
  preferredTypes   TEXT DEFAULT '[]',
  preferredLocations TEXT DEFAULT '[]',
  cgpa             REAL,
  bio              TEXT,
  linkedinUrl      TEXT,
  githubUrl        TEXT,
  portfolioUrl     TEXT,
  resumePath       TEXT,
  resumeUpdatedAt  TEXT,
  openToWork       INTEGER DEFAULT 1,
  updatedAt        TEXT
);

CREATE TABLE IF NOT EXISTS career_skill_gaps (
  userId         TEXT NOT NULL,
  skill          TEXT NOT NULL,
  gapLevel       TEXT CHECK(gapLevel IN ('missing','partial','proficient')),
  opportunityCount INTEGER DEFAULT 0,
  updatedAt      TEXT NOT NULL,
  PRIMARY KEY (userId, skill)
);
```

---

### 3.4 Manual Submissions & Scraper Logs

```sql
CREATE TABLE IF NOT EXISTS career_submissions (
  id             TEXT PRIMARY KEY,
  submittedBy    TEXT NOT NULL,
  status         TEXT DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected'
  reviewedAt     TEXT,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  company        TEXT,
  organizer      TEXT,
  description    TEXT,
  skills         TEXT DEFAULT '[]',
  tags           TEXT DEFAULT '[]',
  location       TEXT,
  mode           TEXT,
  eligibleBranches TEXT DEFAULT '[]',
  eligibleYears  TEXT DEFAULT '[]',
  stipend        TEXT,
  prize          TEXT,
  deadline       TEXT,
  startDate      TEXT,
  applyUrl       TEXT NOT NULL,
  createdAt      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS career_scraper_runs (
  id             TEXT PRIMARY KEY,
  source         TEXT NOT NULL,
  startedAt      TEXT NOT NULL,
  completedAt    TEXT,
  status         TEXT DEFAULT 'running',
  newCount       INTEGER DEFAULT 0,
  updatedCount   INTEGER DEFAULT 0,
  expiredCount   INTEGER DEFAULT 0,
  errorMessage   TEXT,
  durationMs     INTEGER
);

CREATE TABLE IF NOT EXISTS career_source_health (
  source              TEXT PRIMARY KEY,
  lastSuccess         TEXT,
  lastAttempt         TEXT,
  consecutiveFails    INTEGER DEFAULT 0,
  isBlocked           INTEGER DEFAULT 0,
  notes               TEXT
);
```

---

## 4. Python Scraper Service

**Location:** `Scraper/` at project root.

```
Scraper/
  main.py               ← entry point
  scheduler.py          ← runs all enabled scrapers every 6 hours
  config.py             ← search terms, limits, timeouts
  db.py                 ← SQLite writer
  normalizer.py         ← raw data → OpportunityObject
  deduplicator.py       ← URL-based + fingerprint-based dedup
  intelligence.py       ← skill extraction (dictionary), base relevance score
  scrapers/
    jobspy_scraper.py   ← Phase 2: LinkedIn, Indeed, Glassdoor
    devfolio_scraper.py ← Phase 2: Hackathons
    unstop_scraper.py   ← Phase 3: Competitions + workshops
    internshala_scraper.py ← Phase 3: Internships
    playwright_base.py  ← shared Playwright helpers
  requirements.txt
```

**Python dependencies:**

```
jobspy        # LinkedIn, Indeed, Glassdoor
playwright    # Devfolio, Unstop, Internshala
pandas        # data transformation
schedule      # cron-style scheduling
```

spaCy is **not included** initially. Skill extraction uses a dictionary lookup. spaCy is deferred to Phase 4+ if dictionary proves insufficient.

---

### 4.1 Normalized Opportunity Object

Every scraper produces this exact dict before writing to the DB:

```python
{
  "id": str,                 # uuid4()
  "type": str,               # one of the 6 allowed types
  "title": str,
  "company": str | None,
  "organizer": str | None,
  "description": str | None,
  "shortDescription": str,   # description[:200].strip()
  "requirements": str | None,
  "skills": list[str],       # from dictionary lookup
  "tags": list[str],
  "location": str | None,
  "mode": str | None,
  "isPanIndia": bool,
  "eligibleBranches": list[str],  # [] = all
  "eligibleYears": list[int],     # [] = all
  "minCGPA": float | None,
  "stipend": str | None,
  "prize": str | None,
  "isFree": bool,
  "postedAt": str | None,
  "deadline": str | None,
  "startDate": str | None,
  "duration": str | None,
  "source": str,
  "sourceUrl": str,          # UNIQUE, primary dedup key
  "applyUrl": str,
  "scrapedAt": str,          # ISO8601
}
```

---

### 4.2 Deduplication

**Layer 1 — URL (primary):** `sourceUrl` has UNIQUE constraint. Duplicate URL → UPDATE existing record, refresh `updatedAt`.

**Layer 2 — Fingerprint (cross-source):** For the same event listed on multiple platforms:

```python
fingerprint = sha256(f"{title.lower().strip()}{(organizer or company or '').lower()}{deadline or ''}").hexdigest()[:16]
```

If fingerprint matches an existing record → skip insert, add the new source to a JSON `sources` array on the existing record.

---

### 4.3 Skill Extraction (Phase 2 — Dictionary Only)

```python
TECH_SKILLS = {
    "python", "javascript", "typescript", "react", "node.js", "express",
    "machine learning", "deep learning", "data science", "sql", "mongodb",
    "aws", "docker", "kubernetes", "git", "java", "c++", "c", "rust",
    "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "flutter", "android", "ios", "swift", "kotlin", "django", "flask",
    "graphql", "rest api", "linux", "networking", ...
}

def extract_skills(text: str) -> list[str]:
    text_lower = text.lower()
    return [skill for skill in TECH_SKILLS if skill in text_lower]
```

Fast, deterministic, zero model dependencies. spaCy is a Phase 4+ upgrade path, not a Phase 2 requirement.

---

### 4.4 Eligibility Parsing (Phase 2 — Basic Regex Only)

```python
def parse_eligible_years(text: str) -> list[int]:
    # Matches: "3rd year", "final year", "2nd and 3rd year", "B.Tech 3rd/4th year"
    # Returns [] (all eligible) when parsing is ambiguous

def parse_eligible_branches(text: str) -> list[str]:
    # Matches: "CSE", "Computer Science", "ECE", "All branches"
    # Returns [] (all eligible) when ambiguous

def parse_cgpa(text: str) -> float | None:
    # Matches: "CGPA > 7.0", "minimum 6.5 CGPA"
    # Returns None when not found
```

When parsing fails, defaults to empty (all eligible). Never blocks an opportunity from appearing due to a parse error.

---

### 4.5 Base Relevance Score (Phase 2 — Simple Formula)

Computed at scrape time. Stored in `relevanceScore`. Not user-specific.

```python
def compute_base_relevance(opportunity: dict) -> float:
    score = 0.0

    # Recency (max 30 points)
    if opportunity.get("postedAt"):
        days_old = (now - posted_at).days
        score += max(0, 30 - days_old * 2)

    # Deadline urgency (max 20 points)
    if opportunity.get("deadline"):
        days_left = (deadline - now).days
        if 0 < days_left <= 7:
            score += 20
        elif days_left <= 14:
            score += 10

    # Has compensation info (10 points)
    if opportunity.get("stipend") or opportunity.get("prize"):
        score += 10

    # Has apply link (5 points)
    if opportunity.get("applyUrl"):
        score += 5

    # Has description (5 points)
    if opportunity.get("description") and len(opportunity["description"]) > 200:
        score += 5

    return round(score, 2)
```

User-specific scoring (skill match, branch, year) is Phase 4+.

---

### 4.6 Expiry Logic

Runs at the end of every scraper run:

```python
def expire_old_opportunities(db):
    # Past deadline → inactive
    db.execute("""
        UPDATE career_opportunities
        SET isActive = 0
        WHERE deadline < datetime('now')
          AND deadline IS NOT NULL
          AND isActive = 1
    """)
    # No deadline + older than 60 days → inactive
    db.execute("""
        UPDATE career_opportunities
        SET isActive = 0
        WHERE deadline IS NULL
          AND postedAt < datetime('now', '-60 days')
          AND isActive = 1
    """)
```

---

### 4.7 Circuit Breaker (Phase 2)

Each scraper is wrapped with a simple failure counter:

```python
def run_with_circuit_breaker(source: str, fn):
    health = db.get_source_health(source)
    if health["isBlocked"] and (now - health["lastAttempt"]).hours < 24:
        return  # skip this run

    try:
        run_id = db.start_run(source)
        fn()
        db.complete_run(run_id, status="completed")
        db.reset_fails(source)
    except Exception as e:
        db.complete_run(run_id, status="failed", error=str(e))
        if db.increment_fails(source) >= 5:
            db.set_blocked(source)  # 24h cooldown
```

---

### 4.8 Scrapers (Phase 2: JobSpy + Devfolio only)

**JobSpy (jobs + internships):**

```python
from jobspy import scrape_jobs

def run_jobspy():
    for term in config.SEARCH_TERMS:  # configured in config.py
        jobs = scrape_jobs(
            site_name=["linkedin", "indeed", "glassdoor"],
            search_term=term,
            location="India",
            results_wanted=50,
            hours_old=24,
            country_indeed="India",
        )
        for _, row in jobs.iterrows():
            opp = normalizer.from_jobspy(row)
            db.upsert(opp)
```

**Devfolio (hackathons):**

```python
async def run_devfolio():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://devfolio.co/hackathons")
        await page.wait_for_selector("[data-testid='hackathon-card']")
        cards = await page.query_selector_all("[data-testid='hackathon-card']")
        for card in cards:
            raw = await extract_card_data(card)
            opp = normalizer.from_devfolio(raw)
            db.upsert(opp)
        await browser.close()
```

Phase 3+ scrapers (Unstop, Internshala) are added only after JobSpy and Devfolio are stable.

---

## 5. Node.js Backend

### 5.1 New Files

```
Backend/src/
  services/
    careerStore.js          ← all career DB operations
    careerNotifier.js       ← deadline notifications (Phase 5)
  routes/
    careerRoutes.js
```

`careerRelevanceEngine.js` (user-specific scoring) is Phase 4+. Not created before that.

---

### 5.2 careerStore.js — Phase 1 + 2 Methods

```javascript
// Core reads
getOpportunities({ type, skills, location, mode, query, sort, page, limit })
// All queries add: WHERE isActive = 1 AND moderationState = 0

getOpportunity(id, userId)     // + bookmark/apply state for this user

// Student actions
bookmarkOpportunity(opportunityId, userId)   // toggle
dismissOpportunity(opportunityId, userId)    // "not interested"
trackView(opportunityId, userId)             // async, fire-and-forget
trackApply(opportunityId, userId)
flagOpportunity(opportunityId, userId, reason)

// Application tracker
createApplication(userId, opportunityId)
updateApplicationStatus(id, userId, status, notes)
getApplications(userId)

// Manual submissions
submitOpportunity(userId, data)
autoApproveIfValid(submissionId)   // checks URL, deadline, title length

// Health
getScraperHealth()
getScraperRuns(limit)
```

Phase 4+ methods (`getPersonalizedFeed`, `computeSkillGaps`, `getSkillMatchScore`) are added in Phase 4. Not before.

---

### 5.3 ERP Integration (Phase 1)

Branch and year are read from the existing ERP session profile on every request — no student setup required:

```javascript
function extractUserContext(session) {
  const profile = session.profileData?.TableContent;
  return {
    branch: extractBranch(profile?.["Program / Section"]),  // "CSE" from "B.Tech CSE / A"
    year: extractYear(profile?.["Academic Year"]),           // 3 from "III Year"
  };
}
```

Used in Phase 1+2 to apply default eligibility filtering. Used in Phase 4+ for personalized scoring.

---

## 6. API Reference

### Opportunities


| Method | Path                            | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| `GET`  | `/api/career/opportunities`     | List/filter with pagination          |
| `GET`  | `/api/career/opportunities/:id` | Single opportunity + user context    |
| `GET`  | `/api/career/deadline-soon`     | Bookmarked, expiring in ≤ 3 days     |
| `GET`  | `/api/career/health`            | Scraper status and last run times    |
| `GET`  | `/api/career/stats`             | Counts by type, source, total active |


**GET /api/career/opportunities — query parameters:**


| Param        | Type    | Description                                            |
| ------------ | ------- | ------------------------------------------------------ |
| `type`       | string  | job, internship, hackathon, competition, etc.          |
| `skills`     | string  | Comma-separated skill filter                           |
| `location`   | string  | Location or "Remote"                                   |
| `mode`       | string  | remote, onsite, hybrid, online, offline                |
| `isFree`     | boolean | Only free opportunities                                |
| `hasStipend` | boolean | Only with stipend/prize                                |
| `query`      | string  | Full-text search                                       |
| `sort`       | string  | `relevance` (default), `deadline`, `recent`, `popular` |
| `page`       | integer | Default 1                                              |
| `limit`      | integer | Default 20, max 50                                     |


Note: `branch` and `year` are always read from the ERP session server-side, not passed as query params.

### Student Actions


| Method | Path                                     | Description         |
| ------ | ---------------------------------------- | ------------------- |
| `POST` | `/api/career/opportunities/:id/bookmark` | Toggle bookmark     |
| `POST` | `/api/career/opportunities/:id/dismiss`  | "Not Interested"    |
| `POST` | `/api/career/opportunities/:id/apply`    | Track apply click   |
| `POST` | `/api/career/opportunities/:id/flag`     | Flag for moderation |
| `POST` | `/api/career/opportunities/:id/view`     | Async view record   |


### Application Tracker


| Method   | Path                           | Description               |
| -------- | ------------------------------ | ------------------------- |
| `GET`    | `/api/career/applications`     | Own application records   |
| `POST`   | `/api/career/applications`     | Create application record |
| `PUT`    | `/api/career/applications/:id` | Update status or notes    |
| `DELETE` | `/api/career/applications/:id` | Remove from tracker       |


### Manual Submissions


| Method | Path                             | Description              |
| ------ | -------------------------------- | ------------------------ |
| `POST` | `/api/career/submit`             | Submit opportunity       |
| `GET`  | `/api/career/submit/pending`     | Pending submissions list |
| `POST` | `/api/career/submit/:id/approve` | Approve submission       |


### Profile & Skill Gap (Phase 4+)


| Method | Path                             | Phase | Description        |
| ------ | -------------------------------- | ----- | ------------------ |
| `GET`  | `/api/career/profile`            | 4+    | Career profile     |
| `PUT`  | `/api/career/profile`            | 4+    | Update profile     |
| `POST` | `/api/career/profile/resume`     | 4+    | Upload resume      |
| `GET`  | `/api/career/profile/skill-gaps` | 4+    | Skill gap analysis |
| `GET`  | `/api/career/feed`               | 4+    | Personalized feed  |


---

## 7. Frontend Architecture

### 7.1 Pages

Registered in `erpBlueprints.ts` with `sourceMode: "internal"`.

**Phase 1 pages (ship before any scraper runs):**

```
/career                      → CareerHomePage.tsx
/career/opportunities        → OpportunitiesPage.tsx
/career/opportunities/:id    → OpportunityDetailPage.tsx
/career/me/bookmarks         → BookmarksPage.tsx
/career/me/tracker           → ApplicationTrackerPage.tsx
/career/submit               → SubmitOpportunityPage.tsx
```

**Phase 3+ pages (type-filtered shortcuts):**

```
/career/hackathons           → OpportunitiesPage with type=hackathon pre-set
/career/internships          → OpportunitiesPage with type=internship pre-set
/career/jobs                 → OpportunitiesPage with type=job pre-set
/career/competitions         → OpportunitiesPage with type=competition pre-set
```

**Phase 4+ pages:**

```
/career/me/profile           → CareerProfilePage.tsx
/career/me/skill-gap         → SkillGapPage.tsx
```

---

### 7.2 Phase 1 Page Descriptions

**CareerHomePage** (`/career`)

- Quick-type filter buttons: All / Jobs / Internships / Hackathons / Competitions
- "Expiring Soon" strip: opportunities with deadline in next 3 days (deadline countdown)
- Latest opportunities grid (paginated, default sort: relevance)
- My Tracker shortcut with application count badge
- "Submit an opportunity" CTA

**OpportunitiesPage** (`/career/opportunities`)

- Filter sidebar: Type, Mode, Location, Skills, Free Only, Has Stipend
- Search bar (LIKE Phase 1, FTS5 Phase 2)
- Sort: Relevance (default), Deadline Nearest, Most Recent, Most Applied
- Opportunity cards (see components below)
- Load More pagination

**OpportunityDetailPage** (`/career/opportunities/:id`)

- Full title, company/organizer, description, requirements
- Eligibility section: eligible branches, years, CGPA — with ✓ / ✗ vs user's ERP profile
- Deadline displayed prominently with days-remaining countdown
- Stipend or prize displayed if available
- Apply button → logs click + opens `applyUrl` in new tab
- "Add to Tracker" button
- Bookmark toggle, Flag button
- Similar opportunities section (same type + overlapping skills)

**ApplicationTrackerPage** (`/career/me/tracker`)

- List view with status dropdown per application
- Status options: Applied, Under Review, Shortlisted, Interviewed, Offered, Rejected, Withdrawn
- Private notes per application
- Linked opportunity title (clickable)

**SubmitOpportunityPage** (`/career/submit`)

- Form: type, title, apply URL (required), plus optional fields
- Auto-approved if: valid HTTPS URL + future deadline + title > 10 chars + no duplicate URL
- Otherwise: pending (shown to other students who can approve)

---

### 7.3 Shared Components

```
Frontend/src/components/career/
  OpportunityCard.tsx         ← title, type badge, deadline, skills, company, stipend
  DeadlineCountdown.tsx       ← "3 days left" chip, color-coded by urgency
  EligibilityBadge.tsx        ← ✓ Eligible / ✗ Not eligible vs ERP profile
  TypeBadge.tsx               ← color-coded: Job / Internship / Hackathon / etc.
  StipendChip.tsx             ← "₹15,000/month" or "Prize: ₹1L" or "Free"
  ModeChip.tsx                ← Remote / Onsite / Hybrid
  FilterSidebar.tsx
  ApplicationStatusDropdown.tsx
  SourceBadge.tsx             ← "via LinkedIn", "via Devfolio"
```

Phase 4+ components (`SkillMatchBar`, `SkillGapTable`, `TrackerKanban`) are not built before Phase 4.

---

## 8. Deadline Display Rules


| Deadline State | Display                         |
| -------------- | ------------------------------- |
| > 14 days      | "Deadline: Nov 30" (neutral)    |
| 7–14 days      | "Deadline in 12 days" (yellow)  |
| 3–7 days       | "Deadline in 4 days" (orange)   |
| < 3 days       | "⚡ 2 days left" (red, bold)     |
| Today          | "⚡ Today! Closes tonight" (red) |
| Passed         | Not shown (`isActive = 0`)      |


---

## 9. Notifications (Phase 5)

Built in Phase 5. Not wired before that.

Uses the existing `eventsStore.js` notification system. Two triggers:

- Bookmarked opportunity deadline within 3 days → "Application deadline approaching"
- New opportunity matching user's skills (Phase 4+ only, max once/day) → digest notification

---

## 10. What Is NOT Being Built


| Item                            | Reason                                                         |
| ------------------------------- | -------------------------------------------------------------- |
| LinkedIn OAuth / API            | Requires approval; JobSpy handles LinkedIn scraping            |
| Resume builder                  | Out of scope; upload covers the need                           |
| Interview prep content          | Covered by LMS domain                                          |
| Company profiles / reviews      | Too large; link to Glassdoor instead                           |
| Real-time email alerts          | Existing notification system handles this                      |
| AI-based resume scoring         | Deterministic skill-match is sufficient                        |
| Referral system                 | Out of scope                                                   |
| spaCy / NLP pipeline            | Dictionary lookup handles Phase 1–3; defer spaCy to Phase 4+   |
| User-specific relevance scoring | Phase 4+ only; base score used until then                      |
| Kanban tracker UI               | Phase 4+ if desired; list view with status dropdown is Phase 1 |


---

## 11. Roadmap

### Phase 1 — Foundation & UI

**Goal:** Students can browse and track opportunities before any scraper runs.

**Included:**

- `career.sqlite` with all tables defined
- `careerStore.js` with Phase 1+2 methods only
- `careerRoutes.js` with opportunity listing, detail, bookmark, apply-track, flag, dismiss, view
- Manual submission flow with auto-approve logic
- ERP session branch + year extraction
- Basic eligibility ✓/✗ on detail page (using ERP data)
- Default relevance sort (by `postedAt` desc initially, `relevanceScore` once scrapers run)
- Deadline countdown display on cards and detail page
- Application tracker (list view, status dropdown, notes)
- `CareerHomePage.tsx`, `OpportunitiesPage.tsx`, `OpportunityDetailPage.tsx`
- `BookmarksPage.tsx`, `ApplicationTrackerPage.tsx`, `SubmitOpportunityPage.tsx`

**NOT in this phase:**

- No scrapers running (UI works with manual data only)
- No Python service of any kind
- No career profiles
- No skill gap analysis
- No personalized scoring
- No notifications
- No skill match display
- No type-filtered shortcut pages (/career/hackathons etc.)

---

### Phase 2 — JobSpy + Devfolio Scrapers

**Goal:** System becomes autonomous for jobs and hackathons.

**Included:**

- `Scraper/` directory with `requirements.txt`
- `normalizer.py`, `deduplicator.py`, `db.py`, `intelligence.py`
- `jobspy_scraper.py` — LinkedIn + Indeed + Glassdoor
- `devfolio_scraper.py` — Hackathons via Playwright
- `scheduler.py` — runs every 6 hours
- Skill extraction via dictionary lookup (no spaCy)
- Basic eligibility parsing (regex, defaults to all-eligible on ambiguity)
- Base relevance score formula (recency + deadline urgency + data quality)
- Expiry logic (past deadline → `isActive = 0`)
- Circuit breaker per source
- `career_scraper_runs` and `career_source_health` tables populated
- `GET /api/career/health` endpoint
- FTS5 search upgrade (full-text search now functional)

**NOT in this phase:**

- No Unstop scraper
- No Internshala scraper
- No user-specific relevance scoring
- No career profiles
- No spaCy

---

### Phase 3 — Unstop + Internshala Scrapers

**Goal:** Competitions, workshops, and more internships added. Only after Phase 2 scrapers are stable.

**Included:**

- `unstop_scraper.py` — competitions + workshops
- `internshala_scraper.py` — internships
- Cross-source deduplication (fingerprint matching)
- Type-filtered shortcut pages: `/career/hackathons`, `/career/internships`, `/career/jobs`, `/career/competitions`

**NOT in this phase:**

- No career profiles
- No skill gap analysis
- No personalized scoring

---

### Phase 4 — Career Profile & Personalization

**Goal:** The system knows who the student is and scores opportunities for them specifically.

**Included:**

- `career_profiles`, `career_skill_gaps` tables
- `CareerProfilePage.tsx` — skills (multi-select), preferred types, preferred locations, CGPA, bio, LinkedIn, GitHub, portfolio
- Resume upload (PDF, 5 MB max, served via existing Nginx `/files/` route)
- `SkillGapPage.tsx` — which skills to add, how many opportunities each unlocks, LMS cross-link
- `careerRelevanceEngine.js` — user-specific scoring (skill match + branch + year + preferences)
- Skill match display on opportunity cards and detail page
- Personalized feed endpoint (`GET /api/career/feed`)
- `GET /api/career/profile/skill-gaps`

**NOT in this phase:**

- No Kanban tracker upgrade
- No spaCy

---

### Phase 5 — Notifications & Deadline Alerts

**Goal:** Students never miss a deadline they care about.

**Included:**

- `careerNotifier.js` wired to existing `eventsStore.js` notification system
- Deadline reminder (3 days before, bookmarked opportunities only)
- New skill-match opportunity digest (max once/day, requires Phase 4 profile)
- Manual submission approved notification

**NOT in this phase:**

- No email notifications (existing in-platform notifications only)

---

### Phase 6 — Analytics & Caching

**Goal:** Platform health is visible, hot paths are fast.

**Included:**

- `GET /api/career/stats` — total active by type, source breakdown, new this week
- Scraper health surfaced in the existing `/api/health` endpoint
- Trending opportunities (`career_views` + `career_bookmarks` velocity)
- Redis caching for: trending, stats, health, personalized feed

---

## 12. New Dependencies

**Python service (`Scraper/`):**

- `jobspy` — LinkedIn/Indeed/Glassdoor
- `playwright` — Devfolio, Unstop, Internshala
- `pandas` — data cleaning
- `schedule` — cron-style scheduling

**Node.js backend:**

- No new packages. `multer` already added for LMS.

---

## 13. Architecture Fit

```
Scraper/ (Python, independent process)
  Phase 2: jobspy_scraper.py, devfolio_scraper.py
  Phase 3: unstop_scraper.py, internshala_scraper.py
  scheduler.py → runs every 6 hours
       │
       │ Writes to Backend/data/career.sqlite
       ▼
Backend/src/ (Node.js)
  careerRoutes.js
  careerStore.js            ←→  career.sqlite (read-only from Node.js)
  careerNotifier.js (Phase 5)
  careerRelevanceEngine.js  (Phase 4)
       │
       ├── ERP session → branch + year (Phase 1+)
       ├── eventsStore.js → notifications (Phase 5)
       ├── multer → resume upload (Phase 4)
       ├── Nginx /files/ → resume serving (Phase 4)
       └── Redis → caching (Phase 6)
       │
       │ /api/career/*
       ▼
Frontend/src/pages/ (React)
  Phase 1: CareerHomePage, OpportunitiesPage, OpportunityDetailPage,
           BookmarksPage, ApplicationTrackerPage, SubmitOpportunityPage
  Phase 3: type-filtered shortcut pages
  Phase 4: CareerProfilePage, SkillGapPage
```

---

## 14. Decision Log


| Decision            | Choice                                   | Reason                                                                 |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Python + Node.js    | Shared SQLite file                       | No HTTP API; Python writes, Node reads; zero network overhead          |
| Scheduling          | `schedule` library                       | Lightweight; no Redis/Celery dependency                                |
| Deduplication       | URL UNIQUE + content fingerprint         | URL covers 95% of cases; fingerprint catches cross-platform duplicates |
| Skill extraction    | Dictionary lookup only (Phase 1–3)       | Deterministic, fast; spaCy deferred to Phase 4+                        |
| Eligibility parsing | Basic regex, defaults to all-eligible    | Never blocks an opportunity due to parse failure                       |
| Relevance scoring   | Base score in Python only (Phase 1–3)    | User-specific scoring deferred to Phase 4                              |
| Scraper rollout     | JobSpy + Devfolio first, rest in Phase 3 | Stable before expanding; Playwright scrapers are fragile               |
| Resume storage      | PDF only, 5 MB max, filesystem           | multer already installed; Nginx already serves /files/                 |
| Manual submissions  | Any student, auto-approve if valid       | No admin overhead; register number prevents abuse                      |
| Application tracker | List view (not Kanban) initially         | Simpler to build; Kanban is Phase 4+ upgrade                           |
| Cache               | SQLite first, Redis in Phase 6           | SQLite reads are fast enough for initial scale                         |
| Notifications       | Phase 5 only                             | No point alerting before sufficient content exists                     |
| spaCy               | Deferred to Phase 4+                     | Dictionary lookup sufficient for Phase 1–3                             |


---

## 15. Execution Constraints

- **System must work without scrapers.** Phase 1 is fully functional with manual submissions only. Never make the UI dependent on the Python service being alive.
- **Do not build future-phase features early.** `careerRelevanceEngine.js` is not created until Phase 4. Notification wiring is not added until Phase 5. No exceptions.
- **Add intelligence only after sufficient data exists.** Skill gap analysis requires a meaningful number of opportunities in the DB before it has signal. Do not surface it to users in Phase 1 or 2.
- **Add new scrapers only after previous ones are stable.** Phase 3 scrapers (Unstop, Internshala) are added only after JobSpy and Devfolio have run successfully for at least one week without circuit breaker triggers.
- **Never use spaCy before Phase 4.** The dictionary-based skill extractor is sufficient for the data volume in Phases 1–3. spaCy is added only if the dictionary proves insufficient after real data shows gaps.
- **The Python service is write-only.** It never reads from the Node.js backend and never calls any backend API. Communication is one-way: Python → SQLite ← Node.js.
- **Schema is defined once.** All tables (including Phase 4+ tables like `career_profiles`) are created at startup in Phase 1. No migrations. Only the application code that uses them is added phase by phase.

