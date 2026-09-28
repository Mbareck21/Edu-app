/* Quest service worker. Deliberately small:
   - precache the shell so the tabs open offline
   - network-first for page navigations, falling back to /offline
   - cache-first for hashed build assets and Google font files
   Nothing here caches API responses — progress must come from the server.

   Updates wait to be let in. This used to call skipWaiting() during install,
   so a deploy mid-session put a new worker in charge of a tab still running
   the old JavaScript — the new worker serving new build chunks to old code.
   Now a new version sits in "waiting" until the page asks for it, which the
   page does when he taps the update bar. See components/RegisterSW.tsx. */

const VERSION = "quest-v5";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
// Where the running worker records which version is live, so a NEW worker can
// tell an in-use cache from an orphan. Without it, every update he declines
// leaves a full shell-plus-chunks cache that only the next activation would
// clear — and on a phone near its quota, the browser starts evicting the
// caches actually in use.
const META = "quest-meta";
const LIVE_KEY = "https://quest.local/live-version";

const PRECACHE = ["/", "/math", "/drill", "/words", "/me", "/offline"];
// Build files kept in RUNTIME. Every deploy brings new hashed files, and the
// cache itself only changes with VERSION, so without a limit the files of
// every past deploy stayed on the phone for good. Past this, the oldest go.
const RUNTIME_MAX = 80;

/** The /_next/static URLs a precached page needs, read out of its own HTML. */
function buildAssets(html) {
  const found = new Set();
  const re = /["'(](\/_next\/static\/[^"')\s]+)["')]/g;
  let m;
  while ((m = re.exec(html)) !== null) found.add(m[1]);
  return [...found];
}

/** The version the controlling worker recorded when it activated. */
async function liveVersion() {
  try {
    const meta = await caches.open(META);
    const hit = await meta.match(LIVE_KEY);
    return hit ? await hit.text() : null;
  } catch {
    return null;
  }
}

/** Drop caches belonging to neither this worker nor the one running now. */
async function dropOrphans() {
  const live = await liveVersion();
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k !== META && !k.startsWith(VERSION) && !(live && k.startsWith(live)))
      .map((k) => caches.delete(k))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // A superseded worker that was still waiting left its caches behind.
      await dropOrphans();
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
      // No skipWaiting() here on purpose — see the note at the top.
    })()
  );
});

// The page asks for the new version when the child taps the update bar.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== META && !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      // Tell the next worker which version is in use, so its install can tell
      // an orphan from a cache this page is still serving from.
      const meta = await caches.open(META);
      await meta.put(LIVE_KEY, new Response(VERSION));
      await self.clients.claim();
    })()
  );
});

/** The build files the saved shell pages name, as paths. */
async function shellAssets() {
  const shell = await caches.open(SHELL);
  const needed = new Set();
  for (const page of await shell.keys()) {
    const res = await shell.match(page);
    if (!res) continue;
    for (const asset of buildAssets(await res.text())) {
      needed.add(new URL(asset, self.location.origin).pathname);
    }
  }
  return needed;
}

let trimming = null;

/**
 * Delete the oldest build files past RUNTIME_MAX. A file a saved page still
 * names is never deleted, whatever its age: without it that page opens
 * offline as a dead shell. One trim at a time; the next new file starts
 * another.
 */
function trimRuntime() {
  if (trimming) return trimming;
  trimming = (async () => {
    const runtime = await caches.open(RUNTIME);
    const builds = (await runtime.keys()).filter(
      (r) => new URL(r.url).pathname.startsWith("/_next/static/")
    );
    const extra = builds.length - RUNTIME_MAX;
    if (extra <= 0) return;
    const needed = await shellAssets();
    // keys() lists entries in the order they were stored, oldest first.
    const old = builds.filter((r) => !needed.has(new URL(r.url).pathname)).slice(0, extra);
    await Promise.all(old.map((r) => runtime.delete(r)));
  })()
    .catch(() => {})
    .finally(() => {
      trimming = null;
    });
  return trimming;
}

function cacheFirst(request, cacheName) {
  return (async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).then(trimRuntime);
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
