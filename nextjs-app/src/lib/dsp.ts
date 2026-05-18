/**
 * Lightweight DSP utilities for client-side EEG analysis.
 * Implements real FFT, Welch PSD, band-power, spectrogram, and
 * artifact / quality heuristics. No external deps.
 */

export const BANDS = {
  delta: [1, 4],
  theta: [4, 8],
  alpha: [8, 13],
  beta: [13, 30],
  gamma: [30, 45],
} as const;

export type BandName = keyof typeof BANDS;

export const BAND_ORDER: BandName[] = ["delta", "theta", "alpha", "beta", "gamma"];

export const BAND_COLORS: Record<BandName, string> = {
  delta: "#818cf8",
  theta: "#a78bfa",
  alpha: "#34d399",
  beta: "#fbbf24",
  gamma: "#f472b6",
};

/* ------------------------------------------------------------------ */
/*  FFT — iterative Cooley–Tukey, in-place                            */
/* ------------------------------------------------------------------ */

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Real-input FFT — returns magnitude spectrum length N/2 + 1. */
export function fftMagnitude(input: number[]): number[] {
  const N = nextPow2(input.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < input.length; i++) re[i] = input[i];

  // bit reversal
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const tablestep = -2 * Math.PI / size;
    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = tablestep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const a = i + k;
        const b = a + half;
        const tre = wr * re[b] - wi * im[b];
        const tim = wr * im[b] + wi * re[b];
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
      }
    }
  }

  const mag = new Array(Math.floor(N / 2) + 1);
  for (let i = 0; i < mag.length; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return mag;
}

/* ------------------------------------------------------------------ */
/*  PSD — Welch's method                                              */
/* ------------------------------------------------------------------ */

/** Hann window of length N. */
function hann(N: number): Float64Array {
  const w = new Float64Array(N);
  for (let n = 0; n < N; n++) w[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
  return w;
}

/** Real-input FFT — returns {re, im} arrays of length N (power of two ≥ input length). */
export function fftComplex(input: number[]): { re: Float64Array; im: Float64Array; N: number } {
  const N = nextPow2(input.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < input.length; i++) re[i] = input[i];

  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const tablestep = -2 * Math.PI / size;
    for (let i = 0; i < N; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = tablestep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const a = i + k;
        const b = a + half;
        const tre = wr * re[b] - wi * im[b];
        const tim = wr * im[b] + wi * re[b];
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
      }
    }
  }
  return { re, im, N };
}

export interface WelchOptions {
  segmentSize?: number;
  overlap?: number;
  /** "mean" averages segment PSDs (default Welch). "median" is robust to outliers (bursts). */
  averaging?: "mean" | "median";
}

