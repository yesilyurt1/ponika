// Ponika service worker: oyunu internetsiz de çalıştırır.
const CACHE = "ponika-v0.3.1";
const FILES = ["./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("ponika-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Game page: network first so updates arrive, cache when offline
  if (req.mode === "navigate") {
    // Only a good copy of the game page may replace the cached one (never a 404 or error page)
    const isGame = url.pathname === new URL("./", self.registration.scope).pathname || url.pathname.endsWith("/index.html");
    e.respondWith(fetch(req).then(r => {
      if (r.ok && isGame) { const copy = r.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); }
      return r;
    }).catch(() => caches.match("index.html")));
    return;
  }
  // Fonts and icons: cache first
  if (url.origin === location.origin || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
