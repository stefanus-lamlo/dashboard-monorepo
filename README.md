# Dashboard Monorepo

A full-stack dashboard template: a React/Vite frontend and an Express API in
an npm-workspaces monorepo, covering a classic analytics dashboard plus six
OpenAI-backed tools (image generation/editing, document summarization, audio
transcription, TOR/KAK-to-flowchart, and a learning-plan generator).

Started as a minimal template and grew one feature at a time; this doc
reflects where it actually landed, including the rough edges.

## Contents

- [What's inside](#whats-inside)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Modules](#modules)
- [Scripts](#scripts)
- [Production notes](#production-notes)
- [Known limitations & future improvements](#known-limitations--future-improvements)
- [Extending the template](#extending-the-template)
- [Troubleshooting](#troubleshooting)

## What's inside

- **Dashboard** — stat cards, a visitors line chart, a revenue-by-category bar
  chart that cross-filters a searchable/sortable orders table (with CSV
  export), and a 2025-vs-2026 monthly sales comparison. All mock data,
  generated deterministically server-side — no external API calls.
- **Image generator** — text-to-image, and image-to-image editing (upload a
  photo + a prompt, e.g. "ghibli style", get it transformed).
- **Documents** — paste or type a document/meeting transcript, get a
  structured minutes-of-meeting summary, export as PPTX or PDF.
- **Audio** — upload a meeting recording (Bahasa Indonesia), get an editable
  transcript, with a one-click handoff into Documents.
- **TOR flowchart** — paste a Kerangka Acuan Kerja / Terms of Reference
  document, get a rendered flowchart of its stages, decisions, and
  deliverables.
- **Learning path** — type any topic (a skill, a technical subject, a
  physical goal, anything), get a staged pipeline diagram, milestones per
  stage, and concrete materials/resources.

The last five all call OpenAI and need your own API key — see
[Environment variables](#environment-variables). The dashboard needs nothing.

## Architecture

```
apps/web        React 18 + Vite + TypeScript. One component per tab (App.tsx
                 switches between them). Talks to the API via fetch() at
                 relative /api/* paths - Vite's dev server proxies those to
                 the API (see apps/web/vite.config.ts).

apps/api         Express + TypeScript, ESM (NodeNext). One router per feature
                 area under src/routes/, mounted in src/index.ts. Shared
                 cross-cutting bits (OpenAI client, upload error handling,
                 rate limiting) live in src/lib/.

packages/shared  TypeScript types for every request/response shape, imported
                 by both apps/web and apps/api so the wire contract can't
                 silently drift between them.
```

Nothing is persisted anywhere — dashboard data is generated fresh per
request, and every other module's output lives only in browser `useState`
until you navigate away or reload.

## Prerequisites

- Node.js **18.18+** (uses `node:fs/promises`, native ESM, and other modern
  APIs throughout; not tested on earlier versions)
- npm 9+ (for workspaces)
- An OpenAI API key, if you want the five AI-backed tabs to actually work
- `ffmpeg`/`ffprobe` are **not** required on your system — the audio module
  bundles its own via `ffmpeg-static`

## Getting started

```bash
npm install
npm run dev
```

This starts the API on http://localhost:4000 and the web app on
http://localhost:5173 (Vite proxies `/api/*` to the API). Open
http://localhost:5173 — the Dashboard tab works immediately with no setup.

To enable the AI tabs:

```bash
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env and set OPENAI_API_KEY
```

Restart the API (`npm run dev:api`, or the whole `npm run dev`) after
changing `.env` — it's only read at process startup. Without a key, the AI
tabs still render normally and show a clear "OPENAI_API_KEY is not set" error
when you try to use them, rather than failing silently.

## Environment variables

All read by `apps/api` (from `apps/api/.env`; see `apps/api/.env.example`
for the same list with inline comments):

| Variable | Default | Notes |
|---|---|---|
| `OPENAI_API_KEY` | *(none)* | Required for every AI tab. Get one at platform.openai.com. |
| `PORT` | `4000` | API port. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` | Image generate/edit. `gpt-image-*` models need org ID verification — see [Troubleshooting](#troubleshooting). |
| `OPENAI_TEXT_MODEL` | `gpt-4.1-mini` | Chat model for Documents, TOR flowchart, and Learning path. |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-transcribe` | Audio transcription model. |
| `CORS_ORIGIN` | *(unset → any origin)* | Restrict this in production — see [Production notes](#production-notes). |
| `AI_RATE_LIMIT_WINDOW_MINUTES` | `15` | Rate-limit window for the 5 OpenAI-backed route groups. |
| `AI_RATE_LIMIT_MAX` | `20` | Max requests per IP per window, for those same routes. |

Every model default can be wrong for your account/org — none of the "correct"
model names are guaranteed stable across OpenAI accounts or over time. If
something 403s or 400s with a model-access error, that's expected the first
time; the fix is always the same shape: check what your key actually has
access to and override the relevant `OPENAI_*_MODEL` variable (details in
[Troubleshooting](#troubleshooting)).

## Modules

### Dashboard

No external dependencies. `apps/api/src/data.ts` generates stats/visitors/
revenue/orders/monthly-sales deterministically (seeded, not random) so the
same date range always looks the same across reloads. Clicking a bar in the
revenue chart cross-filters the orders table by category.

### Image generator (`/api/images`)

- `POST /generate` — text-to-image via `openai.images.generate`.
- `POST /edit` — image-to-image via `openai.images.edit`. Upload a photo (the
  "Or upload a photo to transform" control) and the prompt applies to it
  instead of generating from scratch. Only jpeg/png/webp input is accepted
  (OpenAI's own restriction), 25MB upload cap (matches OpenAI's edit
  endpoint). Results render as a before/after pair — the "before" image is
  the browser's own local copy of what you uploaded, not sent back by the
  server (see [Production notes](#production-notes) for why that matters).

### Documents (`/api/documents`)

`POST /summarize` sends your text to `OPENAI_TEXT_MODEL` with a strict JSON
schema response format, so the output always matches the `DocumentSummary`
shape exactly (title, overview, key points, decisions, action items with
owners) — no fragile free-text parsing. `POST /export/pptx` and
`POST /export/pdf` just format whatever summary is already on screen; they
never call OpenAI, so both work even if summarization itself is blocked on a
model-access issue.

### Audio (`/api/audio`)

Its own tab and route — not part of Documents. `POST /transcribe` accepts a
file upload, forces `language: "id"` (Bahasa Indonesia), and:

- Uploads formats OpenAI's API accepts natively (flac/m4a/mp3/mp4/mpeg/mpga/
  oga/ogg/wav/webm) as-is.
- Transcodes anything else — or anything over OpenAI's 25MB transcription
  cap — to a small mono mp3 first, using a bundled ffmpeg binary
  (`ffmpeg-static`, no system install needed). Browser upload cap is a
  generous 300MB to accommodate long raw recordings; the server does the work
  of shrinking them to fit.

The resulting transcript is editable in place. "Summarize in Documents"
hands it to the Documents tab (switches tabs, pre-fills its text box) — a UX
convenience, not a code dependency; the two stay separate modules/routes.

### TOR flowchart (`/api/flowchart`)

Reads a TOR/KAK document with `OPENAI_TEXT_MODEL` and asks for a Mermaid
`flowchart` definition of the process (stages, deliverables, approval/
decision points) via the same structured-JSON-output pattern as Documents.
Rendered client-side with `mermaid` (dynamically imported — only the
flowchart-renderer chunk actually loads at runtime, not the whole library's
diagram-type zoo). If the model ever produces invalid Mermaid syntax, the
render is caught and falls back to the raw definition plus a plain-text
stage list instead of a blank card.

### Learning path (`/api/learning`)

Same structured-output pattern again, applied to "turn any topic into a
learning plan": an overview, a Mermaid pipeline diagram of the stages, and
per-stage milestones plus concrete materials (the model is instructed to
name real, specific resources — actual book titles, apps, tools, equipment —
not generic placeholders). Same Mermaid rendering as TOR flowchart; both
share one hook (`apps/web/src/hooks/useMermaidRender.ts`) rather than
duplicating the init/render/error-fallback logic per component.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run api + web together |
| `npm run dev:api` | Run only the API (watch mode) |
| `npm run dev:web` | Run only the web app |
| `npm run build` | Build shared, api, and web for production |
| `npm run start:api` | Run the built API (`npm run build` first) |

There's no root "start web in production" script — see [Production
notes](#production-notes) on why that's a real gap, not an oversight.

## Production notes

This started as a template and picked up real features; it has **not** been
hardened the way a public-facing production service would need. Concretely,
before you'd want to put this in front of real traffic:

- **No authentication, anywhere.** Every route, including the five that call
  paid OpenAI endpoints, is open to anyone who can reach the API. A basic
  per-IP rate limit is applied to those five (`AI_RATE_LIMIT_*`, default 20
  requests / 15 min) purely as a blunt safety net against runaway bugs or
  casual abuse — it is not real abuse prevention (rotating IPs/proxies defeat
  it trivially) and there's still no way to attribute usage to a user. Add
  real auth before this is public.
- **CORS defaults to allowing any origin.** Fine for local dev; set
  `CORS_ORIGIN` to your actual web app's origin before deploying anywhere
  reachable from the internet.
- **No static file serving for the built web app.** `npm run build` produces
  `apps/web/dist`, but nothing in this repo serves it — `apps/web`'s
  `preview` script (`vite preview`) is a dev-adjacent convenience, not a
  production web server. You need to either serve `apps/web/dist` from a
  static host/CDN (pointed at your deployed API's URL) or add static-file
  middleware to the Express app yourself.
- **Two known transitive dependency vulnerabilities**, both requiring a
  breaking change to fully clear (checked via `npm audit`, both currently
  low real-world exposure here):
  - `esbuild`/`vite` (dev-server only; doesn't affect production build
    output). Fixing requires Vite 5→8, a real breaking jump across this
    whole app's build tooling.
  - `image-size` (via `pptxgenjs`): a DoS in ICNS/JXL/HEIF parsing. This app
    never feeds user-uploaded images into `pptxgenjs` (PPTX slides are built
    from LLM-generated text/shapes/tables only), so the vulnerable code path
    is never exercised here — but it's still present in `node_modules`.
    Fixing requires downgrading `pptxgenjs` to 1.1.5, which would remove the
    widescreen layout/shapes/table APIs this app's PPTX export actually uses.
- **No request logging or monitoring.** `console.error` on failures is the
  entire observability story right now.
- **No persistence, anywhere** — this is a design choice for a demo/template
  more than a gap, but worth stating: restart the API or reload the page and
  every generated image/summary/transcript/flowchart/plan is gone.

None of this is hard to add — it's just not done, and shipping this as-is to
a public URL without at least auth + CORS lockdown would be a mistake.

## Known limitations & future improvements

- **State is lost on tab switch.** Each tab component is only mounted while
  its tab is active (`App.tsx` conditionally renders one at a time), so e.g.
  generating three images then clicking over to Documents and back loses
  them. Fixing this cleanly means lifting each module's state up to `App.tsx`
  (or a keep-alive/portal pattern) — bigger than the one-off fix it looks
  like, since it'd touch every module.
- **No tests.** Everything in this repo has been verified by hand (curl +
  Playwright, in-session) rather than with an automated suite. There's no
  test runner configured at all yet.
- **Long-running audio/document jobs are request/response, not job-based.**
  A very long meeting recording or a huge document blocks the HTTP request
  for the duration of the OpenAI call. Fine for the scale this was built for;
  a real "process a 3-hour meeting" feature would want a job queue.
- **No chunking for oversized transcripts/documents.** `express.json({limit:
  "2mb"})` caps request bodies; a document longer than that is rejected
  outright rather than split and summarized in pieces.
- **Mermaid diagrams aren't theme-aware.** They render on a fixed white
  background regardless of the app's light/dark mode, by design (matches how
  many docs sites embed diagrams) — but a truly polished version would sync
  Mermaid's theme variables to the app's CSS variables.
- **PPTX/PDF export has no manual editing step.** What the model returns is
  what gets exported — there's no intermediate "review and tweak the
  summary before exporting" UI.

## Extending the template

Adding a new dashboard stat or chart:

1. Add the type to `packages/shared/src/index.ts`.
2. Return it from `apps/api/src/data.ts` and `apps/api/src/routes/dashboard.ts`.
3. Consume it in `apps/web/src/App.tsx` and render it with a new/existing
   component in `apps/web/src/components`.

Adding a new OpenAI-backed module: follow the shape every existing one uses —
a router in `apps/api/src/routes/`, using `getOpenAIClient()` from
`apps/api/src/lib/openaiClient.ts` and (for text generation) the
`response_format: { type: "json_schema", ... }` structured-output pattern
from `documents.ts`/`flowchart.ts`/`learning.ts`, mounted in
`apps/api/src/index.ts` behind `aiRateLimiter` alongside the other five, with
matching types in `packages/shared` and a component + tab in `apps/web`.

## Troubleshooting

**"OPENAI_API_KEY is not set"** — you haven't created `apps/api/.env` yet, or
haven't restarted the API since adding the key (env vars are only read at
process startup).

**403 "Project ... does not have access to model 'X'"** (images or
transcription) — `gpt-image-*` models specifically require your OpenAI
organization to complete ID verification, even if the model shows up in your
account's model list. Verify at platform.openai.com under Settings →
Organization → Verifications, or find a model you already have access to via
`GET https://api.openai.com/v1/models` (with your key) and override
`OPENAI_IMAGE_MODEL`/`OPENAI_TRANSCRIBE_MODEL`.

**400 "The model 'X' does not exist"** — the model's been renamed or
deprecated since this README was written (this has already happened once
mid-project — `dall-e-3` was removed from the API entirely). Same fix: check
`/v1/models` for what's actually available to your key and update the env
var.

**A chat-backed tab (Documents/TOR flowchart/Learning path) 403s/400s** —
same root cause as above, but for `OPENAI_TEXT_MODEL` instead. Check
`/v1/models` and override it.

**Generic 502 "Failed to ..."** from any AI tab — the underlying OpenAI call
failed; the error message forwarded into the response body is OpenAI's own,
so it usually says exactly what went wrong (bad request shape, rate limit,
content policy, etc.) — check `apps/api`'s terminal output too, since the
same message is also logged there via `console.error`.
