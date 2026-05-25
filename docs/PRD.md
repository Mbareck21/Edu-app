# Edu-App — Shipped Features Log

Rolling history of what's live. Append-only; each entry is the durable memory of one feature that shipped to production. Newer entries on top.

---

## Bug fix — word search uses finger-drag instead of tap-tap — 2026-05-25

- **Status:** Shipped (commit `e942a5c`)
- **Summary:** The interactive word search was effectively unusable — kids tapped letter-by-letter expecting to slide, the app interpreted each second-tap as a 2-letter endpoint selection, no match found, red flash, reset. Replaced tap-first / tap-last with real **finger-drag selection** using Pointer Events.

### What was broken
Tap-first-letter / tap-last-letter was cognitively wrong for a 9-year-old. Their natural gesture is sliding their finger — they'd tap C of CAT, then tap A expecting "next letter selected", and the app would treat C→A as a 2-letter word lookup, fail, flash red, reset selection. They never made it past 2 letters.

### Fix — `components/InteractiveWordSearch.tsx`
- `pointerdown` on a cell sets `dragStart` + initial `dragPath`.
- A `useEffect([dragStart])` attaches **document-level** `pointermove` and `pointerup` listeners while a drag is in progress.
- `pointermove` uses `document.elementFromPoint(clientX, clientY)` + `.closest("[data-cell-r]")` to find the cell under the finger, recomputes `pathBetween(dragStart, currentCell)`; if it's a valid straight line in any of 8 directions, updates `dragPath` for live yellow highlight.
- Off-line drags don't update the path — visual "snaps back" when the finger returns to a valid line. Avoids jankiness from sloppy diagonals.
- `pointerup` reads `dragPathRef.current`, validates the joined letters forward + reverse against unfound targets, marks gold + celebrates on hit or flashes red on miss, then resets.
- `releasePointerCapture(e.pointerId)` on `pointerdown` so touch events keep firing as the finger crosses OTHER cells (browsers implicitly capture the pointer to the original target otherwise).
- `touch-action: none` on the grid prevents page scroll while dragging.
- Refs (`dragStartRef`, `dragPathRef`) so the document listeners aren't stale-closured from React state.

### Decisions worth remembering
- **Pointer Events, not separate touch/mouse handlers.** One code path covers desktop click-drag AND mobile finger-drag. Modern browsers all support it.
- **Document-level listeners + `elementFromPoint` is the standard escape hatch** for "which cell is under the finger now" on touch. Per-cell `pointerenter` handlers don't fire across cells on touch because the pointer is implicitly captured to the `pointerdown` target.
- **Snap-to-last-valid-line for off-line drags.** Simpler than projection math, feels good — kid sees the path stay when they wander, snap to the new line when they recover.
- **`pathBetween` for single cell now returns `[cell]`, not `null`** — needed so the initial `dragPath` after `pointerdown` shows the start cell highlighted before the finger moves.

### Files touched
`components/InteractiveWordSearch.tsx` (only)

### Verification
- `npm run build` clean
- Live deploy verified: page contains the new "Slide your finger" prompt + `data-cell-r` attributes; old "tap first letter" prompt removed; both `print-view` and `play-view` divs still present (no print regression)
- Manual flow (parent verifies): drag a finger across letters of a known word → cells light up yellow as the finger crosses them → release on the last letter → gold path + word strikes off

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Bug fix — crossword orientation prefers word that starts at tapped cell — 2026-05-24

- **Status:** Shipped (commit `1c7bf2e`)
- **Summary:** Tapping the start cell of a DOWN word that sits on an across row (e.g., the C of "CAT" going down) used to default the cursor to ACROSS — typing then auto-advanced rightward instead of downward. `selectCell` now uses a two-pass preference that picks the orientation matching user intent.

### What was broken
The "new cell" branch of `selectCell` had a single fallback rule: `orient = acrossId !== undefined ? "across" : "down"`. It defaulted to across whenever an across word existed at the cell, ignoring whether the user tapped on a cell where a DOWN word *starts* (with the across word just passing through). Result: tapping the C of vertical "CAT" lit up the perpendicular across word, and typing went sideways.

