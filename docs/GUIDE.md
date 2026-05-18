# NeuroFlow Lab — User Guide

A step-by-step walkthrough for everyone using NeuroFlow Lab, from first-time students to seasoned researchers.

**Audience:** anyone who'll use the app
**Length:** ~15 minute read · or skim to the workflow you need
**Companion:** the in-app `Help` page mirrors this guide for fast reference

---

## Table of contents

1. [First-time setup](#1-first-time-setup)
2. [Your first 60 seconds](#2-your-first-60-seconds)
3. [The workspace, tab by tab](#3-the-workspace-tab-by-tab)
4. [Common workflows](#4-common-workflows)
   - [Resting-state analysis](#workflow-1-resting-state-analysis)
   - [Sleep recording](#workflow-2-sleep-recording)
   - [A/B comparison](#workflow-3-ab-comparison-prepost-or-cross-condition)
   - [Artifact triage](#workflow-4-artifact-triage)
   - [Cohort QC](#workflow-5-cohort-qc-for-faculty)
   - [Writing the methods section](#workflow-6-writing-up-the-methods-section)
5. [AI provider setup](#5-ai-provider-setup)
6. [File formats & ingestion](#6-file-formats--ingestion)
7. [Filter reference](#7-filter-reference)
8. [Glossary of EEG terms](#8-glossary)
9. [Troubleshooting / FAQ](#9-troubleshooting--faq)
10. [Privacy notes](#10-privacy-notes)
11. [Keyboard hints](#11-keyboard-hints)

---

## 1. First-time setup

### Two things to install

```bash
# Frontend (always needed)
cd nextjs-app
npm install
npm run dev          # http://localhost:3000

# Backend (only needed for EDF / BDF / MAT files)
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload    # http://localhost:8000
```

Open `http://localhost:3000`. You should see the landing page with a big headline, an upload card, a context panel, and a bento grid of features.

### Without the backend

If you don't want to install Python yet, **CSV / TSV / JSON / TXT files parse fully in the browser**. Drop one of those formats and skip the backend entirely.

### Quickest demo path

Just click one of the **synthetic samples** ("Resting · eyes closed", "Focused · task engagement", etc.) on the landing page. Everything runs offline.

---

## 2. Your first 60 seconds

```
 0:00  Land on the Lab page
 0:05  Click "Try a sample" → "Resting · eyes closed"
 0:10  Workspace loads with 19 tabs in the sidebar
 0:15  Top stat row shows: Channels · State · Dominant band · Quality
 0:20  AI Insights tab is open by default — read the cognitive state
 0:30  Click "Topography" → see scalp distribution per band
 0:40  Click "Frequency" → see Welch PSD per channel
 0:50  Click "Auto-clean" → run → review recipe → Apply
 1:00  Click "Report" → Download HTML
```

---

## 3. The workspace, tab by tab

The sidebar groups tabs by purpose:

### Analysis

| Tab | What you'll see |
|---|---|
| **Insights** | Cognitive state classification (focused / relaxed / drowsy / alert / meditative / stressed) with confidence, dominant rhythm, alpha peak frequency, cognitive metric ratios (θ/β, β/α, α/θ, engagement), structured AI findings tagged by severity, and frontal alpha asymmetry if F3/F4 are in your montage. |
| **Quality** | 0–100 quality score (composite of clean-sample %, channel health, alpha signature, line-noise) with per-component breakdown, channel health matrix (per-channel good/bad chips), artifact summary (blinks / muscle / mains / spikes counts). |
| **Band power** | Per-channel relative composition across delta / theta / alpha / beta / gamma as stacked bars. Cohort average at the top. |

### Automation

| Tab | What it does |
|---|---|
| **Recommendations** | Live rule-based suggestions surfaced from your current filter chain + analysis. Example: "Gamma share too high — likely EMG, lower the LP". Each has a one-click Apply button. |
| **Auto-clean** | Inspects mains noise (50/60 Hz), bad channels (variance / kurtosis), and your paradigm. Returns a complete recipe: filter chain + bad-channel list + rationale. Review before applying. |
| **Components (ICA)** | PCA decomposition with heuristic labeling (brain / eye / muscle / cardiac / line-noise). Mini-topomap + sparkline per component. "Remove all eye" bulk action. |
| **Templates** | 6 built-in pipelines (Resting · adult, Sleep · whole night, Cognitive · ERP, BCI · motor imagery, BCI · P300, Consumer device). Save your own; import/export as JSON to share with collaborators. |

### Visualize

| Tab | What it does |
|---|---|
| **Waveform** | Channel viewer with mouse-wheel zoom and click-drag pan. Per-channel chips toggle visibility. |
| **Frequency** | Welch PSD across channels with optional band shading. Toggle linear / dB. |
| **Spectrogram** | Time-frequency heatmap (STFT, viridis colormap), per channel. |
| **Topography** | 10-20 scalp projection per band. Inverse-distance interpolation. Click a band chip to switch. |
| **Connectivity** | Channel × channel matrix. Toggle between Pearson (raw signals) and magnitude-squared α-coherence (cross-spectral). Top-10 ranked pairs below. |

### Specialized

| Tab | What it does |
|---|---|
| **Sleep staging** | 30-second epoch hypnogram (W / N1 / N2 / N3 / REM) on the best central channel (Cz / C3 / C4). Per-stage time + percentages. Spindle and K-complex counts. |
| **Compare** | Load a second recording (synthetic sample or upload). Side-by-side metric deltas, dual band-composition bars, quick verbal summary. Useful for pre/post or cross-condition. |
| **Cohort QC** | Batch-upload text recordings (CSV/TSV/JSON). Per-subject summary cards ranked by anomaly score against the cohort median. |

### Inspect

| Tab | What it does |
|---|---|
| **Annotations** | Timeline strip with auto-detected events (blink / muscle / mains / spike / flat) plus manual annotations you can add by clicking on the timeline. |

### AI

| Tab | What it does |
|---|---|
| **Assistant** | Chat interface grounded in your live DSP analysis. Understands natural-language pipeline updates ("clean for sleep, notch 60"). Works offline with local heuristics or against your configured LLM provider. |
| **Literature** | LLM-powered paper suggestions for a research question, grounded in your recording's metrics. |
| **Methods** | LLM-written journal-style "EEG acquisition and pre-processing" paragraph. Copy-paste ready. |

### Reference

| Tab | What it does |
|---|---|
| **Glossary** | 20 EEG terms with definitions and aliases. Searchable. |

### Export

| Tab | What it does |
|---|---|
| **Report** | Self-contained HTML report (all metrics + plots + findings + manifest) and reproducibility manifest JSON. Plus AI-written prose narrative and AI-written MNE / EEGLAB / FieldTrip code. |
| **BIDS export** | Brain Imaging Data Structure-compatible ZIP: `dataset_description.json`, `channels.tsv`, `eeg.json` sidecar, `events.tsv`, `eeg.tsv`. Ready for OpenNeuro or `mne-bids`. |

---

## 4. Common workflows

### Workflow 1: Resting-state analysis

1. **Load** a recording or the *"Resting · eyes closed"* sample.
2. **Context**: Use case → "Resting-state EEG" · Device → "Research-grade system".
3. **Insights** tab: check cognitive state (should be `relaxed`), dominant rhythm (should be `alpha`), and individual alpha peak frequency.
4. **Topography** tab: select `alpha` — you should see a posterior (occipital) peak.
5. **Quality** tab: aim for ≥ 80/100.
6. **Report** tab: Download the HTML.

### Workflow 2: Sleep recording

1. **Load** an overnight recording (use the *"Drowsy · pre-sleep"* sample to try).
2. **Templates** tab: apply *"Sleep · whole night"* (0.3–35 Hz, preserves slow waves and spindles).
3. **Sleep staging** tab: read the hypnogram, stage percentages, spindle and K-complex counts.
4. **Annotations** tab: spot-check artifact-flagged epochs.
5. **Methods** (AI) tab: generate a paragraph for your manuscript.

### Workflow 3: A/B comparison (pre/post or cross-condition)

1. **Load** and analyze your "A" recording normally.
2. **Compare** tab → pick a synthetic sample, or upload a real second recording.
3. Read the **metric deltas** (quality, alpha peak, state, bad channels) and the dual band-composition bars.
4. **Literature** (AI) tab: ask "what does increased frontal theta after intervention indicate?" — gets paper suggestions grounded in your delta.

### Workflow 4: Artifact triage

1. **Quality** tab: 0–100 score with breakdown and channel health matrix.
2. **Annotations** tab: filter to "Muscle" or "Mains" events; jump to timestamps.
3. **Recommendations** tab: one-click apply suggested filter changes.
4. **Components (ICA)** tab: bulk-remove eye / muscle components.
5. Re-check **Quality** — score should rise.

### Workflow 5: Cohort QC (for faculty)

1. **Cohort QC** tab.
2. Set the sampling rate (matches your recordings).
3. Drop in multiple CSV / TSV / JSON files.
4. Subjects appear as cards ranked by **anomaly score** (z-score deviation across quality, bad channels, α-share, γ-share).
5. Sort by anomaly / quality / name. Open any subject card to switch the workspace to that recording.

### Workflow 6: Writing up the methods section

1. After analysis, **Report** tab → **AI Methods writeup** → Generate.
2. The LLM emits a 120-200 word paragraph in scientific style, with all your filter values and excluded channels.
3. Copy to your manuscript and verify.
4. Same tab → **AI Code generator** → MNE-Python → Generate. You get a runnable script that exactly reproduces your pipeline.

---

## 5. AI provider setup

Click the **AI** pill in the navbar to open settings.

### Recommended free path

| Provider | Why pick this | Sign up |
|---|---|---|
| **Groq** | Sub-second responses, Llama 3.3 70B and DeepSeek R1 free | [console.groq.com/keys](https://console.groq.com/keys) |
| **Google Gemini** | Generous quotas, Gemini 2.0 Flash | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **OpenRouter** | Free tier across many models · pay-as-you-go premium | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Ollama** | Self-hosted, fully private. Needs `OLLAMA_ORIGINS` env var to allow this site origin | [ollama.com](https://ollama.com/download) |

### What gets sent

When you chat with the assistant or generate a report:
1. The full *system prompt* (rules for the assistant).
2. A *recording context block* (your channel names, sampling rate, computed metrics, filter chain). **No raw signal data.**
3. Your chat message history.

The signal itself never goes to the LLM — only the computed numbers.

### What's stored locally

Per provider: API key, chosen model, custom base URL (Ollama). All in browser `localStorage` only.

---

## 6. File formats & ingestion

| Format | Where it parses | Notes |
|---|---|---|
| **EDF / BDF** | Backend (MNE-Python) | Standard EEG formats. Backend must be running. |
| **MAT** | Backend (scipy.io) | Expects a `data` key with `[channels, samples]`. |
| **CSV / TSV / TXT** | Browser | Header row auto-detected; orientation auto-detected (longer axis = samples). Override sample rate or transpose if needed. |
| **JSON** | Browser | Expect a 2D array. |

If your CSV's first row is data (not headers), the parser will still work — it tries `Number()` on every value to detect the header row.

If your samples-channels orientation is ambiguous (e.g. 100 channels × 100 samples), the auto-detection might flip the matrix. We're planning a UI toggle to force the orientation; for now, transpose your input.

---

## 7. Filter reference

Default values are paradigm-aware (set in `Templates`). The reference here is the underlying rationale.

| Filter | Default | Range | Why |
|---|---|---|---|
| **High-pass** | 0.5 Hz | 0.1–1 Hz | Removes slow baseline drift while preserving the delta band (<4 Hz). Setting > 1 Hz distorts ERP slow components. |
| **Low-pass** | 45 Hz | 30–70 Hz | Removes high-frequency noise while keeping δ–β bands. Raise to ~70 Hz for gamma research; tighten to 30 Hz to aggressively suppress EMG. |
| **Band-pass** | 1–45 Hz | 1–50 Hz | Standard resting-state EEG range. For sleep: 0.3–35 Hz. For motor-imagery BCI: 8–30 Hz. |
| **Notch** | 50 Hz | 50 / 60 Hz | Removes AC mains contamination. 50 Hz: EU / India / most of Asia and Africa. 60 Hz: Americas. |

Auto-clean detects which mains frequency dominates and picks it automatically.

---

## 8. Glossary

The in-app **Glossary** tab has 20 EEG terms with definitions, examples, and aliases. Use it as you go. Highlights:

- **Alpha (8–13 Hz)** — posterior-dominant rhythm of relaxed wakefulness; blocked by eye opening (the Berger effect).
- **Frontal alpha asymmetry (FAA)** — log(right) − log(left) over F3/F4. Research-grade affective valence proxy.
- **IAPF** — individual alpha peak frequency, the dominant frequency within the alpha band.
- **K-complex** — sharp negative deflection followed by slower positive component, ≥100 µV. Marker of N2 sleep.
- **Sleep spindle** — 11–16 Hz burst, 0.5–2 s long. Generated by the thalamic reticular nucleus. Also a marker of N2.
- **ICA** — Independent Component Analysis. Decomposes mixed channels into statistically independent sources for artifact removal.
- **BIDS** — Brain Imaging Data Structure, a community standard for organizing neuroimaging datasets.

---

## 9. Troubleshooting / FAQ

**"Upload failed — is the backend running on :8000?"**
EDF / BDF / MAT files need the Python backend. Either run `uvicorn main:app --reload` from `backend/`, or use CSV / JSON instead.

**AI features are greyed out / show "Set up AI →"**
Click the AI pill in the navbar and configure a provider. Groq is free and instant.

**"The topography looks weird — channels not where expected"**
NeuroFlow recognizes standard 10-20 / 10-10 names (Fp1, Fz, Cz, O1, etc.). Unknown channels are placed on a fallback ring. Rename channels to match a standard montage for accurate placement.

**Sleep staging seems wrong**
The classifier is a heuristic — it picks a central channel (Cz / C3 / C4) and uses band-power + spindle + K-complex detection. Quality degrades with very short recordings or non-standard montages. Use YASA or U-Sleep (via the AI-generated MNE script) for clinical-grade staging.

**My CSV has 100 channels × 100 samples and the orientation flipped**
The auto-detection assumes the longer axis is samples. For square data, transpose your input and re-upload. UI toggle is on the roadmap.

**"I want to keep filters across recordings"**
Open the **Templates** tab → "Save current". Named templates persist in your browser. Export to JSON to share with collaborators.

**Where are my recordings stored?**
Locally only — file content stays in browser/backend memory. We persist only lightweight summaries (filename, channels, quality score, cognitive state) in `localStorage` as "session history".

**The AI assistant didn't apply my filter command**
The parser handles common patterns: `X–Y Hz`, `bandpass`, `notch X`, `highpass at X`, plus semantic shortcuts (`for sleep`, `for ERP`, `for BCI`, `for resting`). If your phrasing doesn't match, type a more explicit request like "set band-pass to 0.5-40 Hz, notch 60 Hz".

**LLM call times out**
Default per-call timeout is 45 seconds. For slow providers (Hugging Face cold starts, large Ollama models), you may need to lower `maxTokens` in the prompt or use a faster model (Groq is fastest free option).

---

## 10. Privacy notes

- Recordings stay on your device. Backend on `localhost`; CSV / JSON parse entirely in the browser.
- API keys live in `localStorage` only. Calls go *directly* from your browser to the provider you chose.
- No telemetry, no analytics, no server-side persistence.
- Local-storage holds: AI config (keys, model, base URL), session-history summaries, custom pipeline templates, cohort summary cache, theme preference.
- If you use a shared device, clear `localStorage` after use, or stick to Ollama (no key needed).

---

## 11. Keyboard hints

| Action | Shortcut |
|---|---|
| Open AI provider modal | Click the **AI** pill |
| Toggle theme | Click the **Light** / **Dark** button in navbar |
| Zoom waveform | Mouse wheel on the chart |
| Pan waveform | Click & drag on the chart |
| Send chat | Enter |
| Cancel a long LLM call | Click the "stop" link next to the typing indicator |

---

## Getting more help

- See [HLD.md](./HLD.md) for system architecture
- See [LLD.md](./LLD.md) for module-level design
- Open an issue on GitHub for bugs or feature requests
- The in-app **Help** page mirrors this guide for quick reference inside the workspace
