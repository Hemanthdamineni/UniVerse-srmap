/* sw-push.js — Web Push handlers, imported by the generated Workbox service
 * worker (vite.config.ts → workbox.importScripts). Batch B8 / T6.2.2.
 *
 * The server sends JSON: { title, body, url, data }.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Notification", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "University ERP";
  const options = {
    body: payload.body || "",
    tag: payload.data?.eventKey || "erp-notification",
    data: { url: payload.url || "/", ...(payload.data || {}) },
    badge: "/pwa/icon-192.png",
    icon: "/pwa/icon-192.png",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // Focus an existing tab and route it if the app is already open.
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
