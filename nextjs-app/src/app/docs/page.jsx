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

export default function DocsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div style={{ marginBottom: 40, paddingLeft: 4 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0c4a6e", marginBottom: 8, letterSpacing: "-0.02em" }}>Documentation</h1>
        <p style={{ color: "#475569", fontSize: 16, lineHeight: 1.6 }}>
          NeuroFlow Lab — EEG research tool
        </p>
      </div>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>GETTING STARTED</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <ol className="list-decimal pl-6 space-y-3" style={{ color: "#334155", lineHeight: 1.7 }}>
            <li><strong style={{ color: "#0c4a6e" }}>Load or Upload EEG:</strong> Use <Link href="/" style={{ color: "#0284c7", fontWeight: 500 }} className="hover:underline">Home</Link> to load PhysioNet (EEG Motor Movement/Imagery) or upload your own file (.edf, .csv, .mat).</li>
            <li><strong style={{ color: "#0c4a6e" }}>Set Context:</strong> Choose use case, age group, and device for recommended filter presets.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Adjust Filters:</strong> Override presets in the filter controls panel if needed.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Apply & Visualize:</strong> Click &quot;Apply filters & clean&quot; to process and view raw vs. cleaned EEG and frequency band power.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Download:</strong> Export results as JSON or CSV.</li>
          </ol>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>FILTER RECOMMENDATIONS</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10 overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e0f2fe", backgroundColor: "#f0f9ff" }}>
                <th style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "left" }}>Filter</th>
                <th style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "left" }}>Default</th>
                <th style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "left" }}>Range</th>
                <th style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: "#0369a1", textAlign: "left" }}>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["High-pass", "0.5 Hz", "0.1–1 Hz", "Removes drift, preserves delta"],
                ["Low-pass", "45 Hz", "30–70 Hz", "Reduces high-frequency noise"],
                ["Band-pass", "1–45 Hz", "1–50 Hz", "Standard EEG range"],
                ["Notch", "50 Hz", "50/60 Hz", "Line power (region-specific)"],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f9ff" }} className="hover:bg-sky-50/50">
                  <td style={{ padding: "12px 14px", color: "#0c4a6e", fontWeight: 500 }}>{row[0]}</td>
                  <td style={{ padding: "12px 14px", color: "#334155" }}>{row[1]}</td>
                  <td style={{ padding: "12px 14px", color: "#334155" }}>{row[2]}</td>
                  <td style={{ padding: "12px 14px", color: "#64748b" }}>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>FILTER SELECTION</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <p style={{ color: "#334155", marginBottom: 16, lineHeight: 1.6 }}>Context presets auto-fill filter values based on best practices:</p>
          <ul className="list-disc pl-6 space-y-2" style={{ color: "#334155", lineHeight: 1.7 }}>
            <li><strong style={{ color: "#0c4a6e" }}>High-pass 0.5 Hz:</strong> Removes slow baseline drift, preserves delta (&lt;4 Hz). Use 0.1 Hz for sleep studies.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Low-pass 45 Hz:</strong> Removes high-frequency noise, keeps delta–beta bands. Use 30 Hz for motor imagery.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Band-pass 1–45 Hz:</strong> Standard EEG range. Motor imagery: 8–30 Hz.</li>
            <li><strong style={{ color: "#0c4a6e" }}>Notch 50/60 Hz:</strong> Line power noise. Use 50 Hz (Europe) or 60 Hz (Americas).</li>
          </ul>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 16 }}>All values are editable. Processing runs locally; no data is sent externally.</p>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>PHYSIONET DATASET</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <p style={{ color: "#334155", lineHeight: 1.7 }}>
            The <a href="https://physionet.org/content/eegmmidb/1.0.0/" style={{ color: "#0284c7", fontWeight: 500 }} className="hover:underline">EEG Motor Movement/Imagery</a> dataset has 109 subjects, 64 channels, 160 Hz. Runs 4, 8, 12 are motor imagery (left vs right hand). Data is downloaded on first load to <code style={{ fontFamily: "monospace", fontSize: 13, backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 6 }}>~/mne_data</code>.
          </p>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 32 }}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: "#0369a1", letterSpacing: "0.12em" }}>BACKEND API</h2>
        </div>
        <div style={{ padding: "24px 28px" }} className="sm:px-10">
          <p style={{ color: "#334155", marginBottom: 12, lineHeight: 1.6 }}>Endpoints (default <code style={{ fontFamily: "monospace", fontSize: 13, backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 6 }}>http://localhost:8000</code>):</p>
          <ul className="space-y-2" style={{ color: "#334155" }}>
            {[
              ["GET /health", "Health check"],
              ["POST /upload", "Upload EEG file"],
              ["POST /parse", "Parse uploaded file"],
              ["POST /clean", "Apply filters"],
              ["POST /datasets/physionet/load", "Load PhysioNet data"],
              ["POST /bandpower", "Compute band power"],
              ["POST /psd", "Power spectral density"],
              ["POST /ai-insights", "AI insights"],
            ].map(([endpoint, desc], i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <code style={{ fontFamily: "monospace", fontSize: 13, backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 6 }}>{endpoint}</code>
                <span style={{ color: "#64748b", fontSize: 13 }}>{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
