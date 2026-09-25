import type { ReactNode } from "react";

import Icon from "@/components/ui/Icon";

/** A card that starts closed: the title shows, the rest waits for a tap. */
export default function Fold({
  title,
  children,
  open,
  className = "",
}: {
  title: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details
      open={open}
      className={`group rounded-card border p-4 shadow-card ${className}`}
      style={{ background: "#fff", borderColor: "var(--color-line)" }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <span
          className="shrink-0 transition-transform group-open:rotate-45"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="plus" size={20} />
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export { Fold };
