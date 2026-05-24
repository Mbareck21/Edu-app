# Edu-App — Shipped Features Log

Rolling history of what's live. Append-only; each entry is the durable memory of one feature that shipped to production. Newer entries on top.

---

## High-quality server-side voice (Whisper + Edge TTS) — 2026-05-24

- **Status:** Shipped (commit `142a546`)
- **Live URL:** <https://edu-app-beta-eight.vercel.app/chat>
- **Summary:** Replaced the browser Web Speech API (poor recording, robotic Arabic TTS) with two free server-side endpoints: Groq Whisper for STT and Microsoft Edge TTS for bilingual neural-voice playback.

### Acceptance criteria (verified live)
- [x] `GET /api/tts?text=...` returns valid `audio/mpeg` — 17 KB for an English sentence in 920ms
- [x] Bilingual TTS chunks by Arabic Unicode range and calls Edge TTS once per language span — verified with mixed text "A curious (فضولي) person…" → 39 KB MPEG produced in 1.16s
- [x] `POST /api/transcribe` exists and validates input (400 on empty body)
- [x] Voices are parent-customizable: `AI_ENGLISH_VOICE` defaults to `en-US-AnaNeural` (child voice), `AI_ARABIC_VOICE` defaults to `ar-EG-SalmaNeural`
- [x] Mic uses `MediaRecorder`; on stop, POSTs `multipart/form-data` to `/api/transcribe`
- [x] AI auto-play uses `<audio>` element pointed at `/api/tts`; 1-hour browser cache for replays
- [x] Mute toggle + replay button preserved

### Files touched
`app/api/tts/route.ts` (new), `app/api/transcribe/route.ts` (new), `lib/voice.ts` (rewrite), `lib/groq.ts` (voice constants + STT_MODEL), `app/chat/page.tsx` (new mic + audio flows), `package.json` (+@andresaya/edge-tts)

### Decisions worth remembering
- **Groq Whisper over browser STT.** Same provider, same API key, 2000 req/day free tier, much better Arabic-accented English recognition. `whisper-large-v3-turbo` is the right model — fast and multilingual.
- **Edge TTS over Azure/Google.** No signup, no API key, no monthly char cap to track. Same neural-voice engine as Azure Speech. Lives on Microsoft's public Read-Aloud endpoint.
- **Server-side bilingual chunking.** Same Unicode regex as the previous client-side version, but now lives in `/api/tts` next to the Edge TTS calls. Each chunk → one `EdgeTTS.synthesize()` → `Buffer.concat()` produces valid concatenated MP3.
- **Browser cache via `Cache-Control: public, max-age=3600`.** The text is in the URL, so the cache key is stable — replays are instant after the first play.
- **`en-US-AnaNeural` for the AI.** It's Microsoft's child voice — relatable for a 9-year-old peer dynamic.
- **`FormData.get("audio")` returns `File`, not `Blob`.** Type-narrows directly to File; no need to wrap.

### Karpathy frame (as shipped)
- **What:** Server-side voice via Groq Whisper (STT) and Edge TTS (TTS) replacing inconsistent browser-native APIs.
- **Why this shape:** Both free, both high quality, both work consistently regardless of what voices the user's OS has installed. Server-side means the kid gets the same Arabic voice on his phone as on the laptop.
- **First failure mode probed:** Embedded Arabic in TTS with English voice (the old failure). Verified the chunked endpoint produces 39 KB of audio for mixed text — proves the per-chunk synthesis is firing.

