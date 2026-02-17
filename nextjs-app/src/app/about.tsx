import React from "react";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 font-sans">
      <div className="max-w-2xl bg-white/80 dark:bg-zinc-900/80 rounded-2xl p-8 shadow-lg mt-20">
        <h1 className="text-3xl font-bold text-blue-700 mb-4">About NeuroFlow Lab</h1>
        <p className="text-lg text-zinc-700 dark:text-zinc-200 mb-6">
          NeuroFlow Lab is an open-source EEG research tool designed for modern neuroscience workflows. Upload, clean, and visualize EEG data with scientifically validated filter presets and context-driven recommendations.
        </p>
        <ul className="list-disc pl-6 text-zinc-700 dark:text-zinc-200 mb-6">
          <li>EEG file upload and parsing (.edf, .csv, .mat)</li>
          <li>Context-driven filter presets (use case, age group, device type)</li>
          <li>Interactive visualization and metadata display</li>
          <li>Download cleaned and raw EEG data</li>
          <li>Info/Help section for scientific guidance</li>
        </ul>
        <p className="text-sm text-zinc-500 mt-4">Created by NeuroBuddy. For feedback or contributions, visit our GitHub.</p>
      </div>
    </div>
  );
}
