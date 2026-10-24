import { NextResponse } from "next/server";

import { kidLocked } from "@/lib/assigned-data";
import { todayKey } from "@/lib/day";
import { isLearnerId } from "@/lib/learners";
import { focusFor, parseReport } from "@/lib/school-report";
import { saveReport } from "@/lib/school-report-store";

export const runtime = "nodejs";

/**
 * Save a child's school report card (the whole card for this school year).
 * Grown-ups only: proxy.ts checks isAdultApi, and this checks again so a
 * pattern list that drifts cannot open it. The child is named in the body,
 * not taken from the sign-in, so one grown-up page edits either child.
 */
export async function PUT(req: Request) {
  if (await kidLocked()) {
    return NextResponse.json({ error: "Grown-ups only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { learner?: unknown; report?: unknown } | null;
  if (!body || !isLearnerId(body.learner)) {
    return NextResponse.json({ error: "Which child is this card for?" }, { status: 400 });
  }
  const parsed = parseReport(body.report);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await saveReport(body.learner, parsed.report);
  return NextResponse.json({ ok: true, reasons: focusFor(parsed.report, todayKey()).reasons });
}
