// Simple offline shell cache. Bump VERSION to force an update.
const VERSION = "ww-v20";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/ui.js",
  "./js/state.js",
  "./js/db.js",
  "./js/config.js",
  "./js/points.js",
  "./js/foods.js",
  "./js/foods-db.js",
  "./js/zeropoint-list.js",
  "./js/calibrations.js",
  "./js/actions.js",
  "./js/customfoods.js",
  "./js/foodsearch.js",
  "./js/views/myday.js",
  "./js/views/food.js",
  "./js/views/weight.js",
  "./js/views/activity.js",
  "./js/views/settings.js",
  "./js/views/friends.js",
  "./js/views/discover.js",
  "./js/views/corrections.js",
  "./js/views/onboarding.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache Firestore / Open Food Facts / CDN modules — always go to network.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchP = fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetchP;
    })
  );
});
