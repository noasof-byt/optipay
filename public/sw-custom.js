/**
 * OptiPay Custom Service Worker additions
 * next-pwa auto-generates the Workbox SW; this file is imported as an
 * additional entry point via next-pwa's `customWorkerDir` option.
 *
 * Responsibilities:
 *   1. Handle Web Push Notifications (PUSH event)
 *   2. Handle notification clicks (NOTIFICATIONCLICK event)
 *   3. Background Sync — queue "I used this route" requests when offline
 */

// ─── 1. Push Notifications ────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "OptiPay", body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "OptiPay", {
      body: body || "",
      icon: icon || "/icons/icon-192x192.png",
      badge: badge || "/icons/badge-96x96.png",
      tag: tag || "optipay-general",
      dir: "rtl",
      lang: "he",
      vibrate: [200, 100, 200],
      data: data || {},
      actions: [
        { action: "open", title: "פתח" },
        { action: "dismiss", title: "סגור" },
      ],
    })
  );
});

// ─── 2. Notification Click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing window if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── 3. Background Sync — "I used this route" ────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-route-usage") {
    event.waitUntil(flushRouteUsageQueue());
  }
});

async function flushRouteUsageQueue() {
  const cache = await caches.open("route-usage-queue");
  const keys = await cache.keys();

  for (const request of keys) {
    try {
      const response = await fetch(request.clone());
      if (response.ok) {
        await cache.delete(request);
      }
    } catch {
      // Will retry on next sync
    }
  }
}
