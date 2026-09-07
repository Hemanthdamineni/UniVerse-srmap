/**
 * PushNotificationSettings.tsx — enable Web Push, choose which categories can
 * notify, and set quiet hours (Batch B8 / Stories 6.1–6.2). Rendered in the
 * Settings page.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToPush,
  unsubscribeFromPush,
  getPushState,
  type NotificationCategory,
  type PushState,
} from "../../lib/core/webPush";
import { isStaticPrototype } from "../../lib/core/prototype";
import { hasSessionAuth } from "../../lib/core/session";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  academic: "Attendance risk, results published",
  career: "Deadlines on saved opportunities, matches",
  events: "Event reminders, organiser messages",
  system: "Weekly digest, platform notices",
};

const PUSH_STATE_COPY: Record<PushState, string> = {
  unsupported: "This browser doesn't support push notifications.",
  denied: "Notifications are blocked for this site — enable them in your browser settings.",
  prompt: "",
  subscribed: "Push is on for this device.",
  unsubscribed: "Push is available but not enabled on this device.",
};

export default function PushNotificationSettings() {
  const queryClient = useQueryClient();
  const enabled = hasSessionAuth() && !isStaticPrototype();

  const prefsQuery = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: getNotificationPreferences,
    enabled,
    retry: 1,
  });
  const [pushState, setPushState] = useState<PushState>("prompt");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (enabled) void getPushState().then(setPushState);
  }, [enabled]);

  const save = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      setStatus("Saved.");
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: () => setStatus("Couldn't save — try again."),
  });

  if (!enabled) {
    return (
      <SectionCard title="Push notifications">
        <p className="comp-body text-sm">Sign in to the live app to manage push notifications.</p>
      </SectionCard>
    );
  }

  const prefs = prefsQuery.data;
  const muted = new Set(prefs?.mutedCategories ?? []);

  const toggleCategory = (cat: NotificationCategory) => {
    const next = new Set(muted);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    save.mutate({ mutedCategories: [...next] });
  };

  const handlePushToggle = async () => {
    setBusy(true);
    setStatus("");
    try {
      const next = pushState === "subscribed" ? await unsubscribeFromPush() : await subscribeToPush();
      setPushState(next);
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    } catch {
      setStatus("Couldn't change push — check your browser's notification permission.");
    } finally {
      setBusy(false);
    }
  };

  const quiet = prefs?.quietHours ?? null;
  const emailOn = prefs?.channels.email ?? false;

  return (
    <SectionCard title="Push notifications">
      <p className="comp-body mb-4 text-sm">
        Get attendance and deadline alerts even when the tab is closed. In-app notifications always
        work; push is per-device.
      </p>

      {/* Enable push on this device */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--comp-border)] py-3">
        <div>
          <p className="text-sm font-medium text-[var(--comp-text-primary)]">Push on this device</p>
          <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
            {PUSH_STATE_COPY[pushState] || "Enable browser push for this device."}
          </p>
        </div>
        <button
          type="button"
          className={pushState === "subscribed" ? "comp-btn-ghost" : "comp-btn-primary"}
          disabled={busy || pushState === "unsupported" || pushState === "denied" || !prefs?.webPushAvailable}
          onClick={handlePushToggle}
        >
          {busy ? "…" : pushState === "subscribed" ? "Turn off" : "Turn on"}
        </button>
      </div>

      {!prefs?.webPushAvailable && (
        <p className="mt-2 text-xs text-[var(--comp-text-muted)]">
          Web Push isn't configured on the server yet (no VAPID key).
        </p>
      )}

      {/* Weekly email digest */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--comp-border)] py-3">
        <div>
          <p className="text-sm font-medium text-[var(--comp-text-primary)]">Weekly email digest</p>
          <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">
            {prefs?.email
              ? `A once-a-week summary to ${prefs.email} — readiness, attendance risks, deadlines.`
              : "We don't have an email on file yet — it fills in after your next ERP sync."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailOn}
          disabled={!prefs?.email}
          onClick={() => save.mutate({ channels: { ...prefs!.channels, email: !emailOn } })}
          className="shrink-0"
        >
          <span
            aria-hidden
            className={`relative block h-[22px] w-10 rounded-full transition-colors ${emailOn ? "bg-[var(--comp-accent)]" : "bg-[var(--comp-border)]"} ${!prefs?.email ? "opacity-40" : ""}`}
          >
            <span
              className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform"
              style={{ transform: emailOn ? "translateX(18px)" : "translateX(0)" }}
            />
          </span>
        </button>
      </div>

      {/* Per-category mutes */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-[var(--comp-text-primary)]">What can notify me</p>
        <div className="flex flex-col">
          {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              role="switch"
              aria-checked={!muted.has(cat)}
              onClick={() => toggleCategory(cat)}
              className="flex min-h-11 w-full items-center justify-between gap-4 border-b border-[var(--comp-border)] py-2 text-left last:border-0 hover:bg-[var(--comp-surface-hover)]"
            >
              <span>
                <span className="block text-sm capitalize text-[var(--comp-text-primary)]">{cat}</span>
                <span className="block text-xs text-[var(--comp-text-muted)]">{CATEGORY_LABELS[cat]}</span>
              </span>
              <span
                aria-hidden
                className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${!muted.has(cat) ? "bg-[var(--comp-accent)]" : "bg-[var(--comp-border)]"}`}
              >
                <span
                  className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform"
                  style={{ transform: !muted.has(cat) ? "translateX(18px)" : "translateX(0)" }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="mt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--comp-text-primary)]">
          <input
            type="checkbox"
            checked={Boolean(quiet)}
            onChange={(e) =>
              save.mutate({ quietHours: e.target.checked ? { start: "22:00", end: "07:00" } : null })
            }
          />
          Quiet hours (non-urgent notifications held)
        </label>
        {quiet && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="time"
              value={quiet.start}
              onChange={(e) => save.mutate({ quietHours: { ...quiet, start: e.target.value } })}
              className="min-h-11 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-2"
            />
            <span className="text-[var(--comp-text-muted)]">to</span>
            <input
              type="time"
              value={quiet.end}
              onChange={(e) => save.mutate({ quietHours: { ...quiet, end: e.target.value } })}
              className="min-h-11 rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-2"
            />
          </div>
        )}
      </div>

      {status && (
        <p aria-live="polite" className="mt-3 text-sm text-[var(--comp-text-muted)]">
          {status}
        </p>
      )}
    </SectionCard>
  );
}
