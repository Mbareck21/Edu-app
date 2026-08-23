// Client-side session posting with a localStorage fallback.
// Rule from the plan: a session is never lost. Post it, retry once, then
// park it in localStorage and flush on the next load.

import type { ClientProfile, SessionResult } from "@/lib/types";
import type { Gained } from "@/lib/rewards";

export const QUEUE_KEY = "quest:queue";
const ENDPOINT = "/api/sessions/complete";
const MAX_QUEUE = 50;

export type PostSessionOk = { saved: true; gained: Gained; profile: ClientProfile };
/** Queued for a later flush, or dropped because the server rejected it outright. */
export type PostSessionQueued = { saved: false; invalid?: boolean };
export type PostSessionResult = PostSessionOk | PostSessionQueued;

/** "invalid" = the server said no and will say no again; retrying is pointless. */
type SendOutcome = PostSessionOk | { saved: false; kind: "invalid" | "transient" };

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

const TRANSIENT = { saved: false, kind: "transient" } as const;
const INVALID = { saved: false, kind: "invalid" } as const;

function newSessionId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function send(result: SessionResult): Promise<SendOutcome> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    // 4xx is the server refusing this payload — it will refuse it again.
    if (res.status >= 400 && res.status < 500) return INVALID;
    if (!res.ok) return TRANSIENT;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return TRANSIENT;
    const body = data as { gained?: Gained; profile?: ClientProfile };
    if (!body.gained || !body.profile) return TRANSIENT;
    return { saved: true, gained: body.gained, profile: body.profile };
  } catch {
    return TRANSIENT;
  }
}

/**
 * POST one session. Retries once on a transient failure, then queues it.
 * A payload the server rejected is dropped, not retried and not queued.
 */
export async function postSession(result: SessionResult): Promise<PostSessionResult> {
  // The retry and the queued copy must carry the same id so the server can
  // tell a re-send from a second session.
  const payload: SessionResult = result.sessionId
    ? result
    : { ...result, sessionId: newSessionId() };

  const first = await send(payload);
  if (first.saved) return first;
  if (first.kind === "invalid") return { saved: false, invalid: true };

  const second = await send(payload);
  if (second.saved) return second;
  if (second.kind === "invalid") return { saved: false, invalid: true };

  enqueue(payload);
  return { saved: false };
}

/**
 * What to tell him about a session that did not reach the server.
 *
 * "invalid" is not "offline": the server refused the payload and will refuse
 * it again, so it is neither retried nor queued. Telling him it was saved on
 * the phone would be a lie, and the work would quietly vanish.
 */
export function saveNote(res: PostSessionResult): string | undefined {
  if (res.saved) return undefined;
  return res.invalid
    ? "I could not save that one. Tell Dad — he may need to sign in again."
    : "No internet. Saved on this phone for later.";
}

function queueKey(item: SessionResult): string {
  return item.sessionId ?? JSON.stringify(item);
}

async function drain(): Promise<number> {
  const items = readQueue();
  if (items.length === 0) return 0;
  const left: SessionResult[] = [];
  let sent = 0;
  for (const item of items) {
    const outcome = await send(item);
    if (outcome.saved) sent++;
    else if (outcome.kind === "transient") left.push(item);
  }
  // Re-read: a session finished in another tab while we were sending would be
  // erased by writing our own snapshot back over it.
  const mine = new Set(items.map(queueKey));
  const arrived = readQueue().filter((i) => !mine.has(queueKey(i)));
  writeQueue([...left, ...arrived]);
  return sent;
}

let flushing: Promise<number> | null = null;

/**
 * Drain whatever is parked. Transient failures stay queued; rejects are dropped.
 *
 * One flush at a time: this runs on mount AND on every `online` event, and a
 * second PWA window runs its own. Two overlapping flushes would post the same
 * queued session twice.
 */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  const run = drain().finally(() => {
    if (flushing === run) flushing = null;
  });
  flushing = run;
  return run;
}
