/**
 * notificationService.js — the one channel-agnostic notification layer
 * (Batch B8 / Story 6.1).
 *
 * Callers emit a taxonomy event with params; the service resolves a title/body
 * template, checks the recipient's channel preferences + category mutes +
 * quiet hours + a per-category rate limit, then hands the notification to each
 * enabled adapter. Adding a channel = adding an adapter; no caller changes.
 *
 * Adapter contract:
 *   { name: string, deliver({ userId, notification }) => Promise<{ ok, id?, error? }> }
 *   where `notification` = { title, body, url, data, eventKey, category, critical }
 *
 * @module core/notificationService
 */

const { log } = require("../../utils/logger");

/** Event taxonomy. `critical` events bypass quiet hours and the rate limit. */
const NOTIFICATION_EVENTS = {
  attendance_risk: {
    category: "academic",
    critical: true,
    channels: ["inApp", "webPush", "nativePush"],
    title: () => "Attendance is slipping",
    body: (p) => `${p.subject || "A subject"} is at ${p.pct ?? "?"}%. Attend the next ${p.needed ?? "few"} classes to stay above 75%.`,
    url: () => "/academic-tracker/academic-insights",
  },
  results_published: {
    category: "academic",
    critical: true,
    channels: ["inApp", "webPush", "nativePush"],
    title: () => "Results are out",
    body: (p) => (p.semester ? `Semester ${p.semester} results have been published.` : "New results have been published."),
    url: () => "/examination/current-semester-results",
  },
  deadline_tomorrow: {
    category: "career",
    critical: true,
    channels: ["inApp", "webPush", "nativePush"],
    title: (p) => `Closes tomorrow: ${p.title || "a saved opportunity"}`,
    body: (p) => `${p.title || "A saved opportunity"} closes ${p.deadline ? `on ${p.deadline}` : "tomorrow"}. Apply now if you still want it.`,
    url: (p) => (p.opportunityId ? `/career/opportunities/${p.opportunityId}` : "/career/me/tracker"),
  },
  opportunity_match: {
    category: "career",
    critical: false,
    channels: ["inApp"],
    title: () => "New opportunity that fits you",
    body: (p) => `${p.title || "An opportunity"} matches your goals${p.fitScore ? ` (${p.fitScore}% fit)` : ""}.`,
    url: (p) => (p.opportunityId ? `/career/opportunities/${p.opportunityId}` : "/career/opportunities?sort=fit"),
  },
  event_reminder: {
    category: "events",
    critical: false,
    channels: ["inApp", "webPush", "nativePush"],
    title: (p) => `Reminder: ${p.title || "your event"}`,
    body: (p) => (p.when === "1h" ? "Starts in 1 hour." : "Starts in 24 hours."),
    url: (p) => (p.eventId ? `/events/${p.eventId}` : "/events"),
  },
  organizer_message: {
    category: "events",
    critical: false,
    channels: ["inApp", "webPush", "nativePush"],
    title: (p) => p.subject || "Message from an organizer",
    body: (p) => p.message || "",
    url: (p) => (p.eventId ? `/events/${p.eventId}` : "/events"),
  },
  digest_weekly: {
    category: "system",
    critical: false,
    channels: ["inApp"],
    title: () => "Your week on the platform",
    body: (p) => p.summary || "Here's what's new.",
    url: () => "/dashboard",
  },
};

const RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxPerCategory: 8 };

function nowInIstHhmm(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
}

function isWithinQuietHours(quietHours, hhmm = nowInIstHhmm()) {
  if (!quietHours) return false;
  const { start, end } = quietHours;
  // Overnight window (e.g. 22:00 -> 07:00) wraps past midnight.
  return start <= end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}

class NotificationService {
  /**
   * @param {object} deps
   * @param {import("./notificationStore").NotificationStore} deps.store
   * @param {Array<{ name: string, deliver: Function }>} deps.adapters
   */
  constructor({ store, adapters = [] } = {}) {
    if (!store) throw new Error("NotificationService requires a notificationStore");
    this.store = store;
    this.adapters = new Map(adapters.map((a) => [a.name, a]));
  }

  listEventKeys() {
    return Object.keys(NOTIFICATION_EVENTS);
  }