/** Welch PSD estimate. Returns { freqs, psd } where psd is in (units^2 / Hz). */
export function welchPSD(
  signal: number[],
  sampleRate: number,
  segmentSize: number | WelchOptions = 256,
  overlap = 0.5
): { freqs: number[]; psd: number[] } {
  // Backwards-compatible signature: allow 3rd arg to be an options object.
  let segSize = 256;
  let ov = overlap;
  let averaging: "mean" | "median" = "mean";
  if (typeof segmentSize === "number") {
    segSize = segmentSize;
  } else {
    segSize = segmentSize.segmentSize ?? 256;
    ov = segmentSize.overlap ?? overlap;
    averaging = segmentSize.averaging ?? "mean";
  }

  const N = Math.min(segSize, signal.length);
  const seg = nextPow2(N);
  const step = Math.max(1, Math.floor(seg * (1 - ov)));
  const window = hann(seg);
  let wSumSq = 0;
  for (let i = 0; i < seg; i++) wSumSq += window[i] * window[i];
  const norm = sampleRate * wSumSq;

  const halfN = Math.floor(seg / 2) + 1;
  const accum = new Float64Array(halfN);
  const segmentPSDs: number[][] = []; // only used when averaging === "median"
  let nSeg = 0;

  for (let start = 0; start + seg <= signal.length; start += step) {
    const seg_arr = new Array(seg);
    let mean = 0;
    for (let i = 0; i < seg; i++) mean += signal[start + i];
    mean /= seg;
    for (let i = 0; i < seg; i++) seg_arr[i] = (signal[start + i] - mean) * window[i];
    const mag = fftMagnitude(seg_arr);
    if (averaging === "median") {
      const row = new Array(halfN);
      for (let k = 0; k < halfN; k++) row[k] = (mag[k] * mag[k]) / norm;
      segmentPSDs.push(row);
    } else {
      for (let k = 0; k < halfN; k++) accum[k] += (mag[k] * mag[k]) / norm;
    }
    nSeg++;
  }
  if (nSeg === 0) {
    const seg_arr = new Array(seg).fill(0);
    let mean = 0;
    for (let i = 0; i < signal.length; i++) mean += signal[i];
    mean /= Math.max(1, signal.length);
    for (let i = 0; i < signal.length; i++) seg_arr[i] = (signal[i] - mean) * window[i];
    const mag = fftMagnitude(seg_arr);
    for (let k = 0; k < halfN; k++) accum[k] = (mag[k] * mag[k]) / norm;
    nSeg = 1;
  } else if (averaging === "median") {
    // median across segments per frequency bin
    for (let k = 0; k < halfN; k++) {
      const col = segmentPSDs.map((row) => row[k]).sort((a, b) => a - b);
      const m = Math.floor(col.length / 2);
      accum[k] = col.length % 2 === 0 ? (col[m - 1] + col[m]) / 2 : col[m];
    }
    // median doesn't need /nSeg
    nSeg = 1;
  }
  // 2x for one-sided (except DC/Nyquist)
  for (let k = 1; k < halfN - 1; k++) accum[k] *= 2;

  const freqs = new Array(halfN);
  for (let k = 0; k < halfN; k++) freqs[k] = (k * sampleRate) / seg;
  const psd = new Array(halfN);
  for (let k = 0; k < halfN; k++) psd[k] = accum[k] / nSeg;
  return { freqs, psd };
}

/**
 * Magnitude-squared coherence (Bendat & Piersol). Computes cross-spectral
 * density via complex FFT segments, averaged across overlapping windows.
 *
 * Returns MSC in [0, 1] per frequency bin.
 */
export function mscCoherence(
  sigA: number[],
  sigB: number[],
  sampleRate: number,
  segmentSize = 256,
  overlap = 0.5
): { freqs: number[]; msc: number[] } {
  const N = Math.min(segmentSize, sigA.length, sigB.length);
  const seg = nextPow2(N);
  const step = Math.max(1, Math.floor(seg * (1 - overlap)));
  const window = hann(seg);
  const halfN = Math.floor(seg / 2) + 1;

  const pxx = new Float64Array(halfN);
  const pyy = new Float64Array(halfN);
  const pxyRe = new Float64Array(halfN);
  const pxyIm = new Float64Array(halfN);
  let nSeg = 0;

  const limit = Math.min(sigA.length, sigB.length);
  for (let start = 0; start + seg <= limit; start += step) {
    // window + remove mean
    let mA = 0, mB = 0;
    for (let i = 0; i < seg; i++) { mA += sigA[start + i]; mB += sigB[start + i]; }
    mA /= seg; mB /= seg;
    const wa = new Array(seg);
    const wb = new Array(seg);
    for (let i = 0; i < seg; i++) {
      wa[i] = (sigA[start + i] - mA) * window[i];
      wb[i] = (sigB[start + i] - mB) * window[i];
    }
    const fa = fftComplex(wa);
    const fb = fftComplex(wb);
    for (let k = 0; k < halfN; k++) {
      const ar = fa.re[k], ai = fa.im[k];
      const br = fb.re[k], bi = fb.im[k];
      pxx[k] += ar * ar + ai * ai;
      pyy[k] += br * br + bi * bi;
      // cross-spectrum: conj(A) * B
      pxyRe[k] += ar * br + ai * bi;
      pxyIm[k] += ar * bi - ai * br;
    }
    nSeg++;
  }
  if (nSeg === 0) {
    return { freqs: [], msc: [] };
  }
  const freqs = new Array(halfN);
  const msc = new Array(halfN);
  for (let k = 0; k < halfN; k++) {
    freqs[k] = (k * sampleRate) / seg;
    const num = pxyRe[k] * pxyRe[k] + pxyIm[k] * pxyIm[k];
    const den = pxx[k] * pyy[k];
    msc[k] = den > 0 ? num / den : 0;
  }
  return { freqs, msc };
}

