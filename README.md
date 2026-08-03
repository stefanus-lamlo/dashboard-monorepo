# Dashboard Monorepo Template

A minimal full-stack dashboard template.

- `apps/web` — React + Vite + TypeScript dashboard UI, with tabs for: the
  dashboard itself (stat cards, visitors line chart, revenue-by-category bar
  chart cross-filtering a searchable/sortable orders table with CSV export, a
  2025-vs-2026 monthly sales comparison); an AI image generator; a Documents
  summarizer (paste/type text, or bring one over from the Audio tab, into a
  structured minutes-of-meeting summary exported as PPTX/PDF); a standalone
  Audio transcriber (Bahasa Indonesia meeting recordings → editable transcript,
  with a one-click handoff into Documents); and a TOR/KAK-to-flowchart
  generator (paste a Kerangka Acuan Kerja / Terms of Reference document, get a
  rendered Mermaid flowchart of its stages, decisions, and deliverables).
- `apps/api` — Express + TypeScript REST API (in-memory mock data, plus
  OpenAI-backed image generation, audio transcription, document summarization,
  and TOR/KAK flowchart generation endpoints, and PPTX/PDF export built with
  pptxgenjs/pdfkit)
- `packages/shared` — TypeScript types shared between web and api

## Getting started

```bash
npm install
npm run dev
```

This starts the API on http://localhost:4000 and the web app on http://localhost:5173
(Vite proxies `/api` requests to the API server). Open http://localhost:5173.

### Image generator

The "Image generator" tab calls OpenAI's image API. To enable it:

```bash
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env and set OPENAI_API_KEY
```

Restart `npm run dev:api` (or `npm run dev`) after adding the key. Without a key,
the tab still works but shows an error explaining the key is missing.

`gpt-image-1` (the default model) additionally requires your OpenAI organization
to complete ID verification — until then every request 403s with
`Project ... does not have access to model 'gpt-image-1'`, and the tab surfaces
that error as-is. Verify at platform.openai.com under Settings → Organization →
Verifications, or check `openai models list` under your key for another
image-capable model you already have access to and set `OPENAI_IMAGE_MODEL` to
that instead.

### Documents (summarize + export)

The "Documents" tab paste-in-text → Summarize flow uses the same `OPENAI_API_KEY`,
but calls a chat model (`OPENAI_TEXT_MODEL`, defaults to `gpt-4.1-mini`) instead of
an image model. Same story as above: if your key's project doesn't have that
model enabled, you'll get a clear 403/400 in the UI — check `GET
https://api.openai.com/v1/models` with your key to see what you actually have
access to and set `OPENAI_TEXT_MODEL` accordingly. PPTX/PDF export don't call
OpenAI at all (they just format whatever summary is already on screen), so those
two buttons work even before summarization is unblocked.

### Audio transcription

Its own tab and its own route (`apps/api/src/routes/audio.ts`, mounted at
`/api/audio`) — not part of Documents. Upload a recording and it's transcribed,
forced to Bahasa Indonesia, via `OPENAI_TRANSCRIBE_MODEL` (defaults to
`gpt-transcribe`). Natively-supported formats (flac/m4a/mp3/mp4/mpeg/mpga/oga/
ogg/wav/webm) upload as-is; anything else — or anything over OpenAI's 25MB
transcription cap — is transcoded/compressed to a small mono mp3 first using a
bundled ffmpeg binary (`ffmpeg-static`, no system install required). Browser
upload cap is a generous 300MB to accommodate long raw recordings.

The resulting transcript is editable in place, and "Summarize in Documents"
hands it off to the Documents tab (switches tabs and pre-fills its text box) —
the two stay separate modules/routes, this is just a UX convenience.

### TOR / Kerangka Acuan Kerja → flowchart

The "TOR flowchart" tab (`apps/api/src/routes/flowchart.ts`, mounted at
`/api/flowchart`) reads a TOR/KAK document with the same `OPENAI_TEXT_MODEL`
chat model as Documents, and asks it to return a Mermaid `flowchart` definition
of the process (stages, deliverables, approval/decision points) via structured
JSON output. The frontend renders that definition client-side with `mermaid`
(lazy-loaded, only the flowchart renderer chunk loads). If the model produces
invalid Mermaid syntax, the diagram render is caught and falls back to showing
the raw definition and a plain-text stage list instead of a blank card.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run api + web together |
| `npm run dev:api` | Run only the API (watch mode) |
| `npm run dev:web` | Run only the web app |
| `npm run build` | Build shared, api, and web for production |
| `npm run start:api` | Run the built API (`npm run build` first) |

## Adding a new stat or chart

1. Add the type to `packages/shared/src/index.ts`.
2. Return it from `apps/api/src/data.ts` and `apps/api/src/routes/dashboard.ts`.
3. Consume it in `apps/web/src/App.tsx` and render it with a new/existing component
   in `apps/web/src/components`.
