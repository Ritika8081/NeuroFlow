import React from "react";

export default function Docs() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 font-sans">
      <div className="max-w-2xl bg-white/80 dark:bg-zinc-900/80 rounded-2xl p-8 shadow-lg mt-20">
        <h1 className="text-3xl font-bold text-purple-700 mb-4">NeuroFlow Lab Documentation</h1>
        <h2 className="text-xl font-semibold mt-6 mb-2">Getting Started</h2>
        <ul className="list-disc pl-6 text-zinc-700 dark:text-zinc-200 mb-6">
          <li>Upload EEG files (.edf, .csv, .mat) using the drag-and-drop or browse button.</li>
          <li>Set context (use case, age group, device type) for recommended filter presets.</li>
          <li>Adjust filter values as needed for your analysis.</li>
          <li>Visualize raw and cleaned EEG data interactively.</li>
          <li>Download results in JSON or CSV format.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">Filter Recommendations</h2>
        <ul className="list-disc pl-6 text-zinc-700 dark:text-zinc-200 mb-6">
          <li>High-pass: 0.5 Hz (0.1–1 Hz) – removes slow drift, preserves delta.</li>
          <li>Low-pass: 45 Hz (30–70 Hz) – removes high-frequency noise.</li>
          <li>Band-pass: 1–45 Hz (1–50 Hz) – standard EEG range.</li>
          <li>Notch: 50/60 Hz – removes line noise (region-specific).</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">FAQ</h2>
        <ul className="list-disc pl-6 text-zinc-700 dark:text-zinc-200 mb-6">
          <li>How do I choose filter values? Use context presets or refer to Info/Help.</li>
          <li>Can I override presets? Yes, all filter values are editable.</li>
          <li>Where is my data stored? All processing is local; no data is uploaded externally.</li>
        </ul>
        <p className="text-sm text-zinc-500 mt-4">For more details, see About or contact NeuroBuddy.</p>
      </div>
    </div>
  );
}
