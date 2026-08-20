"use client";

import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import { tone, type AccentColor } from "@/components/ui/colors";
import { sfx } from "@/lib/sfx";

export type GameBarProps = {
  color: AccentColor;
  done: number;
  total: number;
  /** Grade-3 word for what got done: "found", "solved". */
  unit: string;
  onReset: () => void;
};

/**
 * The one status row every game shows: how far along, and a way to start a
 * fresh puzzle. Reset confirms first, the same way the old Reset button did,
 * so a stray thumb can't wipe a half-solved board.
 */
export default function GameBar({ color, done, total, unit, onReset }: GameBarProps) {
  const t = tone(color);

  return (
    <div className="flex items-center gap-3 pt-3">
      <div className="min-w-0 flex-1">
        {/* Keyed on the count so the chip re-mounts and pops on every win. */}
        <span
          key={done}
          className={
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-bold" +
            (done > 0 ? " q-pop" : "")
          }
          style={{ background: t.soft, color: t.onSoft }}
        >
          <Icon name="check" size={15} />
          {done} of {total} {unit}
        </span>
        <ProgressBar
          value={total > 0 ? done / total : 0}
          color={color}
          height={10}
          className="mt-2"
          label={`${done} of ${total} ${unit}`}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          sfx.tap();
          if (window.confirm("Start a new puzzle? Your progress will be cleared.")) onReset();
        }}
        className="press-3d flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 font-display text-sm font-bold"
        style={{
          borderColor: "var(--color-line)",
          background: "#fff",
          color: "var(--color-muted)",
          ["--btn-shade" as string]: "var(--color-line)",
        }}
      >
        <Icon name="sparkles" size={16} />
        New
      </button>
    </div>
  );
}

export { GameBar };
