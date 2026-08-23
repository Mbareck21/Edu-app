import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionCookie, clearSessionCookie } from "@/lib/auth";
import { getClientIp } from "@/lib/groq";

const Body = z.object({ pin: z.string().min(1).max(20) });

/**
 * Wrong-PIN throttle.
 *
 * The PIN is four digits, so all ten thousand of them can be tried in under a
 * minute — and the cookie it hands out opens every route, including the one
 * that deletes a word list. Only FAILURES are counted, so getting it right
 * never costs anything. In-memory, so it resets when the instance does; that
 * still turns "a minute" into days.
 */
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 8;
const FAILURES = new Map<string, number[]>();

function recentFailures(ip: string, now: number): number[] {
  return (FAILURES.get(ip) ?? []).filter((t) => t > now - FAIL_WINDOW_MS);
}

export async function POST(req: Request) {
  const expected = process.env.PARENT_PIN;
  if (!expected) {
    return NextResponse.json({ error: "PARENT_PIN not configured" }, { status: 500 });
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
  const ip = getClientIp(req);
  const now = Date.now();
  const failures = recentFailures(ip, now);
  if (failures.length >= FAIL_LIMIT) {
    FAILURES.set(ip, failures);
    const retryAfterSec = Math.ceil((failures[0] + FAIL_WINDOW_MS - now) / 1000);
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  if (parsed.data.pin !== expected) {
    FAILURES.set(ip, [...failures, now]);
    return NextResponse.json({ error: "wrong pin" }, { status: 401 });
  }
  FAILURES.delete(ip);
  await issueSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
