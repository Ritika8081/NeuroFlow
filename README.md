# NeuroFlow Lab

> **An open-source, browser-native EEG analysis workspace. Drop a recording, clean it intelligently, and tour your brainwaves through 19 analytical views — frequency, topography, sleep staging, connectivity, components, AI-written reports — without leaving your browser.**

<p align="center">
  <strong>Local-first · Reproducible · BYO AI · 19 workspace views · 9 AI providers</strong>
</p>

---

## Why NeuroFlow Lab?

EEG analysis today is split between heavyweight desktop suites (EEGLAB needs MATLAB, MNE needs Python, Brainstorm is desktop-only) and consumer apps that are black boxes (Persyst, Muse). Nothing covers **"open a link, drop a file, get an analysis"**.

NeuroFlow Lab is that missing tool. It:

- **Stays local.** Recordings parse in your browser or local backend. AI keys live in `localStorage` only. Zero telemetry, no server-side persistence.
- **Brings its own AI.** Pick from 6 free providers (Groq, Gemini, OpenRouter, Mistral, Hugging Face, Ollama) or 3 paid (OpenAI, Anthropic, Together). Keys never touch our origin.
- **Reproduces everything.** Every analysis exports a signed JSON manifest + AI-written MNE-Python / EEGLAB / FieldTrip code. Replay byte-for-byte.
- **Maps to real pain points.** Designed against research from r/neuroscience, MNE GitHub issues, and the EEG-AI workshops at NeurIPS/IEEE. See [the HLD](./docs/HLD.md) for the pain-point analysis.

---

## What you get

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANALYSIS                AUTOMATION             VISUALIZE           │
│  • AI Insights           • Recommendations      • Waveform          │
│  • Quality (0-100)       • Auto-clean           • PSD (Frequency)   │
│  • Band power            • Components (ICA)     • Spectrogram       │
│                          • Templates            • Topographic map   │
│                                                  • Connectivity     │
│                                                                     │
│  SPECIALIZED             INSPECT       AI       REFERENCE  EXPORT   │
│  • Sleep staging         • Annotations • Chat   • Glossary • Report │
│  • Compare (A/B)                       • Lit.            • BIDS-EEG │
│  • Cohort QC                           • Methods                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Highlights

| Feature | What it does |
|---|---|
| **One-click Auto-clean** | Detects mains noise (50/60 Hz), bad channels (variance/kurtosis), and picks paradigm-appropriate filters. Shows full rationale before applying. |
| **AI Assistant (BYO key)** | Chat grounded in your live DSP analysis. Natural-language pipeline control: *"clean for sleep, notch 60"*. |
| **Component review (ICA-style)** | PCA + heuristic labeling of components as brain / eye / muscle / cardiac / line-noise. One-click "remove all eye". |
| **Cohort QC** | Batch-load recordings → grid of per-subject thumbnails, ranked by anomaly score against the cohort median. |
| **Sleep staging** | 30-s epoch hypnogram (W/N1/N2/N3/REM) with spindle and K-complex detection. |
| **Connectivity** | Channel × channel Pearson + magnitude-squared coherence (cross-spectral density), heatmap + ranked pairs. |
| **Topographic mapping** | 10-20 scalp projection per band, with inverse-distance interpolation. |
| **AI-written report** | Self-contained HTML report + reproducibility manifest + AI-written MNE/EEGLAB/FieldTrip code. |
| **BIDS-EEG export** | One click → BIDS-compatible bundle (dataset_description, channels.tsv, eeg.json, events.tsv, eeg.tsv) packed as ZIP. |
| **Natural-language search** | Literature search and methods-paragraph writing, both LLM-powered. |
| **Recommendations engine** | Proactive rule-based suggestions: *"gamma share too high — likely EMG, lower the LP"*. One-click apply. |
| **Pipeline templates** | 6 built-ins (resting / sleep / ERP / motor-imagery BCI / P300 / consumer) + your own. Import/export as JSON. |

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11 (only needed for binary formats: EDF / BDF / MAT)

### 1. Frontend

