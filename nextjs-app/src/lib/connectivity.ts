/**
 * Channel × channel connectivity. Pearson correlation on raw signals + a
 * cheap alpha-band coherence proxy.
 */

import { mscCoherence } from "./dsp";

export interface ConnectivityMatrix {
  channels: string[];
  pearson: number[][];          // n × n raw-signal Pearson
  alphaCoherence: number[][];   // n × n α-band MSC (true coherence)
  topPairs: { a: string; b: string; r: number }[]; // by |pearson|
}

export function computeConnectivity(
  data: number[][],
  channelNames: string[],
  sampleRate: number
): ConnectivityMatrix {
  const n = data.length;
  const length = data[0]?.length ?? 0;

  // means
  const means: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < length; k++) s += data[i][k];
    means[i] = s / Math.max(1, length);
  }
  // stddevs
  const stds: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < length; k++) {
      const d = data[i][k] - means[i];
      s += d * d;
    }
    stds[i] = Math.sqrt(s / Math.max(1, length)) || 1;
  }
  // pearson
  const pearson = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    pearson[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      let cov = 0;
      for (let k = 0; k < length; k++) cov += (data[i][k] - means[i]) * (data[j][k] - means[j]);
      const r = cov / (length * stds[i] * stds[j]);
      pearson[i][j] = r;
      pearson[j][i] = r;
    }
  }

  // alpha-band magnitude-squared coherence (real cross-spectral measure)
  const cohSegSize = Math.min(Math.max(64, Math.round(sampleRate * 2)), 512);
  const alphaCoherence = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    alphaCoherence[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const { freqs, msc } = mscCoherence(data[i], data[j], sampleRate, cohSegSize, 0.5);
      // average MSC over α band (8-13 Hz)
      let sum = 0;
      let count = 0;
      for (let k = 0; k < freqs.length; k++) {
        if (freqs[k] >= 8 && freqs[k] <= 13) {
          sum += msc[k];
          count++;
        }
      }
      const c = count > 0 ? sum / count : 0;
      alphaCoherence[i][j] = c;
      alphaCoherence[j][i] = c;
    }
  }

  // top pairs
  const pairs: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ a: channelNames[i] || `Ch${i + 1}`, b: channelNames[j] || `Ch${j + 1}`, r: pearson[i][j] });
    }
  }
  pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return {
    channels: channelNames.slice(0, n),
    pearson,
    alphaCoherence,
    topPairs: pairs.slice(0, 10),
  };
}

