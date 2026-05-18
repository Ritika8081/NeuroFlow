/**
 * One-click HTML report builder. Renders a self-contained document with
 * embedded SVG charts so it works offline once downloaded.
 */

import { BAND_COLORS, BAND_ORDER } from "./dsp";
import { AnalysisBundle } from "./insights";

export interface FilterConfig {
  bandpass_low: number;
  bandpass_high: number;
  notch_freq: number;
  lowpass_freq: number | null;
  highpass_freq: number | null;
}

export interface ReportInput {
  fileName: string;
  channels: number;
  sampleRate: number;
  duration: number;
  channelNames: string[];
  filters: FilterConfig;
  analysis: AnalysisBundle;
}

export function buildHTMLReport(input: ReportInput): string {
  const { analysis, filters, fileName, channels, sampleRate, duration, channelNames } = input;
  const total = analysis.avgBands.total || 1;

  const bandsBar = BAND_ORDER.map((b) => {
    const w = (analysis.avgBands[b] / total) * 100;
    return `<div style="display:inline-block;background:${BAND_COLORS[b]};width:${w}%;height:18px;"></div>`;
  }).join("");

  const findings = analysis.findings
    .map(
      (f) => `
    <div class="finding finding-${f.severity}">
      <div class="finding-title">${escapeHtml(f.title)}</div>
      <div class="finding-body">${escapeHtml(f.body)}</div>
    </div>
  `
    )
    .join("");

  const channelRows = analysis.perChannelBands
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      ${BAND_ORDER.map((b) => `<td style="text-align:right;">${(((c as any)[b] / (c.total || 1)) * 100).toFixed(1)}%</td>`).join("")}
    </tr>
  `
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>NeuroFlow Lab · Report · ${escapeHtml(fileName)}</title>
<style>
  :root {
    --bg: #0a0c18;
    --surface: #12152a;
    --border: #262844;
    --text: #ecedf5;
    --muted: #8e90a8;
    --accent: #8b5cf6;
  }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 32px; }
  .container { max-width: 920px; margin: 0 auto; }
  h1 { font-weight: 600; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px 0; background: linear-gradient(110deg, #6366f1, #8b5cf6, #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent; }
  h2 { font-size: 18px; font-weight: 600; margin: 32px 0 12px 0; }
  .meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
  .grid { display: grid; gap: 12px; }
  .grid-3 { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .stat-label { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; }
  .stat-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
  th { color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: 0.12em; font-weight: 500; }
  .finding { border-left: 3px solid var(--accent); padding: 10px 14px; border-radius: 8px; background: var(--surface); margin-bottom: 8px; }
  .finding-title { font-weight: 600; font-size: 13px; }
  .finding-body { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .finding-good { border-left-color: #10b981; }
  .finding-warn { border-left-color: #f59e0b; }
  .finding-danger { border-left-color: #ef4444; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); color: var(--muted); font-size: 11px; margin-right: 4px; }
  .bar-wrap { display: flex; height: 18px; border-radius: 4px; overflow: hidden; }
  .footer { color: var(--muted); font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); }
  pre { background: #07091a; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 11px; overflow: auto; }
  @media print {
    body { background: white; color: black; padding: 0; }
    .card, .stat, .finding { background: #f8fafc; border-color: #e2e8f0; }
    h1 { color: #4f46e5 !important; -webkit-text-fill-color: #4f46e5; }
    pre { background: #f1f5f9; }
  }
</style>
</head>
<body>
<div class="container">
  <h1>NeuroFlow Lab · Analysis Report</h1>
  <div class="meta">
    ${escapeHtml(fileName)} · ${channels} channels @ ${sampleRate} Hz · ${duration.toFixed(1)}s ·
    generated ${new Date().toLocaleString()}
  </div>

  <div class="grid grid-3">
    <div class="stat">
      <div class="stat-label">Cognitive state</div>
      <div class="stat-value" style="text-transform: capitalize;">${analysis.cognitive.state}</div>
      <div class="meta">${(analysis.cognitive.confidence * 100).toFixed(0)}% confidence</div>
    </div>
    <div class="stat">
      <div class="stat-label">Dominant rhythm</div>
      <div class="stat-value" style="color: ${BAND_COLORS[analysis.dominantBand]}; text-transform: capitalize;">${analysis.dominantBand}</div>
      <div class="meta">${((analysis.avgBands[analysis.dominantBand] / total) * 100).toFixed(0)}% of spectrum</div>
    </div>
    <div class="stat">
      <div class="stat-label">Quality</div>
      <div class="stat-value">${analysis.quality.overall}/100</div>
      <div class="meta">${analysis.quality.badChannels.length} bad · ${analysis.quality.artifactCount} artifacts</div>
    </div>
  </div>

  <h2>Spectrum composition</h2>
  <div class="card">
    <div class="bar-wrap">${bandsBar}</div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--muted);">
      ${BAND_ORDER.map((b) => `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${BAND_COLORS[b]};margin-right:6px;"></span>${b} ${(((analysis.avgBands[b]) / total) * 100).toFixed(1)}%</span>`).join("")}
    </div>
  </div>

  <h2>Findings</h2>
  ${findings}

  <h2>Pre-processing pipeline</h2>
  <div class="card">
    <div><span class="badge">Band-pass</span> ${filters.bandpass_low} – ${filters.bandpass_high} Hz</div>
    <div style="margin-top:6px;"><span class="badge">Notch</span> ${filters.notch_freq} Hz</div>
    ${filters.highpass_freq !== null ? `<div style="margin-top:6px;"><span class="badge">High-pass</span> ${filters.highpass_freq} Hz</div>` : ""}
    ${filters.lowpass_freq !== null ? `<div style="margin-top:6px;"><span class="badge">Low-pass</span> ${filters.lowpass_freq} Hz</div>` : ""}
  </div>

  <h2>Per-channel band power (% of total)</h2>
  <div class="card" style="padding: 0;">
    <table>
      <thead>
        <tr>
          <th>Channel</th>
          ${BAND_ORDER.map((b) => `<th style="text-align:right;text-transform:capitalize;">${b}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${channelRows}
      </tbody>
    </table>
  </div>

  <h2>Quality breakdown</h2>
  <div class="card">
    ${analysis.quality.components.map((c) => `
      <div style="margin-bottom: 10px;">
        <div style="display:flex; justify-content:space-between; font-size:12px;">
          <strong>${escapeHtml(c.name)}</strong>
          <span>${c.value}/100</span>
        </div>
        <div style="height:4px;background:#1c1f3a;border-radius:4px;margin-top:4px;overflow:hidden;">
          <div style="height:100%;width:${c.value}%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);"></div>
        </div>
        <div class="meta">${escapeHtml(c.note)}</div>
      </div>
    `).join("")}
  </div>

  <h2>Reproducibility manifest</h2>
  <div class="card">
    <pre>${escapeHtml(JSON.stringify(buildManifest(input), null, 2))}</pre>
  </div>

  <div class="footer">
    Generated by NeuroFlow Lab. All processing performed locally.
    AI findings are heuristic and intended to assist — not replace — expert interpretation.
  </div>
</div>
</body>
</html>`;
}

export function buildManifest(input: ReportInput) {
  return {
    schema: "neuroflow-manifest/0.1",
    generated_at: new Date().toISOString(),
    recording: {
      filename: input.fileName,
      channels: input.channels,
      channel_names: input.channelNames,
      sampling_rate_hz: input.sampleRate,
      duration_s: input.duration,
    },
    pipeline: {
      steps: [
        {
          op: "bandpass_filter",
          low_hz: input.filters.bandpass_low,
          high_hz: input.filters.bandpass_high,
        },
        { op: "notch_filter", freq_hz: input.filters.notch_freq },
        ...(input.filters.highpass_freq !== null
          ? [{ op: "highpass_filter", freq_hz: input.filters.highpass_freq }]
          : []),
        ...(input.filters.lowpass_freq !== null
          ? [{ op: "lowpass_filter", freq_hz: input.filters.lowpass_freq }]
          : []),
      ],
    },
    analysis: {
      cognitive_state: input.analysis.cognitive.state,
      cognitive_confidence: input.analysis.cognitive.confidence,
      dominant_band: input.analysis.dominantBand,
      alpha_peak_hz: input.analysis.alphaPeakHz,
      quality_score: input.analysis.quality.overall,
      bad_channels: input.analysis.quality.badChannels,
      band_powers_avg: input.analysis.avgBands,
    },
    tool: { name: "NeuroFlow Lab", version: "0.1.0" },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
