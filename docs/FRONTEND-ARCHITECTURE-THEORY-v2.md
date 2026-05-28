# Frontend Architecture — Conceptual Theory
### University ERP Companion Platform
> v2 — refined with corrections

> This document defines the thinking behind the frontend architecture.
> It is intentionally free of implementation details — it describes *why*, not *how*.

---

## 1. The Fundamental Reality

Before any architecture decision, one truth must be accepted:

> **This frontend is a structured data viewer, not a complex application.**

The ERP system holds data. Students need to see it. This platform's job is to retrieve that data and present it clearly. The moment the architecture forgets this, it starts solving problems that don't exist.

Every complexity that exists in the current codebase can be traced back to treating display pages as if they were application pages.

---

## 2. What the System Actually Does

Breaking the system down honestly:

```
~80%   fetch data → format it → show a table
~15%   fetch data → format it → show a table + some action buttons
~5%    fetch data → transform it → custom interactive UI
```

The architecture must be honest about this distribution. A system designed for the 5% case and applied universally to the 80% case is the origin of unnecessary complexity.

---

## 3. The Three Layers

Every piece of code belongs to exactly one of three layers. The layer determines the code's purpose, scope, and lifetime.

```
┌─────────────────────────────────────────┐
│              PAGES                      │
│     What to show + light local logic    │
├─────────────────────────────────────────┤
│           PRESENTATION                  │
│         How things look                 │
├─────────────────────────────────────────┤
│          INFRASTRUCTURE                 │
│         How data is obtained            │
└─────────────────────────────────────────┘
```

### Infrastructure Layer

Knows how to talk to the ERP. Handles fetching, caching, errors, session management, and data sanitization. Returns clean, usable data.

**Critical boundary:** Nothing above this layer should know or care how data was obtained. Whether it came from cache, a live ERP request, or a fallback — that is entirely the infrastructure's concern.

### Presentation Layer

Defines the visual language of the application. Tables, cards, badges, layout blocks, status indicators. These components are mostly generic — they know nothing about ERP data structures or business rules.

However, some primitives will be domain-aware. A grade badge that knows how to colour an "O" grade differently from a "C" grade is encoding a *display rule* for a domain concept. This is acceptable. The distinction is:

> Presentation components may encode **display rules** for domain concepts.  
> They must not encode **data-fetching or transformation logic**.

A component that knows "O grades are green" is presentation. A component that knows "fetch the grade from this API key" is not.

### Pages Layer

Knows what to show, where to get it from, and applies light logic specific to that page.

A page is allowed to:
- Choose a data source
- Sort or filter data for display
- Select which columns or sections to show
- Apply minor, page-specific mapping and formatting
- Compose presentation components into a layout

A page is not allowed to:
- Contain reusable logic (it belongs in shared infrastructure or presentation)
- Contain complex domain logic (it belongs in a local module — see Section 5)
- Implement its own rendering primitives (it belongs in the presentation layer)

The distinction is not *no logic* but *no reusable or complex logic*.

---

## 4. The Shared vs. Local vs. Inline Decision

Every piece of logic needs to answer one question before it gets written:

> **How complex is it, and how many pages need it?**

This produces three tiers, not two:

```
Inline   →  trivial, used once, not worth extracting
Local    →  complex but specific to one page or domain
Shared   →  reusable across multiple unrelated pages
```

### Inline

Belongs directly in the page file. Examples: reversing a sort order, picking a display label from two options, formatting a date for one specific table.

The test: if removing it takes less than five lines and its absence is obvious, it was inline logic.

### Local

Belongs in a module local to the page or page group. Not shared. Not inline.

Examples:
- Attendance percentage classification rules
- Grade point calculation
- SGPA/CGPA prediction logic
- Semester grouping for results display

These share two characteristics: too complex to inline without obscuring the page, and too specific to share without creating false coupling between unrelated pages.

Local modules exist at the page level, not the application level. They are not reusable by design.

### Shared

Belongs in the application-level shared library. Earns this status by being genuinely needed in multiple unrelated places.

Examples: the sanitization utilities used by every page, the generic table component used everywhere, the fetch hook used by all ERP pages.

**The rule:** Don't promote logic to shared until two unrelated pages actually need it. Anticipated sharing is not sharing.