/** Integrate PSD across a frequency range. */
export function bandPower(
  freqs: number[],
  psd: number[],
  lo: number,
  hi: number
): number {
  let p = 0;
  for (let i = 1; i < freqs.length; i++) {
    const f0 = freqs[i - 1];
    const f1 = freqs[i];
    if (f1 < lo) continue;
    if (f0 > hi) break;
    const a = Math.max(f0, lo);
    const b = Math.min(f1, hi);
    if (b > a) {
      // trapezoidal
      const v0 = interpPsd(freqs, psd, a);
      const v1 = interpPsd(freqs, psd, b);
      p += ((v0 + v1) / 2) * (b - a);
    }
  }
  return p;
}

function interpPsd(freqs: number[], psd: number[], f: number) {
  if (f <= freqs[0]) return psd[0];
  if (f >= freqs[freqs.length - 1]) return psd[psd.length - 1];
  // small array — linear scan is fine
  for (let i = 1; i < freqs.length; i++) {
    if (freqs[i] >= f) {
      const t = (f - freqs[i - 1]) / (freqs[i] - freqs[i - 1]);
      return psd[i - 1] * (1 - t) + psd[i] * t;
    }
  }
  return psd[psd.length - 1];
}

/* ------------------------------------------------------------------ */
/*  Band powers per channel                                           */
/* ------------------------------------------------------------------ */

export interface BandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  total: number;
}

export function computeBandPowers(
  signal: number[],
  sampleRate: number
): { bands: BandPowers; psd: { freqs: number[]; psd: number[] } } {
  // Pick a segment size proportional to fs (~1s @ fs Hz), capped.
  const seg = Math.max(64, Math.min(1024, Math.round(sampleRate)));
  const psd = welchPSD(signal, sampleRate, seg, 0.5);
  const bands: BandPowers = {
    delta: bandPower(psd.freqs, psd.psd, BANDS.delta[0], BANDS.delta[1]),
    theta: bandPower(psd.freqs, psd.psd, BANDS.theta[0], BANDS.theta[1]),
    alpha: bandPower(psd.freqs, psd.psd, BANDS.alpha[0], BANDS.alpha[1]),
    beta: bandPower(psd.freqs, psd.psd, BANDS.beta[0], BANDS.beta[1]),
    gamma: bandPower(psd.freqs, psd.psd, BANDS.gamma[0], BANDS.gamma[1]),
    total: 0,
  };
  bands.total = bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma;
  return { bands, psd };
}

/* ------------------------------------------------------------------ */
/*  Spectrogram                                                       */
/* ------------------------------------------------------------------ */

export interface Spectrogram {
  freqs: number[];
  times: number[];
  matrix: number[][]; // [time][freq] log-magnitude
  fMax: number;
}

