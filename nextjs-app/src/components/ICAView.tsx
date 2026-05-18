"use client";

import React, { useMemo, useState } from "react";
import { decompose, ICAComponent, ICAComponentType, ICAResult } from "../lib/ica";
import { autoLayout } from "../lib/electrodes";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

const TYPE_COLOR: Record<ICAComponentType, { bg: string; text: string; dot: string }> = {
  brain: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  eye: { bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  muscle: { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  cardiac: { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  "line-noise": { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  other: { bg: "bg-[rgb(var(--surface-3))]", text: "text-[rgb(var(--muted))]", dot: "bg-[rgb(var(--muted))]" },
};

export default function ICAView({ data, channelNames, sampleRate }: Props) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  const result: ICAResult = useMemo(
    () => decompose(data, channelNames, sampleRate, { maxComponents: 12 }),
    // re-run when data shape changes (cleaned vs raw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelNames.join("|"), sampleRate, data.length, data[0]?.length ?? 0]
  );

  const toggle = (idx: number) => {
    setRemoved((prev) => {
      const n = new Set(prev);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
  };

  const removeByLabel = (label: ICAComponentType) => {
    setRemoved((prev) => {
      const n = new Set(prev);
      for (const c of result.components) {
        if (c.label === label) n.add(c.index);
      }
      return n;
    });
  };

  const reset = () => setRemoved(new Set());

  const counts = result.components.reduce(
    (acc, c) => {
      acc[c.label] = (acc[c.label] ?? 0) + 1;
      return acc;
    },
    {} as Record<ICAComponentType, number>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Decomposition (PCA proxy)</div>
        <h3 className="font-medium mt-1">Component review</h3>
        <p className="text-sm text-[rgb(var(--muted))] mt-1 max-w-2xl">
          Components are computed via PCA + heuristic labeling — fast and deterministic. For
          publication-grade ICA (Infomax, FastICA, AMICA), drive the cleaned data through MNE-Python
          via the code-gen tab.
        </p>
      </div>

      {/* Bulk action chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-2">Quick remove:</span>
        {(["eye", "muscle", "line-noise", "cardiac"] as ICAComponentType[]).map((label) => (
          <button
            key={label}
            onClick={() => removeByLabel(label)}
            disabled={!counts[label]}
            className={`chip ${counts[label] ? "" : "opacity-50 cursor-not-allowed"} hover:border-[rgb(var(--accent))]`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_COLOR[label].dot}`} />
            {label} ({counts[label] ?? 0})
          </button>
        ))}
        <button onClick={reset} className="btn btn-ghost text-xs ml-auto">Reset</button>
      </div>

      {/* Components grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.components.map((c) => (
          <ComponentCard
            key={c.index}
            component={c}
            channelNames={channelNames}
            removed={removed.has(c.index)}
            onToggle={() => toggle(c.index)}
          />
        ))}
      </div>

      {result.components.length === 0 && (
        <div className="surface rounded-xl p-5 text-sm text-[rgb(var(--muted))] text-center">
          Recording too short to decompose.
        </div>
      )}

      {/* Footer summary */}
      <div className="surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <span className="font-medium">{removed.size}</span>{" "}
          <span className="text-[rgb(var(--muted))]">component(s) marked for removal · </span>
          <span className="mono text-[rgb(var(--muted))]">
            {(
              [...removed]
                .map((i) => result.components[i]?.varianceExplained ?? 0)
                .reduce((a, b) => a + b, 0) * 100
            ).toFixed(1)}
            %
          </span>{" "}
          <span className="text-[rgb(var(--muted))]">of variance</span>
        </div>
        <div className="text-xs text-[rgb(var(--muted))]">
          {result.method} · {result.components.length} components
        </div>
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  channelNames,
  removed,
  onToggle,
}: {
  component: ICAComponent;
  channelNames: string[];
  removed: boolean;
  onToggle: () => void;
}) {
  const color = TYPE_COLOR[component.label];
  return (
    <div
      className={`surface rounded-xl p-4 transition ${
        removed ? "opacity-50 ring-1 ring-rose-500/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${color.bg} ${color.text}`}>
            {component.label}
          </span>
          <span className="mono text-[10px] text-[rgb(var(--muted))]">
            #{component.index + 1} · {(component.varianceExplained * 100).toFixed(1)}%
          </span>
        </div>
        <button
          onClick={onToggle}
          className={`text-xs px-2 py-1 rounded-md border ${
            removed
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40"
              : "bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
          }`}
        >
          {removed ? "Restore" : "Remove"}
        </button>
      </div>

      {/* Mini topography (SVG) */}
      <MiniTopo topography={component.topography} channelNames={channelNames} />

      {/* Mini time course */}
      <MiniSparkline timeCourse={component.timeCourse} />

      <p className="text-[11px] text-[rgb(var(--muted))] mt-2 leading-relaxed">{component.rationale}</p>
    </div>
  );
}

function MiniTopo({ topography, channelNames }: { topography: number[]; channelNames: string[] }) {
  const positions = useMemo(() => autoLayout(channelNames), [channelNames.join("|")]);
  const size = 100;
  const radius = 40;
  const center = size / 2;

  const max = Math.max(...topography.map((w) => Math.abs(w))) || 1;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-24 mb-2">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgb(var(--border))" strokeWidth="1" />
      {positions.map((pos, i) => {
        const x = center + pos.x * radius;
        const y = center - pos.y * radius;
        const w = topography[i] / max;
        const fill = w > 0 ? "rgb(220 60 80)" : "rgb(60 90 220)";
        const opacity = Math.abs(w);
        return <circle key={i} cx={x} cy={y} r={3} fill={fill} fillOpacity={opacity} />;
      })}
    </svg>
  );
}

function MiniSparkline({ timeCourse }: { timeCourse: number[] }) {
  // Downsample for rendering
  const T = timeCourse.length;
  const N = 120;
  const step = Math.max(1, Math.floor(T / N));
  const points: number[] = [];
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < T; i += step) {
    points.push(timeCourse[i]);
    if (timeCourse[i] < mn) mn = timeCourse[i];
    if (timeCourse[i] > mx) mx = timeCourse[i];
  }
  const range = mx - mn || 1;
  const w = 240;
  const h = 32;
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - mn) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mb-1">
      <path d={path} fill="none" stroke="rgb(var(--accent))" strokeWidth="1" />
    </svg>
  );
}
