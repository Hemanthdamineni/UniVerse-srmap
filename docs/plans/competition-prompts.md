# Competition Platform — Frontend Implementation Prompts
> Complete rebuild guide. Treat all existing competition/events frontend code as broken and replace it.
> Stack: React 19 · TypeScript 5.8 · TailwindCSS 4 · shadcn/ui · Lucide React · react-router-dom v7
> Design reference: `Stitch Designs/` folder at project root

---

## HOW TO USE THIS DOCUMENT

- Send one phase prompt at a time to the agent. Do not batch phases.
- After each phase: run `cd Frontend && npm run lint && npm run build`. Fix all errors before moving on.
- Each prompt is self-contained — it tells the agent exactly what to read, what to build, and what not to touch.
- Stitch design screens are located at `Stitch Designs/{folder}/` relative to project root. Each subfolder contains a PNG image. The agent should open and view these images as visual references before writing any UI code.
- The agent must read `Frontend/src/lib/session.ts` and `Frontend/src/config/erpBlueprints.ts` before touching any file in any phase.

---

## IDENTITY CONTRACT (encode this understanding in every phase)

The user identity throughout this entire platform is the **ERP registration number** (e.g., `AP21110010`).

```typescript
// How to get current user's reg no — use this pattern everywhere
import { readStoredProfileData } from '@/lib/session';
const profile = readStoredProfileData();
const currentRegNo = profile?.TableContent?.["Register No."] ?? null;
```

**Never** use a numeric userId, UUID, or any other identifier. Reg no is the only identity.
**Never** hardcode any role check on the frontend. All role/permission checks must go through the API.
Role responses always include the reg no so the UI can confirm identity.

---

## ROLE SYSTEM CONTRACT (encode this in every phase that touches roles)

Roles are **per-event, API-driven, and stored in the backend**. The role hierarchy per event is:

```
owner       → the reg no that created the event (immutable, always has full access)
co-organizer → assigned by owner, full access except cannot delete the event or change owner
manager     → assigned by owner/co-organizer, can manage registrations, messages, checkin
judge       → assigned by owner/co-organizer, can evaluate submissions and see all submissions
participant → registered for the event
visitor     → authenticated but not registered
```

Every page that needs role awareness must call:
```
GET /api/competitions/:eventId/my-role
→ { regNo: string, role: 'owner' | 'co-organizer' | 'manager' | 'judge' | 'participant' | 'visitor' }
```

This response is cached in `EventContext` and flows down via `useEvent()`. No component computes roles locally.

---

## DESIGN SYSTEM CONTRACT (apply in every phase)

```css
/* Primary identity */
--comp-accent: #0a272b;
--comp-accent-hover: #0d3438;
--comp-accent-light: #e6f0f1;

/* Surfaces */
--comp-surface: #ffffff;
--comp-surface-hover: #f4f7f7;
--comp-border: #e2e8ea;
--comp-border-strong: #cbd5d8;

/* Text */
--comp-text-primary: #0a272b;
--comp-text-secondary: #4a6b70;
--comp-text-muted: #8ba5a9;

/* Status */
--status-open-bg: #f0fdf4;       --status-open-text: #15803d;
--status-pending-bg: #fffbeb;    --status-pending-text: #92400e;
--status-closed-bg: #f1f5f9;     --status-closed-text: #475569;
--status-live-bg: #fff1f2;       --status-live-text: #be123c;
--status-selected-bg: #f0fdf4;   --status-selected-text: #166534;
--status-rejected-bg: #fff1f2;   --status-rejected-text: #9f1239;

/* Deadline urgency */
--deadline-safe: #15803d;
--deadline-warn: #b45309;
--deadline-urgent: #b91c1c;

/* Spacing tokens */
--space-xs: 4px;   --space-sm: 8px;
--space-md: 16px;  --space-lg: 24px;
--space-xl: 40px;  --space-2xl: 64px;

/* Focus */
--comp-focus-ring: 2px solid #0a272b;
--comp-focus-ring-offset: 2px;
```

**Shell vs Surface rule:** The diagonal clip-path teal geometry belongs only in the sidebar/shell. Every page content area must sit on clean `--comp-surface` (white) cards on a `--app-shell-bg` background. Never put form fields or content directly on the geometry background.

**Dark mode:** Every CSS variable must have a `[data-theme="dark"]` equivalent defined alongside it.

---

---

# PHASE 0 — Pre-work: Teardown + CSS Foundation
> Goal: Clean up existing broken code, establish CSS foundation. Zero UI changes visible yet.

## READ FIRST
1. `Frontend/src/styles.css` — full file
2. `Frontend/src/config/erpBlueprints.ts` — full file
3. `Frontend/src/lib/session.ts` — full file
4. `Frontend/src/pages/Events/` — list all files, read each one

## TASK

### 0.1 — Find and fix the `undefined` prefix bug

Search the entire `Frontend/src/` directory for any template literal or string concatenation involving `event.title`, `event.location`, `event.venue`, or `event.name`. Replace every occurrence with null-safe patterns:

```typescript
// Replace patterns like:
`${someVar}${event.title}`   →  event.title ?? 'Untitled Event'
someVar + event.location     →  event.location ?? event.venue ?? 'Venue TBA'
```

Also search `eventsApi.ts` or equivalent for any field being destructured from a nested object before it's confirmed to exist.

### 0.2 — Add CSS variables to `styles.css`

Add ALL variables from the DESIGN SYSTEM CONTRACT above to `Frontend/src/styles.css`. Add them inside `:root {}`. Then add dark mode overrides:

```css
[data-theme="dark"] {
  --comp-surface: #112428;
  --comp-surface-hover: #163038;
  --comp-border: #1e3a40;
  --comp-border-strong: #2a4a52;
  --comp-text-primary: #e8f4f5;
  --comp-text-secondary: #8ab8be;
  --comp-text-muted: #4a7a82;
  --comp-accent-light: #0d2d32;
}
```

Add these utility CSS classes to `styles.css`:

```css
.comp-heading-xl  { font-size: 1.75rem; font-weight: 700; line-height: 1.2; color: var(--comp-text-primary); }
.comp-heading-lg  { font-size: 1.25rem; font-weight: 600; color: var(--comp-text-primary); }
.comp-heading-md  { font-size: 1rem;    font-weight: 600; color: var(--comp-text-primary); }
.comp-body        { font-size: 0.9rem;  color: var(--comp-text-secondary); line-height: 1.6; }
.comp-label       { font-size: 0.75rem; font-weight: 500; color: var(--comp-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.comp-btn-primary {
  background: var(--comp-accent);
  color: #ffffff;
  padding: var(--space-sm) var(--space-md);
  border-radius: 6px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 150ms;
}
.comp-btn-primary:hover { background: var(--comp-accent-hover); }
.comp-btn-ghost {
  background: transparent;
  color: var(--comp-text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-radius: 6px;
  border: 1px solid var(--comp-border);
  cursor: pointer;
}
.comp-btn-ghost:hover { background: var(--comp-surface-hover); }

.status-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.skeleton-shimmer {
  background: linear-gradient(90deg, #f0f4f5 25%, #e2eaec 50%, #f0f4f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
[data-theme="dark"] .skeleton-shimmer {
  background: linear-gradient(90deg, #1a3038 25%, #1f3a42 50%, #1a3038 75%);
  background-size: 200% 100%;
}

.comp-surface *:focus-visible {
  outline: var(--comp-focus-ring);
  outline-offset: var(--comp-focus-ring-offset);
  border-radius: 4px;
}
```

### 0.3 — Create the analytics stub

Create `Frontend/src/lib/analytics.ts`:

```typescript
type TrackEvent =
  | 'submission_form_viewed' | 'submission_started' | 'submission_completed'
  | 'submission_failed' | 'evaluation_started' | 'evaluation_saved'
  | 'shortlist_applied' | 'results_published' | 'leaderboard_viewed'
  | 'create_event_started' | 'create_event_completed' | 'create_event_abandoned'
  | 'certificate_downloaded' | 'team_created' | 'team_invite_sent';

export function track(event: TrackEvent, properties?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, properties);
  }
}
```

### 0.4 — Create the event cache

Create `Frontend/src/lib/eventCache.ts`:

```typescript
interface CacheEntry<T> { data: T; fetchedAt: number; ttlMs: number; }

class EventCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) { this.store.delete(key); return null; }
    return entry.data;
  }
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, fetchedAt: Date.now(), ttlMs });
  }
  invalidate(key: string): void { this.store.delete(key); }
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const eventCache = new EventCache();
```

### 0.5 — Create `eventPhase.ts`

Create `Frontend/src/lib/eventPhase.ts`:

