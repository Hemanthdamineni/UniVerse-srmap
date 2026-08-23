# React Query Migration Plan

**Status:** Implementation in progress — **Phase 0 ✅ and Phase 1 ✅ shipped & validated 2026-08-23** (tsc/lint/build clean; 95 files / 1161 tests green; devtools confirmed absent from prod bundle). Phases 2–6 not started.
**Scope:** `Frontend/src` server-state fetching and mutations.
**Baseline verified 2026-08-22:** `@tanstack/react-query@^5.85.0` installed; `QueryClientProvider` already wraps the app (`AppProviders.tsx` → `lib/core/queryClient.ts`: `staleTime` 30s, `gcTime` 5m, `retry: 1`, mutation retry 0, `refetchOnWindowFocus: false`); **zero** `useQuery`/`useMutation` usages exist.

---

## 1. Current state (verified inventory)

### 1.1 Loading patterns

| # | Pattern | Abstraction | Call sites | Notes |
|---|---------|-------------|-----------|-------|
| P1 | `useAsyncPage(loader, deps)` | `pages/LMS/_shared/LmsPageShared.tsx:176` | **33 sites / 23 files**, all LMS | `{ data, setData, loading, error }`; effect + `active` flag; no cache/dedup/retry |
| P2 | `useBlueprintPageData(blueprint, reloadToken)` | `pages/Shared/useBlueprintPageData.ts` | **1 consumer** (`BlueprintPage.tsx`) serving **~63 blueprint routes** | Parallel `loadErpKey` per fetchKey; profile JSON-equality guard; reloadToken = manual refresh |
| P3 | Hand-rolled `useEffect` loaders | inline in ~55 page files | Dashboard 4 fetchers · ERP 18 pages + 3 derived components · Events ~12 · Career ~13 · Helpdesk 3 · Admin 6 own-fetching (+ thin wrappers with none) · AcademicTracker 5 · Feedback 3 · Profile 1 · LMS 1 | Canonical `useState` trio + effect; variants: debounced search (OpportunitiesPage, FilterBar), refresh counters (`tick`, `refreshTrigger`, `reloadToken`) |
| P4 | Fetching contexts | `contexts/EventContext.tsx`, `contexts/AdminModeContext.tsx` | EventContext consumed across all event workflow pages | eventCache TTL map + phase-adaptive polling (LIVE 10s / EVALUATION 15s / else 30s) + snapshot diffing; AdminModeContext holds admin password in ref |

Non-server-state (excluded): `ToDo.tsx` (localStorage), `WeekCalendar`/`Schedule`/`Attendance`/`InternalMarks` (props-derived computation), admin static pages (AuditLogs, CertTemplates, SystemControls), form-only shells (EventsFeedback, HostelMessFeedback, TransportFeedback), `prototypeEventState.ts` (localStorage-backed mutable prototype state).

### 1.2 Mutations (~110 lib-level mutators, 8 domains)

All HTTP mutations live in `src/lib/**`; pages call exported functions. Post-success idioms today:

- **Full list/entity refetch** (dominant) — e.g. LMS interactions re-fetch the whole resource; Helpdesk/Career-admin share a quadruplicated `runAction(action, successText)` helper (TrackEscalate, FAQs, InterviewBooking, AlumniConnect) that mutates then fully reloads.
- **Context-level `refetch()`** — events domain (`EventWorkflowPages.tsx:461,707`, `EventDetailPageNew.tsx:121`) = skip-cache refetch of everything.
- **Optimistic local updates** — `OpportunitiesPage.tsx` bookmark (optimistic set + rollback), `ApplicationTrackerPage.tsx` drag-drop (optimistic + revert). A generic `hooks/useOptimistic.ts` exists but is essentially unadopted.
- **ERP actions** — `executeErpAction` (`lib/erp/api.ts:401`) used by BankDetailsPage save (incl. base64 file) → banner + `refreshTrigger` reload; FeePaidPage receipt print is an imperative side effect, not state.
- **Local prepend** — RaiseTicket prepends the created ticket to its recent list.

### 1.3 Session/auth surface

