# NeuroFlow Lab — Low-Level Design

**Companion to**: `HLD.md`
**Audience**: Engineers implementing or extending modules

This document describes every internal module: contracts, types, algorithms, error modes. Read the HLD first for architecture context.

---

## 1. Repository layout

```
neuroflow-lab/
├── backend/
│   ├── main.py                  # FastAPI app, 3 endpoints
│   ├── requirements.txt
│   └── venv/
├── nextjs-app/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── layout.tsx       # Root layout: theme + AI provider + shell
│   │   │   ├── page.tsx         # Lab — workspace orchestrator (~800 LOC)
│   │   │   ├── globals.css      # Design tokens + utilities
│   │   │   ├── about/page.tsx
│   │   │   ├── docs/page.tsx
│   │   │   └── help/page.tsx
│   │   ├── components/          # React components (30 files)
│   │   │   ├── ui.tsx           # Primitives: Card, Stat, Banner, Spinner, etc.
│   │   │   ├── Navbar.tsx, Footer.tsx, Logo.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   ├── AIProvider.tsx
│   │   │   ├── AIAssistant.tsx, AISettingsModal.tsx, AIProseReport.tsx, AICodeGen.tsx
│   │   │   ├── AIInsights.tsx
│   │   │   ├── WorkspaceSidebar.tsx
│   │   │   ├── EEGVisualization.tsx, PSDView.tsx, SpectrogramView.tsx,
│   │   │   │   TopographyView.tsx, BandPowerView.tsx, QualityDashboard.tsx,
│   │   │   │   AnnotationsView.tsx, SleepStagingView.tsx, ConnectivityView.tsx,
│   │   │   │   ComparisonView.tsx
│   │   │   ├── AutoCleanPanel.tsx, RecommendationsPanel.tsx, PipelineTemplates.tsx
│   │   │   ├── LiteratureSearch.tsx, MethodsWriteup.tsx, GlossaryView.tsx
│   │   │   ├── ReportPanel.tsx
│   │   │   └── DecorativeWave.tsx
│   │   └── lib/                 # Pure TS modules (17 files, ~3500 LOC)
│   │       ├── dsp.ts           # FFT, PSD, band power, spectrogram, classifiers
│   │       ├── insights.ts      # runAnalysis() — single entry to all analytics
│   │       ├── autoclean.ts     # Recipe builder
│   │       ├── recommendations.ts
│   │       ├── sleep.ts
│   │       ├── connectivity.ts
│   │       ├── electrodes.ts    # 10-20 / 10-10 lookup
│   │       ├── glossary.ts
│   │       ├── templates.ts
│   │       ├── history.ts
│   │       ├── report.ts        # HTML report + manifest builder
│   │       ├── sample-data.ts   # Synthetic recordings + text parser
│   │       ├── assistant.ts     # NL intent classifier + offline heuristic
│   │       └── ai-*.ts          # AI orchestration (providers, client, config, prompts)
│   └── package.json
└── docs/
    ├── HLD.md
    └── LLD.md
```

---

## 2. Type system (canonical TS interfaces)

### 2.1 The recording shape

```ts
interface RecordingMeta {
  filename: string;
  channels: number;
  sampling_rate: number;
  duration_sec: number;
  data_shape: [number, number];     // [channels, samples]
  channel_names: string[];
}

interface RawRecording extends RecordingMeta {
  preview: number[][];               // channels × samples (full data after our refactor)
  data?: number[][];                 // raw, identical to preview today
  is_synthetic?: true;
  client_parsed?: true;              // set by parseTextEEG()
}

interface CleanedRecording extends RecordingMeta {
  cleaned_data: number[][];
  warnings?: string[];
  // pass-through filter params for round-tripping
  bandpass_low?: number;  bandpass_high?: number;
  notch_freq?: number;    lowpass_freq?: number | null;  highpass_freq?: number | null;
}
```

### 2.2 The analysis bundle

