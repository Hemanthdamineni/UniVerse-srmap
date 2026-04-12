# 04 — Frontend Deep-Dive

## 4.1 Technology & Build Setup

| Item | Value |
|------|-------|
| **Framework** | React 19 (SPA) |
| **Build Tool** | Vite 7 with SWC plugin (`@vitejs/plugin-react-swc`) |
| **Language** | TypeScript 5.8 |
| **Styling** | TailwindCSS 4 (via `@tailwindcss/vite` plugin) + vanilla CSS variables |
| **Routing** | `react-router-dom` v7 (`createBrowserRouter`) |
| **UI Components** | shadcn/ui (Button, Card, Calendar, Command, Dialog, Popover, Chart) |
| **Icons** | Lucide React + Heroicons React |
| **Path Alias** | `@/` → `./src/` |
| **Dev Proxy** | Vite proxies `/api` to `http://localhost:5000` |

---

## 4.2 Entry Point — `main.tsx`

The entry point creates a `BrowserRouter` with routes derived from two sources:

### Static Routes
| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `HomePage` | Landing page |
| `/Home` | `HomePage` | Alias |
| `/login` | `LoginPage` | Authentication |
| `/dashboard` | `Dashboard` | ERP batch-view |
| `/profile` | `ProfilePage` | Student profile |
| `*` | `HomePage` | Catch-all fallback |

### Dynamic Routes (from `PAGE_BLUEPRINTS`)
All entries in `PAGE_BLUEPRINTS` (except `/dashboard` and `/profile`) generate routes automatically. The component for each route is selected by renderer type:

```typescript
if (blueprint.renderer === "attendance")  → <AttendanceDetailsPage />
if (blueprint.renderer === "timetable")   → <TimetablePage />
if (blueprint.renderer === "curriculum")  → <CurriculumPage />
if (sourceMode !== "erp" || fetchKeys.length === 0 || special renderers)
                                          → <BlueprintPage />  (generic schema-driven)
else                                      → <MappedErpPage />  (raw ERP doc renderer)
```

Every route is wrapped in `<PageLayout>` which provides the sidebar + main content area layout.

---

## 4.3 Page Layout System

### `PageLayout.tsx`
Determines layout based on route:

| Route Type | Layout |
|------------|--------|
| **Public** (`/`, `/Home`, `/login`) | Header + main + Footer (no sidebar) |
| **Authenticated** (everything else) | Sidebar + main (full-height flex) |

The authenticated layout includes:
- `<Sidebar />` — Left navigation panel
- `<NavigationCommandPalette />` — Cmd+K search/navigation overlay
- `{children}` — Page content

---

## 4.4 Core Components

### `Sidebar.tsx` (14KB)
Full-featured navigation sidebar built from `MAIN_NAV` and `BOTTOM_NAV` config arrays:

- Collapsible dropdown menus for each section
- Active route highlighting
- Sub-items with access type indicators (`B` = basic, `A` = advanced)
- Dark mode styling with CSS variables
- Custom clip-path accent geometry
- Bottom nav items: Notifications, Settings, Logout

### `NavigationCommandPalette.tsx` (7.8KB)
Cmd+K command palette using `cmdk` library + Radix Dialog:
- Full-text search across all page routes
- Keyboard navigation (arrow keys, Enter)
- Groups by section (Academic, Finance, etc.)
- Quick-launch any page

### `Header.tsx`
Simple header for public routes with logo and navigation links.

### `ThemeToggle.tsx`
Dark/light mode toggle. Stores preference in `data-theme` attribute on `<html>` and uses CSS variable theming.

### `LoadingSpinner.tsx`
Reusable loading indicator component.

---

## 4.5 ERP Components (`components/erp/`)

### `ErpDocumentRenderer.tsx` (30KB)
The **heavy lifter** of the frontend. Recursively renders `ErpDocument` AST nodes from the backend:

