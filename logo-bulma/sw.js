// 1 Milyonuncu Marka service worker: uygulama kabuğunu önbelleğe alır; sayfa ağdan, yoksa önbellekten gelir.
// Canlıda Web Push bildirimleri de burada karşılanır (push olayı).
const CACHE = "lb-v5";
const FILES = ["./", "index.html", "styles.css", "app.js", "data.js", "kurallar.js", "markalar.js", "logos/manifest.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("lb-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.includes("/api/")) return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })));
  }
});
self.addEventListener("push", e => {
  const d = e.data ? e.data.json() : {title:"1 Milyonuncu Marka", body:"Yeni kampanya başladı!"};
  e.waitUntil(self.registration.showNotification(d.title, {body:d.body, icon:"icons/icon-192.png", badge:"icons/favicon-32.png", data:{link:d.link || "./"}}));
});
self.addEventListener("notificationclick", e => { e.notification.close(); e.waitUntil(self.clients.openWindow(e.notification.data?.link || "./")); });
