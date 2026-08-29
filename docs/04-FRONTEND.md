# 04 — Frontend

> React 19 + Vite 7 + TypeScript 5.8. ~80 pages across 14 page
> directories, ~12 design-system components, TanStack React Query
> 5 for server state, React Router 7 for routing. This doc covers
> the directory layout, the routing model, the state model, the
> design system, and a per-page index.

For the data flow, see **[02 — Architecture](./02-ARCHITECTURE.md)**.
For per-endpoint API calls, see **[07 — API Reference](./07-API-REFERENCE.md)**.
For the design system tokens and motion, see
**[12 — Contributing](./12-CONTRIBUTING.md)** (or PRODUCT.md /
CLAUDE.md / AGENTS.md for the brand and product design context).

## 4.1 Directory layout

```
Frontend/src/
├── main.tsx                          # Entry: React root + StrictMode
├── App.tsx                           # Top-level: AppProviders + RouterProvider
├── AppProviders.tsx                  # QueryClientProvider + ThemeProvider + ...
├── routes/                           # React Router 7 config (split across 6 files)
│   ├── index.tsx                     # createBrowserRouter + 404 page
│   ├── baseRoutes.tsx                # /, /Home, /login, /forgot-password, /career/public/:userId
│   ├── erpRoutes.tsx                 # /api-driven routes (one per blueprint)
│   ├── eventRoutes.tsx               # /events/* (22 routes)
│   ├── lmsRoutes.tsx                 # /learn/* (16 routes)
│   └── adminRoutes.tsx               # /admin/* (1 route)
├── pages/                            # 14 page directories, ~80 .tsx files
│   ├── AcademicTracker/              # 12 files
│   ├── Admin/                        # 21
│   ├── CareerPortal/                 # 25
│   ├── Dashboard/                    # 28
│   ├── ERP/                          # 23
│   ├── Events/                       # 17
│   ├── Feedback/                     # 7
│   ├── Helpdesk/                     # 4
│   ├── LMS/                          # 9
│   ├── Login/                        # 5
│   ├── Profile/                      # 1
│   ├── Resources/                    # 3
│   ├── Settings/                     # 1
│   └── Shared/                       # 2
├── components/                       # Design system + feature components
│   ├── ui/                           # Design-system primitives (Button, Card, etc.)
│   ├── layout/                       # Page shells (PageLayout, ErrorBoundary)
│   ├── shell/                        # App shell (Header, Sidebar, Footer)
│   ├── forms/                        # Form widgets
│   ├── data/                         # Data-aware components (SkeletonCard, etc.)
│   ├── charts/                       # Recharts wrappers
│   ├── markdown/                     # Markdown editor + renderer (CodeMirror)
│   ├── admin/                        # Admin-only components
│   ├── career/                       # Career-portal-specific
│   ├── competition/                  # Competition-specific (ScoreCard, etc.)
│   ├── erp/                          # ERP-renderer shared components
│   ├── lms/                          # LMS-specific
│   ├── button.tsx, card.tsx, chart.tsx, command.tsx, dialog.tsx, input.tsx,
│   │   popover.tsx, select.tsx, textarea.tsx   # top-level design-system primitives
│   ├── AppKeyboardShortcuts.tsx      # Global ⌘K handler
│   ├── ErrorBoundary.tsx, ProtectedPage.tsx, SuspenseWrapper.tsx
│   ├── Header.tsx, Sidebar.tsx, SidebarNavIcons.tsx, Footer.tsx
│   ├── LoadingSpinner.tsx, ThemeToggle.tsx, NavigationCommandPalette.tsx
│   └── AdminOnlyPage.tsx
├── lib/                              # Cross-cutting libs
│   ├── core/                         # apiClient, queryClient, session, identity
│   ├── campus/                       # campusApi (the main API client)
│   ├── erp/                          # ERP integration: transformers, fetch, schemas
│   ├── events/                       # events API + scoring helpers
│   ├── lms/                          # LMS API
│   ├── career/                       # career API
│   ├── helpdesk/                     # helpdesk API
│   └── admin/                        # admin API
├── config/                           # ERP blueprints (page → fetchKeys + renderer)
│   ├── erpBlueprints.ts              # re-exports
│   ├── erpBlueprintData.ts           # all the data
│   └── erpBlueprintTypes.ts          # TypeScript types
├── hooks/                            # Custom React hooks
├── styles/                           # CSS tokens (variables.css) + index.css
├── e2e/                              # Playwright specs (real-stack + prototype)
├── scripts/                          # Build-time scripts (audit-blueprints, etc.)
├── test/                             # Vitest setup (setupTests.ts)
└── vite-env.d.ts                     # Vite type definitions
```

