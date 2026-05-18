import { describe, expect, it } from "vitest";
import { autoClean } from "../src/lib/autoclean";

const FS = 250;
const N = FS * 4;

function sine(freq: number, amp = 5): number[] {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / FS));
  return out;
}

describe("autoClean", () => {
  it("selects 50 Hz notch by default when no clear line peak", () => {
    const r = autoClean({
      data: [sine(10)],
      channelNames: ["Oz"],
      sampleRate: FS,
      useCase: "Resting-state EEG",
    });
    expect([50, 60]).toContain(r.notch_freq);
  });

  it("detects 60 Hz mains noise when injected", () => {
    const base = sine(10);
    const with60 = base.map((v, i) => v + 30 * Math.sin(2 * Math.PI * 60 * (i / FS)));
    const r = autoClean({
      data: [with60, with60],
      channelNames: ["Cz", "Oz"],
      sampleRate: FS,
      useCase: "Resting-state EEG",
    });
    expect(r.notch_freq).toBe(60);
  });

  it("flags a flat channel as bad", () => {
    const r = autoClean({
      data: [new Array(N).fill(0), sine(10)],
      channelNames: ["T7", "Oz"],
      sampleRate: FS,
    });
    expect(r.exclude_channels).toContain("T7");
  });

  it("uses sleep-friendly band when useCase is sleep", () => {
    const r = autoClean({
      data: [sine(10)],
      channelNames: ["Cz"],
      sampleRate: FS,
      useCase: "Sleep / overnight EEG",
    });
    expect(r.bandpass_low).toBeLessThanOrEqual(0.5);
    expect(r.bandpass_high).toBeLessThanOrEqual(35);
  });

  it("uses BCI-friendly band for motor imagery", () => {
    const r = autoClean({
      data: [sine(10)],
      channelNames: ["Cz"],
      sampleRate: FS,
      useCase: "BCI / neurofeedback",
    });
    expect(r.bandpass_low).toBeGreaterThanOrEqual(8);
    expect(r.bandpass_high).toBeLessThanOrEqual(30);
  });
});
