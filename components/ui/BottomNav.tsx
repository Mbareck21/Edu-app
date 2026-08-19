"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Icon, { type IconName } from "@/components/ui/Icon";

type Tab = { href: string; label: string; icon: IconName };

const TABS: Tab[] = [
  { href: "/", label: "Learn", icon: "home" },
  { href: "/math", label: "Math", icon: "math" },
  { href: "/drill", label: "Drill", icon: "bolt" },
  { href: "/words", label: "Words", icon: "words" },
  { href: "/me", label: "Me", icon: "me" },
];

/** Full-screen runners own the whole screen — no nav under them. */
export function hidesNav(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "learn" && parts.length >= 3) return true; // /learn/[id]/[step]
  if (parts[0] === "math" && parts.length >= 2) return true; // /math/[skill]
  if (parts[0] === "drill" && parts.length >= 2) return true; // /drill/[mode]
  return false;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  if (hidesNav(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-app -translate-x-1/2 border-t"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="flex items-stretch justify-between px-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-tile py-2"
                style={{ color: active ? "var(--color-green)" : "var(--color-muted)" }}
              >
                <Icon name={tab.icon} size={24} strokeWidth={active ? 2.6 : 2.2} />
                <span className="font-display text-[11px] font-bold">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { BottomNav };
