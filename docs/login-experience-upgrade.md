# Login Experience Upgrade — Engineering Report

**Date:** 2026-08-21 · **Scope:** Full auth/login overhaul across Backend + Frontend, plus one ERP data-pipeline fix.

This document records everything that was changed in this effort, what was verified and how, what was deliberately deferred, and what was rejected outright — so future work doesn't re-litigate settled decisions.

---

## 1. Problem statement

Logging in through our proxy reproduced every pain of the official SRM ERP portal and added a few of our own:

- A **15-second** server-side freshness window on the pre-auth captcha session — anyone slow at typing got `CAPTCHA_EXPIRED` before ever reaching the university.
- Failed logins left a stale captcha on screen; users retried into guaranteed failure loops.
- After a mid-task session expiry, users were dumped to `/login` and then to `/dashboard` — the `login_redirect` key was read in three places but written nowhere.
- Worst-case login latency was ~90 s (Chromium fallback stacking Playwright waits) with no overall deadline; the UI could spin forever (no frontend request timeouts either).
- No keep-alive: upstream ERP sessions died independently of ours, surfacing as mid-action hard failures.
- Upstream states like *account locked* or *password expired* were collapsed into generic 502 messages.
- No endpoint-level abuse protection on credential-touching routes.
- The client stored a `sessionId` in localStorage even though the backend had already moved to httpOnly-cookie-only authentication (legacy header/body fallback expired at the configured cutoff).

---

## 2. What was done

### 2.1 Data-pipeline correctness

| Change | File |
|---|---|
| Un-swapped OD/ML % ↔ Attendance % mapping (a stale "intentional swap" comment had crossed them); now matches extractor column order | `Frontend/src/lib/erp/attendanceTransformers.ts` |

### 2.2 Pre-auth captcha lifecycle

| Change | File |
|---|---|
| `LOGIN_PREAUTH_TTL_MS` default raised **15 s → 25 min**, aligned under the ERP's own anonymous-session lifetime (~30 min container default) which is what actually binds captcha validity | `Backend/src/config/env.js` |
| Frontend auto-refreshes the captcha on `CAPTCHA_EXPIRED` / `INVALID_CAPTCHA` (and any other attempt-consuming failure — see §2.7), preserving username/password | `Frontend/src/pages/Login/LoginPage.tsx` |
| Silent renewal when a captcha expires while the input is still empty (loop-guarded, once per expiry cycle); typed captchas are never silently discarded | `LoginPage.tsx` |
| Expiry countdown: thin progress bar under the captcha box (teal → amber ≤30 s → red ≤10 s) driven by the API's `expiresInMs`; numeric seconds shown only in the final 30 s | `LoginPage.tsx` |

### 2.3 Failure handling & upstream fidelity

| Change | File |
|---|---|
| New classifiers: `ACCOUNT_BLOCKED` (403), `PASSWORD_EXPIRED` (401), `UPSTREAM_MAINTENANCE` (503), mapped from real ERP response text | `Backend/src/services/erp/erpClient.js` |
| **Live-verified insight:** the official ERP consumes its session captcha on *every* failed attempt and typically re-serves the login page rather than a distinct banner. Frontend therefore loads a fresh captcha after any retryable failure (`INVALID_CREDENTIALS`, `LOGIN_VERIFICATION_FAILED`, …) while keeping the specific error text | `LoginPage.tsx` |
| Password-recovery flow brought to parity: captcha auto-refresh on `CAPTCHA_EXPIRED`/`INVALID_CAPTCHA`, request timeouts, network-error messaging, username normalization | `ForgotPasswordPage.tsx` |
| Overall login deadline `LOGIN_DEADLINE_MS` (**45 s**, default): wraps `loginWithCaptcha`, returns clean 504 `LOGIN_TIMEOUT`; late-settling attempts can't produce unhandled rejections | `Backend/src/routes/authRoutes.js` |
| Frontend request timeouts: captcha fetch 15 s, login POST 60 s (headroom over backend deadline), with distinct network-vs-timeout messaging | `LoginPage.tsx` |
| Staged feedback: after 8 s of verification, "Still verifying — the university ERP can take longer during busy hours" | `LoginPage.tsx` |

### 2.4 Session continuity

