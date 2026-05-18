/**
 * Synthetic EEG sample recordings. Each sample mixes plausible band activity
 * with realistic noise so the rest of the pipeline (filters, FFT, classifiers)
 * has something to chew on. Not a substitute for real data — clearly labelled.
 */

export interface SampleRecording {
  filename: string;
  channels: number;
  sampling_rate: number;
  duration_sec: number;
  data_shape: [number, number];
  channel_names: string[];
  preview: number[][]; // channels × samples
  data?: number[][];
  is_synthetic: true;
  description: string;
}

const DEFAULT_CHANNELS = [
  "Fp1", "Fp2", "F3", "F4", "Fz", "C3", "C4", "Cz", "P3", "P4", "Pz", "O1", "O2", "T7", "T8", "F7", "F8",
];

interface ProfileSpec {
  bandWeights: { delta: number; theta: number; alpha: number; beta: number; gamma: number };
  alphaPeak: number;
  noise: number;
  channelMods?: Record<string, Partial<{ delta: number; theta: number; alpha: number; beta: number; gamma: number; noise: number }>>;
}

function synthesize(profile: ProfileSpec, opts: { channels?: string[]; fs?: number; duration?: number; seed?: number } = {}): SampleRecording["data"] {
  const channels = opts.channels ?? DEFAULT_CHANNELS;
  const fs = opts.fs ?? 250;
  const duration = opts.duration ?? 10;
  const samples = fs * duration;
  let rngState = (opts.seed ?? 1337) >>> 0;
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0xffffffff;
  };
  const grandBands = ["delta", "theta", "alpha", "beta", "gamma"] as const;
  const out: number[][] = [];

  for (let ch = 0; ch < channels.length; ch++) {
    const cname = channels[ch];
    const mod = profile.channelMods?.[cname] ?? {};
    const weights = { ...profile.bandWeights, ...mod };
    const noiseLevel = mod.noise ?? profile.noise;
    const sig = new Array(samples).fill(0);
    // sum of band activity
    for (const band of grandBands) {
      const w = (weights as any)[band] ?? 0;
      if (!w) continue;
      const freqRange = {
        delta: [1, 4],
        theta: [4, 8],
        alpha: [8, 13],
        beta: [13, 30],
        gamma: [30, 45],
      }[band];
      // for alpha, pin to specified peak
      const oscillators = band === "alpha" ? 3 : band === "beta" ? 4 : 5;
      for (let o = 0; o < oscillators; o++) {
        const f =
          band === "alpha"
            ? profile.alphaPeak + (rand() - 0.5) * 2
            : freqRange[0] + rand() * (freqRange[1] - freqRange[0]);
        const phase = rand() * Math.PI * 2;
        const amp = (w / oscillators) * (15 + rand() * 10);
        for (let i = 0; i < samples; i++) {
          sig[i] += amp * Math.sin(2 * Math.PI * f * (i / fs) + phase);
        }
      }
    }
    // pink-ish noise (cheap)
    let acc = 0;
    for (let i = 0; i < samples; i++) {
      acc = acc * 0.985 + (rand() - 0.5) * noiseLevel * 25;
      sig[i] += acc;
    }
    out.push(sig);
  }
  return out;
}