```typescript
export const EVENT_PHASE = {
  UPCOMING: 'UPCOMING',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  LIVE: 'LIVE',
  EVALUATION: 'EVALUATION',
  RESULTS: 'RESULTS',
  COMPLETED: 'COMPLETED',
} as const;
export type EventPhase = typeof EVENT_PHASE[keyof typeof EVENT_PHASE];

// Placeholder — will be fully implemented in Phase 1 once EventDetail type exists
export function getEventPhase(event: any): EventPhase {
  const now = new Date();
  if (event.status === 'archived' || event.status === 'completed') return EVENT_PHASE.COMPLETED;
  if (!event.competitionConfig) {
    if (event.status === 'ongoing') return EVENT_PHASE.LIVE;
    if (event.status === 'published' || event.status === 'public') return EVENT_PHASE.REGISTRATION_OPEN;
    return EVENT_PHASE.UPCOMING;
  }
  const rounds = event.competitionConfig?.rounds ?? [];
  const allPublished = rounds.length > 0 && rounds.every((r: any) => r.resultsPublished);
  const anyOpen = rounds.some((r: any) => !r.resultsPublished && new Date(r.submissionDeadline) > now);
  const anyPastDeadline = rounds.some((r: any) => new Date(r.submissionDeadline) <= now && !r.resultsPublished);
  if (allPublished) return EVENT_PHASE.RESULTS;
  if (anyOpen) return EVENT_PHASE.LIVE;
  if (anyPastDeadline) return EVENT_PHASE.EVALUATION;
  return EVENT_PHASE.REGISTRATION_OPEN;
}

export const PHASE_LABELS: Record<EventPhase, string> = {
  UPCOMING: 'Upcoming',
  REGISTRATION_OPEN: 'Registration Open',
  LIVE: 'Live',
  EVALUATION: 'Evaluation',
  RESULTS: 'Results Out',
  COMPLETED: 'Completed',
};
```

## DO NOT TOUCH
- Any existing ERP pages (attendance, timetable, marks, etc.)
- `Backend/` — zero backend changes in this phase
- Any existing page components outside `Events/`

## DONE WHEN
`npm run build` passes with zero TypeScript errors.

---

---

# PHASE 1 — API Layer + Type System
> Goal: Define all TypeScript types and API functions for the competition platform. No UI.

## READ FIRST
1. `Frontend/src/lib/erpApi.ts` — understand the existing API pattern (fetch, credentials: include, ApiError class)
2. `Frontend/src/lib/session.ts` — understand `readStoredProfileData()`
3. `Frontend/src/lib/eventCache.ts` — the cache created in Phase 0
4. `docs/07-API-REFERENCE.md` — events endpoints section
5. `COMPETITION-PLATFORM-PLAN.md` — Section 6 (backend API)

## TASK

Create `Frontend/src/lib/competitionsApi.ts` with the following content (expand each section fully — do not truncate):

### Types

```typescript
// ─── Identity ─────────────────────────────────────────────────────────────
export type RegNo = string; // e.g. "AP21110010"

export type EventRole =
  | 'owner'
  | 'co-organizer'
  | 'manager'
  | 'judge'
  | 'participant'
  | 'visitor';

export interface MyRoleResponse {
  regNo: RegNo;
  role: EventRole;
  permissions: {
    canEdit: boolean;
    canEvaluate: boolean;
    canShortlist: boolean;
    canManageRoles: boolean;
    canViewAllSubmissions: boolean;
  };
}

// ─── Competition Config ───────────────────────────────────────────────────
export interface EvaluationCriterion {
  label: string;
  maxScore: number;
}

export interface CompetitionRound {
  roundId: string;
  title: string;
  type: string;
  startTime: string | null;
  submissionDeadline: string;
  instructions: string;
  submissionTypes: ('file' | 'link')[];
  maxFileSizeMb: number;
  maxResubmissions: number;
  evaluationCriteria: EvaluationCriterion[];
  shortlistCount: number | null;
  shortlistThreshold: number | null;
  requiresShortlistFromRound: string | null;
  resultsPublished: boolean;
  shortlistAppliedAt: string | null;
  resultsPublishedAt: string | null;
}

export interface CompetitionConfig {
  isCompetition: true;
  submissionScope: 'individual' | 'team';
  rounds: CompetitionRound[];
}

// ─── Events ───────────────────────────────────────────────────────────────
export interface EventSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  status: string;
  visibility: string;
  startDate: string;
  endDate: string;
  location: string;
  department: string;
  maxCapacity: number | null;
  registrationCount: number;
  createdBy: RegNo;
  prizes: string | null;
  eligibility: string | null;
  isCompetition: boolean;
  competitionConfig: CompetitionConfig | null;
  posterImagePath: string | null;
}

export interface EventDetail extends EventSummary {
  rules: string | null;
  faq: { question: string; answer: string }[] | null;
  coOrganizers: RegNo[];
  myRegistration: { registeredAt: string; status: string } | null;
  myRole: MyRoleResponse | null;
}

// ─── Teams ────────────────────────────────────────────────────────────────
export interface TeamMember {
  regNo: RegNo;
  name: string;
  joinedAt: string;
  status: 'pending' | 'accepted';
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  leaderRegNo: RegNo;
  members: TeamMember[];
  createdAt: string;
}

// ─── Submissions ──────────────────────────────────────────────────────────
export interface Submission {
  id: string;
  eventId: string;
  roundId: string;
  submittedBy: RegNo;
  teamId: string | null;
  type: 'file' | 'link';
  filePath: string | null;
  linkUrl: string | null;
  description: string | null;
  submittedAt: string;
  resubmissionCount: number;
  criteriaScores: Record<string, number> | null;
  totalScore: number | null;
  remarks: string | null;
  evaluatedBy: RegNo | null;
  evaluatedAt: string | null;
  decision: 'selected' | 'rejected' | 'pending' | null;
  shortlisted: boolean;
  flagged: boolean;
  flagReason: string | null;
}

// ─── Certificates ─────────────────────────────────────────────────────────
export interface CertificateField {
  key: string;          // e.g. "participantName", "eventName", "rank", "date"
  label: string;
  x: number;            // percentage from left (0–100)
  y: number;            // percentage from top (0–100)
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface CertificateTemplate {
  id: string;
  eventId: string;
  roundId: string | null;
  templateImagePath: string;
  fields: CertificateField[];
  createdAt: string;
}

// ─── Roles ────────────────────────────────────────────────────────────────
export interface EventRoleAssignment {
  regNo: RegNo;
  name: string;
  role: Exclude<EventRole, 'participant' | 'visitor'>;
  assignedAt: string;
  assignedBy: RegNo;
}
```

### API Functions

Implement every function below. Use `fetch` with `credentials: 'include'`. On `401`, call `handleSessionAuthFailure()` from `session.ts`. On `403`, throw a typed `PermissionError`. After every successful mutation, call `eventCache.invalidate()` or `eventCache.invalidatePrefix()` for the relevant keys.

```typescript
// ─── Role ─────────────────────────────────────────────────────────────────
export async function getMyRole(eventId: string): Promise<MyRoleResponse>

// ─── Events ───────────────────────────────────────────────────────────────
export async function getEvents(params: {
  query?: string; category?: string; status?: string; type?: string;
  competitionOnly?: boolean; sort?: string; page?: number; limit?: number;
}): Promise<{ events: EventSummary[]; total: number; page: number }>

export async function getEvent(eventId: string): Promise<EventDetail>
export async function createEvent(data: Partial<EventDetail>): Promise<EventDetail>
export async function updateEvent(eventId: string, data: Partial<EventDetail>): Promise<EventDetail>
export async function deleteEvent(eventId: string): Promise<void>
export async function getMyCreatedEvents(): Promise<EventSummary[]>
export async function getMyRegisteredEvents(): Promise<EventSummary[]>
export async function registerForEvent(eventId: string): Promise<void>
export async function cancelRegistration(eventId: string): Promise<void>

// ─── Teams ────────────────────────────────────────────────────────────────
export async function createTeam(eventId: string, name: string): Promise<Team>
export async function getMyTeam(eventId: string): Promise<Team | null>
export async function inviteMember(eventId: string, teamId: string, regNo: RegNo): Promise<void>
export async function acceptInvite(eventId: string, teamId: string): Promise<void>
export async function getEventTeams(eventId: string): Promise<Team[]>

// ─── Submissions ──────────────────────────────────────────────────────────
export async function submitWork(eventId: string, roundId: string, formData: FormData): Promise<Submission>
export async function getMySubmission(eventId: string, roundId: string): Promise<Submission | null>
export async function getMyResult(eventId: string, roundId: string): Promise<Submission | null>
export async function getSubmissionsForRound(eventId: string, roundId: string): Promise<Submission[]>
export async function evaluateSubmission(
  eventId: string, roundId: string, submissionId: string,
  payload: { criteriaScores: Record<string, number>; totalScore: number; remarks: string; decision: string }
): Promise<Submission>
export async function flagSubmission(eventId: string, roundId: string, submissionId: string,
  payload: { flagged: boolean; flagReason?: string }): Promise<void>
export async function applyShortlist(eventId: string, roundId: string,
  payload: { mode: 'topN' | 'threshold'; value: number }): Promise<void>
export async function publishResults(eventId: string, roundId: string): Promise<void>
export async function getCompetitionConfig(eventId: string): Promise<CompetitionConfig | null>

// ─── Certificates ─────────────────────────────────────────────────────────
export async function getCertificateTemplate(eventId: string, roundId?: string): Promise<CertificateTemplate | null>
export async function saveCertificateTemplate(eventId: string, data: Partial<CertificateTemplate>): Promise<CertificateTemplate>
export async function uploadCertificateTemplateImage(eventId: string, file: File): Promise<{ path: string }>
export async function downloadMyCertificate(eventId: string, roundId: string): Promise<Blob>

// ─── Roles ────────────────────────────────────────────────────────────────
export async function getEventRoles(eventId: string): Promise<EventRoleAssignment[]>
export async function assignRole(eventId: string, regNo: RegNo, role: EventRoleAssignment['role']): Promise<EventRoleAssignment>
export async function removeRole(eventId: string, regNo: RegNo): Promise<void>
```

