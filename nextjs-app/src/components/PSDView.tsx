"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { useTheme } from "./ThemeProvider";
import { BANDS, BAND_COLORS, BAND_ORDER, BandName, welchPSD } from "../lib/dsp";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Title, Filler);

const PALETTE = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#22d3ee", "#a78bfa", "#fb7185", "#60a5fa"];

interface Props {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
  fMax?: number;
}

export default function PSDView({ data, channelNames, sampleRate, fMax = 60 }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [logScale, setLogScale] = useState(true);
  const [selected, setSelected] = useState<boolean[]>(() => channelNames.map(() => true));

  useEffect(() => {
    setSelected(channelNames.map(() => true));
  }, [channelNames.join("|")]);

  const psds = useMemo(() => {
    const seg = Math.max(128, Math.min(1024, Math.round(sampleRate * 2)));
    return data.map((sig) => welchPSD(sig, sampleRate, seg, 0.5));
  }, [data, sampleRate]);

  const labels = psds[0]?.freqs.filter((f) => f <= fMax) ?? [];

  const datasets = psds.map((p, i) => ({
    label: channelNames[i] || `Ch${i + 1}`,
    data: p.psd.slice(0, labels.length).map((v) => (logScale ? 10 * Math.log10(v + 1e-12) : v)),
    borderColor: PALETTE[i % PALETTE.length],
    backgroundColor: PALETTE[i % PALETTE.length] + "11",
    fill: false,
    pointRadius: 0,
    borderWidth: 1.4,
    tension: 0.25,
    hidden: !selected[i],
  }));

  const muted = isDark ? "#9496AA" : "#71717E";
  const grid = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const chartData = { labels: labels.map((f) => f.toFixed(1)), datasets };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(16,18,32,0.95)" : "rgba(255,255,255,0.96)",
        borderColor: grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Frequency (Hz)", color: muted },
        ticks: { color: muted, maxTicksLimit: 12 },
        grid: { color: grid },
        border: { color: grid },
      },
      y: {
        title: { display: true, text: logScale ? "Power (dB / Hz)" : "Power (µV² / Hz)", color: muted },
        ticks: { color: muted },
        grid: { color: grid },
        border: { color: grid },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">
            Frequency domain
          </div>
          <div className="font-semibold">Power spectral density</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5 bg-[rgb(var(--surface-2))]">
            <button
              onClick={() => setLogScale(false)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                !logScale ? "bg-[rgb(var(--surface))]" : "text-[rgb(var(--muted))]"
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => setLogScale(true)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                logScale ? "bg-[rgb(var(--accent))] text-white dark:text-[rgb(20,18,25)]" : "text-[rgb(var(--muted))]"
              }`}
            >
              dB
            </button>
          </div>
        </div>
      </div>

      {/* Band swatches */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {BAND_ORDER.map((b) => (
          <span key={b} className="chip" style={{ borderColor: BAND_COLORS[b] + "66" }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: BAND_COLORS[b] }} />
            {b} · {BANDS[b][0]}-{BANDS[b][1]} Hz
          </span>
        ))}
      </div>

      <div className="relative rounded-xl bg-[rgb(var(--surface-2))] border p-4 h-[360px]">
        {/* Band shading via SVG overlay */}
        <div className="absolute inset-4 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {BAND_ORDER.map((b) => {
              const [lo, hi] = BANDS[b];
              const x0 = (lo / fMax) * 100;
              const x1 = (hi / fMax) * 100;
              return (
                <rect key={b} x={x0} y={0} width={x1 - x0} height={100} fill={BAND_COLORS[b]} opacity={0.05} />
              );
            })}
          </svg>
        </div>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Channel chips */}
      <div className="flex flex-wrap gap-1.5">
        {channelNames.map((name, i) => (
          <button
            key={name + i}
            onClick={() =>
              setSelected((p) => {
                const n = [...p];
                n[i] = !n[i];
                return n;
              })
            }
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border ${
              selected[i] ? "bg-[rgb(var(--surface-2))]" : "opacity-40"
            }`}
            style={{ borderColor: selected[i] ? PALETTE[i % PALETTE.length] + "55" : undefined }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
