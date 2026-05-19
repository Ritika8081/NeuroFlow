"use client";

import React from "react";
import { AnalysisBundle } from "../lib/insights";

interface Props {
  analysis: AnalysisBundle;
  channelNames: string[];
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (s >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function scoreBarColor(s: number) {
  if (s >= 80) return "bg-emerald-500";
  if (s >= 60) return "bg-amber-500";
  return "bg-red-500";
}
function ringStroke(s: number) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function QualityDashboard({ analysis, channelNames }: Props) {
  const { quality } = analysis;
  const badSet = new Set(quality.badChannels);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Overall ring */}
        <div className="glass rounded-2xl p-5 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" stroke="rgb(var(--border))" strokeWidth="8" fill="none" />
              <circle
                cx="60"
                cy="60"
                r="52"
                stroke={ringStroke(quality.overall)}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(quality.overall / 100) * 327} 327`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-semibold ${scoreColor(quality.overall)}`}>
                {quality.overall}
              </span>
              <span className="text-[10px] text-[rgb(var(--muted))] uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="text-sm font-medium mt-2">Recording quality</div>
        </div>

        {/* Components */}
        <div className="sm:col-span-2 glass rounded-2xl p-5 space-y-3">
          <h3 className="eyebrow">
            Score breakdown
          </h3>
          {quality.components.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{c.name}</span>
                <span className={`font-mono ${scoreColor(c.value)}`}>{c.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[rgb(var(--surface-2))] overflow-hidden">
                <div
                  className={`h-full ${scoreBarColor(c.value)}`}
                  style={{ width: `${c.value}%` }}
                />
              </div>
              <div className="text-[10px] text-[rgb(var(--muted))] mt-0.5">{c.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel matrix */}
      <div className="glass rounded-2xl p-5">
        <h3 className="eyebrow mb-3">
          Channel health · {channelNames.length} channels
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {channelNames.map((name, i) => {
            const bad = badSet.has(name);
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border ${
                  bad
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                }`}
                title={bad ? "Flagged: flat / saturated" : "OK"}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${bad ? "bg-rose-400" : "bg-emerald-400"}`} />
                {name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Artifact summary */}
      <div className="glass rounded-2xl p-5">
        <h3 className="eyebrow mb-3">
          Detected artifacts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { k: "blink", label: "Blinks" },
            { k: "muscle", label: "Muscle (EMG)" },
            { k: "line-noise", label: "Mains noise" },
            { k: "amplitude", label: "Spikes" },
          ].map((c) => {
            const count = analysis.findings.find((f) => f.title.toLowerCase().includes(c.k))
              ? (analysis.findings.find((f) => f.title.toLowerCase().includes(c.k))?.title.match(/\d+/)?.[0] ?? "0")
              : "0";
            return (
              <div key={c.k} className="rounded-lg border bg-[rgb(var(--surface-2))] p-3">
                <div className="eyebrow">{c.label}</div>
                <div className="text-xl font-medium mono mt-1">{count}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-[rgb(var(--muted))] mt-3">
          {quality.artifactCount} artifact events flagged across all channels. Use the Annotations
          tab to inspect them in context.
        </div>
      </div>
    </div>
  );
}
