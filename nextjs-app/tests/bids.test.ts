import { describe, expect, it } from "vitest";
import { buildBIDS, packZip } from "../src/lib/bids";
import { runAnalysis } from "../src/lib/insights";

const FS = 250;
const N = FS * 2;

function sine(freq: number, amp = 4): number[] {
  const out = new Array(N);
  for (let i = 0; i < N; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * (i / FS));
  return out;
}

describe("buildBIDS", () => {
  it("includes all required BIDS-EEG files", () => {
    const channelNames = ["Cz", "Oz"];
    const data = [sine(10), sine(10)];
    const analysis = runAnalysis(data, channelNames, FS);
    const bundle = buildBIDS({
      fileName: "subject01.csv",
      channels: 2,
      channelNames,
      sampleRate: FS,
      duration: 2,
      cleanedData: data,
      filters: {
        bandpass_low: 1,
        bandpass_high: 45,
        notch_freq: 50,
        highpass_freq: 0.5,
        lowpass_freq: 45,
      },
      analysis,
    });
    const paths = bundle.files.map((f) => f.path);
    expect(paths).toContain("dataset_description.json");
    expect(paths).toContain("README");
    expect(paths).toContain("participants.tsv");
    expect(paths.some((p) => p.endsWith("_eeg.json"))).toBe(true);
    expect(paths.some((p) => p.endsWith("_channels.tsv"))).toBe(true);
    expect(paths.some((p) => p.endsWith("_events.tsv"))).toBe(true);
    expect(paths.some((p) => p.endsWith("_eeg.tsv"))).toBe(true);
  });
});

describe("packZip", () => {
  it("produces a valid ZIP signature", () => {
    const bundle = {
      rootName: "test",
      files: [{ path: "hello.txt", content: "hi" }],
    };
    const zip = packZip(bundle);
    // First 4 bytes should be the local file header signature 0x04034b50
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // Should end with EOCD signature 0x06054b50
    expect(zip[zip.length - 22]).toBe(0x50);
    expect(zip[zip.length - 21]).toBe(0x4b);
    expect(zip[zip.length - 20]).toBe(0x05);
    expect(zip[zip.length - 19]).toBe(0x06);
  });
});