```bash
cd nextjs-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Backend (optional)

The backend handles EDF / BDF / MAT parsing and Butterworth filtering. Text formats (CSV / TSV / JSON) parse fully in the browser and don't need it.

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on [http://localhost:8000](http://localhost:8000).

### 3. Pick an AI provider (optional)

Click the **AI** pill in the navbar. Recommended free choices:

| Provider | Best for | Sign-up |
|---|---|---|
| **Groq** | Fastest free Llama 3.3 70B / Mixtral / DeepSeek R1 | [console.groq.com/keys](https://console.groq.com/keys) |
| **Google Gemini** | Generous free tier · Gemini 2.0 Flash | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenRouter** | Free tier across many models | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Ollama** | Fully self-hosted, fully private | [ollama.com](https://ollama.com/download) |

Paid: OpenAI (GPT-4o), Anthropic Claude (Opus/Sonnet/Haiku 4.x), Mistral, Together AI, Hugging Face.

### 4. Try it without uploading anything

On the landing page, click **Try a sample** to load one of 5 synthetic recordings (resting / focused / drowsy / artifact-heavy / meditation). Everything works offline — no upload, no backend, no AI needed.

---

## Walkthrough

```bash
# Drop a file or click "Try a sample"
# ↓
# The workspace opens with these tabs in the sidebar:

ANALYSIS           AUTOMATION          VISUALIZE
─ Insights         ─ Recommendations   ─ Waveform
─ Quality          ─ Auto-clean        ─ Frequency
─ Band power       ─ Components (ICA)  ─ Spectrogram
                   ─ Templates         ─ Topography
                                       ─ Connectivity

SPECIALIZED        INSPECT             AI                 EXPORT
─ Sleep staging    ─ Annotations       ─ Assistant        ─ Report
─ Compare                              ─ Literature       ─ BIDS export
─ Cohort QC                            ─ Methods

REFERENCE
─ Glossary
```

For complete workflows (resting state, sleep recording, A/B comparison, artifact triage), see [the in-app **Help** page](./nextjs-app/src/app/help/page.tsx) or [docs/GUIDE.md](./docs/GUIDE.md).

---

## Architecture (at a glance)

```
┌────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                            │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Next.js 15 · React 19 · Tailwind v4                        │  │
│   │   • UI components (workspace, sidebar, 19 tabs)             │  │
│   │   • Pure-TS analysis libs (FFT, PSD, ICA, sleep, ...)       │  │
│   │   • Web Worker for heavy DSP (off main thread)              │  │
│   │   • LLM client (5 wire formats normalized)                  │  │
│   └─────┬─────────────────────────────────────────┬─────────────┘  │
└─────────┼─────────────────────────────────────────┼────────────────┘
          │                                         │
          ▼                                         ▼
   ┌──────────────────┐                  ┌─────────────────────┐
   │  FastAPI         │                  │  Your chosen LLM    │
   │  (localhost only)│                  │  provider (BYO key) │
   │  • MNE-Python    │                  │  Direct browser →   │
   │  • scipy.signal  │                  │  provider call      │
   └──────────────────┘                  └─────────────────────┘
