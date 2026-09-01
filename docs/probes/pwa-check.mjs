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
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = process.env.PORT || 3100;
const ORIGIN = `http://localhost:${PORT}`;
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
    domain: "localhost",
    path: "/",
  });

  await send("Page.navigate", { url: `${ORIGIN}/` });
  await sleep(3000);

  // 1. It registers and takes control.
  const state = await evalPage(`
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return {
      active: reg.active ? reg.active.state : null,
      controlled: Boolean(navigator.serviceWorker.controller),
      caches: await caches.keys(),
    };
  `);
  check("the service worker registers and activates", state.active === "activated", state.active);
  check("it takes control of the page", state.controlled);

  // 2. It fills its caches, and they belong to the current version.
  const version = originalSw.match(/const VERSION = "([^"]+)"/)[1];
  check(
    `caches are created for ${version}`,
    state.caches.length > 0 && state.caches.every((c) => c.startsWith(version)),
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

  // 4. The point of the exercise: a new worker WAITS.
  await writeFile(SW_FILE, `${originalSw}\n// pwa-check touch\n`, "utf8");
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
} finally {
  await writeFile(SW_FILE, originalSw, "utf8");
  ws.close();
  chrome.kill();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
