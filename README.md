# Quest

A home learning app for Nour (Grade 4, Asbell Elementary). Words, reading, and math — fast recall, spaced repetition, and a reward loop. Installs on Android as a PWA. Built with Next.js 16, Tailwind v4, Mongoose (MongoDB Atlas), and Groq.

## What's inside

- **Learn** — "Today's quest" (Review → New words → Reading → Write and use) plus a 7-step path per word list: flashcards, match, listen, spell, use, read, challenge. A word is *known* only after passing four different skills, spaced across days.
- **Math** — Grade-4 skills aligned to the Fayetteville Public Schools units (place value to 1,000,000, multi-digit × and ÷, fractions, decimals, data, angles, shapes), with visual models and one-line "how" explanations. Difficulty adapts per skill.
- **Drill** — free practice: word drills (cards, match, listen, spell, use, spelling test, "write what you remember", mixed) and math drills (relaxed or timed). Everything still counts.
- **Reading** — AI passages at levels 1–10 (length, sentence length, and question types scale with performance), listen-while-reading, a words-per-minute timer, and questions mapped to the school's ELA standards. Science-unit topics follow the school calendar.
- **Words** — parent tab: build lists, one-tap "school lists" from the current science/reading units, AI clues/examples, print worksheets (crossword, scramble, word search).
- **Me** — level, XP, streak, badges, words known, settings, and "Add to phone".
- **AI Buddy** — kid-safe chat with gentle grammar recasts and voice in/out.

Progress persists server-side (profile, per-word skill schedules, math levels, reading level). Failed saves queue locally and flush on the next visit.

## School alignment

`lib/curriculum.ts` + `docs/curriculum-fps-grade4.md` carry the FPS 2026-27 Grade 4 year-at-a-glance (ELA, math, science) and drive the "At school now" strip, school word lists, and reading topics. Pedagogy defaults (spacing ladder, mastery rules, level-up thresholds) are documented in `docs/pedagogy.md`.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in the four vars
npm run dev
```

No Atlas nearby? `node local-mongo.mjs` starts a throwaway in-memory MongoDB on 27017; run dev with `MONGODB_URI=mongodb://127.0.0.1:27017/eduapp`.

Tests: `npm test` (rewards, mastery, lesson builder, math generators, curriculum, reading, drills).

## Environment variables

| Var | Where to get it |
|---|---|
| `MONGODB_URI` | <https://cloud.mongodb.com> → cluster → Connect |
| `GROQ_API_KEY` | <https://console.groq.com/keys> |
| `PARENT_PIN`  | 4–6 digit family PIN |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `KID_TZ` | optional, defaults to `America/Chicago` |

## Deploy + install on a phone

Push to `main` → Vercel auto-deploys. On the phone, open the site in Chrome → menu → **Add to Home screen** (or the install banner on **Me**). It runs full-screen with offline fallback.

## Where to customise

- Tutor personality and clue style: prompt strings in `lib/groq.ts`.
- XP, badges, pass marks: `lib/rewards.ts`.
- Mastery/spacing rules: `lib/mastery.ts` (+ `docs/pedagogy.md` for the why).
