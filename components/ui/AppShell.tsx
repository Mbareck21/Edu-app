import type { ReactNode } from "react";

import BottomNav from "@/components/ui/BottomNav";

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
      >
        {children}
      </main>
      {nav ? <BottomNav /> : null}
    </>
  );
}

export { AppShell };
