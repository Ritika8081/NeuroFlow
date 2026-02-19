"use client";

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Title);

function useRegisterZoomPlugin() {
  useEffect(() => {
    import("chartjs-plugin-zoom").then((mod) => {
      if (mod && mod.default) ChartJS.register(mod.default);
    });
  }, []);
}

const COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

export default function EEGVisualization({ eegData, fullData }) {
  useRegisterZoomPlugin();
  const dataToPlot = fullData && fullData.length > 0 ? fullData : eegData.preview;
  const [visibleChannels, setVisibleChannels] = useState(() =>
    eegData.channel_names.map(() => true)
  );
  const sampleCount = dataToPlot[0]?.length || 0;

  const handleChannelToggle = (idx) => {
    setVisibleChannels((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const datasets = dataToPlot.map((channel, idx) => ({
    label: eegData.channel_names[idx] || `Ch${idx + 1}`,
    data: channel,
    borderColor: COLORS[idx % COLORS.length],
    fill: false,
    pointRadius: 0,
    borderWidth: 1.5,
    hidden: !visibleChannels[idx],
  }));

  const chartData = {
    labels: Array.from({ length: sampleCount }, (_, i) => i),
    datasets,
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: "top" },
      title: {
        display: true,
        text: `EEG (${eegData.channels} channels, ${sampleCount} samples)`,
      },
      zoom: {
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
        pan: { enabled: true, mode: "x" },
      },
    },
    scales: {
      x: { title: { display: true, text: "Sample" } },
      y: { title: { display: true, text: "Amplitude" } },
    },
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-200/20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Channels</h3>
          <div className="flex flex-wrap gap-2">
            {eegData.channel_names.map((name, idx) => (
              <label key={name} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleChannels[idx]}
                  onChange={() => handleChannelToggle(idx)}
                  className="rounded accent-teal-500"
                />
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md"
                  style={{
                    background: COLORS[idx % COLORS.length] + "22",
                    color: COLORS[idx % COLORS.length],
                  }}
                >
                  {name}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-4 text-sm text-slate-500">
          <span><strong>Rate:</strong> {eegData.sampling_rate} Hz</span>
          <span><strong>Duration:</strong> {eegData.duration_sec}s</span>
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 overflow-x-auto">
        <Line data={chartData} options={chartOptions} style={{ width: "100%" }} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Scroll to zoom, drag to pan.</p>
    </div>
  );
}