```ts
type BandName = "delta" | "theta" | "alpha" | "beta" | "gamma";

interface BandPowers {
  delta: number; theta: number; alpha: number; beta: number; gamma: number;
  total: number;
}

interface AnalysisBundle {
  perChannelBands: Array<Record<BandName, number> & { total: number; name: string }>;
  avgBands: Record<BandName, number> & { total: number };
  dominantBand: BandName;
  alphaPeakHz: number | null;
  cognitive: CognitiveStateResult;     // { state, confidence, metrics[] }
  quality: QualityReport;              // { overall, components[], badChannels[], artifactCount, sampleCount }
  asymmetry: { value: number; interpretation: string } | null;
  findings: Finding[];                 // { severity, title, body }
}
```

This bundle is the **single source of truth** for every analytical view. No component recomputes it.

### 2.3 Filter chain

```ts
interface FilterConfig {
  bandpass_low: number;        // Hz
  bandpass_high: number;       // Hz
  notch_freq: number;          // Hz (50 EU/IN, 60 US)
  highpass_freq: number | null;
  lowpass_freq: number | null;
}
```

### 2.4 AI types

```ts
type ProviderId = "groq" | "gemini" | "openrouter" | "mistral"
                | "ollama" | "openai" | "anthropic" | "together" | "huggingface";

interface AIConfig {
  activeProvider: ProviderId | "local";
  perProvider: Partial<Record<ProviderId, { apiKey?: string; model?: string; baseUrl?: string }>>;
}

interface LLMCallOptions {
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;        // default 0.4
  maxTokens?: number;          // default 1024
  signal?: AbortSignal;
}
```

---

## 3. Module-by-module design

### 3.1 `lib/dsp.ts` — The DSP foundation

**Public surface**:
```ts
fftMagnitude(input: number[]): number[]                   // O(N log N), in-place
welchPSD(signal, fs, segmentSize=256, overlap=0.5): { freqs, psd }
bandPower(freqs, psd, lo, hi): number                     // trapezoidal integration
computeBandPowers(signal, fs): { bands, psd }
spectrogram(signal, fs, windowSec=1, overlap=0.75, fMax=50): Spectrogram
channelStats(signal): ChannelStats                        // mean, std, ptp, rms, kurtosis
detectArtifacts(data, names, fs): ArtifactEvent[]
qualityScore(data, names, fs, artifacts): QualityReport   // 0-100
classifyCognitiveState(data, names, fs): CognitiveStateResult
frontalAlphaAsymmetry(data, names, fs): { value, interpretation } | null
```

**FFT algorithm** — iterative Cooley-Tukey:
1. Bit-reverse input order
2. Butterflies in log₂N passes, size 2 → 4 → 8 → ... → N
3. Twiddle factors computed via `Math.cos / sin`; cache could help if profiled hot

Why iterative not radix-4 / SIMD: bundle weight matters more than 2× throughput on signals this size.

**Welch PSD specifics**:
- Hann window of length nextPow2(min(signal.length, segmentSize))
- Segment overlap default 50%
- Per-segment mean subtraction (DC removal)
- Norm = fs × Σ window²; multiply 2× for one-sided non-DC bins
- Median of segment PSDs averaged (mean here; could switch to median for outlier robustness)

**Artifact heuristics** — 5 types, all per-channel:
- `flat`: std < 0.1 OR ptp < 1 µV
- `amplitude`: |x − μ| > 5σ for ≥20 ms
- `blink`: amplitude event AND frontal channel (FP*/F*) AND duration < 500 ms
- `muscle`: per-1s window with gamma/total ratio > 0.35
- `line-noise`: peak at 50/60 Hz with peak/broadband ratio > 4

**Quality score breakdown** (weights):
- 35 × cleanPct (samples not flagged)
- 25 × goodChannelPct (1 − badChannels / nChannels)
- 20 × min(1, alphaShare × 4) (presence of normal posterior rhythm)
- 20 × (1 − linePenalty) (1 − min(1, lineEvents / (nChannels × 4)))

