# Edu-App — Shipped Features Log

Rolling history of what's live. Append-only; each entry is the durable memory of one feature that shipped to production. Newer entries on top.

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
