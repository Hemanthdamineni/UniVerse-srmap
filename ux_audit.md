# UX Audit: University-ERP
Generated: 2026-05-30

---

## 1. Post-Login User Journey

After successful login at `/login`, user lands on `/dashboard`. The sidebar defaults to **Advanced mode** (all items visible). The sidebar is the primary navigation for all authenticated features.

### Sidebar Structure

```
┌────────────────────────────────┐
│ ERP CORE (section)             │
│  ● Dashboard                   │ ← you are here
│  ▼ Academics (group)           │
│     Time Table                 │
│     Attendance Details         │
│     Curriculum                 │
│     SAP & Scholarships         │
│  ▼ Exams/Results (group)       │
│     Current Semester Results   │
│     Earlier Semester Results   │
│  ▼ Finance (group)             │
│     Fees Dues                  │
│     Fees Paid                  │
│  ▼ Feedback (group) [A]        │
│  ▼ Academic Tracker (group)    │
│  ▼ Helpdesk (group)            │
│     FAQs                       │
├────────────────────────────────┤
│ COMPETITION PLATFORM           │
│  ▼ Discover (group)            │
│     Explore Events (B)         │
│     Notifications (B)          │
│  ▼ My Participation [A]        │
│  ▼ Organize & Manage [A]       │
├────────────────────────────────┤
│ LEARNING MANAGEMENT            │
│  ▼ Discover (group)            │
│     Browse Catalog (B)         │
│     Roadmaps (B)               │
│  ▼ Learning (group)            │
│     Learning Home (B)          │
│     Materials (B)              │
│     Guides (B)                 │
│     Question Bank (B)          │
│  ▼ My Workspace (group)        │
│  ▼ Community (group)           │
├────────────────────────────────┤
│ CAREER SERVICES                │
│  ● Career Home (B)             │
│  ▼ Opportunities (B)           │
│  ▼ My Activity (B)             │
│  ▼ Profile & Insights (B)      │
├────────────────────────────────┤
│ [Basic | Advanced] toggle      │
│ [Notifications] [Settings]     │
│ [Profile avatar]               │
│ [Enable Admin Mode]            │
└────────────────────────────────┘
```

(B) = visible in Basic mode  |  [A] = Advanced-only

---

## 2. Domain-by-Domain Navigation Audit

### 2A. Academic / ERP Core

**What's in the sidebar (ERP CORE section):**
- Dashboard (link, always visible)
- Academics group: Time Table, Attendance Details, Curriculum, SAP & Scholarships (all B)
- Exams/Results group: Current Results, Earlier Results (all B)
- Finance group: Fees Dues, Fees Paid (all B)
- Feedback group: 4 children but ALL access="A" (Advanced-only)
- Academic Tracker group: Progress Overview, Academic Insights, Unified Insights (all B)
- Helpdesk group: FAQs (B), Raise Ticket (A), Track & Escalate (A)

**GAPS — 11 ERP pages with NO sidebar nav link (URL-only or Command Palette only):**

| Route | Page | Discoverability |
|-------|------|----------------|
| `/finance/bank-details` | Bank Details | Command Palette only |
| `/transport-hostel/room-details` | Rooms Details | Command Palette only |
| `/transport-hostel/route-details` | Route Details (placeholder) | Command Palette only |
| `/transport-hostel/faqs` | Transport/Hostel FAQs | Command Palette only |
| `/transport-hostel/refund-change-requests` | Refund & Change | Command Palette only |
| `/registration/course-registration` | Course Registration | Command Palette only |
| `/registration/minor-oe-registration` | Minor/OE Registration | Command Palette only |
| `/registration/exam-registration` | Exam Registration | Command Palette only |
| `/registration/hostel-registration` | Hostel Registration | Command Palette only |
| `/registration/transport-registration` | Transport Registration | Command Palette only |
| `/registration/sap-registration` | SAP Registration | Command Palette only |

