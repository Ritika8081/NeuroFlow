"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EEGVisualization from "../components/EEGVisualization";
import AIInsights from "../components/AIInsights";
import AIAssistant from "../components/AIAssistant";
import PSDView from "../components/PSDView";
import SpectrogramView from "../components/SpectrogramView";
import TopographyView from "../components/TopographyView";
import BandPowerView from "../components/BandPowerView";
import QualityDashboard from "../components/QualityDashboard";
import ReportPanel from "../components/ReportPanel";
import AIProseReport from "../components/AIProseReport";
import AICodeGen from "../components/AICodeGen";
import AISettingsModal from "../components/AISettingsModal";
import AnnotationsView from "../components/AnnotationsView";
import WorkspaceSidebar, { SidebarItem } from "../components/WorkspaceSidebar";
import { Banner, Card, FilterField, Segmented, SectionHeader, Spinner, Stat } from "../components/ui";
import { runAnalysis, AnalysisBundle } from "../lib/insights";
import { runAnalysisAsync } from "../lib/analysis-worker";
import { parseTextEEG, SampleRecording, SAMPLES } from "../lib/sample-data";
import { HistoryEntry, loadHistory, makeId, saveHistoryEntry } from "../lib/history";
import { ParsedPipelineRequest, AssistantContext } from "../lib/assistant";
import AutoCleanPanel from "../components/AutoCleanPanel";
import RecommendationsPanel from "../components/RecommendationsPanel";
import { recommend } from "../lib/recommendations";
import SleepStagingView from "../components/SleepStagingView";
import ConnectivityView from "../components/ConnectivityView";
import PipelineTemplates from "../components/PipelineTemplates";
import ComparisonView from "../components/ComparisonView";
import GlossaryView from "../components/GlossaryView";
import LiteratureSearch from "../components/LiteratureSearch";
import MethodsWriteup from "../components/MethodsWriteup";
import { AutoCleanRecipe } from "../lib/autoclean";
import { PipelineTemplate } from "../lib/templates";
import DecorativeWave from "../components/DecorativeWave";
import CohortView from "../components/CohortView";
import ICAView from "../components/ICAView";
import BIDSExport from "../components/BIDSExport";

type EEGUseCase =
  | "Resting-state EEG"
  | "Cognitive / task-based EEG"
  | "Sleep / overnight EEG"
  | "BCI / neurofeedback"
  | "Low-cost device";

const PRESETS: Record<
  EEGUseCase,
  { bandpassLow: number; bandpassHigh: number; notchFreq: number; lowpassFreq: number; highpassFreq: number }
> = {
  "Resting-state EEG": { bandpassLow: 1, bandpassHigh: 45, notchFreq: 50, lowpassFreq: 45, highpassFreq: 0.5 },
  "Cognitive / task-based EEG": { bandpassLow: 1, bandpassHigh: 50, notchFreq: 50, lowpassFreq: 50, highpassFreq: 0.5 },
  "Sleep / overnight EEG": { bandpassLow: 0.1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 0.1 },
  "BCI / neurofeedback": { bandpassLow: 1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 1 },
  "Low-cost device": { bandpassLow: 1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 1 },
};

const ACCEPTED = ".edf,.csv,.mat,.txt,.tsv,.json";

