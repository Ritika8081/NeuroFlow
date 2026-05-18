# NeuroFlow Lab — High-Level Design

**Status**: Living document
**Audience**: Engineers, contributors, reviewers
**Repository**: `neuroflow-lab` (Next.js 15 + FastAPI)

---

## 1. Product overview

NeuroFlow Lab is a **local-first, browser-native EEG analysis workspace**. The user drops a recording (EDF / BDF / CSV / MAT / JSON / TSV), the system parses it locally, applies a context-aware filter chain, and exposes the recording through a suite of analytical views (frequency-domain, time-frequency, topographic, connectivity, sleep staging, AI-generated insights). Every analysis is fully reproducible — a JSON manifest plus auto-generated MNE/EEGLAB/FieldTrip code can replay any session.

### Pillars (non-negotiable)

| Pillar | What it means in practice |
|---|---|
| **Local-first** | Recording bytes never leave the user's machine. Backend runs on `localhost`. AI keys live in `localStorage`. No telemetry. |
| **Bring-your-own AI** | The user supplies their own LLM key (free or paid). NeuroFlow Lab never pays for compute. |
| **Browser-native analysis** | All visualization, DSP analytics, and AI orchestration happen in the browser. The Python backend is a thin pre-processing engine, not a data steward. |
| **Reproducibility** | Every recording → manifest + code. Anyone can replay any analysis byte-for-byte. |
| **Pain-point driven** | Features map to documented pain points across 7 personas (PhD students, faculty, clinicians, BCI engineers, consumer/QS, undergrads, ML engineers). |

### Target users (from research, prioritized)

1. PhD students / postdocs — escape manual ICA-labeling tedium
2. Faculty running cohort studies — need batch QC
3. Clinical neurophysiologists — sleep / qEEG / triage
4. BCI engineers — real-time + offline parity
5. Consumer / quantified-self — Muse / Emotiv / Neurosity raw access
6. Undergrad / new learners — in-context tutoring
7. Data scientists entering EEG — clean tensor pipelines

---

## 2. System architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App (React 19, Tailwind v4, Chart.js, react-chartjs-2) │  │
│  │                                                                    │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────────┐   │  │
│  │  │ Pages    │→ │  Page State  │→ │  Workspace Sidebar (19 tabs)│   │  │
│  │  │ (RSC+CSR)│  │  (useState)  │  └─────────────────────────────┘   │  │
│  │  └──────────┘  └──────────────┘                                    │  │
│  │                       │                                            │  │
│  │   ┌───────────────────┼───────────────────────────────┐            │  │
│  │   │ Client-side libs (pure TS, run on browser thread) │            │  │
│  │   │  • DSP (FFT, Welch PSD, spectrogram, statistics) │            │  │
│  │   │  • Insights (cog-state classifier, asymmetry)    │            │  │
│  │   │  • Sleep staging (heuristic AASM)                │            │  │
│  │   │  • Connectivity (Pearson + α-coherence)          │            │  │
│  │   │  • Autoclean (recipe builder)                    │            │  │
│  │   │  • Recommendations (rule engine)                 │            │  │
│  │   │  • Report builder (HTML + JSON manifest)         │            │  │
│  │   │  • Assistant intent parser (NL pipeline)         │            │  │
│  │   └───────────────────┬───────────────────────────────┘            │  │
│  │                       │                                            │  │
│  │   ┌───────────────────▼──────────┐   ┌─────────────────────────┐   │  │
│  │   │ Backend client (REST/JSON)   │   │ LLM client (multi-prov.)│   │  │
│  │   │  fetch http://localhost:8000 │   │ fetch provider endpoints│   │  │
│  │   └─────────┬────────────────────┘   └────────────┬────────────┘   │  │
│  └─────────────┼─────────────────────────────────────┼────────────────┘  │
└────────────────┼─────────────────────────────────────┼───────────────────┘
                 │                                     │
                 ▼                                     ▼
   ┌─────────────────────────┐         ┌──────────────────────────────────┐
   │  FastAPI backend        │         │  External LLM providers (BYOK)   │
   │  (localhost:8000)       │         │  • Groq, Gemini, OpenRouter      │
   │  • /upload  /parse      │         │  • Mistral, Together, HF         │
   │  • /clean (Butterworth) │         │  • Ollama (self-hosted)          │
   │  • /health              │         │  • OpenAI, Anthropic (paid)      │
   │  • mne, scipy, numpy    │         │  CORS-direct from browser        │
   └─────────────────────────┘         └──────────────────────────────────┘
