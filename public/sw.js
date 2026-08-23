/* Quest service worker. Deliberately small:
   - precache the shell so the tabs open offline
   - network-first for page navigations, falling back to /offline
   - cache-first for hashed build assets and Google font files
   Nothing here caches API responses — progress must come from the server. */

const VERSION = "quest-v3";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = ["/", "/math", "/drill", "/words", "/me", "/offline"];

/** The /_next/static URLs a precached page needs, read out of its own HTML. */
function buildAssets(html) {
  const found = new Set();
  const re = /["'(](\/_next\/static\/[^"')\s]+)["')]/g;
  let m;
  while ((m = re.exec(html)) !== null) found.add(m[1]);
  return [...found];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const runtime = await caches.open(RUNTIME);
      // cache.add would happily store a login redirect when the user is not
      // signed in yet; fetch each page and keep only real, non-redirected 200s.
      await Promise.allSettled(
        PRECACHE.map(async (url) => {
          const response = await fetch(url, { credentials: "include" });
          if (!response.ok || response.redirected) return;
          const html = await response.clone().text();
          await cache.put(url, response);
          // The HTML alone is not the page. Without its build chunks an
          // offline tab renders a dead shell: it looks loaded, but nothing
          // hydrates — no buttons, no audio — which is worse than /offline.
          await Promise.allSettled(
            buildAssets(html).map(async (asset) => {
              if (await runtime.match(asset)) return;
              const res = await fetch(asset);
              if (res.ok) await runtime.put(asset, res);
            })
          );
        })
      );
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
      const path = new URL(request.url).pathname;
      // Only refresh the known shell pages, and never store a redirected
      // response (e.g. the login redirect) — it would poison the offline shell.
      if (response && response.ok && !response.redirected && PRECACHE.includes(path)) {
        const cache = await caches.open(SHELL);
        cache.put(path, response.clone());
      }
      return response;
    } catch {
      const cached =
        (await caches.match(new URL(request.url).pathname)) ||
        (await caches.match(request));
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
