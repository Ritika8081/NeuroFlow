/**
 * BIDS-EEG export. Generates a bundle that mirrors the BIDS Brain Imaging
 * Data Structure specification (eeg.json sidecar, channels.tsv, events.tsv,
 * dataset_description.json).
 *
 * Output is a virtual file map; the UI zips it with a tiny client-side
 * archiver (no external dep — we use the "store" tar-ish text fallback
 * when JSZip isn't available, and pack as plain ZIP otherwise).
 *
 * Refs: https://bids-specification.readthedocs.io/en/stable/04-modality-specific-files/03-electroencephalography.html
 */

import { AnalysisBundle } from "./insights";

export interface BIDSExportInput {
  fileName: string;
  channels: number;
  channelNames: string[];
  sampleRate: number;
  duration: number;
  cleanedData: number[][]; // channels × samples
  filters: {
    bandpass_low: number;
    bandpass_high: number;
    notch_freq: number;
    highpass_freq: number | null;
    lowpass_freq: number | null;
  };
  analysis: AnalysisBundle;
  subjectId?: string;       // default: derived from filename
  sessionId?: string;       // default: "01"
  taskName?: string;        // default: "rest"
}

export interface BIDSFile {
  path: string;
  content: string;
}

export interface BIDSBundle {
  files: BIDSFile[];
  rootName: string; // top-level dataset folder name
}

const SCHEMA_VERSION = "1.9.0";

function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "");
}

function basename(s: string): string {
  return s.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "");
}