- Every transport wrapper (`requestUtils.requestJson`, `apiClient.requestData/requestMultipart`, `lib/erp/api.ts`, `competitionsApi.ts`) calls `handleSessionAuthFailure()` on auth rejection → `clearSessionAuth()` + hard `window.location.replace("/login")`. No event bus exists; login messaging uses sessionStorage flags (`consumeSessionExpiredFlag`).
- `fetchSessionProfile()` currently has a hand-rolled 30s TTL + inflight dedup (added 2026-08-22) used by Sidebar, Dashboard, ProfilePage, blueprint hook.
- A 60s visibility-gated heartbeat (`startSessionHeartbeat`) probes session liveness independently of queries.
- Logout path: `clearSessionAuth()` clears storage + profile cache; components re-render via navigation to `/login`.

### 1.4 Backend ERP cache interplay

- `GET /api/scrape/{category}/{page}` returns `{ source: "cache-fresh"|"cache-stale"|"live", policyMode, data }` and headers `x-erp-source`, `x-erp-policy` (currently ignored by the UI).
- Backend policy: **cached-first** default (fresh TTL 60s, stale-serve up to 10min with background refresh, single-flight, circuit breaker); **live-first** for payment/exam-registration pages (always scrapes upstream).
- `?mode=live` force-scrape exists but the UI never sends it; "Try again"/refresh buttons just bump `reloadToken`/`refreshTrigger`.
- Semester marks route uses parameterized keys (`examination/earlier-internal-marks/semester/:n`).

### 1.5 Prototype mode

`isStaticPrototype()` branches live **exclusively inside API modules** (~157 refs, all early-return fixtures). No component branches on it ⇒ **queryFns are byte-identical in both modes; React Query needs zero prototype awareness.** Caveat: `prototypeEventState.ts` is localStorage mutable state used only in prototype builds — not server state.

---

## 2. Goals and non-goals

**Goals**
1. One mental model for server state: dedup, caching, retries, invalidation, polling via React Query instead of ~90 ad-hoc implementations.
2. Kill the duplicate-fetch classes we keep fixing by hand (profile double-fetch, blueprint double-load, N+1 widget fan-outs).
3. Make post-mutation consistency declarative (invalidation) instead of "remember to reload the list".
4. Preserve all current UX contracts: loading skeletons, error strings + retry buttons, manual refresh, prototype mode, polling cadences.

**Non-goals**
- Rewriting the backend or changing any API contract.
- Migrating non-server-state (see §1.1 exclusion list).
- Replacing the session heartbeat or auth redirect mechanics.
- Adopting React Query suspense/promise APIs (`useSuspenseQuery`) in this pass.

---

## 3. Recommended architecture

### 3.1 Layering (no new transport)

```
component/page
   └── useQuery/useMutation            ← new, per feature
         └── lib/<domain>/*Api.ts      ← UNCHANGED queryFn/mutationFn source
               └── requestUtils/apiClient (fetch + ApiError + auth guard)
```

API modules stay the single place where URLs, fixture branching, and response shaping live. React Query never sees `fetch` directly.

### 3.2 Query key catalog (key factories per domain)

Keys live next to their API module as factories so invalidation sites can't drift from reader sites:

```ts
// lib/core/queryKeys.ts (session)
export const sessionKeys = {
  profile: ["session", "profile"] as const,
};

// lib/erp/queryKeys.ts
export const erpKeys = {
  page: (pageKey: string, params?: Record<string, string | number>) =>
    params ? (["erp", pageKey, params] as const) : (["erp", pageKey] as const),
  batch: (pageKeys: string[]) => ["erp", "batch", ...pageKeys] as const,
};

// lib/events/queryKeys.ts — adopts eventCache's documented scheme
export const eventKeys = {
  list: (filters?: Record<string, unknown>) => filters ? ["events", "list", filters] : ["events", "list"],
  detail: (id: string) => ["event", id],
  config: (id: string) => ["event", id, "config"],
  role: (id: string) => ["event", id, "role"],
  submissions: (id: string) => ["event", id, "submissions"],
  myTeams: (id: string) => ["event", id, "my-team"],
  invitations: (id: string) => ["event", id, "invitations"],
};
// analogous factories: careerKeys, lmsKeys, helpdeskKeys, feedbackKeys, adminKeys
```

Rules: arrays-of-segments only; filters objects last (RQ does shallow-compare + hashing); **no volatile values in keys** (no timestamps, no random ids); parametrized ERP keys include the semester number etc.

### 3.3 Cache semantics

Global defaults stay as-is except two corrections:

