import { NextResponse } from "next/server";
import { z } from "zod";

import { toClientProfile } from "@/lib/models/Profile";
import { getProfile, saveProfile } from "@/lib/profile";
import { MAX_DAILY_GOAL, MIN_DAILY_GOAL } from "@/lib/rewards";

export const runtime = "nodejs";

// The mute flag is a device setting — it lives in localStorage, not here.
const PatchBody = z.object({
  name: z.string().min(1).max(24).trim().optional(),
  dailyGoal: z.number().int().min(MIN_DAILY_GOAL).max(MAX_DAILY_GOAL).optional(),
});

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json(toClientProfile(profile));
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const profile = await getProfile();
  const saved = await saveProfile({
    ...profile,
    name: parsed.data.name ?? profile.name,
    dailyGoal: parsed.data.dailyGoal ?? profile.dailyGoal,
  });
  return NextResponse.json(toClientProfile(saved));
}
