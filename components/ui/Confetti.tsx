"use client";

export type ConfettiKind = "small" | "big";

const COLORS = ["#22a06b", "#3b7de0", "#7c5ce6", "#f4b400", "#ff6b3d"];

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Fire canvas-confetti. Loaded on demand so it never lands in the server
 * bundle and never runs for a kid who asked for less motion.
 */
export async function fireConfetti(kind: ConfettiKind = "small"): Promise<void> {
  if (typeof window === "undefined" || reducedMotion()) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    if (kind === "small") {
      await confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 32,
        origin: { y: 0.7 },
        colors: COLORS,
        disableForReducedMotion: true,
      });
      return;
    }
    await confetti({
      particleCount: 150,
      spread: 100,
      startVelocity: 45,
      origin: { y: 0.62 },
      colors: COLORS,
      disableForReducedMotion: true,
    });
    window.setTimeout(() => {
      void confetti({
        particleCount: 80,
        spread: 120,
        startVelocity: 30,
        origin: { y: 0.5 },
        colors: COLORS,
        disableForReducedMotion: true,
      });
    }, 220);
  } catch {
    // Confetti is decoration — never let it break a lesson.
  }
}

export default fireConfetti;
