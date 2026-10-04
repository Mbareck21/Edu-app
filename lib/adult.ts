// The grown-ups lock. The children use the app on their own, so the pages and
// actions that change word lists ask for a separate PIN (ADULT_PIN) that only
// a parent knows. Unlocking sets a short-lived signed cookie; with no
// ADULT_PIN set, nothing is locked (the app worked that way before).
//
// Edge-safe (only jose): proxy.ts imports it.

import { SignJWT, jwtVerify } from "jose";

export const ADULT_COOKIE = "eduapp_adult";
/** How long an unlock lasts. Long enough to edit a list, short enough to forget. */
export const ADULT_MINUTES = 30;

function secret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 16 ? new TextEncoder().encode(s) : null;
}

export function adultLockOn(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ADULT_PIN);
}

export async function signAdultToken(): Promise<string> {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET must be set to a long random string");
  return new SignJWT({ adult: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADULT_MINUTES}m`)
    .sign(key);
}

export async function isAdultToken(token: string | undefined): Promise<boolean> {
  const key = secret();
  if (!token || !key) return false;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload.adult === true;
  } catch {
    return false;
  }
}

/** Pages only a grown-up opens: the list manager, the list editors, the competition report. */
export function isAdultPage(pathname: string): boolean {
  if (pathname === "/me/lists" || pathname.startsWith("/me/lists/")) return true;
  if (pathname === "/me/report" || pathname.startsWith("/me/report/")) return true;
  // /lists/<id> only redirects to /me/lists/<id> now; kept locked for old
  // links. /lists/<id>/flashcards redirects to the unit's path and stays open.
  return /^\/lists\/[^/]+\/?$/.test(pathname);
}

/**
 * API calls that change the lists themselves, or add words to Words to fix:
 * a child adding easy words there chose what his drills deal (2026-10-04
 * audit). Filling meanings stays open.
 */
export function isAdultApi(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if ((pathname === "/api/lists" || pathname === "/api/lists/seed") && m === "POST") return true;
  if (pathname === "/api/stuck" && m === "POST") return true;
  return /^\/api\/lists\/[^/]+\/?$/.test(pathname) && (m === "PATCH" || m === "DELETE");
}
