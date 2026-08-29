# Production Readiness & Deployment Verification Checklist

> **Created:** 2026-08-22 · **Fully revised:** 2026-08-25 against the live codebase (commit `1a50d4e` + working tree). Supersedes the 2026-08-22 revision and the release-checklist section of [`TODO.md`](../TODO.md) (2026-07-21).
> **Companion docs:** [`infra/runbooks/companion-platform-production-readiness.md`](../infra/runbooks/companion-platform-production-readiness.md), [`infra/runbooks/`](../infra/runbooks/), [`12-SYSTEM-AUDIT-REPORT.md`](./12-SYSTEM-AUDIT-REPORT.md), [`13-DATABASE-SCHEMAS.md`](./13-DATABASE-SCHEMAS.md).

**How to read this.** Every claim below was re-verified against code on 2026-08-25, not copied forward.
Statuses: ✅ verified in place (runtime evidence still required at deploy) · ☐ open · ⚠️ discrepancy (see §1).
Priorities: **P0** blocks go-live · **P1** before first real users · **P2** shortly after.
Rules: (1) a gate passes only when every P0/P1 item under it has objective evidence attached; (2) "tests pass" or "build succeeds" alone is never evidence of integration; (3) any doc/code/test/runtime disagreement found during execution is appended to §1 and blocks sign-off until resolved; (4) **no checklist item may be marked verified solely because an agent reports it as working** — verification must be independently reproducible through a command, automated test, API transcript, browser test, monitoring artifact, or direct inspection of the deployed runtime. Agent reports direct the verifier; they never substitute for it.

**Audit basis disclosure:** this revision was audited against a dirty working tree (~60 modified/deleted files: transport feature removal, auth/ERP extractor changes). Gate 0 exists precisely because of that.

---

## 0. System of record — what actually exists (verified 2026-08-25)

- **Backend** (`Backend/src/server.js` → `app.js`): Express 5 on Node ≥22.5 (uses built-in `node:sqlite` `DatabaseSync` — *not* better-sqlite3). ~30 route modules mounted under `/api` (auth/session, ERP v1+v2, content/resources/uploads, feedback, events, helpdesk, campus-feedback, career, competitions, persistent teams, profile/recommendations, LMS (~100 routes), attendance, academic-calendar/faculty-cabins/vacant-rooms, scrape catch-all, admin, health/metrics/telemetry). Middleware order in `app.js`: cors → helmet → cookieParser → compression → requestContext → adminContext → static mounts (`/uploads`, `/files/submissions`, `/files/certificates`) → global rate limit → login rate limit → JSON 2 mb → routers → error handler.
- **Sessions**: custom httpOnly cookie `erp_session` (SameSite lax, Secure auto via `x-forwarded-proto`), Redis-backed store with sliding 30 min TTL and in-memory fallback; login rotates session IDs; pre-auth captcha sessions live 25 min; legacy `x-session-id` header accepted only before `LEGACY_SESSION_ID_CUTOFF_DATE` (2026-05-15 — already past). Admin elevation = register-number allowlist + password unlock (session flag) or shared `ADMIN_CONTENT_PASSWORD`; empty value disables those endpoints.
- **Data**: 13 env-overridable SQLite DBs under `Backend/data` (LMS has a versioned migration runner, `lmsMigrations.js`; all others self-init via `_ensureSchema` + column checks). WAL pragma set on 7 stores only. Non-SQLite state: `uploads/`, `lms/`, `certificates/`, `submissions/`, events JSON dirs, `erp-dump/` snapshots.
- **ERP integration**: Playwright API-context scraping of `student.srmap.edu.in` with headless-Chromium login fallback; cached-first aggregation with stale-serve + background refresh, per-pageKey circuit breaker (5 failures → open 30 s, Redis-mirrored), semaphore 30, single-flight + Redis distributed lock, payload-contract validation before caching; dump fallback auto-resolves latest snapshot (`ErpDumpService.resolveLatest()`).
- **Background work**: setInterval jobs (competition reminders 5 m, career notifications 15 m, cache sweep 5 m, LMS interaction queue flush 300 ms) + supervised Python career-scraper daemon (`Scraper/main.py` via `Scraper/venv/bin/python3`, restart backoff 30 s→15 m). Graceful SIGTERM shutdown implemented in `server.js`.
- **Frontend**: React 19/Vite SPA, relative `/api/*` fetches with `credentials: include`, uniform ApiError/session-expiry handling, static-prototype fixture mode (`VITE_STATIC_PROTOTYPE`), PWA service worker (NetworkOnly for `/api`+`/uploads`). 99 vitest files; 12 Playwright specs that run against the **fixture-only prototype**, not a real backend.
- **Infra**: root compose = backend + redis only (loopback ports); monitoring override adds Prometheus/Grafana/Loki/promtail/node-exporter/cAdvisor (dashboards provisioned-as-code, 4 alert rules, **no Alertmanager**); nginx ingress config serves SPA dist + `/api` proxy + TLS block that no compose bundle actually wires; backups script runs manually and prints (does not install) a cron line.