**Cognitive state classifier** (6 states):
- Inputs: per-band averages restricted to posterior channels (O*, P*) when available
- Decision tree on θ/β, β/α, α/θ, engagement = (β+γ)/(α+θ)
- Output: `state ∈ {focused, relaxed, drowsy, alert, meditative, stressed}` + confidence ∈ [0, 1]
- Caveats: heuristic; documented in `glossary.ts` as research-grade not clinical

**Complexity** for a 16ch × 2500-sample (10s @ 250Hz) recording: ~80 ms on a modern laptop.

### 3.2 `lib/insights.ts` — The single analysis entry

```ts
runAnalysis(data: number[][], channelNames: string[], sampleRate: number): AnalysisBundle
```

1. For each channel: `computeBandPowers()` → store
2. If channel name matches `^O|^P`: search PSD for peak in [8, 13] Hz → `alphaPeakHz`
3. Pick dominant band by averaged power
4. Call `classifyCognitiveState`, `detectArtifacts`, `qualityScore`, `frontalAlphaAsymmetry`
5. Generate `findings[]` (severity-tagged narrative items):
   - dominant band info
   - alpha peak (warn if slowed)
   - cognitive state
   - asymmetry
   - quality (good/warn/danger by score)
   - bad channels
   - line noise
   - muscle events
   - blink events

Findings are intentionally redundant with structured fields — they're the user-facing prose that ends up in the report.

### 3.3 `lib/autoclean.ts` — The recipe builder

```ts
autoClean(input: AutoCleanInput): AutoCleanRecipe
```

Steps:
1. **Mains detection**: per channel, compute PSD, check 50 Hz vs 60 Hz peak ratios. Majority wins; default 50 Hz if no peak.
2. **Bad channel detection**: stats per channel; flag if std < 0.05 OR ptp < 0.5 OR std > 6× median OR |kurtosis| > 25.
3. **Paradigm-driven filters**: switch on `useCase`:
   - Resting → 1–45 Hz, HP 0.5, LP 45
   - Sleep → 0.3–35 Hz, HP 0.3, LP 35
   - Cognitive/ERP → 0.5–40 Hz
   - BCI/MI → 8–30 Hz
   - Low-cost → 1–40 Hz
4. **Rationale**: array of `{ step, reason }` strings displayed in the panel.
5. **Quality before**: run full analysis to display delta after apply.

Recipe is **pure data**, not applied. UI displays it; user clicks Apply to update state.

### 3.4 `lib/recommendations.ts` — Rule engine

```ts
recommend(analysis: AnalysisBundle, filters: FilterConfig): Recommendation[]
```

Each `Recommendation` has optional `apply` patch + `applyLabel` button text. 9 rules:

1. Line noise event present → suggest toggle 50↔60 Hz notch
2. Dominant=delta && HP ≥ 1 → suggest HP 0.3
3. Gamma > 22% of total → suggest LP 35 (likely EMG)
4. Bad channels ≥ 1 → suggest exclude (carries `exclude_channels`)
5. Quality < 60 → suggest running auto-clean (no apply patch — informational)
6. No alpha peak detected && state ≠ drowsy → check montage / eyes
7. Sleep-like signature && HP > 0.5 → suggest sleep preset
8. Muscle finding && β > 30% → suggest ICA
9. Quality ≥ 85 → "all good" reassurance (only if no other rules fire)

### 3.5 `lib/sleep.ts` — Heuristic AASM-style staging

```ts
stageRecording({ data, channelNames, sampleRate }): SleepReport
```

1. `pickStagingChannel`: prefers Cz / C3 / C4 / FCz / CPz; falls back to any `C*` channel.
2. Splits signal into 30s epochs (5s for very short recordings).
3. For each epoch:
   - Welch PSD; integrate δ/θ/α/β
   - `detectSpindles()`: 250 ms windows, sigma-band (11–16 Hz) power; threshold = 4× median; runs ≥ 0.5s counted
   - `detectKComplexes()`: 1s windows, ptp > 1.5 × (std × 5) counted