| Node Type | Rendering |
|-----------|-----------|
| `container` | Wrapper div with nested children |
| `text` | Paragraph/heading with cleaned text |
| `table` | Responsive table with header detection, sortable columns |
| `form` | Interactive form fields (inputs, selects, textareas) |
| `field` | Individual form control |
| `button` | Action button with execution handlers |

Features:
- Safe rendering — all values pass through `normalizeRawValue()` before display
- Table responsiveness with horizontal scrolling
- Form action execution via `executeErpAction()` API call
- Null/empty state handling
- Print-ready content rendering

### `ErpPrimitives.tsx` (9.4KB)
Lower-level building blocks used by the document renderer:
- Styled data tables with striped rows
- Key-value pair display cards
- Section headers and dividers
- Empty state indicators

---

## 4.6 Page Components

### ERP Data Pages (`pages/ERP/`)

**`AttendanceDetailsPage.tsx`**
- Calls `executePipeline("attendance", rawData)` on batch response
- Renders per-subject attendance records with progress bars
- Calculates aggregate statistics (average attendance %)
- Color-coded status (excellent/good/needs-improvement)

**`TimetablePage.tsx`**
- Calls `executePipeline("timetable", rawData)`
- Renders weekly schedule grid (days × time slots)
- Lists subjects with code, name, L-T-P-C, and faculty
- Responsive grid layout

**`CurriculumPage.tsx`**
- Calls `executePipeline("curriculum", rawData)`
- Semester-wise subject listing with credit breakdowns
- Grouped by semester with expandable sections

**`MappedErpPage.tsx`**
- Generic ERP page renderer using `ErpDocumentRenderer`
- Fetches ERP data via `getErpBatch(pageKeys)`
- Passes raw `document` AST to renderer
- Handles loading, error, and empty states

### Schema-Driven Pages

**`BlueprintPage.tsx` (Shared)**
- The most reusable page component
- Accepts any `PageBlueprint` config
- Handles three source modes:
  - `erp` — fetches via batch API + renders with ErpDocumentRenderer
  - `external` — fetches from content store
  - `placeholder` — shows "coming soon" message
- Automatic loading states from blueprint's `loadingMessage`

### Dashboard (`pages/Dashboard/`)

**`Dashboard.tsx`**
- Batch-fetches all dashboard scrape targets in one call
- Renders cards for: Timetable summary, Attendance overview, Internal Marks, Announcements
- Quick-links to commonly accessed pages
- Profile card with student info
- Calendar integration (Recharts for charts)

### Other Page Directories

| Directory | Purpose |
|-----------|---------|
| `pages/Home/` | Landing page |
| `pages/Login/` | Login form with captcha |
| `pages/Profile/` | Student profile display (calls `transformProfileData`) |
| `pages/Events/` | Event listing, detail, registration, my-events |
| `pages/Exams&Results/` | Current/earlier semester results |
| `pages/Finance/` | Fee dues, paid fees, bank details |
| `pages/Academic/` | Curriculum, SAP |
| `pages/AcademicTracker/` | Progress overview (placeholder) |
| `pages/CareerPortal/` | Opportunities, resume (placeholder) |
| `pages/Feedback/` | Course/event feedback |
| `pages/Helpdesk/` | Ticket system (placeholder) |
| `pages/Notifications/` | Announcements from ERP |
| `pages/Registration/` | Various registration pages |
| `pages/Resources/` | Learning materials |
| `pages/Settings/` | Mobile verification, preferences |
| `pages/Transport&Hostel/` | Room details, FAQs, routes |

---

## 4.7 Library Layer (`lib/`)

### `erpApi.ts` — API Client
The frontend's HTTP interface to the backend. All methods use `fetch` with `credentials: "include"`.

**Type System:**
```typescript
// Core types
ErpNode { id, type, props, children }
ErpDocument { title, root: ErpNode }
ErpPageResponse { success, pageKey, source, data, document, warnings }
ErpSectionRef { sourcePageKey, key, dropdown, subitem }
ErpAction { id, label, kind, enabled, execution }
ErpFormField { id, name, type, value, options, ... }
ErpForm { id, method, action, fields }
ErpUiSection { sourcePageKey, forms, actions }
ErpSchemaBlock { id, type, sourcePageKey, title, section }
```

