import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { LEARNER_COOKIE, isLearnerId, type LearnerId } from "@/lib/learners";

const COOKIE_NAME = "eduapp_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random string");
  }
  return new TextEncoder().encode(s);
}

export async function issueSessionCookie(learner: LearnerId): Promise<void> {
  const token = await new SignJWT({ ok: true, learner })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  const options = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  jar.set(COOKIE_NAME, token, { ...options, httpOnly: true });
  jar.set(LEARNER_COOKIE, learner, options);
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  jar.delete(LEARNER_COOKIE);
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret(), { algorithms: [ALG] });
    return true;
  } catch {
    return false;
  }
}

export async function isSignedIn(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE_NAME)?.value;
  return verifySessionToken(c);
}

/**
 * Who is signed in. A cookie from before there were two children carries no
 * name, and only Nour had one then.
 */
export async function currentLearner(): Promise<LearnerId> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new Error("not signed in");
  const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
  return isLearnerId(payload.learner) ? payload.learner : "nour";
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
