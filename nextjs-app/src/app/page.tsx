"use client";

import React from "react";
import { useState, useRef, useCallback } from "react";
import EEGVisualization from "../components/EEGVisualization";

export default function Home() {
  // ...existing code...
  const [file, setFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [cleanedResult, setCleanedResult] = useState<any>(null);
  const [showCleaned, setShowCleaned] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Filter params
  // Info / Help Section state
  const [showHelp, setShowHelp] = useState(false);
  // EEG Context Panel state
  const [eegUseCase, setEegUseCase] = useState<EEGUseCase>("Resting-state EEG");
  const [eegAgeGroup, setEegAgeGroup] = useState("Healthy adults");
  const [eegDeviceType, setEegDeviceType] = useState("Research-grade system");

  // Filter params (preset logic)
  type EEGUseCase =
    | "Resting-state EEG"
    | "Cognitive / task-based EEG"
    | "Sleep / overnight EEG"
    | "BCI / neurofeedback"
    | "Low-cost device";
  
  const presetFilters: Record<EEGUseCase, {
    bandpassLow: number;
    bandpassHigh: number;
    notchFreq: number;
    lowpassFreq: number;
    highpassFreq: number;
  }> = {
    "Resting-state EEG": { bandpassLow: 1, bandpassHigh: 45, notchFreq: 50, lowpassFreq: 45, highpassFreq: 0.5 },
    "Cognitive / task-based EEG": { bandpassLow: 1, bandpassHigh: 50, notchFreq: 50, lowpassFreq: 50, highpassFreq: 0.5 },
    "Sleep / overnight EEG": { bandpassLow: 0.1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 0.1 },
    "BCI / neurofeedback": { bandpassLow: 1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 1 },
    "Low-cost device": { bandpassLow: 1, bandpassHigh: 40, notchFreq: 50, lowpassFreq: 40, highpassFreq: 1 },
  };
  // Device-specific notch
  const deviceNotch = eegDeviceType === "Consumer / low-cost device" ? 60 : 50;
  // Use preset or allow override
  const [bandpassLow, setBandpassLow] = useState(presetFilters[eegUseCase].bandpassLow);
  const [bandpassHigh, setBandpassHigh] = useState(presetFilters[eegUseCase].bandpassHigh);
  const [notchFreq, setNotchFreq] = useState(deviceNotch);
  const [lowpassFreq, setLowpassFreq] = useState<number|null>(presetFilters[eegUseCase].lowpassFreq);
  const [highpassFreq, setHighpassFreq] = useState<number|null>(presetFilters[eegUseCase].highpassFreq);
  
  // Update filter values when context changes
  React.useEffect(() => {
    setBandpassLow(presetFilters[eegUseCase].bandpassLow);
    setBandpassHigh(presetFilters[eegUseCase].bandpassHigh);
    setLowpassFreq(presetFilters[eegUseCase].lowpassFreq);
    setHighpassFreq(presetFilters[eegUseCase].highpassFreq);
    setNotchFreq(deviceNotch);
  }, [eegUseCase, eegDeviceType]);
  // Debounce ref
  const debounceRef = useRef<NodeJS.Timeout|null>(null);

  function handleDrag(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);
    setCleanedResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const uploadData = await res.json();
      // Now parse EEG
      const parseRes = await fetch("http://localhost:8000/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmp_path: uploadData.tmp_path }),
      });
      if (!parseRes.ok) {
        throw new Error("Parse failed");
      }
      const parsed = await parseRes.json();
      setUploadResult(parsed);
      // Immediately clean after upload
      await cleanEEG(parsed, {
        bandpass_low: bandpassLow,
        bandpass_high: bandpassHigh,
        notch_freq: notchFreq,
        lowpass_freq: lowpassFreq,
        highpass_freq: highpassFreq,
      });
      setShowCleaned(true);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setUploading(false);
    }
  }

  // Clean EEG with debounce
  const cleanEEG = useCallback(async (baseData: any, params: any) => {
    setCleaning(true);
    setError(null);
    try {
      // Always send the full data array if available
      let payload = { ...baseData, ...params };
      if (baseData.data) {
        payload = { ...payload, data: baseData.data };
      } else if (baseData.cleaned_data) {
        payload = { ...payload, data: baseData.cleaned_data };
      }
      // Remove preview to avoid backend using it
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

  // Debounced filter change handler
  const handleFilterChange = (params: any) => {
    if (!uploadResult) return;
    setCleaning(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      cleanEEG(uploadResult, params);
    }, 500);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 font-sans">
      {/* Main Header */}
      <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="inline-block bg-white/20 rounded-full px-6 py-3 font-extrabold text-3xl tracking-tight shadow text-blue-700 drop-shadow-lg">NeuroFlow Lab</h1>
            <span className="hidden sm:inline text-white/80 font-semibold text-lg">EEG Research Tool</span>
          </div>
          <nav className="flex gap-4">
          
            <button
              onClick={() => window.location.href = '/docs'}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded transition min-w-[110px]"
            >
              Docs
            </button>
            <button
              onClick={() => window.location.href = '/about'}
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded transition min-w-[110px]"
            >
              About
            </button>
            <button
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded transition min-w-[110px]"
              onClick={() => setShowHelp(prev => !prev)}
            >
              {showHelp ? "Hide Info / Help" : "Show Info / Help"}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-12 px-2 sm:py-20 sm:px-6 md:py-28 md:px-10 mx-auto sm:items-start">
        <div className="w-full mb-8" />
        {/* Upload Section */}
        <section className="w-full max-w-md mb-8">
          <div className={`p-6 border-2 border-dashed rounded-2xl shadow-lg bg-white/90 dark:bg-zinc-900/80 ${dragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300"}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".edf,.csv,.mat"
              className="hidden"
              onChange={handleChange}
            />
            <div className="flex flex-col items-center justify-center text-gray-600">
              <h2 className="text-xl font-bold text-blue-700 mb-2">Upload EEG File</h2>
              <p className="mb-4">Drag & drop EEG file here (.edf, .csv, .mat) or <button className="underline text-blue-600" onClick={() => inputRef.current?.click()}>browse</button></p>
              {file && <p className="mb-2 font-semibold text-blue-700">Selected: {file.name}</p>}
              <button
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-300 flex items-center justify-center min-w-[140px] font-semibold"
                disabled={!file || uploading}
                onClick={handleUpload}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : "Upload & Parse"}
              </button>
              {error && (
                <div className="mt-2 flex items-center gap-2 text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                  <span>{error}</span>
                </div>
              )}
              {uploadResult && !error && (
                <div className="mt-2 flex items-center gap-2 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>EEG file uploaded and parsed successfully!</span>
                </div>
              )}
            </div>
          </div>
        </section>
        {/* Context Panel Section - only show once */}
        <section className="w-full max-w-md mb-8">
          <div className="bg-white/80 dark:bg-zinc-900/80 rounded-2xl p-6 shadow flex flex-col gap-4">
            <h2 className="text-xl font-bold text-blue-700 mb-2">EEG Context Panel</h2>
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <label className="block text-xs font-semibold mb-1">EEG Use Case</label>
                <select value={eegUseCase} onChange={e => setEegUseCase(e.target.value as EEGUseCase)} className="rounded-lg px-3 py-1 border border-blue-200 bg-blue-50 text-blue-900 font-semibold">
                  <option>Resting-state EEG</option>
                  <option>Cognitive / task-based EEG</option>
                  <option>Sleep / overnight EEG</option>
                  <option>BCI / neurofeedback</option>
                  <option>Low-cost device</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Population / Age Group</label>
                <select value={eegAgeGroup} onChange={e => setEegAgeGroup(e.target.value)} className="rounded-lg px-3 py-1 border border-purple-200 bg-purple-50 text-purple-900 font-semibold">
                  <option>Healthy adults</option>
                  <option>Children / adolescents</option>
                  <option>Clinical patients</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">EEG Device Type</label>
                <select value={eegDeviceType} onChange={e => setEegDeviceType(e.target.value)} className="rounded-lg px-3 py-1 border border-pink-200 bg-pink-50 text-pink-900 font-semibold">
                  <option>Research-grade system</option>
                  <option>Consumer / low-cost device</option>
                </select>
              </div>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              <b>Tip:</b> Context presets will auto-fill recommended filter values below. You can override them for custom analysis.
            </div>
          </div>
        </section>
        {/* Info / Help Section */}
        <div className="w-full mb-6">
          {showHelp && (
            <div className="bg-blue-50 dark:bg-zinc-900/80 rounded-2xl p-4 shadow flex flex-col gap-2">
              <div className="mt-2 text-xs text-zinc-700 dark:text-zinc-200 bg-white/80 rounded-xl p-3 border border-blue-200 shadow">
                <b>EEG Filter Recommendations:</b>
                <table className="w-full text-xs mt-2 mb-2 border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="px-2 py-1 border">Filter Type</th>
                      <th className="px-2 py-1 border">Default Value</th>
                      <th className="px-2 py-1 border">Valid Range</th>
                      <th className="px-2 py-1 border">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 border">High-pass</td>
                      <td className="px-2 py-1 border">0.5 Hz</td>
                      <td className="px-2 py-1 border">0.1–1 Hz</td>
                      <td className="px-2 py-1 border">Removes slow baseline drift, preserves delta (&lt;4 Hz)</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 border">Low-pass</td>
                      <td className="px-2 py-1 border">45 Hz</td>
                      <td className="px-2 py-1 border">30–70 Hz</td>
                      <td className="px-2 py-1 border">Removes high-frequency noise, keeps delta–beta bands</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 border">Band-pass</td>
                      <td className="px-2 py-1 border">1–45 Hz</td>
                      <td className="px-2 py-1 border">1–50 Hz</td>
                      <td className="px-2 py-1 border">Standard EEG frequency range</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 border">Notch</td>
                      <td className="px-2 py-1 border">50 Hz</td>
                      <td className="px-2 py-1 border">50/60 Hz</td>
                      <td className="px-2 py-1 border">Removes line power noise (region-specific)</td>
                    </tr>
                  </tbody>
                </table>
                <ul className="list-disc pl-5">
                  <li>High-pass: Use lower values to preserve delta activity.</li>
                  <li>Low-pass: 45 Hz is safe; increase for gamma research.</li>
                  <li>Band-pass: 1–45 Hz is standard for most labs.</li>
                  <li>Notch: 50 Hz (India/Europe), 60 Hz (USA); use harmonics if needed.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        {/* EEG Context Panel - removed duplicate rendering */}
        {uploadResult && (
          <>
            {/* Filter Controls & Raw/Cleaned Toggle */}
            <div className="w-full mb-4">
              <div className="bg-gradient-to-r from-blue-100 via-purple-100 to-pink-100 rounded-2xl p-6 shadow flex flex-col gap-4">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-blue-700">
                    <input type="checkbox" checked={showCleaned} onChange={e => setShowCleaned(e.target.checked)} className="accent-pink-500 scale-125" />
                    <span className="font-semibold text-base flex items-center gap-1">
                      <svg className="h-5 w-5 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Show Cleaned
                    </span>
                  </label>
                  <span className="text-xs text-zinc-600 bg-white/70 px-2 py-1 rounded shadow-sm">Toggle to compare <b>raw</b> and <b>cleaned</b> EEG</span>
                </div>
                <div className="flex flex-row flex-wrap gap-4 items-end justify-between w-full">
                  <div className="flex flex-col items-start bg-blue-50 rounded-xl px-3 py-2 shadow border border-blue-200">
                    <label className="block text-xs font-bold mb-1 text-blue-700">Bandpass Low (Hz)</label>
                    <input type="number" min={0} max={bandpassHigh-1} value={bandpassLow} onChange={e => { setBandpassLow(Number(e.target.value)); handleFilterChange({ bandpass_low: Number(e.target.value), bandpass_high: bandpassHigh, notch_freq: notchFreq, lowpass_freq: lowpassFreq, highpass_freq: highpassFreq }); }} className="rounded-full px-3 py-1 w-24 focus:ring-2 focus:ring-blue-400 bg-white border-2 border-blue-200 text-blue-900 font-semibold transition" />
                  </div>
                  <div className="flex flex-col items-start bg-purple-50 rounded-xl px-3 py-2 shadow border border-purple-200">
                    <label className="block text-xs font-bold mb-1 text-purple-700">Bandpass High (Hz)</label>
                    <input type="number" min={bandpassLow+1} max={200} value={bandpassHigh} onChange={e => { setBandpassHigh(Number(e.target.value)); handleFilterChange({ bandpass_low: bandpassLow, bandpass_high: Number(e.target.value), notch_freq: notchFreq, lowpass_freq: lowpassFreq, highpass_freq: highpassFreq }); }} className="rounded-full px-3 py-1 w-24 focus:ring-2 focus:ring-purple-400 bg-white border-2 border-purple-200 text-purple-900 font-semibold transition" />
                  </div>
                  <div className="flex flex-col items-start bg-pink-50 rounded-xl px-3 py-2 shadow border border-pink-200">
                    <label className="block text-xs font-bold mb-1 text-pink-700">Notch Freq (Hz)</label>
                    <input type="number" min={40} max={70} value={notchFreq} onChange={e => { setNotchFreq(Number(e.target.value)); handleFilterChange({ bandpass_low: bandpassLow, bandpass_high: bandpassHigh, notch_freq: Number(e.target.value), lowpass_freq: lowpassFreq, highpass_freq: highpassFreq }); }} className="rounded-full px-3 py-1 w-24 focus:ring-2 focus:ring-pink-400 bg-white border-2 border-pink-200 text-pink-900 font-semibold transition" />
                  </div>
                  <div className="flex flex-col items-start bg-green-50 rounded-xl px-3 py-2 shadow border border-green-200">
                    <label className="block text-xs font-bold mb-1 text-green-700">Lowpass (Hz)</label>
                    <input type="number" min={1} max={200} value={lowpassFreq ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setLowpassFreq(v); handleFilterChange({ bandpass_low: bandpassLow, bandpass_high: bandpassHigh, notch_freq: notchFreq, lowpass_freq: v, highpass_freq: highpassFreq }); }} className="rounded-full px-3 py-1 w-24 focus:ring-2 focus:ring-green-400 bg-white border-2 border-green-200 text-green-900 font-semibold transition" placeholder="(none)" />
                  </div>
                  <div className="flex flex-col items-start bg-orange-50 rounded-xl px-3 py-2 shadow border border-orange-200">
                    <label className="block text-xs font-bold mb-1 text-orange-700">Highpass (Hz)</label>
                    <input type="number" min={1} max={200} value={highpassFreq ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setHighpassFreq(v); handleFilterChange({ bandpass_low: bandpassLow, bandpass_high: bandpassHigh, notch_freq: notchFreq, lowpass_freq: lowpassFreq, highpass_freq: v }); }} className="rounded-full px-3 py-1 w-24 focus:ring-2 focus:ring-orange-400 bg-white border-2 border-orange-200 text-orange-900 font-semibold transition" placeholder="(none)" />
                  </div>
                  <div className="flex flex-col items-center justify-center min-w-[90px]">
                    {cleaning && <span className="text-blue-600 flex items-center gap-1"><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg> Cleaning...</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-6 mb-6 justify-center items-center w-full">
              <button
                className="px-5 py-2 flex items-center gap-2 bg-gradient-to-r from-green-400 to-green-600 text-white rounded-full shadow-lg hover:from-green-500 hover:to-green-700 transition font-semibold text-base drop-shadow-md focus:outline-none focus:ring-2 focus:ring-green-400"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(uploadResult, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = (uploadResult.filename || 'eeg_data') + '.json';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download JSON
              </button>
              <button
                className="px-5 py-2 flex items-center gap-2 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full shadow-lg hover:from-blue-500 hover:to-blue-700 transition font-semibold text-base drop-shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => {
                  // Convert preview data to CSV
                  const header = ['Channel', ...uploadResult.preview[0].map((_: any, i: number) => `Sample${i+1}`)].join(',');
                  const rows = uploadResult.channel_names.map((name: string, idx: number) => [name, ...uploadResult.preview[idx]].join(','));
                  const csv = [header, ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = (uploadResult.filename || 'eeg_data') + '.csv';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download CSV
              </button>
            </div>
            <EEGVisualization
              eegData={showCleaned && cleanedResult ? { ...cleanedResult, preview: cleanedResult.cleaned_data } : uploadResult}
            />
            <div className="mt-8 w-full max-w-md bg-zinc-50 p-6 rounded shadow text-gray-800">
              <h2 className="text-xl font-semibold mb-4">Parsed EEG Metadata</h2>
              <pre className="text-sm bg-zinc-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(showCleaned && cleanedResult ? cleanedResult : uploadResult, null, 2)}
              </pre>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
