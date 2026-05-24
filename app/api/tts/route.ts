import { EdgeTTS } from "@andresaya/edge-tts";
import { NextResponse } from "next/server";
import { AI_ENGLISH_VOICE, AI_ARABIC_VOICE } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

// Same Arabic Unicode range used for client-side chunking before.
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

// Split text into runs of one language each so each TTS call uses the
// matching neural voice. Whitespace and punctuation attach to the surrounding
// chunk to avoid micro-gaps between adjacent same-language words.
function chunkByLanguage(text: string): Array<{ voice: string; text: string }> {
  if (!text.trim()) return [];
  const out: Array<{ voice: string; text: string }> = [];
  let buf = "";
  let bufVoice: string | null = null;
  const isLetter = (ch: string) => /\p{L}/u.test(ch);

  for (const ch of text) {
    let charVoice: string | null = null;
    if (isLetter(ch)) {
      charVoice = ARABIC_RE.test(ch) ? AI_ARABIC_VOICE : AI_ENGLISH_VOICE;
    }
    if (charVoice && bufVoice && charVoice !== bufVoice) {
      if (buf.trim()) out.push({ voice: bufVoice, text: buf });
      buf = ch;
      bufVoice = charVoice;
    } else {
      if (charVoice && !bufVoice) bufVoice = charVoice;
      buf += ch;
    }
  }
  if (buf.trim()) out.push({ voice: bufVoice ?? AI_ENGLISH_VOICE, text: buf });
  return out;
}

async function synthesizeChunk(text: string, voice: string): Promise<Buffer> {
  const tts = new EdgeTTS();
  // Slightly slower for a 9-year-old — Edge TTS rate is a signed percentage.
  await tts.synthesize(text, voice, { rate: "-5%" });
  return tts.toBuffer();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") || "").trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  // Hard cap to keep functions fast and stop runaway costs.
  if (text.length > 2000) {
    return NextResponse.json({ error: "text too long" }, { status: 400 });
  }

  try {
    const chunks = chunkByLanguage(text);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "no speakable text" }, { status: 400 });
    }
    const buffers: Buffer[] = [];
    for (const c of chunks) {
      buffers.push(await synthesizeChunk(c.text, c.voice));
    }
    const audio = Buffer.concat(buffers);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        // Cache so replays are instant. Text is in the URL → cache key is stable.
        "Cache-Control": "public, max-age=3600, immutable",
        "Content-Length": String(audio.length),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "tts failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