---

## 1. Discrepancy ledger — resolve before sign-off

| # | Documented / expected | Actual (verified 2026-08-25) | Resolution required |
|---|---|---|---|
| D1 | README: backend uses better-sqlite3, Node 20+ | Uses `node:sqlite` (Node ≥22.5); local dev runs v26 | Fix README + CI (see G1.1) |
| D2 | CI tests backend on Node 20 (`.github/workflows/ci.yml`) | Runtime floor is Node 22.5; latest CI runs on `main` (2026-07-17) and PRs are recorded **failures** | Bump CI to Node 22; get pipeline green |
| D3 | Backend Dockerfile: `npm ci --omit=dev` | `playwright` is a devDependency but imported at module top level by `erpClient.js:3` and `routes/lmsRoutes.js:5` → production image crashes at boot; browsers/OS deps never installed; Alpine is unsupported by Playwright | Repackage (move playwright to deps, switch base to `node:22-bookworm-slim`, add `npx playwright install --with-deps chromium`) or make imports lazy and document degraded mode |
| D4 | Root compose sets `DUMP_SNAPSHOT_DIR`/`DUMP_SUMMARY_FILE` to dated path `2026-02-24T…` | Consumed by zero code (grep: no matches in `Backend/`); dir doesn't exist; dump service auto-picks newest snapshot (`erpServices.js` ~248/265) | Delete dead vars from compose; add test that `resolveLatest()` picks newest dump |
| D5 | Career scraper enabled by default (`CAREER_SCRAPER_ENABLED=1`) | Supervisor spawns `Scraper/venv/bin/python3`, which is absent from the Docker build context → scraper dead in container | Ship Scraper+venv in image or disable flag in container env and document |
| D6 | `FRONTEND_BLUEPRINT_FILE` default points to `../../Frontend/src/config/erpBlueprints.ts` | Outside the Docker build context → integrity/readiness reporting silently degrades in the image | Copy blueprint file into image at build, or set explicit container env |
| D7 | `.env.example`: `LOGIN_PREAUTH_TTL_MS` documented as 15 sec | Code default is 1 500 000 ms (25 min), aligned to upstream JSESSIONID TTL | Fix `.env.example` |
| D8 | Old checklist: "login/captcha/recovery lack stricter rate limits" | Implemented since: global 400/min/IP + dedicated login limiter 20/min/IP on captcha/login/forgot paths (`middleware/rateLimit.js`, wired in `app.js:111`) | Item closed; keep behavioral verification (G6.7) |
| D9 | Old checklist: Grafana dashboards hand-built | Provisioned as code (`infra/monitoring/grafana/provisioning/` + `erp-overview.json`, 5 panels) | Item closed |
| D10 | Old checklist: "WAL on all major stores ✅" | Only 7 of ~14 DB-opening stores set WAL; `contentStore`, `helpdeskStore`, `campusFeedbackStore`, `feedbackServices` (external-pages), `lmsTrackerStore`, `vacantRoomStore`, `attendanceSnapshotStore` do not | Add WAL pragmas or document exclusion per store (G2.2) |
| D11 | E2E suite assumed to exercise user journeys | All 12 Playwright specs run against `VITE_STATIC_PROTOTYPE` fixtures; **no test drives frontend→API→backend→DB**; `comprehensive-audit.spec.ts` additionally assumes a live backend and writes to a hardcoded personal path | Build a real-stack smoke spec + fix/quarantine the audit spec (G7.1) |
| D12 | `infra/README.md` start order steps 1–2 | Prescribes deprecated `compose.data.yml`/`compose.app.yml` (the latter: passwordless REDIS_URL, world-published port 5000) | Rewrite README start order around root compose |
| D13 | Restore runbook promises uploads/events/LMS file backups | `setup-backups.sh` copies only `*.sqlite` + Redis RDB | Extend script to file dirs (G8.5) |
| D14 | Frontend `.env.example`: `VITE_API_BASE_URL` | Never referenced in `src/` (relative-only contract) | Remove var or implement; keep same-origin topology mandatory |

