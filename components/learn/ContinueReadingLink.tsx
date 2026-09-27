"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { todayKey } from "@/lib/day";
import { continueHref, openReading } from "@/lib/reading-resume";

function subscribe(): () => void {
  // The remembered page only changes on the reading page itself.
  return () => {};
}

/**
 * The Reading beat's link. It goes back to the reading he left today, which
 * is not always the unit's list the server picked. The server render and
 * hydration use `href`; the stored page takes over right after.
 */
export default function ContinueReadingLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const to = useSyncExternalStore(
    subscribe,
    () => continueHref(openReading(), todayKey(), href),
    () => href
  );
  return (
    <Link href={to} className={className} style={style}>
      {children}
    </Link>
  );
}
