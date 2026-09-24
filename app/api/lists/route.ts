import { NextResponse } from "next/server";
import { z } from "zod";
import { currentLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncList } from "@/lib/shared-lists";
import { toClient } from "@/lib/models/WordList";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  const { WordList } = await db();
  const lists = await WordList.find({ kind: { $ne: "pool" } }).sort({ updatedAt: -1 }).lean();
  return NextResponse.json(lists.map(toClient));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const learner = await currentLearner();
  const { WordList } = await db();
  const doc = await WordList.create({
    name: parsed.data.name,
    words: [],
    hiddenMessage: "",
    addedBy: learner,
  });
  await syncList(learner, String(doc._id));
  return NextResponse.json(toClient(doc.toObject()), { status: 201 });
}