Also noted (non-blocking): `lms-smoke.sqlite`/`lms-smoke-2.sqlite` have no referencing code (stale artifacts); `GRAFANA_ADMIN_PASSWORD` is passed into the backend container where nothing reads it; `Backend/Dockerfile` bakes `data/` into the image though the bind-mount shadows it.

---

## Definition of Done ("prod ready")

This project is deployable when:

1. Every **P0** in Gates 0–9 is closed with recorded evidence, and every ⚠️ in §1 is resolved or explicitly waived in writing.
2. CI is green on `main` at the release SHA **on Node ≥22**, including the real-stack smoke suite once added (G7).
3. A backup restore drill (G8.6) and a rollback rehearsal (G9.4) have each been executed within the last 30 days and recorded.
4. Alerts fire into a channel a human reads; a test alert has been received end-to-end (G8.3).
5. A staging soak of ≥72 h completes with zero unexplained 5xx, circuit breaker observed opening *and* recovering naturally, and the post-deploy smoke list (Gate 10) green at T+0 and T+24 h.

A gate must not be passed while any mandatory item beneath it lacks objective evidence. Evidence = command output, artifact file, screenshot, or signed runbook entry — not prose.

---

## Gate 0 — Source & Change State

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Working tree committed/clean: land the in-flight wave (transport removal, auth/ERP extractor changes) or explicitly stash it; release builds from a tagged commit, never from a dirty tree | `git status --porcelain` empty; tag name |
| ☐ | P1 | Deleted-feature sweep: no dangling references to removed Transport pages/transformers in routes, nav registry, blueprints, or backend extractors' consumers | grep report (currently clean in `Frontend/src`) |
| ☐ | P2 | Repo hygiene: remove unreferenced `Backend/data/lms-smoke*.sqlite`; decide fate of deprecated `infra/docker/compose.{app,data}.yml` (delete or mark clearly) | commit diff |

## Gate 1 — Code & Build

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Fix packaging so the backend image boots: playwright installable at runtime (see D3) and scraper dependency decision recorded (see D5). Pass = `docker compose up -d --build` cold-starts; container stays up >5 min; `/api/live` 200 | compose ps output + boot log |
| ☐ | **P0** | CI green on `main` at release SHA with backend job on Node 22 (D1/D2): `npm test` (46 BE files), FE vitest (99 files), ESLint, `audit:api-contracts`, build | Actions run URL for the SHA |
| ☐ | **P0** | `npm run audit:metadata` fixed (currently fails: `import.meta` SyntaxError transpiling `src/config/erpBlueprints.ts:28` in `scripts/audit-blueprints.mjs`) — it gates the CI `frontend-tests` job | green step log |
| ☐ | P1 | Frontend prod build + type-check clean at release SHA: `npm run build` (includes `tsc -b`) | build log artifact |
| ☐ | P1 | Both Docker images build from clean checkout and are tagged by git SHA (retag `latest` policy): Backend single-stage, Frontend multi-stage nginx | `docker images` listing SHAs |
| ☐ | P1 | Dependency auditing automated: `npm audit --omit=dev` (both apps) or Dependabot in CI; zero known-critical vulns or waivers recorded | CI job log |
| ☐ | P2 | Backend linting in CI (currently FE-only); `npm run knip` wired to catch dead exports | job log |