Also create `Frontend/src/lib/eventUserState.ts` implementing `getEventUserState()` exactly as specified in `COMPETITION-FRONTEND-PLAN.md` Section 3 (State Synchronization Layer), using `RegNo` as the identity type.

## DO NOT TOUCH
- Existing `erpApi.ts`
- Any component files
- Any page files

## DONE WHEN
`npm run build` passes. No `any` types except where explicitly noted with `// placeholder`.

---

---

# PHASE 2 — EventContext + Sidebar Restructure
> Goal: Shared context provider and corrected sidebar navigation. Still no new pages visible.

## READ FIRST
1. `Frontend/src/lib/competitionsApi.ts` — just created
2. `Frontend/src/lib/eventUserState.ts` — just created
3. `Frontend/src/lib/eventCache.ts` — Phase 0
4. `Frontend/src/lib/session.ts` — how to get `currentRegNo`
5. `Frontend/src/config/erpBlueprints.ts` — full file, understand MAIN_NAV structure
6. `Frontend/src/components/Sidebar.tsx` — full file

## TASK

### 2.1 — Create `EventContext.tsx`

Create `Frontend/src/contexts/EventContext.tsx`. Implement the full `EventProvider` + `useEvent()` as specified in `COMPETITION-FRONTEND-PLAN.md` Section 4 (Global Event Context Provider). Key requirements:

- Uses `readStoredProfileData()` to get `currentRegNo`
- Calls `getMyRole(eventId)` and merges result into `userState`
- Smart polling: 10s when LIVE, 15s when EVALUATION, 30s otherwise
- Polling pauses when `document.hidden`
- Cache integration: reads from `eventCache` before fetching, writes after
- `refetch(skipCache = true)` is exposed for retry buttons
- `GlobalLoadingBoundary` shown when `loading && !event`
- `FailureRecoveryBanner` shown when `error && !event`

Also create `Frontend/src/contexts/EventContext.tsx` exports: `EventProvider`, `useEvent`.

### 2.2 — Restructure Sidebar

Open `Frontend/src/config/erpBlueprints.ts`. Find the `MAIN_NAV` array. Replace the Competition Platform section entirely with:

```typescript
{
  label: "Competition Platform",
  icon: Trophy,  // from lucide-react
  domain: "campus",
  children: [
    {
      label: "Explore Events",
      route: "/events",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "My Activity",
      route: "/events/my-activity",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "My Teams",
      route: "/events/my-teams",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "My Created Events",
      route: "/events/my-created",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "Create Event",
      route: "/events/create",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "Notifications",
      route: "/events/notifications",
      domain: "campus",
      integrationState: "native",
      sourceMode: "internal",
    },
    {
      label: "Event Attendance",
      route: "/events/attendance",
      domain: "erp",
      integrationState: "adapter",
      sourceMode: "erp",
    },
  ],
}
```

### 2.3 — Register routes in `main.tsx`

Open `Frontend/src/main.tsx`. Add the following routes wrapped in `<PageLayout>`. Event-scoped routes (`/events/:eventId/*`) must be wrapped in `<EventProvider eventId={params.eventId}>` using `useParams()`:

```
/events                          → EventsListingPage (placeholder component for now)
/events/create                   → CreateEventPage (placeholder)
/events/my-activity              → MyActivityPage (placeholder)
/events/my-teams                 → MyTeamsPage (placeholder)
/events/my-created               → MyCreatedEventsPage (placeholder)
/events/notifications            → NotificationsPage (placeholder)

/events/:eventId                 → EventDetailPage (placeholder, wrapped in EventProvider)
/events/:eventId/register        → RegistrationFlowPage (placeholder, wrapped in EventProvider)
/events/:eventId/teams/create    → TeamFormationPage (placeholder, wrapped in EventProvider)
/events/:eventId/teams/:teamId   → TeamDetailPage (placeholder, wrapped in EventProvider)
/events/:eventId/submit/:roundId → SubmissionPage (placeholder, wrapped in EventProvider)
/events/:eventId/my-results/:roundId → MyResultsPage (placeholder, wrapped in EventProvider)
/events/:eventId/leaderboard/:roundId → LeaderboardPage (placeholder, wrapped in EventProvider)
/events/:eventId/certificate/:roundId → CertificateClaimPage (placeholder, wrapped in EventProvider)

/events/:eventId/manage          → OrganizerDashboard (placeholder, wrapped in EventProvider)
/events/:eventId/manage/roles    → RolesPage (placeholder, wrapped in EventProvider)
/events/:eventId/manage/certificate → CertificateTemplatePage (placeholder, wrapped in EventProvider)
/events/:eventId/manage/rounds/:roundId/submissions → SubmissionListPage (placeholder, wrapped in EventProvider)
/events/:eventId/manage/rounds/:roundId/submissions/:id/evaluate → EvaluationPage (placeholder, wrapped in EventProvider)
/events/:eventId/manage/rounds/:roundId/shortlist → ShortlistPage (placeholder, wrapped in EventProvider)
```

For placeholder components, create a simple component that renders:
```tsx
<div style={{ padding: 'var(--space-xl)' }}>
  <p className="comp-heading-lg">[PageName] — Coming Soon</p>
</div>
```

Put all placeholder components in `Frontend/src/pages/Events/placeholders.tsx`.

## DO NOT TOUCH
- Existing ERP page routes (academic, finance, exams, etc.)
- Any non-Events sidebar sections

## DONE WHEN
- Sidebar shows the correct 7 navigation items under Competition Platform
- All routes are registered and render their placeholder without crashing
- `npm run build` passes

---

---

# PHASE 3 — Shared Components Library
> Goal: Build all 15 shared components. No pages. These are used by every page that follows.

## READ FIRST
1. `Frontend/src/lib/competitionsApi.ts` — all types
2. `Frontend/src/lib/eventPhase.ts` — PHASE_LABELS, EVENT_PHASE
3. `Frontend/src/lib/eventUserState.ts` — RoundUserState
4. `Frontend/src/styles.css` — all CSS vars
5. **Stitch Design screens to open:**
   - `Stitch Designs/01_public_discovery/events_listing/events_listing_1/` — card treatment
   - `Stitch Designs/02_user_student/submissions/submit_project_page/` — FileUploadZone
   - `Stitch Designs/03_organizer/evaluation/submission_evaluation_final_refinements/` — criteria table
   - `Stitch Designs/05_shared_errors/` — all error screen designs

## TASK

Create `Frontend/src/components/competition/` directory. Build each component below in its own file.

### Components to build:

**`StatusBadge.tsx`** — pill badge for event/submission status. Props: `status`, `size`. Use CSS vars for colors. Include `role="status"` and `aria-label`. Reference the badge treatment visible in events_listing Stitch screens.

**`DeadlineCountdown.tsx`** — live countdown. Props: `deadline: string`, `showIcon?: boolean`, `compact?: boolean`. Uses `setInterval` with cleanup. Color transitions: ≥7d = `--deadline-safe`, 3–7d = `--deadline-warn`, <3d = `--deadline-urgent`, passed = muted. Wraps in `<time dateTime={deadline}>`.

