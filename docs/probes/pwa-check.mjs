/**
 * PWA smoke test: does the app actually install, cache and update?
 *
 * The in-app browser pane refuses to fetch a service worker script, so this
 * drives the real Chrome on the machine over the DevTools protocol instead.
 * It checks the parts that stay invisible until they break in someone's hand:
 * that the worker registers and takes control, that it fills its caches, that
 * the manifest's icons and screenshots are reachable with no session, and —
 * the part this was written for — that a NEW worker waits instead of seizing
 * a running page, and only takes over when asked.
 *
 * Run it:  node docs/probes/pwa-check.mjs
 * Needs a PRODUCTION server (npm run build && npx next start -p 3100), because
 * the worker is deliberately not registered in development. No AI calls.
 */
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = process.env.PORT || 3100;
// ORIGIN=https://... points the read-only checks at a real deployment. The
// update steps stay local-only: they force an update by editing public/sw.js,
// which cannot change what a deployed origin serves.
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;
const REMOTE = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(ORIGIN);
const COOKIE_DOMAIN = new URL(ORIGIN).hostname;
const SW_FILE = path.join(ROOT, "public", "sw.js");
const DEBUG_PORT = 9334;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));
if (!CHROME) {
  console.error("No Chrome or Edge found.");
  process.exit(1);
}

const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const token = await new SignJWT({ sub: "pwa-check" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("30m")
  .sign(new TextEncoder().encode(env.AUTH_SECRET));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  - ${detail}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const originalSw = await readFile(SW_FILE, "utf8");

// The update step appends a byte to the real public/sw.js to force the browser
// to see a new version, and the finally below puts it back. A finally does not
// run on Ctrl+C, and the corrupted file still parses and still works — so it
// could be committed and deployed without anyone noticing. Restore on the way
// out too, whatever the exit.
let restored = false;
const restoreSw = () => {
  if (restored) return;
  restored = true;
  try {
    writeFileSync(SW_FILE, originalSw, "utf8");
  } catch {
    console.error(`could not restore ${SW_FILE} — check it before committing`);
  }
};
process.on("exit", restoreSw);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sig, () => {
    restoreSw();
    process.exit(130);
  });
}
process.on("uncaughtException", (err) => {
  restoreSw();
  console.error(err);
  process.exit(1);
});

// Start from a browser that has never seen this app. The profile persists a
// registered worker, so reusing it made the run depend on what the last run
// left behind: the update step passed once and then failed on the next run
// because the "new" worker was already installed.
const PROFILE = path.join(ROOT, ".chrome-pwa");
await rm(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    `--user-data-dir=${PROFILE}`,
    "--window-size=412,915",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function targetUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const pages = (await res.json()).filter((t) => t.type === "page");
      if (pages[0]?.webSocketDebuggerUrl) return pages[0].webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome did not open a debugging port");
}

