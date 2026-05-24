// Client-side voice helpers for /chat.
//
// Two responsibilities:
//   - recordAudio(): MediaRecorder wrapper → returns the recorded audio Blob
//   - playUrl():     plays a /api/tts URL through an <audio> element
//
// All voice quality (STT + TTS) is now server-side via /api/transcribe and
// /api/tts. This file just wires up the browser-side input/output.

// ────────────────────────────────────────────────────────────────────────────
// Recording
// ────────────────────────────────────────────────────────────────────────────

export function isRecordingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

export type Recording = {
  stop: () => Promise<Blob | null>;
  cancel: () => void;
};

export async function recordAudio(): Promise<Recording> {
  if (!isRecordingSupported()) {
    return { stop: async () => null, cancel: () => {} };
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Pick the best mime type Chrome/Safari/Firefox all accept reliably.
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const finishStream = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          finishStream();
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: mimeType || chunks[0].type || "audio/webm" });
          resolve(blob);
        };
        try {
          recorder.stop();
        } catch {
          finishStream();
          resolve(null);
        }
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
      finishStream();
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Playback — point an <audio> element at /api/tts
// ────────────────────────────────────────────────────────────────────────────

export type Playback = {
  cancel: () => void;
  promise: Promise<void>;
};

export function playTextThroughTTS(text: string): Playback {
  if (typeof window === "undefined" || !text.trim()) {
    return { cancel: () => {}, promise: Promise.resolve() };
  }
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = `/api/tts?text=${encodeURIComponent(text)}`;
  const promise = new Promise<void>((resolve) => {
    const done = () => {
      audio.onended = null;
      audio.onerror = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
  return {
    cancel: () => {
      audio.pause();
      audio.src = "";
    },
    promise,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// ✏️ PARENT CONTRIBUTION #4 — Conversation-mode tuning
// ────────────────────────────────────────────────────────────────────────────
// Three knobs control how the hands-free conversation mode reacts to silence.
// Tweak whichever doesn't feel right after using the app for a session, then
// redeploy.
//
//   SILENCE_DURATION_MS — how long he must pause before the mic auto-submits.
//     Raise if he gets cut off mid-thought.
//     Lower if the gap before the AI replies feels too long.
//
//   INITIAL_WAIT_MS — how long the mic stays open waiting for him to speak.
//     If nothing is said in this window, conversation mode exits.
//     Raise if he needs time to think before each turn.
//
//   SPEECH_THRESHOLD_RMS — sensitivity. 0.005 ≈ quiet room ambient,
//     0.05+ ≈ clear speech. Default 0.015 is the safe middle.
//     Raise if background noise (TV, siblings) triggers false speech.
//     Lower if his soft voice isn't being detected.
// ────────────────────────────────────────────────────────────────────────────
export const SILENCE_DURATION_MS = 1500;
export const INITIAL_WAIT_MS = 6000;
export const SPEECH_THRESHOLD_RMS = 0.015;
const MAX_RECORDING_MS = 30_000;

// ────────────────────────────────────────────────────────────────────────────
// Held-stream helpers — conversation mode holds the mic across many turns so
// the browser doesn't re-prompt for permission and the start-up latency on
// Safari disappears.
// ────────────────────────────────────────────────────────────────────────────

export async function openMicStream(): Promise<MediaStream> {
  if (!isRecordingSupported()) {
    throw new Error("Microphone is not supported on this device.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      // The browser's built-in echo cancellation lets the mic stay open in the
      // same room as a speaker without falsely picking up the AI's own audio.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export function closeMicStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

// ────────────────────────────────────────────────────────────────────────────
// recordUntilSilent — captures one utterance from a held stream and resolves
// when the speaker pauses (or never starts). Used by conversation mode.
// ────────────────────────────────────────────────────────────────────────────

export type SilentRecordReason = "silence" | "timeout" | "cancelled" | "max";
export type SilentRecordResult = { blob: Blob | null; reason: SilentRecordReason };

export type SilentRecording = {
  /** Force-stop early; resolves the promise with reason: "cancelled". */
  cancel: () => void;
  promise: Promise<SilentRecordResult>;
};

export function recordUntilSilent(opts: {
  stream: MediaStream;
  silenceMs?: number;
  initialWaitMs?: number;
  maxMs?: number;
  thresholdRms?: number;
  /** Called ~20Hz with the current RMS for UI feedback. */
  onLevel?: (rms: number) => void;
}): SilentRecording {
  const silenceMs = opts.silenceMs ?? SILENCE_DURATION_MS;
  const initialWaitMs = opts.initialWaitMs ?? INITIAL_WAIT_MS;
  const maxMs = opts.maxMs ?? MAX_RECORDING_MS;
  const threshold = opts.thresholdRms ?? SPEECH_THRESHOLD_RMS;

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";
  const recorder = mimeType
    ? new MediaRecorder(opts.stream, { mimeType })
    : new MediaRecorder(opts.stream);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // AudioContext / AnalyserNode for time-domain RMS sampling. Created per
  // recording so we tear it down cleanly between turns.
  const AudioCtor =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new AudioCtor();
  const source = ctx.createMediaStreamSource(opts.stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  const startedAt = Date.now();
  let firstSpeechAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let pollTimer: number | null = null;
  let finished = false;

  // Deferred pattern: hold the resolver outside the Promise executor so both
  // the polling loop AND the external cancel() can resolve the same promise.
  let resolver!: (r: SilentRecordResult) => void;
  const promise = new Promise<SilentRecordResult>((res) => { resolver = res; });

  const cleanup = () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    try { source.disconnect(); } catch { /* ignore */ }
    try { analyser.disconnect(); } catch { /* ignore */ }
    ctx.close().catch(() => {});
  };

  const finish = (reason: SilentRecordReason) => {
    if (finished) return;
    finished = true;
    cleanup();
    recorder.onstop = () => {
      const blob =
        chunks.length === 0
          ? null
          : new Blob(chunks, { type: mimeType || chunks[0].type || "audio/webm" });
      // No-speech timeout returns null so the caller can skip calling
      // /api/transcribe with empty input.
      resolver({ blob: reason === "timeout" ? null : blob, reason });
    };
    try {
      if (recorder.state !== "inactive") recorder.stop();
      else resolver({ blob: null, reason });
    } catch {
      resolver({ blob: null, reason });
    }
  };

  pollTimer = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = (samples[i] - 128) / 128;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / samples.length);
    opts.onLevel?.(rms);

    const now = Date.now();
    if (rms > threshold) {
      if (firstSpeechAt === null) firstSpeechAt = now;
      lastSpeechAt = now;
    }

    // Stop conditions, in priority order.
    if (now - startedAt > maxMs) return finish("max");
    if (firstSpeechAt !== null && lastSpeechAt !== null && now - lastSpeechAt > silenceMs) {
      return finish("silence");
    }
    if (firstSpeechAt === null && now - startedAt > initialWaitMs) {
      return finish("timeout");
    }
  }, 50);

  try {
    recorder.start();
  } catch {
    finish("cancelled");
  }

  return {
    cancel: () => finish("cancelled"),
    promise,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Preferences
// ────────────────────────────────────────────────────────────────────────────

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
