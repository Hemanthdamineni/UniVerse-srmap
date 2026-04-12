# Frontend architecture

This document describes the cross-domain shell, navigation system, shared UI layer, data fetching, and testing strategy for the University ERP student portal (Competition Platform, Learning Management, Career Services, plus ERP and campus modules).

## Layout and chrome

- **`PageLayout`** (`src/pages/Pagelayout.tsx`): Public routes use header + footer; authenticated routes use sidebar + main area.
- **`AppContentChrome`** (`src/components/shell/AppContentChrome.tsx`): Wraps page content with **breadcrumbs** and a **Suspense** boundary (lazy route readiness).
- **`BreadcrumbsBar`**: Built from `getBreadcrumbs()` in `src/config/navigationRegistry.ts` using the current pathname, domain prefixes, and the route catalog.
- **Skip link**: “Skip to main content” targets `#main-content` for keyboard and screen-reader users (WCAG 2.4.1).
- **`NavigationCommandPalette`**: Cmd/Ctrl+K command surface backed by the same route catalog as the sidebar.
- **`AppKeyboardShortcuts`**: `?` (Shift+/ on US layouts) opens a shortcuts dialog; `g` then `d` / `h` / `c` / `e` jumps to dashboard, learning home, career home, and competition listings when focus is not in a form control.

## Navigation registry

- **`MAIN_NAV` / `PAGE_BLUEPRINTS`** (`src/config/erpBlueprints.ts`): Source of truth for ERP-linked pages and default sidebar structure. Domain groupings include **Competition Platform** (events), **Learning Management** (LMS resources + flows), and **Career Services**.
- **`navigationRegistry.ts`**: Merges blueprints, supplemental SPA-only routes (for example `/resources/browse`), bottom quick links, and **extensions**.
- **`navigationExtensions.ts`**: Call `registerNavigationExtension({ id, mainNavAppend: [...] })` from feature modules to append sidebar groups without editing the core blueprint file.

## Design system

- **CSS variables** in `src/styles.css` define light/dark palettes, typography (Inter stack), borders, and dashboard/sidebar accents.
- **`src/design/tokens.ts`**: Numeric spacing and radius tokens for TS-driven layouts; prefer CSS variables in components where possible for theme consistency.

## Reusable UI

- Existing **shadcn-style** primitives: `button`, `card`, `dialog`, `command`, etc. under `src/components/`.
- **`src/components/shell/DataTable.tsx`**: Accessible table shell with caption via `aria-label`, zebra rows, and empty state.

## Server and client state

- **`@tanstack/react-query`**: Wrapped at the root via `AppProviders` (`src/AppProviders.tsx`) and `createAppQueryClient()` (`src/lib/queryClient.ts`). Use `useQuery` / `useMutation` for API caching, loading/error flags, and retries alongside existing `requestJson` / domain clients in `src/lib/`.

## Performance

- **Vite** `build.rollupOptions.output.manualChunks` groups React, general vendor libraries, and Recharts to improve caching and parallel loading.
- **Route-level code splitting**: Wrap lazy-loaded route components in `React.lazy` and rely on `AppContentChrome` Suspense (extend per domain as needed).

## Testing

- **Unit / component**: Vitest + Testing Library (`npm test`). Examples: `navigationRegistry.test.ts`, `BreadcrumbsBar.test.tsx`.
- **E2E**: Playwright (`npm run test:e2e`, config `playwright.config.ts`, specs under `e2e/`). The sample spec targets the public home shell; extend with authenticated flows when test credentials are available.
- **Accessibility (WCAG 2.1 AA)**: Rely on semantic landmarks, skip link, focus rings on interactive controls, breadcrumb `nav` with `aria-label`, and tables with explicit headers. Schedule periodic **axe-core** or manual audits on critical flows.

## Cross-browser and responsive behavior

- Layouts use Tailwind responsive breakpoints; sidebar is collapsible. Command palette and touch targets follow existing button patterns. Validate Chrome, Firefox, Safari, and Edge on desktop, tablet, and mobile widths before major releases.

## Deployment

- Production build: `npm run build` (outputs `dist/`). Serve `dist/` behind the same origin as the API or configure CORS and cookies per environment. Vite dev server proxies `/api` to the backend (`vite.config.ts`).