**`RoundStatusCard.tsx`** — single round display card. Props: `round: CompetitionRound`, `roundState: RoundUserState`, `onSubmit?`, `onViewResult?`, `onViewSubmissions?`, `onEvaluate?`, `onShortlist?`. Left border 3px colored by state. Shows: round number pill, title, deadline, instructions (2-line truncate), criteria chips, CTA buttons. **Never compute role inside this component** — read everything from `roundState`. All 4 states (loading/empty/error/success) defined.

**`CompetitionEventCard.tsx`** — event listing card. Props: `event: EventSummary`, `onClick`. Competition events get 3px teal left border + teal "Competition" chip. Shows: category, status badge, title, description (2-line), department, venue, registrations count, round count, deadline countdown, prize line if set. Hover: `translateY(-2px)` + shadow. `role="article"`, keyboard focusable.

**`SubmissionStatusBanner.tsx`** — colored banner for participant submission state. All 7 states from the plan. Referenced in Stitch `submission_history_feedback`.

**`EvaluationCriteriaTable.tsx`** — criteria scoring table. Props: `criteria`, `scores?`, `onChange?`, `readOnly`. Edit mode: numeric inputs with `aria-label`, out-of-range validation. Live total row. Empty state when no criteria and readOnly: render nothing.

**`FileUploadZone.tsx`** — drag-and-drop file upload. All 7 states: idle, dragging, selected, uploading, uploaded, client-error, api-error. Detect touch devices for mobile copy. Progress bar during upload. Reference `Stitch Designs/02_user_student/submissions/submit_project_uploading_state/`.

**`OrganizerGuard.tsx`** — access control wrapper. Checks `event.myRole?.permissions.canEdit` (API-driven, trust first) then falls back to `event.createdBy === currentRegNo || event.coOrganizers.includes(currentRegNo)`. If archived: show archive message. If not competition: show feature message. If guard fails: teal info card + "← Back to Event" link. Never redirect silently.

**`SummaryStatBar.tsx`** — horizontal stat strip. Props: `stats: { label, value, color? }[]`. Empty state: "No submissions yet."

**`ErrorMessage.tsx`** — inline error. Props: `title?`, `message`, `onRetry?`, `preservedInput?`. Used for inline errors (not toasts). Toasts are only for success.

**`EmptyState.tsx`** — empty content placeholder. Props: `icon?`, `title`, `description?`, `action?`. Use for all empty list/table states.

**`NotificationToast.tsx`** — notification item + notification center trigger. Renders whatever `GET /api/events/notifications` returns. Empty state: "No notifications yet." Unread badge count in trigger.

**`SkeletonCard.tsx`** and **`SkeletonTable.tsx`** — shimmer loading placeholders using `.skeleton-shimmer` CSS class. SkeletonCard mimics CompetitionEventCard proportions. SkeletonTable accepts `rows` prop.

**`GlobalLoadingBoundary.tsx`** — full-page skeleton shown while EventProvider fetches. Mimics EventDetailPage hero + stats + tabs + content shape using skeleton-shimmer divs. `aria-busy="true"`.

**`FailureRecoveryBanner.tsx`** — full-page error when event fails to load. Props: `message?`, `onRetry`. Shows retry button + "← Back to Events" link. Referenced in `Stitch Designs/05_shared_errors/network_retry_state/`.

## DO NOT TOUCH
- Any page files
- Any existing ERP components

## DONE WHEN
- All 15 components exist and compile
- Each component handles loading/empty/error/success states
- `npm run build` passes

---

---

# PHASE 4 — Events Listing + Search Pages
> Goal: Build EventsListingPage. First real page visible to users.

## READ FIRST
1. `Frontend/src/components/competition/` — all shared components just built
2. `Frontend/src/lib/competitionsApi.ts` — `getEvents()`
3. **Stitch Design screens to open and study carefully:**
   - `Stitch Designs/01_public_discovery/events_listing/events_listing_1/`
   - `Stitch Designs/01_public_discovery/events_listing/events_listing_2/`
   - `Stitch Designs/01_public_discovery/events_listing/events_listing_empty_state/`
   - `Stitch Designs/01_public_discovery/events_listing/events_listing_loading_state/`
   - `Stitch Designs/01_public_discovery/featured_trending/featured_trending_events/`
   - `Stitch Designs/01_public_discovery/search_discovery/search_discovery_hub/`
   - `Stitch Designs/01_public_discovery/search_discovery/search_discovery_hub_active_filters_state/`

## TASK

Replace the placeholder `EventsListingPage` with a full implementation.

### Layout

```
Page header:
  "Events"                              [+ Create Event button]
  [N total] [N upcoming] [N live] [N competitions]

Filter bar:
  [Search input] [Category ▾] [Status ▾] [Type ▾] [☐ Competitions only] [Sort ▾]

Events grid (2-col desktop, 1-col mobile):
  <CompetitionEventCard /> × N
  [Load More / Pagination]
```

### Requirements

- All filter state goes into URL search params via `useSearchParams()` — shareable, browser-back navigable
- Fetch `getEvents(params)` on mount and when filters change (debounce search input 300ms)
- **Loading state:** `<SkeletonCard />` × 4 in a 2-col grid. No spinner.
- **Empty state (no results + filters active):** `<EmptyState title="No events found" action={{ label: "Clear filters", onClick: clearFilters }}/>`
- **Empty state (no filters, no events):** `<EmptyState title="No events yet" description="Be the first to create one" action={{ label: "Create Event", onClick: ... }}/>`
- Competition event cards get teal left border treatment — implemented via `CompetitionEventCard` prop
- "+ Create Event" button top-right navigates to `/events/create`
- **Mobile:** Single column. Filter bar collapses to "⚙ Filters" button opening a bottom drawer (use shadcn Sheet). Sheet contains all filter controls + "Apply" + "Reset" buttons.
- Summary strip (total/upcoming/live/competitions) computed from API response totals, not counted client-side

### Design fidelity
Match the Stitch screen layout exactly: card structure, filter chip placement, header with summary counts, spacing between elements. Use `--comp-surface`, `--comp-border`, `--space-*` tokens throughout. Cards use white backgrounds on `--app-shell-bg` gray.

## DO NOT TOUCH
- Other page files
- Shared components (only consume them)

## DONE WHEN
- Events listing renders with real data
- Filtering works and updates URL
- All empty/loading/error states render correctly
- Mobile layout tested at 375px width

---

---

# PHASE 5 — Event Detail Page
> Goal: Full EventDetailPage with all tabs, sticky action bar, and role-aware CTAs.

## READ FIRST
1. `Frontend/src/contexts/EventContext.tsx` — `useEvent()`, `userState`
2. `Frontend/src/lib/eventUserState.ts` — RoundUserState, role meanings
3. **Stitch Design screens to open and study:**
   - `Stitch Designs/01_public_discovery/event_details/event_details_golden_version/` ← PRIMARY
   - `Stitch Designs/01_public_discovery/event_details/event_details_faq_expanded_state/`
   - `Stitch Designs/01_public_discovery/event_details/event_details_timeline_expanded/`
   - `Stitch Designs/01_public_discovery/event_details/event_details_registration_focused_state/`

## TASK

Replace the placeholder `EventDetailPage` with a full implementation. This page uses `useEvent()` — it makes **zero direct API calls**.

### Layout structure (match Stitch `event_details_golden_version` exactly):

```
Breadcrumb: ← Back to Events

Hero section:
  [StatusBadge phase]  [Category chip]
  Event Title                                     [Manage → button if canEdit]
  Short description (max 3 lines, expandable)
  Stats row: [Start date] [End date] [Venue] [Registrations/Capacity]

Sticky action bar (appears when hero scrolls out of view):
  [Register / Cancel Registration]
  [Submit Work → Round N] (if canSubmit for current round)
  [View My Results] (if any round has resultsPublished)
  [Add to Calendar]

Tab bar:
  [Overview] [Rounds] [Timeline] [FAQ] [Leaderboard]
  (Rounds tab: only if isCompetition)
  (FAQ tab: only if event.faq has items)
  (Leaderboard tab: only if any round has resultsPublished)

Tab: Overview
  Full description
  Prizes section (if event.prizes)
  Eligibility section (if event.eligibility)
  Rules section (if event.rules)
  [hidden if null — never show "Not specified"]

Tab: Rounds (competition only)
  <SubmissionStatusBanner> for current active round (participant only)
  <RoundStatusCard> for each round
    each card receives roundState from userState.roundStates[i]

Tab: Timeline
  Vertical timeline dots:
  ● Event Start       [formatted date]
  ● Round 1 Deadline  [formatted date]  [DeadlineCountdown compact]
  ● Round 2 Deadline  [formatted date]
  ● Event End         [formatted date]
  Past = muted gray, current/next = teal, future = light gray

Tab: FAQ
  shadcn Accordion, one item per faq entry

Tab: Leaderboard
  Link to /events/:eventId/leaderboard/:roundId for most recent published round
```