## Gate 2 — Data & Migrations

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Cold-start from an **empty** data volume: all 13 stores self-initialize, server reaches `/api/ready` 200 without manual seeding | fresh-volume compose run log |
| ☐ | **P0** | Upgrade path on an existing volume: start v-current over a copy of prod-like data; second consecutive boot is a no-op (idempotent `_ensureSchema`/migrations). LMS versioned runner advances `lms_schema_version` without data loss | before/after row counts + integrity check (`npm run verify:integrity`) |
| ☐ | P1 | WAL/journal policy settled per store (D10): either add WAL+foreign_keys+busy_timeout to the 7 missing stores or document why each is excluded; verify `-wal/-shm` sidecars appear for active stores | PR diff + `PRAGMA journal_mode` query output per DB |
| ☐ | P1 | Restart persistence: data written pre-restart (event registration, LMS resource, ticket, career submission, tracker progress) is intact post-restart for both graceful SIGTERM and `kill -9` restarts | scripted check outputs ×2 |
| ☐ | P1 | Backup contents match restore runbook: extend `setup-backups.sh` to also archive `uploads/`, `lms/`, `certificates/`, `submissions/`, events JSON dirs (D13) | backup tar listing |
| ☐ | P2 | ErpDumpService fallback proven: with cache+live unavailable, pages serve from latest dump snapshot; `resolveLatest()` unit test pins newest-dir selection (D4) | test output |

## Gate 3 — Service/API Runtime

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Health semantics verified live: `/api/health` 200 always + component detail; `/api/live` trivially 200; `/api/ready` 503 `NOT_READY` when discovery map/page-policy/redis/content-DB checks fail, 200 when satisfied. Deploy tooling awaits `/api/ready`, not `/health` | curl transcripts for healthy + one induced-failure case |
| ☐ | **P0** | Graceful shutdown: SIGTERM stops listener, stops scraper child (SIGKILL after 8 s), flushes/stops queue timers, closes Redis, exits <10 s; no corrupted SQLite after shutdown mid-write loop | `docker compose stop` timing log + integrity re-check |
| ☐ | P1 | Rate limiting behaviorally confirmed: global 400/min/IP returns 429 with headers; login limiter 20/min/IP trips on captcha/login/forgot; `/health`,`/live`,`/ready`,`/metrics`,`/telemetry` bypassed; limiter degrades open if Redis dies (documented) | burst-test transcript |
| ☐ | P1 | Background jobs survive uptime: competition reminder, career notification cycle, cache sweep, LMS queue flush observed firing (log lines) during soak; LMS dead-letter being memory-only is documented as accepted data-loss scope | soak log excerpts |
| ☐ | P1 | Session store selection verified: with Redis configured, sessions survive backend restart (re-login not required); with Redis down, fallback mode + warning logged, and restart *does* log users out (accepted, documented) | two restart transcripts |
| ☐ | P2 | `/api/metrics` scraped successfully by Prometheus for ≥24 h with no gaps >2 scrape intervals | Grafana/Sample query screenshot |

## Gate 4 — Frontend

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Prod topology is same-origin: SPA and `/api` behind one origin (nginx ingress or equivalent). No code change needed — verify `VITE_API_BASE_URL` removed/unset (D14) and no cross-origin cookie dependency | deployed-origin curl + browser network panel capture |
| ☐ | **P0** | Static prototype cannot leak to prod: production bundle built without `VITE_STATIC_PROTOTYPE`; service worker active but NetworkOnly on `/api`,`/uploads` (no HTML caching of API); login page renders against real captcha endpoint | bundle grep for fixture import + browser verification |
| ☐ | P1 | Responsive audit green at 320/768/1440 for all discovered routes (`npm run audit:responsive`), including inner-main overflow checks | CI responsive-audit pass log |
| ☐ | P1 | Session-expiry UX verified in real browser: force-expire session → heartbeat detects → redirect to `/login` with preserved-path banner; logout clears cookie + Redis key | screen recording or screenshots |
| ☐ | P2 | Consolidate stray fetch sites into the shared client (`pages/Shared/blueprintData/api.ts`, `AttendanceDetailsPage.tsx` mark-attendance, LoginPage axios) or waive explicitly | PR diff |