export const SAMPLES: { id: string; title: string; build: () => SampleRecording }[] = [
  {
    id: "rest-eyes-closed",
    title: "Resting · eyes closed (relaxed)",
    build: () => buildRecording({
      id: "rest_eyes_closed",
      description: "Synthetic resting EEG with strong posterior alpha (10.5 Hz), typical of relaxed wakefulness with eyes closed.",
      profile: {
        bandWeights: { delta: 0.4, theta: 0.5, alpha: 1.6, beta: 0.5, gamma: 0.15 },
        alphaPeak: 10.5,
        noise: 0.5,
        channelMods: {
          O1: { alpha: 2.4 }, O2: { alpha: 2.4 }, Pz: { alpha: 2.0 },
          P3: { alpha: 1.8 }, P4: { alpha: 1.8 },
        },
      },
    }),
  },
  {
    id: "focused-task",
    title: "Focused · task engagement",
    build: () => buildRecording({
      id: "focused_task",
      description: "Synthetic task EEG with elevated beta over central / frontal sites and suppressed posterior alpha — characteristic of sustained attention.",
      profile: {
        bandWeights: { delta: 0.3, theta: 0.4, alpha: 0.5, beta: 1.5, gamma: 0.4 },
        alphaPeak: 10.0,
        noise: 0.6,
        channelMods: {
          Fz: { beta: 2.2 }, Cz: { beta: 2.0 }, F3: { beta: 1.8 }, F4: { beta: 1.8 },
          O1: { alpha: 0.4 }, O2: { alpha: 0.4 },
        },
      },
    }),
  },
  {
    id: "drowsy",
    title: "Drowsy · pre-sleep",
    build: () => buildRecording({
      id: "drowsy_state",
      description: "Synthetic drowsy EEG: high theta, slowed alpha (~8 Hz), increased frontal delta — common pre-sleep signature.",
      profile: {
        bandWeights: { delta: 1.0, theta: 1.8, alpha: 0.6, beta: 0.3, gamma: 0.1 },
        alphaPeak: 8.2,
        noise: 0.55,
        channelMods: {
          Fp1: { delta: 1.6 }, Fp2: { delta: 1.6 },
          Fz: { theta: 2.0 }, Cz: { theta: 1.8 },
        },
      },
    }),
  },
  {
    id: "artifact-heavy",
    title: "Artifact-heavy · noisy lab",
    build: () => buildRecording({
      id: "artifact_heavy",
      description: "Synthetic recording with a bad/flat channel (T8), strong 50 Hz line noise on F7, and frontal blink-like deflections — useful for testing artifact detection.",
      profile: {
        bandWeights: { delta: 0.6, theta: 0.6, alpha: 1.2, beta: 0.7, gamma: 0.2 },
        alphaPeak: 10.0,
        noise: 0.6,
        channelMods: {
          T8: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0, noise: 0 },
        },
      },
      mutate(data, channelNames, fs) {
        // Inject line noise on F7
        const f7Idx = channelNames.indexOf("F7");
        if (f7Idx >= 0) {
          const sig = data[f7Idx];
          for (let i = 0; i < sig.length; i++) {
            sig[i] += 35 * Math.sin(2 * Math.PI * 50 * (i / fs));
          }
        }
        // Frontal blink-like spikes
        for (const cname of ["Fp1", "Fp2"]) {
          const idx = channelNames.indexOf(cname);
          if (idx < 0) continue;
          const sig = data[idx];
          for (let blink = 0; blink < 4; blink++) {
            const t0 = Math.floor((blink + 1) * (sig.length / 5));
            for (let i = 0; i < fs * 0.15; i++) {
              const x = i / (fs * 0.15);
              sig[t0 + i] += 180 * Math.exp(-((x - 0.5) ** 2) * 30);
            }
          }
        }
      },
    }),
  },
  {
    id: "meditation",
    title: "Meditation · theta+alpha",
    build: () => buildRecording({
      id: "meditation",
      description: "Synthetic meditative state with co-elevated theta and alpha — sometimes called the 'theta-alpha' signature in long-term practitioners.",
      profile: {
        bandWeights: { delta: 0.4, theta: 1.5, alpha: 1.5, beta: 0.4, gamma: 0.1 },
        alphaPeak: 9.8,
        noise: 0.45,
      },
    }),
  },
];

interface BuildOpts {
  id: string;
  description: string;
  profile: ProfileSpec;
  channels?: string[];
  fs?: number;
  duration?: number;
  mutate?: (data: number[][], channelNames: string[], fs: number) => void;
}