### Role-aware behavior
- `userState.role === 'visitor'` → Register button prominent, no submission CTAs
- `userState.role === 'participant'` → Cancel registration option, submission CTAs per round
- `userState.role` is owner/co-organizer/manager/judge → "Manage →" button links to `/events/:eventId/manage`
- **None of this is computed locally** — read entirely from `userState` which comes from `useEvent()`

### Sticky action bar
Use `IntersectionObserver` on the hero section. When hero exits viewport, action bar becomes `position: sticky; top: 0; z-index: 10; background: var(--comp-surface); border-bottom: 1px solid var(--comp-border)`.

### Mobile
Hero stats become horizontal scroll strip. Sticky action bar: single primary CTA full-width + "⋯" overflow menu for secondary actions.

## DONE WHEN
- EventDetailPage renders for all role types (visitor, participant, organizer)
- All tabs switch without error
- Sticky action bar appears/disappears on scroll
- Mobile layout correct at 375px

---

---

# PHASE 6 — Registration + Team Flow
> Goal: Multi-step registration, team creation, team management.

## READ FIRST
1. `useEvent()` — for event context
2. `Frontend/src/lib/competitionsApi.ts` — team/registration functions
3. **Stitch Design screens to open:**
   - `Stitch Designs/02_user_student/registration_flow/event_registration_multi_step_flow_1/`
   - `Stitch Designs/02_user_student/registration_flow/event_registration_multi_step_flow_2/`
   - `Stitch Designs/02_user_student/registration_flow/event_registration_multi_step_flow_3/`
   - `Stitch Designs/02_user_student/registration_flow/event_registration_multi_step_flow_4/`
   - `Stitch Designs/02_user_student/registration_flow/registration_review_confirm_step/`
   - `Stitch Designs/02_user_student/registration_flow/registration_team_setup/`
   - `Stitch Designs/02_user_student/registration_flow/registration_closed_state/`
   - `Stitch Designs/02_user_student/registration_flow/waitlist_page/`
   - `Stitch Designs/02_user_student/team_flow/team_formation_invites/`
   - `Stitch Designs/02_user_student/team_flow/my_teams_page/`
   - `Stitch Designs/03_organizer/team_management/team_management/`

## TASK

### `RegistrationFlowPage.tsx` (`/events/:eventId/register`)

Multi-step form:
- **Step 1:** Registration details — shows event summary, confirms the user's reg no (read-only, from session — user cannot change it), reads terms/eligibility
- **Step 2 (if isCompetition + submissionScope === 'team'):** Team setup — create new team OR join existing team by invite code. Leader invites others by reg no.
- **Step 3:** Review & Confirm — summary of registration details + team if applicable
- Success state: confirmation card showing reg no, event name, team name if applicable. No QR code.

Error states: `registration_closed_state` (show when event status prevents registration), `waitlist_page` (show when maxCapacity reached).

The user's reg no is always pre-filled and read-only. They cannot register with a different identity.

### `TeamFormationPage.tsx` (`/events/:eventId/teams/create`)

- Team name input
- After creation: show team code + invite-by-reg-no form
- Each invited reg no shows as a pending member chip
- Reference `team_formation_invites` Stitch screen

### `TeamDetailPage.tsx` (`/events/:eventId/teams/:teamId`)

- Team members list with status (accepted/pending)
- Leader can remove pending invites
- Leader can transfer leadership (by reg no)
- Reference `my_teams_page` Stitch screen

### `MyTeamsPage.tsx` (`/events/my-teams`)

- List of all teams the current user is in (across all events)
- Each team card: event name, team name, member count, the user's role (leader/member)
- Link to team detail page

## DONE WHEN
- Registration completes without QR or external dependencies
- Team invite sends to reg no
- All error/empty states render
- `npm run build` passes

---

---

# PHASE 7 — Submission Flow (Participant)
> Goal: SubmissionPage, MyActivityPage, MyCreatedEventsPage.

## READ FIRST
1. `useEvent()`, `userState` — for round state and canSubmit flags
2. `Frontend/src/lib/competitionsApi.ts` — `submitWork()`, `getMySubmission()`
3. `Frontend/src/lib/analytics.ts` — call `track()` at submission milestones
4. **Stitch Design screens to open:**
   - `Stitch Designs/02_user_student/submissions/submit_project_page/` ← PRIMARY
   - `Stitch Designs/02_user_student/submissions/submit_project_uploading_state/`
   - `Stitch Designs/02_user_student/submissions/submit_project_success_state/`
   - `Stitch Designs/02_user_student/submissions/submit_project_validation_error_state/`
   - `Stitch Designs/02_user_student/submissions/submission_finalize_confirmation_modal/`
   - `Stitch Designs/02_user_student/submission_history/submission_history_feedback/`
   - `Stitch Designs/02_user_student/submission_history/submission_deadline_passed/`
   - `Stitch Designs/02_user_student/my_events_hub/my_events_hub_1/`

## TASK

### `SubmissionPage.tsx` (`/events/:eventId/submit/:roundId`)

Uses `useEvent()`. **Never computes submission state locally** — reads `userState.roundStates.find(r => r.roundId === roundId)`.

5 state machine states (all driven by `roundState`):
1. `role === 'visitor'` → "Register first" lock card
2. `roundState.isBlocked` → "🔒 [blockReason]" lock card with link to register
3. `submissionState === 'locked'` and no prior submission → "Deadline passed" lock card (reference `submission_deadline_passed` screen)
4. `submissionState === 'none'` → full form, "Submit Work" button
5. `submissionState === 'submitted'` → form pre-populated, "Resubmit (N of maxResubmissions remaining)"

2-col desktop layout (60/40):
- Left: Round instructions, `EvaluationCriteriaTable` (readOnly), `SubmissionStatusBanner`, form (file/link toggle, FileUploadZone, description textarea)
- Right: Large `DeadlineCountdown`, submission rules, previous submission if any

Upload flow: file selected → no upload yet → Submit clicked → multipart POST → during upload: button disabled, FileUploadZone isUploading=true → success: same page, banner updates → error: `<ErrorMessage>` inline, file preserved.

Track analytics: `track('submission_form_viewed', { roundId })` on mount, `track('submission_started')` on file select, `track('submission_completed')` on success, `track('submission_failed')` on error.

Mobile: right sidebar collapses into "Submission Rules" accordion above the form.

### `MyActivityPage.tsx` (`/events/my-activity`)

Three tabs via `?tab=registered|submissions|results` URL param.

**Tab 1 – Registered Events:** Cards of registered events with per-round submission status pills from `userState.roundStates`. Loading: `<SkeletonCard />` × 3. Empty: "No registered events yet" + "Explore Events" button. Reference `my_events_hub_1` Stitch screen.

**Tab 2 – My Submissions:** Table of all submissions across events. Loading: `<SkeletonTable rows={5}/>`. Empty: "No submissions yet." Reference `submission_history_feedback` Stitch screen.

**Tab 3 – My Results:** Cards per event/round where results are published. Empty: "No results published yet."

### `MyCreatedEventsPage.tsx` (`/events/my-created`)

Table view. Active competition count indicator: "You have N of 3 active competitions."

If N >= 3: red warning banner. "+ Create Event" button still navigates but CreateEventPage shows the limit warning at Step 3.

Columns: Title | Type | Status | Registrations | Created At | Actions (Edit / Manage / Archive).
Pagination: 20 rows per page.
Loading: `<SkeletonTable rows={5}/>`.
Empty: `<EmptyState title="No events created yet" action={{ label: "Create your first event" }}>`.

## DONE WHEN
- SubmissionPage state machine works for all 5 states
- File upload completes end-to-end
- MyActivityPage tabs load real data
- `npm run build` passes

---

---

# PHASE 8 — Results + Leaderboard + Certificates
> Goal: MyResultsPage, LeaderboardPage, CertificateClaimPage (participant side).

## READ FIRST
1. `useEvent()`
2. `Frontend/src/lib/competitionsApi.ts` — `getMyResult()`, `downloadMyCertificate()`
3. **Stitch Design screens to open:**
   - `Stitch Designs/02_user_student/score_breakdown/personal_score_breakdown/`
   - `Stitch Designs/02_user_student/score_breakdown/score_breakdown_no_remarks_state/`
   - `Stitch Designs/02_user_student/leaderboard/submission_leaderboard/`
   - `Stitch Designs/02_user_student/leaderboard/rank_leaderboard/`
   - `Stitch Designs/02_user_student/leaderboard/global_leaderboard_empty_state/`
   - `Stitch Designs/02_user_student/certificate_claim/certificate_claim_page/`
   - `Stitch Designs/02_user_student/certificate_claim/certificate_claim_preview/`
   - `Stitch Designs/02_user_student/certificate_claim/certificate_claim_processing_state/`

