import { NextResponse } from "next/server";
import { groq, STT_MODEL, rateLimit, getClientIp } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio blob required" }, { status: 400 });
  }
  if (audio.size === 0 || audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "bad audio size" }, { status: 400 });
  }

  // Optional language hint from the client; Whisper auto-detects otherwise.
  const lang = (form.get("language") as string) || undefined;

  try {
    // FormData.get() returns File for blob entries — Groq SDK accepts it directly.
    const result = await groq().audio.transcriptions.create({
      file: audio as File,
      model: STT_MODEL,
      language: lang,
      response_format: "verbose_json",
      temperature: 0,
    });

    return NextResponse.json({
      text: (result.text ?? "").trim(),
      language: (result as unknown as { language?: string }).language ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "transcription failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