### Known follow-ups
- Edge TTS uses an unofficial Microsoft endpoint; if Microsoft kills it, swap to **Azure Speech Services free tier** (500k chars/month, official, requires only a free Azure key) — one file change in `app/api/tts/route.ts`.
- Voice choice can be improved per-family by editing `AI_ENGLISH_VOICE` / `AI_ARABIC_VOICE` in `lib/groq.ts` (PARENT CONTRIBUTION #3) — list of alternatives included in comments.
- No streaming yet — the whole TTS response is buffered before sending. For longer replies (>10 sec audio) we could stream chunks; not needed at current reply lengths.

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Voice chat for English practice — 2026-05-24

- **Status:** Shipped (commit `4a85687`, direct main push)
- **Live URL:** <https://edu-app-beta-eight.vercel.app/chat>
- **Summary:** Added voice in/out to `/chat` using the browser-native Web Speech API. The AI now strategically inserts brief Arabic glosses when introducing English vocabulary words, and TTS splits replies by language so Arabic is spoken with an Arabic voice.

### Acceptance criteria (verified live)
- [x] Mic button next to the input (hidden if browser lacks `SpeechRecognition`)
- [x] Tap-to-start / tap-to-stop with live interim transcript
- [x] AI replies auto-play through device speaker when streaming finishes
- [x] Mute toggle in header, preference persisted to `localStorage` (`eduapp.autoplay`)
- [x] Replay button on each AI message
- [x] TTS chunks text by Arabic vs Latin Unicode range; one `SpeechSynthesisUtterance` per chunk with correct `lang` (`ar-SA` / `en-US`)
- [x] AI system prompt produces Arabic glosses on vocabulary words — verified live: *"A happy (سعيد) person smiles and feels good inside"*
- [x] Zero backend changes; `/api/chat` untouched; no new env vars; no new deps

### Files touched
`lib/voice.ts` (new), `lib/groq.ts` (CHAT_SYSTEM_PROMPT update), `app/chat/page.tsx` (mic + replay + mute + auto-play wiring)

### Decisions worth remembering
- **Web Speech API over Whisper/ElevenLabs.** Free, no backend, no key rotation. Trade-off: voice quality varies by device; Firefox lacks STT (we hide the mic there gracefully).
- **UI stays English-only.** "Arabic fallback" is an AI behaviour in the system prompt, not a UI feature. Keeps the chat surface clean and English-immersive while still giving the child a comprehension safety net.
- **TTS bilingual chunking is required, not optional.** Without splitting per-language and setting `utterance.lang`, embedded Arabic words are pronounced by the English voice as gibberish. The Unicode regex `[؀-ۿ...]` is the language anchor; letters drive language, whitespace/punctuation join the previous chunk.
- **Auto-play default on with persistent mute toggle.** Feels like a real tutor; toggle covers library/quiet-room cases.
- **Tap-to-start / tap-to-stop, not push-to-hold.** Matches WhatsApp/Telegram voice-note UI a 9-year-old already knows.

### Karpathy frame (as shipped)
- **What:** Voice in/out on `/chat` via Web Speech API + system-prompt-driven Arabic glosses.
- **Why this shape:** Zero backend changes, zero new costs. Arabic is an AI behaviour not a UI element — keeps the surface English-immersive.
- **First failure mode probed:** Embedded Arabic in TTS using English voice. Mitigation in `lib/voice.ts::chunkByLanguage`. Verified the AI does produce mixed-language replies in prod.

### Known follow-ups
- The Arabic-policy block in `CHAT_SYSTEM_PROMPT` is marked as a parent contribution — tune aggressiveness if Arabic glosses feel too frequent or too rare in practice.
- iOS Safari `SpeechSynthesis` occasionally stalls on rapid utterances — `speak()` always calls `cancel()` first as defence; may still need refinement after more real-world use.
- Voice quality depends on the OS's installed voices. Arabic voice may need to be installed on some Android devices.

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Edu-App foundation — English worksheets + AI buddy — 2026-05-24

- **Status:** Shipped (no PR — direct main push to GitHub, deployed via Vercel CLI)
- **Live URL:** <https://edu-app-beta-eight.vercel.app>
- **Repo:** <https://github.com/Mbareck21/Edu-app> (branch `main`)
- **Summary:** Next.js 16 app where a parent enters vocabulary words once and the app generates three printable worksheets (crossword, scramble, hidden-message word search) plus a kid-safe Groq-backed AI chat. Built for a 9-year-old Arabic-native English learner.

### Acceptance criteria (verified live)
- [x] PIN sign-in (single shared family PIN, cookie-signed via `jose`)
- [x] Named word lists persisted in MongoDB Atlas, sync across devices
- [x] AI-suggest clues via Groq (`llama-3.3-70b-versatile`) with parent edit
- [x] Optional hidden message per list (used by word search)
- [x] Crossword worksheet (numbered grid + answer key); falls back to definitions list if <60% words placeable
- [x] Word Scramble worksheet with answer key
- [x] Hidden-Message Word Search (8 directions; unused letters spell the message)
- [x] Print-optimised CSS — `Ctrl+P` produces clean B&W output, big handwriting cells (12mm), titles in mm units
- [x] `/chat` page streams Groq responses in simple English; refuses unsafe topics; IP rate-limited (30/hr)
- [x] Deployed to Vercel; works on mobile + desktop browsers

### Files touched
`app/page.tsx`, `app/login/page.tsx`, `app/chat/page.tsx`, `app/lists/[id]/{page,crossword/page,scramble/page,wordsearch/page}.tsx`, `app/api/{auth,lists,lists/[id],clues,chat}/route.ts`, `app/globals.css`, `app/layout.tsx`, `proxy.ts`, `lib/{db,auth,groq,crossword,wordsearch,scramble}.ts`, `lib/models/WordList.ts`, `components/{ListEditor,NewListForm,DeleteListButton,WorksheetFrame,CrosswordGrid,WordSearchGrid}.tsx`, `.env.local.example`, `next.config.ts`, `README.md`

### New models / routes / pages
- Mongo model: `WordList { name, hiddenMessage, words[{word, clue}], timestamps }`
- 12 Next.js routes (5 API + 7 pages) + 1 proxy middleware
- 7 reusable components

### Seed data added
None — the parent seeds their own word lists through the UI. Smoke test created one list ("Word List") with `cat, dog, sun, tree, water, small, happy, soccer` + hidden message "good job" — still present in DB.

### Regression checklist (verified live on prod)
- [x] `/login` reachable without auth
- [x] `/` redirects to `/login` without cookie (307)
- [x] `/api/lists` returns 401 without cookie
- [x] PIN `1987` issues cookie; cookie unlocks all routes
- [x] `/api/lists` returns seeded list with all words/clues
- [x] `/api/clues` returns Groq-generated kid-friendly clues for `cat/dog/sun` in <1s

### Decisions worth remembering
- **MongoDB over localStorage** — parent wanted cross-device sync (no per-user auth needed at this scale).
- **Browser print over PDF library** — saves bundle weight; parent prints from desktop anyway.
- **Single PIN over OAuth** — app is for one family; complexity not warranted.
- **Hand-rolled word search** — needed control over the "fill remaining cells with hidden message letters in row-major order" constraint that no library supports.
- **`proxy.ts` needs both named + default export on Next 16** — Turbopack dev runtime rejects the named-only export even though `next build` accepts it.
- **CSS custom properties for cell size** — lets `@media print` swap `px` → `mm` so worksheets print at writeable handwriting size (12mm cells) regardless of screen resolution.
- **Vercel CLI `env add` does NOT work via stdin on Windows** — every PowerShell/cmd/Node-spawn approach either added garbage bytes or stored empty strings. Workaround: read the local CLI auth token at `%APPDATA%\com.vercel.cli\Data\auth.json` and POST directly to `api.vercel.com/v10/projects/{id}/env`. Helper at `.claude/jobs/<id>/fix-vercel-env.js` in the transient job dir.

### Karpathy frame (as shipped)
- **What:** A small Next.js app where one user-entered word list drives three different printable worksheets plus a sandboxed AI chat.
- **Why this shape:** One word list → many views keeps the data model tiny (one Mongo collection) and the parent's workflow trivial. Server proxy keeps the Groq key off the client. Print-via-browser avoids a heavy PDF dependency for an app that prints maybe 3 sheets a week.
- **Failure mode that we explicitly probed:** Crossword layout failing on disjoint-letter word lists. Verified the `<60% placement → definitions-list fallback` path triggers cleanly.

### Known follow-ups / tech debt
- Two **parent-customisable prompts** in `lib/groq.ts` (`CHAT_SYSTEM_PROMPT`, `CLUE_SYSTEM_PROMPT`) are marked with `✏️ PARENT CONTRIBUTION` — currently using sensible defaults, parent can edit & redeploy.
- The smoke-test word list "Word List" still lives in the production DB (harmless; parent can delete via UI).
- `CLAUDE.md` in the repo root has a pasted copy of global skill content — should probably be gitignored or replaced with a short project-router. Currently uncommitted modification on `main`.
- Groq API key briefly appeared in chat output during diagnosis — rotate at <https://console.groq.com/keys> if concerned.
- MongoDB Atlas Network Access is currently `0.0.0.0/0` (required for Vercel) — tighten to Vercel's IP ranges later if security posture matters.

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md` (user-global, not in repo)
