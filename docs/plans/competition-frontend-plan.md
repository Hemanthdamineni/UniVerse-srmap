# Competition Platform — Frontend Implementation Plan v3
> Stack: React 19 · TypeScript 5.8 · TailwindCSS 4 · shadcn/ui · Lucide React · react-router-dom v7
> Design system: CSS variables `--app-shell-bg / --sidebar-accent / --dash-accent` (#0a272b teal + #f8f8f8)
> Backend: existing `/api/events/*` + new `/api/competitions/*`
> **v2:** State sync layer, event context provider, polling, error UX, empty states, permission
> edge cases, performance, quick-mode, notifications UI, leaderboard, phase mapping, a11y,
> mobile-first, spacing tokens.
> **v3:** Client-side caching strategy, smart polling with phase-aware intervals, optimistic UI
> updates with rollback, undo/recovery design, audit history layer, global loading boundary,
> failure recovery navigation, analytics tracking hooks, progressive create flow hints, and
> ERP cross-domain integration stubs. Focus-visible outlines and Tailwind spacing enforcement.

---

## 0. Pre-Work: Fix the `undefined` Bug

Before touching any design, hunt down the `undefined` prefix showing up in event titles and
venues (`undefinedAI Competition...`, `undefinedMain Auditorium`).

**Where to look:**
- The event creation form — wherever it builds the POST body, find any template literal
  like `` `${prefix}${formData.title}` `` where `prefix` is a state variable that starts
  as `undefined` before being set
- The event detail component — search for every place `event.title` and `event.location`
  are rendered, look for string concatenation
- The API response mapping in whatever `eventsApi.ts` function fetches a single event —
  check if any field is being destructured from a nested object that doesn't exist yet

**Fix pattern:** Replace every `someVar + event.field` or `` `${someVar}${event.field}` ``
with null-safe guards. For title: `event.title ?? 'Untitled Event'`. For location:
`event.location || event.venue || 'Venue TBA'`.

---

## 1. Design Identity (Apply Consistently Everywhere)

Your platform already has a strong identity: deep teal `#0a272b` + off-white `#f8f8f8` + the
diagonal clip-path geometry. Do NOT abandon this. The problem isn't the identity, it's that
content areas inside pages are currently inheriting the raw shell background and getting buried
under the geometry.

### Rule: Shell vs Surface separation
```
Shell (Sidebar, header accent geometry) → uses --dash-accent (#0a272b), clip-path, no content
Surface (cards, panels, forms)          → white/near-white bg, clean, no geometry overlay
Content area background                 → --app-shell-bg (#f8f8f8 light / #0a262a dark)
```

Every page's content must sit on clean surface cards. The diagonal geometry belongs only in the
top-right corner of the page shell — not behind every form field.

### New CSS variables to add to `styles.css`

```css
/* Competition platform surfaces */
--comp-surface: #ffffff;
--comp-surface-hover: #f4f7f7;
--comp-border: #e2e8ea;
--comp-border-strong: #cbd5d8;
--comp-text-primary: #0a272b;
--comp-text-secondary: #4a6b70;
--comp-text-muted: #8ba5a9;

/* Status colors */
--status-open-bg: #f0fdf4;
--status-open-text: #15803d;
--status-open-border: #bbf7d0;
--status-pending-bg: #fffbeb;
--status-pending-text: #92400e;
--status-pending-border: #fde68a;
--status-closed-bg: #f1f5f9;
--status-closed-text: #475569;
--status-closed-border: #cbd5e1;
--status-live-bg: #fff1f2;
--status-live-text: #be123c;
--status-live-border: #fecdd3;
--status-selected-bg: #f0fdf4;
--status-selected-text: #166534;
--status-rejected-bg: #fff1f2;
--status-rejected-text: #9f1239;

/* Deadline urgency */
--deadline-safe: #15803d;
--deadline-warn: #b45309;
--deadline-urgent: #b91c1c;

/* Competition accent */
--comp-accent: #0a272b;
--comp-accent-hover: #0d3438;
--comp-accent-light: #e6f0f1;

/* Spacing design tokens */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 40px;
--space-2xl: 64px;

/* Focus ring — accessible, on-brand */
--comp-focus-ring: 2px solid #0a272b;
--comp-focus-ring-offset: 2px;
```

**Tailwind spacing enforcement rule:** Never use Tailwind's `p-3`, `m-4`, etc. classes
in competition component files. Always use `style={{ padding: 'var(--space-md)' }}` or
a utility class built on the token. This keeps spacing consistent between Tailwind and
vanilla CSS sections of the codebase.

**Focus outlines (not just aria):** Every interactive element must have a visible focus
ring using the CSS variable. Add to `styles.css`:

```css
/* Global focus rule for competition components */
.comp-surface *:focus-visible {
  outline: var(--comp-focus-ring);
  outline-offset: var(--comp-focus-ring-offset);
  border-radius: 4px;
}
```

This complements the `aria-*` attributes — aria tells screen readers, focus rings tell
sighted keyboard users. Both are required.

**Dark mode equivalents** — add inside `[data-theme="dark"]` selector:
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

### Typography
```css
.comp-heading-xl  { font-size: 1.75rem; font-weight: 700; line-height: 1.2; color: var(--comp-text-primary); }
.comp-heading-lg  { font-size: 1.25rem; font-weight: 600; color: var(--comp-text-primary); }
.comp-heading-md  { font-size: 1rem;    font-weight: 600; color: var(--comp-text-primary); }
.comp-body        { font-size: 0.9rem;  color: var(--comp-text-secondary); line-height: 1.6; }
.comp-label       { font-size: 0.75rem; font-weight: 500; color: var(--comp-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
```

### Status pulse animation
```css
.status-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
```

---

## 2. Client-Side Caching Strategy (New)

Without a cache layer, every route transition re-fetches the event, every polling tick
fetches unconditionally, and navigating back from `EvaluationPage` to `SubmissionListPage`
triggers a full reload. This section defines the cache that sits between `EventProvider`
and the network.

### 2.1 In-Memory Event Cache

**File: `Frontend/src/lib/eventCache.ts`**

```typescript
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;   // Date.now()
  ttlMs: number;
}

class EventCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, fetchedAt: Date.now(), ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const eventCache = new EventCache();
```

**Cache key scheme and TTLs:**

| Key pattern | TTL | Invalidated when |
|-------------|-----|-----------------|
| `event:{eventId}` | 60s | Edit event, archive, status change |
| `config:{eventId}` | 120s | Edit competition config |
| `submissions:{eventId}:{roundId}` | 20s | New submission, evaluation saved |
| `my-submission:{eventId}:{roundId}` | 30s | Submit or resubmit |
| `events-list:{queryString}` | 30s | Create event |

**Why not TanStack Query?** TanStack Query is the correct long-term choice — if the
project already uses or will adopt it, replace this entire section with TanStack Query's
`useQuery` + `queryClient.invalidateQueries`. The in-memory cache above is the correct
approach **only if adding a new dependency is blocked**. The API for both is equivalent
from the component perspective.

**Migration path to TanStack Query:**
```typescript
// Current (in-memory cache)
const data = eventCache.get(`event:${id}`) ?? await fetchEvent(id);

// Future (TanStack Query — same component interface)
const { data } = useQuery({ queryKey: ['event', id], queryFn: () => fetchEvent(id), staleTime: 60_000 });
```

### 2.2 Cache Integration in `EventProvider`

```typescript
// Inside EventProvider fetch function
const fetchData = useCallback(async (skipCache = false) => {
  const cacheKey = `event:${eventId}`;
  const configKey = `config:${eventId}`;

  if (!skipCache) {
    const cachedEvent = eventCache.get<EventDetail>(cacheKey);
    const cachedConfig = eventCache.get<CompetitionConfig | null>(configKey);
    if (cachedEvent) {
      setEvent(cachedEvent);
      setConfig(cachedConfig ?? null);
      setLoading(false);
      return;
    }
  }

  try {
    const [eventData, configData] = await Promise.all([
      getEvent(eventId),
      getCompetitionConfig(eventId).catch(() => null),
    ]);
    eventCache.set(cacheKey, eventData, 60_000);
    eventCache.set(configKey, configData, 120_000);
    setEvent(eventData);
    setConfig(configData);
  } catch (e) {
    setError('Failed to load event. Please try again.');
  } finally {
    setLoading(false);
  }
}, [eventId]);
```

**`refetch` in context:** Calls `fetchData(true)` — always bypasses cache. Used by the
retry button in `FailureRecoveryBanner` and the "Reload" button in `OrganizerGuard`.

**Cache invalidation on mutation:** Every write function in `competitionsApi.ts` calls
`eventCache.invalidate()` for the affected keys after a successful response:

```typescript
async function submitWork(eventId, roundId, formData) {
  const result = await fetch(...);
  // on success:
  eventCache.invalidate(`my-submission:${eventId}:${roundId}`);
  eventCache.invalidate(`submissions:${eventId}:${roundId}`);
  return result;
}
```

---

## 3. Event Phase Mapping (New — Use Everywhere)

Rather than scattering raw status strings across components, map all event states to a small
set of UI phases. Use `getEventPhase()` everywhere: event cards, dashboard round cards, filter
chips, and the sticky action bar.

```typescript
// Frontend/src/lib/eventPhase.ts

export const EVENT_PHASE = {
  UPCOMING: 'UPCOMING',
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  LIVE: 'LIVE',
  EVALUATION: 'EVALUATION',
  RESULTS: 'RESULTS',
  COMPLETED: 'COMPLETED',
} as const;

export type EventPhase = typeof EVENT_PHASE[keyof typeof EVENT_PHASE];

export function getEventPhase(event: EventDetail): EventPhase {
  const now = new Date();
  if (event.status === 'archived' || event.status === 'completed') return EVENT_PHASE.COMPLETED;
  if (!event.competitionConfig) {
    if (event.status === 'published' || event.status === 'public') return EVENT_PHASE.REGISTRATION_OPEN;
    if (event.status === 'ongoing') return EVENT_PHASE.LIVE;
    return EVENT_PHASE.UPCOMING;
  }
  // Competition phase: derive from rounds
  const rounds: CompetitionRound[] = event.competitionConfig.rounds;
  const anyPublished = rounds.some(r => r.resultsPublished);
  const allPublished = rounds.every(r => r.resultsPublished);
  const anyOpenForSubmission = rounds.some(
    r => !r.resultsPublished && new Date(r.submissionDeadline) > now
  );
  const anyPastDeadline = rounds.some(r => new Date(r.submissionDeadline) <= now && !r.resultsPublished);
  if (allPublished) return EVENT_PHASE.RESULTS;
  if (anyOpenForSubmission) return EVENT_PHASE.LIVE;
  if (anyPastDeadline) return EVENT_PHASE.EVALUATION;
  if (anyPublished) return EVENT_PHASE.RESULTS;
  return EVENT_PHASE.REGISTRATION_OPEN;
}
```

Phase → display mapping (used in `StatusBadge`):

| Phase | Label | Color |
|-------|-------|-------|
| `UPCOMING` | "Upcoming" | blue-gray |
| `REGISTRATION_OPEN` | "Registration Open" | green |
| `LIVE` | "Live" | red pulse |
| `EVALUATION` | "Evaluation" | amber |
| `RESULTS` | "Results Out" | teal |
| `COMPLETED` | "Completed" | gray |

---

## 3. State Synchronization Layer (New — Critical)

Without this layer, every page computes role, canSubmit, submissionState independently,
leading to duplicated logic and UI contradictions (e.g., button says "Submit" but API rejects).

**File: `Frontend/src/lib/eventUserState.ts`**

```typescript
export interface RoundUserState {
  roundId: string;
  roundTitle: string;
  canSubmit: boolean;
  canViewResults: boolean;
  submissionState: 'none' | 'submitted' | 'locked' | 'evaluated' | 'published';
  isShortlisted: boolean;
  isBlocked: boolean;          // true if gated by prior round shortlist
  blockReason?: string;
}

export interface EventUserState {
  role: 'visitor' | 'participant' | 'organizer';
  canEdit: boolean;            // Backend-driven flag — trust this over local computation
  canEvaluate: boolean;        // Backend-driven flag
  canShortlist: boolean;       // Backend-driven flag
  phase: EventPhase;
  currentRound: CompetitionRound | null;   // the round open for submission right now
  roundStates: RoundUserState[];
}

export function getEventUserState(
  event: EventDetail,
  config: CompetitionConfig | null,
  userId: string,
  submissions: Record<string, Submission | null>,   // keyed by roundId
  permissions?: BackendPermissions,                 // from event.permissions if available
): EventUserState {
  const isOrganizer = event.createdBy === userId ||
    (JSON.parse(event.coOrganizers || '[]') as string[]).includes(userId);
  const isRegistered = !!event.myRegistration;
  const role = isOrganizer ? 'organizer' : isRegistered ? 'participant' : 'visitor';
  const phase = getEventPhase(event);

  // Backend-driven permissions take precedence if available
  const canEdit = permissions?.canEdit ?? isOrganizer;
  const canEvaluate = permissions?.canEvaluate ?? isOrganizer;
  const canShortlist = permissions?.canShortlist ?? isOrganizer;

  const rounds = config?.rounds ?? [];
  const now = new Date();

  let shortlistedRoundIds = new Set<string>();
  const roundStates: RoundUserState[] = rounds.map(round => {
    const sub = submissions[round.roundId];
    const deadlinePassed = new Date(round.submissionDeadline) <= now;

    // Gating check
    const priorRoundId = round.requiresShortlistFromRound;
    const isBlocked = !!priorRoundId && !shortlistedRoundIds.has(priorRoundId);

    // Submission state
    let submissionState: RoundUserState['submissionState'] = 'none';
    if (sub) {
      if (round.resultsPublished) submissionState = 'published';
      else if (sub.criteriaScores) submissionState = 'evaluated';
      else if (deadlinePassed) submissionState = 'locked';
      else submissionState = 'submitted';
    } else if (deadlinePassed) {
      submissionState = 'locked';
    }

    const isShortlisted = sub?.shortlisted ?? false;
    if (isShortlisted) shortlistedRoundIds.add(round.roundId);

    const canSubmit =
      role === 'participant' &&
      !deadlinePassed &&
      !isBlocked &&
      !round.resultsPublished;

    return {
      roundId: round.roundId,
      roundTitle: round.title,
      canSubmit,
      canViewResults: round.resultsPublished,
      submissionState,
      isShortlisted,
      isBlocked,
      blockReason: isBlocked
        ? `Requires shortlist from ${rounds.find(r => r.roundId === priorRoundId)?.title ?? 'previous round'}`
        : undefined,
    };
  });

  const currentRound = rounds.find(r => new Date(r.submissionDeadline) > now) ?? null;

  return { role, canEdit, canEvaluate, canShortlist, phase, currentRound, roundStates };
}
```

**Use `getEventUserState()` in every page that needs role or submission awareness:**
- `EventDetailPage` — for tab content, sticky action bar CTAs
- `SubmissionPage` — for form state machine
- `OrganizerDashboard` — for round card CTAs
- `RoundStatusCard` — receives `roundState` as prop, no internal role logic

This eliminates the 6+ places that currently each compute `isOrganizer` from scratch.

---

## 6. Optimistic UI Updates (New)

Without optimistic updates, every submission, evaluation save, and shortlist apply requires
the user to wait for a round-trip before seeing any feedback. On slow connections this
feels broken. Optimistic updates apply the state change immediately and roll back on error.

### 6.1 Pattern

```typescript
// Generic optimistic update hook
function useOptimistic<T>(initialValue: T) {
  const [optimisticValue, setOptimisticValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const prevValue = useRef(initialValue);

  const update = async (
    newValue: T,
    apiCall: () => Promise<T>,
  ) => {
    prevValue.current = optimisticValue;
    setOptimisticValue(newValue);  // apply immediately
    setIsPending(true);
    try {
      const serverValue = await apiCall();
      setOptimisticValue(serverValue);  // reconcile with server truth
    } catch {
      setOptimisticValue(prevValue.current);  // rollback
      throw;  // re-throw so caller can show error
    } finally {
      setIsPending(false);
    }
  };

  return { value: optimisticValue, isPending, update };
}
```

### 6.2 Where to Apply

**`SubmissionPage` — submit / resubmit:**
```typescript
const { value: submissionState, update: updateSubmission } = useOptimistic(
  roundState.submissionState
);

const handleSubmit = async () => {
  await updateSubmission(
    'submitted',  // optimistic — show banner immediately
    () => submitWork(eventId, roundId, formData)
  ).catch(e => {
    setError(e.message);  // rollback happened; show inline error
  });
};
```

**`EvaluationPage` — save evaluation:**
```typescript
const { value: savedState, update: saveEval } = useOptimistic(initialEvalState);

const handleSave = async () => {
  await saveEval(
    { ...currentScores, _status: 'saving' },   // optimistic
    () => evaluateSubmission(eventId, roundId, id, payload)
  ).catch(() => {
    setError('Failed to save. Scores preserved — try again.');
  });
};
```

**`ShortlistPage` — apply shortlist:**

Do NOT apply optimistic updates here. This action is shown inside a confirmation modal
and immediately navigates away on success. The latency is acceptable for an irreversible
action — users should see the real server response before the UI commits.

### 6.3 Rollback UX

When a rollback occurs:
- The UI snaps back to the previous state visually
- An `<ErrorMessage>` appears inline (below the submit button, below the save button)
- The user's input is preserved in form state (they do not have to re-select a file or
  re-enter scores)