  /**
   * @param {string} eventKey  a NOTIFICATION_EVENTS key
   * @param {object} opts
   * @param {string} opts.userId
   * @param {object} [opts.params]  template params
   * @param {object} [opts.data]    extra payload passed to adapters
   * @returns {Promise<{ eventKey, category, results: Array<{channel,status,detail?}> }>}
   */
  async emit(eventKey, { userId, params = {}, data = {} } = {}) {
    const def = NOTIFICATION_EVENTS[eventKey];
    if (!def) throw new Error(`Unknown notification event: ${eventKey}`);
    const results = [];
    if (!userId) return { eventKey, category: def.category, results };

    const prefs = this.store.getPreferences(userId);
    const notification = {
      eventKey,
      category: def.category,
      critical: Boolean(def.critical),
      title: String(def.title(params) || "Notification"),
      body: String(def.body(params) || ""),
      url: def.url ? String(def.url(params) || "/") : "/",
      data: { ...data, eventKey, category: def.category },
    };

    // Category mute — a hard opt-out, even for critical events.
    if (prefs.mutedCategories.includes(def.category)) {
      this.store.logDelivery({ userId, eventKey, category: def.category, channel: "*", status: "skipped", detail: "category muted" });
      return { eventKey, category: def.category, results: [{ channel: "*", status: "skipped", detail: "category muted" }] };
    }

    // Quiet hours + rate limit — non-critical only.
    if (!def.critical) {
      if (isWithinQuietHours(prefs.quietHours)) {
        this.store.logDelivery({ userId, eventKey, category: def.category, channel: "*", status: "skipped", detail: "quiet hours" });
        return { eventKey, category: def.category, results: [{ channel: "*", status: "skipped", detail: "quiet hours" }] };
      }
      const recent = this.store.deliveredCountSince(userId, def.category, RATE_LIMIT.windowMs);
      if (recent >= RATE_LIMIT.maxPerCategory) {
        this.store.logDelivery({ userId, eventKey, category: def.category, channel: "*", status: "skipped", detail: "rate limited" });
        return { eventKey, category: def.category, results: [{ channel: "*", status: "skipped", detail: "rate limited" }] };
      }
    }

    const channels = def.channels.filter((c) => prefs.channels[c]);
    for (const channel of channels) {
      const adapter = this.adapters.get(channel);
      if (!adapter) continue;
      const outcome = await this._deliverWithRetry(adapter, { userId, notification });
      this.store.logDelivery({
        userId,
        eventKey,
        category: def.category,
        channel,
        status: outcome.ok ? "delivered" : "failed",
        detail: outcome.error || outcome.id || "",
        attempts: outcome.attempts,
      });
      results.push({ channel, status: outcome.ok ? "delivered" : "failed", detail: outcome.error });
    }

    return { eventKey, category: def.category, results };
  }

  async _deliverWithRetry(adapter, args, maxAttempts = 2) {
    let last = { ok: false, error: "not attempted" };
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await adapter.deliver(args);
        if (res?.ok) return { ...res, attempts: attempt };
        last = { ok: false, error: res?.error || "adapter returned not-ok" };
      } catch (error) {
        last = { ok: false, error: error?.message || String(error) };
      }
      if (attempt < maxAttempts) await sleep(150 * attempt);
    }
    return { ...last, attempts: maxAttempts };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------- adapters ---------- */

/** In-app: persists through the existing events-store notification list. */
function createInAppAdapter({ eventsStore }) {
  return {
    name: "inApp",
    async deliver({ userId, notification }) {
      if (!eventsStore || typeof eventsStore.pushCareerNotification !== "function") {
        return { ok: false, error: "eventsStore unavailable" };
      }
      const row = eventsStore.pushCareerNotification(userId, {
        type: notification.eventKey,
        title: notification.title,
        message: notification.body,
        opportunityId: notification.data?.opportunityId || null,
        eventId: notification.data?.eventId || null,
        channel: ["in-app"],
      });
      return { ok: true, id: row?.id };
    },
  };
}

/** Web Push via the `web-push` library. Prunes dead subscriptions on 404/410. */
function createWebPushAdapter({ store, vapid }) {
  let webpush = null;
  try {
    webpush = require("web-push");
    if (vapid) webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  } catch {
    webpush = null;
  }

  return {
    name: "webPush",
    async deliver({ userId, notification }) {
      if (!webpush || !vapid) return { ok: false, error: "web-push not configured" };
      const subs = store.listSubscriptions(userId);
      if (subs.length === 0) return { ok: false, error: "no subscriptions" };

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: notification.url,
        data: notification.data,
      });

      let anyOk = false;
      const errors = [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, payload);
          anyOk = true;
        } catch (error) {
          const statusCode = error?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            store.deleteSubscription(sub.endpoint);
          } else {
            errors.push(String(statusCode || error?.message || "send failed"));
            log({ level: "warn", msg: "Web Push send failed", userId, statusCode });
          }
        }
      }
      return anyOk ? { ok: true } : { ok: false, error: errors.join("; ") || "all sends failed" };
    },
  };
}

/**
 * Email via nodemailer (Batch B9). Sends a plain single-notification email;
 * the weekly digest (digestService) composes richer HTML and calls the same
 * transport. Recipient address comes from `store.getContact(userId)`.
 *
 * @param {object} deps
 * @param {object} deps.store           notificationStore (for getContact + unsubscribeToken)
 * @param {object} deps.config          { host, port, secure, user, pass, from, appBaseUrl } | null
 */