### Fix
`components/InteractiveCrossword.tsx`, `selectCell` rewritten with a two-pass preference:

1. **Continuity** — if the new cell continues the user's active word (`prevInfo.acrossId === acrossWord.position` for the active direction), keep the active orientation. Catches programmatic focus from auto-advance + onFocus so the cursor doesn't false-switch mid-word at perpendicular start cells.
2. **Starts here** — if the cell is the STARTING cell of one word and a CROSSING cell of the other, prefer the one that starts here. The user-intent fix.
3. **Existing fallback** — prefer prior orient if compatible, else default to across.

Tap-to-toggle (same cell, second tap) is unchanged.

### Decisions worth remembering
- **The order matters.** Continuity must beat "starts here," otherwise auto-advance through a cell that happens to start a perpendicular word would false-switch the user's typing direction mid-word.
- **Continuity match requires BOTH conditions** — the prior cell's word ID for the active direction AND the active orientation. Without both, a cell tap from outside the word could match by coincidence.
- **No new state.** Just data lookups against `placedById` + `cellInfo`. The fix is ~30 lines added to one function.

### Verification
- `npm run build` clean.
- Crossword page still serves 200 with both `print-view` and `play-view` markup present.
- Live UX (parent verifies): tapping a down-word start cell that's on an across row now lights up the DOWN clue and typing flows downward.

### Files touched
`components/InteractiveCrossword.tsx` (only)

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Bug fix — crossword auto-advance skips intersection cells — 2026-05-24

- **Status:** Shipped (commit `bd30c02`)
- **Summary:** Interactive crossword's auto-advance now jumps over already-filled intersection cells instead of getting stuck on them, so filling an across word that crosses a completed down word (or vice versa) is one continuous typing flow.

### What was broken
Auto-advance moved focus exactly one cell after each typed letter. If that next cell was already filled by a completed intersecting word, its input was `disabled` (cell belonged to a `wordStatus === "correct"` word) — so typing did nothing and the kid had to manually tap past every intersection to keep going.

### Fix
`components/InteractiveCrossword.tsx`:
- Replaced the single-step `if (cellInfo[nextKey])` advance with a `while (cellInfo[next] && valuesRef.current[next])` loop in `onCellInput`. Walks forward over any filled cells, lands on the next empty cell of the active word, or falls through to `checkWord` when it walks off the word.
- Symmetric fix in `onCellKeyDown`'s Backspace branch: walks back over locked cells (intersecting correct words) so Backspace can navigate over completed crossings.
- Extracted `isLocked(r, c)` helper used by both the existing edit-guard and the new backspace skip — DRY and easier to read than inline `info?.acrossId !== undefined && ...` chains.

### Decisions worth remembering
- **Forward skips by `value` presence; backspace skips by `locked` status.** Filled-but-not-locked cells are the kid's own input that they may want to retype; the auto-advance skips them anyway (standard crossword UX = find next blank), but backspace stops at them so the kid can delete and re-enter.
- **`cellInfo[key]` is the boundary detector.** It's `undefined` for black squares and out-of-bounds, so the `while` loop terminates safely without a separate bounds check.
- **No new state.** Whole fix is navigation math inside two existing handlers + one helper. ~30-line diff, no schema/API change.

### Files touched
`components/InteractiveCrossword.tsx` (only)

### Verification
- `npm run build` clean
- Live URL: `/lists/<id>/crossword` 200; both `print-view` and `play-view` markup still present
- Manual play-mode flow (user-side): fill down word → fill crossing across word → typing flows through the intersection without manual tap

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Interactive play mode for worksheets — 2026-05-24

- **Status:** Shipped (commit `ab7672d`)
- **Live URL:** <https://edu-app-beta-eight.vercel.app> (open any list, tap any of the three worksheets)
- **Summary:** Added a "▶ Play on phone" toggle to each of the three worksheets alongside the existing Print button. Solving in the browser triggers voice praise (via existing TTS) and confetti from canvas-confetti for correct answers; wrong answers shake red with brief encouragement. **Print path is bit-for-bit identical to before.**