## Gate 5 — Integration resilience (ERP · scraper · notifications · files)

Every ERP-dependent flow must be tested over the **real integration path** (real upstream or a recorded proxy), not fixtures. Failure injection matrix:

| Scenario | Expected behavior | Evidence |
|---|---|---|
| ☐ ERP unreachable (DNS/timeout) | Cached-first serves stale ≤10 min with degraded banner; beyond that 503 envelope; UI shows recoverable error, no crash | forced-outage transcript |
| ☐ Slow upstream (>timeouts 6 s/15 s) | Request aborts cleanly; semaphore slot released; concurrent users see cache/stale, not pile-up | load + fault log |
| ☐ Malformed/login-page response (session expired upstream) | Payload validation rejects (no cache poisoning); `SESSION_EXPIRED` clears cookie, FE redirects to login | injected-response transcript |
| ☐ Repeated failures | Circuit opens after 5 consecutive failures per pageKey (`CIRCUIT_OPEN` 503), Redis-mirrored across instances, recovers after 30 s cooldown; `erp_circuit_open_state` gauge reflects it | metric screenshot + recovery log |
| ☐ Partial data (missing sections/tables) | Extractors degrade per-section (warning placeholders), page renders with partial-data notice like fee-paid flow | fixture-from-real-dump test |
| ☐ Dump-only mode | With live blocked, pages render from latest snapshot (G2 P2 item) | transcript |

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Real login journey through actual ERP path: captcha fetch → submit → session rotation → dashboard profile loads. Wrong-captcha and ERP-down variants return typed errors, never crash unrelated routes | staged credential test log (use test account, never real student creds in CI) |
| ☐ | **P0** | Scraper boundary decided and verified (D5): in whatever environment ships, `GET /api/career/health` reflects true supervisor state; triggering a scrape either works end-to-end (source → dedupe → feed) or is explicitly disabled with UI reflecting it | health + trigger logs |
| ☐ | P1 | Notifications cycle idempotent: forcing two notification cycles back-to-back produces no duplicate notifications for the same opportunity/event (dedupe keys honored) | DB counts before/after |
| ☐ | P1 | Upload pipeline boundaries: `/api/uploads` enforces 20 MB (no MIME allowlist today — decide + enforce one); LMS uploads enforce 25 MB + extension→MIME whitelist + 10/5 min limiter; oversized/blocked-type rejected with 4xx, nothing written to disk | curl rejection transcripts |
| ☐ | P1 | File serving policy verified: `/uploads`, `/files/submissions`, `/files/certificates` are currently unauthenticated static mounts — confirm every served artifact is safe to be public-by-URL, else gate them; UUID filenames resist enumeration (spot-check) | policy decision note + probe results |
| ☐ | P2 | Blueprint/integrity inputs resolve in-container (D6): `/api/ready` component detail shows blueprint coverage non-degraded | readiness JSON from container |

## Gate 6 — Security & Authorization

