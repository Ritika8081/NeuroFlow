"use client";

import React from "react";
import { buildHTMLReport, buildManifest, FilterConfig, ReportInput } from "../lib/report";
import { AnalysisBundle } from "../lib/insights";

interface Props {
  fileName: string;
  channels: number;
  channelNames: string[];
  sampleRate: number;
  duration: number;
  filters: FilterConfig;
  analysis: AnalysisBundle;
}

export default function ReportPanel(props: Props) {
  const input: ReportInput = {
    fileName: props.fileName,
    channels: props.channels,
    sampleRate: props.sampleRate,
    duration: props.duration,
    channelNames: props.channelNames,
    filters: props.filters,
    analysis: props.analysis,
  };

  const downloadReport = () => {
    const html = buildHTMLReport(input);
    triggerDownload(new Blob([html], { type: "text/html" }), `${stripExt(props.fileName)}.report.html`);
  };

  const downloadManifest = () => {
    const manifest = buildManifest(input);
    triggerDownload(
      new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
      `${stripExt(props.fileName)}.manifest.json`
    );
  };

  const openPreview = () => {
    const html = buildHTMLReport(input);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="eyebrow mb-1">
            AI-generated report
          </div>
          <h3 className="font-semibold text-lg mb-2">Clinical-style summary</h3>
          <p className="text-sm text-[rgb(var(--muted))] mb-4">
            One-click HTML report with all metrics, findings, per-channel band powers, and your
            full pre-processing pipeline. Print-ready, self-contained, opens in any browser.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openPreview} className="btn btn-primary text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              Preview report
            </button>
            <button onClick={downloadReport} className="btn btn-secondary text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
              Download HTML
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="eyebrow mb-1">
            Reproducibility
          </div>
          <h3 className="font-semibold text-lg mb-2">Pipeline manifest</h3>
          <p className="text-sm text-[rgb(var(--muted))] mb-4">
            Versioned JSON manifest with the exact filter chain, derived metrics, and tool version —
            so anyone can replay your analysis byte-for-byte.
          </p>
          <button onClick={downloadManifest} className="btn btn-secondary text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h12l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
            Download manifest.json
          </button>
        </div>
      </div>

      {/* Report preview */}
      <div className="glass rounded-2xl p-5">
        <div className="eyebrow mb-3">
          What's included
        </div>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-[rgb(var(--muted))]">
          {[
            "Cognitive state classification + confidence",
            "Dominant rhythm and alpha peak frequency",
            "Full quality breakdown (0–100)",
            "All AI findings with severity",
            "Per-channel band power table",
            "Pre-processing pipeline (filters + cut-offs)",
            "Reproducibility manifest (JSON-embedded)",
            "Self-contained HTML — opens offline",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))] shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
