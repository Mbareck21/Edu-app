// Server-signed proof of what a child was handed (lib/ticket.ts), and the
// rules that use it when a session is paid (lib/assigned.ts).

import assert from "node:assert/strict";
import test from "node:test";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret";

import {
  DRILL_MARK_MS,
  TICKETS_FROM,
  UNPAID_DONE_TODAY,
  UNPAID_DRILL_USED,
  UNPAID_NOT_HANDED,
  drillKey,
  drillMarkValid,
  unpaidReason,
} from "@/lib/assigned";
import { mathHref } from "@/components/drill/options";
import { XP, applySession, emptyProfile } from "@/lib/rewards";
import { mintTicket, readDrillMark, readTicket, signDrill } from "@/lib/ticket";

test("ticket: read back for the child it was minted for, and nobody else", () => {
  const t = mintTicket("nour", 1_790_000_000_000);
  assert.ok(t.length >= 8 && t.length <= 64, "fits the session id");
  assert.deepEqual(readTicket(t, "nour"), { issuedAt: 1_790_000_000_000 });
  assert.equal(readTicket(t, "wissam"), null, "another child's ticket");
  assert.equal(readTicket(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), "nour"), null, "tampered");
  assert.equal(readTicket("abcdefgh-1234", "nour"), null, "a plain random id");
  assert.notEqual(mintTicket("nour", 1), mintTicket("nour", 1), "each page its own");
});

test("drill mark: fits only the drill it was put on", () => {
  const href = mathHref({ skill: "fractions", level: "auto", count: 10, mode: "relaxed", seed: 7 });
  const signed = signDrill(href, "nour", 1_790_000_000_000);
  const [path, query] = signed.split("?");
  const params = new URLSearchParams(query);
  assert.deepEqual(readDrillMark(path, params, "nour"), { issuedAt: 1_790_000_000_000 });
  assert.equal(readDrillMark(path, params, "wissam"), null);
  // The seed may change (dealt again); the drill may not.
  params.set("seed", "999");
  assert.ok(readDrillMark(path, params, "nour"));
  params.set("level", "1");
  assert.equal(readDrillMark(path, params, "nour"), null, "an easier level is another drill");
  assert.equal(drillKey(new URLSearchParams("a=x&seed=1&mode=t60")), "mode=t60");
});

test("drill mark: good until a drill is played, and only for a while", () => {
  const issued = Date.parse("2026-10-04T15:00:00.000Z");
  const before = [{ at: "2026-10-04T14:00:00.000Z", ref: "drill:math:fractions:relaxed" }];
  assert.ok(drillMarkValid(issued, before, issued + 60_000));
  const after = [...before, { at: "2026-10-04T15:05:00.000Z", ref: "drill:vocab:spell" }];
  assert.equal(drillMarkValid(issued, after, issued + 10 * 60_000), false, "played: used");
  // A quest beat in between does not use it.
  assert.ok(drillMarkValid(issued, [...before, { at: "2026-10-04T15:05:00.000Z", ref: "quest:review" }], issued + 600_000));
  assert.equal(drillMarkValid(issued, before, issued + DRILL_MARK_MS + 1), false, "too old");
});

test("pay: a child is paid only for what he was handed, a beat once a day, a drill link once", () => {
  const day = "2026-10-06";
  const played = Date.parse("2026-10-06T16:00:00.000Z");
  const issued = Date.parse("2026-10-06T15:58:00.000Z");
  const done = [{ at: "2026-10-06T15:00:00.000Z", kind: "vocab" as const, ref: "quest:review" }];
  const review = { kind: "vocab" as const, ref: "quest:review" };
  const drill = { kind: "math" as const, ref: "drill:math:fractions:relaxed" };
  const base = { locked: true, ticketIssuedAt: issued, playedAt: played, day };
  assert.equal(unpaidReason({ ...base, locked: false, ticketIssuedAt: null, activity: done, session: review }), undefined, "a grown-up");
  assert.equal(unpaidReason({ ...base, ticketIssuedAt: null, activity: [], session: drill }), UNPAID_NOT_HANDED);
  assert.equal(unpaidReason({ ...base, activity: done, session: review }), UNPAID_DONE_TODAY);
  assert.equal(unpaidReason({ ...base, activity: [], session: review }), undefined);
  assert.equal(unpaidReason({ ...base, activity: done, session: drill }), undefined, "an earlier quest beat does not use a drill link");
  // Tomorrow the beat is new again.
  assert.equal(unpaidReason({ ...base, activity: done, session: review, day: "2026-10-07" }), undefined);
  // The same drill link in a second window: one drill since the page was served.
  const since = [{ at: "2026-10-06T15:59:00.000Z", kind: "math" as const, ref: "drill:vocab:spell" }];
  assert.equal(unpaidReason({ ...base, activity: since, session: drill }), UNPAID_DRILL_USED);
  const before = [{ at: "2026-10-06T15:50:00.000Z", kind: "math" as const, ref: "drill:vocab:spell" }];
  assert.equal(unpaidReason({ ...base, activity: before, session: drill }), undefined, "the drill before it");
  // Played before the tickets went live: queued on a phone, it still pays.
  assert.equal(
    unpaidReason({ ...base, ticketIssuedAt: null, playedAt: TICKETS_FROM - 1, activity: [], session: drill }),
    undefined
  );
});

test("pay: an unpaid session earns no work XP, says why, and still counts", () => {
  const result = { kind: "vocab" as const, ref: "quest:review", answered: 10, correct: 10, fastCount: 0, ms: 180_000, perfect: true };
  const now = { at: new Date("2026-10-04T15:00:00.000Z"), today: "2026-10-04" };
  const out = applySession(emptyProfile(), result, now, { unpaid: UNPAID_DONE_TODAY });
  assert.equal(out.gained.xp, XP.streakDay, "only the day");
  assert.equal(out.gained.tip, UNPAID_DONE_TODAY);
  assert.equal(out.profile.activity.length, 1);
  const known = applySession(emptyProfile(), { ...result, wordsKnownUp: 1 }, now, { unpaid: UNPAID_NOT_HANDED });
  assert.equal(known.gained.xp, XP.streakDay + XP.wordKnown, "learning still pays");
});
