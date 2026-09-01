"use client";

import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    void flushQueue();

    if (!("serviceWorker" in navigator)) return;
    const forced = new URLSearchParams(window.location.search).get("sw") === "1";
    if (process.env.NODE_ENV !== "production" && !forced) return;

    let reloading = false;
    const onControllerChange = () => {
      // Fires once the worker we asked for has taken over. Guarded because a
      // browser can fire it more than once and a reload loop is unrecoverable
      // on a phone.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const onLoad = () => {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Already waiting when the page opened.
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              // A controller means this is an update, not the first install —
              // the first one has nothing to interrupt and should just run.
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                setWaiting(next);
              }
            });
          });
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
    };
  }, []);

  const takeUpdate = useCallback(() => {
    if (!waiting) return;
    setWaiting(null);
    // The worker calls skipWaiting() and controllerchange reloads us.
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  if (!waiting) return null;
  return <UpdateBar onReload={takeUpdate} />;
}

export { RegisterSW };
