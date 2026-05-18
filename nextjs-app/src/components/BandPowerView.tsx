"use client";

import React, { useMemo } from "react";
import { BAND_COLORS, BAND_ORDER, BandName, computeBandPowers } from "../lib/dsp";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

export default function BandPowerView({ data, channelNames, sampleRate }: Props) {
  const rows = useMemo(() => {
    return data.map((sig, i) => {
      const { bands } = computeBandPowers(sig, sampleRate);
      const total = bands.total || 1;
      const rel: Record<BandName, number> = {
        delta: bands.delta / total,
        theta: bands.theta / total,
        alpha: bands.alpha / total,
        beta: bands.beta / total,
        gamma: bands.gamma / total,
      };
      return { name: channelNames[i] || `Ch${i + 1}`, rel };
    });
  }, [data, channelNames, sampleRate]);

  const avg: Record<BandName, number> = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  for (const r of rows) for (const b of BAND_ORDER) avg[b] += r.rel[b];
  for (const b of BAND_ORDER) avg[b] /= Math.max(1, rows.length);

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">
          Per-channel band composition
        </div>
        <div className="font-semibold">Relative band power</div>
      </div>

      {/* Average bar */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Across all channels</span>
          <span className="text-[10px] text-[rgb(var(--muted))]">average</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          {BAND_ORDER.map((b) => (
            <div
              key={b}
              style={{ width: `${avg[b] * 100}%`, background: BAND_COLORS[b] }}
              title={`${b}: ${(avg[b] * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1 mt-2 text-[10px]">
          {BAND_ORDER.map((b) => (
            <div key={b} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: BAND_COLORS[b] }} />
              <span className="text-[rgb(var(--muted))]">{b}</span>
              <span className="ml-auto font-mono">{(avg[b] * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-channel rows */}
      <div className="rounded-xl border bg-[rgb(var(--surface))] divide-y max-h-[480px] overflow-auto">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-14 text-[11px] font-mono text-[rgb(var(--muted))]">{r.name}</div>
            <div className="flex h-2.5 flex-1 rounded-full overflow-hidden">
              {BAND_ORDER.map((b) => (
                <div
                  key={b}
                  style={{ width: `${r.rel[b] * 100}%`, background: BAND_COLORS[b] }}
                  title={`${b}: ${(r.rel[b] * 100).toFixed(1)}%`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
