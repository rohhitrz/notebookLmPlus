# Curio

**Get curious. Go deep.**

Curio turns any topic into a guided course. Name what you want to learn and it
researches the web, builds an ordered roadmap of chapters sized to the topic's
breadth, then teaches each one as a cited lesson — full of worked examples and
runnable code — with its own AI tutor. Ask the goal too broadly ("learn about
the whole world") and it hands back focus options to pick from instead of a
shallow answer.

You can also bring your own material. Feed it PDFs, plain text, web pages,
YouTube videos, or VTT transcripts — each source is extracted, chunked,
embedded, and stored in a per-notebook vector index. Ask questions in natural
language and get answers where **every claim is cited and clickable**: a
citation jumps a PDF to the right page, a YouTube video to the right timestamp,
or highlights the exact passage in a transcript. Every notebook is an isolated
knowledge base.

The two modes:

- **Learning projects** (the headline) — a goal becomes a web-grounded roadmap
  with per-chapter difficulty and time estimates. Each chapter streams in as it's
  written, is dense with worked examples and runnable code, and gets its own
  scoped tutor chat that stays strictly on-topic (so the model never has to hold
  a whole subject in one context window).
- **Notebooks** — your own documents, plus a **Studio** that generates a two-host
  AI podcast (male/female voices) narrating your sources, and dense PowerPoint
  decks up to 30 slides, built batch-by-batch with fresh retrieval per batch.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI); Inter for UI, Source Serif 4 for lesson prose |
