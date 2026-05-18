"use client";

import React, { useMemo } from "react";
import { SLEEP_STAGE_COLORS, SLEEP_STAGES, SleepStage, stageRecording } from "../lib/sleep";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

export default function SleepStagingView({ data, channelNames, sampleRate }: Props) {
  const report = useMemo(
    () => stageRecording({ data, channelNames, sampleRate }),
    [data, channelNames.join("|"), sampleRate]
  );

  const stageRank: Record<SleepStage, number> = { W: 0, REM: 1, N1: 2, N2: 3, N3: 4 };

  // Build hypnogram path (stepwise) using stage rank on y
  const width = 800;
  const height = 160;
  const padding = { top: 12, right: 16, bottom: 22, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const totalSec = report.totalRecordingSec || 1;
  const xOf = (sec: number) => padding.left + (sec / totalSec) * innerW;
  const yOf = (stage: SleepStage) => padding.top + (stageRank[stage] / 4) * innerH;

  const points: string[] = [];
  report.epochs.forEach((e, i) => {
    const x0 = xOf(e.startSec);
    const x1 = xOf(e.endSec);
    const y = yOf(e.stage);
    if (i === 0) points.push(`M ${x0} ${y}`);
    else points.push(`L ${x0} ${y}`);
    points.push(`L ${x1} ${y}`);
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Sleep analysis (heuristic)</div>
        <h3 className="font-medium mt-1">Hypnogram · {report.channelUsed}</h3>
        <p className="text-xs text-[rgb(var(--muted))] mt-1">
          30-second epoch staging using band-power features + spindle / K-complex detection. Research
          convenience — not a substitute for expert review.
        </p>
      </div>

      {/* Stage breakdown */}
      <div className="grid grid-cols-5 gap-2">
        {SLEEP_STAGES.map((s) => (
          <div key={s} className="surface rounded-lg p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SLEEP_STAGE_COLORS[s] }} />
              <span className="text-[10px] font-medium text-[rgb(var(--muted))]">{s}</span>
            </div>
            <div className="mono text-lg mt-1">
              {(report.perStagePct[s] * 100).toFixed(0)}<span className="text-xs text-[rgb(var(--muted))]">%</span>
            </div>
            <div className="text-[10px] text-[rgb(var(--muted))]">{Math.round(report.perStageSec[s])}s</div>
          </div>
        ))}
      </div>

      {/* Hypnogram */}
      <div className="surface rounded-xl p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ aspectRatio: `${width}/${height}` }}>
          {/* Y axis labels */}
          {SLEEP_STAGES.map((s) => (
            <g key={s}>
              <line
                x1={padding.left}
                x2={padding.left + innerW}
                y1={yOf(s)}
                y2={yOf(s)}
                stroke="rgb(var(--border))"
                strokeWidth="0.5"
              />
              <text
                x={padding.left - 6}
                y={yOf(s) + 3}
                fontSize="9"
                fill="rgb(var(--muted))"
                textAnchor="end"
              >
                {s}
              </text>
            </g>
          ))}
          {/* Path */}
          <path
            d={points.join(" ")}
            fill="none"
            stroke="rgb(var(--accent))"
            strokeWidth="1.5"
            strokeLinejoin="miter"
            strokeLinecap="square"
          />
          {/* Time axis */}
          <line
            x1={padding.left}
            x2={padding.left + innerW}
            y1={padding.top + innerH}
            y2={padding.top + innerH}
            stroke="rgb(var(--border))"
          />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text
              key={t}
              x={padding.left + t * innerW}
              y={height - 6}
              fontSize="9"
              fill="rgb(var(--muted))"
              textAnchor="middle"
            >
              {Math.round(t * totalSec)}s
            </text>
          ))}
        </svg>
      </div>

      {/* Events summary */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="surface rounded-lg p-3">
          <div className="eyebrow">Spindles</div>
          <div className="mono text-xl mt-1">{report.spindleCount}</div>
          <div className="text-[10px] text-[rgb(var(--muted))]">
            {report.totalSpindlesPerMin.toFixed(1)} /min · σ-band bursts
          </div>
        </div>
        <div className="surface rounded-lg p-3">
          <div className="eyebrow">K-complexes</div>
          <div className="mono text-xl mt-1">{report.kComplexCount}</div>
          <div className="text-[10px] text-[rgb(var(--muted))]">large biphasic deflections</div>
        </div>
        <div className="surface rounded-lg p-3">
          <div className="eyebrow">Epochs</div>
          <div className="mono text-xl mt-1">{report.epochs.length}</div>
          <div className="text-[10px] text-[rgb(var(--muted))]">staged segments</div>
        </div>
      </div>
    </div>
  );
}