```

### 2.1 Layer responsibilities

| Layer | Responsibility | Boundary |
|---|---|---|
| **UI (React components)** | Presentation, user input, orchestration of state | Never does DSP or makes provider calls directly — delegates to libs |
| **Client libs (`src/lib/*`)** | Pure functions: DSP, classifiers, insight generation, LLM orchestration | No React imports. Deterministic where possible. |
| **Backend** | Heavy file parsing (EDF/MAT) and Butterworth filtering. Stateless. | One process, localhost only. Does not persist anything. |
| **LLM providers** | Optional, BYOK. Browser calls them directly. | Each provider format normalized through `ai-client.ts`. |

### 2.2 Why this split

- **Heavy file IO (EDF) requires MNE-Python.** Re-implementing EDF reading in JS is bug-prone; we delegate to MNE.
- **Live filter response (sub-second)** needs sciPy's `filtfilt` for zero-phase filters with stable padding behavior. Re-implementing in JS would degrade quality.
- **Everything else can run client-side.** FFT, band powers, classifiers, topomaps, spectrograms — all our DSP is small enough for a browser thread (<100 ms for a 10s, 16ch recording).
- **AI calls from the browser** mean **NeuroFlow Lab never holds user keys**. The user's key only ever exists in their browser's localStorage and the provider's logs.

---

## 3. Data flow

### 3.1 Happy path: drop file → workspace

```
1.  User drops a file
    └─ <input type="file">  →  page.tsx state: { file }

2a. If extension ∈ {csv, tsv, txt, json}:
    └─ FileReader → parseTextEEG()      [client only, no backend]
       → { channels, sampling_rate, channel_names, data, preview, client_parsed: true }

2b. Otherwise (edf, bdf, mat):
    POST /upload         (multipart/form-data)
    └─ backend stores tmp file, returns { tmp_path }
    POST /parse          ({ tmp_path })
    └─ backend reads via MNE / scipy, returns { channels, sampling_rate, ..., data }

3.  Set uploadResult (server source of truth, server-side raw signal)

4.  POST /clean          ({ data, bandpass_low, ..., notch_freq })
    └─ backend applies Butterworth chain, returns { cleaned_data }
       (client_parsed/synthetic data: skipped — cleaned_data = raw data)

5.  Set cleanedResult; UI flips `showCleaned = true`

6.  Derived (memoized, client-side):
    • runAnalysis(data, channels, fs)         →  AnalysisBundle
    • assistantContext = { analysis, ... }    →  passed to AI Assistant
    • SIDEBAR_ITEMS built from analysis state

7.  User clicks a tab → views read from same analysis bundle
```

### 3.2 Live filter editing

```
filter input change
  → setState (e.g. setNotchFreq(60))
  → debouncedClean(partialPatch)   // 450ms debounce
  → POST /clean with new params
  → setCleanedResult
  → analysis bundle recomputes (memoized)
  → all views (PSD, topomap, ...) re-render
```

### 3.3 Auto-clean

```
User clicks "Run auto-clean"
  → autoClean({ data, channelNames, sampleRate, useCase })  [pure JS]
  → returns AutoCleanRecipe { filter chain + bad channels + rationale }
  → UI displays recipe with rationale; user clicks Apply
  → setBandpassLow/High/Notch/HP/LP → debouncedClean()
```

### 3.4 AI Assistant message

```
User types question
  → parsePipelineRequest(q) — deterministic regex/intent
    ├─ match? apply filters + reply (no LLM needed)
    └─ else continue

  → if activeProvider === "local":
       reply = ask(q, ctx)   // local heuristic
     else:
       callLLM(config, {system: ASSISTANT_SYSTEM + recordingContextBlock(ctx), messages})
       reply = result.text

  → append to chat history
```

### 3.5 Reports & code generation

```
Report tab:
  buildHTMLReport(input)   → self-contained HTML blob → download
  buildManifest(input)     → JSON-LD-ish manifest → download
  AIProseReport.generate() → LLM writes a narrative section
  AICodeGen.generate()     → LLM writes MNE / EEGLAB / FieldTrip script
```

---

## 4. Tech stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 15 (App Router) | RSC for static pages (About, Docs, Help); client components for the workspace. Single deployable. |
| UI runtime | React 19 | Concurrent rendering; first-class server components. |
| Styling | Tailwind v4 + CSS variables | Single-token design system; light/dark with CSS variables. No styled-components / emotion. |
| Charts | Chart.js + react-chartjs-2 | Canvas-based; handles thousands of points smoothly. Plugin: chartjs-plugin-zoom. |
| Type system | TypeScript strict | Catches integration bugs at the lib boundary. |
| Backend | FastAPI (Python 3.11) | Async-first; auto-generates OpenAPI; trivially fits in `localhost`. |
| Backend DSP | MNE-Python + scipy.signal | Industry standard for EEG; Butterworth `filtfilt` is the right zero-phase filter. |
| State | React `useState` + `useMemo` + `useRef` | Workspace is single-page; no Redux/Zustand needed. |
| Storage | `localStorage` only | Session history, AI config, custom templates. Never PII or recording bytes. |

---

## 5. Subsystems

### 5.1 Pre-processing (backend)

- Reads EDF / BDF / MAT / CSV
- Applies in order: band-pass → high-pass → low-pass → notch → baseline correction
- All filters: 4th order Butterworth via `scipy.signal.butter` + `filtfilt` (zero-phase)
- Skips filtering for signals shorter than padlen (returns warning)

### 5.2 Client-side DSP (`src/lib/dsp.ts`, 578 LOC)

Implements:
- Iterative Cooley-Tukey FFT (real input, magnitude output)
- Welch PSD (Hann window, configurable overlap)
- Band-power integration (trapezoidal over PSD)
- Spectrogram (STFT with overlap)
- Channel statistics (mean, std, kurtosis, ptp, rms)
- Artifact detection (amplitude, line-noise, muscle, blink, flat)
- Quality score (composite of 4 sub-scores)
- Cognitive state classifier (6 states from band ratios)
- Frontal alpha asymmetry (FAA)

Reference: every algorithm is grounded in a citable paper (see LLD §3.1).

### 5.3 Analysis bundle (`src/lib/insights.ts`)

Single entry point `runAnalysis(data, channelNames, sampleRate) → AnalysisBundle` that:
1. Computes per-channel band powers + average
2. Estimates individual alpha peak (over posterior channels)
3. Classifies cognitive state
4. Runs artifact detection + quality scoring
5. Computes frontal alpha asymmetry (if F3/F4 or equiv present)
6. Emits a list of structured `Finding`s with severity tags

All visualization tabs consume this single bundle. **No tab re-runs DSP.**

### 5.4 Automation layer

| Module | Purpose |
|---|---|
| `autoclean.ts` | Inspects mains noise, channel health, paradigm → emits filter recipe + bad-channel list + rationale. |
| `recommendations.ts` | Rule engine: given current filters + analysis, emits actionable suggestions with one-click apply. |
| `templates.ts` | Save / load / import / export pipeline templates. 6 built-ins + user customs. |

### 5.5 Specialized analyses

| Module | Algorithm | Output |
|---|---|---|
| `sleep.ts` | AASM-style heuristic on Cz/C3/C4 + spindle (σ-band burst) + K-complex (large biphasic) detection | Hypnogram, stage percentages, event counts |
| `connectivity.ts` | Pearson on raw signals + α-band-power coherence proxy | n×n matrix + ranked pairs |

### 5.6 AI orchestration (`src/lib/ai-*.ts`)

- `ai-providers.ts` — Registry of 9 providers + models (Groq, Gemini, OpenRouter, Mistral, Ollama, OpenAI, Anthropic, Together, Hugging Face).
- `ai-client.ts` — `callLLM(config, opts)` normalizes 5 wire formats: OpenAI-compat, Anthropic, Gemini, Ollama, HuggingFace.
- `ai-config.ts` — localStorage-backed provider config (per-provider key/model/baseUrl).
- `ai-prompts.ts` — System prompts + `recordingContextBlock()` that grounds the LLM in the user's actual numerical findings.
- `assistant.ts` — Deterministic intent classifier + offline heuristic fallback.

### 5.7 Reproducibility

- `report.ts` — Builds self-contained HTML + JSON manifest with content-hashed-ish provenance.
- `AICodeGen.tsx` — LLM emits MNE / EEGLAB / FieldTrip scripts mirroring the exact pipeline.
- `MethodsWriteup.tsx` — LLM emits journal-style "EEG acquisition and pre-processing" paragraph.

---

## 6. Routes

| Path | Purpose |
|---|---|
| `/` | Lab — upload + workspace |
| `/docs` | Quick documentation |
| `/help` | Full help guide (workflows, troubleshooting, FAQ) |
| `/about` | Mission + features |

All four pages share the same `Navbar` + `Footer` from `layout.tsx`.

---

## 7. Non-functional requirements

| Concern | Target | How achieved |
|---|---|---|
| **Time to first analysis** (drop → workspace) | < 3 s for 16ch / 10s recording | Client-side analysis runs on memoized derived state; no spinners after initial parse |
| **Live filter responsiveness** | < 600 ms after last keystroke | 450ms debounce + backend filter typically < 150 ms |
| **Privacy** | Zero data leaves the user's device unless they invoke an LLM call | Single audit point: `fetch` calls go to `localhost:8000` and configured provider only |
| **Type safety** | `tsc --noEmit` clean | Strict mode on. CI gate. |
| **Bundle size** | < 500 kB JS gzipped | Chart.js is the largest dep. Tree-shaking + dynamic import of zoom plugin. |
| **Mobile / responsive** | Workspace usable down to 375 px | Tabs become horizontal scroll on `<lg`; sidebar collapses |
| **Accessibility** | Keyboard-navigable, ARIA labels on icon buttons | `aria-label` on all icon-only buttons; focus rings via `:focus-visible` |
| **i18n** | English-only for v0.x | Strings are inline; refactor to `t()` is planned post-v1.0 |

---

## 8. Security & privacy

- **No backend persistence.** Tmp files are written by FastAPI and never cleaned up automatically — production deployments must mount tmp on tmpfs or clean on shutdown.
- **API keys never touch our origin.** Stored only in `localStorage`. Sent only from the browser directly to the provider's CORS-allowed endpoint.
- **No telemetry.** Zero analytics. Zero error reporting to remote endpoints.
- **CORS** on backend is `*` because deployment assumes localhost-only. **Production deployments must lock CORS to known origins.**
- **Provider keys are visible to the user.** If a shared device is a concern, use Ollama (no key required) or clear localStorage on logout.

---

## 9. Roadmap (post v0.2)

| Tier | Item | Why |
|---|---|---|
| **Soon** | Cohort QC grid (batch upload) | Faculty pain point #2 |
| **Soon** | BIDS-EEG export + validator | Cohort + reproducibility win |
| **Soon** | ICA + ICLabel-style component review | The single most tedious step in EEG |
| **Soon** | Web Worker for DSP | Keep UI thread responsive on long recordings (>5 min) |
| **Mid** | LSL bridge (real-time ingest) | BCI pain point #4 |
| **Mid** | Foundation-model embeddings (LaBraM / BIOT) | Similarity search across recordings |
| **Mid** | Sleep staging via U-Sleep / YASA | Clinical-grade accuracy |
| **Long** | Federated training (Flower) | Hospitals co-train without sharing PHI |
| **Long** | Plugin SDK | Labs publish custom pipeline nodes |

---

## 10. Open questions / known issues

- Backend tmp-file cleanup is implicit (OS reclaim). Add explicit TTL janitor.
- `parseTextEEG` is heuristic; ambiguous orientation (n_channels ≈ n_samples) can flip the matrix.
- Sleep staging heuristic accuracy on real PSG vs YASA is unbenchmarked.
- Topomap interpolation is simple inverse-distance; a proper spline-on-sphere would be more accurate.
- No tests yet. Adding Vitest + Playwright is in the roadmap.
