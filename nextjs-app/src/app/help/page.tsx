import React from "react";
import Link from "next/link";

const QUICK_START = [
  {
    n: "01",
    title: "Load a recording",
    body: "Drag a file onto the upload zone on the Lab page, or click one of the synthetic samples to explore without your own data. Supported: EDF, BDF, CSV, MAT, JSON, TSV.",
  },
  {
    n: "02",
    title: "Pick a recording context",
    body: "Choose your use case (resting / cognitive / sleep / BCI / consumer) and device. Filter defaults populate automatically.",
  },
  {
    n: "03",
    title: "Run Auto-clean (optional)",
    body: "Open the Automation → Auto-clean tab. One button detects line noise, flags bad channels, and proposes the full filter chain with rationale.",
  },
  {
    n: "04",
    title: "Explore the analysis",
    body: "Insights, Quality, Topography, Spectrogram, Connectivity, Sleep staging — each tab is a self-contained view computed from your data.",
  },
  {
    n: "05",
    title: "Connect an AI provider (free)",
    body: "Click the AI pill in the navbar. Pick Groq (free, very fast) or Gemini. Keys live only in your browser. Unlocks chat, prose reports, code gen, literature search, and methods.",
  },
  {
    n: "06",
    title: "Export your work",
    body: "Open the Report tab for an HTML report + JSON manifest. Use Methods (AI) to draft your paper paragraph. Code-gen produces runnable MNE / EEGLAB / FieldTrip scripts.",
  },
];

const WORKFLOWS = [
  {
    title: "Resting-state analysis",
    steps: [
      "Load a recording (or use the synthetic 'rest-eyes-closed' sample).",
      "Context: Resting-state EEG · Research-grade.",
      "Auto-clean → review → apply.",
      "Insights tab: check cognitive state, dominant rhythm, alpha peak.",
      "Topography tab: confirm posterior alpha distribution.",
      "Report → Download HTML + manifest.",
    ],
  },
  {
    title: "Sleep recording",
    steps: [
      "Context: Sleep / overnight EEG.",
      "Templates tab → apply 'Sleep · whole night' (0.3-35 Hz).",
      "Sleep staging tab: review hypnogram, stage percentages, spindles, K-complexes.",
      "Annotations: spot-check artifact-flagged epochs.",
      "Methods (AI): generate paragraph for your manuscript.",
    ],
  },
  {
    title: "Pre vs post comparison",
    steps: [
      "Load and analyze your 'A' recording normally.",
      "Compare tab → pick a sample (or load a real 2nd recording).",
      "Read the metric deltas and band-composition side-by-side.",
      "Literature (AI): ask 'What does increased frontal theta after intervention indicate?'",
    ],
  },
  {
    title: "Quick artifact triage",
    steps: [
      "Quality tab: read the 0-100 score and channel health matrix.",
      "Annotations tab: filter to 'Muscle' or 'Mains' events; jump to timestamps.",
      "Recommendations tab: one-click apply suggested filter changes.",
      "Re-check Quality — score should improve.",
    ],
  },
];

const TABS = [
  { name: "Insights", body: "Auto-classified cognitive state, dominant rhythm, alpha peak, asymmetry, structured findings." },
  { name: "Quality", body: "0-100 score with breakdown (clean samples, good channels, alpha signature, line-noise-free). Channel health matrix." },
  { name: "Band power", body: "Per-channel relative δ / θ / α / β / γ composition. Spot lateralized or focal activity." },
  { name: "Recommendations", body: "Proactive suggestions based on your current filters + analysis. One-click apply." },
  { name: "Auto-clean", body: "Smart preprocessing recipe — line-noise detection, bad-channel detection, paradigm-aware filters." },
  { name: "Templates", body: "6 built-in pipeline templates (resting, sleep, ERP, MI-BCI, P300, consumer) plus custom save/import/export." },
  { name: "Waveform", body: "Channel viewer with zoom, pan, per-channel toggle." },
  { name: "Frequency", body: "Welch PSD across channels, log/linear, band-shaded." },
  { name: "Spectrogram", body: "Time-frequency heatmap (viridis), per channel." },
  { name: "Topography", body: "10-20 scalp projection per band with inverse-distance interpolation." },
  { name: "Connectivity", body: "Channel × channel Pearson + alpha-band coherence matrix; ranked pairs." },
  { name: "Sleep staging", body: "Hypnogram with W / N1 / N2 / N3 / REM, spindle and K-complex counts." },
  { name: "Compare", body: "A/B side-by-side analyzer; metric deltas, dual band-bars." },
  { name: "Annotations", body: "Auto-detected artifacts (blink / muscle / mains / spike / flat) plus your own time-stamped notes." },
  { name: "Assistant", body: "Conversational EEG analyst (local heuristics or BYO LLM). Understands natural-language pipeline commands." },
  { name: "Literature", body: "LLM-powered paper suggestions grounded in your findings." },
  { name: "Methods", body: "LLM-generated 'EEG acquisition & pre-processing' paragraph for your manuscript." },
  { name: "Glossary", body: "Searchable EEG term reference — 20 entries." },
  { name: "Report", body: "HTML report + reproducibility manifest + MNE/EEGLAB/FieldTrip code generator." },
];

