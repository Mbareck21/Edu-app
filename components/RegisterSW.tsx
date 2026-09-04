"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import UpdateBar from "@/components/ui/UpdateBar";
import { flushQueue } from "@/lib/offline-queue";

/**
 * Owns the service worker lifecycle: registers it (production, or any
 * environment with ?sw=1), pushes sessions saved while offline, and offers the
 * update bar when a new version is waiting.
 *
 * The worker no longer takes over on its own. It used to call skipWaiting()
 * during install, which put a new worker in charge of a tab still running the
 * old JavaScript — new build chunks served to old code, which looks like dead
 * buttons rather than an error. Now it waits until he taps.
 */
export default function RegisterSW() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  /** Set only when he taps. Nothing else may reload the page under him. */
  const askedForIt = useRef(false);

  useEffect(() => {
    void flushQueue();

    if (!("serviceWorker" in navigator)) return;
    const forced = new URLSearchParams(window.location.search).get("sw") === "1";
    if (process.env.NODE_ENV !== "production" && !forced) return;

    let reloading = false;
    const onControllerChange = () => {
      // The worker's activate handler calls clients.claim(), which fires this
      // on a FIRST install too — no update involved. Reloading there threw a
      // brand new visitor out of whatever he had just tapped. Only a handover
      // he asked for may reload the page.
      if (!askedForIt.current || reloading) return;
      reloading = true;
      window.location.reload();
    };

    let registration: ServiceWorkerRegistration | null = null;
    /** Watch a worker that is on its way in, and offer it once it is ready. */
    const watch = (sw: ServiceWorker | null) => {
      if (!sw) return;
      const offer = () => {
        // A controller means this is an update, not the first install — the
        // first one has nothing to interrupt and should just run.
        if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
      };
      offer();
      sw.addEventListener("statechange", offer);
    };

    const onUpdateFound = () => watch(registration?.installing ?? null);

    const onLoad = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          registration = reg;
          // Already waiting when the page opened.
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
          // Already installing when the page opened: updatefound has fired
          // before we could listen, so it would otherwise land silently and
          // he would see no bar until he next reopened the app.
          watch(reg.installing);
          reg.addEventListener("updatefound", onUpdateFound);
        })
        .catch(() => {
          // No service worker is a downgrade, not a failure.
        });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  const takeUpdate = useCallback(() => {
    if (!waiting) return;
    askedForIt.current = true;
    // The bar stays until controllerchange actually reloads us. Clearing it
    // here meant a handover that never landed — tab backgrounded, worker
    // already discarded — left him with no way to ask again.
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  const dismiss = useCallback(() => setWaiting(null), []);

  if (!waiting) return null;
  return <UpdateBar onReload={takeUpdate} onDismiss={dismiss} />;
}

export { RegisterSW };
