import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "eduapp_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random string");
  }
  return new TextEncoder().encode(s);
}

export async function issueSessionCookie(): Promise<void> {
  const token = await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
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

export const SESSION_COOKIE_NAME = COOKIE_NAME;