---

## 5. Page Classification

Pages fall into two categories. The architecture treats them differently.

### Display Pages

The majority. These pages exist to show data.

```
Fetch → Format → Show
```

Characteristics:
- No meaningful user interaction beyond reading
- Highly predictable structure (usually one or more tables)
- Formatting logic is simple and page-specific
- Local modules rarely needed; inline logic usually sufficient

Examples from this system: Earlier Semester Results, Attendance Details, Timetable, Fee Details, Curriculum.

These pages should be thin. If a display page is growing, it is absorbing responsibilities that belong in the presentation layer or a local module.

### Behaviour Pages

The minority. These pages do something beyond displaying data.

```
Fetch → Transform → Interact → Show
```

Characteristics:
- User interaction changes state or triggers actions
- Domain logic that isn't just formatting (calculations, predictions, registrations)
- May need multiple components working together
- Earn their own folder and local modules

Examples from this system: The SGPA Predictor, Exam Registration, Course Registration.

These pages earn complexity. Complexity for display pages is a smell. Complexity for behaviour pages is expected and should be contained in local modules rather than pushed into shared infrastructure.

---

## 6. Complexity Placement

Each type of complexity has a correct home.

| Complexity Type | Where It Lives |
|----------------|---------------|
| How data is fetched | Infrastructure |
| How data is cached | Infrastructure |
| How errors are handled | Infrastructure |
| How raw values are sanitized | Infrastructure |
| How a table looks | Presentation |
| How a badge renders a status | Presentation |
| Display rules for domain concepts (grade colours) | Presentation |
| Which data source to use | Page |
| Sorting, filtering, column selection | Page (inline) |
| Light, page-specific formatting | Page (inline) |
| Attendance percentage rules | Local module |
| Grade classification logic | Local module |
| SGPA calculation | Local module |
| Generic fetch behaviour | Shared infrastructure |
| Generic table rendering | Shared presentation |

When complexity lands in the wrong layer, the system fights itself. The clearest symptom is a presentation component that has to know about ERP-specific data structures, or a page that reimplements its own table rendering.

---

## 7. The Presentation Layer as Visual Language

The presentation layer defines a vocabulary of UI elements. Once defined well, every page speaks the same visual language without any page knowing about any other page.

**The vocabulary for this system:**

- A data table — columns, rows, optional sorting, status cells
- A section container — a card that wraps a titled block of content
- A status badge — PASS/FAIL result indicator
- A grade badge — domain-aware, encodes grade display rules
- An attendance percentage — domain-aware, encodes colour thresholds
- A page shell — title, loading state, error state
- A notes block — for supplementary text below main content

A few of these (grade badge, attendance percentage) are domain-aware primitives. They encode how to *display* domain values, not how to fetch or calculate them. This is the acceptable form of domain knowledge in the presentation layer.

**The key insight:** Reusability in this system lives in UI patterns, not data logic. Data logic is almost always page-specific. UI patterns are universal. The investment in the presentation layer pays dividends across the entire application.

---

## 8. The God Component Problem

The current architecture has a single component that handles everything for every page. This is the source of all the problems discussed.

A God Component accumulates responsibilities because it feels efficient. One place to change things. One place to look. But what actually happens:

- Every edge case from every page ends up in the same file
- Logic written for one page silently affects all pages
- The file becomes impossible to reason about
- New pages inherit complexity they don't need
- Simple pages and complex pages are treated identically

The solution is not to split the file arbitrarily into smaller files. It is to split it along responsibility boundaries — each piece going to the layer that owns that responsibility.

When this is done correctly, the God Component collapses to roughly its orchestration logic only, which is small.

---

## 9. Thin Wrappers Are Not a Problem

A common reaction to seeing files that are only a few lines is to think they are unnecessary. This is wrong.

Thin page wrappers serve real purposes:
- They are named entry points that make routing readable
- They are the correct place to add page-specific behaviour later without touching shared code
- They separate the concern of "what page is this" from "how does a generic ERP page work"
- They make the navigation structure visible at the file system level

A thin wrapper is the correct end state for a display page. If a display page wrapper is growing, something is in the wrong place.

---

