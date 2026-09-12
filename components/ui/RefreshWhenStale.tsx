"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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
 */
export default function RefreshWhenStale({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const key = `quest:rendered:${pathname}`;
    try {
      if (window.sessionStorage.getItem(key) === String(renderedAt)) router.refresh();
      else window.sessionStorage.setItem(key, String(renderedAt));
    } catch {
      // No storage: the page still works, it just will not self-refresh.
    }
  }, [pathname, renderedAt, router]);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt > 0 && Date.now() - hiddenAt > 60_000) router.refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
