// The phone's own speech recognition (Chrome on Android, Safari on iOS), for
// short spoken answers. Unlike /api/transcribe it costs nothing, has no hourly
// limit and hears while he speaks, so a quick answer is caught quickly.
//
// Client only. Callers fall back to recording + /api/transcribe when
// canListen() is false.

type Alternative = { transcript: string };
type Result = { isFinal: boolean; length: number; [i: number]: Alternative };
type ResultEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return ctor() !== null;
}

export type Listening = {
  /** Every guess heard, best first; empty when nothing was said. */
  promise: Promise<{ alternatives: string[]; blocked: boolean }>;
  cancel: () => void;
};

/**
 * Listen for one short answer. `accept` sees each guess as it comes in; when
 * it returns true the listening stops at once instead of waiting for him to
 * go quiet, which is what makes a fast answer feel fast.
 */
export function listenOnce(opts: { accept?: (alternatives: string[]) => boolean; maxMs?: number }): Listening {
  const Ctor = ctor();
  if (!Ctor) return { promise: Promise.resolve({ alternatives: [], blocked: false }), cancel: () => {} };

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;

  let heard: string[] = [];
  let blocked = false;
  let settled = false;
  let resolve!: (v: { alternatives: string[]; blocked: boolean }) => void;
  const promise = new Promise<{ alternatives: string[]; blocked: boolean }>((r) => (resolve = r));
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolve({ alternatives: heard, blocked });
  };
  const timer = setTimeout(() => {
    try {
      rec.stop();
    } catch {
      finish();
    }
  }, opts.maxMs ?? 8000);

  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    const guesses: string[] = [];
    for (let i = 0; i < last.length; i++) guesses.push(last[i].transcript);
    heard = guesses;
    if (opts.accept?.(guesses)) {
      finish();
      try {
        rec.abort();
      } catch {
        // Already stopping.
      }
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") blocked = true;
  };
  rec.onend = finish;
  try {
    rec.start();
  } catch {
    finish();
  }
  return {
    promise,
    cancel: () => {
      heard = [];
      finish();
      try {
        rec.abort();
      } catch {
        // Already stopped.
      }
    },
  };
}