| Auth | [Clerk](https://clerk.com) (`clerkMiddleware` in `proxy.ts` protects all app + API routes) |
| Database | Supabase Postgres + [pgvector](https://github.com/pgvector/pgvector) (HNSW, cosine) via [Drizzle ORM](https://orm.drizzle.team) |
| Storage | Supabase Storage (`sources`, `artifacts` buckets) |
| LLM / embeddings / TTS / moderation | OpenAI (single provider, all calls go through `lib/llm.ts`) |
| Web search | [Tavily](https://tavily.com) — grounds every generated lesson chapter |
| Ingest | LangChain loaders + custom splitter; `unpdf`, `@mozilla/readability`, `youtubei.js` |
| Podcast audio | OpenAI TTS + `ffmpeg` (bundled via `ffmpeg-static`) |

## Architecture

```
Source ──▶ extract ──▶ chunk ──▶ embed (OpenAI, 768-dim) ──▶ pgvector
                                                                 │
Question ──▶ standalone-rewrite ──▶ vector search ──▶ LLM rerank ┘
          ──▶ grounded answer with [n] citations ──▶ click ──▶ jump to page / timestamp / passage
```

Key design rules (see [`CLAUDE.md`](CLAUDE.md) for the full list):

- Every vector query filters by `notebook_id`; ownership is enforced by the
  notebook's `user_id`. Other users' resources return **404**, never 403.
- Retrieved source text is treated as **data, not instructions** — chunks are
  wrapped in quoted blocks and the model is told to ignore instructions inside
  them.
- Every assistant answer carries citations mapped to chunk IDs. The only
  citation-free answer allowed is the explicit "not found in your sources".
- Embeddings are locked to **768 dimensions** to match the pgvector column;
  changing the model/dimension requires re-embedding every chunk.
- Long-running work (indexing, podcast, PPTX) runs async — the request returns
  immediately and the UI polls a status endpoint.

## Security

Defence in depth, since every route touches user data and paid APIs:

- **Auth on every path.** `clerkMiddleware` (`proxy.ts`) calls `auth.protect()` on
  everything except `/sign-in` and `/sign-up`; each route handler *also* calls
  `requireUser()` rather than trusting the middleware alone.
- **Ownership, not just authentication.** `lib/db/queries.ts` resolves each
  notebook, source, chunk, chat, and artifact through its owning `user_id` and
  throws `NotFoundError` on a mismatch — other users' resources return **404**,
  never 403, so IDs aren't enumerable.
- **SSRF protection on URL ingest.** Adding a `url` source makes the server fetch
  a user-supplied address, so `lib/net/safe-fetch.ts` allows only `http(s)`,
  resolves the hostname and rejects private, loopback, link-local, CGNAT,
  multicast, and reserved ranges (v4 and v6, including IPv4-mapped), re-validates
  **every redirect hop**, and caps body size and time. This blocks reads of cloud
  metadata (`169.254.169.254`), `localhost`, and internal hosts. JSDOM parses the
  result with scripts disabled.
- **Prompt injection.** Retrieved chunks and web sources are wrapped as quoted
  DATA with explicit instructions to ignore any commands inside them; the tutor
  prompt additionally refuses to leave its chapter's scope.
- **Parameterized SQL.** Vector search uses Drizzle `sql` templates with bound
  parameters (no string interpolation) and always filters by `notebook_id`.
- **Input validation.** Every route body is Zod-parsed. Uploads are size-capped
  and the storage key's extension comes from a type allowlist, never the
  user-supplied filename.
- **Cost containment.** `lib/rate-limit.ts` throttles the endpoints that spend
  money (chapter build, roadmap, chat, Studio) per user.
  Note: counters are in-memory, so they are per-instance — effective against
  runaway retries, but back it with a shared store (e.g. Upstash Redis) if you
  expose this publicly.
- **Bounded error output.** Only messages we author (via `toPublicMessage`) reach
  the client; third-party error text is logged server-side and replaced with a
  generic message so request/config details can't leak.
- **Secrets.** `.env*` is gitignored and untracked. The Supabase secret key is
  server-only; storage buckets are private and served via short-lived signed URLs.

## Project layout

```
app/                     App Router pages + API route handlers
  api/                   chat, sources, studio (podcast/pptx), learn, artifacts
  notebook/[id]/         notebook workspace (chat + studio)
  learn/[id]/            learning project (roadmap + scoped chats)
lib/
  llm.ts                 the ONLY module that calls OpenAI (chat, JSON, embeddings)
  rag.ts                 retrieval, rerank, prompting, citation parsing
  vectorstore.ts         pgvector search / upsert / delete
  ingest/                extractors (pdf, text, url, youtube, vtt), chunker, pipeline
    potoken.ts           mints a YouTube PO token so caption downloads work
  learn.ts               roadmap generation + scoped teaching context
  chapters.ts            web-grounded lesson streaming (examples-first prompts)
  net/safe-fetch.ts      SSRF-guarded fetch for user-supplied URLs
  rate-limit.ts          per-user throttles on paid endpoints
  studio/                podcast, pptx, tts, summarize, moderation
  db/                    Drizzle schema + queries
components/               notebook, learn, studio, and shared UI
```

## Getting started

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (Postgres + Storage)
- An [OpenAI](https://platform.openai.com) API key
- A [Clerk](https://clerk.com) application

### 2. Supabase setup

Enable pgvector and create the two storage buckets:

```sql
create extension if not exists vector;
```

In the Supabase dashboard, create storage buckets named **`sources`** and
**`artifacts`** (private).

### 3. Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (client) key |
| `SUPABASE_SECRET_KEY` | Supabase secret key — server-only, used for Storage |
| `DATABASE_URL` | Postgres connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_CHAT_MODEL` | Chat / structured-output / rerank model |
| `OPENAI_EMBED_MODEL` | Embedding model (used at 768 dims) |
| `OPENAI_TTS_MODEL` | Podcast text-to-speech model |
| `OPENAI_MODERATION_MODEL` | Moderation model for generated content |
| `TAVILY_API_KEY` | Web search that grounds generated lesson chapters — **required** for learning projects |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk auth |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |

Deploying to Vercel? Set all of these in **Settings → Environment Variables** and
redeploy — new variables don't apply to existing deployments.

### 4. Install, migrate, run

```bash
npm install
npm run db:push      # apply the Drizzle schema to your database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (must pass with zero TS errors) |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:push` | Push the schema directly to the database |

## Notes

- **YouTube captions** require a proof-of-origin (PO) token; without one YouTube
  returns an empty caption body. `lib/ingest/potoken.ts` mints one locally via
  BotGuard and caches it — the first YouTube ingest after a server start takes a
  few extra seconds, subsequent ones reuse the cached session.
- **Podcast generation** shells out to a bundled `ffmpeg` binary to concatenate
  per-turn audio; no system ffmpeg install is required.
