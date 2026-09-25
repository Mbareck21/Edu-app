import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { ADULT_COOKIE, adultLockOn, isAdultApi, isAdultPage, isAdultToken } from "@/lib/adult";
import { LEARNER_COOKIE, isLearnerId } from "@/lib/learners";

const COOKIE_NAME = "eduapp_session";
const SESSION_DAYS = 30;
/**
 * A sign-in older than this is renewed on the next visit, so a child who
 * plays every few days is never signed out. Only one who stays away for the
 * whole 30 days has to type the PIN again.
 */
const RENEW_AFTER_DAYS = 7;
// The PWA shell has to load before sign-in: the browser fetches the manifest
// and the service worker without the session cookie, and /offline is what the
// worker shows when the network is gone.
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
]);
const PUBLIC_PREFIXES = ["/icons/"];
// The install dialog fetches the manifest's screenshots with no session, so a
// redirect to /login would leave it blank. Named one by one rather than
// opening the whole folder: these two are work screens with no name and no
// progress on them, but a capture dropped in there later — a screenshot of
// his progress page, a bug report — must not become public by inheriting a
// permission granted for something else. Add a file here when you add it to
// the manifest, and look at it first.
const PUBLIC_FILES = new Set(["/screenshots/lesson.png", "/screenshots/math.png"]);

function key(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  return s ? new TextEncoder().encode(s) : null;
}

async function verified(token: string | undefined): Promise<JWTPayload | null> {
  const k = key();
  if (!token || !k) return null;
  try {
    return (await jwtVerify(token, k, { algorithms: ["HS256"] })).payload;
  } catch {
    return null;
  }
}

/**
 * Re-sign an older sign-in for another 30 days, and set the readable label
 * cookie if a sign-in from before it existed is missing one.
 */
async function renewed(req: NextRequest, payload: JWTPayload, res: NextResponse): Promise<NextResponse> {
  const k = key();
  if (!k) return res;
  const learner = isLearnerId(payload.learner) ? payload.learner : "nour";
  const options = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  };
  const ageDays = (Date.now() / 1000 - (payload.iat ?? 0)) / 86_400;
  if (ageDays > RENEW_AFTER_DAYS) {
    const token = await new SignJWT({ ok: true, learner })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DAYS}d`)
      .sign(k);
    res.cookies.set(COOKIE_NAME, token, { ...options, httpOnly: true });
    res.cookies.set(LEARNER_COOKIE, learner, options);
  } else if (!req.cookies.get(LEARNER_COOKIE)) {
    res.cookies.set(LEARNER_COOKIE, learner, options);
  }
  return res;
}

/** The grown-ups lock (lib/adult.ts): null when this request may go on. */
async function adultBlock(req: NextRequest): Promise<NextResponse | null> {
  if (!adultLockOn()) return null;
  const { pathname } = req.nextUrl;
  const page = isAdultPage(pathname);
  const api = isAdultApi(req.method, pathname);
  if (!page && !api) return null;
  if (await isAdultToken(req.cookies.get(ADULT_COOKIE)?.value)) return null;
  if (api) {
    return NextResponse.json({ error: "Ask a grown-up to unlock this." }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/grown-ups";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

async function proxyImpl(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (PUBLIC_FILES.has(pathname)) return NextResponse.next();

  const payload = await verified(req.cookies.get(COOKIE_NAME)?.value);
  if (payload) return renewed(req, payload, (await adultBlock(req)) ?? NextResponse.next());

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Next 16's dev runtime is strict about the export shape — provide BOTH the
// named `proxy` export AND a default export so every loader path is satisfied.
export const proxy = proxyImpl;
export default proxyImpl;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
