import { NextResponse } from "next/server";
import { z } from "zod";
import { groq, CHAT_MODEL, CHAT_SYSTEM_PROMPT, rateLimit, getClientIp } from "@/lib/groq";

export const runtime = "nodejs";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
const Body = z.object({
  messages: z.array(Message).min(1).max(40),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const stream = await groq().chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...parsed.data.messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 200,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream error";
          controller.enqueue(encoder.encode(`\n[error: ${msg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Groq error: ${msg}` }, { status: 502 });
  }
}
