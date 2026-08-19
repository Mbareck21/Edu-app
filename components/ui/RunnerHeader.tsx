import Link from "next/link";
import type { ReactNode } from "react";

import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import type { AccentColor } from "@/components/ui/colors";

export type RunnerHeaderProps = {
  /** Where the X goes — usually back to the unit path. */
  href: string;
  /** 0..1 through the session. */
  value: number;
  color?: AccentColor;
  /** Timer, hearts-free counters, anything small. */
  right?: ReactNode;
  label?: string;
};

export default function RunnerHeader({
  href,
  value,
  color = "green",
  right,
  label = "Lesson progress",
}: RunnerHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
      <Link
        href={href}
        aria-label="Close"
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--color-muted)" }}
      >
        <Icon name="x" size={26} />
      </Link>
      <ProgressBar value={value} color={color} label={label} className="flex-1" />
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export { RunnerHeader };
