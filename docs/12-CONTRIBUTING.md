# 12 — Contributing

> How to contribute. Covers the PR flow, code style, commit hygiene,
> the doc convention, and the design tokens every contributor needs
> to know. For how to set up the project, see
> **[10 — Development](./10-DEVELOPMENT.md)**. For how to write
> tests, see **[11 — Testing](./11-TESTING.md)**. For the operational
> concerns, see
> **[14 — Production Readiness Checklist](./14-PROD-READINESS-CHECKLIST.md)**.

The product design context — brand personality, visual direction,
design principles, brand colors — is in `AGENTS.md`, `CLAUDE.md`, and
`PRODUCT.md` at the repo root. Read at least one of those before
making UI changes.

## 12.1 Ground rules

- **One PR per logical change.** Don't bundle a refactor with a
  feature unless the refactor is required for the feature.
- **Don't push to `main` directly.** Always go through a PR.
  The CI matrix is the gate.
- **All 6 CI jobs must be green before merge.** The matrix catches
  tsc errors, test regressions, dead exports, and broken layouts.
  If a job is failing because of an unrelated reason, fix the
  reason before merging.
- **Don't add `git log -1 --format=...`-style blame annotations.**
  Git is the source of truth for "who did what when".
- **Don't commit secrets, ERP dump JSON, or `*.sqlite` files.**
  They're all in `.gitignore`. If you accidentally committed one,
  see the [16 — Contributor Cleanup](./16-CONTRIBUTOR-CLEANUP.md)
  doc for the recovery procedure.

## 12.2 The PR flow

1. **Branch from `main`.** Use a descriptive name:
   - `feat/<short-name>` for new features
   - `fix/<short-name>` for bug fixes
   - `chore/<short-name>` for refactors / cleanup
   - `docs/<short-name>` for doc-only changes

