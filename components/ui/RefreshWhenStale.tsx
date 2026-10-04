"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Take the page again when the phone shows an old copy of it.
 *
 * He finishes a drill, swipes back, and the Drill page shows the numbers from
 * before the drill: a back gesture replays the page the browser already had
 * instead of asking the server. Reopening the app after a while does the
 * same. Both looked like the app had not saved his work.
 *
 * The server stamps each render. Seeing the same stamp twice on one path
 * means this is a replay, so ask the server for the page again. No clock is
 * compared, so a phone set to the wrong time cannot trigger it. Coming back
 * after a minute or more in the background refreshes too.
 *
 * Offline it waits. The service worker answers with the copy it saved, which
 * carries the same stamp every time: the refresh fails, Next falls back to
 * loading the page, the worker serves that copy again, and the page reloaded
 * forever. So nothing is asked while the phone is offline, one refresh goes
 * out when the network comes back, and a stamp is asked about once, which
 * also stops the loop on wifi that is connected but has no internet.
 */
export default function RefreshWhenStale({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const waiting = useRef(false);

  const refresh = useCallback(() => {
    if (navigator.onLine) router.refresh();
    else waiting.current = true;
  }, [router]);

  useEffect(() => {
    // The whole address, not the path: every drill is /drill/vocab or
    // /drill/math, so swiping back past the latest one replayed the drills
    // before it unchecked (2026-10-04 audit).
    const key = `quest:rendered:${pathname}${window.location.search}`;
    try {
      if (window.sessionStorage.getItem(key) === String(renderedAt)) {
        window.sessionStorage.setItem(key, `${renderedAt}:asked`);
        refresh();
      } else {
        window.sessionStorage.setItem(key, String(renderedAt));
      }
    } catch {
      // No storage: the page still works, it just will not self-refresh.
    }
  }, [pathname, renderedAt, refresh]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt > 0 && Date.now() - hiddenAt > 60_000) refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    const onOnline = () => {
      if (!waiting.current) return;
      waiting.current = false;
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, router]);

  return null;
}
