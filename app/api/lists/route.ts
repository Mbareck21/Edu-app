import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().min(1).max(120).trim(),
});

export async function GET() {
  await connectDB();
  const lists = await WordList.find().sort({ updatedAt: -1 }).lean();
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
  await connectDB();
  const doc = await WordList.create({ name: parsed.data.name, words: [], hiddenMessage: "" });
  return NextResponse.json(toClient(doc.toObject()), { status: 201 });
}
