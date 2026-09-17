/**
 * nativePush.ts — Capacitor (FCM / APNs) push registration (Batch B13 / T7.1.2).
 *
 * A **no-op on the web** — the dynamic imports and `Capacitor.isNativePlatform()`
 * check mean `@capacitor/push-notifications` is only touched inside the native
 * shell. On native it requests permission, registers, and POSTs the device
 * token to the same notification layer the web-push channel uses.
 *
 * PUSH_CONFIGURED must stay `false` until a real Firebase project's
 * `google-services.json` + the `com.google.gms.google-services` Gradle plugin
 * are wired into the Android project (see docs/24-NATIVE-SHELL.md) and
 * `FCM_SERVER_KEY` is set on the backend. Without that, the Android plugin's
 * `register()` calls `FirebaseMessaging.getInstance()` natively, which throws
 * because no default FirebaseApp exists — and Capacitor's bridge rethrows
 * plugin-method exceptions as an uncaught RuntimeException on the handler
 * thread (Bridge.java's `callPluginMethod`), which crashes the whole app
 * before the failure ever reaches JS. A try/catch here cannot prevent that;
 * the only fix is not making the native call at all.
 */

import { requestData } from "./apiClient";
import { hasSessionAuth } from "./session";

const PUSH_CONFIGURED = false;

type CapModule = { Capacitor: { isNativePlatform: () => boolean; getPlatform: () => string } };

let started = false;

export async function initNativePush(): Promise<void> {
  if (started || typeof window === "undefined" || !PUSH_CONFIGURED) return;
  started = true;

  let cap: CapModule;
  try {
    cap = (await import("@capacitor/core")) as unknown as CapModule;
  } catch {
    return; // Capacitor not bundled (pure web build)
  }
  if (!cap.Capacitor?.isNativePlatform?.()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = cap.Capacitor.getPlatform();

    const perm = await PushNotifications.checkPermissions();
    const granted =
      perm.receive === "granted" ? true : (await PushNotifications.requestPermissions()).receive === "granted";
    if (!granted) return;

    PushNotifications.addListener("registration", (token) => {
      if (!hasSessionAuth()) return;
      void requestData("/api/notifications/native/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.value, platform }),
      }).catch(() => undefined);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (typeof url === "string" && url.startsWith("/")) window.location.assign(url);
    });

    await PushNotifications.register();
  } catch {
    // Push is a best-effort enhancement — any failure here (permission
    // plumbing, listener setup, etc.) must never take the app shell down
    // with it. This does NOT protect against a misconfigured Firebase
    // project; see the PUSH_CONFIGURED note above for why.
  }
}
