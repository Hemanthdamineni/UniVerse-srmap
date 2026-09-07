const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

/**
 * Notification preferences + Web Push subscription management (Batch B8).
 *
 * GET    /api/notifications/vapid-key      — the public VAPID key (or 503)
 * GET    /api/notifications/preferences    — channel prefs + quiet hours + mutes
 * PUT    /api/notifications/preferences    — merge-write the above
 * POST   /api/notifications/push/subscribe — store a PushSubscription
 * POST   /api/notifications/push/unsubscribe
 * GET    /api/notifications/deliveries     — recent delivery log (for debugging)
 * POST   /api/notifications/test           — emit a test notification to self (dev)
 */
function createNotificationRoutes({ notificationStore, notificationService = null, vapid = null, sessionStore, adminPassword = "" }) {
  const router = express.Router();

  // One-click unsubscribe — no session; the HMAC token *is* the authorisation
  // (RFC 8058 List-Unsubscribe-Post lands here). Registered before the auth
  // gate. Batch B9 / T6.4.3.
  const unsubscribe = (req, res) => {
    const userId = String(req.query.u || req.body?.u || "");
    const token = String(req.query.t || req.body?.t || "");
    const ok = notificationStore.verifyUnsubscribe(userId, token);
    if (ok) {
      notificationStore.updatePreferences(userId, { channels: { email: false } });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(ok ? 200 : 400).send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <div style="font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;text-align:center;color:#0A3035">
          <h1 style="font-size:20px">${ok ? "Email digest turned off" : "Link expired or invalid"}</h1>
          <p style="color:#556;font-size:14px">${
            ok
              ? "You won't get the weekly email any more. Turn it back on any time in Settings &rarr; Push notifications."
              : "Manage your notification preferences from Settings inside the app."
          }</p>
        </div>`,
    );
  };
  router.get("/notifications/email/unsubscribe", unsubscribe);
  router.post("/notifications/email/unsubscribe", express.urlencoded({ extended: false }), unsubscribe);

  router.use(createUserContextMiddleware({ sessionStore, adminPassword }));

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }
  router.use(ensureAuthenticated);

  // Keep a userId -> email map current for the email adapter / digest.
  router.use((req, _res, next) => {
    if (req.userContext?.userId && req.userContext?.email) {
      notificationStore.rememberContact(req.userContext.userId, req.userContext.email, req.userContext.name);
    }
    next();
  });

  const wrap = (handler) => async (req, res) => {
    try {
      return sendApiSuccess(res, req, await handler(req));
    } catch (error) {
      return sendApiError(res, req, error);
    }
  };

  router.get("/notifications/vapid-key", wrap(() => {
    if (!vapid?.publicKey) {
      const err = new Error("Web Push is not configured on this server.");
      err.status = 503;
      throw err;
    }
    return { publicKey: vapid.publicKey };
  }));

  router.get("/notifications/preferences", wrap((req) => ({
    ...notificationStore.getPreferences(req.userContext.userId),
    pushSubscribed: notificationStore.hasSubscription(req.userContext.userId),
    webPushAvailable: Boolean(vapid?.publicKey),
    email: notificationStore.getContact(req.userContext.userId)?.email || req.userContext.email || null,
  })));

  router.put("/notifications/preferences", wrap((req) =>
    notificationStore.updatePreferences(req.userContext.userId, req.body || {}),
  ));

  router.post("/notifications/push/subscribe", wrap((req) => {
    notificationStore.saveSubscription(
      req.userContext.userId,
      req.body?.subscription || req.body,
      req.get("user-agent") || "",
    );
    // Make sure the channel is on once a device subscribes.
    notificationStore.updatePreferences(req.userContext.userId, { channels: { webPush: true } });
    return { subscribed: true };
  }));

  // Batch B13 — Capacitor native (FCM/APNs) device tokens.
  router.post("/notifications/native/register", wrap((req) => {
    notificationStore.saveNativeToken(
      req.userContext.userId,
      req.body?.token,
      req.body?.platform || "",
    );
    notificationStore.updatePreferences(req.userContext.userId, { channels: { nativePush: true } });
    return { registered: true };
  }));

  router.post("/notifications/native/unregister", wrap((req) => {
    const result = notificationStore.deleteNativeToken(req.body?.token);
    if (!notificationStore.hasNativeSubscription(req.userContext.userId)) {
      notificationStore.updatePreferences(req.userContext.userId, { channels: { nativePush: false } });
    }
    return result;
  }));

  router.post("/notifications/push/unsubscribe", wrap((req) => {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint;
    const result = notificationStore.deleteSubscription(endpoint);
    if (!notificationStore.hasSubscription(req.userContext.userId)) {
      notificationStore.updatePreferences(req.userContext.userId, { channels: { webPush: false } });
    }
    return result;
  }));

  router.get("/notifications/deliveries", wrap((req) =>
    ({ items: notificationStore.recentDeliveries(req.userContext.userId, req.query.limit) }),
  ));

  router.post("/notifications/test", wrap(async (req) => {
    if (!notificationService) {
      const err = new Error("Notification service unavailable");
      err.status = 503;
      throw err;
    }
    return notificationService.emit("organizer_message", {
      userId: req.userContext.userId,
      params: { subject: "Test notification", message: "If you can see this, notifications are working." },
    });
  }));

  return router;
}

module.exports = { createNotificationRoutes };
