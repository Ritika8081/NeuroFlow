import React from "react";
import Link from "next/link";

const STEPS = [
  { n: "01", title: "Upload a recording", body: "Drag and drop a .edf, .csv, or .mat file — or try a synthetic sample." },
  { n: "02", title: "Set the context", body: "Pick a use case and device. Filter defaults auto-fill with paradigm-appropriate values." },
  { n: "03", title: "Tune the filters", body: "Override any value to taste. Cleaning runs live as you type." },
  { n: "04", title: "Explore & export", body: "Tour the workspace, then download HTML report, manifest, or runnable code." },
];

const FILTERS = [
  { name: "High-pass", def: "0.5 Hz", range: "0.1 – 1 Hz", why: "Removes slow baseline drift, preserves delta (<4 Hz)." },
  { name: "Low-pass", def: "45 Hz", range: "30 – 70 Hz", why: "Removes high-frequency noise; keeps δ–β bands. Raise for gamma." },
  { name: "Band-pass", def: "1 – 45 Hz", range: "1 – 50 Hz", why: "Standard EEG range for most labs." },
  { name: "Notch", def: "50 Hz", range: "50 / 60 Hz", why: "Removes line noise. 50 Hz in IN/EU, 60 Hz in US." },
];

const FAQ = [
  { q: "How do I choose filter values?", a: "Start with the context preset, then refer to the reference table inside the filter panel. Most paradigms work well with 1–45 Hz band-pass and a region-appropriate notch." },
  { q: "Where is my data stored?", a: "All parsing and cleaning runs on your local backend. Files never leave your machine." },
  { q: "Which AI providers are free?", a: "Groq (fast Llama 3.3 70B), Google Gemini 2.0 Flash, OpenRouter free tier, Mistral, Hugging Face, plus self-hosted Ollama." },
  { q: "What can the assistant do?", a: "Answer EEG questions grounded in your recording's metrics; reason about quality and state; update the filter pipeline from plain English." },
  { q: "Can I export reproducible analyses?", a: "Yes — every recording exports an HTML report, JSON pipeline manifest, and runnable MNE-Python / EEGLAB / FieldTrip code." },
  { q: "What formats are supported?", a: "EDF, BDF, CSV, MAT, JSON, TSV inputs. JSON, CSV, HTML outputs." },
];

export default function Docs() {
  return (
    <main className="mx-auto max-w-4xl px-5 sm:px-8 pt-16 pb-20">
      <section className="animate-fade-in">
        <div className="eyebrow mb-3">Documentation</div>
        <h1 className="h-display text-balance">
          A quick tour of NeuroFlow Lab.
        </h1>
        <p className="text-[rgb(var(--text-soft))] max-w-2xl mt-6 text-base leading-relaxed">
          From raw recording to clean, exportable signal — usually in under a minute.
        </p>
      </section>

      <section className="mt-14">
        <div className="eyebrow mb-3">Getting started</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
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

      <section className="mt-12">
        <div className="eyebrow mb-3">Filter reference</div>
        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-2))] text-left text-[10px] uppercase tracking-[0.04em] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-5 py-2.5 font-medium">Filter</th>
                <th className="px-5 py-2.5 font-medium">Default</th>
                <th className="px-5 py-2.5 font-medium">Range</th>
                <th className="px-5 py-2.5 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FILTERS.map((f) => (
                <tr key={f.name}>
                  <td className="px-5 py-3 font-medium">{f.name}</td>
                  <td className="px-5 py-3 mono text-[rgb(var(--muted))]">{f.def}</td>
                  <td className="px-5 py-3 mono text-[rgb(var(--muted))]">{f.range}</td>
                  <td className="px-5 py-3 text-[rgb(var(--muted))]">{f.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <div className="eyebrow mb-3">FAQ</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="surface rounded-xl p-5">
              <div className="font-medium text-sm mb-1.5">{item.q}</div>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 surface rounded-xl p-5">
        <div>
          <div className="font-medium text-sm">Ready to try it?</div>
          <div className="text-sm text-[rgb(var(--muted))]">The assistant is happy to help once you load a recording.</div>
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