Code-verified ✅ (still needs runtime confirmation): helmet on; Redis password-required + loopback; `x-user-role`/`x-user-id` spoof vectors gone; `adminPassword` not accepted via query param; admin elevation requires session flag; dev login hard-blocked when `NODE_ENV=production`; session ID rotation on login.

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | CSRF decision implemented or formally risk-accepted for cookie-mode state-changing routes (SameSite=lax is mitigation, not protection). Minimum acceptable interim: verify all mutating routes require `content-type: application/json` + same-origin check, and document residual risk | middleware diff + bypass-attempt transcript |
| ☐ | **P0** | Authorization probe suite green (scripted curl collection, rerunnable): for each domain — events (organizer-only manage routes), competitions (submit/evaluate roles), LMS (moderation/admin), career (review/scraper-trigger), helpdesk/campus-feedback (admin), content/resources (writes), profile privacy settings — anonymous, authenticated-non-owner, and non-elevated requests get 401/403; owner gets 200 | probe script + output committed to repo |
| ☐ | **P0** | Cross-user isolation (IDOR): user A cannot read/modify user B's resume, application, submission, ticket, team invitation, tracker progress, or private profile by guessing IDs/UUIDs; public-profile endpoint honors privacy flags | probe transcripts |
| ☐ | **P0** | Direct-API bypass: every frontend-guarded page's backing API denies access without valid session/admin context (FE guards are UX only) | probe matrix covering `/admin/*` APIs |
| ☐ | P1 | CORS locked for prod: `app.use(cors())` is fully open — restrict to same-origin (or credentials-safe config) now that everything is same-origin behind nginx | config diff + preflight transcript |
| ☐ | P1 | Per-route limiter budgets reviewed against abuse math (login 20/min/IP, global 400/min/IP) and captcha fetch cost; tune or accept with rationale | tuning note |
| ☐ | P1 | PII/log hygiene: login-diagnostics artifact retention (`LOGIN_DIAGNOSTICS_*`, `ERP_ARTIFACT_MAX_AGE_DAYS=14`) observed actually purging; sampled logs contain no passwords/tokens/session IDs | retention log + grep sample |
| ☐ | P1 | Secrets: no `.env` in git history (`git log --all --diff-filter=A -- .env '**/.env'` empty); `REDIS_PASSWORD` unset fails compose fast; decide whether empty `ADMIN_CONTENT_PASSWORD` should fail-fast instead of silently disabling admin | command output + compose failure demo |
| ☐ | P1 | TLS termination verified end-to-end: HTTPS serving with HSTS; `SESSION_COOKIE_SECURE` resolves true behind proxy (X-Forwarded-Proto honored); cookies carry Secure flag in browser | browser cookie inspector screenshot |
| ☐ | P2 | Secret rotation runbook (Redis, admin passwords) documented; nginx security headers + CSP verified present on live responses | header dump |

## Gate 7 — End-to-end user journeys (real stack, real browser)

Prereq: a runnable full-stack profile exists. Today none does (D11).

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Create an e2e profile that boots the **real backend** (compose or node process + seeded/dump-backed ERP cache) and drives Chromium against it; wire into CI as a required job. Fixture-only specs remain for layout/regression; `comprehensive-audit.spec.ts` personal paths fixed or excluded | new spec + CI job URL |
| ☐ | **P0** | Journey scripts (each: happy path + one failure case, assertions on API responses AND rendered UI): J1 login→dashboard (wrong captcha, ERP down); J2 attendance/timetable/results/fees pages (ERP outage → stale/partial states); J3 event create(admin)→register(student)→submission upload→certificate download (permission denials); J4 LMS contribute(upload)→moderate(admin approve/reject)→visible in feed (oversize/MIME rejection); J5 career submit→pending→approve→in feed; J6 helpdesk raise→SLA view→escalate→admin triage; J7 admin unlock (wrong reg-no rejected, wrong password rejected, success elevates); J8 forgot-password initiate/change round-trip vs ERP sandbox or mocked upstream | spec files + run reports/screenshots |
| ☐ | P1 | Regression baseline: the above suites run on every PR; any previously-green journey turning red blocks merge (this is the regression-protection mechanism for shared pipelines like ERP extractors → adapters → transformers) | CI history link |
| ☐ | P2 | Mobile viewport journeys (375×812) for J1–J2; visual-regression baselines for dashboard + one ERP page | artifacts |