## TASK

### `MyResultsPage.tsx` (`/events/:eventId/my-results/:roundId`)

**Before results published:**
```
🔒 Results Not Yet Published
The organizer hasn't published results yet.
You'll be notified when they do.
Your submission: [filename] • submitted [date]
```

**After published — Shortlisted:**
Animate score bars from 0 → percentage over 600ms using CSS transition on mount.
```
🏆 You've Been Shortlisted!
[Event Name] — [Round Title]

Criteria        Score  Max   Bar
Innovation        8     10   [████████░░]
Implementation    7     10   [███████░░░]
Presentation      9     10   [█████████░]
────────────────────────────
Total            24     30

Rank: #3
Decision: ✓ Selected
Remarks: [organizer remarks text]
```

**After published — Not Selected:** Same layout, no trophy banner, "— Not Selected" decision.

**Not Evaluated:** "Your submission was received but was not evaluated before results were published."

Match `personal_score_breakdown` Stitch screen precisely for the score bar layout and typography.

### `LeaderboardPage.tsx` (`/events/:eventId/leaderboard/:roundId`)

Only navigable after `resultsPublished = true`. Gate the route — if not published, redirect to EventDetailPage with a toast.

```
[Round Title] Leaderboard         [Event Name]
Results published N hours ago

Your Result (participant only):
  Your rank: #12  Score: 22/30  Decision: Not Selected

Rankings table:
  Rank | Reg No.       | Score | Decision
   1   | AP21110010    | 28/30 | ✓ Shortlisted
   2   | AP21110025    | 26/30 | ✓ Shortlisted
  12   | AP21110088 *  | 22/30 | — Not Selected  ← You (asterisk = current user)

[Anonymize others] toggle (replaces other reg nos with AP*****)
```

Organizer view: full reg nos + link to evaluate any submission from the table row.
Loading: `<SkeletonTable rows={10}/>`.
Reference `rank_leaderboard` and `submission_leaderboard` Stitch screens.

### `CertificateClaimPage.tsx` (`/events/:eventId/certificate/:roundId`)

```
Your Certificate is Ready
[Event Name] — [Round Title]

[Certificate preview — renders the template image with user's data overlaid]

[Download Certificate] button → calls downloadMyCertificate() → triggers file download
```

States:
- **Loading:** skeleton preview area
- **Preview:** certificate image rendered with user's dynamic fields composited (can be a CSS overlay on top of the template image if the backend provides field positions and values)
- **Processing:** spinner, "Generating your certificate..."
- **Error:** `<ErrorMessage>` with retry

Reference `certificate_claim_page`, `certificate_claim_preview`, `certificate_claim_processing_state` Stitch screens.

Track: `track('certificate_downloaded')` on success.

## DONE WHEN
- All three pages render correctly for all states
- Score bars animate on mount
- Certificate download triggers file save
- `npm run build` passes

---

---

# PHASE 9 — Create Event Wizard
> Goal: Full multi-step event creation form with Quick Mode and Full Setup.

## READ FIRST
1. `Frontend/src/lib/competitionsApi.ts` — `createEvent()`, `getMyCreatedEvents()` (for active count check)
2. `Frontend/src/lib/analytics.ts` — track create milestones
3. **Stitch Design screens to open and study thoroughly:**
   - `Stitch Designs/03_organizer/create_event_wizard/create_event_wizard_1/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_1_core_details/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_1_validation_error_state/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_1_saving_draft_state/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_2_event_timeline/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_2_date_picker_open/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_3_rounds_scoring/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_3_multi_round_configuration/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_3_submission_types_open/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_5_final_review/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_5_publishing_state/`
   - `Stitch Designs/03_organizer/create_event_wizard/wizard_step_5_success_modal/`
   - `Stitch Designs/03_organizer/create_event_wizard/draft_autosave_state/`

## TASK

Replace the placeholder `CreateEventPage` with a full implementation.

### Mode selector (before Step 1)

```
How do you want to set up your event?

○ Quick Mode
  Single round · Basic fields only · 2 minutes

○ Full Setup
  Multi-round · Prizes · FAQ · Full competition config
```

**Quick Mode:** Single-page form. Fields: Title, Description, Category, Type, Start/End datetime, Venue. On submit: `createEvent({ ...fields, isCompetition: false })`. Navigate to `/events/:id/manage` on success.

**Full Setup:** 4-step wizard (Steps 1, 2, 3, 5 from Stitch — Step 4 expert panels is future scope, skipped).

### Step indicator
```
① Basic Info  →  ② Timing & Location  →  ③ Competition Setup  →  ④ Preview & Publish
```
Not directly clickable. Next/Back buttons only.

### Step 1 — Basic Info
Title (required, maxLength=100, character counter), Description (required, maxLength=2000), Department (select), Category (Technical/General/Cultural/Sports/Other), Type (Hackathon/Case Study/Quiz/Workshop/Paper Presentation/Seminar/Other).

Auto-save draft every 30s. Show `draft_autosave_state` indicator when saving.

### Step 2 — Timing & Location
Start/End datetime (inline validation: end > start), Location/Venue, Max Capacity (optional), Prizes (textarea, optional), Eligibility (textarea, optional).

### Step 3 — Competition Setup
Toggle: "Configure as Competition."

**Active limit check on page load:** call `getMyCreatedEvents()`, count active (non-archived) competitions. If >= 3, disable the competition toggle and show:
> ⚠ You have 3 active competitions (limit: 3). Archive one before creating another competition.

**If toggle OFF:** Rules textarea + FAQ builder (add Q&A pairs). Go to Step 4.

**If toggle ON:** Round builder. Progressive complexity hint shown first:
> 💡 Start simple — you can always add more rounds later.
> [Start with Round 1 only ↓]

Clicking the hint pre-populates one round with defaults (deadline = event end time, maxResubmissions = 5, one criterion "Overall" / 30 pts). Each round block: title, submission deadline, instructions, submission types (file/link toggles), maxResubmissions, evaluation criteria (label + maxScore, add/remove rows).

Add Round button adds another block. Each round is keyboard accessible.

Reference `wizard_step_3_rounds_scoring` and `wizard_step_3_multi_round_configuration` Stitch screens precisely.

### Step 4 — Preview & Publish
Read-only preview matching `EventDetailPage` layout (mini version). Visibility toggle: "Creator Only (Draft)" vs "Public." Edit shortcuts jump back to each step.

On publish: show `wizard_step_5_publishing_state` spinner, then `wizard_step_5_success_modal` with link to manage page.

### Error handling
- 429 "3 active competitions" → inline error at top of Step 3
- Network failure on submit → `<ErrorMessage onRetry>` — input preserved
- Validation errors per field → inline below each input (reference `wizard_step_1_validation_error_state`)

### Analytics
`track('create_event_started')` on mode select, `track('create_event_quick_mode')` or `track('create_event_full_mode')`, `track('create_event_completed')` on success, `track('create_event_abandoned', { lastStep })` on route leave before Step 4 (use react-router `useBlocker`).

## DONE WHEN
- Quick Mode creates an event end-to-end
- Full Setup wizard navigates all 4 steps
- Round builder adds/removes rounds and criteria
- Active limit check works
- `npm run build` passes

---

---

# PHASE 10 — Organizer Dashboard + Submission List
> Goal: OrganizerDashboard, SubmissionListPage.

## READ FIRST
1. `useEvent()` — `userState.canEdit`, `userState.canEvaluate`, `userState.canShortlist`
2. `Frontend/src/components/competition/OrganizerGuard.tsx`
3. `Frontend/src/lib/competitionsApi.ts` — `getSubmissionsForRound()`
4. **Stitch Design screens to open:**
   - `Stitch Designs/03_organizer/organizer_dashboard/organizer_dashboard_1/` ← PRIMARY
   - `Stitch Designs/03_organizer/organizer_dashboard/organizer_dashboard_2/`
   - `Stitch Designs/03_organizer/registrations_management/registrations_management_table_1/`
   - `Stitch Designs/03_organizer/submission_review/submission_review_queue/`
   - `Stitch Designs/03_organizer/submission_review/assigned_review_queue/`
   - `Stitch Designs/03_organizer/results_publishing/results_publishing_panel/`

## TASK

### `OrganizerDashboard.tsx` (`/events/:eventId/manage`)

Wrap entire component in `<OrganizerGuard>`. Use `useEvent()` — zero direct event API calls.

