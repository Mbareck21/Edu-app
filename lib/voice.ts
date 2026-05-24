// Browser-only Web Speech API wrappers for the /chat voice feature.
//
// Two capabilities:
//   - startRecognition(): mic -> English transcript (live + final)
//   - speak(): play text through TTS, switching voice when Arabic appears
//
// Arabic detection is by Unicode range. We split mixed-language AI replies into
// chunks and set utterance.lang per chunk so the OS picks the right voice for
// each piece — otherwise embedded Arabic words come out as gibberish in an
// English voice.

const ARABIC_RE =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// Web Speech API isn't in lib.dom.d.ts on every TS setup; lookups via `any`.
type AnyWindow = typeof window & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as AnyWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function startRecognition(opts: {
  lang?: string;
  onInterim?: (transcript: string) => void;
}): { stop: () => void; promise: Promise<string | null> } {
  const w = window as AnyWindow;
  const Ctor =
    (w.SpeechRecognition as new () => unknown) ||
    (w.webkitSpeechRecognition as new () => unknown);
  if (!Ctor) return { stop: () => {}, promise: Promise.resolve(null) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recog: any = new Ctor();
  recog.lang = opts.lang ?? "en-US";
  recog.continuous = true;
  recog.interimResults = true;

  let finalText = "";
  let finished = false;

  const promise = new Promise<string | null>((resolve) => {
    const settle = (value: string | null) => {
      if (finished) return;
      finished = true;
      resolve(value);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      opts.onInterim?.((finalText + interim).trim());
    };
    recog.onerror = () => settle(finalText.trim() || null);
    recog.onend = () => settle(finalText.trim() || null);

    try {
      recog.start();
    } catch {
      settle(null);
    }
  });

  return {
    stop: () => {
      try { recog.stop(); } catch { /* ignore */ }
    },
    promise,
  };
}

// Split text into runs of one language each, so each utterance can use the right voice.
// Whitespace and punctuation attach to the surrounding chunk.
function chunkByLanguage(text: string): Array<{ lang: string; text: string }> {
  if (!text) return [];
  const out: Array<{ lang: string; text: string }> = [];
  let buf = "";
  let bufLang: "en-US" | "ar-SA" | null = null;

  const isLetter = (ch: string) => /\p{L}/u.test(ch);

  for (const ch of text) {
    let charLang: "en-US" | "ar-SA" | null = null;
    if (isLetter(ch)) charLang = ARABIC_RE.test(ch) ? "ar-SA" : "en-US";

    if (charLang && bufLang && charLang !== bufLang) {
      if (buf.trim()) out.push({ lang: bufLang, text: buf });
      buf = ch;
      bufLang = charLang;
    } else {
      if (charLang && !bufLang) bufLang = charLang;
      buf += ch;
    }
  }
  if (buf.trim()) out.push({ lang: bufLang ?? "en-US", text: buf });
  return out;
}

export function speak(
  text: string,
  opts: { rate?: number; onDone?: () => void } = {}
): { cancel: () => void } {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    opts.onDone?.();
    return { cancel: () => {} };
  }
  // Always start clean — iOS Safari sometimes stalls if a previous utterance is in flight.
  window.speechSynthesis.cancel();

  const chunks = chunkByLanguage(text);
  if (chunks.length === 0) {
    opts.onDone?.();
    return { cancel: () => {} };
  }

  const rate = opts.rate ?? 0.95; // slightly slower so a 9-year-old can follow
  let cancelled = false;
  let lastUtterance: SpeechSynthesisUtterance | null = null;

  for (const ch of chunks) {
    const u = new SpeechSynthesisUtterance(ch.text);
    u.lang = ch.lang;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    lastUtterance = u;
  }
  if (lastUtterance) {
    lastUtterance.onend = () => {
      if (!cancelled) opts.onDone?.();
    };
  }

  return {
    cancel: () => {
      cancelled = true;
      window.speechSynthesis.cancel();
    },
  };
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

// localStorage-backed auto-play preference. Default true (auto-play on).
const KEY = "eduapp.autoplay";

export function readAutoPlayPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}

export function writeAutoPlayPref(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
}
