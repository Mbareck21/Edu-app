"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isRecordingSupported,
  recordAudio,
  playTextThroughTTS,
  readAutoPlayPref,
  writeAutoPlayPref,
  type Playback,
  type Recording,
} from "@/lib/voice";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoPlay, setAutoPlay] = useState(true);
  const [micAvailable, setMicAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<Recording | null>(null);
  const playbackRef = useRef<Playback | null>(null);

  useEffect(() => {
    setMicAvailable(isRecordingSupported());
    setAutoPlay(readAutoPlayPref());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => () => playbackRef.current?.cancel(), []);

  function toggleAutoPlay() {
    const next = !autoPlay;
    setAutoPlay(next);
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

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
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
        setMessages((m) => m.slice(0, -1));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response body.");
        setMessages((m) => m.slice(0, -1));
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }

      if (autoPlay && acc.trim()) {
        const idx = next.length;
        playMessage(idx, acc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  async function startRecording() {
    if (!micAvailable || recording || transcribing || streaming) return;
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
        return;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text || "").trim();
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

  function clearAll() {
    playbackRef.current?.cancel();
    setSpeakingIdx(null);
    setMessages([]);
    setError(null);
  }

  const micBusy = recording || transcribing;
  const micLabel = recording ? "■" : transcribing ? "…" : "🎤";
  const micTitle = recording ? "Stop and send" : transcribing ? "Transcribing…" : "Start listening";

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
            disabled={streaming || messages.length === 0}
          >
            Clear
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Say hi! Tap the mic and ask about animals, sports, or anything you want to learn in English.
          </p>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const showReplay = m.role === "assistant" && m.content && !(streaming && isLast);
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

      {recording && (
        <p className="mt-2 text-sm text-rose-600">
          🎤 Listening… <span className="text-slate-700">tap the square when you finish</span>
        </p>
      )}
      {transcribing && (
        <p className="mt-2 text-sm text-slate-600">⏳ Understanding what you said…</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

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
            aria-label={micTitle}
            title={micTitle}
          >
            {micLabel}
          </button>
        )}
        <input
          className="input flex-1"
          placeholder={micBusy ? "Listening…" : "Type or tap the mic…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || micBusy}
        />
        <button type="submit" className="btn-primary" disabled={streaming || micBusy || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
