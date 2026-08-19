/* Quest service worker. Deliberately small:
   - precache the shell so the tabs open offline
   - network-first for page navigations, falling back to /offline
   - cache-first for hashed build assets and Google font files
   Nothing here caches API responses — progress must come from the server. */

const VERSION = "quest-v1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = ["/", "/math", "/drill", "/words", "/me", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function cacheFirst(request, cacheName) {
  return (async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  })();
}

function networkFirst(request) {
  return (async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(SHELL);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      const offline = await caches.match("/offline");
      if (offline) return offline;
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  if (url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(request, RUNTIME));
  }
});