const TROUBLESHOOTING = [
  {
    q: "Upload says 'backend not running on :8000'",
    a: "EDF/BDF/MAT need the FastAPI backend. Either start it (cd backend && uvicorn main:app) or use a CSV/JSON file — those parse fully in the browser.",
  },
  {
    q: "AI features are greyed out",
    a: "Click the AI pill in the navbar and configure a provider. Groq, Gemini, OpenRouter, Mistral, Hugging Face, and Ollama are all free.",
  },
  {
    q: "Topography looks weird — channels not where expected",
    a: "We recognize the standard 10-20 / 10-10 names (Fp1, Fz, Cz, O1, etc.). Unknown channels are placed on a fallback ring — rename them to match a standard montage for accurate placement.",
  },
  {
    q: "Sleep staging looks wrong",
    a: "The classifier is a heuristic — it picks a central channel (Cz/C3/C4) and uses band-power + spindles. Quality degrades with shorter recordings or non-standard montages. Not a clinical tool.",
  },
  {
    q: "I want to keep filters across recordings",
    a: "Open Templates → 'Save current'. Named templates persist in your browser; export to JSON to share.",
  },
  {
    q: "Where do my recordings live?",
    a: "Locally only — file content stays in your browser/backend memory. We persist only lightweight summaries (filename, metrics) in localStorage as 'session history'.",
  },
  {
    q: "How do I update the AI assistant's pipeline from text?",
    a: "Type natural-language instructions in the Assistant: 'clean for sleep, notch 60', 'BCI motor imagery preset', 'high-pass at 0.3'. The parser updates filters before the LLM replies.",
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 sm:px-8 pt-16 pb-20">
      <section className="animate-fade-in">
        <div className="eyebrow mb-3">Help &amp; guide</div>
        <h1 className="h-display text-balance">Get to a result in under a minute.</h1>
        <p className="text-[rgb(var(--text-soft))] max-w-2xl mt-6 text-base leading-relaxed">
          A quick orientation, common workflows, every workspace tab explained, and answers to the
          questions most people ask in their first session.
        </p>
      </section>

      {/* Quick start */}
      <section className="mt-14">
        <div className="eyebrow mb-3">Quick start</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_START.map((s) => (
            <div key={s.n} className="surface rounded-xl p-5 flex gap-4">
              <div className="mono text-sm text-[rgb(var(--subtle))] shrink-0 mt-0.5">{s.n}</div>
              <div>
                <div className="font-medium mb-1">{s.title}</div>
                <div className="text-sm text-[rgb(var(--muted))] leading-relaxed">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflows */}
      <section className="mt-14">
        <div className="eyebrow mb-3">Common workflows</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOWS.map((w) => (
            <div key={w.title} className="surface rounded-xl p-5">
              <div className="font-medium text-sm mb-3">{w.title}</div>
              <ol className="space-y-2 text-sm text-[rgb(var(--text-soft))]">
                {w.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mono text-xs text-[rgb(var(--subtle))] shrink-0 mt-0.5">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Tab reference */}
      <section className="mt-14">
        <div className="eyebrow mb-3">Workspace tabs</div>
        <div className="surface rounded-xl overflow-hidden divide-y">
          {TABS.map((t) => (
            <div key={t.name} className="flex flex-col sm:flex-row gap-1 sm:gap-6 px-5 py-3">
              <div className="font-medium text-sm sm:w-40 shrink-0">{t.name}</div>
              <div className="text-sm text-[rgb(var(--muted))]">{t.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Providers */}
      <section className="mt-14">
        <div className="eyebrow mb-3">AI providers (free options)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { name: "Groq", body: "Fastest free tier. Llama 3.3 70B, Mixtral. Get a key at console.groq.com." },
            { name: "Google Gemini", body: "Generous free tier. Gemini 2.0 Flash. Key at aistudio.google.com." },
            { name: "OpenRouter", body: "Aggregator with free Llama/Gemini/DeepSeek/Qwen options. Pay-per-use premium models." },
            { name: "Mistral", body: "European free tier. Mistral Small/Nemo and Codestral." },
            { name: "Hugging Face", body: "Serverless inference, free with rate limits." },
            { name: "Ollama", body: "Self-hosted, fully private. Run any local model — set OLLAMA_ORIGINS to allow this origin." },
          ].map((p) => (
            <div key={p.name} className="surface rounded-xl p-4">
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-sm text-[rgb(var(--muted))] mt-1 leading-relaxed">{p.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="mt-14">
        <div className="eyebrow mb-3">Troubleshooting &amp; FAQ</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TROUBLESHOOTING.map((t) => (
            <div key={t.q} className="surface rounded-xl p-5">
              <div className="font-medium text-sm mb-1.5">{t.q}</div>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">{t.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="mt-14 surface rounded-xl p-5">
        <div className="eyebrow mb-2">Privacy</div>
        <p className="text-sm text-[rgb(var(--text-soft))] leading-relaxed">
          NeuroFlow Lab is local-first. Recordings parse on your machine via the bundled Python
          backend; CSV/JSON parse entirely in the browser. AI API keys live in your browser's
          localStorage and are sent only from your machine to the chosen provider. No telemetry, no
          analytics, no server-side persistence of your data.
        </p>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 surface rounded-xl p-5">
        <div>
          <div className="font-medium text-sm">Ready to try it?</div>
          <div className="text-sm text-[rgb(var(--muted))]">Drop a file or load a synthetic sample.</div>
        </div>
        <Link href="/" className="btn btn-primary">
          Open the lab
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
          </svg>
        </Link>
      </section>
    </main>
  );
}
