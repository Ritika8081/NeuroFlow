"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { spectrogram } from "../lib/dsp";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
  fMax?: number;
}

/** viridis-like colormap (good for perception, similar to MNE default). */
function cmap(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const stops: [number, number, number][] = [
    [68, 1, 84],
    [59, 82, 139],
    [33, 144, 140],
    [94, 201, 98],
    [253, 231, 37],
  ];
  const pos = t * (stops.length - 1);
  const i = Math.floor(pos);
  const f = pos - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export default function SpectrogramView({ data, channelNames, sampleRate, fMax = 50 }: Props) {
  const [channelIdx, setChannelIdx] = useState(0);
  useEffect(() => {
    setChannelIdx(0);
  }, [channelNames.join("|")]);

  const sg = useMemo(() => {
    const sig = data[channelIdx] || data[0];
    return spectrogram(sig, sampleRate, Math.max(0.5, Math.min(2, sampleRate / 256)), 0.75, fMax);
  }, [data, channelIdx, sampleRate, fMax]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // compute min/max for normalization
  const { vmin, vmax } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const row of sg.matrix) {
      for (const v of row) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!isFinite(mn)) mn = 0;
    if (!isFinite(mx)) mx = 1;
    return { vmin: mn, vmax: mx };
  }, [sg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const T = sg.matrix.length;
    const F = sg.freqs.length;
    if (T === 0 || F === 0) return;
    canvas.width = T;
    canvas.height = F;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(T, F);
    for (let t = 0; t < T; t++) {
      for (let f = 0; f < F; f++) {
        const v = (sg.matrix[t][f] - vmin) / (vmax - vmin || 1);
        const [r, g, b] = cmap(v);
        // flip vertically so low frequencies at bottom
        const y = F - 1 - f;
        const idx = (y * T + t) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [sg, vmin, vmax]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">
            Time-frequency
          </div>
          <div className="font-semibold">Spectrogram · {channelNames[channelIdx]}</div>
        </div>
        <select
          value={channelIdx}
          onChange={(e) => setChannelIdx(Number(e.target.value))}
          className="input select w-auto"
        >
          {channelNames.map((n, i) => (
            <option key={i} value={i}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="relative rounded-xl bg-[rgb(var(--surface-2))] border p-4">
        <div className="relative h-[320px] w-full">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full rounded-md"
            style={{ imageRendering: "pixelated" }}
          />
          {/* Axes */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-1 text-[10px] text-[rgb(var(--muted))]">
              <span>{fMax} Hz</span>
              <span>{Math.round(fMax / 2)} Hz</span>
              <span>0 Hz</span>
            </div>
            <div className="absolute left-12 right-0 bottom-0 flex justify-between text-[10px] text-[rgb(var(--muted))]">
              <span>0 s</span>
              <span>{(sg.times[sg.times.length - 1] || 0).toFixed(1)} s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[rgb(var(--muted))]">
        <span>Power (log scale)</span>
        <div className="flex items-center gap-2">
          <span>low</span>
          <div
            className="h-2 w-40 rounded"
            style={{
              background:
                "linear-gradient(90deg, rgb(68,1,84), rgb(59,82,139), rgb(33,144,140), rgb(94,201,98), rgb(253,231,37))",
            }}
          />
          <span>high</span>
        </div>
      </div>
    </div>
  );
}