4. `classifyEpoch(bandShares, spindles, kc)` → stage + confidence:
   - δ > 0.45 → N3
   - (spindles>0 or kc>0) && θ > 0.25 → N2
   - θ > 0.3 && β < 0.2 && α < 0.25 → N2
   - θ > 0.2 && α < 0.18 && β < 0.18 && δ < 0.35 → REM
   - α < 0.2 && 0.15 < θ < 0.3 && δ < 0.3 → N1
   - β > 0.25 OR α > 0.3 → W
5. Aggregate per-stage seconds & percentages, total spindle & K-complex counts.

Documented as research convenience, not a clinical scorer. Real scoring should use YASA / U-Sleep.

### 3.6 `lib/connectivity.ts` — Channel × channel relationships

```ts
computeConnectivity(data, names, fs): ConnectivityMatrix
```

- **Pearson** on raw signals (n × n; symmetric; diagonal = 1).
- **α-band coherence proxy**: for each channel build a profile of α-power across short windows; Pearson on those profiles.
- **Top pairs**: list of upper-triangular entries sorted by |r|, top 10.

Note: Not true MSC coherence (which requires cross-spectral density). Documented as a proxy.

### 3.7 `lib/electrodes.ts` — 10-20 / 10-10 lookup

- Hardcoded 2D positions for ~50 standard electrodes, projected onto unit disc (x: −1..+1 L→R, y: −1..+1 back→front).
- `lookupElectrode(name)` strips non-alphanum, case-insensitive, with synonyms (T3→T7, etc.).
- `autoLayout(channelNames)` falls back to an even ring for unknown labels.

Used by `TopographyView`.

### 3.8 `lib/templates.ts` — Pipeline reuse

```ts
loadTemplates(): PipelineTemplate[]                       // built-ins + custom
addTemplate(omit_id_created): PipelineTemplate
deleteTemplate(id): void
exportTemplate(t): string                                 // JSON with schema tag
importTemplate(text): PipelineTemplate | null
```

- 6 built-ins, never deletable.
- Customs persisted to `localStorage` under `nfl-templates-v1`.
- Schema version on export: `"nfl-template/0.1"`.

### 3.9 `lib/history.ts` — Session memory

```ts
loadHistory(): HistoryEntry[]
saveHistoryEntry(entry): void                             // dedup by id, LIFO, capped at 20
deleteHistoryEntry(id): void
clearHistory(): void
makeId(): string
```

Stores only **summaries** (filename, dims, cognitive state, quality score). Never raw data. Capped at 20 entries to fit localStorage quota.

### 3.10 `lib/report.ts` — Reproducibility

```ts
buildHTMLReport(input: ReportInput): string               // self-contained HTML
buildManifest(input: ReportInput): object                 // JSON
```

- HTML embeds all CSS inline (no external assets), uses styled stat cards + tables + findings list.
- Manifest schema `"neuroflow-manifest/0.1"` with: recording meta, pipeline.steps[], analysis summary, tool name+version.

### 3.11 `lib/assistant.ts` — Natural-language layer

Two pure functions:

```ts
ask(question: string, ctx: AssistantContext): string
parsePipelineRequest(text: string): ParsedPipelineRequest | null
```

`ask()` is the **offline heuristic** that runs when no LLM is configured. Intent classifier: 8 regex-based intents (band power, cognitive state, quality, dominant rhythm, alpha peak, asymmetry, recommendations, explain). Each intent produces a markdown reply pulling from the analysis bundle.

`parsePipelineRequest()` is the **deterministic command parser**. Regex-extracts:
- Frequency ranges (`X-Y Hz`)
- Explicit cutoffs (`highpass at Z`, `notch X`)
- Semantic keywords: sleep, ERP/cognitive, BCI/motor imagery, resting

