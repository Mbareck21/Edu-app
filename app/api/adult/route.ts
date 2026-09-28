import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { ADULT_COOKIE, ADULT_MINUTES, signAdultToken } from "@/lib/adult";
import { getClientIp } from "@/lib/groq";
import {
  DEVICE_COOKIE,
  clearPinMisses,
  deviceIdFrom,
  pinWait,
  recordPinMiss,
  type PinFailures,
} from "@/lib/pin-throttle";

const Body = z.object({ pin: z.string().min(1).max(20) });

// Wrong-PIN throttle, as on /api/auth: a child with time on their hands can
// try every four-digit PIN. Per phone as well as per home, so a child missing
// on purpose on his own phone no longer locks the parent out on theirs.
const FAILURES: PinFailures = new Map();

/** Unlock the grown-ups pages for ADULT_MINUTES. */
export async function POST(req: Request) {
  const expected = process.env.ADULT_PIN;
  if (!expected) return NextResponse.json({ ok: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

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
  if (parsed.data.pin !== expected) {
    recordPinMiss(FAILURES, device.id, ip, now);
    return NextResponse.json({ error: "wrong pin" }, { status: 403 });
  }
  clearPinMisses(FAILURES, device.id);

  jar.set(ADULT_COOKIE, await signAdultToken(), {
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