2. **Make atomic commits.** Each commit should be one logical
   change. The commit message should explain *why* (the rationale),
   not just *what* (the diff shows that). See
   [§12.5 Commit hygiene](#125-commit-hygiene) below.

3. **Open a PR with a description that includes:**
   - The motivation (what problem this solves, what user-facing
     change it makes)
   - The approach (high-level; the diff is the detail)
   - The risk (what could break; how to roll back)
   - A reference to the relevant doc (if any):
     `docs/02-ARCHITECTURE.md`, `docs/14-PROD-READINESS-CHECKLIST.md`,
     etc.
   - "Fixes #<issue>" if it fixes an issue

4. **Wait for CI.** All 6 jobs must be green. The
   `Responsive Layout Audit` job fails on viewport regressions; the
   `Knip dead-export check` fails on dead code; the rest catch
   test + type errors.

5. **Self-review before requesting review.** Re-read the diff
   top-to-bottom. Look for:
   - Unrelated changes (accidental edits from your editor, etc.)
   - Dead code (the new function is exported but never used)
   - Debugging `console.log`s you forgot to remove
   - Typo'd comments
   - Missing doc updates

6. **Get one reviewer.** Code review is required. The reviewer
   should be someone familiar with the area; if you're the only
   one, ask in the issue tracker. A PR with no reviewer can
   not be merged.

7. **Squash on merge.** The merge button squashes to a single
   commit on `main`. The squash message should follow the same
   convention as your commits (see §12.5).

## 12.3 Code style

### 12.3.1 JavaScript / Node (Backend)

- **Node 22+ syntax** (ESM optional, but the codebase uses CommonJS).
- **2-space indent**, single quotes, no semicolons only where
  consistent with the file (the codebase is mixed — follow the
  existing style in the file you're editing).
- **Named exports over default exports** for anything that has
  more than one thing to export.
- **Async/await, not `.then().catch()` chains**, except for trivial
  single-callback cases.
- **Error objects with `.status` and `.code` properties** —
  the global error handler in `app.js` reads these and turns them
  into structured `sendApiError` responses.
- **No magic numbers in route handlers** — pull them out to
  named constants at the top of the file.
- **No silent fallbacks** — if a feature is off, throw or return
  an explicit error. Don't default to "looks fine" when the
  data is missing.

### 12.3.2 TypeScript / React (Frontend)

- **TypeScript 5.8 strict mode** (the `tsconfig.json` is strict).
- **Function components + hooks, not classes.**
- **Use the existing `lib/` API clients** instead of hand-rolling
  `fetch` calls.
- **Use TanStack Query for server state**, not `useState` + useEffect.
- **Use Radix UI for primitives** (Dialog, Popover, etc.) — don't
  reimplement.
- **Use the design tokens in `src/styles/variables.css`** — never
  hardcode colors, spacing, or typography.
- **No `any` types.** Use `unknown` + a type guard if you don't know
  the shape.
- **No one-letter variable names** except in obvious contexts
  (the `useState` setter, the `map((x) => x.foo)` callback, etc.).
- **Use the path aliases** (`@/lib/...`, `@/components/...`) — not
  relative paths across directories.

### 12.3.3 Python (Career scraper)

- **Python 3.10+ syntax.**
- **`scraper/` is the entry point**; the supervisor is
  `Backend/src/services/career/careerScraperSupervisor.js` (Node).
- **Type hints** everywhere (`def scrape(url: str) -> dict:`).
- **4-space indent** (PEP 8), double-quote strings (the existing
  style).

## 12.4 The file-size rule

Per `AGENTS.md`, **no file may exceed 500 LOC without a documented
split plan** in `docs/14-PROD-READINESS-CHECKLIST.md` (or a new
section in `implementation_plan.md`).

Currently the largest files are:

| File | LOC | Status |
|------|-----|--------|
| `Backend/src/services/lms/lmsStore.js` | 3042 | Open — split plan is in 14-PROD-READINESS-CHECKLIST.md |
| `Backend/src/services/career/careerStore.js` | 2526 | Open — same |
| `Backend/src/services/events/competitionStore.js` | 2006 | Open — same |
| `Backend/src/services/events/eventsStore.js` | 1534 | Open — same |
| `Backend/src/services/lms/lmsTrackerService.js` | 1437 | Open — same |
| `Backend/src/services/lms/contentStore.js` | 619 | OK — under 1000 |

When a file approaches 500 LOC, prefer splitting at the natural
seam: data layer (store), business logic (service), and transport
(route). The split plan should be in the prod-readiness checklist
or a new `implementation_plan.md` entry.

## 12.5 Commit hygiene

### 12.5.1 Format

```
<type>(<scope>): <subject in imperative mood, 50 chars max>

<body — wrap at 72 chars. Explain what and why, not how.>
</body>

<footer>
BREAKING CHANGE: <description>  (if applicable)
Ref: docs/<file>#<section>  (if there's a doc reference)
</footer>
```

Types:

- `feat` — new feature
- `fix` — bug fix
- `chore` — refactor / cleanup (no behavior change)
- `docs` — doc-only
- `test` — test-only
- `ci` — CI / build infrastructure

Scopes (optional, in parens):

- `be` — backend
- `fe` — frontend
- `erp` — ERP integration
- `lms` — LMS
- `career` — career portal
- `events` — events
- `docs` — docs
- `ci` — CI

### 12.5.2 Examples

```
feat(events): add bulk-action endpoint for organizer moderation

The bulk-action endpoint lets an organizer select N events and apply
the same status change in a single request. Avoids N round-trips
for the common "mark 50 events as completed" workflow.

Request:
  POST /api/events/bulk-action
  { "eventIds": [...], "action": "mark-completed" }

Response:
  { "success": true, "data": { "updated": 47, "skipped": 3 } }

Ref: docs/14-PROD-READINESS-CHECKLIST.md (Gate 7)
```

```
fix(erp): handle captcha-timeout case in handleLogin

When the captcha session is > 25 min old, the handleLogin handler
was throwing a 500 (because req.body.sessionId was undefined and
the captcha lookup returned null). Now it returns 401 with
code "CAPTCHA_EXPIRED" so the SPA can request a fresh captcha
and retry without confusing the user.

Repro: log in, wait 26 minutes, try to log in again with the
same captcha → before: 500; after: 401 CAPTCHA_EXPIRED.
```

### 12.5.3 The 50/72 rule

- **Subject line**: 50 characters max.
- **Body lines**: 72 characters max.
- **Subject in imperative mood**: "Add X", "Fix Y", not "Added
  X", "Fixes Y".
- **Subject without a trailing period**.

If you can't explain the change in 50 characters, you're bundling
too much. Split.

## 12.6 Documentation

The platform has a living doc set under `docs/`. The doc set is
the source of truth for "how does X work" — if a doc disagrees
with the code, **the code is right**; open a PR to fix the doc.

### 12.6.1 The doc map

- `docs/00-INDEX.md` — table of contents, reading order
- `docs/01-OVERVIEW.md` — vision, users, feature list, tech stack
- `docs/02-ARCHITECTURE.md` — system shape, data flow, sequence diagrams
- `docs/03-BACKEND.md` — per-module deep-dive
- `docs/04-FRONTEND.md` — per-page reference
- `docs/05-DATA.md` — every SQLite schema, Redis namespace, file layout
- `docs/06-ERP-INTEGRATION.md` — Playwright pipeline, extractors
- `docs/07-API-REFERENCE.md` — every endpoint
- `docs/08-CONFIGURATION.md` — every env var
- `docs/09-INFRASTRUCTURE.md` — Compose, Dockerfile, Nginx
- `docs/10-DEVELOPMENT.md` — local setup, debugging, adding features
- `docs/11-TESTING.md` — test strategy, layers, how to write tests
- `docs/12-CONTRIBUTING.md` — this file
- `docs/14-PROD-READINESS-CHECKLIST.md` — the gates (P0/P1/P2)
- `docs/15-DEBUGGING-NOTES.md` — recurring failure modes
- `docs/16-CONTRIBUTOR-CLEANUP.md` — contributor-rewriting history
- `docs/17-DEPLOYMENT-GUIDE.md` — free-tier deploy walkthrough

### 12.6.2 When to update a doc

| Change | Doc to update |
|--------|--------------|
| New env var | `08-CONFIGURATION.md` (add a row to the right table) |
| New HTTP endpoint | `07-API-REFERENCE.md` (add a row; the next regen of the table will pick it up) |
| New SQLite table or column | `05-DATA.md` (add a row to the per-DB table) |
| New Redis key | `05-DATA.md` §5.2 (add a row) |
| New page in the SPA | `04-FRONTEND.md` §4.6 (add a row to the right per-page table) |
| New router in the backend | `03-BACKEND.md` §3.4 (add a row) |
| New extractor in the ERP pipeline | `06-ERP-INTEGRATION.md` §6.5 |
| New architecture decision | `02-ARCHITECTURE.md` (the relevant section) |
| New deployment-related env or compose change | `09-INFRASTRUCTURE.md` (and `.env.example` + `docker-compose.yml`) |
| Anything user-visible | The relevant feature page (Events/Career/LMS/...) |

The doc-set index (`docs/00-INDEX.md`) is auto-regenerated each time
docs are added or removed.

### 12.6.3 The doc format

Each doc starts with a "Status" line and a "Last Updated" line.
The body is organized into numbered sections (§1, §2, ...) with
short, scannable headings. Tables are preferred over prose for
reference material. Code blocks are wrapped in fences with the
language hint.

```markdown
# XX — Title

> **Status:** Active. This doc is the canonical reference.
> **Last Updated:** 2026-08-30

## 1. Section heading

Short paragraphs. Tables for reference.

## 2. Another section

| Col 1 | Col 2 |
|-------|-------|
| a     | b     |
```

## 12.7 The design system

All design tokens live in `Frontend/src/styles/variables.css` as
CSS custom properties. Never hardcode colors, spacing, or
typography. The token system:

### 12.7.1 Color tokens

```css
--comp-accent: <brand teal>;
--comp-accent-fg: <contrast color for accent>;
--background: <page background>;
--surface: <card / panel background>;
--text-primary: <main text>;
--text-secondary: <muted text>;
--border: <divider / outline>;
--success: <green>;
--warning: <amber>;
--danger: <red>;
```

The brand colors are documented in `PRODUCT.md` / `AGENTS.md` /
`CLAUDE.md`. Don't change them.

### 12.7.2 Spacing, radius, shadow, motion

Same pattern: `--space-1` through `--space-12`, `--radius-sm` /
`--radius-md` / `--radius-lg` / `--radius-full`, `--shadow-sm` /
`--shadow-md` / `--shadow-lg`, `--ease-out-expo` (the "Pristine Studio"
motion curve). See `variables.css` for the full list.

### 12.7.3 The motion contract

The platform uses a single spring curve for all transitions:
`cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). It feels "responsive,
natural, not bouncy". Use it for:

- Card hovers (subtle scale + shadow)
- Modal/popover open/close
- Page transitions
- Tab switches
- Toast notifications

Don't use:

- Bouncy springs (overshoots)
- Linear timing (feels mechanical)
- Spinning loaders (use skeleton cards instead)

### 12.7.4 The dark-mode contract

The platform supports full light + dark mode. The dark-mode palette
is in `variables.css` under `:root[data-theme="dark"]`. Every
component should use the tokens, not raw colors. If you find
yourself typing `#1a1a1a`, stop and add a token.

## 12.8 The review checklist

Before requesting review, walk through this:

- [ ] **Tests pass** — `cd Backend && npm test`, `cd Frontend && npm test`,
  `cd Frontend && npx playwright test --config=playwright.config.realstack.ts`
- [ ] **TypeScript clean** — `cd Frontend && npx tsc --noEmit -p tsconfig.json`
- [ ] **Build clean** — `cd Frontend && npm run build`
- [ ] **Knip clean** — `npx knip` (no new dead exports)
- [ ] **No debug `console.log`s left behind**
- [ ] **No unrelated changes** in the diff
- [ ] **Doc updated** if the change is user-visible
- [ ] **Commit messages** follow the 50/72 rule
- [ ] **Branch is up-to-date with `main`** (rebase if needed)
- [ ] **No secrets, dump files, or `*.sqlite` in the diff**

## 12.9 The release process

There is no formal release process yet. The current pattern is:

1. Land PRs on `main` throughout the week.
2. Tag a release commit on Friday: `git tag -a v0.x.y -m "..."`.
3. The Docker image is built from `main` (CI builds on every push
   to `main`); a tag is just a stable pointer for deployment.
4. The deployment itself is per-host (see
   [17 — Deployment Guide](./17-DEPLOYMENT-GUIDE.md)).

The version scheme will be `0.x.y` until the platform is feature-
complete; then `1.0.0`. Until then, treat every commit on `main`
as the latest release.

## 12.10 Issue triage

When an issue comes in, classify it before doing anything:

- **P0** — security, data loss, anything that breaks login or ERP
  for all users. Fix immediately.
- **P1** — major feature broken, a major user flow affected, or a
  confirmed production bug. Fix within a week.
- **P2** — minor feature broken, a workaround exists. Fix when
  convenient.
- **P3** — cosmetic, nice-to-have. Add to the backlog.

The prod-readiness checklist has its own P0/P1/P2 scheme; the issue
tracker uses the same.

## 12.11 Communication

- **Discussions** for open-ended questions, design proposals, or
  when you want feedback before writing code.
- **Issues** for concrete bugs, feature requests, or tasks.
- **Pull Requests** for changes to the code or docs.
- **CI** for the build status. Don't email the maintainer about a
  failing build — the CI is the canonical record.

## 12.12 Code of conduct

This is a student project run by one person (`@Hemanthdamineni`).
The "code of conduct" is:

- Be kind, be direct, be brief.
- Code is the conversation. If a code review comment is unclear,
  ask for clarification rather than guessing.
- Don't take it personally. The reviewer is reviewing the code,
  not you.
- If you disagree, push back. "I think X is better because Y" is
  the correct response to "you should do X".
- Don't make the reviewer do your thinking. "Should I do A or B?"
  is fine; "I don't know what to do" is not.

## 12.13 When in doubt

- **Look at the existing code first.** 99% of "how should I do X"
  questions are answered by "look at how X is already done in this
  codebase". The codebase has 90K lines of examples.
- **Look at the docs.** `docs/02-ARCHITECTURE.md` is the
  starting point. `docs/15-DEBUGGING-NOTES.md` has the "this
  failure looks like X but is actually Y" gotchas.
- **Look at the tests.** Tests are the executable spec. If you
  don't know what a function is supposed to do, read its tests.
- **Ask.** Open a Discussion. The author checks GitHub
  notifications daily.