| Change | File |
|---|---|
| `GET /api/auth/heartbeat` (+ `/api/heartbeat`): refreshes local session TTL each beat, probes the real ERP shell at most every `ERP_HEARTBEAT_PROBE_INTERVAL_MS` (**5 min**) per session, fails open when the ERP is unreachable | `authRoutes.js` |
| Client heartbeat: beats on tab-focus + every 60 s while visible; a dead upstream session triggers the graceful kick instead of a mid-action surprise | `Frontend/src/lib/core/session.ts`, mounted in `App.tsx` |
| `login_redirect` is now actually written (path+search) before any forced redirect; users return where they were after re-login | `session.ts` |
| "Your session expired. Please sign in again." notice on arrival at the login page after a kick | `LoginPage.tsx` |

### 2.5 Cookie-only client sessions

Investigation showed `FEATURE_AUTH_COOKIE_MODE` already defaults **on**, and the legacy header/body fallback died at `LEGACY_SESSION_ID_CUTOFF_DATE` — the httpOnly cookie was already the only accepted credential.

| Change | File |
|---|---|
| Removed `sessionId` from localStorage entirely; replaced by a non-secret `loggedIn` flag so all six synchronous consumers (`routes/index`, `AdminModeContext`, `Header`, `ProtectedPage`, `HomePage`, `Sidebar`) keep identical semantics without new async plumbing | `session.ts` |
| Deleted dead `?sessionId=` query-param plumbing | `blueprintData/api.ts`, `ResultsEarlierPage.tsx`, `Dashboard.tsx` |
| Heartbeat gate switched to the flag | `session.ts` |

### 2.6 Abuse resistance

| Change | File |
|---|---|
| `createLoginRateLimitMiddleware`: per-IP budget (**20/min** default) on `/api/(captcha\|auth/captcha\|login\|auth/login\|forgot\|auth/forgot)`; Redis-backed with memory fallback; **fails open** if Redis errors; friendly 429 message | `Backend/src/middleware/rateLimit.js`, `app.js`, `config/env.js` |

### 2.7 Form UX polish

- Registration number normalized as-you-type (uppercase, stripped, 13-char cap) + format validation before submit (`AP` + 11 digits) — helpers existed but were previously unwired.
- "Remember registration number" opt-in (stores the reg number only, never the password).
- Caps-Lock warning on the password field.
- Focus management: username autofocused; captcha input focused after refresh/failure-refresh.

### 2.8 Structural hygiene

- `LoginPage.tsx` (was at the 500-LOC ceiling) split into `LoginParts.tsx` (icons, StatusMessage, field styles) and `LoginIdentityPanel.tsx` (identity panel) — main file stays at ~497 LOC per AGENTS.md rule.

---

## 3. Timeout / refresh alignment audit (ours vs official ERP)

| Timer | Ours | Official ERP behaviour | Verdict |
|---|---|---|---|
| Pre-auth captcha validity | `LOGIN_PREAUTH_TTL_MS` = **25 min** | Captcha is bound to its anonymous JSESSIONID; lives ≈30 min (container default) | Aligned — we expire slightly *before* upstream so our "expired" message is never wrong |
| Login overall budget | `LOGIN_DEADLINE_MS` = **45 s** | ERP has no client-facing timeout; degraded responses observed in tens of seconds | Bounded above worst realistic upstream latency; consumed captcha is recovered by auto-renewal |
| Per-call HTTP timeout | 30 s (`createApiContext`) | — | Matches upstream responsiveness envelope |
| Local authenticated session | `SESSION_TTL_MS` = **30 min sliding**, refreshed on activity + every heartbeat | ERP idle timeout reported in the ~15–30 min range | Sliding window + 5-min probes surface upstream death within ≤5 min; local can't meaningfully outlive usage |
| Upstream-expiry detection latency | ≤5 min (probe interval) | n/a | Deliberate trade-off to keep ERP load flat |
| Frontend timeouts | 15 s captcha / 60 s login | — | Strictly derived from backend budgets |
| Rate-limit windows | Global 400/min · Login 20/min | n/a | Our policy; independent of ERP |

---

## 4. Verification

### Unit / static
- Backend `node --test`: **147/147** (incl. classifier cases, heartbeat ×3, login-deadline 504, rate limiter ×5).
- Frontend Vitest: **1119/1119 across 85 files**; ESLint clean on all touched files; `tsc --noEmit` clean.