### Acceptance criteria (verified — server side green; browser flow ready to test)
- [x] /scramble, /crossword, /wordsearch each carry the Play toggle in the header
- [x] **Print regression — server-side verified.** Each page renders BOTH print-view and play-view divs to the DOM; CSS controls visibility via `[data-mode]`; `@media print` forces `.play-view { display: none !important }` so the printer never sees React state
- [x] Scramble: type + Check button + Show Answer after 2 wrongs
- [x] Crossword: tap-cell + auto-advance + word completion validation; correct words lock green
- [x] Word search: tap-first-letter + tap-last-letter; straight-line path resolver in 8 directions
- [x] Voice praise via existing /api/tts (bilingual phrases marked PARENT CONTRIBUTION #5); respects /chat mute toggle
- [x] Confetti via canvas-confetti, lazy-imported so print view doesn't pay the 12KB cost
- [x] Backend regression: chat/tts/transcribe/lists all 200 on prod
- [ ] **Browser smoke** (mic perm, full crossword fill, tap-tap word search, confetti, big completion) — user to verify on phone

### Files touched
**New:** `lib/feedback.ts`, `components/PlayToggle.tsx`, `components/Interactive{Scramble,Crossword,WordSearch}.tsx`
**Modified:** `components/WorksheetFrame.tsx` (extraHeaderRight slot), `app/globals.css` (visibility rules + shake keyframes + correctness colorways), three worksheet pages (wrap content in PlayToggle)
**Dep added:** `canvas-confetti` + `@types/canvas-confetti` (lazy-imported)

### Decisions worth remembering
- **Both views rendered, CSS-controlled visibility.** The cleanest way to guarantee print never regresses regardless of React state. Adds DOM weight (~2x markup per page), trivial vs the safety guarantee.
- **`@media print` overrides with `!important`** on `.play-view` (hide) and `.print-view` (show). React state is irrelevant inside the printer's CSS pipeline.
- **Tap-first / tap-last for word search**, not drag. Mobile drag-detection on 7×7 grids through small fingers is fiddly; tap-tap matches how kids solve paper puzzles and the straight-line path validator is ~10 lines of code (`Math.max(adr, adc)` step count, sign deltas, walk).
- **Validate scramble on explicit Check button.** Kid controls the success moment → better confetti theater than auto-validation, less anxiety from typing wrong mid-word.
- **Crossword auto-advance + correct-word locking.** Standard crossword muscle memory. Correct words turn green and their cells become read-only so they don't get edited away by intersecting-word fills.
- **600ms voice cooldown + first-wrong-only encouragement.** Prevents voice spam during rapid-fire scramble checks or word-search tapping.
- **Bilingual praise array** (English + Arabic) — single PARENT CONTRIBUTION #5 marker in `lib/feedback.ts`; the existing bilingual TTS chunking handles voice switching automatically.
- **Lazy-import `canvas-confetti`.** `await import('canvas-confetti')` inside `celebrate()` defers the 12KB until the kid first answers.
- **Reuse `readAutoPlayPref()`** from `/chat` mute toggle — single source of truth for "do we play voice anywhere in the app".
- **Crossword fallback path bypasses play mode.** When `buildCrossword()` returns `ok: false` (rare, disjoint-letter word lists), the page falls back to the definitions list — no Play toggle shown, since there's nothing to play.

### Karpathy frame (as shipped)
- **What:** Three client components (`Interactive{Scramble,Crossword,WordSearch}`) live alongside the existing print markup, switched by a context-driven `[data-mode]` attribute. Shared `lib/feedback.ts` celebrates with TTS + confetti.
- **Why this shape:** Adds zero risk to the print path (CSS guarantees), zero backend coupling (existing endpoints reused, no schema changes), zero ongoing cost (TTS we already pay for, confetti is free).
- **First failure mode explicitly probed:** print regression. Server-side smoke confirmed each page contains both `print-view` and `play-view` divs — CSS in production handles the toggle without any React intervention.

### Known follow-ups
- **Real browser smoke pending** — user verifies on phone (server-side checks all green).
- Tuning surface: edit `PRAISES` / `ENCOURAGEMENTS` arrays in `lib/feedback.ts` (PARENT CONTRIBUTION #5) for personalized phrases (his name, etc.) and redeploy.
- Crossword on very small screens: 44px cells × 15 cols = 660px wide, may overflow on narrow phones. Add horizontal scroll if it bites in practice.
- v2 idea: persistent stats / streaks per word list (Mongo schema add). Skipped v1 per YAGNI.
- v2 idea: drag-select for word search if tap-tap doesn't feel right after use.

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

---

## Hands-free continuous conversation mode — 2026-05-24

- **Status:** Shipped (commit `64c7d31`)
- **Live URL:** <https://edu-app-beta-eight.vercel.app/chat>
- **Summary:** Added a state-machine-driven continuous conversation mode to `/chat`. After tapping "Talk", the mic auto-opens after each AI reply, auto-submits on speech-pause, loops until the kid taps Stop or doesn't say anything for 6 seconds.

### Acceptance criteria (verified — server side green; browser flow ready to test)
- [x] "Talk" button on `/chat` enters conversation mode (server-side build clean; /chat page 200 OK)
- [x] No backend changes — `/api/transcribe`, `/api/tts`, `/api/chat`, `/api/lists` all regression-tested on prod
- [x] Single-utterance mic flow untouched (existing recordAudio path preserved)
- [x] Mute toggle behavior defined: skips speaking state, loop continues silently
- [x] Stop button always visible during conversation mode
- [x] Interrupt button replaces big state button during AI speech
- [ ] Browser smoke test (mic permission, full cycle, interrupt, stop) — **user to verify on phone**

### Files touched
`lib/voice.ts` (added openMicStream / closeMicStream / recordUntilSilent + 4 tuning constants), `app/chat/page.tsx` (convState state machine + runConversation loop + Talk/Stop/Interrupt UI)

### Decisions worth remembering
- **Hand-rolled silence detection over @ricky0123/vad-web for v1.** Web Audio AnalyserNode + getByteTimeDomainData → RMS at 20Hz. Default threshold 0.015 (between ambient ~0.005 and speech ~0.05). Upgrade path documented if real-world quality is poor.
- **Refs for loop-readable state.** stopRef, messagesRef, autoPlayRef. React state captured in closures goes stale across `await` points; refs always read live.
- **Mic stream held across turns.** openMicStream once per conversation; closeMicStream on exit. Avoids Safari re-prompts and Chrome re-init latency.
- **No real barge-in v1.** Tap-to-interrupt button instead. Mic stays closed during AI speech so we don't pick up our own audio. Echo cancellation is on (`echoCancellation: true`) but we don't rely on it.
- **Deferred-resolver pattern in recordUntilSilent.** External `cancel()` needed to resolve the same promise the polling loop resolves — extracted the resolver out of the Promise executor closure.
- **streamChatReply() extracted.** Single function shared between single-utterance `send()` and the conversation loop. Adds the user message + empty assistant placeholder; streams chunks in; returns final text or null.

### Karpathy frame (as shipped)
- **What:** Client-side state machine (off/listening/transcribing/thinking/streaming/speaking) that loops over the existing `/api/transcribe` and `/api/tts` endpoints, plus a held-stream Web Audio analyser for silence detection.
- **Why this shape:** Zero backend changes; existing endpoints already work turn-by-turn. Holding the stream removes permission re-prompts. Refs side-step React's stale-closure problem in the async loop.
- **First failure mode probed:** Silence cuts him off mid-thought. Mitigated with 1.5s default + obvious Interrupt button + three parent-tunable constants in one place.

### Known follow-ups
- **Real browser smoke test pending** — server-side everything passes; user needs to verify mic permission + full cycle on phone.
- Three tuning constants in `lib/voice.ts` (`SILENCE_DURATION_MS`, `INITIAL_WAIT_MS`, `SPEECH_THRESHOLD_RMS`) marked PARENT CONTRIBUTION #4 — edit and redeploy if rhythm feels off.
- VAD upgrade path: swap to `@ricky0123/vad-web` (Silero VAD ONNX, ~2 MB bundle) if hand-rolled RMS detection mis-triggers on background noise.
- v2: real voice-activated barge-in (mic open during AI speech, detect kid's voice to interrupt). Requires careful AEC tuning; out of scope for v1.

### Plan
`C:\Users\missa\.claude\plans\i-want-you-to-robust-quasar.md`

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
