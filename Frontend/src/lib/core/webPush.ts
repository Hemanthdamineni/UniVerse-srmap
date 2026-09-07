/**
 * webPush.ts — client for Web Push subscription + notification preferences
 * (Batch B8 / Stories 6.1–6.2).
 */

import { requestData } from "./apiClient";

export type NotificationCategory = "academic" | "career" | "events" | "system";

export interface NotificationPreferences {
  channels: { inApp: boolean; webPush: boolean; email: boolean };
  mutedCategories: NotificationCategory[];
  quietHours: { start: string; end: string } | null;
  pushSubscribed: boolean;
  webPushAvailable: boolean;
  /** The email on file for digests, or null if none is known. */
  email: string | null;
}

export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return requestData<NotificationPreferences>("/api/notifications/preferences");
}

export function updateNotificationPreferences(
  patch: Partial<Pick<NotificationPreferences, "channels" | "mutedCategories" | "quietHours">>,
): Promise<NotificationPreferences> {
  return requestData<NotificationPreferences>("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/* ---------- Web Push subscription ---------- */

export type PushState = "unsupported" | "denied" | "prompt" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) return "subscribed";
  } catch {
    /* ignore */
  }
  return Notification.permission === "granted" ? "unsubscribed" : "prompt";
}

/** Requests permission (if needed), subscribes, and registers with the server. */
export async function subscribeToPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "prompt";

  const { publicKey } = await requestData<{ publicKey: string }>("/api/notifications/vapid-key");
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await requestData("/api/notifications/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return "subscribed";
}

export async function unsubscribeFromPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await requestData("/api/notifications/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    /* best effort */
  }
  return "unsubscribed";
}