### Live smoke (local stack ⇢ real SRM ERP)
| Check | Result |
|---|---|
| `GET /api/captcha` full round-trip | ✅ success, PNG payload, `sessionId` + `expiresInMs` flow correctly (env override honored: saw 180000 and 1200 ms in respective runs) |
| Heartbeat without session | ✅ 401 `UNAUTHORIZED` |
| Rate limiter boundary | ✅ requests pass until the shared per-IP budget is exhausted, then exact 429s with friendly body; captcha GET and login POST share one bucket as designed |
| `CAPTCHA_EXPIRED` fast-path | ✅ with `LOGIN_PREAUTH_TTL_MS=1200`, expired submit answered in **26 ms** without touching upstream |
| Bogus credentials vs real ERP | ✅ surfaced the undocumented upstream behaviour in §2.3 (login-page re-serve → `LOGIN_VERIFICATION_FAILED`), which drove the renew-on-any-failure fix |
| Not exercised live | Successful credential login (requires real student credentials), browser-fallback path (Chromium binary absent in dev box), deadline firing under genuinely hung ERP |

---

## 5. Deferred (worth doing later)

1. **Warm Chromium pool / dropping the browser fallback** — cuts worst-case latency further; needs an ops decision on keeping Playwright browsers warm vs trusting the direct-submit path that has been stable.
2. **Login funnel metrics** — stage traces and artifacts already exist (`login-attempts/` dir); missing only aggregation (success rate by classifier, duration percentiles) and alerting on upstream degradation.
3. **Expiry-warning banner** — heartbeat could return `expiresInSeconds` so long-idle tabs get a "will expire soon" prompt instead of a post-hoc kick. Low value while heartbeat keeps sliding the TTL, but useful if sliding is ever tightened to match ERP idle exactly.
4. **`GET /api/auth/status`** — cheap server-truth alternative to the localStorage flag if we ever want zero-stale gating; skipped because flag semantics matched existing UX exactly.

## 6. Rejected (documented so they stay rejected)

- **Storing passwords / silent auto-relogin** — security anti-pattern; the proxy must never hold university credentials beyond a single in-flight attempt.
- **Cross-user bootstrap caching** — the parsed login-form tokens are session-bound; sharing them across users would break logins outright (considered and discarded during optimization pass).
- **Captcha OCR / solver integration** — violates the point of the captcha and the university's terms.

## 7. Known limitations & ops notes

- All timers are env-tunable (`LOGIN_PREAUTH_TTL_MS`, `LOGIN_DEADLINE_MS`, `ERP_HEARTBEAT_PROBE_INTERVAL_MS`, `LOGIN_RATE_LIMIT_*`, `SESSION_TTL_MS`); defaults assume the ERP's ~30-min anonymous-session behaviour — revisit if the university changes its container settings.
- In multi-instance deployments the Redis limiter/store paths are required for correct shared budgets; memory mode (dev) is per-process.
- The upstream classifier depends on ERP HTML patterns (`erpClient.js` pattern lists); a portal redesign will need those refreshed — the `UNEXPECTED_PAYLOAD_TYPE`/trace artifacts will point straight at it.
- The `loggedIn` localStorage flag can be briefly stale after a server-side kill (same semantics as the old sessionId approach); first API call self-corrects via 401 → kick.

## 8. File index (this effort)

```
Backend/src/config/env.js                          LOGIN_PREAUTH_TTL_MS, LOGIN_DEADLINE_MS,
                                                   ERP_HEARTBEAT_PROBE_INTERVAL_MS, LOGIN_RATE_LIMIT_*
Backend/src/services/erp/erpClient.js              ACCOUNT_BLOCKED / PASSWORD_EXPIRED / UPSTREAM_MAINTENANCE
Backend/src/routes/authRoutes.js                   login deadline wrapper, heartbeat route
Backend/src/middleware/rateLimit.js                createLoginRateLimitMiddleware
Backend/src/app.js                                 limiter wiring
Backend/test/{authRoutes,erpClient,loginRateLimit}.test.js
Frontend/src/lib/core/session.ts                   flag model, redirect restore, heartbeat client
Frontend/src/pages/Login/LoginPage.tsx             captcha lifecycle UX, timeouts, staged messages
Frontend/src/pages/Login/ForgotPasswordPage.tsx     captcha auto-refresh + timeouts parity
Frontend/src/pages/Login/{LoginParts,LoginIdentityPanel}.tsx   extracted modules
Frontend/src/App.tsx                               heartbeat mount
Frontend/src/components/Sidebar.tsx                flag gate
Frontend/src/pages/Dashboard/{Dashboard,Dashboard.test}.tsx    flag gate + mock update
Frontend/src/pages/Shared/blueprintData/api.ts     dead query-param removal
Frontend/src/pages/ERP/ResultsEarlierPage.tsx      dead query-param removal
Frontend/src/lib/core/prototype.ts                 flag-based prototype bootstrap
Frontend/src/lib/erp/attendanceTransformers.ts     OD/ML ↔ Attendance % un-swap
docs/login-experience-upgrade.md                   this document
```