```ts
// queryClient.ts changes
retry: (failureCount, error) => {
  // Today's retry:1 blindly retries 400s and auth failures.
  if (error instanceof ApiError) return error.retryable && failureCount < 1;
  return failureCount < 1;
},
```

Per-family `staleTime` policy (set at `useQuery` level via small shared option helpers):

| Family | staleTime | Rationale |
|--------|-----------|-----------|
| `['erp', …]` scrape-backed reads | **60_000** (match backend fresh TTL) | The backend *is* the cache authority (fresh 60s / stale 10min + background refresh). Client staleTime > backend fresh window would serve data older than the backend considers fresh; ≤60s keeps client hits inside the backend's fresh envelope. Manual refresh = explicit `refetch()`. |
| `['erp','batch',…]` dashboard batch | 60_000 | Same authority argument. |
| Session profile | 30_000 | Replaces the hand-rolled TTL exactly. |
| Lists (events/career/lms/helpdesk) | 15_000–30_000 | Default 30s is fine; live-ish lists 15s if staleness shows. |
| Event detail/config/role | 60_000 / 120_000 / 60_000 | Mirrors eventCache TTLs verbatim (its documented intent). |
| Reference data (blueprints meta, ui-hints/schema, calendar, faculty cabins) | 600_000+ | Rarely changes within a session. |
| Admin queues/moderation | 0–15_000 | Freshness matters more than snappiness. |
| Mutations | n/a (retry 0) | Already correct. |

`gcTime` stays 5m globally. `structuralSharing` (default on) replaces our manual identity-preservation tricks (the profile JSON-equality guard, EventContext snapshot diffing) — RQ keeps referential identity for unchanged payloads automatically.

### 3.4 Session/auth interaction

- **Centralize death handling**: add `QueryCache`/`MutationCache` `onError` in `queryClient.ts` — if the error is an auth failure (`ApiError` with status 401/`SESSION_EXPIRED` code family), call `handleSessionAuthFailure()` once behind a module-level `redirecting` flag. During migration the per-wrapper guards remain (belt-and-braces); they are removed in the cleanup phase once every caller goes through queries/mutations.
- **Profile**: replace the hand-rolled TTL/dedup in `session.ts` with `useQuery(sessionKeys.profile, fetchProfile, { staleTime: 30_000 })`. Keep exporting `fetchSessionProfile()` (now a plain uncached loader, or backed by `queryClient.ensureQueryData`) during transition so non-hook callers (heartbeat) still work. `clearSessionAuth()` gains a `queryClient.clear()` (or targeted removal of `sessionKeys` + user-scoped families) — this is the one required coupling between auth and the cache.
- **Heartbeat**: untouched. It is a liveness probe, not server state.
- **Admin password**: stays in `AdminModeContext`'s ref. Only `getAdminAccessStatus()` migrates to `['admin', 'access-status']`.

### 3.5 ERP cached-first/live-first interplay

Principles:

