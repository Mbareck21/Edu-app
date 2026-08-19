// Tiny WebAudio synth. No files, no network — just short beeps.
// Every entry point is a no-op on the server and when muted.

import { useCallback, useSyncExternalStore } from "react";

export const MUTE_KEY = "quest:muted";

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const w = window as Window & { webkitAudioContext?: Ctor };
  const Ctx: Ctor | undefined = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode — sound just stays on for this visit.
  }
  window.dispatchEvent(new CustomEvent("quest:muted", { detail: muted }));
}

type Tone = {
  freq: number;
  /** Seconds from now. */
  at?: number;
  dur?: number;
  gain?: number;
  type?: OscillatorType;
};

function play(tones: Tone[]): void {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume().catch(() => {});
  const start = ac.currentTime;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const at = start + (t.at ?? 0);
    const dur = t.dur ?? 0.12;
    const peak = t.gain ?? 0.14;
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

export const sfx = {
  tap(): void {
    play([{ freq: 520, dur: 0.06, gain: 0.07, type: "triangle" }]);
  },
  correct(): void {
    play([
      { freq: 660, dur: 0.11 },
      { freq: 990, at: 0.09, dur: 0.16 },
    ]);
  },
  wrong(): void {
    play([
      { freq: 200, dur: 0.16, type: "sawtooth", gain: 0.09 },
      { freq: 150, at: 0.1, dur: 0.2, type: "sawtooth", gain: 0.08 },
    ]);
  },
  levelUp(): void {
    play([
      { freq: 523, dur: 0.12 },
      { freq: 659, at: 0.1, dur: 0.12 },
      { freq: 784, at: 0.2, dur: 0.12 },
      { freq: 1047, at: 0.3, dur: 0.28 },
    ]);
  },
  chest(): void {
    play([
      { freq: 300, dur: 0.09, type: "square", gain: 0.06 },
      { freq: 450, at: 0.07, dur: 0.09, type: "square", gain: 0.06 },
      { freq: 880, at: 0.16, dur: 0.3, gain: 0.12 },
      { freq: 1320, at: 0.24, dur: 0.34, gain: 0.09 },
    ]);
  },
  isMuted,
  setMuted,
};

export type Sfx = typeof sfx;

/** The mute flag is external state (localStorage), so it is read as a store. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("quest:muted", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("quest:muted", onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Read + toggle the mute flag from a client component. */
export function useSfx(): { muted: boolean; setMuted: (m: boolean) => void; sfx: Sfx } {
  const muted = useSyncExternalStore(subscribe, isMuted, () => false);
  const update = useCallback((m: boolean) => setMuted(m), []);
  return { muted, setMuted: update, sfx };
}
