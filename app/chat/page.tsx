"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setStreaming(true);
    // Append an empty assistant message to stream into.
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
        // Drop the empty assistant placeholder.
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
      // eslint-disable-next-line no-constant-condition
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col px-4 py-3">
      <header className="mb-3 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-slate-600 hover:underline">← Home</Link>
        <h1 className="text-lg font-semibold">AI Buddy</h1>
        <button
          type="button"
          className="text-sm text-slate-600 hover:underline"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          disabled={streaming || messages.length === 0}
        >
          Clear
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Say hi! Ask about animals, sports, or anything you want to learn in English.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-base " +
                (m.role === "user"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-900")
              }
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button type="submit" className="btn-primary" disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
