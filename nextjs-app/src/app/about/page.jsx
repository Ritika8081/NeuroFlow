import React from "react";
import Link from "next/link";

const cardStyle = {
  borderRadius: 20,
  border: "1px solid #e0f2fe",
  backgroundColor: "#fff",
  boxShadow: "0 4px 20px -5px rgba(14, 165, 233, 0.12)",
  overflow: "hidden",
};

const headerStyle = {
  padding: "20px 24px",
  borderBottom: "1px solid #e0f2fe",
  backgroundColor: "#f0f9ff",
};

export default function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div style={{ marginBottom: 40, paddingLeft: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0c4a6e", marginBottom: 8, letterSpacing: "-0.02em" }}>About NeuroFlow Lab</h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
          NeuroFlow Lab is an open-source EEG research tool for modern neuroscience workflows. Upload, clean, and visualize EEG data with scientifically validated filter presets and context-driven recommendations.
        </p>
      </div>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>GOAL</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <p style={{ color: "#334155", lineHeight: 1.7 }}>
            To make EEG research accessible, reproducible, and scientifically rigorous by providing an intuitive, context-aware platform for EEG data analysis.
          </p>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>OBJECTIVES</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <ul className="list-disc pl-6 space-y-2" style={{ color: "#334155", lineHeight: 1.7 }}>
            <li>Bridge the gap between neuroscience research and practical data analysis.</li>
            <li>Enable users to apply best-practice EEG filters with context-driven presets.</li>
            <li>Reduce errors and confusion in EEG preprocessing by providing clear guidance and recommendations.</li>
            <li>Support open science and collaboration by making EEG workflows transparent and easy to share.</li>
            <li>Help both beginners and experts work with EEG data confidently and efficiently.</li>
          </ul>
        </div>
      </section>

      <section id="context-presets" style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>CONTEXT &amp; FILTER PRESETS</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 16 }}>
            The Context Presets help you choose filter settings tailored to your use case. Use case affects the bandpass range; age group and device are available for future context-aware recommendations.
          </p>
          <p style={{ color: "#475569", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Use case presets</p>
          <ul className="list-disc pl-6 space-y-2" style={{ color: "#334155", lineHeight: 1.7, marginBottom: 16 }}>
            <li><strong>Research</strong> — 1–45 Hz (broad EEG band for general analysis)</li>
            <li><strong>Clinical</strong> — 0.5–50 Hz (wider range for clinical applications)</li>
            <li><strong>Neurofeedback</strong> — 4–30 Hz (alpha/beta focus for neurofeedback)</li>
            <li><strong>Sleep</strong> — 0.1–30 Hz (low frequencies for delta/theta in sleep)</li>
            <li><strong>Teaching</strong> — 1–45 Hz (same as Research, for educational use)</li>
          </ul>
          <p style={{ color: "#475569", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Age group &amp; device</p>
          <p style={{ color: "#334155", lineHeight: 1.7 }}>
            Age group (adult, child, infant) and device type (research-grade, consumer, mobile) are stored for context. Future updates may tailor recommendations based on these settings.
          </p>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>FEATURES</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <ul className="list-disc pl-6 space-y-2" style={{ color: "#334155", lineHeight: 1.7 }}>
            <li>EEG File Upload (.edf, .csv, .mat)</li>
            <li>PhysioNet EEG Motor Movement/Imagery dataset loading</li>
            <li>Context Panel (use case, age group, device type)</li>
            <li>Filter Controls (bandpass, notch, ICA artifact removal)</li>
            <li>ICA artifact removal & PCA dimensionality reduction</li>
            <li>AI Insights (cognitive load, fatigue, stress, attention)</li>
            <li>Pipeline comparison (Compare page)</li>
            <li>Experiment timeline & event markers</li>
            <li>Download Cleaned/Raw EEG & Features (JSON, CSV)</li>
            <li>Responsive UI (Tailwind CSS)</li>
          </ul>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>LEARN MORE</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <Link href="/docs" style={{ color: "#0284c7", fontWeight: 500 }} className="hover:underline">
            → Documentation
          </Link>
        </div>
      </section>
    </main>
  );
}