- A "Try again" button in `ErrorMessage` re-triggers the same optimistic update

---

## 4. Global Event Context Provider (New)

Without shared context, `EventDetailPage`, `SubmissionPage`, and `OrganizerDashboard` each
independently fetch the same event + config. This causes unnecessary API calls and state drift.

**File: `Frontend/src/contexts/EventContext.tsx`**

```typescript
interface EventContextValue {
  event: EventDetail | null;
  config: CompetitionConfig | null;
  userState: EventUserState | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const EventContext = React.createContext<EventContextValue | null>(null);

export function EventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [config, setConfig] = useState<CompetitionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useSession();

  const fetch = useCallback(async () => {
    try {
      const [eventData, configData] = await Promise.all([
        getEvent(eventId),
        getCompetitionConfig(eventId).catch(() => null),
      ]);
      setEvent(eventData);
      setConfig(configData);
    } catch (e) {
      setError('Failed to load event. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Smart polling — interval adapts to event phase
  // LIVE / EVALUATION phases need faster updates; idle phases can be slower.
  useEffect(() => {
    const getInterval = () => {
      const phase = event ? getEventPhase(event) : null;
      if (phase === 'LIVE') return 10_000;       // submissions open — poll fast
      if (phase === 'EVALUATION') return 15_000; // organizer actively evaluating
      return 30_000;                             // registration open / results / upcoming
    };

    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        if (!document.hidden) fetch();
        schedule();  // reschedule after each tick (interval can change between ticks)
      }, getInterval());
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [fetch, event]);

  const submissions = useSubmissions(eventId, config);  // custom hook below
  const userState = event && userId
    ? getEventUserState(event, config, userId, submissions, event.permissions)
    : null;

  return (
    <EventContext.Provider value={{ event, config, userState, loading, error, refetch: fetch }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const ctx = React.useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used inside <EventProvider>');
  return ctx;
}
```