Returns a partial `FilterConfig` patch. Runs **before** the LLM in `AIAssistant.send()` — if it matches, no LLM call is needed.

### 3.12 `lib/ai-*.ts` — LLM orchestration

#### `ai-providers.ts`
Registry of 9 providers with: label, baseUrl, format (`openai` | `anthropic` | `gemini` | `ollama` | `huggingface`), pricing tier, signupUrl, default model, model list.

#### `ai-client.ts`
```ts
callLLM(config: AIConfig, opts: LLMCallOptions): Promise<LLMCallResult>
testConnection(config): Promise<{ ok, message, ms? }>
```

Internal dispatch on `provider.format`:
- `openai` → POST `${baseUrl}/chat/completions` with bearer auth, OpenRouter adds Referer/X-Title.
- `anthropic` → POST `${baseUrl}/messages` with `x-api-key` + `anthropic-version` + `anthropic-dangerous-direct-browser-access: true`.
- `gemini` → POST `${baseUrl}/models/{model}:generateContent?key={apiKey}` with rebuilt `contents[]` and optional `systemInstruction`.
- `ollama` → POST `${baseUrl}/api/chat`.
- `huggingface` → POST `${baseUrl}/{model}` with concatenated prompt.

All return a normalized `LLMCallResult { text, model, provider, usage }`. Errors wrapped as `LLMError(providerId, status, message)`.

#### `ai-prompts.ts`
- `recordingContextBlock(summary)` — generates a deterministic markdown context block grounded in real DSP numbers.
- 3 system prompts: `ASSISTANT_SYSTEM`, `PROSE_REPORT_SYSTEM`, `CODE_GEN_SYSTEM`.

#### `ai-config.ts`
- Defaults: `{ activeProvider: "local", perProvider: {} }`
- `isConfigured(config)`: true for local + ollama always; for others requires apiKey.
- `activeModel(config)`: returns label for navbar pill.

### 3.13 `lib/sample-data.ts` — Synthetic + text ingest

Two responsibilities:
1. **Synthetic recordings** (`SAMPLES`): 5 named profiles (rest-eyes-closed, focused-task, drowsy, artifact-heavy, meditation) generated by mixing band-specific oscillators with pink-ish noise and channel-specific modifications. Reproducible (seeded RNG). Tagged `is_synthetic: true`.
2. **Client-side text parser** (`parseTextEEG`): handles CSV / TSV / whitespace-delimited. Auto-detects header row (any non-numeric token in first row), separator, and orientation (samples = longer dimension).

### 3.14 `lib/glossary.ts` — In-app reference

20 entries with `term`, `short`, `detail`, optional `aliases[]`. Powers the Glossary tab and could power click-to-define popovers in the future.

---

## 4. React component design

### 4.1 State ownership

| State | Owner | Notes |
|---|---|---|
| Theme (light/dark) | `ThemeProvider` (context) | Persisted to localStorage |
| AI config | `AIProvider` (context) | Persisted to localStorage |
| Recording / filters / active tab | `app/page.tsx` | All in `useState`; no global store needed |
| Per-view UI state (selected channel, log/lin toggle) | each view component | Doesn't escape the component |

**Rule**: state lives at the lowest common ancestor of the components that need it. Page-level state is shallow; deep state lives in views.

### 4.2 Derived state pattern

```ts
const activeData = useMemo(() =>
  showCleaned && cleanedResult
    ? { ...cleanedResult, preview: cleanedResult.cleaned_data ?? cleanedResult.preview }
    : uploadResult
, [showCleaned, cleanedResult, uploadResult]);

const analysis = useMemo(() => {
  if (!activeData) return null;
  return runAnalysis(activeData.cleaned_data ?? activeData.preview, ...);
}, [activeData]);
```

Single source of truth, single recompute. Views consume `analysis` directly.

### 4.3 Workspace shell

`app/page.tsx` is split into:
- Setup (~150 LOC) — state + filter handlers + drag-drop
- Landing render (~170 LOC) — hero + upload + samples + features + history
- Workspace render (~250 LOC) — top bar + filter strip + stat row + sidebar + tab content
- Helpers (~30 LOC) — file download utility