**NAV_HIDDEN_ROUTES** — 4 routes hidden from BOTH sidebar AND command palette:
- `/exams/essentials` (Exam Essentials)
- `/transport-hostel/outing-maintenance` (Outing & Maintenance)
- `/registration/registration-tracker` (Registration Tracker)
- `/registration/events-registration` (Events Registration)

**Dashboard links:** QuickLinks has 7 shortcuts: Timetable, Attendance, Internal Marks, Fee Details, LMS, Unified Insights, Feedback Assistant. No link to Bank Details, Room Details, Registration pages, SAP, Transport/Hostel sub-pages.

**Basic/Advanced toggle issue:** When user toggles to "Basic", the Feedback group shows ZERO children (all are access A). The group header remains but appears empty — confusing UX.

**Key problem:** 15 ERP routes exist as full pages but are undiscoverable without the Command Palette or URL typing.

---

### 2B. Events & Competitions

**What's in the sidebar (COMPETITION PLATFORM section):**
- Discover group: Explore Events (B), Notifications (B)
- My Participation group: My Activity [A], My Teams [A]
- Organize & Manage group: Create Event [A], My Created Events [A], Event Attendance [A]

**Routes requiring clicking through (not in sidebar):**
- `/events/:eventId` — click event card from listing
- `/events/:eventId/register` — click "Register" on event detail
- `/events/:eventId/submit/:roundId` — click "Submit" on round
- `/events/:eventId/my-results/:roundId` — click "Results" on round
- `/events/:eventId/leaderboard/:roundId` — click "Leaderboard" link
- `/events/:eventId/certificate/:roundId` — URL-only (no visible link)
- `/events/:eventId/manage` — click "Organizer Workspace" button
- `/events/:eventId/teams/create` — from registration flow
- `/events/:eventId/teams/:teamId` — from My Teams page
- All manage/* sub-routes — from organizer dashboard

**Dashboard links:** NONE. The Dashboard has no events widget, no events-related QuickLinks. Users must navigate directly to `/events` from the sidebar.

**Basic mode limitation:** 5 of 7 sidebar items are Advanced-only. In Basic mode, only "Explore Events" and "Notifications" are visible.

**GAP:** Certificate page has NO access path. `/events/attendance` has a sidebar link but only in Advanced mode.

---

### 2C. LMS (Learning Management)

**What's in the sidebar (LEARNING MANAGEMENT section):**
- Discover: Browse Catalog (B), Explore [A], Roadmaps (B)
- Learning: Learning Home (B), Materials (B), Guides (B), Question Bank (B)
- My Workspace: Bookmarks (B), Collections (B), Progress (B), Revision Queue (B)
- Community: Request Board (B), Contribute Resource [A], My Contributions [A], Feedback (B)

**Routes NOT in sidebar (no direct nav link):**

| Route | Page | How to reach |
|-------|------|-------------|
| `/resources/:id` | Resource Detail | Click resource card |
| `/resources/contributors/:userId` | Contributor Profile | Click contributor name |
| `/resources/subject/:code` | Subject Overview | Click subject tag |
| `/resources/subject/:code/pyq` | PYQ Bank | From subject page |
| `/resources/guides/new` | Guide Editor | "New Guide" button on guides list |
| `/resources/guides/:id` | Guide Reader | Click guide on list |
| `/resources/roadmaps/new` | Roadmap Builder | "New Roadmap" button |
| `/resources/roadmaps/:id` | Roadmap Viewer | Click roadmap on list |
| `/resources/quiz/:id` | Quiz Mode | From question bank or collection |
| `/resources/flashcards/:id` | Flashcard Mode | From collection or resource detail |
| `/resources/advanced-access` | Advanced Materials | From Materials page |

**Navigation depth issues:**
- Quizzes: 3 clicks deep (Sidebar → Question Bank → Start Quiz)
- Flashcards: No sidebar link at all. Must find via resource or collection.
- PYQ Bank: 3 clicks deep (Sidebar → Browse → Subject → PYQ tab)
- Guides: 2 clicks (Sidebar → Guides List → Click guide)
- Roadmaps: 2 clicks (Sidebar → Roadmaps List → Click roadmap)

**Academic Tracker disconnect:** Despite being LMS-domain (domain: "lms"), the Academic Tracker group appears under ERP CORE (Academics group) not under LEARNING MANAGEMENT. This creates a split mental model.

**Dashboard links:** Only 2 LMS entry points: "LMS" (→ /resources) and "Unified Insights" (→ /academic-tracker/unified-insights). No continue-learning, progress, or recent-resources widget on dashboard.

**Inconsistency:** `/resources/learning-materials` is wired via the generic blueprint system (erpRoutes) instead of lmsRoutes. It works but is architecturally inconsistent.

---

### 2D. Career Portal

**What's in the sidebar (CAREER SERVICES section):**
All items are access="B" (visible in both modes):
- Career Home (top link → /career)
- Opportunities group: Jobs, Internships, Hackathons, Competitions
- My Activity group: My Bookmarks, Application Tracker
- Profile & Insights group: Career Profile, Skill Gap Analysis

**Routes NOT in sidebar:**
- `/career/opportunities` (unfiltered) — reachable from homepage "View all"
- `/career/opportunities/:id` — click opportunity card
- `/career/submit` — reachable from homepage button only

**Dashboard links:** NONE. No career widget, no career QuickLink on the Dashboard.

**Student-facing gaps:**
- Interview Booking — admin-only (no student route exists)
- Alumni Connect — admin-only (no student route exists)
- Resume Profile page (ResumeProfile.tsx) — dead code, not wired to any route

**Command Palette:** All career pages are searchable via Ctrl+K.

---

### 2E. Helpdesk & Feedback

**What's in the sidebar (under ERP CORE section):**
- Helpdesk group: FAQs (B), Raise a Ticket [A], Track & Escalate [A]
- Feedback group: Course [A], Events [A], Hostel & Mess [A], Transport [A]

**Visibility issues:**
- 2 of 3 helpdesk links hidden in Basic mode
- ALL 4 feedback links hidden in Basic mode
- In Basic mode, the Feedback group appears as an empty accordion — confusing

**Dashboard access:**
- Only Course Feedback is linked (via QuickLinks "Feedback Assistant")
- No helpdesk links on Dashboard
- No Events/Hostel/Transport feedback links on Dashboard

**URL-only in Basic mode:** Raise a Ticket, Track & Escalate, Events Feedback, Hostel/Mess Feedback, Transport Feedback — all require URL typing or switching to Advanced mode.

---

### 2F. Admin

**How to enter admin mode:**
1. Auto-prompt: if user is potentialAdmin, a modal pops up asking for password
2. Sidebar button: "Enable Admin Mode" at bottom of sidebar (clickable)
3. After password entry: ADMINISTRATION section appears with 14 links

**ADMINISTRATION section (14 links, all visible when admin mode is active):**
Events Management, Event Approvals, Content Management, Campus Feedback, LMS Moderation, Certificate Templates, Department Performance, Helpdesk Tickets, Helpdesk FAQs, Career Opportunities, Career Interviews, Career Alumni, Audit Logs, System Controls

**Routes NOT in sidebar:**
- `/admin/events-management/:eventId` — reachable by clicking event row in management page

**No admin dashboard landing page.** First link in admin section is Events Management, which functions as the de facto admin hub.

**Command Palette:** Admin routes invisible until admin mode is unlocked. After unlock, all 15 routes become searchable.

---

## 3. Cross-Domain Discoverability Summary

### Features NOT accessible from Dashboard

| Feature | Dashboard presence |
|---------|-------------------|
| Events / Competitions | NONE |
| Career Portal | NONE |
| Helpdesk | NONE |
| Bank Details | NONE |
| Transport/Hostel pages | NONE |
| Registration pages | NONE |
| Events/Hostel/Transport Feedback | NONE |

### Features accessible ONLY via Command Palette or URL

| Feature | Route |
|---------|-------|
| Bank Details | /finance/bank-details |
| Rooms Details | /transport-hostel/room-details |
| Route Details | /transport-hostel/route-details |
| Transport/Hostel FAQs | /transport-hostel/faqs |
| Refund & Change | /transport-hostel/refund-change-requests |
| Course Registration | /registration/course-registration |
| Minor Registration | /registration/minor-oe-registration |
| Exam Registration | /registration/exam-registration |
| Hostel Registration | /registration/hostel-registration |
| Transport Registration | /registration/transport-registration |
| SAP Registration | /registration/sap-registration |
| Certificate claim | /events/:eventId/certificate/:roundId |
| Flashcards | /resources/flashcards/:id |

### Features hidden from BOTH sidebar and Command Palette

| Feature | Route |
|---------|-------|
| Exam Essentials (placeholder) | /exams/essentials |
| Outing & Maintenance (placeholder) | /transport-hostel/outing-maintenance |
| Registration Tracker (placeholder) | /registration/registration-tracker |
| Events Registration (placeholder) | /registration/events-registration |

### Advanced-mode gated features (hidden in Basic mode)

In Basic mode, the following nav items disappear:
- All 4 Feedback links (Course, Events, Hostel, Transport)
- 2 Helpdesk links (Raise a Ticket, Track & Escalate)
- Competition Platform: My Activity, My Teams, Create Event, My Created Events, Event Attendance
- LMS: Explore, Contribute Resource, My Contributions
- 14 Admin routes (separate gate: requires admin password + potentialAdmin status)

---

## 4. Dead / Orphaned Frontend Code

| Item | File | Issue |
|------|------|-------|
| ResumeProfile.tsx | pages/CareerPortal/ | No route, no imports, dead code |
| Calendar.tsx | pages/Dashboard/ | Exists but unused (WeekCalendar used) |
| EventsRegistrationHub.tsx | pages/Events/ | Not in route table |
| DataTable.tsx | components/ui/ | Possibly unused (shell version exists) |

---

## 5. Critical Orphaned Backend Endpoints

Backend endpoints with NO frontend counterpart or UI:

| Endpoint | Module | Frontend Usage |
|----------|--------|---------------|
| GET/POST /content/* | contentRoutes.js | Admin only (no student UI writes content) |
| GET /external/* | externalRoutes.js | Admin/debug only |
| POST /telemetry/frontend | telemetryRoutes.js | No-op in production |
| GET /debug/ping | debugRoutes.js | Debug mode only |
| Career: /career/alumni/* | careerRoutes.js | Admin-only UI (no student alumni page) |
| Career: /career/interviews/slots/* | careerRoutes.js | Admin-only UI (no student interview booking) |
| POST /competitions/reminders/run | competitionRoutes.js | No UI trigger (admin script) |
| PUT /events/:eventId/co-organizers | eventsRoutes.js | No dedicated UI form |

## 6. Recommended Fixes

### High Priority
1. Add sidebar nav links for 11 orphaned ERP pages (or add to Dashboard QuickLinks)
2. Add Events widget to Dashboard
3. Add Career Portal widget to Dashboard
4. Add Helpdesk link to Dashboard QuickLinks
5. Fix Feedback group: make Course Feedback at least Basic-visible (B)

### Medium Priority
6. Add Flashcards sidebar link under LMS
7. Create student-facing Interview Booking page
8. Create student-facing Alumni Connect page
9. Add PYQ Bank shortcut in sidebar
10. Wire ResumeProfile.tsx to a route or delete it

### Low Priority
11. Remove or wire unused Calendar.tsx
12. Hide empty accordion groups in Basic mode
13. Add Dashboard quick-links for Bank Details, Room Details, Registration
