/**
 * Heuristic sleep staging + sleep event detection.
 *
 * Per-30s epoch staging based on classical AASM rules adapted for limited
 * channel sets. Not a clinical tool — surface as a research convenience.
 *
 *  W  (wake)     : high beta + alpha share, low delta
 *  N1 (light)    : low alpha, mixed frequency, modest theta
 *  N2 (medium)   : high theta + presence of spindles
 *  N3 (deep)     : delta dominates (>20% of total)
 *  REM           : low amplitude mixed frequency, low alpha, sawtooth-like
 */

import {
  BANDS,
  bandPower,
  channelStats,
  welchPSD,
} from "./dsp";

export type SleepStage = "W" | "N1" | "N2" | "N3" | "REM";

export interface SleepEpoch {
  startSec: number;
  endSec: number;
  stage: SleepStage;
  confidence: number;
  bandShares: { delta: number; theta: number; alpha: number; beta: number };
  spindles: number; // count of spindle events in this epoch
  kComplexes: number;
}

export interface SleepReport {
  epochs: SleepEpoch[];
  totalRecordingSec: number;
  perStageSec: Record<SleepStage, number>;
  perStagePct: Record<SleepStage, number>;
  spindleCount: number;
  kComplexCount: number;
  totalSpindlesPerMin: number;
  channelUsed: string;
}

const STAGE_COLORS: Record<SleepStage, string> = {
  W: "#ef4444",
  N1: "#f59e0b",
  N2: "#3b82f6",
  N3: "#6366f1",
  REM: "#10b981",
};

export const SLEEP_STAGE_COLORS = STAGE_COLORS;

interface SleepInput {
  data: number[][];
  channelNames: string[];
  sampleRate: number;
}

/** Pick the best central channel for staging — Cz > C3 > C4 > anything central. */
function pickStagingChannel(channelNames: string[]): number {
  const order = ["Cz", "C3", "C4", "FCz", "CPz"];
  for (const want of order) {
    const idx = channelNames.findIndex((n) => n.toUpperCase() === want.toUpperCase());
    if (idx >= 0) return idx;
  }
  // fall back to any 'C*' channel
  const cidx = channelNames.findIndex((n) => /^C/i.test(n));
  return cidx >= 0 ? cidx : 0;
}

/* Spindle detection: 11–16 Hz envelope with duration 0.5–2s. Cheap RMS approach. */
function detectSpindles(signal: number[], fs: number): number {
  // Band-pass via simple FIR-ish proxy: subtract a wide moving mean (high-pass)
  // and use Welch on small windows to estimate sigma-band power.
  const winSize = Math.floor(fs * 0.25); // 250 ms
  const step = Math.floor(winSize * 0.5);
  const sigmaPower: number[] = [];
  for (let i = 0; i + winSize <= signal.length; i += step) {
    const seg = signal.slice(i, i + winSize);
    const { freqs, psd } = welchPSD(seg, fs, Math.min(winSize, 64), 0.5);
    sigmaPower.push(bandPower(freqs, psd, 11, 16));
  }
  if (sigmaPower.length === 0) return 0;
  const sorted = [...sigmaPower].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = median * 4;

  // Count contiguous regions above threshold lasting >= 0.5s
  let count = 0;
  let runStart = -1;
  const minRunSteps = Math.max(1, Math.floor((0.5 / 0.25) * 2)); // ~0.5s in steps
  for (let i = 0; i < sigmaPower.length; i++) {
    if (sigmaPower[i] > threshold && runStart === -1) runStart = i;
    else if (sigmaPower[i] <= threshold && runStart !== -1) {
      if (i - runStart >= minRunSteps) count++;
      runStart = -1;
    }
  }
  if (runStart !== -1 && sigmaPower.length - runStart >= minRunSteps) count++;
  return count;
}

/* K-complex detection: large biphasic deflection >100 µV peak-to-peak, 0.5-1.5s duration,
   in delta band. Quick proxy via amplitude envelope. */
function detectKComplexes(signal: number[], fs: number): number {
  const stats = channelStats(signal);
  const threshold = stats.std * 5;
  const windowDur = Math.floor(fs * 1.0);
  let count = 0;
  for (let i = 0; i + windowDur <= signal.length; i += Math.floor(windowDur / 2)) {
    const seg = signal.slice(i, i + windowDur);
    let mn = Infinity, mx = -Infinity;
    for (const v of seg) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mx - mn > threshold * 1.5) count++;
  }
  return count;
}

