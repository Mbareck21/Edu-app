// Shared celebration + encouragement helpers for the interactive worksheets.
// Lazy-loads canvas-confetti so the print view never pays its bundle cost.
// Reuses /api/tts via playTextThroughTTS so voice praise sounds like the
// existing AI buddy, and respects the existing mute toggle.

import { playTextThroughTTS, readAutoPlayPref } from "@/lib/voice";

// ────────────────────────────────────────────────────────────────────────────
// ✏️ PARENT CONTRIBUTION #5 — Praise phrases
// ────────────────────────────────────────────────────────────────────────────
// Edit these freely. Bilingual (English + Arabic) is fine — the TTS endpoint
// already chunks by language and uses the right neural voice for each.
// One short phrase per entry — they're spoken aloud quickly.
// ────────────────────────────────────────────────────────────────────────────
export const PRAISES: readonly string[] = [
  "Great job!",
  "Awesome!",
  "Nice work!",
  "You got it!",
  "Excellent!",
  "أحسنت!",
];

export const ENCOURAGEMENTS: readonly string[] = [
  "Almost!",
  "Try again!",
  "You can do it!",
  "Keep going!",
  "حاول مرة أخرى!",
];

export const COMPLETION_PHRASE = "You finished it! Amazing work!";

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let lastVoiceAt = 0;
const VOICE_COOLDOWN_MS = 600;

function maybeSpeak(text: string, force = false): void {
  if (!readAutoPlayPref()) return; // mute toggle in /chat header wins
  const now = Date.now();
  if (!force && now - lastVoiceAt < VOICE_COOLDOWN_MS) return;
  lastVoiceAt = now;
  playTextThroughTTS(text);
}

function originOf(el: HTMLElement | null | undefined): { x: number; y: number } {
  if (!el || typeof window === "undefined") return { x: 0.5, y: 0.6 };
  const r = el.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (r.left + r.width / 2) / window.innerWidth)),
    y: Math.min(1, Math.max(0, (r.top + r.height / 2) / window.innerHeight)),
  };
}

export async function celebrate(opts: { source?: HTMLElement | null; big?: boolean; silent?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    confetti({
      particleCount: opts.big ? 250 : 80,
      spread: opts.big ? 180 : 70,
      origin: originOf(opts.source),
      scalar: opts.big ? 1.4 : 1.1,
      disableForReducedMotion: true,
    });
  } catch {
    // canvas-confetti failed to load (rare) — silently skip the visual; voice
    // is still the meaningful feedback.
  }
  if (opts.silent) return;
  maybeSpeak(opts.big ? COMPLETION_PHRASE : pickRandom(PRAISES), opts.big);
}

export function encourage(): void {
  maybeSpeak(pickRandom(ENCOURAGEMENTS));
}