const IC = {
  waveform: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2l2-7 4 14 2-7 2 3h6"/></svg>,
  frequency: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m4 10V4m4 16v-7m4 7V8m4 12v-4"/></svg>,
  spectro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg>,
  topo: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>,
  bands: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h7"/></svg>,
  insights: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
  quality: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  annot: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18l7-4 7 4V3H5z"/></svg>,
  report: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-7 6h8a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v16a2 2 0 002 2z"/></svg>,
  assist: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 01-13.5 7.79L3 21l1.21-4.5A9 9 0 1121 12z"/></svg>,
  autoclean: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7"/></svg>,
  recs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  sleep: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>,
  connect: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path strokeLinecap="round" d="M7 5h10M5 7v10M19 7v10M7 19h10"/></svg>,
  tpl: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7"/></svg>,
  compare: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18M3 9h6M15 21V3M21 15h-6"/></svg>,
  glossary: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h13a3 3 0 013 3v13a1 1 0 01-1 1H7a3 3 0 01-3-3V4zM4 4v13a3 3 0 003 3"/></svg>,
  lit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>,
  methods: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v15H6.5A2.5 2.5 0 004 19.5z"/></svg>,
  ica: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path strokeLinecap="round" d="M8 6h8M8 18h8M6 8v8M18 8v8"/></svg>,
  cohort: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>,
  bids: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h12l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM14 4v6h6"/></svg>,
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [cleanedResult, setCleanedResult] = useState<any>(null);
  const [showCleaned, setShowCleaned] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("insights");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  const [eegUseCase, setEegUseCase] = useState<EEGUseCase>("Resting-state EEG");
  const [eegDeviceType, setEegDeviceType] = useState("Research-grade system");
  const deviceNotch = eegDeviceType === "Consumer / low-cost device" ? 60 : 50;
  const [bandpassLow, setBandpassLow] = useState(PRESETS[eegUseCase].bandpassLow);
  const [bandpassHigh, setBandpassHigh] = useState(PRESETS[eegUseCase].bandpassHigh);
  const [notchFreq, setNotchFreq] = useState(deviceNotch);
  const [lowpassFreq, setLowpassFreq] = useState<number | null>(PRESETS[eegUseCase].lowpassFreq);
  const [highpassFreq, setHighpassFreq] = useState<number | null>(PRESETS[eegUseCase].highpassFreq);

  useEffect(() => {
    const p = PRESETS[eegUseCase];
    setBandpassLow(p.bandpassLow);
    setBandpassHigh(p.bandpassHigh);
    setLowpassFreq(p.lowpassFreq);
    setHighpassFreq(p.highpassFreq);
    setNotchFreq(deviceNotch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eegUseCase, eegDeviceType]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const currentFilterParams = () => ({
    bandpass_low: bandpassLow,
    bandpass_high: bandpassHigh,
    notch_freq: notchFreq,
    lowpass_freq: lowpassFreq,
    highpass_freq: highpassFreq,
  });

  const cleanEEG = useCallback(async (baseData: any, params: any) => {
    if (baseData?.is_synthetic || baseData?.client_parsed) {
      setCleanedResult({
        ...baseData,
        cleaned_data: baseData.data ?? baseData.preview,
        ...params,
      });
      return;
    }
    setCleaning(true);
    setError(null);
    try {
      let payload: any = { ...baseData, ...params };
      if (baseData.data) payload = { ...payload, data: baseData.data };
      else if (baseData.cleaned_data) payload = { ...payload, data: baseData.cleaned_data };
      if (payload.preview) delete payload.preview;
      const res = await fetch("http://localhost:8000/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Cleaning failed");
      const cleaned = await res.json();
      setCleanedResult(cleaned);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setCleaning(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadResult(null);
    setCleanedResult(null);
    try {
      const isText = /\.(csv|tsv|txt|json)$/i.test(file.name);
      if (isText) {
        const text = await file.text();
        const parsed = parseTextEEG(text, file.name);
        setUploadResult(parsed);
        await cleanEEG(parsed, currentFilterParams());
        setShowCleaned(true);
        setActiveTab("insights");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed — is the backend running on :8000?");
      const uploadData = await res.json();
      const parseRes = await fetch("http://localhost:8000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmp_path: uploadData.tmp_path }),
      });
      if (!parseRes.ok) throw new Error("Parse failed");
      const parsed = await parseRes.json();
      setUploadResult(parsed);
      await cleanEEG(parsed, currentFilterParams());
      setShowCleaned(true);
      setActiveTab("insights");
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const debouncedClean = (partial: Partial<Record<string, number | null>> = {}) => {
    if (!uploadResult) return;
    const params = { ...currentFilterParams(), ...partial };
    setCleaning(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => cleanEEG(uploadResult, params), 450);
  };

  const loadSample = (rec: SampleRecording) => {
    setError(null);
    setUploadResult(rec);
    setCleanedResult({ ...rec, cleaned_data: rec.data });
    setFile(null);
    setShowCleaned(true);
    setActiveTab("insights");
  };

  const activeData = useMemo(
    () =>
      showCleaned && cleanedResult
        ? { ...cleanedResult, preview: cleanedResult.cleaned_data ?? cleanedResult.preview }
        : uploadResult,
    [showCleaned, cleanedResult, uploadResult]
  );

  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!activeData) {
      setAnalysis(null);
      return;
    }
    const data = activeData.cleaned_data ?? activeData.preview ?? activeData.data;
    if (!data || data.length === 0) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    setAnalyzing(true);
    runAnalysisAsync(data, activeData.channel_names, activeData.sampling_rate)
      .then((bundle) => {
        if (cancelled) return;
        setAnalysis(bundle);
        setAnalyzing(false);
      })
      .catch((e) => {
        console.error(e);
        if (cancelled) return;
        try {
          setAnalysis(runAnalysis(data, activeData.channel_names, activeData.sampling_rate));
        } catch (err) {
          console.error(err);
          setAnalysis(null);
        }
        setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeData]);

  const assistantContext: AssistantContext | null = useMemo(() => {
    if (!activeData || !analysis) return null;
    return {
      analysis,
      channelNames: activeData.channel_names,
      sampleRate: activeData.sampling_rate,
      durationSec: activeData.duration_sec,
      fileName: activeData.filename || "recording",
    };
  }, [activeData, analysis]);

  useEffect(() => {
    if (!uploadResult || !analysis) return;
    const id = uploadResult.__id ?? makeId();
    if (!uploadResult.__id) uploadResult.__id = id;
    saveHistoryEntry({
      id,
      fileName: uploadResult.filename || "recording",
      channels: uploadResult.channels,
      sampleRate: uploadResult.sampling_rate,
      duration: uploadResult.duration_sec,
      channelNames: uploadResult.channel_names,
      uploadedAt: Date.now(),
      cognitiveState: analysis.cognitive.state,
      dominantBand: analysis.dominantBand,
      qualityScore: analysis.quality.overall,
      isSample: !!uploadResult.is_synthetic,
    });
    setHistory(loadHistory());
  }, [uploadResult, analysis]);

  const onApplyPipeline = (req: ParsedPipelineRequest) => {
    if (req.bandpassLow !== undefined) setBandpassLow(req.bandpassLow);
    if (req.bandpassHigh !== undefined) setBandpassHigh(req.bandpassHigh);
    if (req.notchFreq !== undefined) setNotchFreq(req.notchFreq);
    if (req.lowpassFreq !== undefined) setLowpassFreq(req.lowpassFreq);
    if (req.highpassFreq !== undefined) setHighpassFreq(req.highpassFreq);
    debouncedClean({
      bandpass_low: req.bandpassLow ?? bandpassLow,
      bandpass_high: req.bandpassHigh ?? bandpassHigh,
      notch_freq: req.notchFreq ?? notchFreq,
      lowpass_freq: req.lowpassFreq ?? lowpassFreq,
      highpass_freq: req.highpassFreq ?? highpassFreq,
    });
  };

  const downloadJSON = () => {
    if (!activeData) return;
    const blob = new Blob([JSON.stringify(activeData, null, 2)], { type: "application/json" });
    triggerDownload(blob, `${stripExt(activeData.filename || "eeg_data")}.json`);
  };
  const downloadCSV = () => {
    if (!activeData) return;
    const preview = activeData.cleaned_data ?? activeData.preview ?? activeData.data;
    if (!preview?.[0]) return;
    const header = ["Channel", ...preview[0].map((_: any, i: number) => `S${i + 1}`)].join(",");
    const rows = activeData.channel_names.map((name: string, idx: number) =>
      [name, ...preview[idx]].join(",")
    );
    const csv = [header, ...rows].join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv" }), `${stripExt(activeData.filename || "eeg_data")}.csv`);
  };

  const recsCount = analysis ? recommend(analysis, currentFilterParams() as any).length : 0;
  const SIDEBAR_ITEMS: SidebarItem[] = analysis
    ? [
        { id: "insights", label: "Insights", icon: IC.insights, group: "Analysis" },
        { id: "quality", label: "Quality", icon: IC.quality, badge: `${analysis.quality.overall}`, group: "Analysis" },
        { id: "bands", label: "Band power", icon: IC.bands, group: "Analysis" },
        { id: "recommendations", label: "Recommendations", icon: IC.recs, badge: recsCount || undefined, group: "Automation" },
        { id: "autoclean", label: "Auto-clean", icon: IC.autoclean, group: "Automation" },
        { id: "ica", label: "Components (ICA)", icon: IC.ica, group: "Automation" },
        { id: "templates", label: "Templates", icon: IC.tpl, group: "Automation" },
        { id: "waveform", label: "Waveform", icon: IC.waveform, group: "Visualize" },
        { id: "frequency", label: "Frequency", icon: IC.frequency, group: "Visualize" },
        { id: "timefreq", label: "Spectrogram", icon: IC.spectro, group: "Visualize" },
        { id: "topography", label: "Topography", icon: IC.topo, group: "Visualize" },
        { id: "connectivity", label: "Connectivity", icon: IC.connect, group: "Visualize" },
        { id: "sleep", label: "Sleep staging", icon: IC.sleep, group: "Specialized" },
        { id: "compare", label: "Compare", icon: IC.compare, group: "Specialized" },
        { id: "cohort", label: "Cohort QC", icon: IC.cohort, group: "Specialized" },
        { id: "annotations", label: "Annotations", icon: IC.annot, badge: analysis.quality.artifactCount, group: "Inspect" },
        { id: "assistant", label: "Assistant", icon: IC.assist, group: "AI" },
        { id: "literature", label: "Literature", icon: IC.lit, group: "AI" },
        { id: "methods", label: "Methods", icon: IC.methods, group: "AI" },
        { id: "glossary", label: "Glossary", icon: IC.glossary, group: "Reference" },
        { id: "report", label: "Report", icon: IC.report, group: "Export" },
        { id: "bids", label: "BIDS export", icon: IC.bids, group: "Export" },
      ]
    : [];

  const channelData = activeData?.cleaned_data ?? activeData?.preview ?? activeData?.data ?? [];
  const summary = analysis
    ? {
        fileName: activeData.filename || "recording",
        channels: activeData.channels,
        channelNames: activeData.channel_names,
        sampleRate: activeData.sampling_rate,
        durationSec: activeData.duration_sec,
        analysis,
        filters: currentFilterParams(),
      }
    : null;

  /* =====================================================
     LANDING
  ===================================================== */
  if (!uploadResult) {
    return (
      <main className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* Hero */}
        <section className="pt-16 pb-10 sm:pt-24 sm:pb-14 animate-fade-in">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 chip mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))] pulse-soft" />
                <span>v0.2 · 19 workspace views · BYO AI</span>
              </div>
              <h1 className="text-display-gradient text-balance font-medium tracking-[-0.04em] leading-[0.98] text-[clamp(2.75rem,6vw,5.5rem)]">
                The EEG workspace, <span className="text-accent">re-thought</span>.
              </h1>
              <p className="text-[rgb(var(--text-soft))] max-w-xl mt-6 text-base sm:text-lg leading-relaxed">
                Drop a recording, clean it intelligently, and tour your brainwaves through 19 analytical
                views — frequency, topography, sleep, connectivity, components, AI-written reports. Local,
                private, fast.
              </p>

              <div className="flex flex-wrap gap-2.5 mt-8">
                <button onClick={() => inputRef.current?.click()} className="btn btn-primary">
                  Upload a recording
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </button>
                <button onClick={() => loadSample(SAMPLES[0].build())} className="btn btn-secondary">
                  Try a sample
                </button>
              </div>

              {/* Inline trust stats */}
              <div className="grid grid-cols-3 gap-6 mt-10 max-w-xl">
                {[
                  { value: "19", label: "workspace views" },
                  { value: "9", label: "AI providers" },
                  { value: "100%", label: "local-first" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="num-display text-3xl sm:text-4xl">{s.value}</div>
                    <div className="text-[11px] text-[rgb(var(--muted))] mt-1.5 uppercase tracking-wider">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decorative wave panel */}
            <div className="lg:col-span-5">
              <DecorativeWave />
            </div>
          </div>
        </section>

        {/* Upload area */}
        <section className="pb-12">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all ${
              dragActive
                ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent-bg))] scale-[1.005]"
                : "border-[rgb(var(--border))] bg-[rgb(var(--surface))] hover:border-[rgb(var(--border-strong))]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full px-6 py-10 sm:py-12 flex flex-col items-center text-center"
            >
              <div className="text-sm">
                {file ? (
                  <>
                    <span className="font-medium">{file.name}</span>
                    <span className="text-[rgb(var(--muted))]"> · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">Drop your EEG file here</span>
                    <span className="text-[rgb(var(--muted))]">, or click to browse</span>
                  </>
                )}
              </div>
              <div className="text-xs text-[rgb(var(--muted))] mt-1.5">
                EDF, BDF, CSV, MAT, JSON · processed locally
              </div>
            </button>
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-xl">
                <div className="h-full animate-shimmer" />
              </div>
            )}
          </div>

          {file && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button disabled={!file || uploading} onClick={handleUpload} className="btn btn-primary">
                {uploading ? <><Spinner /> Processing…</> : "Upload & analyze"}
              </button>
              <button onClick={() => setFile(null)} className="btn btn-ghost">Clear</button>
            </div>
          )}
          {error && (
            <div className="mt-3">
              <Banner tone="danger" onClose={() => setError(null)}>{error}</Banner>
            </div>
          )}
        </section>

        {/* Context + Samples grid */}
        <section className="pb-16 grid gap-6 sm:grid-cols-2">
          <div className="surface rounded-xl p-5">
            <SectionHeader
              eyebrow="Context"
              title="Recording type"
              subtitle="Sets sensible filter defaults."
            />
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Use case</label>
                <select
                  value={eegUseCase}
                  onChange={(e) => setEegUseCase(e.target.value as EEGUseCase)}
                  className="input select"
                >
                  {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[rgb(var(--muted))] block mb-1.5">Device</label>
                <select
                  value={eegDeviceType}
                  onChange={(e) => setEegDeviceType(e.target.value)}
                  className="input select"
                >
                  <option>Research-grade system</option>
                  <option>Consumer / low-cost device</option>
                </select>
              </div>
              <div className="text-xs text-[rgb(var(--muted))]">
                Notch defaults to <span className="mono">{deviceNotch} Hz</span>.
              </div>
            </div>
          </div>

          <div className="surface rounded-xl p-5">
            <SectionHeader
              eyebrow="Or try"
              title="Synthetic recordings"
              subtitle="One click to explore the full workspace."
            />
            <div className="divide-y -mx-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSample(s.build())}
                  className="group w-full text-left px-2 py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-[rgb(var(--surface-2))] rounded-md transition"
                >
                  <span>{s.title}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-3 w-3 text-[rgb(var(--subtle))] group-hover:text-[rgb(var(--accent))] group-hover:translate-x-0.5 transition-all"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Bento features */}
        <section className="pb-20">
          <div className="mb-10 max-w-2xl">
            <div className="eyebrow mb-3">What's inside</div>
            <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.025em] leading-[1.1]">
              Every analytical view a researcher needs — and{" "}
              <span className="text-accent">nothing they don't</span>.
            </h2>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-6">
            {/* Big card — AI assistant */}
            <div className="surface bento rounded-2xl p-6 sm:col-span-4 sm:row-span-2 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="chip-accent chip">AI</span>
                <span className="eyebrow">Assistant</span>
              </div>
              <h3 className="text-2xl font-medium tracking-tight mb-2">
                Talk to your recording. Get answers grounded in real numbers.
              </h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed flex-1">
                Bring your own LLM — Groq, Gemini, Claude, GPT-4, or self-hosted Ollama. The assistant reads
                your live DSP analysis and can update the filter pipeline from plain English: <em>"clean for
                sleep, notch 60"</em>.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {["Groq", "Gemini", "OpenRouter", "Mistral", "Ollama", "Claude", "GPT-4"].map((p) => (
                  <span key={p} className="chip">{p}</span>
                ))}
              </div>
            </div>

            {/* Quality score */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Quality score</div>
              <div className="num-display text-5xl">
                0<span className="text-[rgb(var(--muted))]">–</span>100
              </div>
              <p className="text-sm text-[rgb(var(--muted))] mt-3 leading-relaxed">
                Composite of clean-sample %, channel health, alpha signature, and line-noise. Drill into
                each component.
              </p>
            </div>

            {/* Cognitive state */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Cognitive state</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["focused", "relaxed", "drowsy", "alert", "meditative", "stressed"].map((s) => (
                  <span key={s} className="chip capitalize">{s}</span>
                ))}
              </div>
              <p className="text-sm text-[rgb(var(--muted))] mt-3 leading-relaxed">
                6-class heuristic classifier based on band ratios. Confidence-scored, never overconfident.
              </p>
            </div>

            {/* Topography */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Topography</div>
              <div className="flex items-center justify-center my-2">
                <svg viewBox="0 0 60 60" className="h-16 w-16">
                  <defs>
                    <radialGradient id="topo-grad">
                      <stop offset="0" stopColor="rgb(var(--accent))" stopOpacity="0.7" />
                      <stop offset="0.5" stopColor="rgb(var(--accent))" stopOpacity="0.3" />
                      <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="30" cy="30" r="22" fill="url(#topo-grad)" />
                  <circle cx="30" cy="30" r="24" fill="none" stroke="rgb(var(--border-strong))" strokeWidth="1" />
                  {[
                    [30, 12], [18, 22], [42, 22], [12, 36], [48, 36], [30, 48],
                  ].map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="1.5" fill="rgb(var(--text))" />
                  ))}
                </svg>
              </div>
              <p className="text-sm text-[rgb(var(--muted))] text-center leading-relaxed">
                10-20 scalp projection per band.
              </p>
            </div>

            {/* Auto-clean */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-3">
              <div className="eyebrow mb-1.5">Automation</div>
              <h3 className="font-medium text-base mb-1">One-click auto-clean</h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                Detects mains noise (50 / 60 Hz), flags bad channels by variance / kurtosis, picks
                paradigm-appropriate filters. Shows the rationale; you click Apply.
              </p>
            </div>

            {/* Reproducibility */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-3">
              <div className="eyebrow mb-1.5">Reproducibility</div>
              <h3 className="font-medium text-base mb-1">Manifest + runnable code</h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                Every analysis exports a signed JSON manifest plus AI-written MNE-Python / EEGLAB /
                FieldTrip scripts. Replay byte-for-byte.
              </p>
            </div>

            {/* BIDS */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Standards</div>
              <h3 className="font-medium text-base mb-1">BIDS-EEG export</h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                One click → a BIDS-compatible bundle ready for OpenNeuro.
              </p>
            </div>

            {/* Cohort */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Faculty workflow</div>
              <h3 className="font-medium text-base mb-1">Cohort QC</h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                Batch-load recordings; subjects ranked by anomaly score.
              </p>
            </div>

            {/* Sleep */}
            <div className="surface bento rounded-2xl p-5 sm:col-span-2">
              <div className="eyebrow mb-1.5">Specialized</div>
              <h3 className="font-medium text-base mb-1">Sleep staging</h3>
              <p className="text-sm text-[rgb(var(--muted))] leading-relaxed">
                30s-epoch hypnogram with spindle &amp; K-complex detection.
              </p>
            </div>
          </div>
        </section>

        {/* History */}
        {history.length > 0 && (
          <section className="pb-20">
            <SectionHeader
              eyebrow="Recent"
              title="Session history"
              subtitle="Lightweight summaries — stored locally only."
            />
            <div className="divide-y border rounded-xl bg-[rgb(var(--surface))] overflow-hidden">
              {history.slice(0, 6).map((h) => (
                <div key={h.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{h.fileName}</div>
                    <div className="text-xs text-[rgb(var(--muted))] mt-0.5">
                      <span className="mono">{h.channels}ch · {h.sampleRate}Hz · {h.duration?.toFixed?.(1) ?? h.duration}s</span>
                      {h.cognitiveState && <span> · <span className="capitalize">{h.cognitiveState}</span></span>}
                    </div>
                  </div>
                  {h.qualityScore !== undefined && (
                    <span className="text-xs mono text-[rgb(var(--muted))]">{h.qualityScore}/100</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    );
  }

  /* =====================================================
     WORKSPACE
  ===================================================== */
  return (
    <main className="mx-auto max-w-7xl px-5 sm:px-8 pt-6 pb-16">
      {/* Recording bar */}
      <div className="rounded-2xl border bg-[rgb(var(--surface))] p-3.5 sm:p-4 mb-5 flex flex-wrap items-center gap-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="relative flex h-2 w-2">
            {analyzing && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${analyzing ? "bg-amber-500" : "bg-emerald-500"}`} />
          </span>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{activeData.filename || "recording"}</div>
            <div className="text-xs text-[rgb(var(--muted))] mono">
              {activeData.channels} ch · {activeData.sampling_rate} Hz · {activeData.duration_sec.toFixed(1)}s
              {activeData.is_synthetic ? <> · <span className="chip-accent chip !py-0 !text-[10px]">synthetic</span></> : null}
              {analyzing ? <> · <span className="text-amber-600 dark:text-amber-400">analyzing…</span></> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            value={showCleaned ? "cleaned" : "raw"}
            onChange={(v) => setShowCleaned(v === "cleaned")}
            options={[{ id: "raw", label: "Raw" }, { id: "cleaned", label: "Cleaned" }]}
          />
          <div className="inline-flex rounded-md border bg-[rgb(var(--surface))]">
            <button onClick={downloadCSV} className="px-3 py-1.5 text-xs font-medium hover:bg-[rgb(var(--surface-2))] rounded-l-md transition">
              ↓ CSV
            </button>
            <span className="w-px bg-[rgb(var(--border))]" />
            <button onClick={downloadJSON} className="px-3 py-1.5 text-xs font-medium hover:bg-[rgb(var(--surface-2))] rounded-r-md transition">
              ↓ JSON
            </button>
          </div>
          <button
            onClick={() => { setUploadResult(null); setCleanedResult(null); setFile(null); setActiveTab("insights"); }}
            className="btn btn-secondary text-xs"
            title="Load a different recording"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New recording
          </button>
        </div>
      </div>

      {/* Filter strip */}
      <div className="rounded-xl border bg-[rgb(var(--surface))] p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="eyebrow shrink-0 mr-1">Filters</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1 min-w-0">
            <FilterField label="BP low" value={bandpassLow} min={0} max={bandpassHigh - 1}
              onChange={(v) => { const n = v ?? 0; setBandpassLow(n); debouncedClean({ bandpass_low: n }); }} />
            <FilterField label="BP high" value={bandpassHigh} min={bandpassLow + 1} max={200}
              onChange={(v) => { const n = v ?? 0; setBandpassHigh(n); debouncedClean({ bandpass_high: n }); }} />
            <FilterField label="Notch" value={notchFreq} min={40} max={70}
              onChange={(v) => { const n = v ?? 50; setNotchFreq(n); debouncedClean({ notch_freq: n }); }} />
            <FilterField label="LP" value={lowpassFreq} placeholder="—"
              onChange={(v) => { setLowpassFreq(v); debouncedClean({ lowpass_freq: v }); }} />
            <FilterField label="HP" value={highpassFreq} placeholder="—"
              onChange={(v) => { setHighpassFreq(v); debouncedClean({ highpass_freq: v }); }} />
          </div>
          {cleaning && (
            <span className="text-xs text-[rgb(var(--muted))] inline-flex items-center gap-1.5 shrink-0">
              <Spinner /> updating
            </span>
          )}
        </div>
      </div>

      {/* Stat strip */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Stat
            label="Channels"
            value={<span className="mono">{activeData.channels}</span>}
          />
          <Stat
            label="State"
            value={<span className="capitalize">{analysis.cognitive.state}</span>}
            hint={`${(analysis.cognitive.confidence * 100).toFixed(0)}% confidence`}
          />
          <Stat
            label="Dominant"
            value={<span className="capitalize">{analysis.dominantBand}</span>}
            hint={`${((analysis.avgBands[analysis.dominantBand] / (analysis.avgBands.total || 1)) * 100).toFixed(0)}% of spectrum`}
          />
          <Stat
            label="Quality"
            value={<span className="mono">{analysis.quality.overall}/100</span>}
            hint={analysis.quality.badChannels.length ? `${analysis.quality.badChannels.length} bad channel(s)` : "all channels clean"}
          />
        </div>
      )}

      {/* Sidebar + Content */}
      {analysis && (
        <div className="flex flex-col lg:flex-row gap-6">
          <WorkspaceSidebar items={SIDEBAR_ITEMS} active={activeTab} onChange={setActiveTab} />

          <div className="flex-1 min-w-0 animate-fade-up">
            {activeTab === "insights" && <AIInsights analysis={analysis} />}
            {activeTab === "waveform" && <EEGVisualization eegData={activeData} />}
            {activeTab === "frequency" && <Card><PSDView data={channelData} channelNames={activeData.channel_names} sampleRate={activeData.sampling_rate} /></Card>}
            {activeTab === "timefreq" && <Card><SpectrogramView data={channelData} channelNames={activeData.channel_names} sampleRate={activeData.sampling_rate} /></Card>}
            {activeTab === "topography" && <Card><TopographyView data={channelData} channelNames={activeData.channel_names} sampleRate={activeData.sampling_rate} /></Card>}
            {activeTab === "bands" && <Card><BandPowerView data={channelData} channelNames={activeData.channel_names} sampleRate={activeData.sampling_rate} /></Card>}
            {activeTab === "quality" && <QualityDashboard analysis={analysis} channelNames={activeData.channel_names} />}
            {activeTab === "annotations" && (
              <AnnotationsView
                data={channelData}
                channelNames={activeData.channel_names}
                sampleRate={activeData.sampling_rate}
                duration={activeData.duration_sec}
              />
            )}
            {activeTab === "assistant" && (
              <AIAssistant context={assistantContext} onApplyPipeline={onApplyPipeline} onOpenSettings={() => setAiSettingsOpen(true)} />
            )}
            {activeTab === "recommendations" && analysis && (
              <RecommendationsPanel
                recommendations={recommend(analysis, currentFilterParams() as any)}
                onApply={(r) => {
                  if (!r.apply) return;
                  if (r.apply.bandpass_low !== undefined) setBandpassLow(r.apply.bandpass_low);
                  if (r.apply.bandpass_high !== undefined) setBandpassHigh(r.apply.bandpass_high);
                  if (r.apply.notch_freq !== undefined) setNotchFreq(r.apply.notch_freq);
                  if (r.apply.highpass_freq !== undefined) setHighpassFreq(r.apply.highpass_freq);
                  if (r.apply.lowpass_freq !== undefined) setLowpassFreq(r.apply.lowpass_freq);
                  const { exclude_channels: _x, ...filterPatch } = r.apply;
                  debouncedClean(filterPatch);
                }}
              />
            )}
            {activeTab === "autoclean" && (
              <AutoCleanPanel
                data={channelData}
                channelNames={activeData.channel_names}
                sampleRate={activeData.sampling_rate}
                useCase={eegUseCase}
                onApply={(recipe: AutoCleanRecipe) => {
                  setBandpassLow(recipe.bandpass_low);
                  setBandpassHigh(recipe.bandpass_high);
                  setNotchFreq(recipe.notch_freq);
                  setHighpassFreq(recipe.highpass_freq);
                  setLowpassFreq(recipe.lowpass_freq);
                  debouncedClean({
                    bandpass_low: recipe.bandpass_low,
                    bandpass_high: recipe.bandpass_high,
                    notch_freq: recipe.notch_freq,
                    highpass_freq: recipe.highpass_freq,
                    lowpass_freq: recipe.lowpass_freq,
                  });
                }}
              />
            )}
            {activeTab === "templates" && (
              <PipelineTemplates
                current={currentFilterParams() as any}
                currentUseCase={eegUseCase}
                onApply={(t: PipelineTemplate) => {
                  setBandpassLow(t.filters.bandpass_low);
                  setBandpassHigh(t.filters.bandpass_high);
                  setNotchFreq(t.filters.notch_freq);
                  setHighpassFreq(t.filters.highpass_freq);
                  setLowpassFreq(t.filters.lowpass_freq);
                  debouncedClean({ ...t.filters });
                }}
              />
            )}
            {activeTab === "connectivity" && (
              <Card>
                <ConnectivityView
                  data={channelData}
                  channelNames={activeData.channel_names}
                  sampleRate={activeData.sampling_rate}
                />
              </Card>
            )}
            {activeTab === "sleep" && (
              <Card>
                <SleepStagingView
                  data={channelData}
                  channelNames={activeData.channel_names}
                  sampleRate={activeData.sampling_rate}
                />
              </Card>
            )}
            {activeTab === "compare" && analysis && (
              <ComparisonView primary={activeData} primaryAnalysis={analysis} />
            )}
            {activeTab === "cohort" && <CohortView />}
            {activeTab === "ica" && (
              <Card>
                <ICAView
                  data={channelData}
                  channelNames={activeData.channel_names}
                  sampleRate={activeData.sampling_rate}
                />
              </Card>
            )}
            {activeTab === "bids" && analysis && summary && (
              <BIDSExport
                data={{
                  fileName: summary.fileName,
                  channels: summary.channels,
                  channelNames: summary.channelNames,
                  sampleRate: summary.sampleRate,
                  duration: summary.durationSec,
                  cleanedData: channelData,
                  filters: summary.filters,
                  analysis: summary.analysis,
                }}
              />
            )}
            {activeTab === "glossary" && <GlossaryView />}
            {activeTab === "literature" && analysis && (
              <LiteratureSearch
                analysis={analysis}
                fileName={activeData.filename || "recording"}
                onOpenSettings={() => setAiSettingsOpen(true)}
              />
            )}
            {activeTab === "methods" && analysis && summary && (
              <MethodsWriteup
                fileName={summary.fileName}
                channels={summary.channels}
                channelNames={summary.channelNames}
                sampleRate={summary.sampleRate}
                duration={summary.durationSec}
                filters={summary.filters}
                analysis={summary.analysis}
                onOpenSettings={() => setAiSettingsOpen(true)}
              />
            )}
            {activeTab === "report" && summary && (
              <div className="space-y-5">
                <ReportPanel
                  fileName={summary.fileName}
                  channels={summary.channels}
                  channelNames={summary.channelNames}
                  sampleRate={summary.sampleRate}
                  duration={summary.durationSec}
                  filters={summary.filters}
                  analysis={summary.analysis}
                />
                <AIProseReport summary={summary} onOpenSettings={() => setAiSettingsOpen(true)} />
                <AICodeGen summary={summary} onOpenSettings={() => setAiSettingsOpen(true)} />
              </div>
            )}
          </div>
        </div>
      )}

      <AISettingsModal open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
    </main>
  );
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
