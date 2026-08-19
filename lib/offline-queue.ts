// Client-side session posting with a localStorage fallback.
// Rule from the plan: a session is never lost. Post it, retry once, then
// park it in localStorage and flush on the next load.

import type { ClientProfile, SessionResult } from "@/lib/types";
import type { Gained } from "@/lib/rewards";

export const QUEUE_KEY = "quest:queue";
const ENDPOINT = "/api/sessions/complete";
const MAX_QUEUE = 50;

export type PostSessionOk = { saved: true; gained: Gained; profile: ClientProfile };
export type PostSessionQueued = { saved: false };
export type PostSessionResult = PostSessionOk | PostSessionQueued;

function readQueue(): SessionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionResult[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: SessionResult[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // Storage full or blocked — nothing else we can do.
  }
}

export function queueSize(): number {
  return readQueue().length;
}

function enqueue(result: SessionResult): void {
  writeQueue([...readQueue(), result]);
}

async function send(result: SessionResult): Promise<PostSessionOk | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    const body = data as { gained?: Gained; profile?: ClientProfile };
    if (!body.gained || !body.profile) return null;
    return { saved: true, gained: body.gained, profile: body.profile };
  } catch {
    return null;
  }
}

/** POST one session. Retries once, then queues it and reports saved:false. */
export async function postSession(result: SessionResult): Promise<PostSessionResult> {
  const first = await send(result);
  if (first) return first;
  const second = await send(result);
  if (second) return second;
  enqueue(result);
  return { saved: false };
}

/** Drain whatever is parked. Anything that still fails stays queued. */
export async function flushQueue(): Promise<number> {
  const items = readQueue();
  if (items.length === 0) return 0;
  const left: SessionResult[] = [];
  let sent = 0;
  for (const item of items) {
    const ok = await send(item);
    if (ok) sent++;
    else left.push(item);
  }
  writeQueue(left);
  return sent;
}
