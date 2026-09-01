// Captures the PWA install-dialog screenshots from the running app.
//   node scripts/screenshots.mjs        (dev server must be on PORT, default 3000)
// Writes public/screenshots/lesson.png and math.png at 412x915.
//
// Real captures, not mockups: an install dialog that shows something the app
// does not look like is worse than one with no pictures. Uses the Chrome
// already on the machine over the DevTools protocol, so there is no headless
// browser in the dependency tree for one manifest field.
//
// Deliberately NOT the home screen. These files are served publicly so the
// install dialog can fetch them, and the home screen carries his name and his
// progress. Work screens show what the app does without showing who uses it.

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "screenshots");
const PORT = process.env.PORT || 3000;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// Pixel 5 logical size: the narrow form factor Chrome asks for.
const WIDTH = 412;
const HEIGHT = 915;
const DEBUG_PORT = 9333;

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("No Chrome or Edge found. Install one, or capture by hand.");
  process.exit(1);
}

const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

// The app is behind a PIN, so the capture signs its own session cookie the way
// the probes do. Never a typed credential.
const token = await new SignJWT({ sub: "screenshots" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("30m")
  .sign(new TextEncoder().encode(env.AUTH_SECRET));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${path.join(ROOT, ".chrome-shots")}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const pages = (await res.json()).filter((t) => t.type === "page");
      if (pages[0]?.webSocketDebuggerUrl) return pages[0].webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error("Chrome did not open a debugging port");
}

const ws = new WebSocket(await targetUrl());
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
    else entry.resolve(msg.result);
  } else {
    events.push(msg.method);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Network.setCookie", {
  name: "eduapp_session",
  value: token,
  domain: "127.0.0.1",
  path: "/",
});

async function capture(name, url) {
  const before = events.length;
  await send("Page.navigate", { url });
  // Wait for the load event, then a beat for fonts and layout to settle.
  for (let i = 0; i < 80; i++) {
    if (events.slice(before).includes("Page.loadEventFired")) break;
    await sleep(100);
  }
  await sleep(1200);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`wrote public/screenshots/${name}.png`);
}

await mkdir(OUT, { recursive: true });
// Both render on the server, so the capture never races React hydration and
// neither needs an AI call to have something on it.
await capture("lesson", `${ORIGIN}/learn/structure`);
await capture("math", `${ORIGIN}/math/number-forms`);

ws.close();
chrome.kill();