export function spectrogram(
  signal: number[],
  sampleRate: number,
  windowSec = 1,
  overlap = 0.75,
  fMax = 50
): Spectrogram {
  const seg = nextPow2(Math.round(sampleRate * windowSec));
  const step = Math.max(1, Math.floor(seg * (1 - overlap)));
  const window = hann(seg);
  const halfN = Math.floor(seg / 2) + 1;
  const freqsAll = new Array(halfN);
  for (let k = 0; k < halfN; k++) freqsAll[k] = (k * sampleRate) / seg;
  const fMaxIdx = freqsAll.findIndex((f) => f > fMax);
  const cut = fMaxIdx === -1 ? halfN : fMaxIdx;
  const freqs = freqsAll.slice(0, cut);

  const times: number[] = [];
  const matrix: number[][] = [];

  for (let start = 0; start + seg <= signal.length; start += step) {
    const seg_arr = new Array(seg);
    let mean = 0;
    for (let i = 0; i < seg; i++) mean += signal[start + i];
    mean /= seg;
    for (let i = 0; i < seg; i++) seg_arr[i] = (signal[start + i] - mean) * window[i];
    const mag = fftMagnitude(seg_arr);
    const row = new Array(cut);
    for (let k = 0; k < cut; k++) row[k] = Math.log10(mag[k] * mag[k] + 1e-12);
    matrix.push(row);
    times.push((start + seg / 2) / sampleRate);
  }
  return { freqs, times, matrix, fMax };
}

/* ------------------------------------------------------------------ */
/*  Channel statistics                                                */
/* ------------------------------------------------------------------ */

export interface ChannelStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  ptp: number;
  rms: number;
  kurtosis: number;
}

export function channelStats(signal: number[]): ChannelStats {
  const n = signal.length;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = signal[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let m2 = 0;
  let m4 = 0;
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const d = signal[i] - mean;
    sqSum += signal[i] * signal[i];
    m2 += d * d;
    m4 += d * d * d * d;
  }
  const variance = m2 / n;
  const std = Math.sqrt(variance);
  const kurtosis = variance > 0 ? m4 / n / (variance * variance) - 3 : 0;
  const rms = Math.sqrt(sqSum / n);
  return { mean, std, min, max, ptp: max - min, rms, kurtosis };
}

/* ------------------------------------------------------------------ */
/*  Artifact detection (heuristic)                                    */
/* ------------------------------------------------------------------ */

export interface ArtifactEvent {
  channel: number;
  channelName: string;
  startSample: number;
  endSample: number;
  type: "amplitude" | "muscle" | "blink" | "line-noise" | "flat";
  confidence: number; // 0..1
}

export function detectArtifacts(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): ArtifactEvent[] {
  const events: ArtifactEvent[] = [];
  const winSec = 1;
  const win = Math.max(64, Math.round(sampleRate * winSec));

  for (let ch = 0; ch < data.length; ch++) {
    const signal = data[ch];
    const stats = channelStats(signal);
    const name = channelNames[ch] || `Ch${ch + 1}`;
    const isFrontal = /^F|FP/i.test(name);

    // flat channel
    if (stats.std < 0.1 || stats.ptp < 1) {
      events.push({
        channel: ch,
        channelName: name,
        startSample: 0,
        endSample: signal.length - 1,
        type: "flat",
        confidence: 0.95,
      });
      continue;
    }

    // amplitude threshold — z-score of |x|
    const threshold = stats.mean + 5 * stats.std;
    let inEvent = false;
    let evStart = 0;
    for (let i = 0; i < signal.length; i++) {
      const big = Math.abs(signal[i] - stats.mean) > 5 * stats.std;
      if (big && !inEvent) {
        inEvent = true;
        evStart = i;
      } else if (!big && inEvent) {
        inEvent = false;
        const dur = i - evStart;
        if (dur >= sampleRate * 0.02) {
          events.push({
            channel: ch,
            channelName: name,
            startSample: evStart,
            endSample: i,
            type: isFrontal && dur < sampleRate * 0.5 ? "blink" : "amplitude",
            confidence: 0.7,
          });
        }
      }
    }

    // muscle / line noise — per-window band power
    for (let s = 0; s + win <= signal.length; s += win) {
      const seg = signal.slice(s, s + win);
      const { bands, psd } = computeBandPowers(seg, sampleRate);
      const total = bands.total || 1;
      const gammaRatio = bands.gamma / total;
      if (gammaRatio > 0.35) {
        events.push({
          channel: ch,
          channelName: name,
          startSample: s,
          endSample: s + win,
          type: "muscle",
          confidence: Math.min(0.95, gammaRatio * 1.5),
        });
      }
      // line noise: high peak at 50 or 60
      const lineFreqs = [50, 60];
      for (const lf of lineFreqs) {
        const bp = bandPower(psd.freqs, psd.psd, lf - 1, lf + 1);
        const broad = bandPower(psd.freqs, psd.psd, lf - 5, lf - 1) + bandPower(psd.freqs, psd.psd, lf + 1, lf + 5);
        if (broad > 0 && bp / broad > 4) {
          events.push({
            channel: ch,
            channelName: name,
            startSample: s,
            endSample: s + win,
            type: "line-noise",
            confidence: Math.min(0.95, (bp / broad) / 8),
          });
          break;
        }
      }
    }
  }
  return events;
}

