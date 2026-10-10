// Service worker — network-first for app shell, cache-first for product images.
// Product images (Supabase storage signed URLs + Lovable CDN assets) are cached
// aggressively so POS thumbnails load instantly on repeat use — critical on
// Surface Pro / tablets / mobile where network can be slow.
// When a product image is replaced the storage path changes (new UUID), so the
// new URL misses cache and is fetched + stored fresh; the stale entry is
// harmless and gets pruned by cache-size limit below.
const SHELL_CACHE = "hm-shell-v6";
const SHELL_MAX_ENTRIES = 150;
const IMG_CACHE = "hm-product-images-v1";
const IMG_MAX_ENTRIES = 400;


// Lets the app apply a newly downloaded version immediately.
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== IMG_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isProductImage(url) {
  // Supabase storage product-images bucket (signed URLs) OR Lovable CDN assets
  // OR any request the browser tagged as an image destination coming from https.
  return (
    url.pathname.includes("/storage/v1/object/") && url.pathname.includes("product-images")
  ) || url.pathname.startsWith("/__l5e/assets-v1/");
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Drop oldest first (Cache API preserves insertion order).
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cache-first for product images — ignore query string so re-signed URLs
  // (same object, new token/expiry) hit the same cached entry.
  if (isProductImage(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          cache.put(req, res.clone()).then(() => trimCache(IMG_CACHE, IMG_MAX_ENTRIES)).catch(() => {});
        }
        return res;
      } catch (err) {
        const fallback = await cache.match(req, { ignoreSearch: true });
        if (fallback) return fallback;
        throw err;
      }
    })());
    return;
  }

  // Page navigations: always straight from the network (never a cached page),
  // so a new build shows up immediately; cache only as an offline fallback.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-store" }).then((r) => {
        const copy = r.clone();
        caches.open(SHELL_CACHE).then((c) => c.put("/", copy)).catch(() => {});
        return r;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Version-check polls (/?v=timestamp) are unique URLs — never store them,
  // or the shell cache would grow forever on a device left open all day.
  if (url.searchParams.has("v") || req.headers.get("x-hm-version-check")) {
    return; // straight to network, no caching
  }

  // Network-first for everything else, with offline shell fallback.
  // Code and style files bypass the HTTP cache entirely so a page never runs
  // an older build's scripts.
  const fresh = req.destination === "script" || req.destination === "style" || req.destination === "document";
  e.respondWith(
    fetch(fresh ? new Request(req, { cache: "no-store" }) : req).then((r) => {
      const copy = r.clone();
      caches.open(SHELL_CACHE)
        .then((c) => c.put(req, copy).then(() => trimCache(SHELL_CACHE, SHELL_MAX_ENTRIES)))
        .catch(() => {});
      return r;
    }).catch(() => caches.match(req).then((r) => r || caches.match("/")))
  );
});
