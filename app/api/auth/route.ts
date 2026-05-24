import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionCookie, clearSessionCookie } from "@/lib/auth";

const Body = z.object({ pin: z.string().min(1).max(20) });

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
  if (parsed.data.pin !== expected) {
    return NextResponse.json({ error: "wrong pin" }, { status: 401 });
  }
  await issueSessionCookie();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
