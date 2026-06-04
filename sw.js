/* sw.js — hand-written service worker for ranzlappen.com (the Jekyll blog).
   No build step, no Workbox. Bump CACHE_VERSION to invalidate.
   Scope note: the sub-apps /polyvote/, /blog-admin/, /inventory/ are
   independent SPAs (PolyVote ships its own vite-plugin-pwa worker), so this
   worker deliberately ignores those paths and never caches them. */
"use strict";

const CACHE_VERSION = "ranzlappen-v7";
const PRECACHE = CACHE_VERSION + "-precache";
const RUNTIME = CACHE_VERSION + "-runtime";

// Sub-app prefixes this worker must not touch.
const EXCLUDE = ["/polyvote/", "/blog-admin/", "/inventory/"];

// Minimal app shell so the blog opens offline. Individual posts/pages are
// captured by the runtime cache on first visit.
const PRECACHE_URLS = [
  "/",
  "/assets/css/style.css",
  "/assets/js/main.js",
  "/assets/images/loader/brand-loader.mp4",
  "/assets/images/loader/brand-loader-poster.png",
  "/icons/favicon.ico",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/site.webmanifest",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // Tolerate any single missing asset so install never fails the worker.
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((u) =>
            cache.add(u).catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PRECACHE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET; ignore the independent sub-apps entirely.
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    EXCLUDE.some((p) => url.pathname.startsWith(p))
  ) {
    return;
  }

  // Navigations: network-first, fall back to cache, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
