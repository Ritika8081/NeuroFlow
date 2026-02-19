"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(zoomPlugin, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Title);
import {
  uploadFile,
  parseEeg,
  cleanEeg,
  loadPhysioNet,
  physioNetInfo,
  bandPower,
  computePsd,
  computeTimeFreqSpectrogram,
  computeSpectralEntropy,
  computeHjorth,
  computeEegMetrics,
  computeAiInsights,
} from "@/lib/api";
import { useEEGData } from "@/app/context/EEGDataContext";

const FILTER_PRESETS = {
  research: { bandpass_low: 1, bandpass_high: 45, notch_freq: 50 },
  clinical: { bandpass_low: 0.5, bandpass_high: 50, notch_freq: 50 },
  neurofeedback: { bandpass_low: 4, bandpass_high: 30, notch_freq: 50 },
  sleep: { bandpass_low: 0.1, bandpass_high: 30, notch_freq: 50 },
  teaching: { bandpass_low: 1, bandpass_high: 45, notch_freq: 50 },
};

const createSyncHandler = (otherRef) => (ctx) => {
  const source = ctx.chart;
  const other = otherRef?.current;
  if (!other || other === source) return;
  const xScale = source.scales?.x;
  if (!xScale || xScale.min == null || xScale.max == null) return;
  other.options.scales.x.min = xScale.min;
  other.options.scales.x.max = xScale.max;
  other.update("none");
};

const eegChartOptions = (samplingRate, otherChartRef) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "top" },
    zoom: {
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: "x",
        scaleMode: "x",
        onZoomComplete: createSyncHandler(otherChartRef),
      },
      pan: {
        enabled: true,
        mode: "x",
        onPanComplete: createSyncHandler(otherChartRef),
      },
    },
  },
  scales: {
    x: {
      title: { display: true, text: "Time (s)" },
      ticks: {
        maxTicksLimit: 12,
        callback: function (_, i, ticks) {
          const val = ticks[i]?.value;
          return samplingRate && typeof val === "number" ? (val / samplingRate).toFixed(2) : val;
        },
      },
    },
    y: {
      display: true,
      title: { display: true, text: "Amplitude (a.u.)" },
      ticks: { maxTicksLimit: 8 },
    },
  },
});

const chartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: "top" } },
  scales: { x: {}, y: { beginAtZero: true } },
});

function dBtoColor(db, vmin = -3, vmax = 3) {
  const t = Math.max(0, Math.min(1, (db - vmin) / (vmax - vmin)));
  if (t < 0.5) {
    const u = t * 2;
    const r = Math.round(25 + (94 - 25) * u);
    const g = Math.round(97 + (179 - 97) * u);
    const b = Math.round(222 + (229 - 222) * u);
    return `rgb(${r},${g},${b})`;
  }
  const u = (t - 0.5) * 2;
  const r = Math.round(94 + (239 - 94) * u);
  const g = Math.round(179 + (138 - 179) * u);
  const b = Math.round(229 + (98 - 229) * u);
  return `rgb(${r},${g},${b})`;
}

function SpectrogramHeatmap({ timesMs, frequenciesHz, dbMatrix }) {
  const canvasRef = React.useRef(null);
  const vmin = -3;
  const vmax = 3;
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dbMatrix?.length || !timesMs?.length || !frequenciesHz?.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const pad = { left: 56, right: 72, top: 24, bottom: 40 };
    const cw = canvas.parentElement?.clientWidth || 600;
    const ch = 380;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.scale(dpr, dpr);

    const plotW = cw - pad.left - pad.right;
    const plotH = ch - pad.top - pad.bottom;
    const nFreq = dbMatrix.length;
    const nTime = dbMatrix[0]?.length || 0;
    if (nFreq === 0 || nTime === 0) return;

    const tMin = timesMs[0];
    const tMax = timesMs[timesMs.length - 1];
    const fMin = Math.min(...frequenciesHz);
    const fMax = Math.max(...frequenciesHz);

    for (let fi = 0; fi < nFreq; fi++) {
      for (let ti = 0; ti < nTime; ti++) {
        const db = dbMatrix[fi][ti];
        const x = pad.left + (ti / (nTime - 1 || 1)) * plotW;
        const y = pad.top + plotH - (fi / (nFreq - 1 || 1)) * plotH;
        const cellW = plotW / nTime + 1;
        const cellH = plotH / nFreq + 1;
        ctx.fillStyle = dBtoColor(db, vmin, vmax);
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    ctx.fillStyle = "#334155";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time relative to event (ms)", pad.left + plotW / 2, ch - 8);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", 0, 0);
    ctx.restore();

    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      const t = tMin + (i / tickCount) * (tMax - tMin);
      const x = pad.left + (i / tickCount) * plotW;
      ctx.fillText(Math.round(t).toString(), x, ch - 20);
    }
    ctx.textAlign = "left";
    for (let i = 0; i <= tickCount; i++) {
      const f = fMin + (i / tickCount) * (fMax - fMin);
      const y = pad.top + plotH - (i / tickCount) * plotH;
      ctx.fillText(f < 1 ? f.toFixed(1) : Math.round(f).toString(), 8, y + 4);
    }

    const cbX = cw - pad.right + 16;
    const cbH = 120;
    const cbW = 10;
    for (let i = 0; i < cbH; i++) {
      const db = vmax - (i / cbH) * (vmax - vmin);
      ctx.fillStyle = dBtoColor(db, vmin, vmax);
      ctx.fillRect(cbX, pad.top + (i / cbH) * cbH, cbW, cbH / 50 + 1);
    }
    ctx.fillStyle = "#334155";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("dB", cbX + cbW + 4, pad.top - 4);
    ctx.fillText("+3", cbX + cbW + 4, pad.top + 8);
    ctx.fillText("0", cbX + cbW + 4, pad.top + cbH / 2 - 4);
    ctx.fillText("-3", cbX + cbW + 4, pad.top + cbH - 4);
  }, [timesMs, frequenciesHz, dbMatrix]);

  return <canvas ref={canvasRef} className="w-full" style={{ maxWidth: "100%" }} />;
}

const psdChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "top" },
    zoom: {
      zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
      pan: { enabled: true, mode: "xy" },
    },
  },
  scales: {
    x: {
      title: { display: true, text: "Frequency (Hz)" },
      suggestedMin: 0,
      suggestedMax: 45,
      maxTicksLimit: 12,
      ticks: {
        stepSize: 5,
        callback: function (value) {
          const v = Number(value);
          if (v === 0) return "0";
          if (v >= 1 && v === Math.round(v)) return v;
          if (v < 1) return v.toFixed(2);
          return v.toFixed(1);
        },
      },
    },
    y: { title: { display: true, text: "Power (dB)" }, beginAtZero: false },
  },
};

function downsample(data, maxPoints = 800) {
  if (!data || !data.length) return data;
  const cols = Array.isArray(data[0]) ? data.length : 1;
  const rows = Array.isArray(data[0]) ? data[0].length : data.length;
  if (rows <= maxPoints) return data;
  const step = Math.ceil(rows / maxPoints);
  if (cols === 1) return data.filter((_, i) => i % step === 0);
  return data.map((ch) => ch.filter((_, i) => i % step === 0));
}

function offsetChannels(data) {
  if (!data || !data.length) return data;
  const channels = Array.isArray(data[0]) ? data : [data];
  const bandHeight = 1;
  return channels.map((ch, i) => {
    const min = Math.min(...ch);
    const max = Math.max(...ch);
    const range = max - min || 1;
    const normalized = ch.map((v) => (v - min) / range);
    return normalized.map((v) => v * bandHeight + i * (bandHeight + 0.2));
  });
}

const TIMESPAN_OPTIONS = [1, 2, 3, 5, 10, 30, 60, "full"];

const FILTER_TOOLTIPS = {
  bandpass_low: "Lower cutoff (Hz). Removes frequencies below this—e.g. DC drift and very slow motion.",
  bandpass_high: "Upper cutoff (Hz). Removes frequencies above this—e.g. muscle artifact and EMG.",
  notch: "Removes power line noise: 50 Hz (EU/India) or 60 Hz (US).",
};

