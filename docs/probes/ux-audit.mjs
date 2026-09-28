// UX audit: every page, as each child, at a phone and a desktop width.
//   node docs/probes/ux-audit.mjs            (dev server must be on PORT, default 3000)
//   node docs/probes/ux-audit.mjs --json out.json
//
// Crawls the app from the home page by following its own links, so a new
// page is covered without editing this file. On every page it reports:
//   - the HTTP status of the document and any request that failed (>= 400)
//   - console errors and uncaught exceptions
//   - horizontal overflow: the page wider than the screen, and which
//     elements stick out (the parent's rule: no sideways scroll at 360px)
//   - tap targets smaller than 44x44 CSS px (the parent's floor)
// Exit code 1 when anything is found, so it can gate a merge.
//
// Local runs are locked to the test copy (lib/db.ts), so crawling never
// touches the children's real progress. Routes that spend the family's Groq
// tokens or play audio are blocked; the failures that causes are expected
// and not reported.

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = process.env.PORT || 3000;
const ORIGIN = `http://localhost:${PORT}`;
const DEBUG_PORT = 9334;
const WIDTHS = [360, 1280];
const MIN_TARGET = 44;
const MAX_PAGES = Number(process.env.MAX_PAGES || 80);
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

// Groq (tokens), Edge TTS and Whisper (audio). Blocked so a crawl costs nothing.
const BLOCKED = [
  "*/api/reading/generate*",
  "*/api/chat*",
  "*/api/clues*",
  "*/api/lists/seed*",
  "*/api/lists/*/examples*",
  "*/api/lists/*/flashcards/translate*",
  "*/api/lists/*/flashcards/explain*",
  "*/api/transcribe*",
  "*/api/tts*",
];
const BLOCKED_RE = BLOCKED.map(
  (p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`)
);
// Pages that change data or end the session just by being opened.
const SKIP = [/^\/api\//, /\/print/, /sign-?out/, /logout/];

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => existsSync(p));
if (!CHROME) {
  console.error("No Chrome or Edge found.");
  process.exit(2);
}

const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const key = new TextEncoder().encode(env.AUTH_SECRET);
const sign = (payload, exp) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(key);

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--mute-audio",
    `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "ux-audit-"))}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const pages = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).filter(
        (t) => t.type === "page"
      );
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
let sink = null; // per-page event collector
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
    else entry.resolve(msg.result);
  } else if (sink) {
    sink(msg);
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
await send("Runtime.enable");
await send("Log.enable");
await send("Network.setBlockedURLs", { urls: BLOCKED });

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return res.result?.value;
}

// Runs inside the page. Returns overflow, small targets and same-origin links.
const INSPECT = `(() => {
  const vw = document.documentElement.clientWidth;
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 3).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const overflow = document.documentElement.scrollWidth - vw;
  const sticking = [];
  if (overflow > 1) {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && visible(el)) {
        // Report the outermost offender only.
        let p = el.parentElement, parentSticks = false;
        while (p && p !== document.body) { if (p.getBoundingClientRect().right > vw + 1) { parentSticks = true; break; } p = p.parentElement; }
        if (!parentSticks) sticking.push({ el: sel(el), right: Math.round(r.right), text: label(el) });
      }
      if (sticking.length >= 6) break;
    }
  }
  const small = [];
  const targets = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], summary, [onclick]');
  for (const el of targets) {
    if (!visible(el) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    // A link or word button inside a sentence is exempt (WCAG 2.5.8), one on its own is not.
    if ((el.tagName === 'A' || el.tagName === 'BUTTON') && /^inline/.test(getComputedStyle(el).display) && el.parentElement && el.parentElement.innerText.trim().length > (el.innerText || '').trim().length + 20) continue;
    // A control wrapped by a label or a bigger clickable parent gets that parent's area.
    let hit = { width: r.width, height: r.height };
    const wrap = el.closest('label') || (el.parentElement && el.parentElement.closest('button, a[href], [role=button]'));
    if (wrap && wrap !== el) hit = wrap.getBoundingClientRect();
    // A bigger invisible hit area drawn with ::after (absolute, negative insets)
    // is what the finger meets, without changing the layout.
    const after = getComputedStyle(el, '::after');
    if (after.position === 'absolute' && after.content !== 'none') {
      const out = (v) => Math.max(0, -(parseFloat(v) || 0));
      hit = {
        width: Math.max(hit.width, r.width + out(after.left) + out(after.right)),
        height: Math.max(hit.height, r.height + out(after.top) + out(after.bottom)),
      };
    }
    if (hit.width < ${MIN_TARGET} - 0.5 || hit.height < ${MIN_TARGET} - 0.5) {
      small.push({ el: sel(el), w: Math.round(hit.width), h: Math.round(hit.height), text: label(el) });
    }
  }
  const links = [...document.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && h.startsWith('/') && !h.startsWith('//'))
    .map((h) => h.split('#')[0]);
  return { overflow, sticking, small, links: [...new Set(links)] };
})()`;