function buildRecording(opts: BuildOpts): SampleRecording {
  const channels = opts.channels ?? DEFAULT_CHANNELS;
  const fs = opts.fs ?? 250;
  const duration = opts.duration ?? 10;
  const data = synthesize(opts.profile, { channels, fs, duration }) as number[][];
  if (opts.mutate) opts.mutate(data, channels, fs);
  return {
    filename: `${opts.id}.synthetic.edf`,
    channels: channels.length,
    sampling_rate: fs,
    duration_sec: duration,
    data_shape: [channels.length, fs * duration],
    channel_names: channels,
    preview: data,
    data,
    is_synthetic: true,
    description: opts.description,
  };
}

/* ------------------------------------------------------------------ */
/*  Client-side text/CSV ingest fallback                              */
/* ------------------------------------------------------------------ */

export interface IngestResult {
  channels: number;
  sampling_rate: number;
  duration_sec: number;
  data_shape: [number, number];
  channel_names: string[];
  preview: number[][];
  data: number[][];
  filename: string;
  client_parsed: true;
}

export interface ParseTextOptions {
  /** Override the assumed sampling rate (default 250 Hz). */
  sampleRate?: number;
  /** Force orientation: "rows-channels" or "rows-samples" instead of auto-detect. */
  orientation?: "auto" | "rows-channels" | "rows-samples";
}

/**
 * Parse a CSV / TSV / whitespace-delimited text file in the browser.
 * Heuristics: header row of strings → channel names, otherwise Ch1..ChN.
 * Orientation auto-detected (long axis = samples) unless overridden.
 */
export function parseTextEEG(
  text: string,
  filename: string,
  assumedFsOrOpts: number | ParseTextOptions = 250
): IngestResult {
  const opts: ParseTextOptions =
    typeof assumedFsOrOpts === "number"
      ? { sampleRate: assumedFsOrOpts, orientation: "auto" }
      : { sampleRate: 250, orientation: "auto", ...assumedFsOrOpts };
  const assumedFs = opts.sampleRate ?? 250;
  const orientation = opts.orientation ?? "auto";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0) throw new Error("Empty file");

  const sep = lines[0].includes(",") ? "," : lines[0].includes("\t") ? "\t" : /\s+/;
  const splitLine = (s: string) => (typeof sep === "string" ? s.split(sep) : s.split(sep));

  const firstRow = splitLine(lines[0]).map((v) => v.trim());
  const hasHeader = firstRow.some((v) => isNaN(Number(v)));
  const channelNames = hasHeader
    ? firstRow.map((v, i) => v || `Ch${i + 1}`)
    : firstRow.map((_, i) => `Ch${i + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const numericRows: number[][] = [];
  for (const line of dataLines) {
    const parts = splitLine(line).map(Number);
    if (parts.every((v) => Number.isFinite(v))) numericRows.push(parts);
  }
  if (numericRows.length === 0) throw new Error("No numeric data found");

  const nRow = numericRows.length;
  const nCol = numericRows[0].length;

  // Decide orientation
  const rowsAreChannels =
    orientation === "rows-channels"
      ? true
      : orientation === "rows-samples"
      ? false
      : nCol >= nRow; // auto: longer axis = samples
  let data: number[][];
  let names: string[];
  if (rowsAreChannels) {
    data = numericRows;
    names = channelNames.slice(0, nRow).concat(
      Array.from({ length: Math.max(0, nRow - channelNames.length) }, (_, i) => `Ch${channelNames.length + i + 1}`)
    );
  } else {
    data = Array.from({ length: nCol }, () => new Array(nRow));
    for (let r = 0; r < nRow; r++) for (let c = 0; c < nCol; c++) data[c][r] = numericRows[r][c];
    names = channelNames.slice(0, nCol);
    while (names.length < nCol) names.push(`Ch${names.length + 1}`);
  }
  const samples = data[0].length;
  return {
    filename,
    channels: data.length,
    sampling_rate: assumedFs,
    duration_sec: samples / assumedFs,
    data_shape: [data.length, samples],
    channel_names: names,
    preview: data,
    data,
    client_parsed: true,
  };
}
