/**
 * Server-signed proof that a child was handed what he played (lib/assigned.ts).
 *
 * The page lock alone was not enough (2026-10-04 audit): a back swipe or an
 * offline replay showed the phone's copy of a page past it, and the session
 * route paid whatever came. So:
 *
 * - A session ticket is minted with each locked page and becomes the
 *   session's id. A replayed copy carries the same ticket, which the route has
 *   already used (reserveSession), so it pays nothing twice; a session with no
 *   valid ticket from a child pays no XP.
 * - An assignment mark goes on the suggested drill's link. The drill page
 *   trusts the link it issued instead of working the suggestion out again with
 *   a later clock, which moved it (a word fell due) and turned Go away.
 *
 * Both are HMACs with AUTH_SECRET over the child, the time and a nonce or the
 * drill. Server-only (node:crypto).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { drillKey } from "@/lib/assigned";

function mac(parts: readonly string[]): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set");
  return createHmac("sha256", secret).update(parts.join("|")).digest("base64url").slice(0, 22);
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A one-use session id for a page handed to `learner`: t.<issued>.<nonce>.<mac>. */
export function mintTicket(learner: string, now: number = Date.now()): string {
  const issued = now.toString(36);
  const nonce = randomBytes(6).toString("base64url");
  return `t.${issued}.${nonce}.${mac(["ticket", learner, issued, nonce])}`;
}

/** When the page behind this ticket was served to `learner`, or null when it is not one. */
export function readTicket(id: string, learner: string): { issuedAt: number } | null {
  const m = /^t\.([0-9a-z]{1,12})\.([A-Za-z0-9_-]{8})\.([A-Za-z0-9_-]{22})$/.exec(id);
  if (!m || !same(mac(["ticket", learner, m[1], m[2]]), m[3])) return null;
  return { issuedAt: parseInt(m[1], 36) };
}

/** The suggested drill's link with its assignment mark (?a=<issued>.<mac>). */
export function signDrill(href: string, learner: string, now: number = Date.now()): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.delete("a");
  const issued = now.toString(36);
  params.set("a", `${issued}.${mac(["drill", learner, path, drillKey(params), issued])}`);
  return `${path}?${params.toString()}`;
}

/** When this drill link was handed to `learner`, or null when its mark does not fit it. */
export function readDrillMark(path: string, params: URLSearchParams, learner: string): { issuedAt: number } | null {
  const m = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]{22})$/.exec(params.get("a") ?? "");
  if (!m || !same(mac(["drill", learner, path, drillKey(params), m[1]]), m[2])) return null;
  return { issuedAt: parseInt(m[1], 36) };
}
