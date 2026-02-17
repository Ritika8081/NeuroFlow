import React from "react";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 font-sans">
      <div className="max-w-2xl bg-white/80 dark:bg-zinc-900/80 rounded-2xl p-8 shadow-lg mt-20">
        <h1 className="text-3xl font-bold text-blue-700 mb-4">About NeuroFlow Lab</h1>
        <h2 className="text-xl font-semibold text-blue-600 mb-2">Goal of This Application</h2>
        <p className="text-lg text-zinc-700 dark:text-zinc-200 mb-4">
          The goal of NeuroFlow Lab is to make EEG research more accessible, reproducible, and scientifically rigorous. By providing an intuitive interface for uploading, cleaning, and visualizing EEG data, this tool empowers researchers, clinicians, and students to focus on meaningful analysis rather than technical hurdles.
        </p>
        <div className="text-md text-zinc-700 dark:text-zinc-200 mb-6">
          <span>I am building this application to:</span>
          <ul className="list-disc pl-6 mt-2">
            <li>Bridge the gap between neuroscience research and practical data analysis.</li>
            <li>Enable users to apply best-practice EEG filters with context-driven presets.</li>
            <li>Reduce errors and confusion in EEG preprocessing by providing clear guidance and recommendations.</li>
            <li>Support open science and collaboration by making EEG workflows transparent and easy to share.</li>
            <li>Help both beginners and experts work with EEG data confidently and efficiently.</li>
          </ul>
        </div>
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
