/**
 * Component decomposition + heuristic labeling.
 *
 * We compute spatial components via PCA (eigendecomposition of the channel
 * covariance matrix). This is NOT true ICA — components aren't statistically
 * independent, only uncorrelated. But it's deterministic, cheap, runs in the
 * browser, and the per-component features + heuristic labels still surface
 * obvious eye / muscle / cardiac contamination.
 *
 * For real ICA (Infomax, FastICA, AMICA) integrate MNE-Python via the backend.
 *
 * Refs:
 *   Pion-Tonachini et al. 2019 — ICLabel: An automated EEG IC labeler.
 *   Jung et al. 2000 — Removing electroencephalographic artifacts by ICA.
 */

import {
  bandPower,
  channelStats,
  computeBandPowers,
  welchPSD,
} from "./dsp";

export type ICAComponentType = "brain" | "eye" | "muscle" | "cardiac" | "line-noise" | "other";

export interface ICAComponent {
  index: number;
  label: ICAComponentType;
  confidence: number;          // 0..1
  varianceExplained: number;   // 0..1 share of total variance
  /** Spatial mixing weight per channel (n_channels long). */
  topography: number[];
  /** Time course (project of original data onto this component). */
  timeCourse: number[];
  /** Per-band relative power. */
  bandShares: { delta: number; theta: number; alpha: number; beta: number; gamma: number };
  rationale: string;
}

export interface ICAResult {
  components: ICAComponent[];
  channelNames: string[];
  sampleRate: number;
  totalVariance: number;
  method: "PCA";
}

export interface ICAOptions {
  /** Max number of components to keep (default: min(channels, 20)). */
  maxComponents?: number;
}

/**
 * Compute principal components of the (channels × samples) matrix using
 * Jacobi eigendecomposition of the channel covariance.
 *
 * Returns components sorted by variance explained (descending).
 */
export function decompose(
  data: number[][],
  channelNames: string[],
  sampleRate: number,
  opts: ICAOptions = {}
): ICAResult {
  const n = data.length;
  const T = data[0]?.length ?? 0;
  if (n === 0 || T === 0) {
    return { components: [], channelNames, sampleRate, totalVariance: 0, method: "PCA" };
  }
  // Center each channel
  const means = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let t = 0; t < T; t++) s += data[i][t];
    means[i] = s / T;
  }
  const X: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: T }, (_, t) => data[i][t] - means[i])
  );
  // Channel covariance C = X X^T / T  (n × n)
  const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += X[i][t] * X[j][t];
      const v = s / T;
      C[i][j] = v;
      C[j][i] = v;
    }
  }
  // Eigendecompose with Jacobi
  const { values, vectors } = jacobiEigen(C);
  // sort by eigenvalue descending
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((o) => o.i);
  const totalVariance = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const maxK = Math.min(opts.maxComponents ?? Math.min(n, 20), n);

  const components: ICAComponent[] = [];
  for (let k = 0; k < maxK; k++) {
    const idx = order[k];
    const eigVal = Math.max(0, values[idx]);
    if (eigVal < 1e-8) break;
    const topography = vectors.map((row) => row[idx]); // n-length
    // time course = w^T X
    const tc = new Array(T);
    for (let t = 0; t < T; t++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += topography[i] * X[i][t];
      tc[t] = s;
    }
    // band features from time course
    const { bands } = computeBandPowers(tc, sampleRate);
    const total = bands.total || 1;
    const bandShares = {
      delta: bands.delta / total,
      theta: bands.theta / total,
      alpha: bands.alpha / total,
      beta: bands.beta / total,
      gamma: bands.gamma / total,
    };
    const stats = channelStats(tc);
    const label = labelComponent({
      topography,
      channelNames,
      bandShares,
      kurtosis: stats.kurtosis,
      sampleRate,
      timeCourse: tc,
    });
    components.push({
      index: k,
      label: label.type,
      confidence: label.confidence,
      varianceExplained: eigVal / totalVariance,
      topography,
      timeCourse: tc,
      bandShares,
      rationale: label.rationale,
    });
  }

  return { components, channelNames, sampleRate, totalVariance, method: "PCA" };
}

interface LabelInput {
  topography: number[];
  channelNames: string[];
  bandShares: { delta: number; theta: number; alpha: number; beta: number; gamma: number };
  kurtosis: number;
  sampleRate: number;
  timeCourse: number[];
}

interface LabelOutput {
  type: ICAComponentType;
  confidence: number;
  rationale: string;
}