/* ------------------------------------------------------------------ */
/*  Quality score                                                     */
/* ------------------------------------------------------------------ */

export interface QualityReport {
  overall: number;
  components: { name: string; value: number; note: string }[];
  badChannels: string[];
  artifactCount: number;
  sampleCount: number;
}

export function qualityScore(
  data: number[][],
  channelNames: string[],
  sampleRate: number,
  artifacts: ArtifactEvent[]
): QualityReport {
  const channels = data.length;
  const samples = data[0]?.length ?? 0;

  const flatChannels = artifacts.filter((a) => a.type === "flat");
  const badChannelIdx = new Set(flatChannels.map((a) => a.channel));

  // % of samples affected by artifacts
  const totalSamples = channels * samples;
  let dirty = 0;
  for (const a of artifacts) dirty += a.endSample - a.startSample;
  const cleanPct = Math.max(0, 1 - dirty / Math.max(1, totalSamples));

  // SNR proxy — alpha-band peak vs broadband
  let snrSum = 0;
  let snrCount = 0;
  for (let ch = 0; ch < channels; ch++) {
    if (badChannelIdx.has(ch)) continue;
    const { bands } = computeBandPowers(data[ch], sampleRate);
    if (bands.total > 0) {
      const ratio = bands.alpha / (bands.total + 1e-9);
      snrSum += ratio;
      snrCount++;
    }
  }
  const alphaShare = snrCount > 0 ? snrSum / snrCount : 0;

  // Bad-channel fraction
  const goodChannelPct = 1 - badChannelIdx.size / channels;

  // Line noise prevalence
  const lineCount = artifacts.filter((a) => a.type === "line-noise").length;
  const linePenalty = Math.min(1, lineCount / (channels * 4));

  const components = [
    { name: "Clean samples", value: Math.round(cleanPct * 100), note: "% of samples not flagged as artifact" },
    { name: "Good channels", value: Math.round(goodChannelPct * 100), note: `${channels - badChannelIdx.size}/${channels} channels usable` },
    { name: "Alpha signature", value: Math.round(Math.min(1, alphaShare * 4) * 100), note: "presence of normal 8-13 Hz activity" },
    { name: "Line noise free", value: Math.round((1 - linePenalty) * 100), note: lineCount === 0 ? "no 50/60 Hz peaks" : `${lineCount} segments with mains noise` },
  ];

  const overall = Math.round(
    cleanPct * 35 + goodChannelPct * 25 + Math.min(1, alphaShare * 4) * 20 + (1 - linePenalty) * 20
  );

  return {
    overall,
    components,
    badChannels: [...badChannelIdx].map((i) => channelNames[i] || `Ch${i + 1}`),
    artifactCount: artifacts.length,
    sampleCount: samples,
  };
}

/* ------------------------------------------------------------------ */
/*  Cognitive-state classifier (heuristic, paper-grounded)            */
/* ------------------------------------------------------------------ */

