import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/lib/insights";

const FS = 250;
const DUR = 4;
const N = FS * DUR;

function sine(freq: number, amp = 5): number[] {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / FS));
  return out;
}

describe("runAnalysis", () => {
  it("produces a complete bundle for a single-channel alpha signal", () => {
    const a = runAnalysis([sine(10)], ["Oz"], FS);
    expect(a.dominantBand).toBe("alpha");
    expect(a.alphaPeakHz).not.toBeNull();
    expect(a.findings.length).toBeGreaterThan(0);
    expect(a.quality.overall).toBeGreaterThanOrEqual(0);
    expect(a.quality.overall).toBeLessThanOrEqual(100);
  });

  it("flags bad (flat) channels", () => {
    const flat = new Array(N).fill(0);
    const ok = sine(10, 5);
    const a = runAnalysis([flat, ok], ["T7", "Oz"], FS);
    expect(a.quality.badChannels).toContain("T7");
  });

  it("emits findings tagged with severity", () => {
    const a = runAnalysis([sine(10)], ["Oz"], FS);
    expect(a.findings.every((f) => ["good", "info", "warn", "danger"].includes(f.severity))).toBe(true);
  });

  it("computes frontal alpha asymmetry when F3/F4 are present", () => {
    const left = sine(10, 4);
    const right = sine(10, 6);
    const a = runAnalysis([left, right], ["F3", "F4"], FS);
    expect(a.asymmetry).not.toBeNull();
    expect(typeof a.asymmetry?.value).toBe("number");
  });

  it("returns null asymmetry when frontal pair is missing", () => {
    const a = runAnalysis([sine(10)], ["Cz"], FS);
    expect(a.asymmetry).toBeNull();
  });
});