const ws = new WebSocket(await targetUrl());
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej, { once: true });
});

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  const entry = msg.id !== undefined ? pending.get(msg.id) : null;
  if (!entry) return;
  pending.delete(msg.id);
  if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
  else entry.resolve(msg.result);
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/** Run an async body in the page and return its value. */
async function evalPage(body) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? "page threw");
  return result.value;
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCookie", {
    name: "eduapp_session",
    value: token,
    domain: COOKIE_DOMAIN,
    path: "/",
  });

  await send("Page.navigate", { url: `${ORIGIN}/` });
  await sleep(3000);

  // 1. It registers and takes control.
  const state = await evalPage(`
    // serviceWorker.ready never settles when nothing registers, which hung the
    // whole probe with no output. Race it so a failure is reported, not waited
    // on forever.
    const timeout = new Promise((r) => setTimeout(() => r(null), 20000));
    const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
    for (let i = 0; i < 40 && reg && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return {
      registered: Boolean(reg),
      active: reg && reg.active ? reg.active.state : null,
      controlled: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
      url: location.pathname,
    };
  `);
  if (!state.registered) {
    check("the service worker registers and activates", false, `no worker after 20s at ${state.url}`);
  } else
  check("the service worker registers and activates", state.active === "activated", state.active);
  check("it takes control of the page", state.controlled);

  // A first install must not reload him. The worker's activate calls
  // clients.claim(), which fires controllerchange with no update involved;
  // reloading there threw a brand new visitor out of whatever he had tapped.
  const nav = await evalPage(`
    const e = performance.getEntriesByType("navigation")[0];
    return e ? e.type : null;
  `);
  check("a first install does not reload the page under him", nav === "navigate", String(nav));

  // 2. It fills its caches, and they belong to the current version.
  const version = originalSw.match(/const VERSION = "([^"]+)"/)[1];
  const owned = (c) => c.startsWith(version) || c === "quest-meta";
  check(
    `caches are created for ${version}`,
    state.caches.length > 0 && state.caches.every(owned),
    state.caches.join(", ") || "none"
  );
  const shell = await evalPage(`
    const c = await caches.open("${version}-shell");
    const keys = await c.keys();
    return keys.map((r) => new URL(r.url).pathname);
  `);
  check(
    "the offline shell is precached",
    shell.includes("/") && shell.includes("/offline"),
    shell.join(" ") || "empty"
  );

  // 3. The manifest's own assets load with no session: the install dialog
  //    fetches them unauthenticated, and a redirect leaves it blank.
  const assets = await evalPage(`
    const m = await (await fetch("/manifest.webmanifest")).json();
    const urls = m.icons.map((i) => i.src).concat((m.screenshots || []).map((s) => s.src));
    const out = {};
    for (const u of urls) out[u] = (await fetch(u, { credentials: "omit" })).status;
    return { id: m.id || null, out };
  `);
  check("the manifest declares a stable id", assets.id === "/", String(assets.id));
  check(
    "every icon and screenshot loads without a session",
    Object.values(assets.out).every((s) => s === 200),
    JSON.stringify(assets.out)
  );

  if (REMOTE) {
    console.log("(remote origin: skipping the update steps, which edit public/sw.js)");
  } else {
  // 4. The point of the exercise: a new worker WAITS.
  // Bump the VERSION rather than appending a byte: a new version names its own
  // caches, which is what makes the orphan cleanup testable below.
  const NEXT_VERSION = `${version}-probe`;
  await writeFile(
    SW_FILE,
    originalSw.replace(`const VERSION = "${version}"`, `const VERSION = "${NEXT_VERSION}"`),
    "utf8"
  );
  const update = await evalPage(`
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
    for (let i = 0; i < 40 && !reg.waiting; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    // Poll, because the bar is React reacting to the worker's statechange,
    // which lands a tick or two after reg.waiting is set. And match case
    // insensitively: innerText returns the CSS-uppercased string, so a
    // case-sensitive check reported a missing bar that the next step clicked.
    let bar = false;
    for (let i = 0; i < 40 && !bar; i++) {
      bar = /new quest ready/i.test(document.body.innerText);
      if (!bar) await new Promise((r) => setTimeout(r, 250));
    }
    return {
      waiting: Boolean(reg.waiting),
      stillControlled: Boolean(navigator.serviceWorker.controller),
      bar,
    };
  `);
  check("a new version waits instead of taking over", update.waiting);
  check("the running page keeps its old worker", update.stillControlled);
  check("the update bar is offered to him", update.bar);

  // And it is an offer, not a trap. The first cut sat at bottom-0 z-60 over
  // the tab bar with no dismiss, so a deploy mid-lesson left him unable to
  // navigate or even finish the question he was on.
  const reachable = await evalPage(`
    const bar = Array.from(document.querySelectorAll("button"))
      .find((b) => /new quest ready/i.test(b.textContent));
    const dismiss = document.querySelector('[aria-label="Not now"]');
    const nav = document.querySelector("nav");
    if (!bar) return { ok: false, why: "no bar" };
    const barBox = bar.getBoundingClientRect();
    const navBox = nav ? nav.getBoundingClientRect() : null;
    return {
      hasDismiss: Boolean(dismiss),
      clearsNav: navBox ? barBox.bottom <= navBox.top : null,
      navBottom: navBox ? Math.round(navBox.top) : null,
      barBottom: Math.round(barBox.bottom),
    };
  `);
  check("he can refuse the update", reachable.hasDismiss === true);
  check(
    "the bar sits clear of the bottom navigation",
    reachable.clearsNav !== false,
    `bar bottom ${reachable.barBottom}, nav top ${reachable.navBottom}`
  );

  // 5. And it hands over only when he taps.
  const took = await evalPage(`
    const btn = Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent.includes("New Quest ready"));
    if (!btn) return { clicked: false, changed: false };
    let changed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { changed = true; });
    btn.click();
    for (let i = 0; i < 40 && !changed; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return { clicked: true, changed };
  `);
  check("tapping it hands over to the new worker", took.clicked && took.changed);

  // 6. The new version cleans up after the old one. A declined update used to
  //    leave a full shell-plus-chunks cache behind with nothing to clear it.
  if (took.changed) {
    const after = await evalPage(`
      for (let i = 0; i < 40; i++) {
        const keys = await caches.keys();
        if (keys.some((k) => k.startsWith("${NEXT_VERSION}"))) return keys;
        await new Promise((r) => setTimeout(r, 250));
      }
      return await caches.keys();
    `);
    check(
      "the superseded version's caches are cleaned up",
      after.every((c) => c.startsWith(NEXT_VERSION) || c === "quest-meta"),
      after.join(", ")
    );
  }
  }
} finally {
  restoreSw();
  ws.close();
  chrome.kill();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
