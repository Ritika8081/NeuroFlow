import { describe, expect, it } from "vitest";
import {
  bandPower,
  channelStats,
  computeBandPowers,
  detectArtifacts,
  fftMagnitude,
  fftComplex,
  mscCoherence,
  welchPSD,
  classifyCognitiveState,
} from "../src/lib/dsp";

const FS = 250;
const DUR = 4; // seconds
const N = FS * DUR;

function sine(freq: number, amp = 1, phase = 0): number[] {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / FS) + phase);
  return out;
}

function noise(amp = 1, seed = 1): number[] {
  let s = seed >>> 0;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = (r() - 0.5) * 2 * amp;
  return out;
}

describe("fftMagnitude", () => {
  it("returns N/2 + 1 bins for length-N input rounded up to power of two", () => {
    const sig = new Array(1000).fill(0);
    const mag = fftMagnitude(sig);
    // nextPow2(1000) = 1024 → 513 bins
    expect(mag.length).toBe(513);
  });

  it("peaks at the correct bin for a pure sinusoid", () => {
    const f = 10;
    const sig = sine(f);
    const mag = fftMagnitude(sig);
    // The signal length is 1000 -> nextPow2 = 1024
    // Bin width = FS / 1024 ≈ 0.244 Hz, so bin ≈ 10 / 0.244 ≈ 41
    const expectedBin = Math.round((f * 1024) / FS);
    // Find argmax in expected ±2 bins
    let argmax = 0;
    let maxv = 0;
    for (let i = 0; i < mag.length; i++) {
      if (mag[i] > maxv) {
        maxv = mag[i];
        argmax = i;
      }
    }
    expect(Math.abs(argmax - expectedBin)).toBeLessThanOrEqual(2);
  });
});

describe("fftComplex", () => {
  it("complex magnitude matches real fftMagnitude", () => {
    const sig = sine(8, 1).slice(0, 256);
    const { re, im } = fftComplex(sig);
    const realMag = fftMagnitude(sig);
    for (let i = 0; i < realMag.length; i++) {
      const m = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      expect(Math.abs(m - realMag[i])).toBeLessThan(1e-9);
    }
  });
});

describe("welchPSD", () => {
  it("peaks at the input sinusoid frequency", () => {
    const f = 10;
    const sig = sine(f, 5);
    const { freqs, psd } = welchPSD(sig, FS, 256, 0.5);
    let argmax = 0;
    let maxv = 0;
    for (let i = 0; i < psd.length; i++) {
      if (psd[i] > maxv) {
        maxv = psd[i];
        argmax = i;
      }
    }
    // bin width here = FS / 256 ≈ 0.976 Hz, so |argmax - 10| should be small
    expect(Math.abs(freqs[argmax] - f)).toBeLessThan(1.5);
  });

  it("supports median averaging via options", () => {
    const sig = sine(10);
    const r = welchPSD(sig, FS, { segmentSize: 256, overlap: 0.5, averaging: "median" });
    expect(r.psd.length).toBeGreaterThan(0);
    expect(r.psd.every((v) => v >= 0)).toBe(true);
  });
});

describe("bandPower", () => {
  it("integrates PSD over a range", () => {
    const freqs = [0, 1, 2, 3, 4];
    const psd = [1, 1, 1, 1, 1];
    expect(bandPower(freqs, psd, 1, 3)).toBeCloseTo(2, 2);
  });
});

describe("computeBandPowers", () => {
  it("alpha dominates when input is a 10 Hz sinusoid", () => {
    const sig = sine(10, 10);
    const { bands } = computeBandPowers(sig, FS);
    expect(bands.alpha).toBeGreaterThan(bands.delta);
    expect(bands.alpha).toBeGreaterThan(bands.theta);
    expect(bands.alpha).toBeGreaterThan(bands.beta);
    expect(bands.alpha).toBeGreaterThan(bands.gamma);
  });
});

describe("channelStats", () => {
  it("matches known formulas for a sinusoid", () => {
    const sig = sine(5, 2);
    const s = channelStats(sig);
    expect(s.mean).toBeCloseTo(0, 1);
    // amplitude 2 sinusoid → rms ≈ 2/√2 ≈ 1.414, std ≈ 1.414
    expect(s.std).toBeGreaterThan(1.3);
    expect(s.std).toBeLessThan(1.55);
  });
});

describe("mscCoherence", () => {
  it("returns ~1 for identical signals across bins", () => {
    const sig = sine(8);
    const { msc } = mscCoherence(sig, sig, FS, 256, 0.5);
    // Identical signals -> MSC = 1 everywhere (within rounding)
    const meanMsc = msc.reduce((a, b) => a + b, 0) / msc.length;
    expect(meanMsc).toBeGreaterThan(0.95);
  });

  it("returns ~0 for independent white noise", () => {
    const a = noise(1, 1);
    const b = noise(1, 999);
    const { msc } = mscCoherence(a, b, FS, 256, 0.5);
    const meanMsc = msc.reduce((a, b) => a + b, 0) / msc.length;
    // independent noise should yield low average coherence
    expect(meanMsc).toBeLessThan(0.6);
  });
});

describe("detectArtifacts", () => {
  it("flags a flat channel", () => {
    const flat = new Array(N).fill(0);
    const ev = detectArtifacts([flat], ["Cz"], FS);
    expect(ev.some((e) => e.type === "flat")).toBe(true);
  });

  it("flags line noise at 50 Hz", () => {
    const base = sine(10, 5);
    const withLine = base.map((v, i) => v + 30 * Math.sin(2 * Math.PI * 50 * (i / FS)));
    const ev = detectArtifacts([withLine], ["Cz"], FS);
    expect(ev.some((e) => e.type === "line-noise")).toBe(true);
  });
});

describe("classifyCognitiveState", () => {
  it("returns a defined state for a 10 Hz alpha-dominant signal on Oz", () => {
    const sig = sine(10, 8);
    const c = classifyCognitiveState([sig], ["Oz"], FS);
    expect(["relaxed", "alert", "meditative", "drowsy", "focused", "stressed"]).toContain(c.state);
  });
});
