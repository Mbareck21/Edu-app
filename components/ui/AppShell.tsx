import type { ReactNode } from "react";

import BottomNav from "@/components/ui/BottomNav";
import RefreshWhenStale from "@/components/ui/RefreshWhenStale";
import { requestSeed } from "@/components/ui/time";

export type AppShellProps = {
  children: ReactNode;
  /** Hide the bottom nav for full-screen runners. */
  nav?: boolean;
  /** Drop the default side padding when a page paints edge to edge. */
  padded?: boolean;
  className?: string;
};

/**
 * Page wrapper: safe-area padding at the top, room for the bottom nav, and
 * the nav itself. The phone-width frame lives in app/layout.tsx.
 */
export default function AppShell({
  children,
  nav = true,
  padded = true,
  className = "",
}: AppShellProps) {
  return (
    <>
      <main
        className={[
          "safe-top min-h-dvh",
          padded ? "px-4" : "",
          nav ? "pad-nav" : "safe-bottom",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        // How much of the bottom the tab bar covers, for anything pinned to
        // the bottom inside the page (LessonComplete's buttons, a Save bar).
        style={{ ["--nav-h" as string]: nav ? "calc(61px + env(safe-area-inset-bottom))" : "0px" }}
      >
        {children}
      </main>
      <RefreshWhenStale renderedAt={requestSeed()} />
      {nav ? <BottomNav /> : null}
    </>
  );
}

export { AppShell };
