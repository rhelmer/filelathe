# Filelathe

**Live:** [filelathe.com](https://filelathe.com)

Drop a file or paste a URL and get a floating window with the right tool — media players, editors, inspectors, or a freshly invented mini-app for formats nothing else handles.

Dual-model idea: **Jev** decides and composes; **Haiku** invents Specs when the format is unknown. Hosted as a **Vite SPA + Vercel serverless APIs**.

Source: [github.com/rhelmer/filelathe](https://github.com/rhelmer/filelathe)

Demo capture for social clips: `pnpm demo:capture` (`scripts/social-media/capture-filelathe-demo.mjs`).

## Quick start

```bash
cp .env.example .env
# set TYPESAFE_API_KEY and ANTHROPIC_API_KEY
pnpm install
pnpm dev
```

Open the printed local URL (default port `5174`).

| Variable | Used for |
| --- | --- |
| `TYPESAFE_API_KEY` | Jev (preferred). Or `AI_GATEWAY_API_KEY` / `JEV_AI_GATEWAY_API_KEY` via Vercel AI Gateway. |
| `ANTHROPIC_API_KEY` | Claude Haiku invents Specs for unknown files. Without it, invent falls back to a host-built Spec. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared rate limits on Vercel (Upstash). Optional locally — falls back to in-memory limits. |

## Deploy on Vercel

1. Push the repo and import the project in Vercel (framework: Vite / `vercel.json`).
2. Set env vars: `TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY`, plus Upstash Redis (Vercel → Integrations → Upstash, or paste REST URL/token).
3. Deploy. Static UI builds to `dist/`; APIs live in `api/` (`compose`, `invent-viewer`, `fetch-resource`) with `maxDuration` up to 300s for invent/compose.

```bash
pnpm build   # vite build → dist/
vercel       # or connect the Git repo in the dashboard
```

### Rate limits

Sliding windows (per client IP), invent tightest:

| Endpoint | Limit |
| --- | --- |
| `/api/invent-viewer` | 10 / hour |
| `/api/compose` | 60 / hour |
| `/api/fetch-resource` | 30 / hour |

Exceeded calls return `429` + `Retry-After`; the UI shows a toast. Missing Jev keys return `503` (`model_unavailable`). Haiku downtime uses a fallback Spec and a warning toast.

## How it works

```
drop / URL
    │
    ▼
detect FileKind (image, pdf, csv, tracker, archive, … or unknown)
    │
    ├─ archive (zip/gzip/tar + odt/docx/xlsx/pptx/epub) → ArchiveBrowser
    │        (list entries, peek document text, click-to-open an entry;
    │         container bytes stay client-side, never sent to Jev)
    │
    ├─ known kind ──────────► Jev composes a Spec from catalog candidates
    │
    └─ unknown
           │
           ├─ player registry hit (available) → dedicated player path
           ├─ player registry hit (planned)   → BinaryInspector (never invent an emulator)
           └─ otherwise
                  │
                  ▼
             Jev: invent vs inspect
                  │
                  ├─ inspect → BinaryInspector
                  └─ invent  → Haiku invents a catalog Spec
                                    │
                                    └─ cache in IndexedDB for next drop
```

Each open file becomes a floating window (drag, resize, minimize, maximize, pop-out). The window chrome is host UI; the body is a [json-render](https://github.com/vercel-labs/json-render) Spec rendered through the local catalog/registry.

## Jev vs Haiku

| | **Jev** (TypeSafe System One) | **Haiku** (Claude Haiku 4.5) |
| --- | --- | --- |
| **Role** | Judgment + composition | Generation |
| **API** | `@typesafe-ai/sdk` → `jev-latest` (or Gateway `typesafe-ai/jev`) | `@ai-sdk/anthropic` → `claude-haiku-4-5-20251001` |
| **Where** | `evaluator.ts`, `route-unknown.ts`, `compose-lib.ts` | `invent-viewer.ts`, `invent-prompt.ts` |
| **Returns** | Typed choices (and confidence), used to pick layout candidates | Free-form text parsed into a json-render Spec |

### Jev does two jobs

1. **Route unknowns** (`route-unknown.ts`) — When detection cannot classify the file and no host player applies, Jev chooses `invent` (readable text/config that benefits from a mini-app) vs `inspect` (opaque binary / ROM / archive). Player-registry matches are decided in code first; Jev is only asked for invent vs inspect. If the TypeSafe call fails, a heuristic falls back.

2. **Compose known-file UIs** (`compose-lib.ts`) — For classified kinds (image, audio, CSV, PDF, …), `experimental_composeSpec` walks catalog candidates. Jev answers choice questions at each step so the Spec tree stays small and typed. Tracker module bytes stay out of this path (see storage below).

Jev never invents emulators or writes Spec JSON for unknowns. That separation is intentional: System One is for decisions code can trust; Spec invention is generative.

### Haiku invents Specs

When routing says `invent`, the server asks Haiku for a Spec that only uses the **invent catalog** (layout + text chrome — no media/host wrappers). The prompt includes format-specific hints and few-shot SpecStream examples (`invent-prompt.ts` / `invent-catalog.ts`).

Output is parsed, validated against the invent catalog, and checked by a **quality gate** (rejects “poster” Specs: Card→Markdown dumps without Tabs/Textarea). Failures get **one repair pass**; if still invalid (or Haiku is down / missing key), a host **fallback** Spec is used: Tabs Text|Hex (or Hex|Notes) with real sample/hex in `state` — still interactive, not a crash.

Users can edit the invent prompt in `InventedViewer` and re-run Haiku via `/api/invent-viewer`. Offline checks: `pnpm invent-smoke`.

### Fallbacks (quick map)

| Failure | What you get |
| --- | --- |
| No / bad `ANTHROPIC_API_KEY`, Haiku HTTP error | Invent **fallback** mini-app (Tabs + Textarea) + warning toast |
| Haiku output unparseable / fails catalog or quality gate | One repair; then invent **fallback** |
| No / bad Jev key on **compose** (known files) | Hardcoded `buildFallbackComposeSpec` for that kind |
| Jev invent-vs-inspect routing fails | Heuristic (text-ish → invent, opaque → inspect) |

## Where data is stored

Nothing is uploaded to a durable backend. Files live in the browser (and briefly in the API function for compose/invent).

| Store | What | Lifetime |
| --- | --- | --- |
| **IndexedDB** `jev-invented-specs` | Haiku-invented Specs (+ prompt), keyed by content hash and by extension+MIME | Persists in this browser until cleared (“Clear saved Specs” in the UI) |
| **In-memory `Map`** (`module-store.ts`) | Tracker module `ArrayBuffer`s | Current page session only — never sent to Jev/compose |
| **In-memory `Map`** (`archive-store.ts`) | Archive container `ArrayBuffer`s | Current page session only — never sent to Jev/compose (persisted in IndexedDB like trackers) |
| **React state** (`App.tsx`) | Open windows, geometry, Specs | Until refresh / close |
| **API request** | Bodies for `/api/compose`, `/api/invent-viewer`, `/api/fetch-resource` | Ephemeral; no disk write of user files |
| **Upstash Redis** | Rate-limit counters | TTL ≈ window length |
| **`.env` / Vercel env** | API keys | Not committed |

### Invented Spec cache

On a successful Haiku invent, the client writes two IndexedDB records (`sandbox-store.ts`):

- **content** — SHA-256 of sample text (or hex preview) → exact reuse for the same payload  
- **extension** — `ext:{ext}:{mime}` → template reuse for similar files  

Only Specs with `inventedBy: "haiku"` are reused from cache (not fallbacks). Planned emulator formats never reuse invent cache; they always inspect.

### What is not stored

- No cloud blob store, DB, or multi-user sync  
- Dropped file bytes are not persisted after the window closes (except tracker modules in the session Map, and Spec JSON in IndexedDB — not the original file)  
- Remote URLs are fetched server-side once; the response is treated like a drop

## Project map

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Drop/URL UI, windows, IndexedDB cache lookup/save |
| `src/dev-server.ts` | Local Vite + same API handlers as Vercel |
| `src/api-entries/` | Thin Vercel route entries (source for esbuild) |
| `api/*.js` | Bundled serverless routes (committed — Vercel discovers them before build) |
| `src/server/` | Shared handlers, Upstash/memory rate limits |
| `src/files.ts` | Kind detection, samples, hex preview |
| `src/archive.ts` | Archive sniff (zip/gzip/tar), unzip/gunzip/untar, package peek, XML→text |
| `src/archive-store.ts` | Session Map of archive bytes + click-to-open opener (client-only) |
| `src/ArchiveBrowser.tsx` | Entry listing, extracted text, click-to-open, container hex |
| `src/players.ts` | Host player / emulator registry (available vs planned) |
| `src/route-unknown.ts` | Jev invent vs inspect |
| `src/compose-lib.ts` | Orchestrates route → invent or Jev compose |
| `src/evaluator.ts` | TypeSafe / Gateway Jev evaluator |
| `src/invent-viewer.ts` | Haiku Spec invention, repair, quality gate, fallback |
| `src/invent-catalog.ts` | Slim component set for invent prompts |
| `src/invent-quality.ts` | Reject poster Specs |
| `src/invent-prompt.ts` | Format hints + few-shots + repair prompt |
| `src/catalog.ts` / `registry.tsx` | Full json-render components (compose + render) |
| `src/sandbox-store.ts` | IndexedDB Spec cache |
| `src/module-store.ts` | Session tracker bytes |
| `src/toast.tsx` | Error / rate-limit / model-unavailable toasts |
| `src/SavedSpecsPanel.tsx` | List local Haiku Specs; download or propose PR |
| `src/contrib-scrub.ts` | Strip file samples/hex from Specs before public contrib |
| `contrib/invented/` | Target path for community Spec contributions (contents redacted on export) |

## Scripts

```bash
pnpm dev              # local API + Vite on PORT (default 5174)
pnpm build            # Vite production build → dist/
pnpm check-types      # tsc --noEmit
pnpm list-candidates  # dump compose candidates
pnpm file-smoke       # smoke compose against sample files (needs .env)
pnpm invent-smoke     # offline invent quality / fallback / scrub checks
```