```

See [docs/HLD.md](./docs/HLD.md) and [docs/LLD.md](./docs/LLD.md) for full system design.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 15 (App Router) | RSC for static pages, client for the workspace |
| UI runtime | React 19 + Tailwind v4 | Concurrent rendering; design tokens via CSS variables |
| Charts | Chart.js + chartjs-plugin-zoom | Canvas-based; smooth on thousands of points |
| DSP (client) | Pure TypeScript | Cooley-Tukey FFT, Welch PSD, MSC coherence, PCA via Jacobi eigen |
| Background work | Web Worker | `runAnalysis` off the main thread |
| Backend | FastAPI + MNE-Python + scipy | Industry-standard EDF/BDF/MAT parsing + zero-phase Butterworth |
| AI providers | 9 supported (5 wire formats) | OpenAI-compat, Anthropic, Gemini, Ollama, Hugging Face |
| Testing | Vitest | Unit tests for DSP / insights / autoclean / BIDS |
| CI | GitHub Actions | Type-check + tests + production build on every push |

---

## Project structure

```
neuroflow-lab/
├── README.md                  ← you are here
├── docs/
│   ├── HLD.md                 ← system architecture, data flow
│   ├── LLD.md                 ← module-by-module, types, algorithms
│   ├── GUIDE.md               ← user walkthrough (this and the /help page)
│   └── README.md              ← docs index + top design decisions
├── backend/
│   ├── main.py                ← FastAPI: /upload /parse /clean
│   └── requirements.txt
├── nextjs-app/
│   ├── src/
│   │   ├── app/               ← Next.js pages (Lab, Docs, Help, About)
│   │   ├── components/        ← React (30 files) — 19 workspace views + shell
│   │   ├── lib/               ← Pure TS (17 files) — DSP, classifiers, AI client
│   │   └── workers/           ← Web Worker for off-main-thread analysis
│   ├── tests/                 ← Vitest unit tests (DSP, insights, autoclean, BIDS)
│   ├── vitest.config.ts
│   └── package.json
└── .github/workflows/ci.yml   ← typecheck + tests + production build
```

---

## Running the tests

```bash
cd nextjs-app
npm run typecheck     # strict TypeScript check
npm test              # Vitest unit tests (DSP, insights, autoclean, BIDS)
npm run build         # production build
```

CI runs all three on every PR ([.github/workflows/ci.yml](./.github/workflows/ci.yml)).

---

## Privacy

- **Recordings stay on your device.** The backend runs on `localhost`. Browser-parsed formats (CSV / TSV / JSON) never even leave the browser.
- **AI keys never touch our origin.** They live in `localStorage` and are sent only from your machine, directly to the provider you chose.
- **No telemetry.** No analytics. No server-side persistence.
- **localStorage holds**: per-provider AI config (keys + model + base URL), session-history summaries (filename, channels, quality score — not raw data), user pipeline templates.

---

## Roadmap

Shipping ✅:
- One-click Auto-clean · Recommendations · Pipeline templates
- Component review (PCA-based with heuristic labeling)
- Sleep staging (heuristic AASM) · Connectivity (Pearson + MSC coherence)
- Cohort QC (batch upload + anomaly ranking)
- BIDS-EEG export (with native ZIP packer)
- AI Assistant · AI Prose Report · AI Code Gen · AI Literature Search · AI Methods Writeup
- Reproducibility manifest · Web Worker DSP
- Vitest + GitHub Actions CI

Planned 🚧:
- ICA via MNE (true Infomax / FastICA) in backend
- LSL bridge (real-time ingest from Muse / Emotiv / OpenBCI)
- Foundation-model embeddings (LaBraM / BIOT) for cross-recording similarity
- Federated training (Flower) for clinical sites
- Plugin SDK (publish custom pipeline nodes)

See [docs/HLD.md §9](./docs/HLD.md) for the full roadmap.

---

## Contributing

Pull requests welcome. Quick rules:

1. `npm run typecheck` must pass before any commit.
2. Pure libs live in `nextjs-app/src/lib/` — no React imports there, so they stay unit-testable.
3. Use design tokens (`rgb(var(--accent))` etc.), no raw hex outside SVG attrs.
4. New AI providers: add to `lib/ai-providers.ts`; the 5 supported wire formats cover most cases.
5. New analysis views: see [docs/LLD.md §9 "Extension points"](./docs/LLD.md).

---

## Acknowledgments

Built on the shoulders of:

- [MNE-Python](https://mne.tools) — the EEG analysis ecosystem standard
- [Next.js](https://nextjs.org) + [React](https://react.dev) + [Tailwind CSS](https://tailwindcss.com)
- [FastAPI](https://fastapi.tiangolo.com) + [scipy](https://scipy.org)
- [Chart.js](https://chartjs.org)
- Algorithms grounded in: Pion-Tonachini et al. 2019 (ICLabel), Jas et al. 2017 (autoreject), Perslev et al. 2021 (U-Sleep), Klimesch 1999 (alpha), Welch 1967 (PSD), Bendat & Piersol *Random Data* (coherence).

## License

MIT — use, fork, deploy, contribute.

---

<sub>Made for researchers, students, clinicians, BCI engineers, and the quantified-self community. If it helps your work, [say hi](https://github.com).</sub>
