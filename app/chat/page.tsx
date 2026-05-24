"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isRecordingSupported,
  recordAudio,
  playTextThroughTTS,
  readAutoPlayPref,
  writeAutoPlayPref,
  openMicStream,
  closeMicStream,
  recordUntilSilent,
  type Playback,
  type Recording,
  type SilentRecording,
} from "@/lib/voice";

type Msg = { role: "user" | "assistant"; content: string };

// Conversation-mode state machine. `off` means we're in normal single-utterance UI.
type ConvState =
  | { kind: "off" }
  | { kind: "listening" }
  | { kind: "transcribing" }
  | { kind: "thinking" }
  | { kind: "streaming" }
  | { kind: "speaking"; messageIdx: number };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoPlay, setAutoPlay] = useState(true);
  const [micAvailable, setMicAvailable] = useState(false);

  // Single-utterance flow state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  // Conversation-mode flow state
  const [convState, setConvState] = useState<ConvState>({ kind: "off" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<Recording | null>(null);
  const playbackRef = useRef<Playback | null>(null);

  // Refs the async conversation loop reads each iteration. State alone would
  // give the loop stale closures.
  const stopRef = useRef(false);
  const messagesRef = useRef<Msg[]>([]);
  const autoPlayRef = useRef(true);
  const micStreamRef = useRef<MediaStream | null>(null);
  const silentRecRef = useRef<SilentRecording | null>(null);

  useEffect(() => {
    setMicAvailable(isRecordingSupported());
    const initial = readAutoPlayPref();
    setAutoPlay(initial);
    autoPlayRef.current = initial;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  // Cleanup on unmount: cancel audio + close mic if conversation mode was on.
  useEffect(
    () => () => {
      playbackRef.current?.cancel();
      silentRecRef.current?.cancel();
      closeMicStream(micStreamRef.current);
    },
    []
  );

  // Helper that updates both state (for UI) and ref (for loop reads).
  function updateMessages(next: Msg[] | ((m: Msg[]) => Msg[])) {
    setMessages((prev) => {
      const v = typeof next === "function" ? (next as (m: Msg[]) => Msg[])(prev) : next;
      messagesRef.current = v;
      return v;
    });
  }

  function toggleAutoPlay() {
    const next = !autoPlay;
    setAutoPlay(next);
    autoPlayRef.current = next;
    writeAutoPlayPref(next);
    if (!next) {
      playbackRef.current?.cancel();
      setSpeakingIdx(null);
    }
  }

  function playMessage(idx: number, text: string) {
    playbackRef.current?.cancel();
    setSpeakingIdx(idx);
    const pb = playTextThroughTTS(text);
    playbackRef.current = pb;
    pb.promise.then(() => {
      setSpeakingIdx((cur) => (cur === idx ? null : cur));
    });
  }

  // ───────────── Single-utterance flow ─────────────

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messagesRef.current, { role: "user", content: text }];
    updateMessages(next);
    setStreaming(true);
    updateMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const acc = await streamChatReply(next);
      if (acc === null) return;

      if (autoPlay && acc.trim()) {
        const idx = next.length;
        playMessage(idx, acc);
      }
    } finally {
      setStreaming(false);
    }
  }

  // Sends the conversation and streams the reply into the last assistant
  // message slot. Returns the final assistant text, or null on error.
  // Shared by single-utterance send() and the conversation loop.
  async function streamChatReply(history: Msg[]): Promise<string | null> {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          setError(
            `Slow down — you can send more in about ${Math.ceil(
              (data.retryAfterSec || 60) / 60
            )} minute(s).`
          );
        } else {
          const data = await res.json().catch(() => ({}));
          setError(typeof data.error === "string" ? data.error : `Error ${res.status}`);
        }
        updateMessages((m) => m.slice(0, -1));
        return null;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response body.");
        updateMessages((m) => m.slice(0, -1));
        return null;
      }
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        updateMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      return acc;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      updateMessages((m) => m.slice(0, -1));
      return null;
    }
  }

  async function startRecording() {
    if (!micAvailable || recording || transcribing || streaming || convState.kind !== "off") return;
    setError(null);
    playbackRef.current?.cancel();
    setSpeakingIdx(null);
    try {
      const rec = await recordAudio();
      recordingRef.current = rec;
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow it in your browser settings to use voice."
          : "Could not start the microphone."
      );
    }
  }

  async function stopRecording() {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    setRecording(false);
    setTranscribing(true);

    try {
      const blob = await rec.stop();
      if (!blob || blob.size === 0) {
        setTranscribing(false);
        return;
      }
      const text = await transcribeBlob(blob);
      if (!text) {
        setError("I didn't hear anything — try again.");
        return;
      }
      setInput(text);
      setTimeout(() => send(text), 150);
    } finally {
      setTranscribing(false);
    }
  }

  // Used by both single-utterance and conversation flows.
  async function transcribeBlob(blob: Blob): Promise<string | null> {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        res.status === 429
          ? "Whoa — taking a quick break before more voice messages."
          : typeof data.error === "string"
            ? `Could not understand: ${data.error}`
            : "Could not understand the audio."
      );
      return null;
    }
    const data = (await res.json()) as { text?: string };
    return (data.text || "").trim() || null;
  }

  // ───────────── Conversation-mode loop ─────────────

  async function startConversation() {
    if (!micAvailable || convState.kind !== "off" || streaming || recording || transcribing) return;
    setError(null);
    playbackRef.current?.cancel();
    setSpeakingIdx(null);

    let stream: MediaStream;
    try {
      stream = await openMicStream();
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission was blocked. Allow it in your browser settings to use voice."
          : "Could not start the microphone."
      );
      return;
    }
    micStreamRef.current = stream;
    stopRef.current = false;

    try {
      while (!stopRef.current) {
        // ── LISTENING ──
        setConvState({ kind: "listening" });
        const rec = recordUntilSilent({ stream });
        silentRecRef.current = rec;
        const result = await rec.promise;
        silentRecRef.current = null;
        if (stopRef.current) break;

        // No speech in the initial window → assume he's done / walked off.
        if (result.reason === "timeout" || !result.blob || result.blob.size === 0) {
          break;
        }

        // ── TRANSCRIBING ──
        setConvState({ kind: "transcribing" });
        const text = await transcribeBlob(result.blob);
        if (stopRef.current) break;
        if (!text) continue; // empty transcript → keep listening

        const next: Msg[] = [...messagesRef.current, { role: "user", content: text }];
        updateMessages(next);

        // ── THINKING / STREAMING ──
        setConvState({ kind: "thinking" });
        updateMessages((m) => [...m, { role: "assistant", content: "" }]);
        setConvState({ kind: "streaming" });
        const acc = await streamChatReply(next);
        if (stopRef.current) break;
        if (!acc || !acc.trim()) continue;

        // ── SPEAKING (only when auto-play is on) ──
        if (autoPlayRef.current) {
          const idx = next.length;
          setConvState({ kind: "speaking", messageIdx: idx });
          setSpeakingIdx(idx);
          const pb = playTextThroughTTS(acc);
          playbackRef.current = pb;
          await pb.promise;
          setSpeakingIdx((cur) => (cur === idx ? null : cur));
          if (stopRef.current) break;
        }
      }
    } finally {
      silentRecRef.current?.cancel();
      playbackRef.current?.cancel();
      closeMicStream(micStreamRef.current);
      micStreamRef.current = null;
      setSpeakingIdx(null);
      setConvState({ kind: "off" });
    }
  }

  function stopConversation() {
    stopRef.current = true;
    silentRecRef.current?.cancel();
    playbackRef.current?.cancel();
  }

  function interruptSpeech() {
    // Cuts off AI audio; the awaited playback promise resolves and the loop
    // naturally proceeds to the next "listening" iteration.
    playbackRef.current?.cancel();
    setSpeakingIdx(null);
  }

  function clearAll() {
    playbackRef.current?.cancel();
    setSpeakingIdx(null);
    updateMessages([]);
    setError(null);
  }

  // ───────────── UI ─────────────

  const convActive = convState.kind !== "off";
  const micBusy = recording || transcribing;

  const stateLabel: Record<ConvState["kind"], string> = {
    off: "",
    listening: "🎤 Listening…",
    transcribing: "⏳ Hearing you…",
    thinking: "🤔 Thinking…",
    streaming: "💬 Replying…",
    speaking: "⏹ Tap to interrupt",
  };
  const stateBg: Record<ConvState["kind"], string> = {
    off: "",
    listening: "bg-rose-600 text-white animate-pulse",
    transcribing: "bg-slate-300 text-slate-900",
    thinking: "bg-slate-300 text-slate-900",
    streaming: "bg-slate-300 text-slate-900",
    speaking: "bg-emerald-600 text-white",
  };

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col px-4 py-3">
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Home</Link>
        <h1 className="text-lg font-semibold">AI Buddy</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAutoPlay}
            className="text-base"
            title={autoPlay ? "Mute auto-play" : "Unmute auto-play"}
            aria-label={autoPlay ? "Mute auto-play" : "Unmute auto-play"}
          >
            {autoPlay ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            className="text-sm text-slate-600 hover:underline disabled:opacity-50"
            onClick={clearAll}
            disabled={streaming || convActive || messages.length === 0}
          >
            Clear
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Say hi! Tap <strong>Talk</strong> for a hands-free conversation, or use the mic for one message at a time.
          </p>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const showReplay = m.role === "assistant" && m.content && !(streaming && isLast) && !convActive;
          return (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-base " +
                  (m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900")
                }
              >
                {m.content || (streaming && isLast ? "…" : "")}
              </div>
              {showReplay && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => playMessage(i, m.content)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                    aria-label="Play this message"
                    title="Play this message"
                  >
                    {speakingIdx === i ? "🔊 playing…" : "🔊 play"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recording && !convActive && (
        <p className="mt-2 text-sm text-rose-600">
          🎤 Listening… <span className="text-slate-700">tap the square when you finish</span>
        </p>
      )}
      {transcribing && !convActive && (
        <p className="mt-2 text-sm text-slate-600">⏳ Understanding what you said…</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Bottom bar — single-utterance composer OR conversation-mode controls */}
      {!convActive ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {micAvailable && (
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={streaming || transcribing}
              className={
                "inline-flex items-center justify-center rounded-md px-3 text-lg transition-colors disabled:opacity-50 " +
                (recording
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-100")
              }
              aria-label={recording ? "Stop and send" : "Start listening"}
              title={recording ? "Stop and send" : "Start listening"}
            >
              {recording ? "■" : "🎤"}
            </button>
          )}
          {micAvailable && (
            <button
              type="button"
              onClick={startConversation}
              disabled={streaming || micBusy}
              className="btn-secondary whitespace-nowrap"
              title="Hands-free conversation"
            >
              💬 Talk
            </button>
          )}
          <input
            className="input flex-1"
            placeholder={micBusy ? "Listening…" : "Type, tap mic, or tap Talk…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || micBusy}
          />
          <button type="submit" className="btn-primary" disabled={streaming || micBusy || !input.trim()}>
            {streaming ? "…" : "Send"}
          </button>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={stopConversation}
            className="btn-secondary"
            aria-label="Stop conversation"
            title="Stop conversation"
          >
            × Stop
          </button>
          <button
            type="button"
            onClick={convState.kind === "speaking" ? interruptSpeech : undefined}
            className={
              "flex-1 inline-flex items-center justify-center rounded-md px-4 py-3 text-base font-medium transition-colors " +
              stateBg[convState.kind]
            }
            disabled={convState.kind !== "speaking"}
          >
            {stateLabel[convState.kind]}
          </button>
        </div>
      )}
    </main>
  );
}
