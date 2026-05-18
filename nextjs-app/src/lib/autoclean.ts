/**
 * One-click auto-clean: inspects the recording, detects bad channels and
 * mains noise, and emits a recommended filter chain + channel exclusion list.
 * Pure analysis — the UI applies the suggested settings.
 */

import {
  BANDS,
  bandPower,
  channelStats,
  computeBandPowers,
  detectArtifacts,
  qualityScore,
  welchPSD,
} from "./dsp";

export interface AutoCleanRecipe {
  bandpass_low: number;
  bandpass_high: number;
  notch_freq: number;
  highpass_freq: number | null;
  lowpass_freq: number | null;
  exclude_channels: string[];
  rationale: { step: string; reason: string }[];
  qualityBefore: number;
  expectedImprovements: string[];
}

export interface AutoCleanInput {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
  useCase?:
    | "Resting-state EEG"
    | "Cognitive / task-based EEG"
    | "Sleep / overnight EEG"
    | "BCI / neurofeedback"
    | "Low-cost device";
}

/**
 * Run auto-clean analysis. Doesn't mutate data — returns a recipe.
 */
export function autoClean(input: AutoCleanInput): AutoCleanRecipe {
  const { data, channelNames, sampleRate, useCase = "Resting-state EEG" } = input;
  const rationale: AutoCleanRecipe["rationale"] = [];
  const improvements: string[] = [];

  // ---- Mains noise detection (50 vs 60 Hz)
  const lineCounts = { 50: 0, 60: 0 };
  for (let ch = 0; ch < data.length; ch++) {
    const seg = Math.max(128, Math.min(1024, Math.round(sampleRate * 2)));
    const { freqs, psd } = welchPSD(data[ch], sampleRate, seg, 0.5);
    for (const lf of [50, 60]) {
      const peak = bandPower(freqs, psd, lf - 1.5, lf + 1.5);
      const broad =
        bandPower(freqs, psd, lf - 6, lf - 1.5) +
        bandPower(freqs, psd, lf + 1.5, lf + 6);
      if (broad > 0 && peak / broad > 3.5) (lineCounts as any)[lf]++;
    }
  }
  const notchFreq =
    lineCounts[60] > lineCounts[50]
      ? 60
      : lineCounts[50] > 0
      ? 50
      : 50;
  if (lineCounts[notchFreq] > 0) {
    rationale.push({
      step: `Notch ${notchFreq} Hz`,
      reason: `Detected mains contamination on ${lineCounts[notchFreq]} channel(s).`,
    });
    improvements.push(`Removes ${notchFreq} Hz line noise`);
  } else {
    rationale.push({ step: `Notch ${notchFreq} Hz`, reason: "Standard for region — no peak detected, but applied as safety." });
  }

  // ---- Bad channel detection
  const badChannels: string[] = [];
  const stats = data.map((sig) => channelStats(sig));
  const overallStd = median(stats.map((s) => s.std));
  for (let ch = 0; ch < data.length; ch++) {
    const s = stats[ch];
    const name = channelNames[ch] || `Ch${ch + 1}`;
    if (s.std < 0.05 || s.ptp < 0.5) {
      badChannels.push(name);
      continue;
    }
    // very high variance vs median → noisy channel
    if (s.std > overallStd * 6) {
      badChannels.push(name);
      continue;
    }
    // extreme kurtosis → impulsive artifacts
    if (Math.abs(s.kurtosis) > 25) {
      badChannels.push(name);
    }
  }
  if (badChannels.length > 0) {
    rationale.push({
      step: `Exclude channels: ${badChannels.join(", ")}`,
      reason: `Flat, noisy, or saturated — would distort downstream averaging and topomaps.`,
    });
    improvements.push(`Excludes ${badChannels.length} bad channel(s)`);
  }

  // ---- Paradigm-driven filter chain
  let bp: [number, number];
  let hp: number | null;
  let lp: number | null;
  switch (useCase) {
    case "Sleep / overnight EEG":
      bp = [0.3, 35];
      hp = 0.3;
      lp = 35;
      rationale.push({
        step: "Band-pass 0.3–35 Hz",
        reason: "Preserves slow waves, spindles, and K-complexes for sleep staging.",
      });
      break;
    case "Cognitive / task-based EEG":
      bp = [0.5, 40];
      hp = 0.5;
      lp = 40;
      rationale.push({
        step: "Band-pass 0.5–40 Hz",
        reason: "Keeps ERP-relevant slow components and rejects EMG above 40 Hz.",
      });
      break;
    case "BCI / neurofeedback":
      bp = [8, 30];
      hp = 8;
      lp = 30;
      rationale.push({
        step: "Band-pass 8–30 Hz",
        reason: "Isolates µ and β rhythms for motor-imagery BCI.",
      });
      break;
    case "Low-cost device":
      bp = [1, 40];
      hp = 1;
      lp = 40;
      rationale.push({
        step: "Band-pass 1–40 Hz",
        reason: "Conservative range for consumer-grade hardware noise floor.",
      });
      break;
    case "Resting-state EEG":
    default:
      bp = [1, 45];
      hp = 0.5;
      lp = 45;
      rationale.push({
        step: "Band-pass 1–45 Hz",
        reason: "Standard resting-state range; preserves all classical bands.",
      });
  }

  // Estimate quality before so UI can show delta after apply
  const artifacts = detectArtifacts(data, channelNames, sampleRate);
  const q = qualityScore(data, channelNames, sampleRate, artifacts);

  // Extra improvement notes based on what we found
  const muscleEvents = artifacts.filter((a) => a.type === "muscle").length;
  if (muscleEvents > 0) {
    improvements.push(`Reduces ${muscleEvents} EMG-contaminated segment(s)`);
  }
  if (q.overall < 70) improvements.push(`Quality projected to improve by ${Math.min(20, 100 - q.overall)} pts`);

  return {
    bandpass_low: bp[0],
    bandpass_high: bp[1],
    notch_freq: notchFreq,
    highpass_freq: hp,
    lowpass_freq: lp,
    exclude_channels: badChannels,
    rationale,
    qualityBefore: q.overall,
    expectedImprovements: improvements.length > 0 ? improvements : ["Standardizes the pre-processing pipeline."],
  };
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