## 10. When a Page Earns Its Own Folder

A page earns its own folder when it has at least two of the following:

1. Domain logic too complex to inline (a local module is needed)
2. Multiple sub-components that only make sense on this page
3. User interaction that changes state meaningfully
4. Local helpers that would confuse other pages if placed alongside shared code

By this rule, most pages in this system do not earn their own folder. The SGPA Predictor, Attendance, and Timetable do. Fee Details, Curriculum, Earlier Results do not.

Giving every page its own folder regardless of complexity is over-distribution — the opposite of the God Component problem, but similarly harmful because it fragments simple things unnecessarily.

---

## 11. The Two Failure Modes

### Over-Centralization

```
One file handles everything for all pages
```

Symptoms:
- Files with thousands of lines
- Logic for unrelated pages sitting next to each other
- Adding a new page means modifying a shared file
- Edge cases accumulate invisibly

This is where the codebase currently is.

### Over-Distribution

```
Every concept gets its own file regardless of complexity
```

Symptoms:
- Folders with dozens of nearly empty files
- Simple operations requiring imports from many places
- Shared files created for logic used only once
- The file structure becomes harder to understand than the logic itself

This is what premature or overzealous refactoring produces.

### The Correct Balance

```
Local clarity + selective sharing
```

Most logic lives close to where it is used. Logic earns shared status by proving it is needed in multiple places. Files are as large as their responsibility requires — not artificially small, not accidentally large.

---

## 12. Migration Thinking

When refactoring an existing codebase, the order of operations matters as much as the destination.

### Establish boundaries before moving code

Moving code before the destination is clearly defined just rearranges the problem. Each layer's responsibility must be agreed upon before extraction begins.

### Do not mix architectural styles mid-transition

This is the most practically dangerous mistake in a migration. If the old system (centralized blueprint rendering) and the new system (page-centric with shared presentation) coexist without clear boundaries, the result is worse than either alone.

Symptoms of a hybrid state:
- The same concern is handled in two different places depending on which part of the codebase you are in
- Developers are unsure which pattern to follow for new pages
- Bugs are fixed in one system but not the other

**The rule:** Define a clear cutover point. Either a page uses the old system or the new system. Never both simultaneously. During migration, the boundary should be explicit and visible, not gradual and blurred.

### Do not change behaviour during refactoring

Refactoring is restructuring without changing what the user sees. Mixing behaviour changes with structural changes makes both harder to verify.

### Move incrementally

Extract one responsibility at a time. Verify nothing breaks. Extract the next. The system remains functional throughout rather than entering a broken intermediate state.

---

## 13. What Does Not Need to Change

Identifying what to leave alone is as important as identifying what to fix.

In this system:
- The transformer and schema validation system is well-designed and solves a real problem
- The backend API layer is correct
- The visual design and UX of the pages is finished
- The thin page wrapper pattern is already right
- The overall routing structure works

The work is entirely internal to the rendering and data-passing pipeline. The user-facing result should be identical before and after the refactor.

---

## 14. Golden Rules

**Rule 1 — Match architecture to reality**
The architecture should reflect what the system actually does, not what it might someday do.

**Rule 2 — Pages orchestrate and apply light local logic**
If a page contains reusable or complex logic, that logic belongs somewhere else.

**Rule 3 — Three tiers of logic placement**
Inline for trivial. Local for complex but page-specific. Shared for genuinely reusable.

**Rule 4 — Reuse UI patterns, not data logic**
Data logic is almost always page-specific. UI patterns are universal. Invest in the presentation layer.

**Rule 5 — Don't abstract until duplication is real**
Anticipated duplication is not duplication. Wait until two unrelated pages actually share a need.

**Rule 6 — Complexity must be earned**
Display pages are thin by default. Behaviour pages earn local modules and component folders.

**Rule 7 — No hybrid states during migration**
A page uses the old system or the new system. Never both. The boundary must be explicit.

**Rule 8 — Leave working things alone**
The goal is not a perfect codebase. The goal is a codebase where future changes are easy to make safely.

---

## 15. One-Line Summary

> This frontend is a data-to-UI pipeline. Infrastructure gets the data. Presentation defines the molds. Pages pour data into the molds — and occasionally shape it first.
