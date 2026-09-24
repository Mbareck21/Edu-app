// Client-side session posting with a localStorage fallback.
// Rule from the plan: a session is never lost. It goes into localStorage before
// the first send and leaves only once the server has answered for it, so the
// app can be swiped away mid-save; the next load flushes whatever is left.

import { learnerFromCookie } from "@/lib/learners";
import type { ClientProfile, SessionResult } from "@/lib/types";
import type { Gained } from "@/lib/rewards";

export const QUEUE_KEY = "quest:queue";
const ENDPOINT = "/api/sessions/complete";
const MAX_QUEUE = 50;
/**
 * How long "Saving your work…" may wait. On one bar of signal a POST can hang
 * for minutes, and the session is already on the phone, so stop and say so.
 */
const SEND_TIMEOUT_MS = 15_000;

export type PostSessionOk = { saved: true; gained: Gained; profile: ClientProfile };
/**
 * Not saved on the server. Kept on the phone for a later flush, except
 * `invalid`: the server rejected it outright and it was dropped. `signedOut`
 * is kept too, but cannot go until someone types the PIN again.
 */
export type PostSessionQueued = { saved: false; invalid?: boolean; signedOut?: boolean };
export type PostSessionResult = PostSessionOk | PostSessionQueued;

/**
 * "invalid" = the server said no and will say no again; retrying is pointless.
 * "signedOut" = the sign-in cookie is gone; the session is fine but has to wait.
 * "otherLearner" = the other child is signed in; it waits for its own child.
 */
type SendOutcome =
  | PostSessionOk
  | { saved: false; kind: "invalid" | "signedOut" | "otherLearner" | "transient" };

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

function unqueue(sessionId: string): void {
  writeQueue(readQueue().filter((i) => i.sessionId !== sessionId));
}

const TRANSIENT = { saved: false, kind: "transient" } as const;
const INVALID = { saved: false, kind: "invalid" } as const;
const SIGNED_OUT = { saved: false, kind: "signedOut" } as const;
const OTHER_LEARNER = { saved: false, kind: "otherLearner" } as const;

function newSessionId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function send(result: SessionResult, signal: AbortSignal): Promise<SendOutcome> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
      signal,
    });
    // 401 comes from the proxy, not from judging the session: the 30-day cookie
    // ran out or the secret changed. Counting it as a refusal threw away every
    // queued lesson the moment the app opened on the sign-in page.
    if (res.status === 401) return SIGNED_OUT;
    // Played by the other child: keep it until they sign in again.
    if (res.status === 409) return OTHER_LEARNER;
    // Any other 4xx is the server refusing this payload — it will refuse it again.
    if (res.status >= 400 && res.status < 500) return INVALID;
    if (!res.ok) return TRANSIENT;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return TRANSIENT;
    const body = data as { gained?: Gained; profile?: ClientProfile };
    if (!body.gained || !body.profile) return TRANSIENT;
    return { saved: true, gained: body.gained, profile: body.profile };
  } catch {
    // Offline, or the timeout fired.
    return TRANSIENT;
  }
}

/**
 * Ids postSession() is sending right now. A flush leaves these alone: the
 * second copy would come back "already applied", and if that answer reached
 * the runner it would show him +0 XP for the lesson.
 */
const sending = new Set<string>();

/**
 * POST one session. It is stored on the phone first, retried once on a
 * transient failure, and stays stored unless the server took it or rejected it.
 */
export async function postSession(result: SessionResult): Promise<PostSessionResult> {
  // The retry and the stored copy must carry the same id so the server can
  // tell a re-send from a second session.
  const sessionId = result.sessionId ?? newSessionId();
  const learner =
    result.learner ?? (typeof document === "undefined" ? null : learnerFromCookie(document.cookie));
  const payload: SessionResult = {
    ...result,
    sessionId,
    playedAt: result.playedAt ?? Date.now(),
    ...(learner ? { learner } : {}),
  };

  // Before the send, not after it fails: the runner has already cleared its
  // resume data, so a hung POST and a swipe used to lose the whole lesson.
  enqueue(payload);
  sending.add(sessionId);
  try {
    // One budget for the send and its retry: a hung network costs him 15
    // seconds of "Saving…", not 30.
    const signal = AbortSignal.timeout(SEND_TIMEOUT_MS);
    let outcome = await send(payload, signal);
    if (!outcome.saved && outcome.kind === "transient") outcome = await send(payload, signal);

    if (outcome.saved) {
      unqueue(sessionId);
      return outcome;
    }
    if (outcome.kind === "invalid") {
      unqueue(sessionId);
      return { saved: false, invalid: true };
    }
    return outcome.kind === "signedOut" ? { saved: false, signedOut: true } : { saved: false };
  } finally {
    sending.delete(sessionId);
  }
}

