// Fold the database the live app used after the 2026-09-06 password rotation
// back into Nour's original database, so nothing from either is lost.
//
// After the rotation, Vercel's MONGODB_URI pointed at a different database.
// From 2026-09-07 the app ran there from almost nothing (6,365 XP, one list),
// while his real history (19,505 XP, nine school lists, the stuck words) sat
// untouched in the original. This merges the live one INTO the original.
//
//   MONGODB_URI       the original (already in .env.local)
//   MONGODB_URI_LIVE  the one Vercel used after the rotation (add it to
//                     .env.local yourself; never paste it into chat)
//
//   node scripts/merge-live-into-original.mjs            dry run: prints the plan
//   node scripts/merge-live-into-original.mjs --apply    backs up, then writes
//
// --source-file <dump.json> reads the live side from an Extended JSON dump
// (from the app's temporary /api/export) instead of MONGODB_URI_LIVE.
// --source-db / --target-db pick database names (default eduapp for both);
// --source-uri-env / --target-uri-env pick which .env.local keys to read.
// The source is only ever read.

import { readFileSync } from "node:fs";
import { BSON, MongoClient } from "mongodb";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const APPLY = args.includes("--apply");
const SOURCE_DB = flag("--source-db", "eduapp");
const TARGET_DB = flag("--target-db", "eduapp");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const SOURCE_FILE = flag("--source-file", "");
const SOURCE_URI = SOURCE_FILE ? "" : env[flag("--source-uri-env", "MONGODB_URI_LIVE")];
const TARGET_URI = env[flag("--target-uri-env", "MONGODB_URI")];
if (!SOURCE_FILE && !SOURCE_URI) throw new Error("Pass --source-file, or add MONGODB_URI_LIVE to .env.local.");
if (!TARGET_URI) throw new Error("MONGODB_URI missing from .env.local.");

