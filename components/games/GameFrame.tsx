"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

import Icon, { type IconName } from "@/components/ui/Icon";
import { tone, type AccentColor } from "@/components/ui/colors";

export type GameFrameProps = {
  /** "Crossword", "Scramble", "Word Search". */
  title: string;
  listName: string;
  backHref: string;
  color: AccentColor;
  icon: IconName;
  /** The worksheet markup. Printed as-is — never restyle this pane. */
  printView: ReactNode;
  /** The interactive pane. Omit for the fallback pages that have no game. */
  playView?: ReactNode;
};

type Mode = "play" | "print";

/**
 * Screen chrome for the three word games.
 *
 * The header is `no-print`, and the body keeps the exact structure the print
 * CSS expects: a `.worksheet` main wrapping a `.play-toggle-root` with one
 * `.print-view` and one `.play-view` child. `@media print` forces the print
 * view visible with `!important`, so the paper output is the same whichever
 * mode is on screen — which is why the Print button works from either tab.
 */
export default function GameFrame({
  title,
  listName,
  backHref,
  color,
  icon,
  printView,
  playView,
}: GameFrameProps) {
  const [mode, setMode] = useState<Mode>(playView ? "play" : "print");
  const t = tone(color);
  const lineBtn: CSSProperties = {
    borderColor: "var(--color-line)",
    background: "#fff",
    color: "var(--color-ink)",
    ["--btn-shade" as string]: "var(--color-line)",
  };

  return (
    <>
      <header
        className="no-print sticky top-0 z-30 border-b"
        style={{ background: "var(--color-bg)", borderColor: "var(--color-line)" }}
      >
        <div className="safe-top mx-auto flex max-w-app flex-col gap-2 px-3 pb-3">
          <div className="flex items-center gap-2">
            <Link
              href={backHref}
              aria-label="Back to the list"
              className="press-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
              style={lineBtn}
            >
              <Icon name="arrowLeft" size={20} />
            </Link>
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile"
              style={{ background: t.soft, color: t.onSoft }}
            >
              <Icon name={icon} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h1
                className="truncate font-display text-xl font-bold leading-tight"
                style={{ color: t.onSoft }}
              >
                {title}
              </h1>
              <p className="truncate text-xs font-bold" style={{ color: "var(--color-muted)" }}>
                {listName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {playView ? (
              <div
                className="flex flex-1 rounded-full border-2 p-1"
                style={{ borderColor: "var(--color-line)", background: "#fff" }}
                role="group"
                aria-label="View"
              >
                <Segment
                  label="Play"
                  icon="play"
                  on={mode === "play"}
                  t={t}
                  onClick={() => setMode("play")}
                />
                <Segment
                  label="Worksheet"
                  icon="words"
                  on={mode === "print"}
                  t={t}
                  onClick={() => setMode("print")}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print"
              title="Print"
              className="press-3d flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2"
              style={lineBtn}
            >
              <Icon name="print" size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="worksheet mx-auto w-full max-w-app px-3 pb-10">
        <div className="play-toggle-root" data-mode={mode}>
          <div className="print-view">{printView}</div>
          <div className="play-view">{playView}</div>
        </div>
      </main>
    </>
  );
}

function Segment({
  label,
  icon,
  on,
  t,
  onClick,
}: {
  label: string;
  icon: IconName;
  on: boolean;
  t: ReturnType<typeof tone>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full font-display text-sm font-bold"
      style={on ? { background: t.base, color: t.on } : { color: "var(--color-muted)" }}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

export { GameFrame };