/**
 * What to tell him about a session that did not reach the server.
 *
 * "invalid" is not "offline": the server refused the payload and will refuse
 * it again, so it is not kept. Telling him it was saved on the phone would be
 * a lie, and the work would quietly vanish.
 */
export function saveNote(res: PostSessionResult): string | undefined {
  if (res.saved) return undefined;
  if (res.invalid) return "I could not save that one. Tell Dad.";
  if (res.signedOut) return "Saved on this phone. Ask Dad to type the PIN again.";
  return "No internet. Saved on this phone for later.";
}

function queueKey(item: SessionResult): string {
  return item.sessionId ?? JSON.stringify(item);
}

async function drain(): Promise<number> {
  const items = readQueue();
  if (items.length === 0) return 0;
  const left: SessionResult[] = [];
  let sent = 0;
  for (const [index, item] of items.entries()) {
    if (sending.has(queueKey(item))) {
      left.push(item);
      continue;
    }
    const outcome = await send(item, AbortSignal.timeout(SEND_TIMEOUT_MS));
    if (outcome.saved) sent++;
    else if (outcome.kind === "signedOut") {
      // The rest would get the same 401. Keep them all for after the PIN.
      left.push(...items.slice(index));
      break;
    } else if (outcome.kind === "transient" || outcome.kind === "otherLearner") left.push(item);
  }
  // Re-read before writing. While we were sending, another tab may have added a
  // session and postSession() may have cleared one: our snapshot must neither
  // erase the first nor bring the second back.
  const current = readQueue();
  const stillThere = new Set(current.map(queueKey));
  const mine = new Set(items.map(queueKey));
  const arrived = current.filter((i) => !mine.has(queueKey(i)));
  writeQueue([...left.filter((i) => stillThere.has(queueKey(i))), ...arrived]);
  return sent;
}

// ── Finished passages ────────────────────────────────────────────────────
// The passage's own close (stats, glossed words, archive) is a second request
// after the session. Dropped when offline, the passage stayed open and paid
// out again the next time. It waits here instead, and the flush sends it.

export const READING_QUEUE_KEY = "quest:reading-done";
const READING_ENDPOINT = "/api/reading/complete";

export type ReadingDone = {
  listId: string;
  /** The passage it closes; the server ignores it if another took its place. */
  generatedAt?: string;
  learner?: string;
  perQuestion: { type: string; firstTryCorrect: boolean; hintsUsed: number }[];
};

function readReadingQueue(): ReadingDone[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(READING_QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as ReadingDone[]) : [];
  } catch {
    return [];
  }
}

function writeReadingQueue(items: ReadingDone[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READING_QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // Storage full or blocked.
  }
}

/** True when the server took it, or refused it for good. */
async function sendReadingDone(item: ReadingDone): Promise<boolean> {
  try {
    const res = await fetch(READING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 409) return false;
    return res.ok || (res.status >= 400 && res.status < 500);
  } catch {
    return false;
  }
}

/** Close a finished passage now, or keep it on the phone for the next flush. */
export async function postReadingDone(item: ReadingDone): Promise<void> {
  const learner =
    item.learner ?? (typeof document === "undefined" ? null : learnerFromCookie(document.cookie));
  const payload = learner ? { ...item, learner } : item;
  if (await sendReadingDone(payload)) return;
  writeReadingQueue([...readReadingQueue(), payload]);
}

async function drainReadings(): Promise<void> {
  const items = readReadingQueue();
  if (items.length === 0) return;
  const left: ReadingDone[] = [];
  for (const item of items) {
    if (!(await sendReadingDone(item))) left.push(item);
  }
  const current = readReadingQueue();
  writeReadingQueue([...left, ...current.slice(items.length)]);
}

let flushing: Promise<number> | null = null;

/**
 * Drain whatever is parked. Transient failures stay queued, signed-out ones
 * wait for the PIN, rejects are dropped.
 *
 * One flush at a time: this runs on mount AND on every `online` event, and a
 * second PWA window runs its own. Two overlapping flushes would post the same
 * queued session twice.
 */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  // Sessions first: a passage is closed only after its session is in.
  const run = drain()
    .then(async (sent) => {
      await drainReadings();
      return sent;
    })
    .finally(() => {
      if (flushing === run) flushing = null;
    });
  flushing = run;
  return run;
}
