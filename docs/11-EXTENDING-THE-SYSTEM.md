# 11 — Extending the System

This guide outlines the step-by-step process for adding new features, specifically focusing on the most common task: adding a new ERP page to the frontend.

---

## 11.1 Adding a New ERP Page

Adding a new ERP view requires updates across the stack, from endpoint discovery to frontend rendering. All steps follow the schema-driven, pipeline-guarded architecture.

### Step 1: Endpoint Discovery (Backend)

We first need to map the ERP's menu item to its internal JSP endpoint.

1. Locate the page in the actual SRM AP ERP menu (e.g., "Academic" dropdown → "Course Registration" subitem).
2. Note the exact text of the dropdown and subitem.
3. Keep an eye on `Backend/data/endpoint-discovery.json`. If the page is missing, run:
   ```bash
   cd Backend
   npm run discover:endpoints
   ```
   *Note: This script requires active user credentials and launches a Playwright browser to map the menu.*

### Step 2: Add Scrape Target (Backend)

Update the backend targets so the scraping engine knows what to fetch.

1. Open `Backend/src/config/scrapeTargets.js`.
2. Add a new `pageKey` (use kebab-case, e.g., `academic/course-registration`).
3. Define the targets required for this page:
   ```javascript
   "academic/course-registration": [
     { dropdown: "Academic", subitem: "Course Registration" }
   ]
   ```
   *(You can list multiple targets if your page aggregates data from different ERP sections).*

### Step 3: Define Page Policy (Backend)

Decide if this data should be cached or fetched fresh.

1. Open `Backend/src/config/erp-page-policy.json`.
2. Add your new `pageKey` to the appropriate list or override:
   - If it's historical data (like past results), add to `cachedFirstPrefixes`.
   - If it's transactional (registering for courses, paying fees), add to `liveFirstPrefixes`.

### Step 4: Define Payload Contract (Backend)

Tell the backend what a "valid" response looks like for this page to prevent caching invalid data (like unexpected login pages).

1. Open `Backend/src/config/erpPayloadContracts.js`.
2. Add a conditional check:
   ```javascript
   if (pageKey === "academic/course-registration") {
     return {
       requireTargetSections: true,
       rejectSuspiciousText: true,
       minTableCount: 1, // Require at least one table of courses
       allowMeaningfulTextFallback: false,
     };
   }
   ```

### Step 5: Define Transformer & Schema (Frontend)

Now move to the frontend to handle the raw data.

1. Open `Frontend/src/lib/erpTransformers.ts`.
2. Create an interface for the domain model (e.g., `CourseRegistrationModel`).
3. Create a schema definition (`courseRegistrationSchema`).
4. Write a transformer function (`transformCourseRegistration(rawData)`) that extracts primitives safely using `normalizeRawValue()`.
5. Register it in `registry` and `schemas`.

### Step 6: Create the Frontend Blueprint (Frontend)

Connect the React routing to your new page.

1. Open `Frontend/src/config/erpBlueprints.ts`.
2. Add an entry to `PAGE_BLUEPRINTS`:
   ```typescript
   "/academic/course-registration": {
     route: "/academic/course-registration",
     heading: "Course Registration",
     fetchKeys: ["academic/course-registration"],
     sourceMode: "erp",
     renderer: "course-registration", // Matches your transformer key
     loadingMessage: "Loading available courses...",
   }
   ```
3. Add the route to `MAIN_NAV` so users can click it in the sidebar.

### Step 7: Create the React Component (Frontend)

1. Create `Frontend/src/pages/Academic/CourseRegistrationPage.tsx`.
2. Fetch data via `getErpBatch()`.
3. Process data via `executePipeline()`.
4. Render the typed model data safely.
5. *(Optional)* If the page is simple enough, you don't even need a custom component. The generic `<BlueprintPage />` can render it using standard layout blocks based on your transformer.

---

## 11.2 Adding a New Platform Module (Non-ERP)

If you are building an independent feature (e.g., "Helpdesk") that does not rely on ERP data:

1. **Database:** Add a new SQLite database in `Backend/data/` or integrate into `contentStore`/`eventsStore`.
2. **Backend Service:** Create `Backend/src/services/helpdeskStore.js`.
3. **Backend Route:** Create `Backend/src/routes/helpdeskRoutes.js` and mount it in `src/app.js` (`/api/helpdesk`).
4. **API Client:** Create frontend service `Frontend/src/lib/helpdeskApi.ts` utilizing `fetch`.
5. **Blueprint:** Register the route in `erpBlueprints.ts` using `sourceMode: "internal"`.
6. **Component:** Build standard React components fetching from your new `/api/helpdesk` endpoint.

---

## 11.3 Building New UI Renderers

To extend the schema-driven document renderer:

1. Open `Frontend/src/components/erp/ErpDocumentRenderer.tsx`.
2. Find the main `switch (node.type)` block.
3. Add a new `case` for your node type (e.g., `case "chart":`).
4. Build the rendering logic, extracting properties from `node.props`.
5. For best practices, put complex UI implementations in `ErpPrimitives.tsx`.
