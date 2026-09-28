import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { issueSessionCookie, clearSessionCookie } from "@/lib/auth";
import { getClientIp } from "@/lib/groq";
import { learnerForPin } from "@/lib/learners";
import {
  DEVICE_COOKIE,
  clearPinMisses,
  deviceIdFrom,
  pinWait,
  recordPinMiss,
  type PinFailures,
} from "@/lib/pin-throttle";

const Body = z.object({ pin: z.string().min(1).max(20) });

/**
 * Wrong-PIN throttle, per phone and per home (lib/pin-throttle.ts). The cookie
 * this PIN hands out opens every route, including the one that deletes a word
 * list, so the four digits must not be guessable in a minute.
 */
const FAILURES: PinFailures = new Map();

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
  const jar = await cookies();
  const device = deviceIdFrom(jar.get(DEVICE_COOKIE)?.value);
  if (device.isNew) {
    jar.set(DEVICE_COOKIE, device.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  const retryAfterSec = pinWait(FAILURES, device.id, ip, now);
  if (retryAfterSec > 0) {
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  const learner = learnerForPin(parsed.data.pin);
  if (!learner) {
    recordPinMiss(FAILURES, device.id, ip, now);
    return NextResponse.json({ error: "wrong pin" }, { status: 401 });
  }
  clearPinMisses(FAILURES, device.id);
  await issueSessionCookie(learner);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
