import React from "react";
import Link from "next/link";

const FEATURES = [
  {
    title: "Context-aware presets",
    body: "Filter defaults adapt to the recording paradigm — resting, task, sleep, BCI, or consumer device.",
  },
  {
    title: "Live cleaning",
    body: "Adjust any filter and the visualization updates in milliseconds. No round-trips, no waiting.",
  },
  {
    title: "Local-first",
    body: "Recordings stay on your machine. BYO AI keys never leave your browser. No telemetry, ever.",
  },
  {
    title: "AI assistant",
    body: "Bring your own model — Groq, Gemini, OpenRouter, all free. Or Anthropic / OpenAI if you prefer.",
  },
  {
    title: "Reproducible",
    body: "Every analysis exports a manifest + runnable MNE / EEGLAB code. Replay byte-for-byte.",
  },
  {
    title: "Open formats",
    body: "EDF, BDF, CSV, MAT, JSON in. JSON, CSV, HTML out. Plays well with MNE, EEGLAB, BIDS.",
  },
];

export default function About() {
  return (
    <main className="mx-auto max-w-4xl px-5 sm:px-8 pt-16 pb-20">
      <section className="animate-fade-in">
        <div className="eyebrow mb-3">About</div>
        <h1 className="h-display text-balance">
          Making EEG accessible, reproducible, and fast.
        </h1>
        <p className="text-[rgb(var(--text-soft))] max-w-2xl mt-6 text-base leading-relaxed">
          NeuroFlow Lab is an open-source workspace for modern EEG research. Upload a recording, dial in
          context-aware filters, compare raw and cleaned signals side by side, and export ready for analysis.
        </p>
      </section>

      <section className="mt-14 grid gap-px bg-[rgb(var(--border))] sm:grid-cols-2 lg:grid-cols-3 rounded-xl overflow-hidden border">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-[rgb(var(--surface))] p-5">
            <div className="font-medium text-sm">{f.title}</div>
            <div className="text-sm text-[rgb(var(--muted))] mt-1 leading-relaxed">{f.body}</div>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="eyebrow mb-3">Mission</div>
        <h2 className="text-xl font-medium tracking-tight mb-3">Why we built this</h2>
        <p className="text-[rgb(var(--text-soft))] leading-relaxed mb-4 max-w-2xl">
          EEG preprocessing is full of subtle, paradigm-specific choices. Mis-set a high-pass and your
          delta band vanishes; pick the wrong notch and line noise contaminates results. NeuroFlow Lab
          encodes those best practices as sane defaults — and gets out of the way when you need control.
        </p>
        <ul className="grid sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm text-[rgb(var(--text-soft))] max-w-2xl">
          {[
            "Bridge research and practical analysis",
            "Reduce preprocessing errors with guardrails",
            "Make workflows transparent and shareable",
            "Support open science and reproducibility",
          ].map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 rounded-full bg-[rgb(var(--muted))] shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 surface rounded-xl p-5">
        <div>
          <div className="font-medium text-sm">Ready to explore your data?</div>
          <div className="text-sm text-[rgb(var(--muted))]">It only takes a recording and a few seconds.</div>
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
