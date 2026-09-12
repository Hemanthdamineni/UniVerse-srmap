/**
 * nativeApp.ts — where the Android release APK lives.
 *
 * The CI job `.github/workflows/build-android.yml` builds and signs the APK
 * from the Capacitor shell (T7.1.1) and publishes it as the `android-latest`
 * GitHub Release asset on this public repo. `/download-app` links straight to
 * that release's stable "latest" URL, so a new build replaces the download
 * without anyone needing to update this file.
 *
 * No Play Store listing (T7.1.3 deferred — needs a paid Play Console
 * account); this is direct-download distribution instead. iOS still has no
 * sideload path without an Apple Developer account (T7.1.4), so iOS users are
 * pointed at "Add to Home Screen" for the already-installable PWA.
 */
const REPO = "Hemanthdamineni/UniVerse-srmap";

export const ANDROID_APK_DOWNLOAD_URL = `https://github.com/${REPO}/releases/download/android-latest/UniVerse.apk`;
export const ANDROID_RELEASE_NOTES_URL = `https://github.com/${REPO}/releases/tag/android-latest`;
