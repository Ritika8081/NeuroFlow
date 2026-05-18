"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { autoLayout } from "../lib/electrodes";
import { BAND_COLORS, BAND_ORDER, BandName, computeBandPowers } from "../lib/dsp";

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

function cmap(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  // RdBu-ish, diverging
  if (t < 0.5) {
    const k = t * 2;
    // blue → white
    return [Math.round(33 + k * 222), Math.round(102 + k * 153), Math.round(172 + k * 83)];
  } else {
    const k = (t - 0.5) * 2;
    // white → red
    return [Math.round(255 - k * 70), Math.round(255 - k * 230), Math.round(255 - k * 215)];
  }
}

const SIZE = 320;
const RADIUS = 120;
const CENTER = SIZE / 2;

export default function TopographyView({ data, channelNames, sampleRate }: Props) {
  const [band, setBand] = useState<BandName>("alpha");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const positions = useMemo(() => autoLayout(channelNames), [channelNames.join("|")]);

  const values = useMemo(() => {
    return data.map((sig) => {
      const { bands } = computeBandPowers(sig, sampleRate);
      const total = bands.total || 1;
      return bands[band] / total; // relative power
    });
  }, [data, sampleRate, band]);

  const { vmin, vmax, mean } = useMemo(() => {
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const m = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    return { vmin: mn, vmax: mx, mean: m };
  }, [values]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Build point list (channel x/y in pixel space)
    const pts = positions.map((e, i) => ({
      x: CENTER + e.x * RADIUS,
      y: CENTER - e.y * RADIUS,
      v: values[i] ?? 0,
    }));

    const img = ctx.createImageData(SIZE, SIZE);
    const range = vmax - vmin || 1;
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const dx = px - CENTER;
        const dy = py - CENTER;
        const r2 = dx * dx + dy * dy;
        if (r2 > RADIUS * RADIUS) continue;
        // inverse distance weighting
        let num = 0;
        let den = 0;
        for (const p of pts) {
          const ddx = px - p.x;
          const ddy = py - p.y;
          const d2 = ddx * ddx + ddy * ddy + 1;
          const w = 1 / (d2 * d2); // sharp
          num += p.v * w;
          den += w;
        }
        const v = den > 0 ? num / den : mean;
        const norm = (v - vmin) / range;
        const [r, g, b] = cmap(norm);
        const idx = (py * SIZE + px) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 220;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Head outline + nose
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(120,120,140,0.7)";
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CENTER - 12, CENTER - RADIUS + 2);
    ctx.lineTo(CENTER, CENTER - RADIUS - 14);
    ctx.lineTo(CENTER + 12, CENTER - RADIUS + 2);
    ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.arc(CENTER - RADIUS, CENTER, 12, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CENTER + RADIUS, CENTER, 12, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();

    // Plot electrodes
    pts.forEach((p, i) => {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "rgba(20,20,30,0.55)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(20,20,30,0.85)";
      ctx.font = "10px ui-sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(channelNames[i] || `Ch${i + 1}`, p.x, p.y - 7);
    });
  }, [positions, values, vmin, vmax, mean, channelNames]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">
            Spatial
          </div>
          <div className="font-semibold">Topographic map · {band} relative power</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {BAND_ORDER.map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition ${
                band === b
                  ? "bg-[rgb(var(--surface-2))]"
                  : "text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]"
              }`}
              style={{ borderColor: band === b ? BAND_COLORS[b] + "88" : undefined }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="rounded-xl bg-[rgb(var(--surface-2))] border p-4 flex items-center justify-center">
          <canvas ref={canvasRef} className="rounded-md" style={{ width: SIZE, height: SIZE }} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="text-xs text-[rgb(var(--muted))]">
            Scalp-projected relative power for the selected band. Estimated via inverse-distance
            interpolation across known 10-20 positions. Use to spot lateralized or focal activity.
          </div>
          <div className="flex items-center justify-between text-[11px] text-[rgb(var(--muted))]">
            <span>{(vmin * 100).toFixed(0)}%</span>
            <div
              className="h-2 flex-1 mx-2 rounded"
              style={{
                background:
                  "linear-gradient(90deg, rgb(33,102,172), rgb(255,255,255), rgb(185,25,40))",
              }}
            />
            <span>{(vmax * 100).toFixed(0)}%</span>
          </div>
          <div className="text-[11px] text-[rgb(var(--muted))] italic">
            Note: unknown channel positions are placed on a fallback ring.
          </div>
        </div>
      </div>
    </div>
  );
}