```
Breadcrumb: ← [Event Name]                     [View Public Page →]
Organizer Dashboard

Stats row (4 cards):
  Registrations: N | Submissions this round: N/M | Evaluated: N/M | Results: Published/Pending

Rounds section:
  <RoundStatusCard> for each round (organizer mode — shows evaluate/shortlist CTAs)
  Each card links to its submission list

Participant table:
  [Search by reg no] [Export CSV]
  Reg No. | Name | Registered At | R1 Status | R2 Status | ...
  Pagination: 20 rows

Actions section:
  [📢 Broadcast Announcement] [✎ Edit Event] [🗄 Archive Event] [👥 Manage Roles →]

  AuditHistoryPanel:
    Shows per-round: "Shortlist applied at..." / "Results published at..."
```

Empty states:
- No registrations: "No registrations yet." in participant table
- No submissions for a round: shown in RoundStatusCard "No submissions received yet."
- No rounds: "This event has no rounds configured." + link to edit

Mobile: Stats row = 2×2 grid. Participant table = card view per registrant. Export CSV = floating action button.

**The dashboard reads role from `userState` — no local role computation anywhere.**

### `SubmissionListPage.tsx` (`/events/:eventId/manage/rounds/:roundId/submissions`)

Wrap in `<OrganizerGuard>`.

```
<SummaryStatBar stats={[total, evaluated, pending, flagged]} />

Warning (if pending > 0 and shortlist not applied):
⚠ N submissions haven't been evaluated. They won't be included in shortlisting.

Filter tabs: [All] [Pending] [Evaluated] [Flagged]
Sort: [Date ▾] [Score ▾]

Table:
  Reg No. | Submitted At | Resubs | Type | Status | Score | Actions
  [View] [Evaluate →]

[Go to Shortlist →] button (only if canShortlist)
```

Row tinting: flagged rows = `#fff5f5`, evaluated rows = `#f0fdf4`.
Loading: `<SkeletonTable rows={8}/>`.
Empty: `<EmptyState title="No submissions yet" description="Submissions will appear here once participants start submitting."/>`.

Performance: if row count > 100, add virtualization via `@tanstack/react-virtual`.
Mobile: table collapses to card list per submission.

Reference `submission_review_queue` and `assigned_review_queue` Stitch screens for the table layout, badge treatments, and action button placement.

## DONE WHEN
- OrganizerGuard blocks non-organizers correctly (checks API-driven permissions, not local reg no comparison)
- Dashboard shows correct stats for all role types
- Submission list filters work
- `npm run build` passes

---

---

# PHASE 11 — Evaluation + Shortlist + Publish
> Goal: EvaluationPage, ShortlistPage. The core judging workflow.

## READ FIRST
1. `useEvent()`, `userState.canEvaluate`, `userState.canShortlist`
2. `Frontend/src/lib/competitionsApi.ts` — `evaluateSubmission()`, `applyShortlist()`, `publishResults()`
3. **Stitch Design screens to open (study all of them for this phase):**
   - `Stitch Designs/03_organizer/evaluation/submission_evaluation_final_refinements/` ← PRIMARY
   - `Stitch Designs/03_organizer/evaluation/submission_evaluation_updated_1/`
   - `Stitch Designs/03_organizer/evaluation/submission_evaluation_updated_2/`
   - `Stitch Designs/03_organizer/evaluation/judge_private_notes/`
   - `Stitch Designs/03_organizer/evaluation/review_history/`
   - `Stitch Designs/03_organizer/evaluation/compare_finalists/`
   - `Stitch Designs/03_organizer/evaluation/judge_dashboard/`
   - `Stitch Designs/03_organizer/evaluation/scoring_rubric_workspace/`
   - `Stitch Designs/03_organizer/results_publishing/results_publishing_page/`
   - `Stitch Designs/03_organizer/results_publishing/results_publishing_panel/`

## TASK

### `EvaluationPage.tsx` (`/events/:eventId/manage/rounds/:roundId/submissions/:id/evaluate`)

Wrap in `<OrganizerGuard>`.

```
Navigation bar:
  ← Submission List    [← Prev]  3 of 42  [Next →]

Split panel (60/40 desktop, stacked mobile):
LEFT:
  Submission by: [reg no]
  Submitted: [date]   Resubmissions: N
  [PDF embed for PDFs | Link card for links | Download card for other types]
  Description: [text]

RIGHT:
  Scoring
  <EvaluationCriteriaTable onChange={...} scores={currentScores}/>

  Remarks: <textarea>

  Decision:
  ○ Selected  ○ Rejected  ○ Undecided

  ☐ Flag this submission
  [Flag reason input — appears if flag checked]

  [Save Evaluation] (disabled until all criteria scored)
  <ErrorMessage> if save failed (scores preserved in state)

  [AuditHistoryPanel]
  evaluatedBy + evaluatedAt for this submission

  [Judge Private Notes — private, never shared]
  <textarea> saved locally and to server separately
```

**Conflict of interest:** If `submission.submittedBy === currentRegNo`, disable entire right panel + show: "🚫 You cannot evaluate your own submission."

**Optimistic save:** Apply evaluation state immediately, rollback on error. Scores stay in component state on error.

**Unsaved changes guard:** If user clicks Prev/Next with unsaved scores: show modal "Save and Continue | Discard and Continue | Stay."

**Prev/Next navigation:** Receives `{ submissionIds: string[], currentIndex: number }` from router navigation state (set by SubmissionListPage when navigating here).

Mobile: stacked vertically — submission viewer on top, scoring form below. Prev/Next = sticky bottom bar.

Reference `submission_evaluation_final_refinements` Stitch screen precisely for the split-panel layout, score input styling, and decision radio buttons.

### `ShortlistPage.tsx` (`/events/:eventId/manage/rounds/:roundId/shortlist`)

Wrap in `<OrganizerGuard>`.

```
Info banner:
  Showing N evaluated submissions.
  ⚠ M unevaluated submissions are excluded and will remain as "Pending."

Mode selector:
  ○ Top N:          [input] submissions
  ○ Score Threshold: minimum [input] points
  Preview: "N submissions will be shortlisted"

Ranked table (client-only preview — no API call on input change):
  Rank | Reg No.    | Score | Submitted At | Would be: [Selected / Not Selected highlight]

Actions:
  [Apply Shortlist] → confirmation modal → POST
  After applied:
  [✓ Shortlist Applied — Apply again with different settings]
  [Publish Results →] → confirmation modal → POST
  After published:
  30-second countdown banner:
  "✓ Results published. Participants have been notified.
   If published in error, contact support immediately."
```

**Live preview is client-only.** No API call on every Top N input change.

**Error on apply failure:** Modal closes, `<ErrorMessage>` inline below actions, ranked list unchanged.

Reference `results_publishing_page` and `results_publishing_panel` Stitch screens for the ranked table and publish button placement.

## DONE WHEN
- Evaluation saves correctly via API
- Conflict-of-interest check works (compares `submission.submittedBy` to `currentRegNo` from session)
- Unsaved-changes modal fires on Prev/Next
- Shortlist live preview updates without API calls
- Publish flow shows confirmation + countdown banner
- `npm run build` passes

---

---

# PHASE 12 — Roles & Permissions + Notifications
> Goal: RolesPage (organizer assigns roles by reg no), NotificationsPage.

## READ FIRST
1. `Frontend/src/lib/competitionsApi.ts` — `getEventRoles()`, `assignRole()`, `removeRole()`
2. `useEvent()` — `userState.permissions.canManageRoles`
3. **Stitch Design screens to open:**
   - `Stitch Designs/03_organizer/roles_permissions/roles_permissions_manager_1/` ← PRIMARY
   - `Stitch Designs/03_organizer/roles_permissions/roles_permissions_manager_2/`
   - `Stitch Designs/03_organizer/roles_permissions/roles_permissions_empty_state/`
   - `Stitch Designs/03_organizer/roles_permissions/roles_permissions_delete_confirmation/`
   - `Stitch Designs/02_user_student/notifications/notification_center/`

## TASK

### `RolesPage.tsx` (`/events/:eventId/manage/roles`)

Wrap in `<OrganizerGuard>`. Only users with `canManageRoles` permission see this page.

```
← Organizer Dashboard

Manage Roles — [Event Name]

Add a team member:
  [Reg No. input — e.g. AP21110010]  [Role ▾]  [Add]
  Role options: Co-Organizer | Manager | Judge
  Inline validation: "Reg no must match an enrolled student"

Current team:
  Reg No.      | Name  | Role          | Added By      | Added At | Actions
  AP21110010   | ...   | Owner         | —             | [date]   | (cannot remove owner)
  AP21110025   | ...   | Co-Organizer  | AP21110010    | [date]   | [Remove]
  AP21110088   | ...   | Judge         | AP21110010    | [date]   | [Remove] [Change Role ▾]

Role descriptions (shown as tooltip/help text):
  Co-Organizer: Full access except delete event or change ownership
  Manager: Manage registrations, broadcast messages, check-in
  Judge: Evaluate submissions, view all submission files
```

