"use client";

import Icon from "@/components/ui/Icon";
import { tone, type AccentColor } from "@/components/ui/colors";

export type DoneCardProps = {
  title: string;
  line: string;
  color?: AccentColor;
  onAgain: () => void;
};

/** The card that drops in when the whole puzzle is solved. */
export default function DoneCard({ title, line, color = "green", onAgain }: DoneCardProps) {
  const t = tone(color);
  return (
    <div
      className="q-bounce-in mt-3 flex items-center gap-3 rounded-card border-2 p-4"
      style={{ background: t.soft, borderColor: t.base }}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{ background: t.base, color: t.on }}
      >
        <Icon name="trophy" size={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold" style={{ color: t.onSoft }}>
          {title}
        </p>
        <p className="text-sm" style={{ color: t.onSoft }}>
          {line}
        </p>
      </div>
      <button
        type="button"
        onClick={onAgain}
        className="btn-3d flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-display text-sm font-bold"
        style={{ background: t.base, color: t.on, ["--btn-shade" as string]: t.dark }}
      >
        <Icon name="sparkles" size={16} />
        Again
      </button>
    </div>
  );
}

export { DoneCard };
