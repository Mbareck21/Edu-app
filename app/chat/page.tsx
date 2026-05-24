"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  startRecognition,
  speak,
  cancelSpeech,
  readAutoPlayPref,
  writeAutoPlayPref,
} from "@/lib/voice";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice state
  const [autoPlay, setAutoPlay] = useState(true);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<{ stop: () => void; promise: Promise<string | null> } | null>(null);
  const speechHandleRef = useRef<{ cancel: () => void } | null>(null);

  // One-time feature detection + preference load (client only).
  useEffect(() => {
    setSttSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    setAutoPlay(readAutoPlayPref());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, interim]);

  // Cancel any in-flight speech when leaving the page.
  useEffect(() => () => cancelSpeech(), []);

  function toggleAutoPlay() {
    const next = !autoPlay;
    setAutoPlay(next);
    writeAutoPlayPref(next);
    if (!next) cancelSpeech();
  }

  function playMessage(idx: number, text: string) {
    if (!ttsSupported) return;
    speechHandleRef.current?.cancel();
    setSpeakingIdx(idx);
    speechHandleRef.current = speak(text, {
      onDone: () => setSpeakingIdx((cur) => (cur === idx ? null : cur)),
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

      // Auto-play the finished reply.
      if (autoPlay && acc.trim() && ttsSupported) {
        const idx = next.length; // index of the assistant message we just appended
        playMessage(idx, acc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  async function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!sttSupported || streaming) return;

    // Stop any speech first so the mic doesn't pick it up.
    cancelSpeech();
    setSpeakingIdx(null);

    setInterim("");
    setListening(true);
    const handle = startRecognition({
      lang: "en-US",
      onInterim: (t) => setInterim(t),
    });
    recognitionRef.current = handle;

    const final = await handle.promise;
    recognitionRef.current = null;
    setListening(false);
    setInterim("");

    if (final && final.trim()) {
      setInput(final.trim());
      // small visual beat so he sees the text before it sends
      setTimeout(() => send(final.trim()), 150);
    }
  }

  function clearAll() {
    cancelSpeech();
    setSpeakingIdx(null);
    setMessages([]);
    setError(null);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col px-4 py-3">
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Home</Link>
        <h1 className="text-lg font-semibold">AI Buddy</h1>
        <div className="flex items-center gap-3">
          {ttsSupported && (
            <button
              type="button"
              onClick={toggleAutoPlay}
              className="text-base"
              title={autoPlay ? "Mute auto-play" : "Unmute auto-play"}
              aria-label={autoPlay ? "Mute auto-play" : "Unmute auto-play"}
            >
              {autoPlay ? "🔊" : "🔇"}
            </button>
          )}
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
          const showReplay = m.role === "assistant" && ttsSupported && m.content && !(streaming && isLast);
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

      {listening && (
        <p className="mt-2 text-sm text-rose-600">
          🎤 Listening… <span className="text-slate-700">{interim || "say something"}</span>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {sttSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={streaming}
            className={
              "inline-flex items-center justify-center rounded-md px-3 text-lg transition-colors disabled:opacity-50 " +
              (listening
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-100")
            }
            aria-label={listening ? "Stop listening" : "Start listening"}
            title={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? "■" : "🎤"}
          </button>
        )}
        <input
          className="input flex-1"
          placeholder={listening ? "Speaking…" : "Type or tap the mic…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || listening}
        />
        <button type="submit" className="btn-primary" disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