**Usage in routes:**
```tsx
// In main.tsx route config
<Route path="/events/:eventId" element={
  <EventProvider eventId={params.eventId}>
    <EventDetailPage />
  </EventProvider>
} />
```

All child pages (`SubmissionPage`, `MyResultsPage`, `OrganizerDashboard`, etc.) receive the
event via `useEvent()` — no repeated fetch calls.

### Custom hook: `useSubmissions`

```typescript
// Fetches participant's own submissions for all rounds, memoized by eventId
function useSubmissions(
  eventId: string,
  config: CompetitionConfig | null
): Record<string, Submission | null> {
  const [submissions, setSubmissions] = useState<Record<string, Submission | null>>({});
  useEffect(() => {
    if (!config) return;
    Promise.all(
      config.rounds.map(r =>
        getMySubmission(eventId, r.roundId)
          .then(sub => [r.roundId, sub] as const)
          .catch(() => [r.roundId, null] as const)
      )
    ).then(pairs => setSubmissions(Object.fromEntries(pairs)));
  }, [eventId, config]);
  return submissions;
}
```

---

## 5. Shared Components
**Location: `Frontend/src/components/competition/`**

Build these before any page. Every page depends on them.

> **Component render contract:** Every component must define all four states:
> `loading | empty | error | success`. Never leave any state undefined.

---

### 5.1 `StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: 'draft' | 'published' | 'public' | 'ongoing' | 'submission-closed' |
          'evaluation' | 'results-published' | 'completed' | 'archived' |
          'open' | 'upcoming' | 'closed' | 'in-progress';
  size?: 'sm' | 'md';
}
```

Visual spec:
- `draft` → gray pill, "Draft"
- `published` / `public` → teal-light pill, "Published" / "Public"
- `ongoing` / `in-progress` → amber pill with pulsing dot, "In Progress"
- `open` → green pill, "Open"
- `upcoming` → blue-gray pill, "Upcoming"
- `submission-closed` / `closed` → slate pill, "Closed"
- `evaluation` → purple pill, "Evaluation"
- `results-published` → green pill, "Results Out"
- `completed` / `archived` → gray pill

**Accessibility:** Include `role="status"` and `aria-label={status}` on each badge.

---

### 5.2 `DeadlineCountdown.tsx`

```typescript
interface DeadlineCountdownProps {
  deadline: string;        // ISO string
  showIcon?: boolean;
  compact?: boolean;       // "2d 4h" vs "2 days, 4 hours left"
}
```

Logic:
- `diff = deadline - now`
- `diff <= 0`: "Deadline passed" (muted gray)
- `diff < 3 days`: `--deadline-urgent` red, compact format "Xh Ym left"
- `diff < 7 days`: `--deadline-warn` amber, "X days, Yh left"
- `diff >= 7 days`: `--deadline-safe` green, "X days left"
- `useEffect` cleanup clears interval on unmount

**Accessibility:** Wrap in `<time dateTime={deadline}>`. This gives screen readers the full
ISO date while the visual shows the countdown.

---

### 5.3 `RoundStatusCard.tsx`

```typescript
interface RoundStatusCardProps {
  round: CompetitionRound;
  roundState: RoundUserState;    // from EventUserState — never compute role internally
  onSubmit?: () => void;
  onViewResult?: () => void;
  onViewSubmissions?: () => void;
  onEvaluate?: () => void;
  onShortlist?: () => void;
}
```

**No role prop** — the component reads state from `roundState`. This enforces the single
source of truth from the state synchronization layer.

Visual spec:
```
┌─────────────────────────────────────────────────────────┐
│  [Round Number pill]  Round Title              [Status] │
│                                                         │
│  Deadline: Sat 11 Apr, 8:00 PM  [DeadlineCountdown]    │
│                                                         │
│  Instructions (truncated to 2 lines, expandable)        │
│                                                         │
│  Evaluation criteria chips: [Innovation /10] [UX /10]  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  [Primary CTA]                        [Secondary CTA]   │
└─────────────────────────────────────────────────────────┘
```

Left border (3px) color by `submissionState`:
- `none` / deadline future → `#15803d` green
- `locked` / evaluating → `#b45309` amber
- `published` → `#0a272b` teal
- blocked → `--comp-border` gray

**Empty state:** If `round.evaluationCriteria` is empty, hide the criteria row entirely
(do not show "No criteria defined").

**Accessibility:** `aria-label={round.title}` on the card root. CTA buttons have
descriptive `aria-label` values, e.g., `aria-label="Submit work for Round 1"`.

---

### 5.4 `CompetitionEventCard.tsx`

```typescript
interface CompetitionEventCardProps {
  event: EventSummary;
  onClick: () => void;
}
```

Visual spec:
```
┌──────────────────────────────────────────────────────────┐
│ [Category chip]  [Competition chip if isCompetition]     │
│                                              [Status]    │
│                                                          │
│ Event Title (font-semibold, text-lg, 2-line max)         │
│ Description (text-sm, muted, 2-line truncate)            │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│ 🏛 Department   📍 Venue   👥 N registrations            │
│                                                          │
│ [Prizes: ₹XX,XXX if set]                                 │
│                                                          │
│ [3 Rounds]  [DeadlineCountdown compact]  [View Details→] │
└──────────────────────────────────────────────────────────┘
```

Competition cards: left border `#0a272b` (3px solid), teal "Competition" chip top-right.
Regular cards: left border `--comp-border` (1px).
Hover: `translateY(-2px)` + shadow increase, smooth 150ms transition.

**Mobile:** Stack all metadata rows vertically. "View Details →" becomes a full-width
button at the bottom of the card. Competition chip stays visible above the title.

**Accessibility:** `role="article"`, `aria-label={event.title}` on the card root. The
entire card is keyboard-focusable via `tabIndex={0}` + `onKeyDown` (Enter/Space → onClick).

---

### 5.5 `SubmissionStatusBanner.tsx`

```typescript
interface SubmissionStatusBannerProps {
  state: 'not-submitted' | 'submitted' | 'locked' | 'evaluated-pending' |
         'shortlisted' | 'not-selected' | 'not-evaluated';
  submittedAt?: string;
  resubmissionsRemaining?: number;
  roundTitle: string;
}
```

Each state → color + icon + message:
- `not-submitted`: amber, ⚠ "You haven't submitted for [Round] yet."
- `submitted`: green, ✓ "Submitted [date]. X resubmissions remaining."
- `locked`: gray, 🔒 "Submission window closed. Awaiting evaluation."
- `evaluated-pending`: blue, ⏳ "Evaluated. Results will be published by the organizer."
- `shortlisted`: green (strong), 🏆 "Congratulations! You've been shortlisted."
- `not-selected`: gray, — "You were not selected for the next round."
- `not-evaluated`: gray, ○ "Your submission was not evaluated."

---

### 5.6 `EvaluationCriteriaTable.tsx`

```typescript
interface EvaluationCriteriaTableProps {
  criteria: { label: string; maxScore: number }[];
  scores?: Record<string, number>;
  onChange?: (label: string, score: number) => void;
  readOnly?: boolean;
}
```

- Table: Criteria | Max Score | [Score input if !readOnly]
- Total row updates live. Uses `font-bold` + `--comp-accent`.
- In edit mode: each input has `aria-label={${criterion.label} score}` and `min={0}`
  `max={criterion.maxScore}` with inline `aria-describedby` error if out of range.