`SIDEBAR_ITEMS` is constructed conditionally on `analysis`; if analysis isn't ready, sidebar is empty (workspace doesn't render anyway).

### 4.4 Critical component contracts

| Component | Props | Renders |
|---|---|---|
| `EEGVisualization` | `eegData: RecordingMeta + preview` | Chart.js Line + per-channel chips |
| `PSDView` | `data, channelNames, sampleRate, fMax?` | Chart.js Line + band shading |
| `SpectrogramView` | same as above | Canvas heatmap (viridis) |
| `TopographyView` | same as above | Canvas with IDW interpolation |
| `BandPowerView` | same as above | Stacked SVG bars |
| `QualityDashboard` | `analysis, channelNames` | SVG ring + breakdown + channel matrix |
| `AIInsights` | `analysis` | Hero card + stat row + findings list |
| `AnnotationsView` | `data, channelNames, sampleRate, duration` | Timeline + auto + user notes |
| `SleepStagingView` | `data, channelNames, sampleRate` | SVG hypnogram + stage summary |
| `ConnectivityView` | same | SVG matrix + ranked pairs |
| `ComparisonView` | `primary, primaryAnalysis` | Side-by-side delta cards |
| `AIAssistant` | `context, onApplyPipeline?, onOpenSettings?` | Chat UI |
| `RecommendationsPanel` | `recommendations, onApply` | List + apply buttons |
| `AutoCleanPanel` | `data, channelNames, sampleRate, useCase?, onApply` | Run / review / apply |
| `PipelineTemplates` | `current, currentUseCase, onApply` | Built-ins + customs + IO |
| `ReportPanel` | `fileName, ..., filters, analysis` | Download HTML / manifest |
| `AIProseReport` | `summary, onOpenSettings` | LLM-written narrative |
| `AICodeGen` | `summary, onOpenSettings` | LLM-written runnable code |
| `MethodsWriteup` | (same shape as AIProseReport) | LLM-written methods paragraph |
| `LiteratureSearch` | `analysis, fileName, onOpenSettings` | LLM-powered paper search |
| `GlossaryView` | — | Search + accordion of `GLOSSARY` entries |
| `WorkspaceSidebar` | `items, active, onChange` | Vertical sidebar (lg+) / horizontal tabs (sm) |

### 4.5 Performance patterns

