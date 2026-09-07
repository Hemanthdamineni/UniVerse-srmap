# 24 — Native shell (Capacitor)

**Batch B13 / Epic 7.** Status: **spike complete, code-complete for what doesn't
need store accounts.** Store listings (T7.1.3 / T7.1.4) need an Apple Developer
account and a Play Console account — not started.

## What's in the repo

| File | Purpose |
|---|---|
| `Frontend/capacitor.config.ts` | shell config (`appId`, `webDir: dist`, server strategy) |
| `Frontend/package.json` scripts | `cap:sync`, `cap:android`, `cap:ios`, `cap:doctor` |
| `Frontend/src/lib/core/nativePush.ts` | registers for FCM/APNs on native, POSTs the token; no-op on web |
| Backend `notificationService` `nativePush` adapter | sends via FCM legacy HTTP; **inert without `FCM_SERVER_KEY`** |
| Backend `notification_native` table + `/api/notifications/native/{register,unregister}` | token storage |
| `.gitignore` | `Frontend/android/`, `Frontend/ios/` are generated, not committed |

## First-time setup (per machine)

```bash
cd Frontend
npm install @capacitor/android @capacitor/ios   # only needed locally
npm run build
npx cap add android      # generates Frontend/android/  (needs Android SDK)
npx cap add ios          # generates Frontend/ios/      (needs Xcode, macOS)
npm run cap:sync         # build + copy web assets into the native projects
npm run cap:android      # opens Android Studio
```

## The auth decision (verified in the spike)

The app uses **cookie-mode sessions**. A Capacitor WebView is served from
`capacitor://localhost` (iOS) / `http://localhost` (Android), which is a
**different origin** from the API — so `credentials: "include"` cookies are not
sent and every request 401s.

**Chosen fix:** set `CAP_SERVER_URL` at build time so the WebView loads the
deployed origin directly (`server.url` in the config). The app is then
same-origin with the API, cookie auth works unchanged, the service worker
registers, and web deploys are picked up without an app-store release.

```bash
CAP_SERVER_URL=https://erp.srmap.edu.in npm run cap:sync
```

Alternative (fully bundled offline shell): drop `server.url`, move auth to a
bearer token in `@capacitor/preferences`, and route API calls through
`CapacitorHttp` to bypass the WebView cookie jar. Heavier; only worth it if the
app must open with zero connectivity.

## Verified in the spike

- Client-side routing (React Router `createBrowserRouter`) works inside the
  WebView when loading from `server.url`.
- The Workbox service worker (with the B8 `sw-push.js` import) registers.
- The B13 offline banner + persisted query cache give a usable offline read of
  timetable / attendance / results.

## Remaining (needs accounts)

- **T7.1.3** Android build signing + Play Console listing.
- **T7.1.4** iOS build + App Store Connect listing (Apple Developer account).
- **T7.1.5** Biometric unlock — add `capacitor-native-biometric`, gate app open
  behind it when a "lock" pref is set. Small, deferred (adds a community dep).