function FilterLabel({ children, tooltip }) {
  const [show, setShow] = React.useState(false);
  return (
    <label className="relative flex items-center mb-1.5 shrink-0 cursor-help" style={{ color: "#0369a1", gap: 10, overflow: "visible" }}>
      <span className="text-xs font-medium">{children}</span>
      <span
        className="relative inline-flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0"
        style={{
          backgroundColor: "#bae6fd",
          color: "#0369a1",
          marginLeft: 8,
          width: 20,
          height: 20,
          padding: 2,
          boxSizing: "border-box",
          overflow: "visible",
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
        {show && (
          <span
            className="absolute z-20 text-xs shadow-lg pointer-events-none"
            style={{
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              padding: "12px 16px",
              left: "100%",
              top: "50%",
              transform: "translateY(-50%)",
              marginLeft: 8,
              maxWidth: 260,
              minWidth: 180,
              lineHeight: 1.5,
              whiteSpace: "normal",
              wordWrap: "break-word",
              borderRadius: 12,
            }}
          >
            {tooltip}
          </span>
        )}
      </span>
    </label>
  );
}

export default function HomeContent() {
  const { setEEGContext } = useEEGData();
  const [source, setSource] = useState("physionet");
  const [subject, setSubject] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadTmpPath, setUploadTmpPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eegData, setEegData] = useState(null);
  const [cleanedData, setCleanedData] = useState(null);
  const [bandPowerData, setBandPowerData] = useState(null);
  const [psdData, setPsdData] = useState(null);
  const [spectralEntropyData, setSpectralEntropyData] = useState(null);
  const [hjorthData, setHjorthData] = useState(null);
  const [eegMetricsData, setEegMetricsData] = useState(null);
  const [aiInsightsData, setAiInsightsData] = useState(null);
  const [timeFreqSpectrogramData, setTimeFreqSpectrogramData] = useState(null);
  const [context, setContext] = useState({ useCase: "research", ageGroup: "adult", device: "research-grade" });
  const [filters, setFilters] = useState({ bandpass_low: 1, bandpass_high: 45, notch_freq: 50, ica_enabled: false });
  const [timespanSeconds, setTimespanSeconds] = useState(5);
  const rawChartRef = React.useRef(null);
  const cleanedChartRef = React.useRef(null);
  const psdChartRef = React.useRef(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [totalPhysioNetSubjects, setTotalPhysioNetSubjects] = useState(109);

  useEffect(() => {
    physioNetInfo().then((info) => setTotalPhysioNetSubjects(info.total_subjects ?? info.subjects?.length ?? 109)).catch(() => {});
  }, []);

  const applyPreset = useCallback(() => {
    setFilters((f) => ({ ...(FILTER_PRESETS[context.useCase] || FILTER_PRESETS.research), ica_enabled: f.ica_enabled ?? false }));
  }, [context.useCase]);

  const loadFromPhysioNet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadPhysioNet(subject, [4, 8, 12], 8000);
      setEegData(data);
      setEEGContext({ source: "physionet", subject, runs: [4, 8, 12], uploadedFileName: null, eegData: data });
      setCleanedData(null);
      setBandPowerData(null);
      setPsdData(null);
      setSpectralEntropyData(null);
      setHjorthData(null);
      setEegMetricsData(null);
      setAiInsightsData(null);
      setTimeFreqSpectrogramData(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [subject]);

  const loadFromUpload = useCallback(async () => {
    if (!uploadedFile) return;
    setLoading(true);
    setError(null);
    try {
      const { tmp_path } = await uploadFile(uploadedFile);
      setUploadTmpPath(tmp_path);
      const data = await parseEeg({ tmp_path });
      setEegData(data);
      setEEGContext({ source: "upload", subject: null, runs: null, uploadedFileName: uploadedFile.name, eegData: data });
      setCleanedData(null);
      setBandPowerData(null);
      setPsdData(null);
      setSpectralEntropyData(null);
      setHjorthData(null);
      setEegMetricsData(null);
      setAiInsightsData(null);
      setTimeFreqSpectrogramData(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [uploadedFile]);

  const applyFilters = useCallback(async () => {
    if (!eegData) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...eegData,
        bandpass_low: filters.bandpass_low,
        bandpass_high: filters.bandpass_high,
        notch_freq: filters.notch_freq,
        ica_enabled: filters.ica_enabled ?? false,
        channel_names: eegData.channel_names,
      };
      const cleaned = await cleanEeg(payload);
      setCleanedData(cleaned);
      const [bpRes, psdRes] = await Promise.all([
        bandPower(cleaned.cleaned_data, cleaned.sampling_rate),
        computePsd(cleaned.cleaned_data, cleaned.sampling_rate),
      ]);
      setBandPowerData(bpRes.band_power);
      setPsdData(psdRes);
      setSpectralEntropyData(null);
      setHjorthData(null);
      setEegMetricsData(null);
      setAiInsightsData(null);
      setTimeFreqSpectrogramData(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eegData, filters]);

  const downloadJson = useCallback(() => {
    const out = cleanedData
      ? { ...cleanedData, raw: eegData?.data }
      : eegData;
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eeg_data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [eegData, cleanedData]);

  const downloadCsv = useCallback(() => {
    const data = cleanedData?.cleaned_data || eegData?.data;
    const names = cleanedData?.channel_names || eegData?.channel_names || [];
    if (!data || !data.length) return;
    const rows = data[0].map((_, i) => names.map((n, c) => data[c][i]).join(","));
    const header = names.join(",");
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eeg_data.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [eegData, cleanedData]);

  const downloadFeatures = useCallback(() => {
    const features = {};
    if (bandPowerData) features.band_power = bandPowerData;
    if (psdData) features.psd = { frequencies: psdData.frequencies, power: psdData.power };
    if (spectralEntropyData) features.spectral_entropy = spectralEntropyData;
    if (hjorthData) features.hjorth = hjorthData;
    if (eegMetricsData) features.eeg_metrics = eegMetricsData;
    if (aiInsightsData) features.ai_insights = aiInsightsData;
    if (Object.keys(features).length === 0) return;
    const blob = new Blob([JSON.stringify(features, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eeg_features.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [bandPowerData, psdData, spectralEntropyData, hjorthData, eegMetricsData, aiInsightsData]);

  const downloadFeaturesCsv = useCallback(() => {
    const rows = [];
    if (bandPowerData) {
      rows.push("metric,value");
      Object.entries(bandPowerData).forEach(([k, v]) => rows.push(`band_power_${k},${v}`));
    }
    if (aiInsightsData) {
      rows.push("cognitive_load," + (aiInsightsData.cognitive_load ?? ""));
      rows.push("mental_fatigue," + (aiInsightsData.mental_fatigue ?? ""));
      rows.push("stress_probability," + (aiInsightsData.stress_probability ?? ""));
      rows.push("attention_index," + (aiInsightsData.attention_index ?? ""));
    }
    if (eegMetricsData) {
      rows.push("rms_mean," + (eegMetricsData.rms_mean ?? ""));
      rows.push("zero_crossing_rate_mean," + (eegMetricsData.zero_crossing_rate_mean ?? ""));
      rows.push("peak_frequency_mean," + (eegMetricsData.peak_frequency_mean ?? ""));
    }
    if (rows.length === 0) return;
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eeg_features.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [bandPowerData, aiInsightsData, eegMetricsData]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault();
          if (bandPowerData || psdData || aiInsightsData) downloadFeatures();
          else if (eegData) downloadJson();
        }
        if (e.key === "Enter" && eegData && !e.target.closest("input, textarea, select")) {
          e.preventDefault();
          applyFilters();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eegData, bandPowerData, psdData, aiInsightsData, downloadFeatures, downloadJson, applyFilters]);

  const CHART_COLORS = ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#0d9488", "#2dd4bf", "#14b8a6", "#5eead4"];
  const toggleChannel = useCallback((i) => {
    setSelectedChannels((prev) => {
      const n = eegData?.channel_names?.length ?? 0;
      const next = prev.length === n ? [...prev] : Array(n).fill(true);
      next[i] = !next[i];
      return next;
    });
  }, [eegData?.channel_names?.length]);

  const rawPlot = useMemo(() => {
    const d = eegData?.data || eegData?.preview;
    if (!d || !d.length) return null;
    const fs = eegData?.sampling_rate || 160;
    const totalSamples = Array.isArray(d[0]) ? d[0].length : d.length;
    const maxSamples = timespanSeconds === "full" ? totalSamples : Math.min(Math.round(timespanSeconds * fs), totalSamples);
    const sliced = Array.isArray(d[0])
      ? d.map((ch) => ch.slice(0, maxSamples))
      : d.slice(0, maxSamples);
    const ds = downsample(sliced, 1200);
    const stacked = offsetChannels(ds);
    const labels = stacked[0]?.map((_, i) => i) ?? [];
    const channels = (eegData?.channel_names || []).slice(0, 8);
    const sel = selectedChannels.length === channels.length ? selectedChannels : Array(channels.length).fill(true);
    const datasets = stacked.slice(0, 8)
      .map((ch, i) => ({ ch, i }))
      .filter(({ i }) => sel[i])
      .map(({ ch, i }) => ({
        label: channels[i] || `Ch${i + 1}`,
        data: ch,
        borderColor: CHART_COLORS[i],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      }));
    return { labels, datasets };
  }, [eegData, timespanSeconds, selectedChannels]);

  const cleanedPlot = useMemo(() => {
    const d = cleanedData?.cleaned_data;
    if (!d || !d.length) return null;
    const fs = cleanedData?.sampling_rate || 160;
    const totalSamples = Array.isArray(d[0]) ? d[0].length : d.length;
    const maxSamples = timespanSeconds === "full" ? totalSamples : Math.min(Math.round(timespanSeconds * fs), totalSamples);
    const sliced = Array.isArray(d[0])
      ? d.map((ch) => ch.slice(0, maxSamples))
      : d.slice(0, maxSamples);
    const ds = downsample(sliced, 1200);
    const stacked = offsetChannels(ds);
    const labels = stacked[0]?.map((_, i) => i) ?? [];
    const channels = (cleanedData?.channel_names || []).slice(0, 8);
    const sel = selectedChannels.length === channels.length ? selectedChannels : Array(channels.length).fill(true);
    const datasets = stacked.slice(0, 8)
      .map((ch, i) => ({ ch, i }))
      .filter(({ i }) => sel[i])
      .map(({ ch, i }) => ({
        label: channels[i] || `Ch${i + 1}`,
        data: ch,
        borderColor: CHART_COLORS[i],
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      }));
    return { labels, datasets };
  }, [cleanedData, timespanSeconds, selectedChannels]);

  useEffect(() => {
    const n = eegData?.channel_names?.length ?? 0;
    if (n > 0 && selectedChannels.length !== n) setSelectedChannels(Array(n).fill(true));
  }, [eegData?.channel_names?.length]);

  const analysisData = useMemo(() => {
    const raw = cleanedData?.cleaned_data || eegData?.data;
    if (!raw || !raw.length) return null;
    const sel = selectedChannels.length === raw.length ? selectedChannels : Array(raw.length).fill(true);
    return raw.filter((_, i) => sel[i]);
  }, [cleanedData?.cleaned_data, eegData?.data, selectedChannels]);
  const analysisFs = cleanedData?.sampling_rate || eegData?.sampling_rate || 160;

  const runPsd = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computePsd(analysisData, analysisFs);
      setPsdData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData, analysisFs]);

  const runTimeFreqSpectrogram = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computeTimeFreqSpectrogram(analysisData, analysisFs);
      setTimeFreqSpectrogramData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData, analysisFs]);

  const runSpectralEntropy = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computeSpectralEntropy(analysisData, analysisFs);
      setSpectralEntropyData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData, analysisFs]);

  const runHjorth = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computeHjorth(analysisData);
      setHjorthData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData]);

  const runEegMetrics = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computeEegMetrics(analysisData, analysisFs);
      setEegMetricsData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData, analysisFs]);

  const runAiInsights = useCallback(async () => {
    if (!analysisData || !analysisData.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await computeAiInsights(analysisData, analysisFs);
      setAiInsightsData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [analysisData, analysisFs]);

  const bandChart = useMemo(() => {
    if (!bandPowerData) return null;
    const labels = Object.keys(bandPowerData);
    return {
      labels,
      datasets: [{ label: "Power (µV²)", data: labels.map((k) => bandPowerData[k]), backgroundColor: ["#0ea5e9", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444"] }],
    };
  }, [bandPowerData]);

  const psdChart = useMemo(() => {
    if (!psdData?.frequencies?.length) return null;
    const labels = psdData.frequencies;
    const power = psdData.power;
    const maxP = Math.max(...power, 1e-12);
    const minP = Math.min(...power.filter((v) => v > 0), maxP) || 1e-12;
    const powerDb = power.map((v) => 10 * Math.log10(Math.max(v, minP / 100)));
    return {
      labels,
      datasets: [{ label: "Power (dB)", data: powerDb, borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.2)", fill: true, tension: 0.3 }],
    };
  }, [psdData]);

  return (
    <main className="max-w-6xl mx-auto py-8 sm:py-10 px-4 sm:px-8">
      <div style={{ marginBottom: 40, paddingLeft: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0c4a6e", marginBottom: 8, letterSpacing: "-0.02em" }}>NeuroFlow Lab</h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
          Upload or load sample EEG data (e.g. PhysioNet motor imagery), apply filters, run analyses, and visualize results.
        </p>
      </div>

      <section
        style={{
          borderRadius: 20,
          backgroundColor: "var(--card-bg, #fff)",
          boxShadow: "var(--card-shadow)",
          border: "1px solid var(--card-border, #e0f2fe)",
          overflow: "hidden",
          marginBottom: 40,
        }}
      >
        <div style={{ padding: "24px 24px 28px", borderBottom: "1px solid #e0f2fe" }} className="sm:px-10">
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em", marginBottom: 20 }}>DATA SOURCE</h2>
          <div className="flex flex-wrap items-end" style={{ gap: "20px 28px" }}>
            <div style={{ display: "inline-flex", borderRadius: 12, backgroundColor: "#e0f2fe", padding: 4 }}>
              <button
                onClick={() => setSource("physionet")}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: source === "physionet" ? "#fff" : "transparent",
                  color: source === "physionet" ? "#0284c7" : "#64748b",
                  boxShadow: source === "physionet" ? "0 2px 8px rgba(14, 165, 233, 0.2)" : "none",
                }}
              >
                PhysioNet
              </button>
              <button
                onClick={() => setSource("upload")}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: source === "upload" ? "#fff" : "transparent",
                  color: source === "upload" ? "#0284c7" : "#64748b",
                  boxShadow: source === "upload" ? "0 2px 8px rgba(14, 165, 233, 0.2)" : "none",
                }}
              >
                Upload File
              </button>
            </div>
            {source === "physionet" && (
              <>
                <div className="flex flex-col shrink-0">
                  <div className="flex items-center justify-between" style={{ marginBottom: 8, minWidth: 72 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#0369a1" }}>Subject</label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>of {totalPhysioNetSubjects}</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={totalPhysioNetSubjects}
                    value={subject}
                    onChange={(e) => setSubject(Math.min(totalPhysioNetSubjects, Math.max(1, Number(e.target.value) || 1)))}
                    className="input-filter text-sm font-medium text-slate-800"
                    style={{ width: 72, maxWidth: 72, minWidth: 72 }}
                  />
                </div>
                <button
                  onClick={loadFromPhysioNet}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    backgroundColor: "#0284c7",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                  }}
                >
                  {loading ? "Loading…" : "Load EEG"}
                </button>
              </>
            )}
            {source === "upload" && (
              <>
                <label className="flex flex-col cursor-pointer">
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#0369a1", marginBottom: 8 }}>File</span>
                  <span style={{ padding: "10px 18px", borderRadius: 10, backgroundColor: "#f0f9ff", color: "#64748b", fontSize: 13, border: "2px dashed #bae6fd", display: "inline-block" }}>
                    {uploadedFile ? uploadedFile.name : "Choose .edf, .csv, .mat"}
                  </span>
                  <input
                    type="file"
                    accept=".edf,.csv,.mat"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={loadFromUpload}
                  disabled={!uploadedFile || loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    backgroundColor: "#0284c7",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor: (!uploadedFile || loading) ? "not-allowed" : "pointer",
                    opacity: (!uploadedFile || loading) ? 0.6 : 1,
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                  }}
                >
                  {loading ? "Loading…" : "Parse & Load"}
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: "24px 24px 28px", backgroundColor: "#f0f9ff", borderBottom: "1px solid #e0f2fe" }} className="sm:px-10">
          <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em", margin: 0 }}>CONTEXT PRESETS</h2>
            <Link href="/about#context-presets" className="text-xs font-medium hover:underline" style={{ color: "#0284c7" }}>Learn more about these presets →</Link>
          </div>
          <div className="flex flex-row flex-wrap items-end" style={{ gap: "24px 32px" }}>
            <div className="flex flex-col flex-1 min-w-[120px] sm:min-w-[140px]" style={{ maxWidth: 180 }}>
              <label className="block text-xs font-medium shrink-0" style={{ color: "#0369a1", marginBottom: 8 }}>Use case</label>
              <select
                value={context.useCase}
                onChange={(e) => setContext((c) => ({ ...c, useCase: e.target.value }))}
                className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                style={{ width: "100%" }}
              >
                <option value="research">Research</option>
                <option value="clinical">Clinical</option>
                <option value="neurofeedback">Neurofeedback</option>
                <option value="sleep">Sleep</option>
                <option value="teaching">Teaching</option>
              </select>
            </div>
            <div className="flex flex-col flex-1 min-w-[100px] sm:min-w-[120px]" style={{ maxWidth: 160 }}>
              <label className="block text-xs font-medium shrink-0" style={{ color: "#0369a1", marginBottom: 8 }}>Age group</label>
              <select
                value={context.ageGroup}
                onChange={(e) => setContext((c) => ({ ...c, ageGroup: e.target.value }))}
                className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                style={{ width: "100%" }}
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
                <option value="infant">Infant</option>
              </select>
            </div>
            <div className="flex flex-col flex-1 min-w-[120px] sm:min-w-[140px]" style={{ maxWidth: 180 }}>
              <label className="block text-xs font-medium shrink-0" style={{ color: "#0369a1", marginBottom: 8 }}>Device</label>
              <select
                value={context.device}
                onChange={(e) => setContext((c) => ({ ...c, device: e.target.value }))}
                className="select-context w-full text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
                style={{ width: "100%" }}
              >
                <option value="research-grade">Research-grade</option>
                <option value="consumer">Consumer</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>
          <button
            onClick={applyPreset}
            style={{ marginTop: 20, padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, color: "#0284c7", backgroundColor: "#e0f2fe", border: "none", cursor: "pointer" }}
          >
            Apply preset filters
          </button>
        </div>

        <div style={{ padding: "28px 24px" }} className="sm:px-10">
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em", marginBottom: 24 }}>FILTER CONTROLS (Hz)</h2>
          <div className="filter-controls-grid">
            <div className="filter-control-cell flex flex-col">
              <FilterLabel tooltip={FILTER_TOOLTIPS.bandpass_low}>Bandpass low</FilterLabel>
              <input
                type="number"
                step={0.1}
                value={filters.bandpass_low}
                onChange={(e) => setFilters((f) => ({ ...f, bandpass_low: Number(e.target.value) }))}
                className="input-filter text-sm font-medium text-slate-800 w-full"
              />
            </div>
            <div className="filter-control-cell flex flex-col">
              <FilterLabel tooltip={FILTER_TOOLTIPS.bandpass_high}>Bandpass high</FilterLabel>
              <input
                type="number"
                step={0.1}
                value={filters.bandpass_high}
                onChange={(e) => setFilters((f) => ({ ...f, bandpass_high: Number(e.target.value) }))}
                className="input-filter text-sm font-medium text-slate-800 w-full"
              />
            </div>
            <div className="filter-control-cell flex flex-col">
              <FilterLabel tooltip={FILTER_TOOLTIPS.notch}>Notch</FilterLabel>
              <select
                value={filters.notch_freq}
                onChange={(e) => setFilters((f) => ({ ...f, notch_freq: Number(e.target.value) }))}
                className="select-filter text-sm font-medium text-slate-800 focus:outline-none cursor-pointer w-full"
              >
                <option value={50}>50 Hz</option>
                <option value={60}>60 Hz</option>
              </select>
            </div>
            <div className="filter-control-cell flex flex-col">
              <label style={{ fontSize: 12, fontWeight: 500, color: "#0369a1", marginBottom: 8 }}>ICA</label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[38px]" style={{ alignSelf: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={filters.ica_enabled ?? false}
                  onChange={(e) => setFilters((f) => ({ ...f, ica_enabled: e.target.checked }))}
                  className="rounded accent-teal-500"
                />
                <span className="text-xs font-medium" style={{ color: "#0369a1" }}>Artifact removal</span>
              </label>
            </div>
          </div>
          <button
            onClick={applyFilters}
            disabled={!eegData || loading}
            style={{
              marginTop: 32,
              padding: "16px 32px",
              borderRadius: 14,
              backgroundColor: "#0284c7",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: (!eegData || loading) ? "not-allowed" : "pointer",
              opacity: (!eegData || loading) ? 0.6 : 1,
              boxShadow: "0 6px 20px rgba(2, 132, 199, 0.35)",
            }}
          >
            {loading ? "Processing…" : "Apply filters & clean"}
          </button>
          <p className="text-xs mt-2" style={{ color: "#64748b" }}>
            Updates processed EEG, PSD, band power, and all analysis results. Filter values are editable anytime—change and re-apply to see new results.
          </p>
        </div>
      </section>

      {error && (
        <div style={{ borderRadius: 16, backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "16px 24px", marginBottom: 32 }}>
          {error}
        </div>
      )}

      {eegData && (
        <>
          <section
            style={{
              borderRadius: 16,
              border: "1px solid #e0f2fe",
              backgroundColor: "#f0f9ff",
              padding: "24px 28px",
              marginBottom: 32,
              boxShadow: "0 2px 12px -4px rgba(14, 165, 233, 0.15)",
            }}
          >
            <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em", marginBottom: 20 }}>DATASET METADATA</h2>
            <div
              className="grid gap-x-8 gap-y-5"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                alignItems: "start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>Subjects</span>
                <span className="text-sm font-semibold" style={{ color: "#0c4a6e", display: "block" }}>
                  {source === "physionet"
                    ? `Subject ${eegData.subject_id ?? subject} of ${totalPhysioNetSubjects}`
                    : `${eegData.n_subjects ?? 1} subject${(eegData.n_subjects ?? 1) !== 1 ? "s" : ""}`}
                </span>
                {(eegData.subject_id ?? (source === "physionet" ? subject : null)) != null && (
                  <span className="block text-xs mt-1" style={{ color: "#64748b" }}>
                    Current: S{String(eegData.subject_id ?? subject).padStart(2, "0")}
                  </span>
                )}
              </div>
              {eegData.montage != null && eegData.montage !== "" && (
                <div style={{ minWidth: 0 }}>
                  <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>Montage</span>
                  <span className="text-sm font-medium block" style={{ color: "#0c4a6e" }}>{eegData.montage}</span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>Channels</span>
                <span className="text-sm font-medium block" style={{ color: "#0c4a6e" }}>{eegData.channels} ({eegData.channel_names?.slice(0, 3).join(", ")}{(eegData.channel_names?.length ?? 0) > 3 ? "…" : ""})</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>Sampling rate</span>
                <span className="text-sm font-medium block" style={{ color: "#0c4a6e" }}>{eegData.sampling_rate} Hz</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>Duration</span>
                <span className="text-sm font-medium block" style={{ color: "#0c4a6e" }}>{eegData.duration_sec} s</span>
              </div>
              {source === "upload" && uploadedFile?.name && (
                <div style={{ minWidth: 0 }}>
                  <span className="text-xs font-medium" style={{ color: "#64748b", display: "block", marginBottom: 6 }}>File</span>
                  <span className="text-sm font-medium truncate block" style={{ color: "#0c4a6e", maxWidth: "100%" }} title={uploadedFile.name}>{uploadedFile.name}</span>
                </div>
              )}
            </div>
          </section>

          <section
            style={{
              borderRadius: 20,
              border: "1px solid #e0f2fe",
              backgroundColor: "#fff",
              padding: "28px 40px",
              marginBottom: 32,
              boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pl-0.5">
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#0369a1" }}>Temporal (Time Domain)</h2>
              <div className="flex items-center gap-3">
                <details className="group">
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: "#0369a1" }}>Channel selection</summary>
                  <div className="mt-2 p-3 rounded-lg max-h-28 overflow-y-auto flex flex-wrap gap-2" style={{ background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
                    <button type="button" onClick={() => setSelectedChannels(Array(eegData.channel_names?.length ?? 0).fill(true))} className="text-xs px-2 py-1 rounded" style={{ color: "#0369a1", background: "#e0f2fe" }}>All</button>
                    <button type="button" onClick={() => setSelectedChannels(Array(eegData.channel_names?.length ?? 0).fill(false))} className="text-xs px-2 py-1 rounded" style={{ color: "#0369a1", background: "#e0f2fe" }}>None</button>
                    {(eegData.channel_names || []).slice(0, 8).map((name, i) => (
                      <label key={name} className="flex items-center gap-1 cursor-pointer" onClick={() => toggleChannel(i)}>
                        <input type="checkbox" checked={selectedChannels[i] ?? true} onChange={() => toggleChannel(i)} className="rounded accent-teal-500" />
                        <span className="text-xs font-mono">{name}</span>
                      </label>
                    ))}
                  </div>
                </details>
                <label className="flex items-center gap-2 text-sm">
                  <span className="font-medium" style={{ color: "#0369a1" }}>Time span:</span>
                  <select
                    value={timespanSeconds}
                    onChange={(e) => setTimespanSeconds(e.target.value === "full" ? "full" : Number(e.target.value))}
                    className="select-compact border-0 text-sm font-medium focus:ring-2 focus:ring-sky-300 focus:outline-none rounded-xl cursor-pointer"
                    style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                  >
                    {TIMESPAN_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v === "full" ? "Full" : `${v} s`}</option>
                    ))}
                  </select>
                </label>
                <span className="text-xs" style={{ color: "#64748b" }}>{eegData.channels} ch, {eegData.sampling_rate} Hz</span>
              </div>
            </div>
            <p className="text-xs mb-4 pl-0.5" style={{ color: "#64748b" }}>EEG waveforms over time. Scroll to zoom, drag to pan. Click Reset to restore view. Channel selection syncs both graphs. When ICA is enabled, component topomaps appear to the right.</p>
            <div className={`grid gap-6 ${(cleanedData?.ica_topomap_base64 || (filters.ica_enabled && cleanedData?.ica_excluded !== undefined)) ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}`}>
              <div>
                <div className="flex items-center justify-between mb-3 pl-0.5">
                  <span className="text-sm font-medium" style={{ color: "#0369a1" }}>Raw EEG</span>
                  <button
                    type="button"
                    onClick={() => { rawChartRef.current?.resetZoom(); cleanedChartRef.current?.resetZoom(); }}
                    className="text-xs px-4 py-2 rounded-xl font-medium transition-colors"
                    style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                  >
                    Reset zoom
                  </button>
                </div>
                <div className="h-[420px] min-h-[280px]">
                  {rawPlot && <Line ref={rawChartRef} data={rawPlot} options={eegChartOptions(eegData.sampling_rate || 160, cleanedChartRef)} />}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3 pl-0.5">
                  <span className="text-sm font-medium" style={{ color: "#0369a1" }}>Processed EEG</span>
                  <button
                    type="button"
                    onClick={() => { rawChartRef.current?.resetZoom(); cleanedChartRef.current?.resetZoom(); }}
                    className="text-xs px-4 py-2 rounded-xl font-medium transition-colors"
                    style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                  >
                    Reset zoom
                  </button>
                </div>
                <div className="h-[420px] min-h-[280px]">
                  {cleanedPlot ? (
                    <Line ref={cleanedChartRef} data={cleanedPlot} options={eegChartOptions(cleanedData.sampling_rate || 160, rawChartRef)} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: "#94a3b8" }}>Apply filters to see cleaned signal.</div>
                  )}
                </div>
              </div>
              {(cleanedData?.ica_topomap_base64 || (filters.ica_enabled && cleanedData?.ica_excluded !== undefined)) && (
                <div>
                  <div className="mb-3 pl-0.5">
                    <span className="text-sm font-medium" style={{ color: "#0369a1" }}>ICA component topomaps</span>
                    <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>Scalp topography of each independent component.</p>
                  </div>
                  {cleanedData?.ica_topomap_base64 ? (
                    <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#e0f2fe", backgroundColor: "#fff" }}>
                      <img
                        src={`data:image/png;base64,${cleanedData.ica_topomap_base64}`}
                        alt="ICA component topomaps"
                        className="w-full h-auto max-h-[420px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border p-4 flex items-center justify-center min-h-[200px]" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2" }}>
                      <p className="text-sm" style={{ color: "#b91c1c" }}>
                        ICA applied. {cleanedData?.ica_topomap_error ? `Plot failed: ${cleanedData.ica_topomap_error}` : "Topomap could not be generated."}
                      </p>
                    </div>
                  )}
                  {cleanedData?.ica_excluded?.length > 0 && (
                    <p className="text-xs mt-2" style={{ color: "#64748b" }}>Excluded components: {cleanedData.ica_excluded.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {eegData && (
        <section
          style={{
            borderRadius: 20,
            border: "1px solid #e0f2fe",
            backgroundColor: "#fff",
            padding: "28px 40px",
            marginBottom: 32,
            boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
          }}
        >
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", letterSpacing: "0.1em", marginBottom: 24 }}>Spectral (Frequency Domain)</h2>
          <p className="text-sm mb-6" style={{ color: "#64748b" }}>
            Apply filters to generate PSD and band power from cleaned data.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {psdChart ? (
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1" }}>Power Spectral Density (Welch)</h3>
                  <button
                    type="button"
                    onClick={() => psdChartRef.current?.resetZoom()}
                    className="text-xs px-4 py-2 rounded-xl font-medium transition-colors"
                    style={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                  >
                    Reset zoom
                  </button>
                </div>
                <p className="text-xs mb-3" style={{ color: "#64748b" }}>Scroll to zoom, drag to pan.</p>
                <div className="h-[420px] min-h-[320px] rounded-xl overflow-hidden">
                  <Line ref={psdChartRef} data={psdChart} options={psdChartOptions} />
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center rounded-xl lg:col-span-2" style={{ background: "#f0f9ff", border: "1px dashed #bae6fd" }}>
                <span className="text-sm" style={{ color: "#64748b" }}>PSD — Apply filters to see spectrum</span>
              </div>
            )}
            {bandChart ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#0369a1" }}>Band Power (δ θ α β γ)</h3>
                <div className="h-64">
                  <Bar data={bandChart} options={{ ...chartOptions(), scales: { y: { beginAtZero: true } } }} />
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center rounded-xl" style={{ background: "#f0f9ff", border: "1px dashed #bae6fd" }}>
                <span className="text-sm" style={{ color: "#64748b" }}>Band Power — Apply filters to see bands</span>
              </div>
            )}
          </div>
        </section>
      )}

      {eegData && (
        <section
          style={{
            borderRadius: 20,
            border: "1px solid #e0f2fe",
            backgroundColor: "#fff",
            padding: "32px 40px",
            marginBottom: 32,
            boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
          }}
        >
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", letterSpacing: "0.1em", marginBottom: 8 }}>EEG ANALYSIS</h2>
          <p className="text-sm" style={{ color: "#64748b", marginBottom: 24 }}>
            PSD, spectral entropy, Hjorth parameters, RMS, peak frequency, and more.
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: 12, marginBottom: 32 }}>
            <button
              onClick={runPsd}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              PSD
            </button>
            <button
              onClick={runTimeFreqSpectrogram}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              Time–Frequency
            </button>
            <button
              onClick={runSpectralEntropy}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              Spectral Entropy
            </button>
            <button
              onClick={runHjorth}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              Hjorth
            </button>
            <button
              onClick={runEegMetrics}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0369a1", fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              Full Metrics
            </button>
            <button
              onClick={runAiInsights}
              disabled={!analysisData?.length || loading}
              style={{ padding: "10px 20px", borderRadius: 10, border: "2px solid #0d9488", background: "#ccfbf1", color: "#0f766e", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: !analysisData?.length || loading ? 0.6 : 1 }}
            >
              AI Insights
            </button>
          </div>

          {(timeFreqSpectrogramData?.image_base64 || timeFreqSpectrogramData?.db_matrix) && (
            <div style={{ marginBottom: 32, paddingTop: 24, borderTop: "1px solid #e0f2fe" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1", marginBottom: 16 }}>Time–Frequency Spectrogram</h3>
              <p className="text-xs mb-3" style={{ color: "#64748b" }}>X-axis: Time relative to event (stimulus at 0 ms). Y-axis: Frequency (2–80 Hz). Color: Power change from baseline (dB).</p>
              <div className="rounded-xl overflow-hidden border p-4" style={{ borderColor: "#e0f2fe", backgroundColor: "#fff", maxWidth: 800 }}>
                {timeFreqSpectrogramData.image_base64 ? (
                  <img
                    src={`data:image/png;base64,${timeFreqSpectrogramData.image_base64}`}
                    alt="Time-Frequency Spectrogram"
                    className="w-full h-auto"
                    style={{ maxWidth: 720 }}
                  />
                ) : (
                  <SpectrogramHeatmap
                    timesMs={timeFreqSpectrogramData.times_ms}
                    frequenciesHz={timeFreqSpectrogramData.frequencies_hz}
                    dbMatrix={timeFreqSpectrogramData.db_matrix}
                  />
                )}
              </div>
            </div>
          )}

          {spectralEntropyData && (
            <div style={{ marginBottom: 32, paddingTop: 24, borderTop: "1px solid #e0f2fe" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1", marginBottom: 16 }}>Spectral Entropy (0–1)</h3>
              <div className="flex flex-wrap items-stretch" style={{ gap: 16 }}>
                <div style={{ padding: "16px 24px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd", minWidth: 120 }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Overall</span>
                  <div className="text-lg font-semibold" style={{ color: "#0369a1" }}>{spectralEntropyData.overall?.toFixed(4) ?? "—"}</div>
                </div>
                {spectralEntropyData.per_band && Object.entries(spectralEntropyData.per_band).map(([k, v]) => (
                  <div key={k} style={{ padding: "16px 24px", background: "#f0f9ff", borderRadius: 12, border: "1px solid #bae6fd", minWidth: 100 }}>
                    <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>{k}</span>
                    <div className="text-base font-medium" style={{ color: "#0369a1" }}>{(v ?? 0).toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hjorthData && (
            <div style={{ marginBottom: 32, paddingTop: 24, borderTop: "1px solid #e0f2fe" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1", marginBottom: 16 }}>Hjorth Parameters (mean)</h3>
              <div className="flex flex-wrap items-stretch" style={{ gap: 16 }}>
                <div style={{ padding: "16px 24px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd", minWidth: 120 }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Activity</span>
                  <div className="text-base font-medium" style={{ color: "#0369a1" }}>{(hjorthData.activity?.reduce((a, b) => a + b, 0) / (hjorthData.activity?.length || 1))?.toExponential(2) ?? "—"}</div>
                </div>
                <div style={{ padding: "16px 24px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd", minWidth: 120 }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Mobility</span>
                  <div className="text-base font-medium" style={{ color: "#0369a1" }}>{(hjorthData.mobility?.reduce((a, b) => a + b, 0) / (hjorthData.mobility?.length || 1))?.toFixed(4) ?? "—"}</div>
                </div>
                <div style={{ padding: "16px 24px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd", minWidth: 120 }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Complexity</span>
                  <div className="text-base font-medium" style={{ color: "#0369a1" }}>{(hjorthData.complexity?.reduce((a, b) => a + b, 0) / (hjorthData.complexity?.length || 1))?.toFixed(4) ?? "—"}</div>
                </div>
              </div>
            </div>
          )}

          {eegMetricsData && (
            <div style={{ paddingTop: 24, borderTop: "1px solid #e0f2fe" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1", marginBottom: 16 }}>Full Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 16 }}>
                <div style={{ padding: "16px 20px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>RMS mean</span>
                  <span className="text-base font-medium" style={{ color: "#0369a1" }}>{(eegMetricsData.rms_mean ?? 0).toExponential(2)}</span>
                </div>
                <div style={{ padding: "16px 20px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Zero-cross rate</span>
                  <span className="text-base font-medium" style={{ color: "#0369a1" }}>{(eegMetricsData.zero_crossing_rate_mean ?? 0).toFixed(4)}</span>
                </div>
                <div style={{ padding: "16px 20px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Peak freq (Hz)</span>
                  <span className="text-base font-medium" style={{ color: "#0369a1" }}>{(eegMetricsData.peak_frequency_mean ?? 0).toFixed(2)}</span>
                </div>
                <div style={{ padding: "16px 20px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 6 }}>Band power</span>
                  <span className="text-xs font-medium" style={{ color: "#0369a1" }}>delta, theta, α, β, γ</span>
                </div>
              </div>
            </div>
          )}

          {aiInsightsData && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e0f2fe" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0d9488", marginBottom: 12 }}>AI Insights</h3>
              <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #ccfbf1 0%, #e0f2fe 100%)", borderRadius: 12, border: "1px solid #99f6e4", marginBottom: 16 }}>
                <p className="text-sm font-medium" style={{ color: "#0f766e", lineHeight: 1.6 }}>{aiInsightsData.summary}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
                <div style={{ padding: "14px 18px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #99f6e4" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 4 }}>Cognitive load</span>
                  <span className="text-base font-semibold" style={{ color: "#0f766e" }}>{(aiInsightsData.cognitive_load ?? 0).toFixed(2)}</span>
                </div>
                <div style={{ padding: "14px 18px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #99f6e4" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 4 }}>Mental fatigue</span>
                  <span className="text-base font-semibold" style={{ color: "#0f766e" }}>{(aiInsightsData.mental_fatigue ?? 0).toFixed(2)}</span>
                </div>
                <div style={{ padding: "14px 18px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #99f6e4" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 4 }}>Stress probability</span>
                  <span className="text-base font-semibold" style={{ color: "#0f766e" }}>{(aiInsightsData.stress_probability ?? 0).toFixed(2)}</span>
                </div>
                <div style={{ padding: "14px 18px", background: "#f0fdfa", borderRadius: 10, border: "1px solid #99f6e4" }}>
                  <span className="block text-xs" style={{ color: "#64748b", marginBottom: 4 }}>Attention index</span>
                  <span className="text-base font-semibold" style={{ color: "#0f766e" }}>{(aiInsightsData.attention_index ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {eegData && (
        <section
          style={{
            borderRadius: 20,
            border: "1px solid #e0f2fe",
            backgroundColor: "#fff",
            padding: "32px 40px",
            boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
          }}
        >
          <h2 style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", letterSpacing: "0.1em", marginBottom: 8 }}>DOWNLOAD RESULTS</h2>
          <p className="text-xs mb-4" style={{ color: "#64748b" }}>Ctrl+S / ⌘S to export</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadJson}
              style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #bae6fd", backgroundColor: "#fff", fontSize: 14, fontWeight: 500, color: "#0369a1", cursor: "pointer" }}
            >
              Export data JSON
            </button>
            <button
              onClick={downloadCsv}
              style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #bae6fd", backgroundColor: "#fff", fontSize: 14, fontWeight: 500, color: "#0369a1", cursor: "pointer" }}
            >
              Export data CSV
            </button>
            <button
              onClick={downloadFeatures}
              style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #99f6e4", backgroundColor: "#f0fdfa", fontSize: 14, fontWeight: 500, color: "#0f766e", cursor: "pointer" }}
            >
              Export features JSON
            </button>
            <button
              onClick={downloadFeaturesCsv}
              style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #99f6e4", backgroundColor: "#f0fdfa", fontSize: 14, fontWeight: 500, color: "#0f766e", cursor: "pointer" }}
            >
              Export features CSV
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
