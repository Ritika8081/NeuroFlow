/**
 * Reusable system prompts and context builders for LLM-powered features.
 * Everything is grounded in real DSP output — the LLM only writes prose
 * around numbers we computed locally.
 */

import { AnalysisBundle } from "./insights";
import { BAND_ORDER, BandName } from "./dsp";

export interface RecordingSummary {
  fileName: string;
  channels: number;
  channelNames: string[];
  sampleRate: number;
  durationSec: number;
  analysis: AnalysisBundle;
  filters?: {
    bandpass_low: number;
    bandpass_high: number;
    notch_freq: number;
    lowpass_freq: number | null;
    highpass_freq: number | null;
  };
}

/** Concise machine-readable context block passed to the LLM. */
export function recordingContextBlock(s: RecordingSummary): string {
  const a = s.analysis;
  const total = a.avgBands.total || 1;
  const lines: string[] = [];
  lines.push(`# EEG recording context`);
  lines.push(`File: ${s.fileName}`);
  lines.push(`Channels (${s.channels}): ${s.channelNames.join(", ")}`);
  lines.push(`Sampling rate: ${s.sampleRate} Hz`);
  lines.push(`Duration: ${s.durationSec.toFixed(1)} s`);
  if (s.filters) {
    lines.push(``);
    lines.push(`Pre-processing applied:`);
    lines.push(`- band-pass ${s.filters.bandpass_low}-${s.filters.bandpass_high} Hz`);
    lines.push(`- notch ${s.filters.notch_freq} Hz`);
    if (s.filters.highpass_freq !== null) lines.push(`- high-pass ${s.filters.highpass_freq} Hz`);
    if (s.filters.lowpass_freq !== null) lines.push(`- low-pass ${s.filters.lowpass_freq} Hz`);
  }
  lines.push(``);
  lines.push(`# Computed metrics (DSP, not LLM-derived)`);
  lines.push(`Cognitive state classification: ${a.cognitive.state} (confidence ${(a.cognitive.confidence * 100).toFixed(0)}%)`);
  lines.push(`Dominant band: ${a.dominantBand}`);
  if (a.alphaPeakHz) lines.push(`Alpha peak frequency: ${a.alphaPeakHz.toFixed(2)} Hz`);
  if (a.asymmetry) lines.push(`Frontal alpha asymmetry (right - left, log): ${a.asymmetry.value.toFixed(3)}`);
  lines.push(`Average band power (relative %):`);
  for (const b of BAND_ORDER) {
    lines.push(`  - ${b}: ${((a.avgBands[b] / total) * 100).toFixed(1)}%`);
  }
  lines.push(``);
  lines.push(`Cognitive ratios:`);
  for (const m of a.cognitive.metrics) {
    lines.push(`  - ${m.name}: ${m.value.toFixed(3)} (${m.explanation})`);
  }
  lines.push(``);
  lines.push(`Quality score: ${a.quality.overall}/100`);
  for (const c of a.quality.components) {
    lines.push(`  - ${c.name}: ${c.value}/100 — ${c.note}`);
  }
  if (a.quality.badChannels.length) {
    lines.push(`Bad channels detected: ${a.quality.badChannels.join(", ")}`);
  }
  lines.push(`Artifact events: ${a.quality.artifactCount}`);
  lines.push(``);
  lines.push(`Per-channel band power (% of channel total):`);
  for (const c of a.perChannelBands) {
    const tot = c.total || 1;
    lines.push(
      `  ${c.name}: ` +
        BAND_ORDER.map((b) => `${b}=${(((c as any)[b] / tot) * 100).toFixed(0)}%`).join(" ")
    );
  }
  return lines.join("\n");
}

export const ASSISTANT_SYSTEM = `You are NeuroFlow Assistant, an expert EEG analyst embedded in a researcher's workspace.

Rules:
1. Always ground answers in the numerical recording context provided. Do NOT fabricate values — if a metric is not in the context, say so.
2. Be concise. Default to short, dense, useful answers (2-6 sentences). Use bullet points and **bold** for keywords. Use \`code\` for numeric values, channel names, and band names (e.g. \`alpha\`, \`Pz\`).
3. Cite the metric when you make a claim (e.g., "alpha peak is at \`10.5 Hz\`").
4. Hold expert priors: posterior alpha = relaxed eyes-closed; theta/beta > 2.5 = drowsy; gamma > 20% of total in scalp EEG ≈ EMG; line noise at 50 Hz in EU/IN, 60 Hz in US.
5. When the user asks for recommendations, propose specific filter values or pipeline steps grounded in their use case.
6. Decline politely if asked to make clinical diagnoses — defer to a licensed clinician.
7. Where useful, suggest the user can try natural-language pipeline commands (e.g., "clean for sleep analysis, 0.3-35 Hz").`;

export const PROSE_REPORT_SYSTEM = `You are a senior EEG researcher writing a clinical-style narrative report from precomputed metrics.

Write 4-6 short paragraphs in expert but readable prose:
1. **Recording summary** — file, montage, duration, key pre-processing applied.
2. **Quality & artifacts** — overall quality, bad channels, artifact types and their likely sources.
3. **Spectrum** — dominant rhythm, alpha peak, notable per-channel deviations.
4. **Cognitive state interpretation** — derived state and the ratios that support it; honest about confidence.
5. **Asymmetry / lateralization** — if present, what it suggests; otherwise note absence.
6. **Recommendations** — concrete next steps (filter tweaks, channels to exclude, analyses to consider).

Style:
- Active voice. Specific numeric claims, always citing the metric (e.g., "quality score 78/100").
- Avoid diagnostic language. This is a research report, not a clinical impression.
- No invented data. If a value is not in context, omit the claim.
- Markdown headings (## ...), tight paragraphs.`;

export const CODE_GEN_SYSTEM = `You are an expert generating reproducible EEG pre-processing scripts.

Given a NeuroFlow recording + applied filters, produce a working Python script using MNE-Python that:
1. Loads the recording (assume \`raw = mne.io.read_raw(file_path, preload=True)\`).
2. Applies the same filters (band-pass, notch, optional high/low pass) with the exact cut-offs.
3. Marks the bad channels from the analysis (if any).
4. Runs a quick PSD plot and saves it.
5. Computes band power per channel.
6. Saves a cleaned copy in BIDS-compatible naming.

Constraints:
- Single self-contained .py file. Use only mne, numpy, scipy, matplotlib.
- Include a one-line shebang + brief docstring.
- Code only — no markdown fences, no commentary outside the code.`;