async function visit(url, width) {
  const errors = [];
  const failed = [];
  let status = null;
  let loaded = false;
  const docUrl = url;
  sink = (msg) => {
    if (msg.method === "Page.loadEventFired") loaded = true;
    if (msg.method === "Network.responseReceived") {
      const { response, type } = msg.params;
      if (type === "Document" && response.url.startsWith(docUrl.split("?")[0])) status = response.status;
      if (response.status >= 400 && !response.url.includes("_next/webpack-hmr")) {
        failed.push(`${response.status} ${response.url.replace(ORIGIN, "")}`);
      }
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(`exception: ${msg.params.exceptionDetails.exception?.description?.split("\n")[0] ?? msg.params.exceptionDetails.text}`);
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      errors.push(`console: ${text.split("\n")[0].slice(0, 200)}`);
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      const { text, url: u } = msg.params.entry;
      if (/ERR_BLOCKED_BY_CLIENT/.test(text) || (u && BLOCKED_RE.some((re) => re.test(u)))) return;
      errors.push(`log: ${text.slice(0, 200)}${u ? ` (${u.replace(ORIGIN, "")})` : ""}`);
    }
  };
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 768 ? 800 : 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await send("Page.navigate", { url });
  for (let i = 0; i < 150 && !loaded; i++) await sleep(100);
  await sleep(1800);
  const info = (await evaluate(INSPECT)) ?? { overflow: 0, sticking: [], small: [], links: [] };
  const finalUrl = await evaluate("location.pathname + location.search");
  sink = null;
  // Blocked Groq/audio routes fail on purpose; do not report them.
  const expected = (s) => /ERR_BLOCKED_BY_CLIENT|net::ERR_FAILED|Failed to fetch|NetworkError/.test(s);
  return { status, finalUrl, errors: errors.filter((e) => !expected(e)), failed, ...info };
}

const report = [];
for (const learner of ["nour", "wissam"]) {
  await send("Network.clearBrowserCookies");
  const session = await sign({ ok: true, learner }, "30m");
  const adult = await sign({ adult: true }, "30m");
  for (const [name, value] of [
    ["eduapp_session", session],
    ["eduapp_learner", learner],
    ["eduapp_adult", adult],
  ]) {
    await send("Network.setCookie", { name, value, domain: "localhost", path: "/" });
  }
  const queue = ["/"];
  const seen = new Set(queue);
  while (queue.length > 0 && seen.size <= MAX_PAGES) {
    const page = queue.shift();
    for (const width of WIDTHS) {
      const r = await visit(ORIGIN + page, width);
      const issues =
        (r.status && r.status >= 400 ? 1 : 0) + r.errors.length + r.failed.length + (r.overflow > 1 ? 1 : 0) + r.small.length;
      report.push({ learner, page, width, ...r, links: undefined, issues });
      const tag = issues ? "FAIL" : "ok  ";
      console.log(`${tag} ${learner.padEnd(6)} ${String(width).padEnd(4)} ${page}${r.finalUrl !== page ? `  -> ${r.finalUrl}` : ""}`);
      if (r.status && r.status >= 400) console.log(`       status ${r.status}`);
      for (const e of r.errors) console.log(`       ${e}`);
      for (const f of r.failed) console.log(`       failed ${f}`);
      if (r.overflow > 1) console.log(`       overflow +${r.overflow}px: ${r.sticking.map((s) => `${s.el}(${s.right}) "${s.text}"`).join(" | ")}`);
      for (const s of r.small) console.log(`       small ${s.w}x${s.h} ${s.el} "${s.text}"`);
      if (width === WIDTHS[0]) {
        for (const link of r.links) {
          if (!seen.has(link) && !SKIP.some((re) => re.test(link))) {
            seen.add(link);
            queue.push(link);
          }
        }
      }
    }
  }
}

ws.close();
chrome.kill();
const total = report.reduce((n, r) => n + r.issues, 0);
const pages = new Set(report.map((r) => `${r.learner}:${r.page}`)).size;
console.log(`\n${pages} page visits x ${WIDTHS.length} widths, ${total} issue(s)`);
if (jsonOut) await writeFile(jsonOut, JSON.stringify(report, null, 2));
process.exit(total > 0 ? 1 : 0);