function labelComponent(input: LabelInput): LabelOutput {
  const { topography, channelNames, bandShares, kurtosis, sampleRate, timeCourse } = input;
  // Find dominant channel(s) by |weight|
  const ranks = topography
    .map((w, i) => ({ name: channelNames[i] || `Ch${i + 1}`, weight: Math.abs(w) }))
    .sort((a, b) => b.weight - a.weight);
  const topCh = ranks[0]?.name ?? "";
  const frontalTop = /^F|FP/i.test(topCh);
  const occipitalTop = /^O/i.test(topCh);
  const centralTop = /^C/i.test(topCh);
  const temporalTop = /^T|FT|TP/i.test(topCh);

  // Spatial focality: ratio of top channel to mean weight
  const meanAbs = topography.reduce((a, b) => a + Math.abs(b), 0) / topography.length || 1;
  const focality = (ranks[0]?.weight ?? 0) / meanAbs;

  // Eye: frontal-dominant + high delta share + high kurtosis (blink spikes)
  if (frontalTop && bandShares.delta > 0.4 && kurtosis > 4) {
    return {
      type: "eye",
      confidence: Math.min(0.95, 0.5 + bandShares.delta + kurtosis / 20),
      rationale: `Frontal focus (top channel ${topCh}), strong delta (${(bandShares.delta * 100).toFixed(0)}%), kurtotic time course — consistent with blinks / EOG.`,
    };
  }

  // Muscle: high gamma share + peripheral (temporal) topography
  if (bandShares.gamma > 0.3 && (temporalTop || focality < 2)) {
    return {
      type: "muscle",
      confidence: Math.min(0.95, 0.4 + bandShares.gamma),
      rationale: `Gamma-band power dominates (${(bandShares.gamma * 100).toFixed(0)}%) with broad/peripheral topography — typical EMG.`,
    };
  }

  // Line noise: peak right at 50/60 Hz
  const { freqs, psd } = welchPSD(timeCourse, sampleRate, 256, 0.5);
  for (const lf of [50, 60]) {
    const peak = bandPower(freqs, psd, lf - 1.5, lf + 1.5);
    const broad =
      bandPower(freqs, psd, lf - 6, lf - 1.5) +
      bandPower(freqs, psd, lf + 1.5, lf + 6);
    if (broad > 0 && peak / broad > 5) {
      return {
        type: "line-noise",
        confidence: 0.85,
        rationale: `Spectral peak at ${lf} Hz dominates broadband — mains contamination.`,
      };
    }
  }

  // Cardiac: very low-frequency burst pattern + low channel focality
  if (bandShares.delta > 0.45 && focality < 1.8 && kurtosis > 8) {
    return {
      type: "cardiac",
      confidence: 0.6,
      rationale: `Broad delta, kurtotic — possible ECG / cardiac contamination.`,
    };
  }

  // Brain: posterior + alpha-dominant, or central + beta
  if ((occipitalTop && bandShares.alpha > 0.3) || (centralTop && bandShares.beta > 0.25)) {
    return {
      type: "brain",
      confidence: Math.min(0.9, 0.5 + bandShares.alpha + bandShares.beta * 0.5),
      rationale: occipitalTop
        ? `Posterior-dominant with ${(bandShares.alpha * 100).toFixed(0)}% alpha — typical neural source.`
        : `Central topography with elevated beta — likely sensorimotor activity.`,
    };
  }

  // Default
  return {
    type: "other",
    confidence: 0.4,
    rationale: `Mixed spatial / spectral signature — ambiguous classification.`,
  };
}

/** Jacobi eigendecomposition for symmetric matrices. */
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a: number[][] = A.map((row) => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const maxIter = 200;
  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal |a[p][q]|
    let p = 0, q = 1, maxOff = Math.abs(a[0][1]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > maxOff) {
          maxOff = Math.abs(a[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-10) break;
    // Jacobi rotation to zero a[p][q]
    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    let theta: number;
    if (Math.abs(app - aqq) < 1e-30) {
      theta = Math.PI / 4;
    } else {
      theta = 0.5 * Math.atan2(2 * apq, app - aqq);
    }
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    for (let i = 0; i < n; i++) {
      const aip = a[i][p];
      const aiq = a[i][q];
      a[i][p] = c * aip + s * aiq;
      a[i][q] = -s * aip + c * aiq;
    }
    for (let j = 0; j < n; j++) {
      const apj = a[p][j];
      const aqj = a[q][j];
      a[p][j] = c * apj + s * aqj;
      a[q][j] = -s * apj + c * aqj;
    }
    for (let i = 0; i < n; i++) {
      const vip = v[i][p];
      const viq = v[i][q];
      v[i][p] = c * vip + s * viq;
      v[i][q] = -s * vip + c * viq;
    }
  }
  const values = new Array(n);
  for (let i = 0; i < n; i++) values[i] = a[i][i];
  return { values, vectors: v };
}

/**
 * Reconstruct the channel signals after zeroing the specified components.
 * Useful for "remove eye / muscle" workflows.
 */
export function reconstruct(result: ICAResult, removeIndices: number[]): number[][] {
  if (result.components.length === 0) return [];
  const remove = new Set(removeIndices);
  const n = result.components[0].topography.length;
  const T = result.components[0].timeCourse.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(T).fill(0));
  for (const c of result.components) {
    if (remove.has(c.index)) continue;
    for (let i = 0; i < n; i++) {
      const w = c.topography[i];
      for (let t = 0; t < T; t++) out[i][t] += w * c.timeCourse[t];
    }
  }
  return out;
}
