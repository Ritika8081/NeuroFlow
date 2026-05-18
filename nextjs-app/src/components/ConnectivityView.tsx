"use client";

import React, { useMemo, useState } from "react";
import { computeConnectivity } from "../lib/connectivity";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

type Metric = "pearson" | "alphaCoherence";

function cmap(v: number): string {
  // -1..1 → diverging blue-white-red
  if (v >= 0) {
    const t = Math.min(1, v);
    const r = Math.round(255 - t * 70);
    const g = Math.round(255 - t * 230);
    const b = Math.round(255 - t * 215);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = Math.min(1, -v);
    const r = Math.round(255 - t * 222);
    const g = Math.round(255 - t * 153);
    const b = Math.round(255 - t * 83);
    return `rgb(${r},${g},${b})`;
  }
}

export default function ConnectivityView({ data, channelNames, sampleRate }: Props) {
  const [metric, setMetric] = useState<Metric>("pearson");

  const conn = useMemo(
    () => computeConnectivity(data, channelNames, sampleRate),
    [data, channelNames.join("|"), sampleRate]
  );

  const matrix = metric === "pearson" ? conn.pearson : conn.alphaCoherence;
  const n = matrix.length;
  const cell = 24;
  const labelW = 36;
  const w = labelW + n * cell;
  const h = labelW + n * cell;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow">Connectivity</div>
          <div className="font-medium">Channel × channel</div>
        </div>
        <div className="inline-flex rounded-md border bg-[rgb(var(--surface))]">
          <button
            onClick={() => setMetric("pearson")}
            className={`px-3 py-1.5 text-xs transition first:rounded-l-md last:rounded-r-md ${
              metric === "pearson" ? "bg-[rgb(var(--surface-2))]" : "text-[rgb(var(--muted))]"
            }`}
          >
            Pearson
          </button>
          <button
            onClick={() => setMetric("alphaCoherence")}
            className={`px-3 py-1.5 text-xs transition first:rounded-l-md last:rounded-r-md ${
              metric === "alphaCoherence" ? "bg-[rgb(var(--surface-2))]" : "text-[rgb(var(--muted))]"
            }`}
          >
            α coherence
          </button>
        </div>
      </div>

      <div className="surface rounded-xl p-4 overflow-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="block" style={{ minWidth: w, height: h }}>
          {conn.channels.map((c, i) => (
            <text
              key={`col${i}`}
              x={labelW + i * cell + cell / 2}
              y={labelW - 6}
              fontSize="9"
              fill="rgb(var(--muted))"
              textAnchor="middle"
            >
              {c}
            </text>
          ))}
          {conn.channels.map((c, i) => (
            <text
              key={`row${i}`}
              x={labelW - 6}
              y={labelW + i * cell + cell / 2 + 3}
              fontSize="9"
              fill="rgb(var(--muted))"
              textAnchor="end"
            >
              {c}
            </text>
          ))}
          {matrix.map((row, i) =>
            row.map((v, j) => (
              <rect
                key={`${i}-${j}`}
                x={labelW + j * cell}
                y={labelW + i * cell}
                width={cell - 1}
                height={cell - 1}
                fill={cmap(v)}
              >
                <title>{`${conn.channels[i]} ↔ ${conn.channels[j]}: ${v.toFixed(2)}`}</title>
              </rect>
            ))
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs text-[rgb(var(--muted))]">
        <span>{metric === "pearson" ? "Raw signal correlation" : "Alpha-band power coherence"}</span>
        <div className="flex items-center gap-2">
          <span>−1</span>
          <div
            className="h-2 w-32 rounded"
            style={{ background: "linear-gradient(90deg, rgb(33,102,172), white, rgb(185,25,40))" }}
          />
          <span>+1</span>
        </div>
      </div>

      <div className="surface rounded-xl p-5">
        <div className="eyebrow mb-2">Strongest channel pairs</div>
        <div className="divide-y border rounded-lg overflow-hidden">
          {conn.topPairs.map((p, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="mono text-[rgb(var(--muted))] w-6">#{i + 1}</span>
              <span className="flex-1">{p.a} ↔ {p.b}</span>
              <span className={`mono ${p.r > 0 ? "text-red-500" : "text-blue-500"}`}>
                {p.r >= 0 ? "+" : ""}{p.r.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