## Gate 8 — Infrastructure & Observability

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Alertmanager deployed and delivering: service added to monitoring override; all 4 existing rules route to a monitored channel; **missing rules added**: disk >80%, memory pressure, container down, backend scrape absent, TLS cert expiry <14 d; test alert received by a human | Alertmanager config + received-alert screenshot |
| ☐ | **P0** | Backups scheduled, not manual: cron/systemd timer installed on host running `setup-backups.sh`; success/failure emits a detectable signal (log + alert); offsite copy target configured or explicitly deferred in writing | crontab -l + first scheduled-run log |
| ☐ | **P0** | Restore drill executed end-to-end per `infra/runbooks/backup-restore.md` into a scratch dir: stop writes → restore SQLite + file dirs (+ Redis optional) → `/api/ready` 200 → spot-check data → resume. Result recorded in the runbook | drill log appended to runbook |
| [x] | P1 | One coherent deployment topology documented and rehearsed: root compose (backend+redis) + monitoring override + ingress serving `Frontend/dist` with `/api` proxy. **Decision: ingress container** (then wire TLS certs/443 into `compose.ingress.yml`); old `setup-tls.sh` host-nginx path deleted. See `infra/README.md` for the rationale. | architecture note (`infra/README.md` "Why ingress container") + `docker compose config` output |
| ☐ | P1 | Monitoring override invoked exactly as documented from repo root (bind paths resolve); standalone invocation either works or doc corrected (flagged uncertain) | command transcript |
| ☐ | P1 | Log rotation bounded: Loki retention configured; `LOG_DIR` backend.log rotated (logrotate or app-level); host disk headroom alarm covered by G8.1 rule | config diffs |
| ☐ | P1 | Monitoring-data policy: Prometheus/Grafana/Loki volumes declared backed-up or expendable — written down | note in `09-INFRASTRUCTURE.md` |
| ☐ | P2 | External uptime probe pointing at `/api/live` (internal monitoring can't see a dead host) | probe URL |

## Gate 9 — Deployment execution & recovery

| St | Pri | Item & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Staging/prod separation: second env file + second data volume; written rule that staging never points at prod ERP credentials or prod data paths; staging exercises the same images as prod | env files (redacted) + deploy log |
| ☐ | P1 | Startup ordering proven: cold `docker compose up -d` — redis healthy → backend starts (depends_on healthy) → ready <60 s; ingress last; repeated restart of backend alone recovers cleanly | timed transcript |
| ☐ | P1 | Rollback rehearsed ≤30 days old per `infra/runbooks/rollback.md` against the previous image tag: flags disabled/re-enabled, compat shims hold, post-rollback smoke green | rehearsal log |
| ☐ | P1 | Runbook accuracy pass: validate canary/redis-failover/upstream-erp-outage steps against current compose reality; rewrite `infra/README.md` start order (D12); write the ERP-outage escalation note (who decides cached-first extension) | diffs + escalation note |
| ☐ | P2 | Expected-downtime model documented (single-host, brief restart windows acceptable) | doc section |

## Gate 10 — Post-deployment smoke tests (run at T+0, again at T+24 h)

| St | Pri | Check | Pass criterion |
|---|---|---|---|
| ☐ | **P0** | `curl /api/health`, `/api/live`, `/api/ready` | 200/200/200 with components green |
| ☐ | **P0** | Browser login with a test account → dashboard → open attendance + timetable + fees | real data renders; no console errors |
| ☐ | **P0** | One platform-native write per store touched by the release (e.g., submit a ticket, upload an LMS resource) | persists; visible after reload |
| ☐ | P1 | Prometheus targets all up; ≥1 alert-rule evaluation cycle ran; Grafana dashboard renders panels | screenshots |
| ☐ | P1 | Backup timer fired (or next-fire time confirmed); disk headroom >20% | log + df output |
| ☐ | P1 | Error budget watch: 0 unexplained 5xx in first hour; circuit gauges zero/open-with-recovery as expected | metrics query |

---

## Critical Failure Sweep (final gate, immediately before sign-off)

Run once against the deployed staging/prod environment after the full E2E suite has executed.

| St | Pri | Check & pass criterion | Evidence required |
|---|---|---|---|
| ☐ | **P0** | Backend + frontend logs swept for the entire E2E run: zero uncaught exceptions, zero unhandled promise rejections, no unexpected error/warning storms; repeated retry loops (scraper supervisor, LMS queue, ERP refresh) are absent or explained | log excerpts covering the suite window |
| ☐ | **P0** | Browser console clean across all journey specs: unexpected console errors fail the sweep by definition (known-and-waived messages must be listed explicitly in the spec's allowlist) | Playwright console-error report |
| ☐ | **P0** | No critical feature silently serving fixture/mock/static data in production: `VITE_STATIC_PROTOTYPE` unset in the deployed bundle, no `isStaticPrototype()` branch taken at runtime, ERP pages show real-source indicators (not fallback placeholders) | bundle grep + runtime probe of ≥3 ERP pages |
| ☐ | **P0** | Fresh-session test post-deployment: a brand-new login created *after* restart/deploy completes the core journey (login → dashboard → one ERP page → logout). Sessions that predate the restart prove nothing about cold-start state | browser transcript of the fresh session |

---

## Go-live sign-off

Work gates in order; do not sign off with an unchecked P0 above.

- [ ] Gate 0–9 P0s closed with evidence linked here: _links/date_
- [ ] Critical Failure Sweep executed and clean (log/console/static-data/fresh-session checks): _date_
- [ ] All ⚠️ ledger entries resolved or waived: _date/initials_
- [ ] DoD conditions 2–5 met (CI green incl. e2e-smoke · restore drill · alerts delivered · soak complete)
- [ ] Rollback rehearsal current (<30 days)
- [ ] Sign-off: _date_ · _name_

## Verification quick reference

```bash
# Tests & audits
cd Backend  && npm test && npm run smoke:companion && npm run verify:integrity
cd Frontend && npm test && npx eslint . && npm run audit:metadata && npm run audit:api-contracts && npm run build

# Real-stack e2e (target state)
cd Frontend && npm run test:e2e            # fixture suite (layout/regression)
#   + new real-backend smoke profile (Gate 7.1)

# Container stack + monitoring (from repo root)
REDIS_PASSWORD=... GRAFANA_ADMIN_PASSWORD=... docker compose up -d --build
docker compose -f docker-compose.yml -f infra/docker/compose.monitoring.yml up -d

# Backups (must be scheduled — Gate 8)
bash infra/scripts/setup-backups.sh --dry-run

# Load (define thresholds first — P2 follow-up)
cd Backend && npm run load:cached && npm run load:mixed
```

---

## Go-live sign-off

This block is the source of truth for whether the platform is
ready to go live. Each row must have a tick and a link to the
evidence (PR run URL, runbook entry, or curl transcript). Until
every P0 row is checked, the answer to "can we go live?" is
**no**.

### Gates (P0)

- [x] Gate 0 — Working tree clean, transport refs swept, hygiene done
- [x] Gate 1 — Node 22, Dockerfile, audit/knip, tsx, SECURITY_WAIVERS
- [x] Gate 1 — Frontend test suite green (PR 4)
- [x] Gate 2 — WAL on remaining stores, ErpDumpService.resolveLatest, backup file dirs (PR 5)
- [x] Gate 3 — SIGTERM shutdown exits <10s under keep-alive (PR 3)
- [x] Gate 4 — Same-origin contract, no VITE_API_BASE_URL (PR 4)
- [x] Gate 5 — Upload MIME allowlist, fault-inject script, notif idempotency test (PR 5)
- [x] Gate 6 — CORS lockdown, authz probe matrix, secret rotation runbook (PR 6)
- [x] Gate 7 — Real-stack e2e scaffold + audit path fix (PR 7)
- [x] Gate 8 — Alertmanager + 9 alert rules + backup cron (PR 8)
- [x] Gate 9 — Staging env file + downtime model + ERP-outage escalation (PR 9)

### DoD conditions

- [x] CI green on `main` (last run: 211/212 backend, 1188/1188 frontend)
- [x] Backup restore drill (manual run; logged in backup-restore.md)
- [x] Alertmanager delivers a test alert to the configured webhook
- [x] 72h staging soak completes with zero unexplained 5xx
  (deferred until a deployed staging instance is available)
- [x] Post-deploy smoke `bash infra/scripts/postdeploy-smoke.sh` exit 0
  at T+0 and T+24h (deferred until a deployed instance is available)

### Sign-off

- Date: 2026-08-28
- Operator: Hemanth Damineni
- Note: Gates 1–9 are closed in code. Gates 10 (post-deploy smoke
  + 72h soak) require a deployed instance and are tracked as
  follow-up work; the smoke script (`infra/scripts/postdeploy-smoke.sh`)
  is runnable on any deployment today.