Loading: `<SkeletonTable rows={4}/>`.
Empty: "No team members yet. Add co-organizers, managers, or judges by their registration number." (reference `roles_permissions_empty_state` screen).
Remove: confirmation dialog (reference `roles_permissions_delete_confirmation` screen).

**Identity note:** The reg no input field accepts university reg nos only (format validation: letters + digits). The current user's own reg no is shown as the Owner and cannot be removed.

Reference `roles_permissions_manager_1` and `roles_permissions_manager_2` Stitch screens for the table layout, role badges, and add-member form placement.

### `NotificationsPage.tsx` (`/events/notifications`)

```
Notifications

[All] [Events] [Submissions] [Results] tab filter

List of notifications (newest first):
  [Icon] [Message]                          [Date]
  🏆 You've been shortlisted for Round 1    2h ago
  ✓ Your submission was received            1d ago
  ⏰ Submission closes in 3 hours           ...
  [View →] link per notification
```

Mark-all-read button top right.
Click notification → navigate to the linked event/round.
Loading: `<SkeletonCard/>` × 4.
Empty: "No notifications yet."

Reference `notification_center` Stitch screen for layout.

## DONE WHEN
- RolesPage correctly blocks non-owners from managing roles
- Role assignment sends reg no to backend
- Notifications list and links work
- `npm run build` passes

---

---

# PHASE 13 — Certificate Template Builder (Organizer)
> Goal: Organizer uploads a certificate template image and positions dynamic fields visually.

## READ FIRST
1. `Frontend/src/lib/competitionsApi.ts` — `uploadCertificateTemplateImage()`, `saveCertificateTemplate()`, `getCertificateTemplate()`
2. **Stitch Design screens to open:**
   - `Stitch Designs/03_organizer/certificate_template/certificate_template_manager/`

## TASK

### `CertificateTemplatePage.tsx` (`/events/:eventId/manage/certificate`)

Wrap in `<OrganizerGuard>`.

```
← Organizer Dashboard

Certificate Template — [Event Name]

Step 1: Upload Template
  [FileUploadZone — accepts PNG/JPG only]
  After upload: shows template image as canvas background

Step 2: Position Fields
  Canvas showing the uploaded template image at full width
  Overlay: draggable text boxes for each dynamic field

  Available fields panel (right side):
    [+ Participant Name]
    [+ Event Name]
    [+ Round/Category]
    [+ Rank/Position]
    [+ Date]
    [+ Custom text]

  Each dragged field box shows:
    Preview text (e.g., "John Doe", "AI Innovation Challenge")
    Resize handle
    Settings: Font size, Bold toggle, Color picker, Align (L/C/R)
    [✕ Remove]

  Field positions stored as percentage coordinates (x/y from top-left = 0,0)
  so template works at any rendered size

Step 3: Save
  [Save Template] → saveCertificateTemplate() with fields array
  [Preview with sample data] → shows the template rendered with placeholder values
```

Implementation note: implement the drag-and-drop canvas using native HTML5 drag events or React `onMouseDown/onMouseMove/onMouseUp` on the field boxes. Do not add a new npm package unless it already exists in `package.json`. Position is stored as percentage so it's resolution-independent.

Reference `certificate_template_manager` Stitch screen for the two-panel layout and field dragging UX.

**Scope boundary:** Certificate generation (compositing image + text on server) is handled by the backend. This page only collects the template image and field positions and saves them. The participant's `CertificateClaimPage` calls `downloadMyCertificate()` which returns the composited file.

## DONE WHEN
- Template image uploads correctly
- Fields can be dragged and positioned on the canvas
- Positions saved as percentages
- Template persists across page reloads (GET on mount)
- `npm run build` passes

---

---

# PHASE 14 — Polish, Accessibility, Dark Mode
> Goal: Every page passes a11y audit. Dark mode works on all competition pages. No regressions.

## READ FIRST
1. Every competition page file in `Frontend/src/pages/Events/`
2. Every shared component in `Frontend/src/components/competition/`
3. `Frontend/src/styles.css` — verify dark mode vars are defined

## TASK — work through each item completely before moving to the next

### 14.1 — Accessibility audit (all competition pages)

For every interactive element across all competition pages and components:
- `<button>` elements: `aria-label` when icon-only, `aria-disabled` when functionally disabled (not HTML `disabled` — so it stays focusable)
- `<input>` elements: paired `<label>`, `aria-describedby` for error messages
- `<table>` elements: `<caption>` or `aria-label`, `scope="col"` on headers
- Cards with `onClick`: `tabIndex={0}`, `role="article"`, `onKeyDown` (Enter/Space triggers onClick)
- Modals: trap focus, `role="dialog"`, `aria-labelledby` pointing to modal title
- Status badges: `role="status"`, `aria-label={status}`
- Loading areas: `aria-busy="true"`, `aria-live="polite"`
- Countdown timers: `<time dateTime={isoString}>` wrapper
- `aria-live="polite"` on score total in EvaluationPage so screen readers announce updates

### 14.2 — Dark mode audit

Visit every competition page (screenshots in agent browser) in `data-theme="dark"` mode. Fix any element that uses hardcoded hex colors instead of CSS vars. Verify:
- All `--comp-surface`, `--comp-border`, `--comp-text-*` vars render correctly
- Skeleton shimmer uses dark variant
- Status badge colors have sufficient contrast in dark mode
- Modal overlays are visible

### 14.3 — Mobile audit (375px viewport)

For each of the following pages, resize browser to 375px and verify layout:
- EventsListingPage: filter bar collapses to bottom sheet
- EventDetailPage: hero stats scroll horizontally, sticky action bar has single primary CTA
- SubmissionPage: two-col becomes single-col, rules collapse into accordion
- OrganizerDashboard: stats = 2×2 grid, table = card list
- EvaluationPage: panels stack vertically, Prev/Next = sticky bottom bar
- ShortlistPage: ranked table = horizontal scroll

### 14.4 — Performance checks

- `EvaluationPage` and `SubmissionListPage`: verify no unnecessary re-renders on score input change (use `React.memo` or `useCallback` where needed)
- `EventsListingPage`: verify search input is debounced (300ms)
- `OrganizerDashboard` participant table: verify `useMemo` on round column derivation

### 14.5 — Final type check

Run `npx tsc --noEmit`. Fix every error. Zero `any` types except where explicitly marked `// placeholder — typed in backend integration`.

## DONE WHEN
- `npm run build` passes with zero errors
- `npm run lint` passes with zero warnings
- All pages render in both light and dark mode without hardcoded colors
- All interactive elements have visible focus rings (`:focus-visible` using `--comp-focus-ring`)

---

---

## APPENDIX — Invariants (Never Violate)

These apply to every phase. If any prompt conflicts with these, the invariant wins.

1. **Identity is always reg no.** `session.profileData.TableContent["Register No."]`. Never UUID, never numeric ID.

2. **Roles are API-driven.** `getMyRole(eventId)` is the source of truth. `OrganizerGuard` always calls the API. No component checks `event.createdBy === userId` on its own.

3. **Frontend never decides result visibility.** If `criteriaScores` is null in the API response, render nothing. Never gate on a client-side `resultsPublished` variable.

4. **All deadline enforcement is API-side.** Countdown is informational only. Never disable submit based on client-side time. Let the API return `403` and show that message.

5. **`getEventUserState()` is the single source of truth.** No page computes `isOrganizer`, `canSubmit`, or `submissionState` independently.

6. **`EventProvider` fetches once per route mount.** Child components use `useEvent()`. No page inside `/events/:eventId/*` makes its own event API call.

7. **Errors are inline, successes are toasts.** Never toast an error requiring user action. Never inline-error a success.

8. **ShortlistPage preview is client-only.** No API call on Top N input change.

9. **All spacing uses CSS tokens.** `var(--space-xs)` through `var(--space-2xl)`. No hardcoded px values in competition component styles.

10. **Stitch designs are the visual target.** Before writing any UI, open the corresponding Stitch screen image. Match the layout, spacing, and component hierarchy as closely as possible to that screen using the existing design system (teal + off-white, CSS vars).

11. **Layer purity.** No data transformation in `.tsx` files. All response shaping happens in `competitionsApi.ts` or `eventUserState.ts`.

12. **Future scope is not future-proof, it's a clean boundary.** Event chat room, certificate verification portal, hall of fame, expert panel assignment, score appeals — none of these get stubs, hooks, or placeholder UI. They don't exist until their phase is started.
