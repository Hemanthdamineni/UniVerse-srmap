# Security Audit Waivers

> Maintained as evidence for Gate 1 P1 ("Dependency auditing automated:
> `npm audit --omit=dev` (both apps) or Dependabot in CI; zero known-critical
> vulns or waivers recorded"). Created 2026-08-28 against the prod-readiness
> audit (`docs/14-PROD-READINESS-CHECKLIST.md`).

This file documents the known vulnerabilities that are present in the
production dependency tree at the time of the audit, plus the rationale
for not blocking release on them and the remediation plan. New waivers
must be added when a new vuln appears; resolved vulns must be deleted.

## High-severity — waived

### `undici` 7.0.0 – 7.28.0 (Backend, transitive via Express 5)
- **Advisories:** GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272,
  GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm
- **Fixed in:** `undici@7.28.1+`
- **Blocker:** Express 5 pins `undici@^7`. Bumping `undici` independently
  is feasible but moves the project off the Express-tested matrix. Tracked
  as PR-side work; will land when Express publishes a minor that
  re-validates against a non-vulnerable `undici`.
- **Mitigation in the meantime:** the Express cookie + fetch surface used
  in this app does not exercise retry interceptors, private cache parsing,
  blob `type` reflection, or cookie attribute parsing on untrusted
  inputs from outside the trusted ERP integration boundary.

### `react-router` / `react-router-dom` 7.12.0 – 7.18.1 (Frontend)
- **Advisory:** GHSA-qwww-vcr4-c8h2 (RSC Mode CSRF bypass before 400
  response)
- **Fixed in:** `react-router-dom@7.19.0+`
- **Blocker:** pinned at 7.7.0 for compatibility with the existing
  `react-query` integration; bumping requires re-validating the
  router-level data loaders. Tracked in PR 4 (Frontend prod topology)
  follow-ups.
- **Mitigation in the meantime:** the app does not use React Server
  Components. The vulnerable code path is not reachable in the current
  build (`vite build` strips the SSR entry).

### `tar` ≤ 7.5.20 (Frontend, devDep)
- **Advisory:** GHSA-r292-9mhp-454m (uncontrolled recursion DoS)
- **Fixed in:** `tar@7.5.21+`
- **Blocker:** only used at build time by the Vite plugin chain; not
  shipped to the browser. DevDep audit is not gated by Gate 1 P1, but
  flagged here for completeness.
- **Mitigation:** the production bundle has no `tar` symbol.

### `body-parser` 2.0.0 – 2.2.2 (Backend, transitive)
- **Advisory:** GHSA-v422-hmwv-36x6 (DoS via invalid `limit` value)
- **Fixed in:** `body-parser@2.2.3+`
- **Blocker:** not directly used by the app — `express.json()` is the
  configured body parser. The vulnerable path requires a misuse we
  don't exercise.
- **Mitigation:** `app.use(express.json({ limit: '2mb' }))` is the only
  body parser enabled; the `body-parser` package isn't `require`d.

## Moderate-severity — accepted (no waiver required, tracked)

### `postcss` ≤ 8.5.22 (Frontend, devDep)
- **Advisory:** GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp
- **Status:** devDep only; not in production bundle.
- **Plan:** ride the next Tailwind 4 minor that updates its `postcss`
  range.

## Low-severity — accepted (no waiver required, tracked)

### `body-parser` (low)
- **Status:** transitive, no app-level exposure.
- **Plan:** roll forward when Express ships a compatible minor.

## How to update

When a new waiver is needed:
1. Add a section under "High-severity — waived" (or the matching tier).
2. Document the advisory IDs, the blocked-by version, the fix version,
   and a one-line mitigation explaining why the risk is acceptable in
   this app's deployment.
3. Reference the waiver in the PR description that introduces the dep
   or fails the audit check.
4. When a waiver is resolved (dep bumped, advisory retracted), remove
   the section. Do not leave stale waivers.
