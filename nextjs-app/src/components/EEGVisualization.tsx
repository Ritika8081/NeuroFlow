import React from "react";
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

// Register core Chart.js elements immediately
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Title);

// Dynamically import and register chartjs-plugin-zoom only on client
import { useEffect } from "react";

function useRegisterZoomPlugin() {
  useEffect(() => {
    // Only run on client
    import("chartjs-plugin-zoom").then((mod) => {
      if (mod && mod.default) {
        ChartJS.register(mod.default);
      }
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

const COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
];


export default function EEGVisualization({ eegData, fullData }: EEGVisualizationProps) {
  useRegisterZoomPlugin();
  // Always show all available samples (fullData if present, else preview)
  const dataToPlot = fullData && fullData.length > 0 ? fullData : eegData.preview;
  const [visibleChannels, setVisibleChannels] = React.useState(
    () => eegData.channel_names.map(() => true)
  );
  const sampleCount = dataToPlot[0]?.length || 0;

  const handleChannelToggle = (idx: number) => {
    setVisibleChannels((prev) => {
      const updated = [...prev];
      updated[idx] = !updated[idx];
      return updated;
    });
  };

  const datasets = dataToPlot
    .map((channel, idx) => ({
      label: eegData.channel_names[idx] || `Ch${idx+1}`,
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
      legend: { display: true, position: 'top' as const },
      title: {
        display: true,
        text: `EEG Visualization (${eegData.channels} channels, ${sampleCount} samples)`
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x" as const,
        },
        pan: {
          enabled: true,
          mode: "x" as const,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: "Sample" } },
      y: { title: { display: true, text: "Amplitude" } },
    },
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-10 p-6 bg-white/80 dark:bg-zinc-900/80 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 text-blue-700 dark:text-blue-300 flex items-center gap-2">
            EEG Visualization
            <span className="relative group cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <span className="absolute left-6 top-0 z-10 hidden group-hover:block bg-white text-xs text-zinc-700 border border-zinc-200 rounded px-2 py-1 shadow-lg w-56">
                EEG (Electroencephalogram) visualizes brainwave activity from multiple channels. Use zoom/pan to explore data.
              </span>
            </span>
          </h2>
          <div className="text-sm text-zinc-600 dark:text-zinc-300 flex flex-wrap items-center gap-2">
            <span className="font-semibold flex items-center gap-1">Channels
              <span className="relative group cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
                <span className="absolute left-5 top-0 z-10 hidden group-hover:block bg-white text-xs text-zinc-700 border border-zinc-200 rounded px-2 py-1 shadow-lg w-44">
                  Each channel represents a different electrode position on the scalp.
                </span>
              </span>
            </span>:
            {eegData.channel_names.map((name, idx) => (
              <label key={name} className="flex items-center gap-1 ml-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleChannels[idx]}
                  onChange={() => handleChannelToggle(idx)}
                  className="accent-blue-600"
                />
                <span
                  className="font-mono px-2 py-1 rounded"
                  style={{ background: COLORS[idx % COLORS.length] + '22', color: COLORS[idx % COLORS.length] }}
                >
                  {name}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100/60 dark:bg-zinc-800/60 rounded-lg px-3 py-2">
          <span><b>Sampling Rate:</b> {eegData.sampling_rate} Hz</span>
          <span><b>Duration:</b> {eegData.duration_sec} sec</span>
          <span><b>Samples:</b> {sampleCount}</span>
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-950 rounded-xl p-4 shadow-inner border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
        <div style={{ width: '100%' }}>
          <Line data={chartData} options={chartOptions} style={{ width: '100%' }} />
        </div>
      </div>
      <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Removed preview/full toggle, always show all samples */}
        <span className="text-xs text-zinc-400 italic">Use mouse wheel or pinch to zoom, drag to pan.</span>
      </div>
    </div>
  );
}
