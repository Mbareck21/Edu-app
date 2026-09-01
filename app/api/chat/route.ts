import { NextResponse } from "next/server";
import { z } from "zod";
import { CHAT_MODEL, CHAT_SYSTEM_PROMPT, friendlyAiError, getClientIp, groq, rateLimit } from "@/lib/groq";

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
      max_tokens: 1000,
      reasoning_effort: "low",
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch {
          // Whatever broke, this text is read aloud to a nine-year-old and is
          // sent back as history on his next turn. It has to be a sentence, not
          // an internal error message.
          controller.enqueue(
            encoder.encode("\n\nSorry - I lost my thought there. Ask me again?")
          );
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
    const msg = friendlyAiError(err, "I could not answer that. Try again.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