**API Methods:**
| Function | Purpose |
|----------|---------|
| `getErpPage(pageKey)` | Fetch single V2 page, fallback to legacy |
| `getErpBatch(pageKeys)` | Batch-fetch multiple pages |
| `getErpUiHints(pageKey)` | Get forms/actions for a page |
| `getErpSchema(pageKey)` | Get render schema blocks |
| `executeErpAction(payload)` | Execute ERP form action |
| `sendErpDocumentRequest(payload)` | Send arbitrary ERP request |

**Error handling:**
- `ApiError` class with `status`, `code`, `retryable` properties
- Auto-detects session failures (401 + SESSION_EXPIRED) → clears auth → redirects to login
- Parses structured error envelopes from backend

### `session.ts` — Session Management
Client-side session and auth state:

| Function | Purpose |
|----------|---------|
| `getSessionId()` | Read sessionId from localStorage |
| `readStoredProfileData()` | Parse cached profile from localStorage |
| `storeSessionAuth({ sessionId, profileData })` | Save auth state after login |
| `clearSessionAuth()` | Clear all auth data |
| `isSessionAuthFailure(status, payload)` | Detect auth failures |
| `handleSessionAuthFailure()` | Clear + redirect to login |
| `fetchSessionProfile()` | GET /api/profile, cache result |
| `logoutSession()` | POST /api/logout + clear client state |

### `erpTransformers.ts` — Data Pipeline
(See [06-DATA-PIPELINE.md](./06-DATA-PIPELINE.md) for complete documentation)

### `utils.ts`
Small utilities (e.g., `cn()` class name merger utility from shadcn).

---

## 4.8 Configuration (`config/`)

### `erpBlueprints.ts` — Central Configuration Hub
This is the **single source of truth** for all frontend routing and data mapping. It exports:

**`PAGE_BLUEPRINTS`** — Record of route → config:
```typescript
interface PageBlueprint {
  route: string;             // Frontend route path
  heading: string;           // Page display title
  fetchKeys: string[];       // Backend scrapeTarget keys to fetch
  sourceMode: "erp" | "external" | "placeholder";
  renderer: PageRenderer;    // Which transformer/renderer to use
  loadingMessage?: string;   // Displayed during data fetch
  placeholderReason?: string; // Why page is unavailable
  includeSessionProfile?: boolean; // Include profile data in fetch
}
```

**`MAIN_NAV`** — Sidebar navigation structure (12 top-level items, ~40 sub-items)

**`BOTTOM_NAV`** — Notifications, Settings, Logout

**`DASHBOARD_QUICK_LINKS`** — Quick access cards on dashboard

**Access types:**
- `B` (Basic) — Available to all authenticated users
- `A` (Advanced) — May require elevated permissions or have limited availability

---

## 4.9 Hooks

### `usePageContrast.ts`
Custom hook for dynamic page background contrast. Provides CSS variable calculations for ensuring text readability against the accent geometry background.

---

## 4.10 Styling

### `styles.css` (11.5KB)
Global styles using CSS custom properties:

**Light mode variables:**
```css
--app-shell-bg: #f8f8f8
--sidebar-bg: #f8f8f8
--sidebar-accent: #0a272b
--dash-bg: #f8f8f8
--dash-accent: #0a272b
```

**Dark mode variables:**
```css
--app-shell-bg: #0a262a
--sidebar-bg: #0a262a
--sidebar-accent: rgba(248, 248, 248, 0.6)
--dash-bg: #0a262a
--dash-accent: rgba(248, 248, 248, 0.6)
```

Features:
- Accent geometry using CSS `clip-path` (polygon-based overlays)
- Dark mode toggle via `[data-theme="dark"]` selector
- Responsive breakpoints
- Component-level styles for sidebar, dashboard, tables
