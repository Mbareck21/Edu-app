import { EdgeTTS } from "@andresaya/edge-tts";
import { NextResponse } from "next/server";
import { AI_ARABIC_VOICE, AI_ENGLISH_VOICE, friendlyAiError } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

// Same Arabic Unicode range used for client-side chunking before.
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** A lone letter of the other language is not worth a voice call of its own. */
const MIN_RUN_LETTERS = 2;
/**
 * Voice calls per request. Each chunk is one call to the voice service, made
 * one after another, so text that switched language on every letter made
 * 2000 of them.
 */
const MAX_CHUNKS = 20;

type Chunk = { voice: string; text: string };

const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/**
 * Fold one-letter runs into their neighbour, then everything past the cap
 * into the last chunk: from there one voice reads the rest, mixed or not.
 */
function mergeRuns(runs: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...run });
    } else if (prev.voice === run.voice || letterCount(run.text) < MIN_RUN_LETTERS) {
      prev.text += run.text;
    } else if (letterCount(prev.text) < MIN_RUN_LETTERS) {
      out[out.length - 1] = { voice: run.voice, text: prev.text + run.text };
    } else {
      out.push({ ...run });
    }
  }
  if (out.length > MAX_CHUNKS) {
    const tail = out.splice(MAX_CHUNKS - 1);
    out.push({ voice: tail[0].voice, text: tail.map((c) => c.text).join("") });
  }
  return out;
}

// Split text into runs of one language each so each TTS call uses the
// matching neural voice. Whitespace and punctuation attach to the surrounding
// chunk to avoid micro-gaps between adjacent same-language words.
function chunkByLanguage(text: string): Chunk[] {
  if (!text.trim()) return [];
  const out: Chunk[] = [];
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
  return mergeRuns(out);
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
    const msg = friendlyAiError(err, "The sound would not play. Tap it again.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
