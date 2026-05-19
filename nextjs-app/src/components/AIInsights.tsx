"use client";

import React from "react";
import { AnalysisBundle } from "../lib/insights";
import { BAND_COLORS } from "../lib/dsp";

interface Props {
  analysis: AnalysisBundle;
}

const SEVERITY_CHIP: Record<string, string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  info: "bg-[rgb(var(--accent-bg))] text-[rgb(var(--accent-fg))] border-[rgb(var(--accent))]/30",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

const SEVERITY_LABEL: Record<string, string> = {
  good: "ok",
  info: "info",
  warn: "warn",
  danger: "alert",
};

export default function AIInsights({ analysis }: Props) {
  const { findings, cognitive, dominantBand, avgBands, alphaPeakHz, asymmetry } = analysis;
  const total = avgBands.total || 1;

  return (
    <div className="space-y-5">
      {/* Headline card */}
      <div className="surface rounded-xl p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h3 className="eyebrow mb-2">Cognitive state</h3>
            <div className="text-3xl sm:text-4xl font-medium tracking-tight capitalize">
              {cognitive.state}
            </div>
            <div className="text-sm text-[rgb(var(--muted))] mt-2">
              <span className="mono">{(cognitive.confidence * 100).toFixed(0)}%</span> confidence ·
              dominant <span className="capitalize">{dominantBand}</span>
              {alphaPeakHz ? <> · alpha peak <span className="mono">{alphaPeakHz.toFixed(1)} Hz</span></> : null}
            </div>
          </div>
          <div className="flex items-end gap-1 h-10 text-[rgb(var(--accent))]/60">
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((d) => (
              <span key={d} className="wave-bar h-full" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="surface rounded-xl p-4">
          <div className="eyebrow">Dominant rhythm</div>
          <div className="text-xl font-medium mt-1 capitalize" style={{ color: BAND_COLORS[dominantBand] }}>
            {dominantBand}
          </div>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">
            <span className="mono">{((avgBands[dominantBand] / total) * 100).toFixed(0)}%</span> of spectrum
          </div>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="eyebrow">Alpha peak</div>
          <div className="text-xl font-medium mt-1 mono">
            {alphaPeakHz ? `${alphaPeakHz.toFixed(1)} Hz` : "—"}
          </div>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">posterior dominant frequency</div>
        </div>
        <div className="surface rounded-xl p-4">
          <div className="eyebrow">Findings</div>
          <div className="text-xl font-medium mt-1 mono">{findings.length}</div>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">structured observations</div>
        </div>
      </div>

      {/* Cognitive metrics */}
      <div className="surface rounded-xl p-5">
        <div className="eyebrow mb-3">Cognitive metrics</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {cognitive.metrics.map((m) => (
            <div key={m.name} className="rounded-lg border bg-[rgb(var(--surface-2))] p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-sm mono">{m.value.toFixed(2)}</div>
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">{m.explanation}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-2">
        <h3 className="eyebrow">Findings</h3>
        {findings.map((f, i) => (
          <div
            key={i}
            className="rounded-lg border bg-[rgb(var(--surface))] px-4 py-3 animate-fade-up"
            style={{ animationDelay: `${i * 20}ms` }}
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-0.5 inline-flex items-center text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${SEVERITY_CHIP[f.severity]}`}
              >
                {SEVERITY_LABEL[f.severity]}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-[rgb(var(--muted))] mt-1 leading-relaxed">{f.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {asymmetry && (
        <div className="surface rounded-xl p-5">
          <div className="eyebrow mb-1">Frontal alpha asymmetry</div>
          <div className="text-xl font-medium tracking-tight mt-1 mono">
            {asymmetry.value.toFixed(2)}
          </div>
          <div className="text-xs text-[rgb(var(--muted))] mt-1">{asymmetry.interpretation}</div>
          <div className="mt-3 relative h-1.5 rounded-full bg-[rgb(var(--surface-2))]">
            <div
              className="absolute -top-1 h-3.5 w-1 rounded bg-[rgb(var(--accent))]"
              style={{
                left: `${Math.min(100, Math.max(0, ((asymmetry.value + 0.5) / 1) * 100))}%`,
                transform: "translateX(-50%)",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[rgb(var(--muted))] mt-1">
            <span>withdrawal</span>
            <span>approach</span>
          </div>
        </div>
      )}
    </div>
  );
}
