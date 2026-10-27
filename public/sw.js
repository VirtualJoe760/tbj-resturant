// Minimal service worker: keeps the app shell and menu available offline,
// always prefers the network so prices and 86'd items stay current.
const CACHE = "shell-v1";
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