// ── small helpers ──────────────────────────────────────────────────────────
const t = (d) => (d ? new Date(d).getTime() : 0);
const newer = (a, b, key) => (t(b?.[key]) > t(a?.[key]) ? b : a);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const byAtDesc = (a, b) => t(b.at) - t(a.at);
const blank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** YYYY-MM-DD minus n days, pure string math. */
function dayMinus(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * One skill, or one times fact: counts add up; the state comes from the live
 * side if it ever missed there (a miss is real news), otherwise the stronger
 * streak wins, with its own due date.
 */
function mergeStreaky(orig, live, countKeys) {
  if (!orig) return live;
  if (!live) return orig;
  const touched = countKeys.some((k) => num(live[k]) > 0);
  if (!touched) return orig;
  const sums = Object.fromEntries(countKeys.map((k) => [k, num(orig[k]) + num(live[k])]));
  const lastAt = t(live.lastAt) >= t(orig.lastAt) ? live.lastAt : orig.lastAt;
  const base = num(live.wrong) > 0 || num(live.streak) >= num(orig.streak) ? live : orig;
  return { ...orig, ...base, ...sums, lastAt };
}

// ── profile ────────────────────────────────────────────────────────────────
function mergeProfile(orig, live) {
  if (!live) return { doc: orig, notes: ["no live profile"] };
  if (!orig) return { doc: live, notes: ["original had no profile; live copied"] };

  const activity = [...(orig.activity ?? []), ...(live.activity ?? [])]
    .sort(byAtDesc)
    .slice(0, 200);

  const badges = new Map();
  for (const b of [...(orig.badges ?? []), ...(live.badges ?? [])]) {
    const had = badges.get(b.id);
    if (!had || t(b.earnedAt) < t(had.earnedAt)) badges.set(b.id, b);
  }

  // The live streak started from nothing on the first day there. If that day
  // follows straight on from the original's last active day, it is one run.
  const os = orig.streak ?? {};
  const ls = live.streak ?? {};
  const liveIsNewer = (ls.lastActiveDay ?? "") >= (os.lastActiveDay ?? "");
  let current = liveIsNewer ? num(ls.current) : num(os.current);
  if (liveIsNewer && ls.lastActiveDay && num(ls.current) > 0 && os.lastActiveDay) {
    const liveStart = dayMinus(ls.lastActiveDay, num(ls.current) - 1);
    if (dayMinus(liveStart, 1) === os.lastActiveDay) current = num(os.current) + num(ls.current);
  }
  const streak = {
    current,
    best: Math.max(num(os.best), num(ls.best), current),
    lastActiveDay: (liveIsNewer ? ls.lastActiveDay : os.lastActiveDay) ?? "",
  };

  const stats = { ...(orig.stats ?? {}) };
  for (const [k, v] of Object.entries(live.stats ?? {})) stats[k] = num(stats[k]) + num(v);

  const ot = orig.today ?? {};
  const lt = live.today ?? {};
  const today =
    ot.day === lt.day ? { day: ot.day, lessons: num(ot.lessons) + num(lt.lessons) } : (lt.day ?? "") > (ot.day ?? "") ? lt : ot;

  const reading = {
    ...(orig.reading ?? {}),
    level: Math.max(num(orig.reading?.level) || 1, num(live.reading?.level) || 1),
    recent: [...(orig.reading?.recent ?? []), ...(live.reading?.recent ?? [])].sort(byAtDesc).slice(0, 20),
  };

  const doc = {
    ...orig,
    xp: num(orig.xp) + num(live.xp),
    streak,
    today,
    badges: [...badges.values()],
    stats,
    activity,
    reading,
    recentSessionIds: [...new Set([...(orig.recentSessionIds ?? []), ...(live.recentSessionIds ?? [])])].slice(-100),
    readingSeen: [...(orig.readingSeen ?? []), ...(live.readingSeen ?? [])].sort((a, b) => t(a.at) - t(b.at)).slice(-8),
  };
  return {
    doc,
    notes: [
      `xp ${num(orig.xp)} + ${num(live.xp)} = ${doc.xp}`,
      `activity ${orig.activity?.length ?? 0} + ${live.activity?.length ?? 0} -> ${activity.length}`,
      `streak ${JSON.stringify(os)} + ${JSON.stringify(ls)} -> ${JSON.stringify(streak)}`,
      `badges -> ${doc.badges.length}`,
    ],
  };
}

// ── word lists ─────────────────────────────────────────────────────────────
const SKILLS = ["recognize", "listen", "spell", "use"];

function mergeWord(o, l) {
  const skills = { ...(o.skills ?? {}) };
  for (const id of SKILLS) skills[id] = mergeStreaky(o.skills?.[id], l.skills?.[id], ["correct", "wrong"]);
  const srs = t(l.srs?.lastReviewed) > t(o.srs?.lastReviewed)
    ? { ...l.srs, reviewCount: num(o.srs?.reviewCount) + num(l.srs?.reviewCount) }
    : { ...(o.srs ?? {}), reviewCount: num(o.srs?.reviewCount) + num(l.srs?.reviewCount) };
  const out = { ...o, skills, srs };
  for (const k of ["clue", "arabic", "explanation", "examples", "family"]) if (blank(o[k]) && !blank(l[k])) out[k] = l[k];
  return out;
}

function mergeList(o, l) {
  const words = [...(o.words ?? [])];
  let merged = 0;
  let added = 0;
  for (const lw of l.words ?? []) {
    const i = words.findIndex((w) => w.word === lw.word);
    if (i >= 0) {
      words[i] = mergeWord(words[i], lw);
      merged++;
    } else {
      words.push(lw);
      added++;
    }
  }
  const pathProgress = { ...(l.pathProgress ?? {}), ...(o.pathProgress ?? {}) };
  const os = o.readingStats ?? {};
  const ls = l.readingStats ?? {};
  const byType = { ...(os.byType ?? {}) };
  for (const [k, v] of Object.entries(ls.byType ?? {})) {
    byType[k] = { asked: num(byType[k]?.asked) + num(v?.asked), firstTryCorrect: num(byType[k]?.firstTryCorrect) + num(v?.firstTryCorrect) };
  }
  const readingStats = {
    ...os,
    totalSessions: num(os.totalSessions) + num(ls.totalSessions),
    totalQuestions: num(os.totalQuestions) + num(ls.totalQuestions),
    totalFirstTryCorrect: num(os.totalFirstTryCorrect) + num(ls.totalFirstTryCorrect),
    totalHintsUsed: num(os.totalHintsUsed) + num(ls.totalHintsUsed),
    byType,
    recentSessions: [...(os.recentSessions ?? []), ...(ls.recentSessions ?? [])]
      .sort((a, b) => t(a.completedAt) - t(b.completedAt))
      .slice(-20),
  };
  const currentReading = t(l.currentReading?.generatedAt) > t(o.currentReading?.generatedAt) ? l.currentReading : o.currentReading ?? null;
  return {
    doc: {
      ...o,
      words,
      pathProgress,
      readingStats,
      currentReading,
      readingLevel: Math.max(num(o.readingLevel) || 1, num(l.readingLevel) || 1),
      readingArchive: [...(o.readingArchive ?? []), ...(l.readingArchive ?? [])].slice(-8),
      readingHistory: [...(o.readingHistory ?? []), ...(l.readingHistory ?? [])].slice(-5),
      updatedAt: new Date(Math.max(t(o.updatedAt), t(l.updatedAt))),
    },
    note: `${o.name}: ${merged} words merged, ${added} added`,
  };
}

// ── spelling chains ────────────────────────────────────────────────────────
function mergeChain(o, l) {
  if (!o) return l;
  if (!l || num(l.attempts) === 0) return o;
  const finished = (c) => c.graduatedAt && num(c.current) >= 10;
  // A word finished with ten in a row stays finished: that was earned. It
  // comes back for its one-write check straight away, since it went a week
  // without one.
  let base;
  if (finished(o) && !finished(l)) base = { ...o, dueAt: new Date() };
  else if (finished(l) && !finished(o)) base = l;
  else base = t(l.lastAt) >= t(o.lastAt) ? l : o;
  const graduated = [o.graduatedAt, l.graduatedAt].filter(Boolean).sort((a, b) => t(a) - t(b))[0] ?? null;
  return {
    ...o,
    ...base,
    _id: o._id,
    best: Math.max(num(o.best), num(l.best)),
    reps: num(o.reps) + num(l.reps),
    attempts: num(o.attempts) + num(l.attempts),
    graduatedAt: base.graduatedAt ?? graduated,
    lastAt: t(l.lastAt) > t(o.lastAt) ? l.lastAt : o.lastAt,
  };
}

// ── math ───────────────────────────────────────────────────────────────────
function mergeMath(o, l) {
  if (!o) return l;
  if (!l) return o;
  const bests = [num(o.bestMs), num(l.bestMs)].filter((x) => x > 0);
  const lead = num(l.level) > num(o.level) ? l : num(o.level) > num(l.level) ? o : newer(o, l, "lastAt");
  return {
    ...o,
    level: Math.max(num(o.level) || 1, num(l.level) || 1),
    attempts: num(o.attempts) + num(l.attempts),
    correct: num(o.correct) + num(l.correct),
    bestMs: bests.length ? Math.min(...bests) : 0,
    recentPcts: lead.recentPcts ?? [],
    lastAt: t(l.lastAt) > t(o.lastAt) ? l.lastAt : o.lastAt,
  };
}

// ── run ────────────────────────────────────────────────────────────────────
const targetClient = new MongoClient(TARGET_URI);
await targetClient.connect();
const sourceClient = SOURCE_FILE ? null : SOURCE_URI === TARGET_URI ? targetClient : new MongoClient(SOURCE_URI);
if (sourceClient && sourceClient !== targetClient) await sourceClient.connect();
const dump = SOURCE_FILE ? BSON.EJSON.parse(readFileSync(SOURCE_FILE, "utf8"), { relaxed: true }) : null;
const src = sourceClient ? sourceClient.db(SOURCE_DB) : { dump };
const dst = targetClient.db(TARGET_DB);

const read = async (db, name) => (db.dump ? db.dump[name] ?? [] : db.collection(name).find().toArray());
const [sProfiles, dProfiles, sLists, dLists, sChains, dChains, sFacts, dFacts, sMath, dMath] = await Promise.all([
  read(src, "profiles"), read(dst, "profiles"),
  read(src, "wordlists"), read(dst, "wordlists"),
  read(src, "spellchains"), read(dst, "spellchains"),
  read(src, "timesfacts"), read(dst, "timesfacts"),
  read(src, "mathprogresses"), read(dst, "mathprogresses"),
]);

const plan = { profiles: [], wordlists: [], spellchains: [], timesfacts: [], mathprogresses: [] };
const log = [];

// Profile: one document, key "default".
const sp = sProfiles[0];
const dp = dProfiles[0];
const profile = mergeProfile(dp, sp);
if (sp) plan.profiles.push(profile.doc);
log.push(`profile: ${profile.notes.join("; ")}`);

// Lists: the pool matches the pool, units match by name.
for (const l of sLists) {
  const o = l.kind === "pool" ? dLists.find((d) => d.kind === "pool") : dLists.find((d) => d.name === l.name && d.kind !== "pool");
  if (!o) {
    plan.wordlists.push(l);
    log.push(`list ${l.name}: new, ${l.words?.length ?? 0} words copied`);
  } else {
    const m = mergeList(o, l);
    plan.wordlists.push(m.doc);
    log.push(`list ${m.note}`);
  }
}

let chainNew = 0, chainMerged = 0;
for (const l of sChains) {
  const o = dChains.find((d) => d.word === l.word);
  if (!o) chainNew++; else chainMerged++;
  plan.spellchains.push(mergeChain(o, l));
}
log.push(`spelling chains: ${chainNew} new, ${chainMerged} merged`);

let factNew = 0, factMerged = 0;
for (const l of sFacts) {
  const o = dFacts.find((d) => d.key === l.key);
  if (!o) factNew++; else factMerged++;
  const m = mergeStreaky(o, l, ["correct", "wrong", "fast"]);
  plan.timesfacts.push(o ? { ...m, _id: o._id } : m);
}
log.push(`times facts: ${factNew} new, ${factMerged} merged`);

for (const l of sMath) {
  const o = dMath.find((d) => d.skill === l.skill);
  const m = mergeMath(o, l);
  plan.mathprogresses.push(o ? { ...m, _id: o._id } : m);
  log.push(`math ${l.skill}: level ${o?.level ?? "-"} + ${l.level} -> ${m.level}, attempts ${num(o?.attempts)} + ${num(l.attempts)}`);
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${SOURCE_FILE || SOURCE_DB} (live) -> ${TARGET_DB} (original)`);
for (const line of log) console.log("  " + line);

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const backup = targetClient.db(`${TARGET_DB}-backup-${stamp}`);
  for (const { name } of await dst.listCollections().toArray()) {
    const docs = await dst.collection(name).find().toArray();
    if (docs.length) await backup.collection(name).insertMany(docs);
  }
  console.log(`  backup written: ${TARGET_DB}-backup-${stamp}`);

  const upsert = async (name, docs, keyOf) => {
    if (docs.length === 0) return;
    await dst.collection(name).bulkWrite(
      docs.map((d) => ({ replaceOne: { filter: keyOf(d), replacement: d, upsert: true } }))
    );
  };
  await upsert("profiles", plan.profiles, (d) => ({ key: d.key ?? "default" }));
  await upsert("wordlists", plan.wordlists, (d) => ({ _id: d._id }));
  await upsert("spellchains", plan.spellchains, (d) => ({ word: d.word }));
  await upsert("timesfacts", plan.timesfacts, (d) => ({ key: d.key }));
  await upsert("mathprogresses", plan.mathprogresses, (d) => ({ skill: d.skill }));
  console.log("  merged.");
}

if (sourceClient && sourceClient !== targetClient) await sourceClient.close();
await targetClient.close();
