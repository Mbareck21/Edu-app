"use client";

import { useEffect } from "react";

import { flushQueue } from "@/lib/offline-queue";

/**
 * Registers the service worker (production, or any environment with ?sw=1)
 * and pushes any sessions that were saved while offline.
 */
export default function RegisterSW() {
  useEffect(() => {
    void flushQueue();

    if (!("serviceWorker" in navigator)) return;
    const forced = new URLSearchParams(window.location.search).get("sw") === "1";
    if (process.env.NODE_ENV !== "production" && !forced) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No service worker is a downgrade, not a failure.
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}

export { RegisterSW };
