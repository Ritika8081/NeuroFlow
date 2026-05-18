/**
 * Proactive recommendations engine. Looks at the current filter chain and
 * the analysis output and emits actionable suggestions the UI can apply
 * with one click.
 */

import { AnalysisBundle } from "./insights";

export interface Recommendation {
  id: string;
  severity: "info" | "good" | "warn" | "danger";
  title: string;
  body: string;
  /** Patch to apply via onApplyPipeline / onExcludeChannels. */
  apply?: {
    bandpass_low?: number;
    bandpass_high?: number;
    notch_freq?: number;
    highpass_freq?: number | null;
    lowpass_freq?: number | null;
    exclude_channels?: string[];
  };
  applyLabel?: string;
}

interface Filters {
  bandpass_low: number;
  bandpass_high: number;
  notch_freq: number;
  highpass_freq: number | null;
  lowpass_freq: number | null;
}

export function recommend(analysis: AnalysisBundle, filters: Filters): Recommendation[] {
  const out: Recommendation[] = [];
  const findings = analysis.findings;

  // 1. Line noise → check / change notch
  const lineFinding = findings.find((f) => /Mains|line noise/i.test(f.title));
  if (lineFinding) {
    const m = lineFinding.title.match(/in (\d+)/);
    const n = m ? Number(m[1]) : 0;
    const suggested = filters.notch_freq === 50 ? 60 : 50;
    out.push({
      id: "notch-toggle",
      severity: "warn",
      title: "Mains interference detected",
      body: `${n} segment(s) show ${filters.notch_freq} Hz peaks but it's still leaking. Try switching to ${suggested} Hz — your hardware may report the other region.`,
      apply: { notch_freq: suggested },
      applyLabel: `Switch notch → ${suggested} Hz`,
    });
  }

  // 2. Delta lost — check HP cutoff
  if ((filters.highpass_freq ?? 0) >= 1 && analysis.dominantBand === "delta") {
    out.push({
      id: "hp-too-high",
      severity: "warn",
      title: "High-pass may be cutting your delta band",
      body: `Delta dominates but your high-pass is at ${filters.highpass_freq} Hz. Drop to 0.3 Hz to preserve <4 Hz activity.`,
      apply: { highpass_freq: 0.3, bandpass_low: Math.min(filters.bandpass_low, 0.3) },
      applyLabel: "Lower HP → 0.3 Hz",
    });
  }

  // 3. Gamma is suspiciously high → likely EMG; lower the LP
  const total = analysis.avgBands.total || 1;
  if (analysis.avgBands.gamma / total > 0.22) {
    out.push({
      id: "lp-too-high",
      severity: "warn",
      title: "Gamma share is high — likely EMG",
      body: `Gamma is ${((analysis.avgBands.gamma / total) * 100).toFixed(0)}% of total. Scalp EEG rarely shows this much true gamma. Tighten low-pass.`,
      apply: { lowpass_freq: 35, bandpass_high: Math.min(filters.bandpass_high, 35) },
      applyLabel: "Lower LP → 35 Hz",
    });
  }

  // 4. Bad channels → exclude
  if (analysis.quality.badChannels.length > 0) {
    out.push({
      id: "exclude-bad",
      severity: "warn",
      title: `Exclude ${analysis.quality.badChannels.length} bad channel(s)`,
      body: `Channels ${analysis.quality.badChannels.join(", ")} appear flat or saturated. Excluding prevents distortion of averages and topomaps.`,
      apply: { exclude_channels: analysis.quality.badChannels },
      applyLabel: "Exclude bad channels",
    });
  }

  // 5. Quality low overall → recommend auto-clean
  if (analysis.quality.overall < 60) {
    out.push({
      id: "run-autoclean",
      severity: "danger",
      title: `Quality is low (${analysis.quality.overall}/100)`,
      body: "Run one-click auto-clean — it picks notch, filter chain, and bad-channel list in one shot.",
    });
  }

  // 6. No alpha peak detected — could be eye movements / sleep
  if (!analysis.alphaPeakHz && analysis.cognitive.state !== "drowsy") {
    out.push({
      id: "no-alpha",
      severity: "info",
      title: "No clear alpha peak",
      body:
        "Occipital alpha is usually visible in resting EEG. Check that O1/O2/Pz are in your montage and the subject's eyes were closed.",
    });
  }

  // 7. Sleep-like signature but using resting band-pass
  if (
    (analysis.cognitive.state === "drowsy" || analysis.dominantBand === "delta") &&
    (filters.highpass_freq ?? 0.5) > 0.5
  ) {
    out.push({
      id: "sleep-bp",
      severity: "info",
      title: "Recording looks sleep-like",
      body: "Switch to sleep-friendly band-pass (0.3–35 Hz) to preserve slow waves and spindles.",
      apply: {
        bandpass_low: 0.3,
        bandpass_high: 35,
        highpass_freq: 0.3,
        lowpass_freq: 35,
      },
      applyLabel: "Apply sleep preset",
    });
  }

  // 8. High beta + many muscle events
  const muscleFinding = findings.find((f) => /muscle/i.test(f.title));
  if (muscleFinding && analysis.avgBands.beta / total > 0.3) {
    out.push({
      id: "ica-suggestion",
      severity: "info",
      title: "Consider ICA-based muscle removal",
      body: "Beta is elevated and muscle artifact was flagged. ICA via MNE-Python catches diffuse EMG sources reliably.",
    });
  }

  // 9. Positive: clean recording
  if (analysis.quality.overall >= 85 && out.length === 0) {
    out.push({
      id: "all-good",
      severity: "good",
      title: "Recording looks excellent",
      body: "No actionable issues. Proceed to your analysis of choice.",
    });
  }

  return out;
}