1. **The backend remains the freshness authority.** React Query's role for ERP reads is request deduplication, in-flight coalescing, and identity-stable rendering — not long-lived caching. Hence `staleTime ≤ 60s` everywhere ERP (§3.3).
2. **Live-first pages need no special handling.** They always hit upstream anyway; the client cache merely coalesces concurrent mounts within 60s, which is desirable (two components mounting the same fee page shouldn't scrape twice).
3. **Manual refresh maps to `refetch()`**, replacing `reloadToken`/`refreshTrigger` counters. For live-first pages, refetch bypasses nothing extra (backend decides); optionally pass `{ requestKey: Date.now() }`-style key bump only if we later add client-side result memoization beyond staleTime — not planned.
4. **Freshness surfacing (optional, later)**: read `x-erp-source` from responses inside `loadErpKey` and stash `source` alongside data so BlueprintPage can badge "Live ERP" vs "Cached" truthfully instead of deriving it from placeholder heuristics.
5. Never put ERP data in `initialData` from another query without structural sharing — batch and single-page caches may hold different snapshots of the same pageKey; prefer invalidating both after actions.

### 3.6 Polling (EventContext)

Replace the self-rescheduling `setTimeout` chain with:

```ts
useQuery({
  queryKey: eventKeys.detail(eventId),
  queryFn: () => getEvent(eventId),
  refetchInterval: (query) => intervalForPhase(query.state.data?.status),
  // LIVE→10s, EVALUATION→15s, else 30s — same numbers as today
});
```

- Visibility pausing comes free (`refetchIntervalInBackground: false` default ≈ today's `document.hidden` check).
- Snapshot diffing (`lastSnapshotRef`) is deleted — `structuralSharing` gives consumers referentially-stable objects across ticks, which was the entire point of that gate.
- `EventContext` keeps its public API and becomes a thin adapter over 3–4 `useQuery`s (+ `useMutation`s calling `context.refetch()` → `invalidate`). Consumers migrate without touching them; direct-hook adoption can happen opportunistically later.
- `useSubmissions` fan-out becomes one query per round via `useQueries` — eliminating the N sequential-ish requests with built-in dedup.

### 3.7 Prototype mode

Nothing to do by design (§1.5). One guard: do not "helpfully" move `isStaticPrototype()` checks up into hooks/pages during migration — fixtures must stay behind the API-module boundary.

---

## 4. Pattern-by-pattern mapping

| Existing | Becomes | Effort |
|----------|---------|--------|
| `useAsyncPage(loader, deps)` | Rewrite the hook body as a `useQuery` adapter keeping the exact signature/return (`data, setData*, loading, error`). `setData` maps to optimistic `setQueryData` for the few callers using it post-mutation. 33 sites migrate with zero page edits; pages can be inlined to real `useQuery` later opportunistically. | Low |
| `useBlueprintPageData` | Internal rewrite to `useQueries` (one query per fetchKey under `erpKeys.page(k)`), keeping the returned `BlueprintPageState` shape identical. `reloadToken` prop → optional `refetchKey` that triggers `refetch()`. All ~63 routes convert at once. | Medium |
| Hand-rolled loaders (~55 files) | File-by-file conversion in domain phases (§7). Standard recipe: `useState` trio → `useQuery(key, fn, opts)`; `loading` → `isLoading`; `error: string` → derive `error instanceof Error ? error.message : String(error)` via a tiny `toErrorMessage()` helper to keep UI contracts. | Bulk |
| Dashboard triple-fetch gate | Three independent `useQuery`s; each widget renders off its own query — removes the "blank until slowest of three" behavior as a free win (verify tests don't assert the blocking skeleton). | Medium |
| `runAction` helper ×4 | Shared `useApiMutation({ mutationFn, successMessage, invalidateKeys })` wrapper producing the same toast/banner UX. Delete the four copies. | Low |
| `useOptimistic` custom hook | Superseded by `useMutation.onMutate` cancel+patch+rollback pattern. Keep until career phase lands, then delete. | — |
| `eventCache.ts` | Deleted at end of events phase — its key/TTL table (§3.2/§3.3) is absorbed into `eventKeys` + options. | — |

## 5. Mutation & invalidation strategy

Standard pattern:

```ts
const qc = useQueryClient();
const save = useMutation({
  mutationFn: updateHelpdeskTicket,
  onSuccess: (updated) => {
    qc.setQueryData(helpdeskKeys.ticket(updated.id), updated);      // write truth
    qc.invalidateQueries({ queryKey: helpdeskKeys.tickets() });     // refetch lists
  },
  onError: (e) => notify(toErrorMessage(e), "warning"),
});
```

Domain invalidation matrix (high-frequency cases):

| Action | Invalidate |
|--------|-----------|
| `registerForEvent` / cancel | `eventKeys.detail(id)`, `eventKeys.list()`, `["events","mine"]` |
| Team create/delete/invite/respond | `eventKeys.myTeams(id)`, `eventKeys.invitations(id)`, `eventKeys.detail(id)` |
| Submission submit/rescore/flag | `eventKeys.submissions(id)` (+ round-scoped key), `eventKeys.detail(id)` |
| Role assign/remove | `eventKeys.role(id)` |
| `bookmarkOpportunity` / unbookmark | optimistic patch on active `careerKeys.opportunities(filters)` lists + `careerKeys.bookmarks()` invalidate |
| Application create/status-move (tracker drag-drop) | optimistic patch `careerKeys.applications(filters)`; reconcile from server response |
| Opportunity create/update/delete/review (admin) | `careerKeys.opportunities()`, `careerKeys.stats?.()` if cached |
| Interview slot/booking CRUD | `careerKeys.interviewSlots(...)`, `careerKeys.interviewBookings(...)` |
| Alumni CRUD | `careerKeys.alumni(filters)` |
| LMS toggle upvote/bookmark/rate/outdated | optimistic patch `lmsKeys.resource(id)`; invalidate `lmsKeys.resources(filters)` lists |
| LMS comment/annotation/helpful | patch/invalidate `lmsKeys.resource(id)` subkeys |
| Request board create/upvote/close | `lmsKeys.requests(filters)` |
| Resource/guide/roadmap CRUD | owning list key + detail key |
| Quiz attempt / revision review / preferences | `lmsKeys.progress*`, `lmsKeys.revisionQueue()` |
| Learning-material item CRUD / bulk execute | the hook's selection keys (catalog stays; subjects/library/adminItems invalidate) |
| Ticket create/update/escalate/bulk | `helpdeskKeys.tickets(queueFilter)`; create also `setQueryData` prepend to recent list |
| FAQ CRUD | `helpdeskKeys.faqs()` |
| Campus/end-sem feedback submit | `feedbackKeys.status()` (dashboard badge), local confirmation |
| Moderation queue actions | `adminKeys.campusFeedbackQueue()` / `adminKeys.lmsModerationQueue()` |
| ERP action (bank-details save) | invalidate `erpKeys.page("finance/bank-details")` (+ anything listing bank status) |
| Login/logout | logout: `queryClient.clear()` after redirect decision |

Optimistic updates follow RQ v5 canonical `onMutate` (cancel out-of-flight via `cancelQueries`, snapshot previous, rollback in `onError`). The two existing optimistic screens (bookmarks, tracker) migrate first among mutations since their logic already matches.

---

## 6. Where React Query should NOT be used

1. **`prototypeEventState.ts`** — localStorage-backed mutable prototype state. Not server state; wrapping it would fight its synchronous read-modify-write model.
2. **Pure-local widgets** — ToDo (localStorage), WeekCalendar/Schedule/Attendance/InternalMarks derivations, admin static pages, form-only shells (§1.1).
3. **Secrets** — admin unlock password (ref in context), credentials in LoginPage. Cache is devtools-inspectable; secrets must not enter it.
4. **Imperative one-shot side effects with no state outcome** — FeePaidPage receipt print; analytics beacons; `startSessionHeartbeat` probe; download links.
5. **Fire-and-forget mutations where the caller navigates immediately and discards the result** may initially stay as plain async handlers — converting them adds ceremony without behavioral gain. Convert them when they feed shared keys (they usually do).
6. **Cross-tab sync needs** — RQ cache is per-tab. If multi-tab coherence ever becomes a requirement, that's a separate design (BroadcastChannel), not something to bolt on here.
7. **Non-HTTP async resources** — speech/media APIs, file readers, geolocation. Server-state library, not async-state library.

---

## 7. Phased implementation plan

Every phase is independently shippable, keeps the full test suite green, and ends with a commit-sized diff. Phases 1–3 deliver ~70% of the value.

**Phase 0 — Foundations (½ day)**
- Add `@tanstack/react-query-devtools` (dev-only mount in `AppProviders`).
- Fix global `retry` to respect `ApiError.retryable` (correctness fix enabled by centralization).
- Add `toErrorMessage()`, shared option presets (`erpReadOptions`, `listOptions`, …), `QueryCache`/`MutationCache` onError auth-death guard.
- Add `src/test/testUtils.tsx`: `createTestQueryClient()` + `renderWithProviders()` (today no test provider exists; every converted test needs one).
- Install `eslint-plugin-react-query` rules (optional but recommended).

**Phase 1 — Single-point conversions (1 day)**
- `useBlueprintPageData` → `useQueries` adapter (≈63 routes at once; keep `BlueprintPageState` identical).
- Session profile: `['session','profile']` query; Sidebar/Dashboard/ProfilePage/blueprint hook consume it; retire the hand-rolled TTL cache; wire `queryClient.clear()` into logout.
- Exit criteria: network tab shows ≤1 `/api/profile` per navigation; blueprint "Try again" works; blueprint + session + Dashboard tests green.

**Phase 2 — LMS mass migration (1 day)**
- Rewrite `useAsyncPage` internals onto `useQuery` (signature-compatible). All 33 sites inherit caching instantly.
- Spot-check high-traffic pages (LmsHomePage 8–9 parallel loads now dedupe against AcademicHubPage overlaps automatically).
- Exit criteria: LMS suites green; repeat-navigation serves from cache; `InlineError` flows unchanged.

**Phase 3 — Events domain (2 days, riskiest)**
- EventContext → adapter over `useQuery`(+`refetchInterval`) and `useQueries` for submissions; delete snapshot-diff gate and `eventCache`.
- Convert competitions/campus event mutations to `useMutation` + §5 matrix; `context.refetch()` → scoped invalidations.
- Exit criteria: `EventContext.test.tsx` adapted & green; polling cadence verified per phase; registration/team flows e2e-checked in prototype mode.

**Phase 4 — Career + Helpdesk (1–2 days)**
- Introduce `useApiMutation`; migrate the four `runAction` clusters, ticket flows, FAQ CRUD.
- Migrate the two optimistic screens (bookmarks, tracker drag-drop) to `onMutate` pattern; retire custom `useOptimistic`.
- Exit criteria: bookmark/tracker rollback paths covered by tests.

**Phase 5 — Dashboard, ERP renderers, AcademicTracker, Feedback, Admin (2 days)**
- Dashboard widgets become independent queries (unblocks progressive rendering).
- 18 ERP custom renderer pages: `getErpBatch` → `['erp','batch',…]` + per-key queries; refresh counters → `refetch()`.
- Remaining Career/Resources/Feedback/Admin loaders.
- Exit criteria: full suite green; no `loading||xLoading` full-page gates outside accepted designs.

**Phase 6 — Cleanup (½ day)**
- Remove per-wrapper `handleSessionAuthFailure` duplication (keep the centralized guard), delete dead abstractions (`eventCache`, `useOptimistic`, legacy `runAction`), final bundle check, docs update (`04-FRONTEND-DEEP-DIVE.md`).

Total: **~7–9 focused working days** excluding review cycles.

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Test churn: every converted component test needs a QueryClient provider | Phase 0 ships `renderWithProviders` before any component converts; mock strategy unchanged (mock the lib modules, not RQ). |
| Behavioral diff: `error: string` vs `ApiError` object | `toErrorMessage()` helper at the boundary; UI contracts preserved. |
| Double-caching ERP data (client + backend) | staleTime ≤ backend fresh TTL (§3.5); manual refresh = `refetch()`; optional `x-erp-source` badging makes backend authority visible. |
| Retry storms against live-first pages / LOCK_TIMEOUT | Global retry respects `ApiError.retryable` only (backend already flags 503 LOCK_TIMEOUT/RATE_LIMITED retryable; 400/401 never retried). |
| Polling regressions (hidden-tab, cadence) | RQ defaults match current behavior (`refetchIntervalInBackground:false`); keep phase-based interval function; cover in `EventContext.test.tsx`. |
| Loading-flash differences (cached-first renders skip spinners) | Intentional improvement; audit pages that assert skeletons in tests and switch assertions to content-based waits. |
| Identity churn breaking `React.memo`/deps assumptions | `structuralSharing` default preserves references; remove our manual JSON-equality guards only after verifying memo boundaries. |
| Concurrent AI sessions editing the same files mid-phase | Coordinate phases with other sessions (this repo runs several); land each phase as one coherent commit; re-read files immediately before editing. |
| Bundle size | Core already paid for (installed & mounted). Devtools gated to `import.meta.env.DEV`. Expect net ~0 change. |
| God-file blast radius (`EventWorkflowPages.tsx`, 2000+ lines) | Phase 3 converts its fetch effects mechanically without restructuring the file; file-splitting stays a separate concern. |

## 9. Success metrics

- `/api/profile` requests per navigation: 2+ → 1 (then 0 on cache hit).
- Repeat visit to any LMS list: network round-trip eliminated within staleTime.
- Post-mutation consistency bugs ("didn't refresh after X") class-eliminated via invalidation matrix.
- Lines of bespoke loading code removed (target: ≥1500 across the four quadruplicated helpers, 33 `useAsyncPage` bodies' worth of effect boilerplate, and the hand-rolled trio pattern).
- Full vitest suite green at every phase commit; no new flaky profiles introduced (rerun/isolate before chasing — see known suite-flake notes).

## 10. Open decisions (need owner sign-off before the relevant phase)

1. Whether `useAsyncPage` remains a permanent public adapter or pages eventually inline `useQuery` (recommend: adapter forever — it encodes LMS error-UI conventions).
2. Whether EventContext stays as context (recommended through Phase 3) or consumers migrate to direct hooks (defer; larger refactor).
3. Whether to surface `x-erp-source` freshness badges (nice-to-have; needs design input).
