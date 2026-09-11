// io-map tile cache: a cache-first service worker for the swisstopo WMTS
// tiles ONLY — every other request passes through untouched (app assets,
// HMR, fonts). Cached tiles survive reloads and visits, so the idle
// preloader's progress accumulates until the whole timeline is local.
//
// Storage draws from the origin's shared best-effort quota (Chrome ~60% of
// disk, Firefox 10%/10GiB, Safari ~20%) — the browser evicts whole origins
// LRU-first under pressure, and Safari drops everything after 7 days
// without a visit; both just mean a re-warm.
//
// The cache NAME is version-keyed; bump it to invalidate every stored tile
// (basemap-preload.js mirrors it to skip already-cached URLs).
const TILE_CACHE = "io-map-tiles-v1";
const TILE_HOSTS = ["wmts.geo.admin.ch"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("io-map-tiles-") && key !== TILE_CACHE)
          await caches.delete(key);
      await self.clients.claim(); // intercept from the first visit on
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !TILE_HOSTS.includes(url.hostname))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(event.request, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(event.request);
      // only status 200 — a cached error would be permanent; quota failures
      // must not break the response either
      if (res.ok) cache.put(event.request, res.clone()).catch(() => {});
      return res;
    })(),
  );
});