function createEmailAdapter({ store, config }) {
  let transport = null;
  let from = config?.from || "";
  try {
    const nodemailer = require("nodemailer");
    if (config?.host && config?.port) {
      transport = nodemailer.createTransport({
        host: config.host,
        port: Number(config.port),
        secure: Boolean(config.secure),
        auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      });
    } else if (config?.devJson) {
      // No SMTP configured but dev wants to see the payload.
      transport = nodemailer.createTransport({ jsonTransport: true });
      from = from || "digest@university-erp.local";
    }
  } catch {
    transport = null;
  }

  return {
    name: "email",
    async deliver({ userId, notification }) {
      if (!transport) return { ok: false, error: "email not configured" };
      const contact = store.getContact(userId);
      if (!contact?.email) return { ok: false, error: "no email on file" };

      const unsubUrl = buildUnsubUrl(config?.appBaseUrl, userId, store.unsubscribeToken(userId));
      const bodyHtml = notification.html
        ? `${notification.html}${unsubUrl ? `<p style="margin:20px 0 0;font-size:11px;color:#889"><a href="${unsubUrl}" style="color:#889">Turn off these emails</a></p>` : ""}`
        : simpleEmailHtml(notification, unsubUrl);
      try {
        const info = await transport.sendMail({
          from,
          to: contact.email,
          subject: notification.title,
          text: `${notification.body}\n\n${unsubUrl ? `Manage or turn off these emails: ${unsubUrl}` : ""}`,
          html: bodyHtml,
          headers: unsubUrl ? { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
        });
        return { ok: true, id: info?.messageId };
      } catch (error) {
        return { ok: false, error: error?.message || "send failed" };
      }
    },
  };
}

function buildUnsubUrl(appBaseUrl, userId, token) {
  if (!appBaseUrl) return "";
  const u = new URL("/api/notifications/email/unsubscribe", appBaseUrl);
  u.searchParams.set("u", userId);
  u.searchParams.set("t", token);
  return u.toString();
}

function simpleEmailHtml(notification, unsubUrl) {
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0A3035">
  <h2 style="margin:0 0 8px;font-size:18px">${esc(notification.title)}</h2>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#334">${esc(notification.body)}</p>
  ${notification.url ? `<a href="${esc(notification.url)}" style="display:inline-block;background:#34AEBE;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px">Open</a>` : ""}
  ${unsubUrl ? `<p style="margin:24px 0 0;font-size:11px;color:#889"><a href="${esc(unsubUrl)}" style="color:#889">Turn off these emails</a></p>` : ""}
</div>`;
}

/**
 * Native push via Firebase Cloud Messaging (Batch B13). Sends to the Capacitor
 * device tokens the app registered. **Inert without `FCM_SERVER_KEY`.** Prunes
 * `NotRegistered` / `InvalidRegistration` tokens.
 *
 * @param {object} deps
 * @param {object} deps.store        notificationStore (listNativeTokens / deleteNativeToken)
 * @param {string} [deps.serverKey]  FCM legacy server key; defaults to env
 * @param {Function} [deps.fetchImpl]
 */
function createNativePushAdapter({ store, serverKey = process.env.FCM_SERVER_KEY || "", fetchImpl = fetch }) {
  return {
    name: "nativePush",
    async deliver({ userId, notification }) {
      if (!serverKey) return { ok: false, error: "FCM not configured" };
      const tokens = store.listNativeTokens(userId).map((t) => t.token);
      if (tokens.length === 0) return { ok: false, error: "no native tokens" };

      let anyOk = false;
      const errors = [];
      for (const token of tokens) {
        try {
          const res = await fetchImpl("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: { Authorization: `key=${serverKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              to: token,
              notification: { title: notification.title, body: notification.body },
              data: { url: notification.url, ...notification.data },
              android: { priority: "high" },
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success >= 1) {
            anyOk = true;
          } else {
            const reason = json.results?.[0]?.error || `${res.status}`;
            if (reason === "NotRegistered" || reason === "InvalidRegistration") {
              store.deleteNativeToken(token);
            } else {
              errors.push(reason);
            }
          }
        } catch (error) {
          errors.push(error?.message || "send failed");
        }
      }
      return anyOk ? { ok: true } : { ok: false, error: errors.join("; ") || "all sends failed" };
    },
  };
}

module.exports = {
  NotificationService,
  NOTIFICATION_EVENTS,
  createInAppAdapter,
  createWebPushAdapter,
  createEmailAdapter,
  createNativePushAdapter,
  simpleEmailHtml,
  isWithinQuietHours,
  nowInIstHhmm,
};