## 4.2 Entry and routing

### 4.2.1 Entry (`main.tsx`)

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 4.2.2 Top-level app (`App.tsx`)

```tsx
export default function App() {
  useEffect(() => startSessionHeartbeat(), []);
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
```

`AppProviders` wraps the tree with the React Query `QueryClientProvider`,
the theme provider, the keyboard-shortcut provider, and the
session-heartbeat kickoff (every page calls `/api/auth/me` periodically
to keep the session warm).

### 4.2.3 Router

React Router 7 (`createBrowserRouter`). The router is split across
6 files in `src/routes/`:

| File | Routes |
|------|--------|
| `baseRoutes.tsx` | `/`, `/Home`, `/login`, `/forgot-password`, `/dashboard`, `/profile`, `/career/public/:userId` |
| `eventRoutes.tsx` | 22 routes under `/events/*` (listing, create, my-activity, my-teams, my-created, attendance, detail, register, team creation, invitations, submit, results, leaderboard, certificate, manage) |
| `lmsRoutes.tsx` | 16 routes under `/learn/*` (home, discover, practice, my-learning, contribute, request-board, resource detail, subject hub, guides, roadmaps, exam feedback, contributor profile) |
| `erpRoutes.tsx` | One route per ERP page blueprint, generated from `src/config/erpBlueprintData.ts` |
| `adminRoutes.tsx` | `/admin/events-management/:eventId` |
| `index.tsx` | The 404 catchall (`*` → NotFoundPage) |

Every route is wrapped in `<PageLayout>` (header + footer + main
content) and (if it requires auth) `<ProtectedPage>` which redirects
to `/login` on 401.

### 4.2.4 Protected routes

`<ProtectedPage>` reads the session from `lib/core/session.ts`. If
the session is missing or expired, it redirects to `/login?next=<path>`.
If the session is present but doesn't have admin access and the route
requires it, it shows a 403 message instead.

## 4.3 State management

### 4.3.1 Server state — TanStack React Query 5

Every page that fetches data from the backend uses React Query
hooks (`useQuery`, `useMutation`). The setup is in
`lib/core/queryClient.ts`:

- `staleTime: 30_000` (30s) — revalidate on focus, refetch on mount
  if older than 30s
- `gcTime: 5 * 60_000` (5min) — garbage-collect after 5 min of no
  observers
- `retry` — only on errors flagged `retryable: true` by the
  `ApiError` class. Never burn upstream scrapes on 400s or auth
  deaths. Network TypeErrors get one retry.
- `refetchOnWindowFocus: false` — manual refetch on focus is
  annoying for an ERP proxy
- **Global session-death handler** — any 401 / `SESSION_EXPIRED` /
  `UNAUTHORIZED` from any query or mutation redirects to `/login`
  (idempotent — safe to call from multiple places)

Every mutation that changes a list or detail calls
`queryClient.invalidateQueries({ queryKey: [...] })` to refresh
the affected views.

### 4.3.2 Local state — React `useState` / `useReducer`

Used for component-local things (form state, tab state, drawer
open/closed, current scroll position). No Zustand, Redux, or Jotai.

### 4.3.3 Auth state

Server-side: the cookie is the source of truth. The SPA probes
`/api/auth/me` on every page load (`useAuthStatus` hook +
`startSessionHeartbeat` on mount). A 401 response triggers the
global redirect to `/login`.

### 4.3.4 Static prototype mode

When `VITE_STATIC_PROTOTYPE=true` (set in `.env.prototype` and used
by the fixture-only Playwright prototypes), the campus API client
(`lib/campus/campusApi.ts`) returns fixture data instead of
fetching. The fixtures live alongside the test files in
`Frontend/test/fixtures/`. This is what powers the prototype-only
specs in `Frontend/e2e/*.spec.ts` (the ones that don't use
`*.realstack.spec.ts`).

## 4.4 The campus API client

`lib/campus/campusApi.ts` is the single API client for most
non-ERP, non-events, non-LMS, non-career traffic. It's a thin
wrapper around `fetch` with:

- **Same-origin by default** — all paths are relative (`/api/...`)
- **Credentials: include** — every request includes the
  `erp_session` cookie
- **Error envelope parsing** — every non-2xx response is parsed
  into an `ApiError` (status, code, message, requestId, retryable)
- **Body shapes** — TypeScript-typed request/response per endpoint
- **Auto-content-type** — JSON unless explicitly FormData

The per-feature API clients (`lib/events`, `lib/lms`, `lib/career`,
`lib/helpdesk`, `lib/admin`, `lib/erp`) follow the same pattern but
live in their own modules so the bundler can tree-shake them.