**Empty state:** If `criteria` is empty and `readOnly`, render nothing. If empty and
edit mode, show "No evaluation criteria defined for this round."

---

### 5.7 `FileUploadZone.tsx`

```typescript
interface FileUploadZoneProps {
  onFile: (file: File) => void;
  accept: string[];
  maxSizeMb: number;
  currentFile?: { name: string; size: number; uploadedAt: string };
  error?: string;      // API error message shown inline below the zone
  isUploading?: boolean;
}
```

States:
- **Idle**: dashed border, "Drag & drop or click to browse", accepted types as chips
- **Dragging over**: border turns teal solid, background tints lightly
- **File selected**: filename, size, checkmark, "Upload" button
- **Uploading**: indeterminate progress bar, button disabled
- **Uploaded**: green checkmark, filename, "Replace" link
- **Error (client UX)**: orange border, "File too large" / "Type not supported" — for
  immediate feedback before submit
- **Error (API, `error` prop set)**: red border + error text below the zone. This is the
  authoritative error. Never show conflicting messages.

**Mobile:** Full-width, no drag-and-drop hint text on touch devices (detect via
`'ontouchstart' in window`). Replace with "Tap to browse".

---

### 5.8 `OrganizerGuard.tsx`

```typescript
interface OrganizerGuardProps {
  event: EventDetail;
  currentUserId: string;
  children: React.ReactNode;
}
```

Logic:
1. Check `event.permissions?.canEdit` (backend-driven flag) if available — trust this first.
2. Fallback: `event.createdBy === currentUserId` OR `coOrganizers.includes(currentUserId)`.
3. If event is archived: show "This competition has been archived. Organizer actions are
   no longer available." even if user is organizer.
4. If event is not a competition: show "This event does not have competition features."
5. If guard fails: show a teal-bordered info card with message + "← Back to Event" link.
   Never redirect silently.

**Edge case — session staleness:** If the user was a co-organizer but has been removed,
the backend will return `403` on any organizer API call. Catch `403` responses from
organizer endpoints and show: "Your organizer access to this event has changed. Reload
the page." with a Reload button.

---

### 5.9 `SummaryStatBar.tsx`

```typescript
interface SummaryStatBarProps {
  stats: { label: string; value: number; color?: string }[];
}
```

Example:
```
42 total  |  30 evaluated  |  12 pending  |  2 flagged
```

**Empty state:** If all values are 0, show "No submissions yet."

---

### 5.10 `ErrorMessage.tsx` (New)

Standardized inline error display used across all competition pages.

```typescript
interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;    // shows "Try again" button if provided
  preservedInput?: boolean; // if true, add "Your input has been preserved" note
}
```

Error UX rules per page:

| Page | Error scenario | UX treatment |
|------|---------------|-------------|
| `SubmissionPage` | File too large | Inline below `FileUploadZone`, orange, no toast |
| `SubmissionPage` | Deadline passed mid-submit | Full-width amber banner, form locked |
| `SubmissionPage` | Network failure on submit | Red inline `<ErrorMessage>` with retry, input preserved |
| `EvaluationPage` | Save failed | Red inline error below "Save" button, scores preserved in state |
| `ShortlistPage` | Apply failed | Modal error, ranked list unchanged |
| `OrganizerDashboard` | Fetch failed | Skeleton replaced with error card + retry |
| Any page | `403` access changed | Teal info card (see `OrganizerGuard`) |

**Toast policy:** Use toast notifications ONLY for success confirmation. Never for errors
that require the user to take action — those get inline errors.

---

### 5.11 `EmptyState.tsx` (New)

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

Required empty states per context:

| Context | Title | Description | Action |
|---------|-------|-------------|--------|
| Events listing, no results | "No events found" | Based on active filters | "Clear filters" |
| Events listing, no filters | "No events yet" | "Be the first to create one" | "Create Event" |
| Organizer dashboard, no submissions | "No submissions yet" | "Submissions will appear here once participants start submitting." | — |
| Organizer dashboard, no participants | "No registrations yet" | — | — |
| Round with no criteria | (hidden, not shown) | — | — |
| My Activity, tab 1 | "No registered events" | — | "Explore Events" |
| My Activity, tab 2/3 | "No activity yet" | "Register for an event to get started." | "Explore Events" |
| My Created Events | "No events created" | — | "Create Event" |

---

### 5.12 `NotificationToast.tsx` (New — Placeholder-ready)

UI placeholder for the notifications system. The backend wires these in a later phase, but
the UI must be ready so users see feedback immediately when the backend enables them.

```typescript
interface NotificationItem {
  id: string;
  type: 'shortlisted' | 'results-published' | 'submission-confirmed' |
        'deadline-reminder' | 'round-opened';
  eventName: string;
  roundTitle?: string;
  createdAt: string;
  read: boolean;
}
```

**Notification center** (bell icon in the sidebar bottom nav):
- Badge counter showing unread count
- Dropdown panel with notification list
- Each item: icon + message + timestamp + "View" link

Notification messages:
- `shortlisted`: "🏆 You've been shortlisted for [Round] of [Event]."
- `results-published`: "Results for [Round] have been published."
- `submission-confirmed`: "✓ Your submission for [Round] was received."
- `deadline-reminder`: "⏰ [Round] closes in 3 hours."
- `round-opened`: "Round [N] is now open for submission."

**Implementation note:** The notification center renders whatever `GET /api/events/notifications`
returns. If that endpoint returns empty (backend not yet wired), show the empty state
"No notifications yet." The UI does not need the backend to be ready.

---

### 5.13 `SkeletonCard.tsx` / `SkeletonTable.tsx` (New)

CSS-only shimmer skeletons for loading states. Use these instead of spinners everywhere.

```css
/* Add to styles.css */
.skeleton-shimmer {
  background: linear-gradient(90deg, #f0f4f5 25%, #e2eaec 50%, #f0f4f5 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
[data-theme="dark"] .skeleton-shimmer {
  background: linear-gradient(90deg, #1a3038 25%, #1f3a42 50%, #1a3038 75%);
  background-size: 200% 100%;
}
```

`SkeletonCard`: mimics `CompetitionEventCard` proportions (3 lines of text, 2 metadata rows).
`SkeletonTable`: mimics a table with N rows of shimmer cells.

---

### 5.14 `GlobalLoadingBoundary.tsx` (New)

