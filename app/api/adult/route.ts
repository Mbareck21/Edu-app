import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ADULT_COOKIE, ADULT_MINUTES, signAdultToken } from "@/lib/adult";
import { getClientIp } from "@/lib/groq";

const Body = z.object({ pin: z.string().min(1).max(20) });

// Wrong-PIN throttle, as on /api/auth: a child with time on their hands can
// try every four-digit PIN, so failures are counted per address.
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 8;
const FAILURES = new Map<string, number[]>();

/** Unlock the grown-ups pages for ADULT_MINUTES. */
export async function POST(req: Request) {
  const expected = process.env.ADULT_PIN;
  if (!expected) return NextResponse.json({ ok: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const ip = getClientIp(req);
  const now = Date.now();
  const failures = (FAILURES.get(ip) ?? []).filter((t) => t > now - FAIL_WINDOW_MS);
  if (failures.length >= FAIL_LIMIT) {
    FAILURES.set(ip, failures);
    return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  if (parsed.data.pin !== expected) {
    FAILURES.set(ip, [...failures, now]);
    return NextResponse.json({ error: "wrong pin" }, { status: 403 });
  }
  FAILURES.delete(ip);

  (await cookies()).set(ADULT_COOKIE, await signAdultToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADULT_MINUTES * 60,
  });
  return NextResponse.json({ ok: true });
}

/** Lock again now, instead of waiting for the unlock to run out. */
export async function DELETE() {
  (await cookies()).delete(ADULT_COOKIE);
  return NextResponse.json({ ok: true });
}
