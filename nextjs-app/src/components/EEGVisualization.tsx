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
} from "chart.js";
import { useTheme } from "./ThemeProvider";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Title);

function useRegisterZoomPlugin() {
  useEffect(() => {
    import("chartjs-plugin-zoom").then((mod) => {
      if (mod && mod.default) ChartJS.register(mod.default);
    });
  }, []);
}

interface EEGVisualizationProps {
  eegData: {
    channels: number;
    sampling_rate: number;
    duration_sec: number;
    data_shape: [number, number];
    channel_names: string[];
    preview: number[][];
  };
  fullData?: number[][];
}

const PALETTE = [
  "#818cf8", // indigo-400
  "#f472b6", // pink-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#22d3ee", // cyan-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#60a5fa", // blue-400
  "#facc15", // yellow-400
  "#f87171", // red-400
];

export default function EEGVisualization({ eegData, fullData }: EEGVisualizationProps) {
  useRegisterZoomPlugin();
  const { theme } = useTheme();

  const dataToPlot = fullData && fullData.length > 0 ? fullData : eegData.preview;
  const sampleCount = dataToPlot[0]?.length || 0;

  const [visibleChannels, setVisibleChannels] = useState<boolean[]>(() =>
    eegData.channel_names.map(() => true)
  );

  // resync when channel list changes
  useEffect(() => {
    setVisibleChannels(eegData.channel_names.map(() => true));
  }, [eegData.channel_names.join("|")]);

  const handleToggle = (idx: number) => {
    setVisibleChannels((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const allOn = visibleChannels.every(Boolean);

  const setAll = (on: boolean) => setVisibleChannels(eegData.channel_names.map(() => on));

  const datasets = useMemo(
    () =>
      dataToPlot.map((channel, idx) => ({
        label: eegData.channel_names[idx] || `Ch${idx + 1}`,
        data: channel,
        borderColor: PALETTE[idx % PALETTE.length],
        backgroundColor: PALETTE[idx % PALETTE.length] + "22",
        fill: false,
        pointRadius: 0,
        borderWidth: 1.4,
        tension: 0.18,
        hidden: !visibleChannels[idx],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataToPlot, visibleChannels, eegData.channel_names.join("|")]
  );

  const chartData = {
    labels: Array.from({ length: sampleCount }, (_, i) => i),
    datasets,
  };

  const isDark = theme === "dark";
  const fg = isDark ? "#ECEEF8" : "#0F111A";
  const muted = isDark ? "#9496AA" : "#71717E";
  const grid = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(16,18,32,0.95)" : "rgba(255,255,255,0.96)",
        titleColor: fg,
        bodyColor: fg,
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x" as const,
        },
        pan: { enabled: true, mode: "x" as const },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Sample", color: muted },
        ticks: { color: muted, maxTicksLimit: 10 },
        grid: { color: grid, drawTicks: false },
        border: { color: grid },
      },
      y: {
        title: { display: true, text: "Amplitude", color: muted },
        ticks: { color: muted },
        grid: { color: grid, drawTicks: false },
        border: { color: grid },
      },
    },
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 border-b">
        <div>
          <div className="eyebrow">Waveform</div>
          <div className="font-semibold tracking-tight flex items-center gap-2 mt-1">
            Channel viewer
            <span className="chip mono">{sampleCount.toLocaleString()} samples</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <span className="hidden sm:inline">Zoom <kbd className="kbd">wheel</kbd></span>
          <span className="hidden sm:inline">Pan <kbd className="kbd">drag</kbd></span>
        </div>
      </div>

      {/* Channel chips */}
      <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAll(!allOn)}
          className="text-[11px] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] underline underline-offset-2"
        >
          {allOn ? "Hide all" : "Show all"}
        </button>
        <span className="text-[rgb(var(--border))]">·</span>
        <div className="flex flex-wrap gap-1.5">
          {eegData.channel_names.map((name, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const active = visibleChannels[idx];
            return (
              <button
                key={name + idx}
                onClick={() => handleToggle(idx)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition ${
                  active
                    ? "bg-[rgb(var(--surface-2))] text-[rgb(var(--foreground))]"
                    : "opacity-40 hover:opacity-70"
                }`}
                style={{ borderColor: active ? color + "55" : undefined }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-xl bg-[rgb(var(--surface-2))] p-4 border h-[400px]">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[rgb(var(--muted))]">
        <span>
          {eegData.channels} channels · {eegData.sampling_rate} Hz · {eegData.duration_sec}s
        </span>
        <span className="italic">Use mouse wheel or pinch to zoom, drag to pan.</span>
      </div>
    </div>
  );
}
