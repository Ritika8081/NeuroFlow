# NeuroFlow Lab — Design Documents

This directory holds the engineering design for NeuroFlow Lab.

| Doc | What it covers | Read if you… |
|---|---|---|
| [`GUIDE.md`](./GUIDE.md) | User walkthrough, common workflows, file formats, FAQ | are about to use the app and want to know what every tab does |
| [`HLD.md`](./HLD.md) | System architecture, data flow, tech stack, subsystems, non-functional requirements, roadmap | want to understand the big picture, evaluate the project, or decide whether to contribute |
| [`LLD.md`](./LLD.md) | Module-by-module design, types, algorithms, wire formats, extension points | are about to write or change code |

## Top design decisions, briefly

| # | Decision | Why |
|---|---|---|
| 1 | **Local-first** — recording bytes never leave the user's machine | Privacy + research data sensitivity. Backend runs on `localhost`. |
| 2 | **Bring-your-own AI** — keys live in browser localStorage only | We never hold user keys. Users can pick from 6 free providers or self-host (Ollama). |
| 3 | **Single analysis bundle** — every view reads from `runAnalysis()` output, never recomputes | One memoized recompute per recording change. Predictable performance. |
| 4 | **Pure libs, dumb components** — `lib/*.ts` is React-free and unit-testable | Algorithms can be benchmarked / fuzz-tested in isolation. |
| 5 | **Backend stays thin** — only does what JS can't do well (EDF/BDF parsing, scipy `filtfilt`) | Most analytics run in the browser; backend can be replaced or self-hosted. |
| 6 | **Deterministic NL parsing first, LLM second** — `parsePipelineRequest()` runs before any LLM call | Cheap, predictable, no API cost for routine commands like "clean for sleep, notch 60". |
| 7 | **Reproducibility manifest is a first-class output** | Every analysis exports a `neuroflow-manifest/0.1` JSON + runnable MNE/EEGLAB/FieldTrip code. |
| 8 | **One accent color** — refined violet via CSS variables, no rainbow gradients | Calm scientific aesthetic. Theme-switchable with one variable change. |
| 9 | **Heuristics over heavy ML for v0.x** — sleep staging, cognitive state, FAA are all rule-based | Ships today; foundation-model integrations (LaBraM, U-Sleep) on the roadmap. |
| 10 | **No external state library** — `useState` + `useMemo` + Context | Workspace is single-page. Reach for Zustand/Redux only when justified by cross-route state needs. |

## Quick start for new contributors

1. Read [`HLD.md`](./HLD.md) §1–§3 (~10 min).
2. Skim [`LLD.md`](./LLD.md) §1 (repo layout) + §2 (types).
3. Pick an extension point from `LLD.md` §9.
4. `cd nextjs-app && npm install && npm run dev`.
5. `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`.
6. Open `http://localhost:3000`, drop a `.csv` (text formats parse client-only — no backend needed for first try).

## Conventions reminder

- TS strict mode on; `tsc --noEmit` must pass before any commit.
- Pure libs in `src/lib/`; React only in `src/components/` and `src/app/`.
- Colors via `rgb(var(--token))`; no raw hex except in SVG attrs.
- Memoize anything that touches the analysis bundle.
- Async UI = `busy` state + disabled buttons + visible feedback.
- New AI provider = entry in `ai-providers.ts`; format already supported in 5 of 9 cases.
