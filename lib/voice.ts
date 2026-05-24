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