## 4.5 ERP integration (frontend side)

The ERP pages (Dashboard, attendance, timetable, fees, etc.) are
not hand-written per page. Instead:

1. **`src/config/erpBlueprintData.ts`** defines the data: for each
   ERP page, it lists the `fetchKeys` (the backend pageKey to call),
   the `renderer` (a Vue-like component type), the `status`
   (active/hidden/experimental), and the `domain` (erp/lms/career/etc.).
2. **`src/routes/erpRoutes.tsx`** loops the blueprints and creates
   one React Router entry per page. The route element is a generic
   `<ErpPage>` that:
   - Looks up the right renderer for the pageKey
   - Calls `/api/erp/batch?keys=...` (or the legacy
     `/api/scrape/:pageKey`) with React Query
   - Passes the typed payload to the renderer
3. **Renderers** live in `src/components/erp/` and are generic
   (e.g. `<TableRenderer>`, `<GenericCardRenderer>`). They take a
   payload + a schema and render the data.

The transformers (`src/lib/erp/erpTransformers.ts`) are pure
functions that take the raw backend response and produce typed
domain models (`AttendanceSummary`, `TimetableWeek`, etc.).
Pipeline-guarded — the platform runs them through a schema
validator before rendering.

## 4.6 Page index

Every page is listed below with its route and one-line purpose.

### 4.6.1 AcademicTracker/ (12 files)

| File | Route | Purpose |
|------|-------|---------|
| `AcademicHubPage.tsx` | `/academic-tracker` | Hub with progress overview |
| `UnifiedInsights.tsx` | `/unified-insights` | Cross-domain signal feed |
| `ProgressDashboard.tsx` | (route) | Per-user progress |
| (and 9 more) | various | Sub-pages for marks / attendance trends / etc. |

### 4.6.2 Admin/ (21 files)

| File | Route | Purpose |
|------|-------|---------|
| `AdminHomePage.tsx` | `/admin` | Admin home |
| `EventsAdminPage.tsx` | `/admin/events-management` | Event moderation |
| `ContentAdminPage.tsx` | `/admin/content` | Content moderation |
| (and 19 more) | various | Per-area admin tools |

### 4.6.3 CareerPortal/ (25 files)

| File | Route | Purpose |
|------|-------|---------|
| `CareerHomePage.tsx` | `/career-portal` | Home + feed |
| `Opportunities.tsx`, `OpportunitiesPage.tsx` | `/career-portal/opportunities` | Browse + filter |
| `OpportunityDetailPage.tsx` | `/career-portal/opportunities/:id` | Detail + apply |
| `BookmarksPage.tsx` | `/career-portal/bookmarks` | Saved opportunities |
| `ApplicationTrackerPage.tsx` | `/career-portal/applications` | Application status |
| `SkillGapPage.tsx` | `/career-portal/skill-gaps` | Skill-gap analysis |
| `ProfessionalProfilePage.tsx` | `/career-portal/profile` | My career profile |
| `PublicCareerProfilePage.tsx` | `/career-portal/public/:userId` | Public profile |
| `ResumeBuilder.tsx` | `/career-portal/resume-builder` | Resume builder |
| `SubmitOpportunityPage.tsx` | `/career-portal/submit` | Submit an opportunity |
| `AlumniConnect.tsx` | `/career-portal/alumni` | Alumni directory |
| `InterviewBooking.tsx` | `/career-portal/interviews` | Interview slots |
| `ScraperHealthCard.tsx` | (component, not page) | Supervisor status card |

### 4.6.4 Dashboard/ (28 files)

| File | Route | Purpose |
|------|-------|---------|
| `DashboardPage.tsx` | `/dashboard` | The main dashboard (KPIs + quick links) |
| `KpiWidget.tsx` | (component) | KPI tile |
| (and 26 more) | various | Dashboard sub-widgets + layouts |

### 4.6.5 ERP/ (23 files)