- **Memoize expensive analysis** in `useMemo`.
- **Debounce filter changes** (450 ms) before re-cleaning.
- **Dynamic import** `chartjs-plugin-zoom` (only loaded once).
- **Canvas for heatmaps** (Spectrogram, Topography, Connectivity matrix is SVG because it's smaller).
- **Lazy stats** in views: every view only computes what it needs from `analysis`.

---

## 5. Backend design (`backend/main.py`)

### 5.1 Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |
| POST | `/upload` | multipart `file` | `{ filename, tmp_path }` |
| POST | `/parse` | `{ tmp_path }` | full `RawRecording` |
| POST | `/clean` | `RawRecording + FilterConfig` | `CleanedRecording` (+ optional `warnings`) |

### 5.2 Filter chain

`scipy.signal.butter(order=4)` + `filtfilt` for zero-phase response. Order: bandpass → highpass → lowpass → notch → baseline correction (subtract per-channel mean).

`iirnotch(notchFreq/nyquist, quality=30)` is the notch.

Padlen check: `filtfilt` requires signal length > `3 × max(len(a), len(b))`; if not, the filter is skipped and a warning emitted. UI displays warnings via `Banner`.

### 5.3 File handling

`/upload` writes a `tempfile.NamedTemporaryFile(delete=False)` and returns its path. **No automatic cleanup** — relies on OS reclamation. Production must add a TTL janitor.

`/parse` dispatches by extension:
- `.edf` → `mne.io.read_raw_edf(preload=True)` → `raw.get_data()`
- `.csv` → `np.loadtxt(delimiter=',')`; assumes 256 Hz; assumes [channels, samples]
- `.mat` → `scipy.io.loadmat()`; expects a `data` key

Both CSV and MAT branches **assume sampling rate = 256 Hz**. This is a known limitation — users with different rates must edit the source or accept the assumption.

### 5.4 Error handling

- Invalid extension → 400
- Missing tmp_path → 400
- Parse failure → 500 with exception message (leaks internal details — fix before public deploy)
- Cleaning with too-short signal → 200 with `warnings[]`

### 5.5 CORS

`allow_origins=["*"]` because deployment is localhost. **Tighten before any public deployment.**

---

## 6. Wire-format contracts

### 6.1 `/parse` response

```json
{
  "channels": 16,
  "sampling_rate": 250,
  "duration_sec": 10,
  "data_shape": [16, 2500],
  "channel_names": ["Fp1", "Fp2", ...],
  "preview": [[...10 samples...], ...],
  "data": [[...2500 samples...], ...]
}
```

### 6.2 `/clean` request

```json
{
  "data": [[...]],
  "channels": 16,
  "sampling_rate": 250,
  "channel_names": [...],
  "duration_sec": 10,
  "bandpass_low": 1,
  "bandpass_high": 45,
  "notch_freq": 50,
  "highpass_freq": 0.5,
  "lowpass_freq": 45
}
```

### 6.3 `/clean` response

```json
{
  "channels": 16,
  "sampling_rate": 250,
  "duration_sec": 10,
  "data_shape": [16, 2500],
  "channel_names": [...],
  "cleaned_data": [[...2500 samples filtered...], ...],
  "warnings": ["Filtering skipped: ..."]    // optional
}
```

### 6.4 Manifest (export)

```json
{
  "schema": "neuroflow-manifest/0.1",
  "generated_at": "2026-05-18T12:00:00.000Z",
  "recording": { "filename", "channels", "channel_names", "sampling_rate_hz", "duration_s" },
  "pipeline": { "steps": [{ "op": "bandpass_filter", "low_hz": 1, "high_hz": 45 }, ...] },
  "analysis": { "cognitive_state", "cognitive_confidence", "dominant_band",
                "alpha_peak_hz", "quality_score", "bad_channels", "band_powers_avg" },
  "tool": { "name": "NeuroFlow Lab", "version": "0.2.0" }
}
```

---

## 7. Algorithms — annotated references

| Algorithm | Module | Reference |
|---|---|---|
| FFT (iterative Cooley-Tukey) | `dsp.ts` | Press et al. *Numerical Recipes* §12.2 |
| Welch PSD | `dsp.ts` | Welch (1967) IEEE Trans. AU; Hann window from Harris (1978) |
| Frontal alpha asymmetry | `dsp.ts` | Allen & Cohen (2010); Coan & Allen (2004) |
| Band-power features for cognitive state | `dsp.ts` | Klimesch (1999) on alpha; Coan & Allen on FAA; θ/β ratio in ADHD literature |
| Sleep spindle (sigma-band burst) | `sleep.ts` | Warby et al. (2014) *Nat Methods*; YASA (Vallat 2021) |
| K-complex (large biphasic) | `sleep.ts` | AASM Manual 2.6 |
| AASM-style staging | `sleep.ts` | AASM Manual (heuristic-only, not certified) |
| IDW topomap interpolation | `TopographyView` | Standard inverse-distance weighting; better: spherical splines (Perrin 1989) |
| Pearson correlation matrix | `connectivity.ts` | Standard; for true coherence see Bendat & Piersol *Random Data* |

---

## 8. Testing strategy (planned, not yet implemented)

| Layer | Tool | What to test |
|---|---|---|
| DSP libs | Vitest | FFT vs scipy reference (delta function, sinusoid, known PSDs) |
| Insights | Vitest | Cognitive state classifier outputs on the 5 synthetic samples |
| Sleep | Vitest | Stage distribution on synthetic recordings |
| Autoclean | Vitest | Recipe outputs on known dirty samples |
| AI client | Vitest + MSW | Each provider format encoding |
| Pages | Playwright | Drop file → see workspace → switch tabs |
| Accessibility | axe-core via Playwright | Keyboard nav, ARIA labels |

CI: GitHub Actions on push. Gates: `tsc --noEmit`, `vitest run`, `playwright test`.

---

## 9. Extension points

### 9.1 Adding a new AI provider

1. Add entry to `PROVIDERS` in `ai-providers.ts` (id, format, default model, model list).
2. If format ∈ existing 5 (openai-compat / anthropic / gemini / ollama / huggingface) — done.
3. Otherwise extend `RequestFormat` union and add a case in `ai-client.ts`'s switch.

### 9.2 Adding a new analysis view

1. Create `src/lib/<feature>.ts` exporting a pure function that takes `(data, channelNames, sampleRate)` and returns plain data.
2. Create `src/components/<Feature>View.tsx` consuming that lib.
3. Add a `SidebarItem` in `app/page.tsx`'s `SIDEBAR_ITEMS`.
4. Add an `IC.<feature>` SVG icon to the icon dict.
5. Wire the conditional render in the tab-content section.

### 9.3 Adding a new pipeline template built-in

Add to `BUILTIN_TEMPLATES` in `lib/templates.ts`. Set `isBuiltIn: true` and any stable `id`.

### 9.4 Adding a new recommendation rule

Add a block to `recommend()` in `lib/recommendations.ts`. Order matters — earlier rules render first.

### 9.5 Wiring a new file format

- **Browser-side text format**: extend `parseTextEEG()` heuristics in `lib/sample-data.ts`, or add a sibling parser for known schemas.
- **Binary format** (BDF, FIF, etc.): extend `backend/main.py` `/parse` with an additional MNE call.

---

## 10. Known constraints / pitfalls for new contributors

1. **CSV sampling rate is hard-coded to 256 Hz** in the backend. Add a UI to override post-upload, or move parsing entirely client-side.
2. **`parseTextEEG` orientation guess can flip** when `nRows ≈ nCols`. Add an explicit "transpose" toggle.
3. **The Pearson "coherence" is not real MSC.** If you need scientific publication-grade coherence, port `scipy.signal.coherence` (cross-spectral density).
4. **Sleep staging is unbenchmarked.** Treat as a screening tool, not ground truth. If accuracy matters, integrate YASA or U-Sleep via the Python backend.
5. **Topomap uses IDW.** For accurate scalp interpolation use spherical splines (Perrin 1989) — port from MNE or compute via WASM.
6. **The Welch PSD averages segments, doesn't median.** Outlier-prone if a recording has bursts; consider a median variant for robustness.
7. **Backend has no auth and listens on all interfaces.** If exposed beyond localhost, add auth + lock CORS.
8. **No request timeouts on LLM calls except AbortController in chat.** Add per-provider timeouts before going to production.
9. **`Analysis` recompute on every render** when `activeData` changes. For >5 min recordings, move to a Web Worker.

---

## 11. Conventions

- **No barrel files** (`index.ts`); explicit imports keep tree-shaking obvious.
- **Pure libs**: `lib/*.ts` files import nothing from `components/` or React. They can be unit-tested in isolation.
- **Tokenized colors only**: components must not use raw `#RRGGBB`; use `rgb(var(--accent))` etc. (Exception: SVG attributes where CSS vars don't reach — annotated case-by-case.)
- **One semantic per file**: e.g. `recommendations.ts` is only the rule engine; the panel that renders them is `RecommendationsPanel.tsx`.
- **Memoize**: every derived expensive value gets a `useMemo`.
- **Async UI**: every async operation has a `busy` state + disabled buttons + visible spinner.
- **Errors are user-facing**: `Banner tone="danger"` for failures the user can act on.