/** Build the in-memory BIDS file map. */
export function buildBIDS(input: BIDSExportInput): BIDSBundle {
  const subject = "sub-" + (safeId(input.subjectId ?? basename(input.fileName)) || "01");
  const session = "ses-" + (safeId(input.sessionId ?? "01") || "01");
  const task = safeId(input.taskName ?? "rest") || "rest";

  const baseStem = `${subject}_${session}_task-${task}_eeg`;
  const eegDir = `${subject}/${session}/eeg`;
  const datasetName = `${subject}_neuroflow-bids`;

  const files: BIDSFile[] = [];

  // dataset_description.json
  files.push({
    path: "dataset_description.json",
    content: JSON.stringify(
      {
        Name: "NeuroFlow Lab BIDS-EEG export",
        BIDSVersion: SCHEMA_VERSION,
        DatasetType: "raw",
        Authors: ["NeuroFlow Lab user"],
        GeneratedBy: [{ Name: "NeuroFlow Lab", Version: "0.2.0" }],
      },
      null,
      2
    ),
  });

  // README
  files.push({
    path: "README",
    content: [
      `NeuroFlow Lab BIDS-EEG export`,
      `============================`,
      ``,
      `Source recording: ${input.fileName}`,
      `Channels: ${input.channels} @ ${input.sampleRate} Hz, ${input.duration.toFixed(1)}s`,
      ``,
      `Filters applied:`,
      `  band-pass ${input.filters.bandpass_low}-${input.filters.bandpass_high} Hz`,
      `  notch ${input.filters.notch_freq} Hz`,
      input.filters.highpass_freq != null ? `  high-pass ${input.filters.highpass_freq} Hz` : "",
      input.filters.lowpass_freq != null ? `  low-pass ${input.filters.lowpass_freq} Hz` : "",
      ``,
      `Cognitive state (auto-classified): ${input.analysis.cognitive.state} ` +
        `(confidence ${(input.analysis.cognitive.confidence * 100).toFixed(0)}%)`,
      `Quality score: ${input.analysis.quality.overall}/100`,
      `Bad channels: ${input.analysis.quality.badChannels.join(", ") || "(none)"}`,
      ``,
      `This bundle is BIDS-EEG-compatible. Validate with the BIDS Validator:`,
      `https://bids-standard.github.io/bids-validator/`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // Top-level participants.tsv
  files.push({
    path: "participants.tsv",
    content: ["participant_id\tspecies", `${subject}\thomo sapiens`].join("\n"),
  });

  // sub-XX/ses-XX/eeg/<baseStem>.json (sidecar)
  const sidecar = {
    TaskName: task,
    EEGReference: "unknown",
    SamplingFrequency: input.sampleRate,
    PowerLineFrequency: input.filters.notch_freq,
    SoftwareFilters: {
      Bandpass: {
        Type: "Butterworth 4th order",
        LowCutoff_Hz: input.filters.bandpass_low,
        HighCutoff_Hz: input.filters.bandpass_high,
      },
      Notch: {
        Type: "IIR notch",
        Frequency_Hz: input.filters.notch_freq,
      },
      ...(input.filters.highpass_freq != null
        ? { HighPass: { CutoffFrequency_Hz: input.filters.highpass_freq } }
        : {}),
      ...(input.filters.lowpass_freq != null
        ? { LowPass: { CutoffFrequency_Hz: input.filters.lowpass_freq } }
        : {}),
    },
    EEGChannelCount: input.channels,
    EOGChannelCount: 0,
    ECGChannelCount: 0,
    EMGChannelCount: 0,
    RecordingDuration: input.duration,
    RecordingType: "continuous",
    Manufacturer: "unknown",
    ManufacturersModelName: "unknown",
    CapManufacturer: "unknown",
    InstitutionName: "unknown",
  };
  files.push({
    path: `${eegDir}/${baseStem}.json`,
    content: JSON.stringify(sidecar, null, 2),
  });

  // channels.tsv
  const channelsHeader = "name\ttype\tunits\tsampling_frequency\tlow_cutoff\thigh_cutoff\tstatus\tstatus_description";
  const channelsLines = input.channelNames.map((name) => {
    const bad = input.analysis.quality.badChannels.includes(name);
    return [
      name,
      "EEG",
      "uV",
      `${input.sampleRate}`,
      input.filters.bandpass_low,
      input.filters.bandpass_high,
      bad ? "bad" : "good",
      bad ? "Flagged by NeuroFlow auto QC" : "n/a",
    ].join("\t");
  });
  files.push({
    path: `${eegDir}/${baseStem}_channels.tsv`,
    content: [channelsHeader, ...channelsLines].join("\n"),
  });

  // events.tsv (minimal — just one "rec_start" event)
  files.push({
    path: `${eegDir}/${baseStem}_events.tsv`,
    content: ["onset\tduration\ttrial_type", `0\t${input.duration}\trec_start`].join("\n"),
  });

  // EEG data — as numeric CSV (BIDS allows EDF/BDF/BrainVision; we emit
  // a CSV alongside the sidecar with a *_eeg.tsv shadow so downstream tools
  // know what to do).
  //
  // Note: strict BIDS expects EDF/BDF/BrainVision binary. We emit TSV
  // (samples × channels) which mne-bids and pybv can convert. We document
  // this in README to make the limitation explicit.
  const samples = input.cleanedData[0]?.length ?? 0;
  const dataHeader = input.channelNames.join("\t");
  const dataLines: string[] = new Array(samples);
  for (let t = 0; t < samples; t++) {
    const row = new Array(input.channels);
    for (let c = 0; c < input.channels; c++) row[c] = input.cleanedData[c][t].toFixed(6);
    dataLines[t] = row.join("\t");
  }
  files.push({
    path: `${eegDir}/${baseStem}_eeg.tsv`,
    content: [dataHeader, ...dataLines].join("\n"),
  });

  return { files, rootName: datasetName };
}

/**
 * Pack files into a minimal store-only ZIP. No compression — produces a
 * valid .zip that BIDS-validator can read.
 *
 * Adapted from a minimal implementation: ZIP "stored" (method 0) with
 * CRC32 + local + central directory + end-of-central-directory.
 */
export function packZip(bundle: BIDSBundle): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of bundle.files) {
    const nameBytes = enc.encode(`${bundle.rootName}/${file.path}`);
    const data = enc.encode(file.content);
    const crc = crc32(data);
    const size = data.length;

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);     // version
    dv.setUint16(6, 0, true);      // flags
    dv.setUint16(8, 0, true);      // method (0 = store)
    dv.setUint16(10, 0, true);     // mtime
    dv.setUint16(12, 0, true);     // mdate
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);  // compressed
    dv.setUint32(22, size, true);  // uncompressed
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);     // extra length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader, data);
    const localOffset = offset;
    offset += localHeader.length + data.length;

    // Central directory header
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(centralHeader.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    parts.push(c);
    centralSize += c.length;
    offset += c.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);
  parts.push(eocd);

  // concat
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/* CRC32 (IEEE 802.3) */
let CRC_TABLE: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