A page-level fallback rendered by React `<Suspense>` and by `EventProvider` while the
initial event fetch is in flight. Unlike per-component skeletons (which mimic a specific
component's shape), this covers the entire event subtree before any data exists.

```typescript
// Full-page skeleton that matches the EventDetailPage shell
export function GlobalLoadingBoundary() {
  return (
    <div style={{ padding: 'var(--space-xl)' }} aria-busy="true" aria-label="Loading event">
      {/* Hero skeleton */}
      <div className="skeleton-shimmer" style={{ height: 32, width: '40%', borderRadius: 6, marginBottom: 'var(--space-sm)' }} />
      <div className="skeleton-shimmer" style={{ height: 22, width: '70%', borderRadius: 6, marginBottom: 'var(--space-lg)' }} />
      {/* Stats row skeleton */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 72, flex: 1, borderRadius: 8 }} />
        ))}
      </div>
      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        {[1,2,3].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 36, width: 80, borderRadius: 20 }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="skeleton-shimmer" style={{ height: 160, borderRadius: 10 }} />
    </div>
  );
}
```

**Usage in `EventProvider`:**
```tsx
if (loading && !event) return <GlobalLoadingBoundary />;
```

**Usage in route config:**
```tsx
<Suspense fallback={<GlobalLoadingBoundary />}>
  <EventProvider eventId={params.eventId}>
    <EventDetailPage />
  </EventProvider>
</Suspense>
```

---

### 5.15 `FailureRecoveryBanner.tsx` (New)

Shown when the top-level event fetch fails entirely (network error, 500, etc.). Replaces
the full page content — not a toast, not a small inline message.

```typescript
interface FailureRecoveryBannerProps {
  message?: string;
  onRetry: () => void;
}

export function FailureRecoveryBanner({ message, onRetry }: FailureRecoveryBannerProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-md)',
      padding: 'var(--space-xl)', textAlign: 'center',
    }}>
      <span style={{ fontSize: '2.5rem' }}>⚠</span>
      <p className="comp-heading-lg">Failed to load event</p>
      <p className="comp-body">{message ?? 'Something went wrong. Please try again.'}</p>
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button onClick={onRetry} className="comp-btn-primary" aria-label="Retry loading event">
          Retry
        </button>
        <a href="/events" className="comp-btn-ghost">← Back to Events</a>
      </div>
    </div>
  );
}
```

**Usage in `EventProvider`:**
```tsx
if (error && !event) return <FailureRecoveryBanner onRetry={() => fetchData(true)} />;
```

**Note:** This is distinct from per-component errors (e.g., submission fetch failed). Those
use `<ErrorMessage>` inline. This banner is only for when the core event data is unavailable
and no page can render at all.

---

### 5.16 `AuditHistoryPanel.tsx` (New)

Minimal audit log shown in the `EvaluationPage` right panel and in `OrganizerDashboard`
for context on irreversible actions. Sourced from fields already on the submission record.

```typescript
interface AuditEvent {
  label: string;      // "Evaluated by", "Shortlist applied", "Results published"
  actor?: string;     // register number
  at: string;         // ISO timestamp
}

interface AuditHistoryPanelProps {
  events: AuditEvent[];
}
```

Data sources:
- Evaluation: `{ label: 'Evaluated by', actor: submission.evaluatedBy, at: submission.evaluatedAt }`
- Shortlist: derived from round config change timestamp (add `shortlistAppliedAt` to round
  schema — one new field the backend should expose)
- Results published: same pattern — `resultsPublishedAt` on the round config

Visual spec (compact, secondary):
```
─── History ──────────────────────────────
  ✓ Evaluated by AP21110010  •  Apr 11, 9PM
  ✓ Shortlist applied        •  Apr 11, 10PM
  ✓ Results published        •  Apr 11, 11PM
```

**Location:**
- `EvaluationPage` right panel: below the "Save Evaluation" button. Shows evaluation
  history for the current submission only.
- `OrganizerDashboard` actions section: below the broadcast/archive buttons. Shows
  round-level events for the whole competition.
- `ShortlistPage`: shows "Shortlist applied at..." and "Results published at..." after
  those actions complete.

---

### 5.17 `AnalyticsTracker` (New — Placeholder hooks)

Analytics hooks that emit named events. The implementation is a no-op until a real
analytics backend is connected. Adding the calls now means zero refactoring later.

**File: `Frontend/src/lib/analytics.ts`**

```typescript
type TrackEvent =
  | 'submission_form_viewed'
  | 'submission_started'            // user selects file or types link
  | 'submission_completed'          // API success
  | 'submission_failed'             // API error
  | 'evaluation_started'            // organizer opens EvaluationPage
  | 'evaluation_saved'
  | 'shortlist_applied'
  | 'results_published'
  | 'leaderboard_viewed'
  | 'create_event_started'
  | 'create_event_quick_mode'
  | 'create_event_full_mode'
  | 'create_event_completed'
  | 'create_event_abandoned';       // route leave before Step 4

export function track(event: TrackEvent, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // No-op until analytics provider is configured.
  // Replace the line below with: analytics.track(event, properties)
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, properties);
  }
}
```

**Call sites:**

| Location | Call |
|----------|------|
| `SubmissionPage` mount | `track('submission_form_viewed', { roundId })` |
| File selected or link typed | `track('submission_started')` |
| Submit success | `track('submission_completed', { roundId, type })` |
| Submit error | `track('submission_failed', { error: e.message })` |
| `EvaluationPage` mount | `track('evaluation_started', { submissionId })` |
| Save evaluation success | `track('evaluation_saved')` |
| Shortlist applied | `track('shortlist_applied', { mode, count })` |
| Results published | `track('results_published', { roundId })` |
| `LeaderboardPage` mount | `track('leaderboard_viewed', { roundId })` |
| `CreateEventPage` mode select | `track('create_event_quick_mode')` or `..._full_mode` |
| Create event success | `track('create_event_completed')` |
| Route leave before Step 4 | `track('create_event_abandoned', { lastStep })` |

Track the `create_event_abandoned` event using a `beforeunload` handler or React Router's
`useBlocker` hook (v7 supports this) to catch mid-form navigation.

---

## 6. Sidebar Restructure
**File: `Frontend/src/config/erpBlueprints.ts` → `MAIN_NAV`**

```
CURRENT:
Competition Platform
  - Events Listings
  - My Events
  - Registered Events
  - Event Attendance
  - Propose New Event

NEW:
Competition Platform
  ▸ Explore Events          → /events
  ▸ My Competitions
      - My Activity         → /events/my-activity
      - My Submissions      → /events/my-submissions
      - My Results          → /events/my-results
  ▸ Organize
      - My Created Events   → /events/my-created
      - Create Event        → /events/create
  ▸ Event Attendance        → /events/attendance   (ERP domain, stays)
  ▸ 🔔 Notifications        → /events/notifications (new, placeholder-ready)
```

---

## 7. Route Map (Complete)
**File: `Frontend/src/main.tsx` + `erpBlueprints.ts`**

```
/events                                                  → EventsListingPage
/events/create                                           → CreateEventPage
/events/my-activity                                      → MyActivityPage
/events/my-submissions                                   → (tab of MyActivityPage)
/events/my-results                                       → (tab of MyActivityPage)
/events/my-created                                       → MyCreatedEventsPage
/events/attendance                                       → EventAttendancePage (existing ERP)
/events/notifications                                    → NotificationsPage (new)

/events/:eventId                                         → EventDetailPage (wrapped in EventProvider)
/events/:eventId/submit/:roundId                         → SubmissionPage (uses useEvent())
/events/:eventId/my-results/:roundId                     → MyResultsPage (uses useEvent())
/events/:eventId/leaderboard/:roundId                    → LeaderboardPage (new)

/events/:eventId/manage                                  → OrganizerDashboard (uses useEvent())
/events/:eventId/manage/rounds/:roundId/submissions      → SubmissionListPage
/events/:eventId/manage/rounds/:roundId/submissions/:id/evaluate  → EvaluationPage
/events/:eventId/manage/rounds/:roundId/shortlist        → ShortlistPage
```

All `/events/:eventId/*` routes are children of the `<EventProvider>` wrapper so context is
shared. The manage subtree uses `<OrganizerGuard>` inside components, not at route level.

---

## 8. Page Specifications

---

### 8.1 `EventsListingPage.tsx`
**Route: `/events`**
**API: `GET /api/events` with filter params**

#### Layout
```
┌─ Page header ─────────────────────────────────────────────────┐
│  Events                              [+ Create Event]         │
│  [Total: N]  [Upcoming: N]  [Live: N]  [Competitions: N]      │
└───────────────────────────────────────────────────────────────┘

┌─ Filter bar ──────────────────────────────────────────────────┐
│  [Search]  [Category ▾]  [Status ▾]  [Type ▾]  [☐ Competitions only]  [Sort ▾]
└───────────────────────────────────────────────────────────────┘

┌─ Events grid (2-col desktop, 1-col mobile) ───────────────────┐
│  <CompetitionEventCard />  <CompetitionEventCard />           │
│  ...                                                          │
└───────────────────────────────────────────────────────────────┘
```

**Loading state:** `<SkeletonCard />` × 4 in a 2-col grid. No spinner.

**Empty state:** `<EmptyState>` with context-aware description (see §5.11).

**Filter state:** All filters are URL params via `useSearchParams`. Shareable and browser-back navigable.

**Mobile:** Single column, full-width cards. Filter bar collapses into a "Filters" button
that opens a bottom sheet (use shadcn Sheet component). The bottom sheet contains all
filter controls, with "Apply" and "Reset" buttons.

---

### 8.2 `EventDetailPage.tsx`
**Route: `/events/:eventId`**
**Context: `useEvent()` — no direct API call in this component**

#### Role Detection
```typescript
const { event, config, userState } = useEvent();
// userState.role is 'visitor' | 'participant' | 'organizer'
// No local role computation — trust userState
```

#### Full Page Layout

```
┌─ Breadcrumb ──────────────────────────────────────────────────┐
│  ← Back to Events                                             │
└───────────────────────────────────────────────────────────────┘

┌─ Hero section ────────────────────────────────────────────────┐
│  [StatusBadge phase]  [Category]                              │
│                                                               │
│  Event Title                                  [Manage →]      │
│  (organizer-only: link to /manage)                            │
│                                                               │
│  Short description                                            │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Starts   │ │ Ends     │ │ Venue    │ │ RSVPs    │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└───────────────────────────────────────────────────────────────┘

┌─ Sticky action bar (IntersectionObserver on hero) ────────────┐
│  [Register / Cancel]  [Add to Calendar]                       │
│  [Submit Work — Round N]  (if canSubmit)                      │
│  [View My Results]  (if resultsPublished for any round)       │
└───────────────────────────────────────────────────────────────┘

┌─ Tab bar ─────────────────────────────────────────────────────┐
│  [Overview]  [Rounds]  [Timeline]  [FAQ]  [Leaderboard]       │
│  (Rounds, Leaderboard only shown if isCompetition)            │
│  (FAQ hidden if no FAQs)                                      │
│  (Leaderboard hidden if no results published yet)             │
└───────────────────────────────────────────────────────────────┘
```

**Sticky action bar:** `IntersectionObserver` on hero. When hero exits viewport, action bar
gets `position: sticky; top: 0; z-index: 10; background: var(--comp-surface);
border-bottom: 1px solid var(--comp-border)`.

**Mobile:** Hero stat boxes become a horizontal scroll strip. Sticky action bar has a
single primary CTA button (full width) + a "⋯" overflow menu for secondary actions.

#### Tab: Overview
Empty sections are hidden entirely. No "Not specified" text anywhere.

#### Tab: Rounds (competition only)
```
[SubmissionStatusBanner if participant and round active]
[RoundStatusCard for each round — receives roundState from userState.roundStates[i]]
```

Multi-round gating: if `roundState.isBlocked`, the card shows `roundState.blockReason`
and disables the submit CTA.

#### Tab: Timeline
```
● Event Start        Sat, 11 Apr 2026 10:00 AM
● Round 1 Deadline   Sat, 11 Apr 2026 8:00 PM
● Round 2 Deadline   Wed, 15 Apr 2026 11:59 PM
● Event End          Sun, 12 Apr 2026 6:00 PM
```
Green dot = past. Amber = current/next. Gray = future. Past labels get muted styling.

#### Tab: FAQ
Accordion. If no FAQs, tab is hidden entirely.

#### Tab: Leaderboard (competition only, results published)
Links to `/events/:eventId/leaderboard/:roundId`. Only shown after at least one round has
`resultsPublished = true`.

---

### 8.3 `CreateEventPage.tsx`
**Route: `/events/create`**
**API: `POST /api/events`**

Multi-step form with 4 steps. Adds **Quick Mode** to reduce drop-off.

#### Mode Toggle (Before Step 1)
```
┌──────────────────────────────────────────────────────────────┐
│  How do you want to set up your event?                       │
│                                                              │
│  ○ Quick Mode                                                │
│    Single round · Basic fields only · 2 minutes             │
│                                                              │
│  ○ Full Setup                                                │
│    Multi-round · Prizes · FAQ · Full competition config      │
└──────────────────────────────────────────────────────────────┘
```

**Quick Mode** (new): Collapses to a single-page form with only required fields:
Title, Description, Category, Start/End DateTime, Venue. No steps, no round builder.
Submits with `isCompetition: false`. The organizer can convert to competition later from
the manage page.

**Full Setup** keeps the existing 4-step flow below.

#### Step Indicator
```
① Basic Info  →  ② Timing & Location  →  ③ Competition Setup  →  ④ Preview & Submit
```

Steps are not directly clickable. Use Next/Back buttons only.

**Active competition limit check:** On page load in Step 3, if `activeCount >= 3`, show:
```
⚠ You have 3 active competitions (limit: 3).
  Archive one at /events/my-created before configuring this as a competition.
```
The "Enable Competition" toggle is disabled until the user falls below the limit.

#### Step 1: Basic Info
- **Title** — required, `maxLength={100}`, character counter
- **Description** — required, `maxLength={2000}`, character counter
- **Department** — select dropdown
- **Category** — Technical / General / Cultural / Sports / Other
- **Type** — Hackathon / Case Study / Quiz / Workshop / Paper Presentation / Seminar / Other

#### Step 2: Timing & Location
- **Start/End DateTime** — datetime-local inputs, inline validation (end > start)
- **Location / Venue** — text input
- **Max Capacity** — number input, optional
- **Prizes** — textarea, optional
- **Eligibility** — textarea, optional

#### Step 3: Competition Setup
Toggle: "Configure as Competition" (disabled if at active limit).

If OFF: Rules textarea + FAQ textarea. Proceed to Step 4.

If ON: Full round builder (existing spec). Each round block is keyboard-accessible
(Tab to move between fields, Enter to confirm, Esc to cancel remove confirmation).

**Progressive complexity hint:** Shown immediately below the competition toggle when
first switched ON:
```
┌──────────────────────────────────────────────────────────────┐
│  💡 Start simple — you can always add more rounds later.     │
│  One round with one evaluation criterion is enough to ship.  │
│  [Start with Round 1 only ↓]                                 │
└──────────────────────────────────────────────────────────────┘
```
Clicking "Start with Round 1 only" pre-populates one round with sensible defaults
(deadline = event end time, maxResubmissions = 5, one criterion "Overall" / 30 points)
and collapses the round builder to just that one round with a "+ Add more rounds" expander
below. This keeps Step 3 manageable for first-time organizers while preserving full power
for experienced ones.

#### Step 4: Preview & Submit
Read-only preview matching `EventDetailPage` layout. Edit shortcuts for each step.
Visibility toggle: Creator only (draft) vs Public.

**Error handling:** If `429` with "3 active competitions" → inline error at top of Step 3.
Network failure on submit → `<ErrorMessage onRetry={handleSubmit}>`. Input is preserved.

---

### 8.4 `MyActivityPage.tsx`
**Route: `/events/my-activity`**

Three tabbed sections. Tab selection is a URL param (`?tab=registered|submissions|results`).

**Tab 1: Registered Events**

Loading: `<SkeletonCard />` × 3.
Empty: "No registered events yet." + "Explore Events" button.

Each card shows per-round submission status pills from `userState.roundStates`. These are
derived from `getEventUserState()` — no local computation.

**Tab 2: My Submissions**
Loading: `<SkeletonTable rows={5} />`.
Empty: "No submissions yet."

**Tab 3: My Results**
Loading: `<SkeletonCard />` × 2.
Empty: "No results published yet."

---

### 8.5 `MyCreatedEventsPage.tsx`
**Route: `/events/my-created`**
**API: `GET /api/events?myEvents=true`**

Table view. Active competition count indicator:
```
⚠ You have 2 of 3 active competitions.
```
At limit: red banner + disabled [+ Create Event] button.

Loading: `<SkeletonTable rows={5} />`.
Empty: `<EmptyState title="No events created yet" action={{ label: "Create your first event", onClick: ... }}>`.

**Performance:** Table is paginated at 20 rows. Use `useMemo` to sort client-side without
re-fetching. If total > 100, switch to server-side pagination.

---

### 8.6 `SubmissionPage.tsx`
**Route: `/events/:eventId/submit/:roundId`**
**Context: `useEvent()` for round config; separate API call for submission status**

#### State Machine (5 states — sourced from `userState.roundStates[roundId]`)

1. **Not registered** (`role === 'visitor'`): "Register first" lock state
2. **Blocked** (`roundState.isBlocked`): "🔒 [blockReason]" lock state
3. **Deadline passed, no submission** (`submissionState === 'locked'` AND no file): locked
4. **Open, no prior submission** (`submissionState === 'none'`): full form, "Submit Work"
5. **Open, has prior submission** (`submissionState === 'submitted'`): form pre-populated,
   "Resubmit (N of maxResubmissions)"

**Never compute state locally.** Read `roundState` from `userState`.

#### Layout (2-col desktop, 1-col mobile)

```
LEFT (2/3 desktop, full-width mobile):
  Instructions
  EvaluationCriteriaTable (readOnly)
  ─────────────────────────────────
  SubmissionStatusBanner
  Submit Your Work
  Type: [● File]  [○ Link]
  FileUploadZone OR link input
  Description (500 chars)
  [Submit / Resubmit button]

RIGHT (1/3 desktop, hidden on mobile → accessible via "Rules" accordion):
  Large countdown
  Submission Rules
  Previous Submission (if any)
```

**Mobile:** The right sidebar collapses into a collapsible "Submission Rules" accordion
above the form. Deadline countdown moves into the round header, prominent.

#### Upload flow
1. File selected → `FileUploadZone` shows preview (no upload yet)
2. Submit clicked → multipart POST
3. During upload → button disabled, `FileUploadZone` isUploading=true
4. Success → same page, banner shows "submitted" state
5. Error → `<ErrorMessage>` inline, file input preserved (user doesn't re-select)

**Error UX:**
- API `403` deadline passed mid-submit → amber full-width banner, form locks
- API `429` resubmission limit → gray banner, form locks
- Network failure → `<ErrorMessage onRetry preservedInput>` below button

---

### 8.7 `MyResultsPage.tsx`
**Route: `/events/:eventId/my-results/:roundId`**
**API: `GET /api/competitions/:eventId/rounds/:roundId/my-result`**

#### Before Results Published
```
┌──────────────────────────────────────────────────────────┐
│  🔒 Results Not Yet Published                            │
│  The organizer hasn't published results yet.            │
│  You'll be notified when they do.                       │
│  Your submission: [filename] • submitted [date]          │
└──────────────────────────────────────────────────────────┘
```

#### After Published — Shortlisted
Score breakdown bars animate from 0 → percentage over 600ms on mount.

```
🏆 You've Been Shortlisted!
Round N — [Event Name]

Criteria          Score  Max   Bar
Innovation          8    10   [████████░░]
Implementation      7    10   [███████░░░]
Presentation        9    10   [█████████░]
─────────────────────────────────────
Total              24    30

Rank: #3
Decision: ✓ Selected
Remarks: [text]
```

#### After Published — Not Selected
Same layout, no 🏆 banner, "— Not Selected" decision. Score + rank still shown.

#### Not Evaluated
Plain message: "Your submission was received but was not evaluated before results were published."

---

### 8.8 `LeaderboardPage.tsx` (New)
**Route: `/events/:eventId/leaderboard/:roundId`**
**API: `GET /api/competitions/:eventId/rounds/:roundId/submissions` (organizer)**
**     `GET /api/competitions/:eventId/rounds/:roundId/my-result` (participant)**

**Only visible after `resultsPublished = true` for this round.**

```
┌─ Leaderboard ─────────────────────────────────────────────────┐
│  Round 1 — Preliminary          [Event Name]                  │
│  [Results published N hours ago]                              │
└───────────────────────────────────────────────────────────────┘

┌─ Your Result (if participant) ────────────────────────────────┐
│  Your rank: #12  Score: 22/30  Decision: Not Selected         │
└───────────────────────────────────────────────────────────────┘

┌─ Rankings ────────────────────────────────────────────────────┐
│  Rank  |  Register No.  |  Score  |  Decision                 │
│   1    |  AP21110010    |  28/30  |  ✓ Shortlisted            │
│   2    |  AP21110025    |  26/30  |  ✓ Shortlisted            │
│   …                                                           │
│  12    |  AP21110088*   |  22/30  |  — Not Selected  ← You   │
│   …                                                           │
└───────────────────────────────────────────────────────────────┘
```

**Visibility rules:**
- Scores are shown for all participants after publish.
- Register numbers are shown as-is (internal platform, no anonymization needed for now).
- An optional toggle "Anonymize others" lets participants hide others' register numbers
  (replaces with AP\*\*\*\*). Their own row is always fully shown.

**Organizer view:** Same table with full register numbers, plus a link to evaluate any
submission from the table (re-uses `EvaluationPage` nav state).

**Loading:** `<SkeletonTable rows={10} />`.
**Empty:** Should not occur if properly gated (only navigable after publish).

---

### 8.9 `OrganizerDashboard.tsx`
**Route: `/events/:eventId/manage`**
**Context: `useEvent()` — event + config from provider**
**API: Per-round submission counts fetched inside this component**

Wrap in `<OrganizerGuard>`. Uses `userState.canEdit`, `userState.canEvaluate`,
`userState.canShortlist` — never local role computation.

#### Layout
```
┌─ Breadcrumb ──────────────────────────────────────────────────┐
│  ← [Event Name]                          [View Public Page]   │
│  Organizer Dashboard                                          │
└───────────────────────────────────────────────────────────────┘

┌─ Stats row ───────────────────────────────────────────────────┐
│  [Registrations: N]  [Submissions: N/M]                       │
│  [Evaluated: N/M]    [Results: Published / Pending]           │
└───────────────────────────────────────────────────────────────┘

┌─ Rounds ──────────────────────────────────────────────────────┐
│  [RoundStatusCard for each round — organizer mode]            │
└───────────────────────────────────────────────────────────────┘

┌─ Participants ─────────────────────────────────────────────────┐
│  [Search] [Export CSV]                                        │
│  Reg No. | Registered At | R1 status | R2 status | ...        │
└───────────────────────────────────────────────────────────────┘

┌─ Actions ─────────────────────────────────────────────────────┐
│  [📢 Broadcast Announcement]  [✎ Edit Event]  [🗄 Archive]    │
│                                                               │
│  [AuditHistoryPanel — round-level events]                     │
│  Shortlist applied at… / Results published at… per round      │
└───────────────────────────────────────────────────────────────┘
```

**Empty states:**
- No registrations: "No registrations yet." in the participants table.
- No submissions for a round: `RoundStatusCard` shows "No submissions received yet."
  below its stat row.
- No rounds configured: "This event has no competition rounds configured." with link to
  edit event.

**Performance:**
- Participant table is paginated at 20 rows.
- Round columns are memoized — `useMemo` on `config.rounds.map(...)`.
- Stat cards use server-returned counts — never compute from raw submission list.

**Mobile:** Stats row becomes a 2×2 grid. Participant table collapses to card view
(one card per registrant, showing their submission status per round). Export CSV button
moves to a floating action button (FAB).

---

### 8.10 `SubmissionListPage.tsx`
**Route: `/events/:eventId/manage/rounds/:roundId/submissions`**

Wrap in `<OrganizerGuard>`.

#### Layout
```
┌─ SummaryStatBar ──────────────────────────────────────────────┐
│  42 total  |  30 evaluated  |  12 pending  |  2 flagged       │
└───────────────────────────────────────────────────────────────┘

[If pending > 0 and shortlist not yet applied]:
⚠ 12 submissions haven't been evaluated. They won't be included in shortlisting.

┌─ Filter + Sort ───────────────────────────────────────────────┐
│  [All / Pending / Evaluated / Flagged]  [Sort: Date / Score]  │
└───────────────────────────────────────────────────────────────┘

┌─ Table ───────────────────────────────────────────────────────┐
│  Reg No. | Submitted At | Resubs | Type | Status | Score | Actions │
└───────────────────────────────────────────────────────────────┘

[Go to Shortlist →]
```

**Empty state (no submissions):**
```
<EmptyState
  title="No submissions yet"
  description="Submissions will appear here once participants start submitting."
/>
```

**Row tinting:** Flagged rows → `#fff5f5`. Evaluated rows → `#f0fdf4`.

**Pagination:** 20 per page. Organizers need total counts, so no infinite scroll.

**Performance:** Virtualize rows when count > 100 using `@tanstack/react-virtual`.

**Mobile:** Table collapses to a card list. Each card shows register number, status badge,
score, and action buttons stacked vertically.

---

### 8.11 `EvaluationPage.tsx`
**Route: `/events/:eventId/manage/rounds/:roundId/submissions/:id/evaluate`**

Wrap in `<OrganizerGuard>`.

#### Layout (Split Panel)
```
┌─ Navigation bar ──────────────────────────────────────────────┐
│  ← Submission List    [← Prev]  3 of 42  [Next →]            │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────┬───────────────────────────────────┐
│  LEFT (60%)             │  RIGHT (40%)                      │
│                         │                                   │
│  Submission by: AP...   │  Scoring                         │
│  Submitted: [date]      │  [EvaluationCriteriaTable edit]  │
│  Resubmissions: N       │                                   │
│                         │  Remarks: [textarea]             │
│  [PDF embed OR link     │                                   │
│   card OR download]     │  Decision:                       │
│                         │  ○ Selected  ○ Rejected          │
│  Description:           │  ○ Undecided                     │
│  [text]                 │                                   │
│                         │  ☐ Flag  [reason input]          │
│                         │                                   │
│                         │  [Save Evaluation]               │
│                         │  (disabled until all scored)     │
│                         │                                   │
│                         │  [error if save failed]          │
│                         │                                   │
│                         │  [AuditHistoryPanel]             │
│                         │  (evaluatedBy + evaluatedAt)     │
└─────────────────────────┴───────────────────────────────────┘
```

**Conflict of interest:** If `submission.submittedBy === currentUserId`, disable entire
right panel and show: "🚫 You cannot evaluate your own submission."

**Auto-save confirmation:** Unsaved scores + Prev/Next click →
"[Save and Continue] [Discard and Continue] [Stay]"

**Error UX on save failure:** `<ErrorMessage>` inline below "Save" button. Scores remain
in component state so the organizer doesn't lose their work.

**Mobile:** Stack panels vertically. Submission viewer on top, scoring form below.
Prev/Next nav becomes a sticky bottom bar.

**Accessibility:** `aria-live="polite"` on the score total so screen readers announce
updates. Save button `aria-disabled={!allScored}` rather than `disabled` prop (so it's
still focusable and explains why it's inactive via `title`).

---

### 8.12 `ShortlistPage.tsx`
**Route: `/events/:eventId/manage/rounds/:roundId/shortlist`**

Wrap in `<OrganizerGuard>`.

#### Layout
```
┌─ Info banner ─────────────────────────────────────────────────┐
│  Showing 30 evaluated submissions.                            │
│  ⚠ 12 unevaluated submissions are excluded.                  │
└───────────────────────────────────────────────────────────────┘

┌─ Mode selector ───────────────────────────────────────────────┐
│  ○ Top N:        [20] submissions                             │
│  ○ Score Threshold: minimum [  ] points                       │
│  Preview: 20 submissions will be shortlisted                  │
└───────────────────────────────────────────────────────────────┘

┌─ Ranked table ────────────────────────────────────────────────┐
│  Rank | Reg No.    | Score | Submitted At | [Highlight]       │
│   1   | AP21110010 | 28/30 | Apr 11, 6PM  | ✓ Selected        │
│  21   | AP21110099 | 18/30 | Apr 11, 8PM  | — Not Selected    │
└───────────────────────────────────────────────────────────────┘

┌─ Actions ─────────────────────────────────────────────────────┐
│  [Apply Shortlist]                                            │
│  (after applied:)                                             │
│  [✓ Shortlist Applied]  →  [Publish Results]                 │
└───────────────────────────────────────────────────────────────┘
```

Live preview is client-only — no API call on every Top N change.

**Apply Shortlist** → confirmation modal → `POST .../shortlist`.
**Publish Results** → confirmation modal → `POST .../publish` → success banner →
navigate to `/events/:id/manage` after 2 seconds.

**Undo / Recovery design:** Both actions are irreversible on the backend. However, the
frontend provides a grace window:

- **After Apply Shortlist:** The "Publish Results" button is shown separately and
  requires a second deliberate action. This is the real undo opportunity — the organizer
  can re-apply shortlist with different settings before publishing.

- **After Publish Results:** Show a 30-second countdown banner:
  ```
  ✓ Results published. Participants have been notified.
  If you published in error, contact support immediately.
  [Close]
  ```
  There is no "undo publish" button — the backend does not support it and participants
  have already been notified. The message sets expectations honestly. If the backend later
  adds a re-publish override (e.g., changing scores post-publish), expose it here as
  "Re-publish with updated results" — a separate, clearly labeled action.

**Error on Apply failure:** Modal closes, `<ErrorMessage>` shown below actions, ranked
list unchanged (user can retry).

**Mobile:** Ranked table collapses to cards (rank + register number + score + highlight).

---

## 9. API Layer
**File: `Frontend/src/lib/competitionsApi.ts`**

```typescript
// Types
interface CompetitionRound {
  roundId: string;
  title: string;
  type: string;
  startTime: string | null;
  submissionDeadline: string;
  instructions: string;
  submissionTypes: ('file' | 'link')[];
  maxFileSizeMb: number;
  maxResubmissions: number;
  evaluationCriteria: { label: string; maxScore: number }[];
  shortlistCount: number | null;
  shortlistThreshold: number | null;
  requiresShortlistFromRound: string | null;
  resultsPublished: boolean;
}

interface CompetitionConfig {
  isCompetition: true;
  submissionScope: 'individual';
  rounds: CompetitionRound[];
}

interface BackendPermissions {
  canEdit: boolean;
  canEvaluate: boolean;
  canShortlist: boolean;
}

interface Submission {
  id: string;
  eventId: string;
  roundId: string;
  submittedBy: string;
  type: 'file' | 'link';
  filePath?: string;
  linkUrl?: string;
  description?: string;
  submittedAt: string;
  resubmissionCount: number;
  criteriaScores?: Record<string, number>;
  totalScore?: number;
  remarks?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  decision?: 'selected' | 'rejected' | 'pending' | null;
  shortlisted: boolean;
  flagged: boolean;
  flagReason?: string;
}

interface EventDetail {
  // ... existing fields ...
  permissions?: BackendPermissions;   // new: backend-driven access flags
}

// API functions
async function getMySubmission(eventId: string, roundId: string): Promise<Submission | null>
async function getMyResult(eventId: string, roundId: string): Promise<Submission | null>
async function submitWork(eventId: string, roundId: string, formData: FormData): Promise<Submission>
async function getSubmissionsForRound(eventId: string, roundId: string): Promise<Submission[]>
async function evaluateSubmission(
  eventId: string, roundId: string, submissionId: string,
  payload: { criteriaScores: Record<string, number>; totalScore: number; remarks: string; decision: string }
): Promise<Submission>
async function flagSubmission(eventId: string, roundId: string, submissionId: string,
  payload: { flagged: boolean; flagReason?: string }): Promise<void>
async function applyShortlist(eventId: string, roundId: string,
  payload: { mode: 'topN' | 'threshold'; value: number }): Promise<void>
async function publishResults(eventId: string, roundId: string): Promise<void>
async function getCompetitionConfig(eventId: string): Promise<CompetitionConfig | null>
```

All functions use `fetch` with `credentials: 'include'`. All handle `401` by calling
`handleSessionAuthFailure()`. All handle `403` by returning a typed `PermissionError` that
calling components can distinguish from generic errors.

---

## 10. Implementation Order

### Week 1: Foundation + State Layer
1. Fix the `undefined` bug everywhere
2. Add CSS variables (surfaces, status, spacing tokens) to `styles.css`
3. Add dark mode equivalents for all new variables
4. Create `eventPhase.ts` with `getEventPhase()` and phase → label mapping
5. Create `eventUserState.ts` with `getEventUserState()`
6. Create `EventContext.tsx` with `EventProvider`, `useEvent()`, `useSubmissions()`
7. Build all shared components (§5.1–§5.13): StatusBadge, DeadlineCountdown,
   RoundStatusCard (stateless), CompetitionEventCard, SubmissionStatusBanner,
   EvaluationCriteriaTable, FileUploadZone, OrganizerGuard, SummaryStatBar,
   ErrorMessage, EmptyState, NotificationToast (placeholder), SkeletonCard/Table
8. Create `competitionsApi.ts` with all types and functions
9. Update sidebar nav in `erpBlueprints.ts`
10. Add `eventPhase.ts` to `erpBlueprints.ts` route registrations
11. Wire `EventProvider` into all `/events/:eventId/*` routes in `main.tsx`

### Week 2: Discovery + Event Detail + Create
12. Redesign `EventsListingPage` — new cards, filter bar (URL params), skeleton loading,
    mobile filter bottom sheet
13. Rebuild `EventDetailPage` — uses `useEvent()`, phase-driven tabs, sticky action bar,
    Leaderboard tab (gated), mobile hero
14. Build `CreateEventPage` — Quick Mode + Full Setup, 4-step form, round builder,
    active limit check at Step 3, proper error handling

### Week 3: Participant Flow
15. Build `SubmissionPage` — reads state from `useEvent()`, file upload with error UX,
    mobile sidebar collapse, all 5 state machine states
16. Build `MyResultsPage` — locked state + published state with animated score bars
17. Build `MyActivityPage` — 3 tabs with URL param, all empty + loading states
18. Build `MyCreatedEventsPage` — active limit indicator, table with pagination
19. Build `LeaderboardPage` — post-publish rankings, "You" row highlight, anonymize toggle

### Week 4: Organizer Flow
20. Build `OrganizerDashboard` — uses `userState.canEdit/canEvaluate/canShortlist`,
    round cards with empty states, paginated participant table, mobile card view
21. Build `SubmissionListPage` — virtualized table > 100 rows, mobile card collapse,
    all empty + error states
22. Build `EvaluationPage` — split panel, prev/next nav with unsaved-changes guard,
    conflict-of-interest check, mobile stacked layout
23. Build `ShortlistPage` — client-only live preview, apply + publish flow with modals,
    error handling that preserves ranked list

### Week 5: Polish + Audit
24. Add `aria-label`, `aria-live`, `role`, `tabIndex` to all interactive elements
25. Keyboard navigation audit: Tab order through forms, Enter/Space on cards, Esc on modals
26. Responsive audit at 768px and 375px — ensure mobile layouts for every page
27. Dark mode audit — every page at `data-theme="dark"`
28. Performance audit — check for N+1 renders, add `useMemo`/`useCallback` where needed
29. Add `react-virtual` to SubmissionListPage if count > 100 rows
30. Full end-to-end flow test: create → register → submit → evaluate → shortlist
    → publish → view results → leaderboard

---

## 11. Critical Invariants (Never Violate These)

1. **Frontend never decides result visibility.** If `criteriaScores` is null in the API
   response, render nothing. Never gate on a local `resultsPublished` variable.

2. **All deadline enforcement is API-side.** The countdown is informational only. Never
   disable submit based on client-side time — let the API return `403` and show its message.

3. **OrganizerGuard checks both `createdBy` AND `coOrganizers`.** If `event.permissions`
   is present, trust it over local computation.

4. **`getEventUserState()` is the single source of truth for role and round state.** No
   page or component computes `isOrganizer`, `canSubmit`, or `submissionState` independently.

5. **`EventProvider` fetches event + config once per route mount.** Child components use
   `useEvent()`. No page inside `/events/:eventId/*` makes its own event API call.

6. **Polling is passive.** The 20-second refetch only fires when `!document.hidden`. Never
   poll on hidden tabs. Always clean up intervals on unmount.

7. **Errors are inline, successes are toasts.** Never show a toast for an error that
   requires user action. Never show an inline error for a success confirmation.

8. **FileUploadZone validates MIME types client-side as UX only.** Show client-side error
   for immediate feedback, but always show the API error too — the API error is authoritative.

9. **Prev/Next in EvaluationPage navigates the same filtered/sorted order as SubmissionListPage.**
   Pass `{ submissionIds, currentIndex }` via router navigation state.

10. **ShortlistPage live preview is always client-only.** Call the API only on "Apply Shortlist"
    confirm. Never call the API on Top N input change.

11. **The "3 active competitions" check happens at Step 3 of CreateEventPage**, fetched on
    page load, so the user is warned before filling the entire form. Do not wait for POST to
    fail with `429`.

12. **All spacing uses design tokens** (`--space-xs` through `--space-2xl`). No hardcoded
    pixel values in competition component styles.
