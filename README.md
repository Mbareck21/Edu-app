# Edu-App

A small, printable English-vocabulary practice app for a 9-year-old learner, plus a kid-safe AI chat playground. Built with Next.js 16, Tailwind v4, Mongoose (MongoDB Atlas), and Groq.

## Features

- **Word lists** — create named lists (e.g. "Week 1 — Animals"), add vocabulary words with optional clues.
- **AI clue generation** — click "AI suggest clues" and Groq writes Grade-3-friendly definitions you can edit.
- **Three printable worksheets per list**, regenerated server-side on every visit:
  - **Crossword** with numbered clues + answer key
  - **Word Scramble** with answer key
  - **Hidden-Message Word Search** (find the words; unused letters spell a bonus message)
- **AI chat playground** at `/chat` — streamed Groq responses, simple-English system prompt, IP rate-limited.
- **Single PIN auth** — one cookie-signed PIN guards every page (good enough for one family).
- **Print-optimised CSS** — `Ctrl+P` produces clean B&W output with the answer key on page 2.

## Local development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local — see "Environment variables" below
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

See `.env.local.example`. Four required:

| Var | Where to get it |
|---|---|
| `MONGODB_URI` | <https://cloud.mongodb.com> → cluster → Connect |
| `GROQ_API_KEY` | <https://console.groq.com/keys> (free tier is plenty) |
| `PARENT_PIN`  | A 4–6 digit PIN your family will use to sign in |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

## Deploy to Vercel

```bash
npx vercel login
npx vercel link
# Push every variable from .env.local to all environments:
npx vercel env add MONGODB_URI
npx vercel env add GROQ_API_KEY
npx vercel env add PARENT_PIN
npx vercel env add AUTH_SECRET
npx vercel --prod
```

**One Atlas gotcha:** in MongoDB Atlas, go to **Network Access** and add `0.0.0.0/0` (or Vercel's IP ranges) so the deployed app can connect.

## Where you (the parent) can customise

Two prose blocks in `lib/groq.ts` are flagged with `✏️ PARENT CONTRIBUTION` comments:

1. **Tutor personality** (`CHAT_SYSTEM_PROMPT`) — how the AI talks to your son.
2. **Clue-writing style** (`CLUE_SYSTEM_PROMPT`) — definition / behavioural / fill-the-blank / synonym.

Edit those strings, redeploy, done.

## File layout

```
app/
  page.tsx                          # Home: word-list overview
  login/page.tsx                    # PIN entry
  lists/[id]/page.tsx               # Edit a list
  lists/[id]/{crossword,scramble,wordsearch}/page.tsx   # Print-ready worksheets
  chat/page.tsx                     # AI chat
  api/auth/route.ts                 # POST PIN, set signed cookie
  api/lists/route.ts                # GET, POST
  api/lists/[id]/route.ts           # GET, PATCH, DELETE
  api/clues/route.ts                # POST { words[] } → { clues[] }
  api/chat/route.ts                 # POST streaming, Groq proxy
lib/
  db.ts                             # Mongoose connect (cached)
  auth.ts                           # PIN cookie helpers (jose)
  groq.ts                           # Groq client + parent-customisable prompts
  crossword.ts                      # Layout wrapper + fallback logic
  wordsearch.ts                     # Hidden-message generator
  scramble.ts                       # Fisher-Yates scramble
  models/WordList.ts                # Mongoose schema
components/
  ListEditor.tsx                    # Word & clue table + AI buttons
  CrosswordGrid.tsx                 # Worksheet grid
  WordSearchGrid.tsx
  WorksheetFrame.tsx                # Print container
  NewListForm.tsx
  DeleteListButton.tsx
proxy.ts                            # PIN gate (Next 16 proxy middleware)
```