function classifyEpoch(bs: { delta: number; theta: number; alpha: number; beta: number }, spindles: number, kc: number): {
  stage: SleepStage;
  confidence: number;
} {
  const total = bs.delta + bs.theta + bs.alpha + bs.beta || 1;
  const d = bs.delta / total;
  const t = bs.theta / total;
  const a = bs.alpha / total;
  const b = bs.beta / total;

  // N3: dominant delta
  if (d > 0.45) return { stage: "N3", confidence: Math.min(0.95, 0.5 + d) };
  // N2: theta-dominant + spindles or K-complexes present
  if ((spindles > 0 || kc > 0) && t > 0.25) {
    return { stage: "N2", confidence: Math.min(0.92, 0.5 + (spindles + kc) * 0.08) };
  }
  // N2 even without events when theta is moderate and beta low
  if (t > 0.3 && b < 0.2 && a < 0.25) return { stage: "N2", confidence: 0.6 };
  // REM: low amplitude mixed frequency, low alpha, theta moderate
  if (t > 0.2 && a < 0.18 && b < 0.18 && d < 0.35) {
    return { stage: "REM", confidence: 0.55 };
  }
  // N1: low alpha, mixed
  if (a < 0.2 && t > 0.15 && t < 0.3 && d < 0.3) {
    return { stage: "N1", confidence: 0.55 };
  }
  // W: dominant beta or alpha (eyes-closed wake)
  if (b > 0.25 || a > 0.3) return { stage: "W", confidence: Math.min(0.85, 0.5 + b + 0.5 * a) };

  // Default: W with low confidence
  return { stage: "W", confidence: 0.4 };
}

export function stageRecording(input: SleepInput): SleepReport {
  const { data, channelNames, sampleRate } = input;
  const chIdx = pickStagingChannel(channelNames);
  const sig = data[chIdx];
  const samplesPerEpoch = Math.floor(sampleRate * 30); // 30s AASM standard
  const totalSec = sig.length / sampleRate;
  const epochs: SleepEpoch[] = [];

  // If recording shorter than ~30s use 5s epochs and skip spindle detection
  const useShortEpochs = sig.length < samplesPerEpoch * 2;
  const epochSamples = useShortEpochs ? Math.floor(sampleRate * 5) : samplesPerEpoch;
  const epochDurSec = epochSamples / sampleRate;

  for (let start = 0; start + epochSamples <= sig.length; start += epochSamples) {
    const seg = sig.slice(start, start + epochSamples);
    const segSize = Math.max(64, Math.min(512, Math.floor(epochSamples / 4)));
    const { freqs, psd } = welchPSD(seg, sampleRate, segSize, 0.5);
    const bands = {
      delta: bandPower(freqs, psd, BANDS.delta[0], BANDS.delta[1]),
      theta: bandPower(freqs, psd, BANDS.theta[0], BANDS.theta[1]),
      alpha: bandPower(freqs, psd, BANDS.alpha[0], BANDS.alpha[1]),
      beta: bandPower(freqs, psd, BANDS.beta[0], BANDS.beta[1]),
    };
    const spindles = useShortEpochs ? 0 : detectSpindles(seg, sampleRate);
    const kc = useShortEpochs ? 0 : detectKComplexes(seg, sampleRate);
    const { stage, confidence } = classifyEpoch(bands, spindles, kc);
    epochs.push({
      startSec: start / sampleRate,
      endSec: (start + epochSamples) / sampleRate,
      stage,
      confidence,
      bandShares: bands,
      spindles,
      kComplexes: kc,
    });
  }

  const perStageSec: Record<SleepStage, number> = { W: 0, N1: 0, N2: 0, N3: 0, REM: 0 };
  let spindles = 0;
  let kc = 0;
  for (const e of epochs) {
    perStageSec[e.stage] += epochDurSec;
    spindles += e.spindles;
    kc += e.kComplexes;
  }
  const denom = epochs.length * epochDurSec || 1;
  const perStagePct: Record<SleepStage, number> = {
    W: perStageSec.W / denom,
    N1: perStageSec.N1 / denom,
    N2: perStageSec.N2 / denom,
    N3: perStageSec.N3 / denom,
    REM: perStageSec.REM / denom,
  };

  return {
    epochs,
    totalRecordingSec: totalSec,
    perStageSec,
    perStagePct,
    spindleCount: spindles,
    kComplexCount: kc,
    totalSpindlesPerMin: spindles / (totalSec / 60 || 1),
    channelUsed: channelNames[chIdx] || `Ch${chIdx + 1}`,
  };
}

export const SLEEP_STAGES: SleepStage[] = ["W", "N1", "N2", "N3", "REM"];