| File | Route | Purpose |
|------|-------|---------|
| `AttendanceDetailsPage.tsx` | `/academic/attendance-details` | Attendance grid |
| `TimetablePage.tsx` | `/academic/timetable` | Weekly timetable |
| `CurriculumPage.tsx` | `/academic/curriculum` | Per-semester subject list |
| `SapScholarshipsPage.tsx` | `/academic/sap-scholarships` | SAP & scholarships |
| `ResultsCurrentPage.tsx` | `/exams/current-semester-results` | Current results |
| `ResultsEarlierPage.tsx` | `/exams/earlier-semester-results` | Earlier results |
| `FeeDuesPage.tsx` | `/finance/fee-dues` | Fee dues |
| `FeePaidPage.tsx` | `/finance/fee-paid` | Fee paid history |
| `BankDetailsPage.tsx` | `/finance/bank-details` | Bank details |
| `VacantRoomsPage.tsx` | (via blueprint) | Vacant rooms |
| `HostelBookingPage.tsx` | (via blueprint) | Hostel booking |
| `HostelRegistrationPage.tsx` | (via blueprint) | Hostel registration (uses localStorage fallback + new `/api/hostel-buddy/*` API) |
| `RoomDetailsPage.tsx` | `/transport-hostel/room-details` | Room details |
| `RegistrationErpPage.tsx` | (via blueprint) | Exam registration |
| `RefundChangePage.tsx` | (via blueprint) | Refund/change requests |
| `DocumentErpPage.tsx` | (via blueprint) | Generic document viewer |
| `FaqsPage.tsx` | (via blueprint) | Generic FAQs |

### 4.6.6 Events/ (17 files)

| File | Route | Purpose |
|------|-------|---------|
| `EventsListingPage.tsx` | `/events` | Browse all events |
| `EventDetailPageNew.tsx` | `/events/:eventId` | Detail (with register / team / submit / etc.) |
| `CreateEventPage.tsx` | `/events/create` | Create an event |
| `MyActivityPage.tsx` | `/events/my-activity` | "My events" tab with score card |
| `MyTeamsPage.tsx` | `/events/my-teams` | "My teams" tab |
| `MyCreatedEventsPage.tsx` | `/events/my-created` | "My created events" tab (organizer) |
| `EventsRegistrationHub.tsx` | `/events/:eventId/register` | Registration flow |
| `EventAttendance.tsx` | `/events/attendance` | Event attendance page |
| `EventWorkflowPages.tsx` | (multiple) | Workflow shells (manage, etc.) |
| `SubmissionPage.tsx` | `/events/:eventId/submit/:roundId` | Submission upload |
| `MyResultsPage.tsx` | `/events/:eventId/my-results/:roundId` | My result for a round |
| `LeaderboardPage.tsx` | `/events/:eventId/leaderboard/:roundId` | Round leaderboard |
| `EvaluationPage.tsx` | (via organizer workflow) | Organizer evaluation |
| `ShortlistPage.tsx` | (via organizer workflow) | Organizer shortlist |
| `OrganizerDashboard.tsx` | (via blueprint) | Organizer's view of one event |
| `SubmissionListPage.tsx` | (via blueprint) | List of submissions for a round |

### 4.6.7 LMS/ (9 files)

| File | Route | Purpose |
|------|-------|---------|
| `LmsHomePage.tsx` | `/learn` | LMS home |
| `DiscoverPage.tsx` | `/learn/discover` | Discover resources |
| `PracticePage.tsx` | `/learn/practice` | Practice (quizzes, PYQs) |
| `MyLearningPage.tsx` | `/learn/me` | My learning dashboard |
| `ContributePage.tsx` | `/learn/contribute` | Contribute a resource |
| `AddResourcePage.tsx` | `/learn/contribute/new` | Add-resource wizard |
| `RequestBoardPage.tsx` | `/learn/requests` | Request board |
| `ResourceDetailPage.tsx` | `/learn/r/:id` | Resource detail |
| `SubjectOverviewPage.tsx` | `/learn/subjects/:code` | Subject hub |
| (also) `CollectionsPage.tsx` | (sub-page) | My collections |
| (also) `PYQBankPage.tsx`, `QuestionBankPage.tsx` | (sub-pages) | Question banks |

### 4.6.8 Feedback/, Helpdesk/, Login/, Profile/, Resources/, Settings/, Shared/

Small, single-purpose. List:

