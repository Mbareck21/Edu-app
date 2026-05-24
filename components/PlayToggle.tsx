"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared state between the toggle button (rendered into WorksheetFrame's
// header slot) and the pane switcher (wrapping the worksheet body).
type PlayCtx = { playMode: boolean; toggle: () => void };
const Ctx = createContext<PlayCtx | null>(null);

export function PlayProvider({ children }: { children: ReactNode }) {
  const [playMode, setPlayMode] = useState(false);
  return (
    <Ctx.Provider value={{ playMode, toggle: () => setPlayMode((p) => !p) }}>
      {children}
    </Ctx.Provider>
  );
}

export function PlayToggleButton() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.toggle}
      className="btn-secondary no-print whitespace-nowrap"
      aria-pressed={ctx.playMode}
    >
      {ctx.playMode ? "📄 Print view" : "▶ Play on phone"}
    </button>
  );
}

// Renders both views into the DOM at all times. CSS in globals.css uses the
// data-mode attribute to show one on screen, and @media print uses !important
// to force the print view regardless of React state. That guarantees the
// printer never sees the interactive UI, even when play mode is active.
export function PlayPaneSwitcher({
  printView,
  playView,
}: {
  printView: ReactNode;
  playView: ReactNode;
}) {
  const ctx = useContext(Ctx);
  const mode = ctx?.playMode ? "play" : "print";
  return (
    <div className="play-toggle-root" data-mode={mode}>
      <div className="print-view">{printView}</div>
      <div className="play-view">{playView}</div>
    </div>
  );
}
