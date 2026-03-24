// public/sw-notify.js
// Injected by vite-plugin-pwa into the SW via importScripts or injectManifest.
// Handles push events and notification clicks for PlusMinus alerts.
//
// HOW TO WIRE THIS IN:
// In vite.config.js, change VitePWA strategy to "injectManifest" and set
// srcDir/filename to point here, OR add this logic directly to your
// custom service worker file if you're using injectManifest mode.
// If you're on generateSW mode (default), see the simpler approach below —
// use the self.addEventListener blocks and register them via
// workbox's additionalManifestEntries or a sw-custom.js import.

// ── Push event ────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
    if (!event.data) return;
    let payload;
    try { payload = event.data.json(); }
    catch { payload = { title: "PlusMinus", body: event.data.text() }; }

    const { title = "PlusMinus", body = "", tag = "pm-default", data = {} } = payload;

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            tag,                          // deduplicates — same tag replaces old notification
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-72.png",
            data,
            vibrate: [100, 50, 100],
            requireInteraction: data.urgent ?? false,
        })
    );
});

// ── Notification click ────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = event.notification.data?.url ?? "/";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
            const existing = cs.find((c) => c.url.includes(self.location.origin));
            if (existing) { existing.focus(); existing.postMessage({ type: "NAVIGATE", url: target }); }
            else clients.openWindow(target);
        })
    );
});