- `Feedback/` (7) — course feedback form (calls into the upstream
  ERP via the backend's feedback extractor)
- `Helpdesk/` (4) — ticket form + ticket list + ticket detail
- `Login/` (5) — login, forgot-password, captcha, dev login
- `Profile/` (1) — user profile
- `Resources/` (3) — content/resources index + detail
- `Settings/` (1) — app settings
- `Shared/` (2) — shared 404, generic error page

## 4.7 Design system

CSS-token based. All design tokens live in `src/styles/variables.css`
as CSS custom properties. The platform's design philosophy is in
`AGENTS.md` / `CLAUDE.md` / `PRODUCT.md` — read those for "why".

### 4.7.1 Tokens

- **Colors** — `--comp-accent`, `--comp-accent-fg`, `--background`,
  `--surface`, `--text-primary`, `--text-secondary`, `--border`,
  `--success`, `--warning`, `--danger`. Full dark-mode coverage.
- **Typography** — `--font-size-*`, `--font-weight-*`, `--line-height-*`
- **Spacing** — `--space-1` through `--space-12`
- **Radius** — `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
- **Shadow** — `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Motion** — `--ease-out-expo` (the "Pristine Studio" curve)

### 4.7.2 Components (top-level)

| Component | Purpose |
|-----------|---------|
| `<Button>` | The single button. Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. |
| `<Card>` | Surface container. Optional `<CardHeader>`, `<CardBody>`, `<CardFooter>`. |
| `<Input>` / `<Textarea>` / `<Select>` | Form fields, all with the same look + error state. |
| `<Dialog>` | Radix UI-based modal. |
| `<Popover>` | Radix UI-based popover. |
| `<Command>` (cmdk) | The press-`/` command palette overlay. |
| `<Chart>` | Recharts wrapper with consistent colors and tooltip. |
| `<ErrorBoundary>` | Catches render errors, shows a fallback UI. |
| `<SuspenseWrapper>` | Wraps lazy-loaded pages in `<React.Suspense>`. |
| `<ProtectedPage>` | Redirects to `/login` if no session. |
| `<AdminOnlyPage>` | 403 if no admin elevation. |
| `<LoadingSpinner>` | Loading state. |
| `<ThemeToggle>` | Light / dark mode toggle (persists in localStorage). |
| `<AppKeyboardShortcuts>` | Global ⌘K → command palette, Esc → close overlays. |
| `<Header>`, `<Sidebar>`, `<SidebarNavIcons>`, `<Footer>` | App shell. |
| `<NavigationCommandPalette>` | The ⌘K overlay itself. |

## 4.8 Build & dev

- `npm run dev` — Vite dev server on port 5173, with the `/api/*` proxy
  configured in `vite.config.ts` to forward to `http://localhost:5000`
  (overridable via `VITE_API_PROXY_TARGET`).
- `npm run build` — `tsc -b && vite build` (type-check then bundle).
  Output in `Frontend/dist/`.
- `npm run build:static` — same as build but with `VITE_STATIC_PROTOTYPE=true`
  (for the fixture-only prototype).
- `npm run preview` — Serve the production build locally.
- `npm test` — Vitest, 1188 tests across 99 files.
- `npm run test:e2e` — Playwright. The real-stack config
  (`playwright.config.realstack.ts`) is for the J1-J8 specs and
  needs the e2e backend running. The default config
  (`playwright.config.ts`) is for the fixture-only specs.
- `npm run lint` — ESLint.
- `npm run audit:api-contracts` — verifies the SPA calls the right
  endpoints.
- `npm run audit:responsive` — verifies the layout is responsive at
  the standard viewports (375×812, 768×1024, 1280×800).

## 4.9 Path aliases

`tsconfig.json` defines:
- `@/*` → `Frontend/src/*`
- `@/components/*`, `@/lib/*`, `@/pages/*`, `@/hooks/*`, `@/styles/*`

## 4.10 Common patterns

- **Every page that fetches data uses React Query** with the
  pattern: `const { data, isLoading, error } = useQuery({ queryKey,
  queryFn, ... })`. No `useState` for fetched data.
- **Every mutation invalidates related queries** —
  `queryClient.invalidateQueries({ queryKey: ["events", "list"] })`
  after a successful POST/PUT/DELETE.
- **Every page that requires auth is wrapped in `<ProtectedPage>`**.
- **Every page has a `<PageHeader>` + a `<PageBody>`** for consistent
  spacing. The shell is `<PageLayout>`.
- **Every long list uses `<SkeletonCard>`** during loading.
- **Every form has client-side validation** before submitting (the
  backend re-validates server-side).

## 4.11 Common pitfalls

- **Don't hand-fetch with `axios` in a new component** — use the
  campus API client (or the relevant per-feature client) which
  already has error handling, retry, and the session-401 redirect.
- **Don't bypass the React Query cache** by storing server data in
  `useState` — you'll lose the cache-401 redirect and the
  refetch-on-mount behavior.
- **Don't add a new top-level design-system component** without
  first checking `src/components/ui/` — there's a good chance
  the existing primitive already covers your case.
- **Don't hardcode the backend URL** — use the same-origin proxy.
  In dev, that's `vite.config.ts`. In prod, that's the in-container
  nginx.
- **Don't put a `useEffect` that fetches** — use `useQuery` (or
  `useSuspenseQuery` if you want the Suspense behavior).
- **Don't import from `Backend/`** — the frontend and backend are
  independent; the only contract is the HTTP API.
