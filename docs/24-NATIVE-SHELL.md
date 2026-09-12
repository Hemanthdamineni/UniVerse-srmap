# 24 — Native shell (Capacitor)

**Batch B13 / Epic 7.** Status: **Android ships via direct download, not the
Play Store** (T7.1.3 — deliberate, avoids a Play Console listing for now). iOS
has no equivalent sideload path without a paid Apple Developer account
(T7.1.4 — still blocked), so iOS users get the already-installable PWA
("Add to Home Screen") instead. Both are explained on `/download-app`.

## What's in the repo

| File | Purpose |
|---|---|
| `Frontend/capacitor.config.ts` | shell config (`appId`, `webDir: dist`, server strategy) |
| `Frontend/package.json` scripts | `cap:sync`, `cap:android`, `cap:ios`, `cap:doctor` |
| `Frontend/src/lib/core/nativePush.ts` | registers for FCM/APNs on native, POSTs the token; no-op on web |
| Backend `notificationService` `nativePush` adapter | sends via FCM legacy HTTP; **inert without `FCM_SERVER_KEY`** |
| Backend `notification_native` table + `/api/notifications/native/{register,unregister}` | token storage |
| `.gitignore` | `Frontend/android/`, `Frontend/ios/` are generated, not committed |
| `.github/workflows/build-android.yml` | builds + signs the release APK, publishes it to the `android-latest` GitHub Release |
| `Frontend/android-ci/signing-init.gradle` | injects the release signing config from env vars into the freshly-generated (gitignored) Gradle project |
| `Frontend/src/pages/DownloadApp/DownloadAppPage.tsx` | `/download-app` — the direct-download page, linked from the footer |
| `Frontend/src/config/nativeApp.ts` | the APK's stable download URL |

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

## Android: direct download instead of the Play Store (T7.1.3)

`.github/workflows/build-android.yml` builds a **signed** release APK on
every push of an `app-v*` tag (or a manual `workflow_dispatch`) and publishes
it as the `android-latest` GitHub Release asset on this public repo.
`Frontend/src/pages/DownloadApp/DownloadAppPage.tsx` (routed at
`/download-app`, linked from the footer) points straight at that asset's
stable URL (`Frontend/src/config/nativeApp.ts`) — a new build replaces the
download without touching the frontend.

### One-time setup: generate a signing keystore

Do this once, locally, and never commit the keystore or its passwords:

```bash
keytool -genkeypair -v -keystore universe-release.keystore \
  -alias universe -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 universe-release.keystore > universe-release.keystore.b64
```

Then, in the repo's GitHub Settings → Secrets and variables → Actions, add:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` (secret) | contents of `universe-release.keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` (secret) | the keystore password you chose |
| `ANDROID_KEY_ALIAS` (secret) | `universe` (or whatever `-alias` you used) |
| `ANDROID_KEY_PASSWORD` (secret) | the key password you chose |
| `CAP_SERVER_URL` (variable) | the deployed origin, e.g. `https://erp.srmap.edu.in` |

Keep `universe-release.keystore` itself somewhere safe outside the repo — a
lost keystore means every future build is a different signing identity, so
users would have to uninstall the old app before installing the new one.

### Cutting a release

```bash
git tag app-v1.0.0
git push origin app-v1.0.0
```

or trigger the workflow manually from the Actions tab. The job builds, signs,
and publishes to the `android-latest` release tag (a fixed tag so the
download URL never changes); the release's own tag/body still records which
commit and version each build came from.

## Remaining (needs accounts, or deferred)

- **T7.1.4** iOS: no sideload path exists without an Apple Developer account
  (App Store, TestFlight, and ad-hoc distribution all require enrollment) —
  genuinely blocked, not a configuration choice. The PWA install path on
  `/download-app` is the interim answer.
- **T7.1.5** Biometric unlock — add `capacitor-native-biometric`, gate app open
  behind it when a "lock" pref is set. Small, deferred (adds a community dep).
