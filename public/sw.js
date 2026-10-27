// Minimal service worker: keeps the app shell and menu available offline,
// always prefers the network so prices and 86'd items stay current.
const CACHE = "shell-v2";
const SHELL = ["/", "/menu", "/events"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || req.url.includes("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
  );
});

// Order alerts (Web Push): "We started your order", "Ready for pickup", "On its way".
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || "Order update", {
    body: d.body || "", tag: d.tag, renotify: true, icon: "/icon-192", badge: "/icon-192", data: { url: d.url || "/account" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
    const open = tabs.find((t) => t.url === url);
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
