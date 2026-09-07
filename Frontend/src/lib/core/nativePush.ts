/**
 * nativePush.ts — Capacitor (FCM / APNs) push registration (Batch B13 / T7.1.2).
 *
 * A **no-op on the web** — the dynamic imports and `Capacitor.isNativePlatform()`
 * check mean `@capacitor/push-notifications` is only touched inside the native
 * shell. On native it requests permission, registers, and POSTs the device
 * token to the same notification layer the web-push channel uses.
 */

import { requestData } from "./apiClient";
import { hasSessionAuth } from "./session";

type CapModule = { Capacitor: { isNativePlatform: () => boolean; getPlatform: () => string } };

let started = false;

export async function initNativePush(): Promise<void> {
  if (started || typeof window === "undefined") return;
  started = true;

  let cap: CapModule;
  try {
    cap = (await import("@capacitor/core")) as unknown as CapModule;
  } catch {
    return; // Capacitor not bundled (pure web build)
  }
  if (!cap.Capacitor?.isNativePlatform?.()) return;

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
}