export interface CognitiveStateResult {
  state: "focused" | "relaxed" | "drowsy" | "alert" | "meditative" | "stressed";
  confidence: number;
  metrics: { name: string; value: number; explanation: string }[];
}

export function classifyCognitiveState(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): CognitiveStateResult {
  let alpha = 0,
    beta = 0,
    theta = 0,
    gamma = 0,
    delta = 0;

  // prefer central/occipital channels for alpha if available
  const ocIdx = channelNames
    .map((n, i) => (/^O|^P/i.test(n) ? i : -1))
    .filter((i) => i >= 0);
  const useIdx = ocIdx.length > 0 ? ocIdx : data.map((_, i) => i).slice(0, Math.min(4, data.length));

  for (const i of useIdx) {
    const { bands } = computeBandPowers(data[i], sampleRate);
    alpha += bands.alpha;
    beta += bands.beta;
    theta += bands.theta;
    gamma += bands.gamma;
    delta += bands.delta;
  }
  const n = Math.max(1, useIdx.length);
  alpha /= n; beta /= n; theta /= n; gamma /= n; delta /= n;
  const total = alpha + beta + theta + gamma + delta || 1;

  const thetaBeta = beta > 0 ? theta / beta : 0;
  const betaAlpha = alpha > 0 ? beta / alpha : 0;
  const alphaTheta = theta > 0 ? alpha / theta : 0;
  const engagement = (beta + gamma) / (alpha + theta + 1e-9);

  let state: CognitiveStateResult["state"] = "alert";
  let confidence = 0.5;

  if (thetaBeta > 2.5) {
    state = "drowsy";
    confidence = Math.min(0.95, 0.4 + thetaBeta / 10);
  } else if (alpha / total > 0.35 && beta / total < 0.2) {
    state = "relaxed";
    confidence = Math.min(0.9, 0.4 + alpha / total);
  } else if (theta / total > 0.3 && alpha / total > 0.2) {
    state = "meditative";
    confidence = Math.min(0.85, 0.4 + theta / total);
  } else if (engagement > 1.8 && beta / total > 0.25) {
    state = "focused";
    confidence = Math.min(0.92, 0.45 + engagement / 6);
  } else if (gamma / total > 0.25 || beta / total > 0.4) {
    state = "stressed";
    confidence = Math.min(0.85, 0.4 + (beta + gamma) / total);
  } else {
    state = "alert";
    confidence = 0.6;
  }

  return {
    state,
    confidence,
    metrics: [
      { name: "Theta / Beta", value: thetaBeta, explanation: "Higher → drowsiness or ADHD-like inattention" },
      { name: "Beta / Alpha", value: betaAlpha, explanation: "Higher → active cognition, lower → relaxation" },
      { name: "Alpha / Theta", value: alphaTheta, explanation: "Higher → alert wakefulness" },
      { name: "Engagement", value: engagement, explanation: "(β + γ) / (α + θ) — task engagement proxy" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Asymmetry — frontal alpha asymmetry as emotional valence proxy    */
/* ------------------------------------------------------------------ */

export function frontalAlphaAsymmetry(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): { value: number; interpretation: string } | null {
  const leftIdx = channelNames.findIndex((n) => /^F[3p]?$|F3|FP1|F7/i.test(n));
  const rightIdx = channelNames.findIndex((n) => /^F[4p]?$|F4|FP2|F8/i.test(n));
  if (leftIdx === -1 || rightIdx === -1) return null;

  const l = computeBandPowers(data[leftIdx], sampleRate).bands.alpha + 1e-9;
  const r = computeBandPowers(data[rightIdx], sampleRate).bands.alpha + 1e-9;
  const asym = Math.log(r) - Math.log(l); // FAA convention

  let interpretation = "balanced";
  if (asym > 0.15) interpretation = "left-frontal dominance → approach / positive affect";
  else if (asym < -0.15) interpretation = "right-frontal dominance → withdrawal / negative affect";
  return { value: asym, interpretation };
}
