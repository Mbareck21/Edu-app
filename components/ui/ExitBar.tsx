import Link from "next/link";

import Icon from "@/components/ui/Icon";

/**
 * A way out of a full-screen activity, back to Home. The reading screens
 * hide the tab bar, and before this he could not leave one until he had
 * answered every question. His place is saved as he goes, so leaving midway
 * loses nothing: the passage is there when he comes back.
 */
export default function ExitBar({ href = "/", label = "Home" }: { href?: string; label?: string }) {
  return (
    <div className="safe-top px-4 pt-2">
      <Link
        href={href}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full pr-3 font-display text-sm font-bold"
        style={{ color: "var(--color-muted)" }}
      >
        <Icon name="x" size={22} />
        {label}
      </Link>
    </div>
  );
}
